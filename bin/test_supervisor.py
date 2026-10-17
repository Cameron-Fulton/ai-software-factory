"""Supervisor decision tests against a fake factory, fake gh and fake Slack. Nothing real runs."""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import supervisor as sv

REPO = "acme/app"
OPERATOR = "boss"


class World:
    """Just enough of Archon and GitHub for the supervisor to act on."""

    def __init__(self, root: Path):
        self.root = root
        self.clock = 1_000_000.0
        self.runs: dict[str, dict] = {}
        self.issues = [{"number": 7, "url": f"https://github.com/{REPO}/issues/7",
                        "title": "Add the thing", "labels": [{"name": sv.INTAKE_LABEL}]}]
        self.prs: dict[int, dict] = {}
        self.events: list[dict] = []
        self.calls: list[list[str]] = []
        self.spawned: list[list[str]] = []
        self.slack: list[str] = []
        self.pings: list[str] = []
        self.next_id = 0

    def stamp(self, offset: float = 0) -> str:
        from datetime import datetime, timezone
        return datetime.fromtimestamp(self.clock + offset, timezone.utc).isoformat().replace("+00:00", "Z")

    def call(self, argv, cwd=None, timeout=300):
        self.calls.append(argv)
        if argv[:2] == ["python3", "factory/consumer.py"]:
            return self.factory(argv[2:])
        assert argv[0] == "gh", argv
        return self.gh(argv[1:])

    def factory(self, args):
        if args[0] == "run":
            self.next_id += 1
            run_id = f"run-{self.next_id}"
            self.runs[run_id] = {"id": run_id, "workflow_name": args[1], "status": "running",
                                 "metadata": "{}", "inputs": args}
            return json.dumps({"ok": True, "runId": run_id, "branch": f"archon/{run_id}"}) + "\n"
        if args[0] == "get":
            return json.dumps(self.runs[args[1]])
        if args[0] in ("approve", "reject"):
            run = self.runs[args[1]]
            meta = json.loads(run["metadata"])
            meta["approval"]["resolved"] = "approved" if args[0] == "approve" else "rejected"
            run["metadata"] = json.dumps(meta)
            if args[0] == "reject":
                run["status"] = "cancelled"
            return ""
        raise AssertionError(args)

    def gh(self, args):
        if args[:2] == ["issue", "list"]:
            return json.dumps(self.issues)
        if args[:2] == ["issue", "edit"]:
            issue = next(i for i in self.issues if i["number"] == int(args[2]))
            if "--add-label" in args:
                issue["labels"].append({"name": args[args.index("--add-label") + 1]})
            if "--remove-label" in args:
                gone = args[args.index("--remove-label") + 1]
                issue["labels"] = [lab for lab in issue["labels"] if lab["name"] != gone]
            return ""
        if args[:2] == ["pr", "list"]:
            branch = args[args.index("--head") + 1]
            return json.dumps([{"number": n, "url": p["url"]} for n, p in self.prs.items()
                               if p["branch"] == branch and p["state"] == "OPEN"])
        if args[:2] == ["pr", "view"]:
            pr = self.prs[int(args[2])]
            fields = args[args.index("--json") + 1].split(",")
            return json.dumps({f: pr[f] for f in fields})
        if args[:2] == ["pr", "edit"]:
            return ""
        if args[0] == "api":
            return json.dumps(self.events)
        raise AssertionError(args)

    def post(self, url, body=None, headers=None):
        if "slack.com" in url:
            self.slack.append(json.loads(body)["text"])
            return {"ok": True}
        self.pings.append(url)
        return {}

    def label(self, name: str, actor: str = OPERATOR, offset: float = 1):
        self.events.append({"event": "labeled", "label": {"name": name},
                            "actor": {"login": actor}, "created_at": self.stamp(offset)})

    def pause_for_approval(self, run_id):
        self.runs[run_id].update(status="paused", metadata=json.dumps(
            {"approval": {"nodeId": "approval", "message": "Approve the PRs?"}}))


class SupervisorTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        (root / "app").mkdir()
        self.world = World(root)
        self.config = {"projects": [{"name": "app", "path": str(root / "app"), "repo": REPO,
                                     "operator": OPERATOR}]}
        self.state: dict = {}
        env = {"FACTORY_SLACK_TOKEN": "x", "FACTORY_SLACK_CHANNEL": "C1",
               "FACTORY_HEARTBEAT_URL": "https://hc-ping.com/abc"}
        for target, value in (("call", self.world.call), ("post", self.world.post),
                              ("spawn", lambda argv, cwd: self.world.spawned.append(argv)),
                              ("now", lambda: self.world.clock), ("STATE", root / "state.json"),
                              ("STOP", root / "STOP")):
            p = patch.object(sv, target, value)
            p.start()
            self.addCleanup(p.stop)
        p = patch.dict("os.environ", env)
        p.start()
        self.addCleanup(p.stop)

    def tearDown(self):
        self.tmp.cleanup()

    def tick(self, advance: float = 60):
        self.world.clock += advance
        return sv.tick(self.config, self.state)

    def item(self):
        return self.state["app"]["active"]

    def ship_to_pr(self):
        self.tick()
        ship = self.item()["run"]
        self.world.prs[12] = {"url": f"https://github.com/{REPO}/pull/12", "branch": f"archon/{ship}",
                              "state": "OPEN", "headRefOid": "aaa", "labels": []}
        self.world.runs[ship]["status"] = "completed"
        self.tick()
        return self.item()["run"]

    def test_full_path_merges_only_after_operator_label(self):
        self.assertEqual(self.tick(), [])
        self.assertEqual(self.item()["stage"], "shipping")
        mq = self.ship_to_pr()
        self.assertEqual(self.world.runs[mq]["workflow_name"], "archon-merge-queue")
        self.assertIn("mode=approve", self.world.runs[mq]["inputs"])

        self.world.pause_for_approval(mq)
        self.tick()
        self.assertEqual(len(self.world.slack), 1)
        self.assertIn("pull/12", self.world.slack[0])
        self.tick()  # no label yet: nothing happens, nobody is asked twice
        self.assertEqual(len(self.world.slack), 1)
        self.assertFalse(any(c[2:3] == ["approve"] for c in self.world.calls))

        self.world.label(sv.APPROVE_LABEL)
        self.tick()
        self.assertTrue(any(c[2:3] == ["approve"] for c in self.world.calls))
        self.assertEqual(self.world.spawned[-1][-2:], ["resume", mq])

        self.world.runs[mq]["status"] = "completed"
        self.world.prs[12]["state"] = "MERGED"
        self.tick()
        self.assertIsNone(self.state["app"]["active"])
        self.assertNotIn(sv.INTAKE_LABEL, [lab["name"] for lab in self.world.issues[0]["labels"]])
        self.assertIn("merged", self.world.slack[-1])

    def test_label_from_someone_else_or_before_the_ask_does_not_approve(self):
        mq = self.ship_to_pr()
        self.world.label(sv.APPROVE_LABEL, offset=-3600)  # stale label from before the ask
        self.world.pause_for_approval(mq)
        self.tick()
        self.world.label(sv.APPROVE_LABEL, actor="someone-else")
        self.tick()
        self.assertFalse(any(c[2:3] == ["approve"] for c in self.world.calls))

    def test_new_commits_after_the_ask_void_the_approval(self):
        mq = self.ship_to_pr()
        self.world.pause_for_approval(mq)
        self.tick()
        self.world.prs[12]["headRefOid"] = "bbb"
        self.world.label(sv.APPROVE_LABEL)
        self.tick()
        self.assertFalse(any(c[2:3] == ["approve"] for c in self.world.calls))
        self.assertTrue(any(c[2:3] == ["reject"] for c in self.world.calls))
        self.assertIn(sv.STUCK_LABEL, [lab["name"] for lab in self.world.issues[0]["labels"]])

    def test_hold_label_rejects(self):
        mq = self.ship_to_pr()
        self.world.pause_for_approval(mq)
        self.tick()
        self.world.label(sv.HOLD_LABEL)
        self.tick()
        self.assertTrue(any(c[2:3] == ["reject"] for c in self.world.calls))
        self.assertIsNone(self.state["app"]["active"])

    def test_time_wait_is_resumed_once_when_due(self):
        self.tick()
        ship = self.item()["run"]
        self.world.runs[ship].update(status="paused", metadata=json.dumps(
            {"wait": {"kind": "time", "owner": "node", "nodeId": "await-checks",
                      "waitingSince": self.world.stamp(), "resumeAt": self.world.stamp(600)}}))
        self.tick()
        self.assertEqual(self.world.spawned, [])
        self.tick(advance=700)
        self.tick()  # still paused inside the cooldown: no second resume
        self.assertEqual(len(self.world.spawned), 1)
        self.assertEqual(self.world.spawned[0][-2:], ["resume", ship])

    def test_failed_run_marks_issue_stuck_and_intake_skips_it(self):
        self.tick()
        self.world.runs[self.item()["run"]]["status"] = "failed"
        self.tick()
        self.assertIsNone(self.state["app"]["active"])
        self.assertIn(sv.STUCK_LABEL, [lab["name"] for lab in self.world.issues[0]["labels"]])
        self.tick()
        self.assertIsNone(self.state["app"]["active"])

    def test_one_broken_project_reports_and_the_rest_continue(self):
        broken = dict(self.config["projects"][0], name="broken", repo="acme/broken")
        self.config["projects"].insert(0, broken)
        real = self.world.gh

        def gh(args):
            if "acme/broken" in args:
                raise RuntimeError("gh exited 1")
            return real(args)
        self.world.gh = gh
        errors = self.tick()
        self.assertEqual(len(errors), 1)
        self.assertTrue(errors[0].startswith("broken:"))
        self.assertEqual(self.item()["stage"], "shipping")

    def test_kanban_ignore_and_stop_block_intake(self):
        (Path(self.config["projects"][0]["path"]) / ".kanban-ignore").write_text("")
        self.tick()
        self.assertNotIn("app", self.state)
        (Path(self.config["projects"][0]["path"]) / ".kanban-ignore").unlink()
        sv.STOP.write_text("")
        self.tick()
        self.assertIsNone(self.state["app"].get("active"))

    def test_heartbeat_fails_loudly_on_errors_and_never_prints_the_url(self):
        sv.heartbeat(False, "boom")
        sv.heartbeat(True)
        self.assertEqual(self.world.pings, ["https://hc-ping.com/abc/fail", "https://hc-ping.com/abc"])


if __name__ == "__main__":
    unittest.main()
