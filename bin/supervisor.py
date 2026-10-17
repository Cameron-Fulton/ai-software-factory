#!/usr/bin/env python3
"""One unattended loop over every enrolled factory project, with no local session.

Each tick, per project, it advances at most one tracked item:

    intake -> archon-ship -> PR -> archon-merge-queue (approve) -> operator label -> merge

It never merges anything itself. The merge queue's own approval gate does, and the
supervisor only resolves that gate after the operator has labelled the PR. Because a
merge is a production deploy, that label is the only yes it accepts.

Stdlib only: the factory host has python3 and nothing else guaranteed.
Config (trusted, outside every repo): $FACTORY_SUPERVISOR_CONFIG or ~/.factory/supervisor.json
Secrets come from the environment only (sourced from ~/.factory-env):
  FACTORY_HEARTBEAT_URL   healthchecks.io ping URL; silence or /fail pages the operator
  FACTORY_SLACK_TOKEN     bot token with chat:write (optional; without it nobody is asked)
  FACTORY_SLACK_CHANNEL   channel id for approval asks
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HOME = Path(os.environ.get("FACTORY_SUPERVISOR_HOME", "~/.factory")).expanduser()
CONFIG = Path(os.environ.get("FACTORY_SUPERVISOR_CONFIG", str(HOME / "supervisor.json")))
STATE = HOME / "supervisor-state.json"
STOP = HOME / "STOP"

INTAKE_LABEL = "factory:go"
APPROVE_LABEL = "factory:merge"
HOLD_LABEL = "factory:hold"
STUCK_LABEL = "factory:stuck"
RESUME_COOLDOWN = 15 * 60      # a resumed run takes a while to leave "paused"
RUN_TOO_LONG = 4 * 3600        # a run "running" longer than this gets one alert


# ---- boundaries (tests replace these) ---------------------------------------

def call(argv: list[str], cwd: str | None = None, timeout: int = 300) -> str:
    result = subprocess.run(argv, cwd=cwd, capture_output=True, text=True,
                            encoding="utf-8", errors="replace", timeout=timeout)
    if result.returncode:
        raise RuntimeError(f"{' '.join(argv[:4])} exited {result.returncode}: "
                           + (result.stderr or result.stdout)[-800:])
    return result.stdout


def spawn(argv: list[str], cwd: str) -> None:
    """Start and forget. The resumed run outlives this tick; Archon owns it."""
    log = open(HOME / "resume.log", "a", encoding="utf-8")
    subprocess.Popen(argv, cwd=cwd, stdout=log, stderr=log, stdin=subprocess.DEVNULL,
                     start_new_session=True)


def post(url: str, body: bytes | None = None, headers: dict | None = None) -> dict:
    request = urllib.request.Request(url, data=body, headers=headers or {},
                                     method="POST" if body is not None else "GET")
    with urllib.request.urlopen(request, timeout=20) as response:
        raw = response.read().decode("utf-8", "replace")
    try:
        return json.loads(raw)
    except ValueError:
        return {"raw": raw}


def now() -> float:
    return time.time()


# ---- small helpers -----------------------------------------------------------

def iso(ts: str) -> float:
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()


def factory(project: dict, *args: str) -> str:
    return call(["python3", "factory/consumer.py", *args], cwd=project["path"])


def gh(project: dict, *args: str):
    out = call(["gh", *args], cwd=project["path"])
    return json.loads(out) if out.strip() else None


def get_run(project: dict, run_id: str) -> dict:
    run = json.loads(factory(project, "get", run_id, "--json"))
    meta = run.get("metadata") or {}
    run["metadata"] = json.loads(meta) if isinstance(meta, str) else meta
    return run


def launch(project: dict, workflow: str, inputs: dict) -> dict:
    args = ["run", workflow, "--detach", "--json"]
    for key, value in inputs.items():
        args += ["--input", f"{key}={value}"]
    ack = json.loads(factory(project, *args).strip().splitlines()[-1])
    if not ack.get("ok") or not ack.get("runId"):
        raise RuntimeError(f"{workflow} launch refused: {ack}")
    return ack


def slack(text: str) -> bool:
    token, channel = os.environ.get("FACTORY_SLACK_TOKEN"), os.environ.get("FACTORY_SLACK_CHANNEL")
    if not token or not channel:
        print(f"[no slack configured] {text}", file=sys.stderr)
        return False
    reply = post("https://slack.com/api/chat.postMessage",
                 json.dumps({"channel": channel, "text": text}).encode(),
                 {"Authorization": f"Bearer {token}", "Content-Type": "application/json; charset=utf-8"})
    if not reply.get("ok"):
        raise RuntimeError(f"Slack refused the message: {reply.get('error')}")
    return True


def heartbeat(ok: bool, message: str = "") -> None:
    url = os.environ.get("FACTORY_HEARTBEAT_URL")
    if not url:
        print("FACTORY_HEARTBEAT_URL unset: nobody will be paged if this loop stops", file=sys.stderr)
        return
    try:
        post(url if ok else url.rstrip("/") + "/fail", message.encode()[:10000] if message else b"")
    except OSError as error:  # the URL is the credential: never print it
        print(f"heartbeat failed: {type(error).__name__}", file=sys.stderr)


def label_approved(project: dict, pr: int, label: str, since: float) -> bool:
    """True when the operator added `label` to the PR after `since`.

    The actor check matters because other collaborators can label. It cannot tell
    the operator from the factory's own token when both are the same account; that
    residual is documented in the README.
    """
    events = gh(project, "api", f"repos/{project['repo']}/issues/{pr}/events", "--paginate",
                "--jq", "[.[] | select(.event==\"labeled\")]") or []
    return any(e.get("label", {}).get("name") == label
               and (e.get("actor") or {}).get("login") == project["operator"]
               and iso(e["created_at"]) > since for e in events)


def pr_labels(project: dict, pr: int) -> set[str]:
    view = gh(project, "pr", "view", str(pr), "--repo", project["repo"], "--json", "labels")
    return {label["name"] for label in view["labels"]}


def issue_edit(project: dict, number: int, add: str | None = None, remove: str | None = None) -> None:
    args = ["issue", "edit", str(number), "--repo", project["repo"]]
    if add:
        args += ["--add-label", add]
    if remove:
        args += ["--remove-label", remove]
    call(["gh", *args], cwd=project["path"])


# ---- the state machine -------------------------------------------------------

def enrolled(config: dict) -> list[dict]:
    return [p for p in config["projects"] if not (Path(p["path"]) / ".kanban-ignore").exists()]


def intake(project: dict) -> dict | None:
    issues = gh(project, "issue", "list", "--repo", project["repo"], "--state", "open",
                "--label", INTAKE_LABEL, "--json", "number,url,title,labels", "--limit", "50") or []
    issues = [i for i in issues if STUCK_LABEL not in {lab["name"] for lab in i["labels"]}]
    if not issues:
        return None
    issue = min(issues, key=lambda i: i["number"])
    ack = launch(project, "archon-ship", {"target": issue["url"]})
    return {"stage": "shipping", "issue": issue["number"], "title": issue["title"],
            "run": ack["runId"], "branch": ack.get("branch"), "started": now()}


def stuck(project: dict, item: dict, why: str) -> None:
    issue_edit(project, item["issue"], add=STUCK_LABEL)
    slack(f"{project['name']}: the factory stopped on issue #{item['issue']} ({item['title']}). "
          f"{why} It will not retry until someone removes the `{STUCK_LABEL}` label.")


def handle_pause(project: dict, item: dict, run: dict) -> None:
    """Resume what only needs time; ask a human for anything else, once."""
    meta = run["metadata"]
    wait, approval = meta.get("wait") or {}, meta.get("approval") or {}
    if now() - item.get("resumed", 0) < RESUME_COOLDOWN:
        return
    due = wait.get("kind") == "time" and iso(wait["resumeAt"]) <= now()
    if due or approval.get("resolved") == "approved":
        spawn(["python3", "factory/consumer.py", "resume", item["run"]], project["path"])
        item["resumed"] = now()
    elif wait.get("kind") != "time" and not item.get("asked"):
        reason = wait.get("message") or approval.get("message") or "no reason recorded"
        slack(f"{project['name']}: run {item['run']} ({run.get('workflow_name')}) is paused and "
              f"needs a person: {reason[:300]}")
        item["asked"] = now()


def advance(project: dict, item: dict) -> dict | None:
    """Move one item one step. Returns the item, or None when it is finished."""
    run = get_run(project, item["run"])
    status = run.get("status")
    if status in ("pending", "running"):
        if now() - item["started"] > RUN_TOO_LONG and not item.get("slow"):
            slack(f"{project['name']}: run {item['run']} has been running over "
                  f"{RUN_TOO_LONG // 3600} hours on issue #{item['issue']}.")
            item["slow"] = now()
        return item
    if status in ("failed", "cancelled"):
        stuck(project, item, f"The {run.get('workflow_name')} run ended {status}.")
        return None

    if item["stage"] == "shipping":
        if status == "paused":
            handle_pause(project, item, run)
            return item
        prs = gh(project, "pr", "list", "--repo", project["repo"], "--head", item["branch"] or "",
                 "--state", "open", "--json", "number,url") if item.get("branch") else []
        if not prs:
            stuck(project, item, "Delivery finished without an open pull request.")
            return None
        pr = prs[0]
        ack = launch(project, "archon-merge-queue", {
            "prs": json.dumps([pr["url"]]), "mode": "approve",
            "merge_method": project.get("merge_method", "squash")})
        item.update(stage="merging", pr=pr["number"], pr_url=pr["url"], run=ack["runId"],
                    started=now())
        for stale in ("asked", "resumed", "slow"):
            item.pop(stale, None)
        return item

    # stage == "merging"
    if status == "paused":
        approval = run["metadata"].get("approval") or {}
        if approval.get("nodeId") != "approval" or approval.get("resolved"):
            handle_pause(project, item, run)
            return item
        return ask_to_merge(project, item)
    view = gh(project, "pr", "view", str(item["pr"]), "--repo", project["repo"], "--json", "state")
    if view["state"] == "MERGED":
        issue_edit(project, item["issue"], remove=INTAKE_LABEL)
        slack(f"{project['name']}: merged {item['pr_url']} ({item['title']}). It is deploying now.")
        return None
    stuck(project, item, f"The merge queue held {item['pr_url']} instead of merging it; "
                         "its reasons are in the run record and on the pull request.")
    return None


def ask_to_merge(project: dict, item: dict) -> dict | None:
    if not item.get("asked"):
        item["head"] = gh(project, "pr", "view", str(item["pr"]), "--repo", project["repo"],
                          "--json", "headRefOid")["headRefOid"]
        asked = now()
        slack(f"{project['name']} has a change ready to go live: {item['title']}\n{item['pr_url']}\n"
              f"Merging it deploys it to production. To approve, add the label `{APPROVE_LABEL}` "
              f"on that page. To say no, add `{HOLD_LABEL}`.")
        item["asked"] = asked
        return item
    if label_approved(project, item["pr"], HOLD_LABEL, item["asked"]):
        factory(project, "reject", item["run"], "--reason", "operator added the hold label")
        stuck(project, item, "The operator said no.")
        return None
    if not label_approved(project, item["pr"], APPROVE_LABEL, item["asked"]):
        return item
    head = gh(project, "pr", "view", str(item["pr"]), "--repo", project["repo"],
              "--json", "headRefOid")["headRefOid"]
    if head != item["head"]:  # the approval was for code that is no longer there
        call(["gh", "pr", "edit", str(item["pr"]), "--repo", project["repo"],
              "--remove-label", APPROVE_LABEL], cwd=project["path"])
        factory(project, "reject", item["run"], "--reason", "head moved after the ask")
        stuck(project, item, "New commits landed after the approval request, so the approval "
                             "no longer covers them.")
        return None
    factory(project, "approve", item["run"], "--comment", f"operator label {APPROVE_LABEL}")
    call(["gh", "pr", "edit", str(item["pr"]), "--repo", project["repo"],
          "--remove-label", APPROVE_LABEL], cwd=project["path"])
    spawn(["python3", "factory/consumer.py", "resume", item["run"]], project["path"])
    item["resumed"] = now()
    return item


def tick(config: dict, state: dict) -> list[str]:
    """One pass over every enrolled project. Returns the errors, never raises for one project."""
    errors = []
    for project in enrolled(config):
        items = state.setdefault(project["name"], {})
        try:
            item = items.get("active")
            if item is not None:
                items["active"] = advance(project, item)
            elif not STOP.exists() and not (Path(project["path"]) / ".factory/STOP").exists():
                items["active"] = intake(project)
        except Exception as error:  # one broken project must not silence the others
            errors.append(f"{project['name']}: {type(error).__name__}: {str(error)[:500]}")
        finally:
            save_state(state)
    return errors


def load_state() -> dict:
    return json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {}


def save_state(state: dict) -> None:
    tmp = STATE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2), encoding="utf-8")
    tmp.replace(STATE)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--once", action="store_true", help="run one tick and exit")
    args = parser.parse_args(argv)
    HOME.mkdir(parents=True, exist_ok=True)
    interval = 300
    while True:
        try:
            config = json.loads(CONFIG.read_text(encoding="utf-8"))
            interval = int(config.get("interval_seconds", interval))
            state = load_state()
            errors = tick(config, state)
        except Exception as error:
            errors = [f"supervisor: {type(error).__name__}: {str(error)[:500]}"]
        stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
        for line in errors:
            print(f"{stamp} {line}", file=sys.stderr)
        heartbeat(not errors, "\n".join(errors))
        if args.once:
            return 1 if errors else 0
        time.sleep(interval)


if __name__ == "__main__":
    raise SystemExit(main())
