"""Collector tests against a small engine database built in memory. No network.

    python -m unittest discover -s tests
"""
from __future__ import annotations

import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from factory_dashboard import collect as c  # noqa: E402
from factory_dashboard.prices import cost  # noqa: E402

NOW = 1_791_570_000.0
REPO = "https://github.com/o/journalx"
LEAK = "SECRET ISSUE TEXT 47 | const publish = required('PUBLISH_HOLDS');"


def engine(runs: list[tuple], events: list[tuple]) -> sqlite3.Connection:
    db = sqlite3.connect(":memory:")
    db.executescript("""
        create table remote_agent_codebases (id text, name text);
        create table remote_agent_workflow_runs (id text, codebase_id text, workflow_name text, status text,
            metadata text, started_at text, completed_at text);
        create table remote_agent_workflow_events (id integer primary key, workflow_run_id text,
            event_type text, step_name text, data text, created_at text);
    """)
    db.execute("insert into remote_agent_codebases values ('c1', 'o/journalx')")
    db.execute("insert into remote_agent_codebases values ('c9', 'someone/scratch')")
    db.executemany("insert into remote_agent_workflow_runs values (?,?,?,?,?,?,?)", runs)
    db.executemany("insert into remote_agent_workflow_events (workflow_run_id, event_type, step_name, data,"
                   " created_at) values (?,?,?,?,?)", events)
    return db


def step(model: str, cost_usd: float = 1.0, **extra) -> str:
    return json.dumps({"tokens": {"input": 1000, "output": 100, "cacheRead": 800, "cacheWrite": 100},
                       "model_usage": {"requested": model, "resolved": model}, "num_turns": 3,
                       "duration_ms": 60000, "cost_usd": cost_usd, "node_output": LEAK, **extra})


def scenario():
    runs = [
        ("r1", "c1", "archon-ship", "completed", json.dumps({"inputs": {"target": f"{REPO}/issues/7"}}),
         "2026-10-08 10:00:00", "2026-10-08 10:30:00"),
        ("r2", "c1", "archon-review", "completed", json.dumps({"inputs": {"scope": f"{REPO}/pull/70"}}),
         "2026-10-08 10:40:00", "2026-10-08 11:00:00"),
        ("r3", "c1", "archon-ship", "failed", json.dumps({"inputs": {"target": f"{REPO}/issues/8"}}),
         "2026-10-08 12:00:00", "2026-10-08 12:10:00"),
        ("r4", "c9", "smoke", "completed", "{}", "2026-10-08 12:00:00", "2026-10-08 12:01:00"),
    ]
    events = [
        ("r1", "node_completed", "implement", step("claude-opus-5-5"), "2026-10-08 10:20:00"),
        ("r2", "node_completed", "verdict", step("claude-haiku-5-5", structured_output={"ready": True}),
         "2026-10-08 10:50:00"),
        ("r3", "node_failed", "triage", json.dumps({"error": "All 5 Claude accounts in X are blocked; " + LEAK}),
         "2026-10-08 12:05:00"),
        ("r3", "workflow_failed", None, json.dumps({"error": "token ghp_" + "a" * 36 + " " + LEAK}),
         "2026-10-08 12:06:00"),
        ("r4", "node_completed", "x", step("claude-opus-5-5"), "2026-10-08 12:00:30"),
    ]
    loops = {"journalx": {
        "7": {"issue": 7, "title": "Add a thing", "url": f"{REPO}/issues/7", "stage": "done",
              "pr": f"{REPO}/pull/70", "started": 1791453600.0},
        "8": {"issue": 8, "title": "Another", "url": f"{REPO}/issues/8", "stage": "blocked",
              "reason": "it changes a file the operator holds (CLAUDE.md), and those wait for you. " + LEAK},
    }}
    loops["journalx"]["9"] = {"issue": 9, "title": "Nothing to build", "url": f"{REPO}/issues/9", "stage": "closed"}
    loops["journalx"]["10"] = {"issue": 10, "title": "Depends on 9", "url": f"{REPO}/issues/10", "stage": "waiting"}
    pool = {"a": {"blockedUntil": int((NOW + 3600) * 1000), "blockReason": "quota"},
            "b": {"blockedUntil": int((NOW - 60) * 1000)}}
    return c.collect(engine(runs, events), loops, pool, NOW)


class Prices(unittest.TestCase):
    def test_matches_the_engines_own_figure(self):
        tokens = {"input": 839391, "output": 6149, "cacheRead": 730063, "cacheWrite": 109312}
        self.assertAlmostEqual(cost("claude-sonnet-5", tokens, 9), 0.6447826, places=4)

    def test_haiku_55_long_prompts_cost_more(self):
        self.assertAlmostEqual(cost("claude-haiku-5-5", {"input": 50_000}, 1), 0.005)
        self.assertAlmostEqual(cost("claude-haiku-5-5", {"input": 150_000}, 1), 0.075)

    def test_unknown_model_has_no_price(self):
        self.assertIsNone(cost("some-new-model", {"input": 1}, 1))


class Collect(unittest.TestCase):
    def setUp(self):
        self.d = scenario()

    def test_runs_are_tied_to_their_task_through_the_issue_or_its_pull_request(self):
        task = next(t for t in self.d["tasks"] if t["issue"] == 7)
        self.assertEqual((task["runs"], task["status"], task["firstReviewReady"]), (2, "merged", True))

    def test_runs_outside_enrolled_projects_are_left_out(self):
        self.assertEqual({r["id"] for r in self.d["runs"]}, {"r1", "r2", "r3"})
        self.assertEqual(len(self.d["steps"]), 2)

    def test_no_free_text_from_runs_reaches_the_data(self):
        blob = json.dumps(self.d)
        self.assertNotIn("SECRET ISSUE TEXT", blob)
        self.assertNotIn("PUBLISH_HOLDS", blob)
        self.assertNotIn("ghp_", blob)

    def test_failures_and_stops_become_fixed_categories(self):
        cats = {f["category"] for f in self.d["failures"]}
        self.assertIn("Logins out of usage", cats)
        self.assertTrue(cats <= {name for name, _ in c.CATEGORIES} | {"Other"})
        task = next(t for t in self.d["tasks"] if t["issue"] == 8)
        self.assertEqual((task["status"], task["blockedBecause"]), ("needs a person", "Held for a person"))

    def test_closed_and_waiting_tasks_do_not_read_as_merged_or_needing_a_person(self):
        status = {t["issue"]: t["status"] for t in self.d["tasks"]}
        self.assertEqual((status[9], status[10]), ("closed", "waiting"))

    def test_steps_are_priced_per_model(self):
        self.assertEqual({s["model"] for s in self.d["steps"]}, {"claude-opus-5-5", "claude-haiku-5-5"})
        self.assertTrue(all(s["cost"] > 0 for s in self.d["steps"]))

    def test_logins_show_who_has_usage_left(self):
        logins = {l["login"]: l for l in self.d["logins"]}
        self.assertEqual((logins["a"]["available"], logins["b"]["available"]), (False, True))

    def test_write_is_atomic_and_readable(self):
        out = Path(tempfile.mkdtemp()) / "www" / "data.json"
        c.write_atomic(out, "{}")
        self.assertEqual(out.read_text(), "{}")


if __name__ == "__main__":
    unittest.main()
