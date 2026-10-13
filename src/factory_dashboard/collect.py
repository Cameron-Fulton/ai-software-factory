"""Read the factory's own records and write the dashboard's data file.

Runs on the factory host as root, every 15 minutes (deploy/factory-dashboard-collect.timer).
It reads, never writes, three sources:
- the engine database (Archon's archon.db): every run, and per step the model, tokens,
  turns and time, plus failures and review verdicts
- each enrolled project's loop state (.factory/milestone-loop.json): one job per task
- the engine's account-pool file: which subscription logins are out of usage, until when
and writes data.json into the folder the unprivileged web server serves; the dashboard app
reads it and does all aggregation in the browser.

No free text from a run reaches the file. Step output, failure messages and stop reasons can
hold code, model prose and issue text, so each failure is reduced to a fixed category from
CATEGORIES plus, at most, a pull-request number. Issue titles are kept: the owner reads them.

    python -m factory_dashboard.collect --out /var/lib/factory-dashboard/www
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sqlite3
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

from .prices import PRICES, cost as price

DB = os.environ.get("ARCHON_DB", "/root/.archon/archon.db")
POOL = os.environ.get("ARCHON_ACCOUNT_POOL_FILE", "/root/.archon/claude-account-pool.json")
LOOPS = os.environ.get("FACTORY_LOOPS", "journalx=/root/journalx/.factory/milestone-loop.json,"
                                        "fathom=/root/fathom/.factory/milestone-loop.json")
ACTIVE = {"ship", "review", "queue", "repair", "deliver"}
# the loop's stage -> what the owner reads; anything new and unknown shows as "other"
STATUS = {"done": "merged", "blocked": "needs a person", "waiting": "waiting", "closed": "closed",
          **{stage: "in progress" for stage in ACTIVE}}
WEIGHTS = {"first_try": 0.40, "cost": 0.30, "time": 0.15, "rework": 0.15}  # owner's choice, 2026-10-09

ISSUE_URL = re.compile(r"https://github\.com/([\w.-]+/[\w.-]+)/issues/(\d+)")
PR_URL = re.compile(r"https://github\.com/([\w.-]+/[\w.-]+)/pull/(\d+)")

# first match wins; the text is only matched, never kept
CATEGORIES: list[tuple[str, re.Pattern]] = [(name, re.compile(pattern, re.I)) for name, pattern in [
    ("Logins out of usage", r"usage limit|accounts? in \w+ (are|is) blocked|weekly limit|spend limit"),
    ("Merge conflict", r"merge conflict|conflict(s|ing)?\b"),
    ("Checks not green", r"non-green|checks? (failed|were still running)|CI remains|refusing to flip"),
    ("Held for a person", r"operator holds|wait(s)? for you|code owner"),
    ("Review not cleared", r"repair lap did not clear|review finished without|not ready"),
    ("Waiting for a person", r"waiting for a person|approval step"),
    ("Factory chose not to build", r"decided not to build|no delivery needed|NO_ACTION|DESIGN_FIRST|BLOCKED"),
    ("Loop interrupted", r"stopped in the middle|step error"),
    ("Merge did not happen", r"merge did not happen|merge check"),
    ("Timed out", r"time(d)? ?out|idle_timeout"),
    ("Step failed", r"failed|exit \d|error"),
]]


def category(text: str | None) -> str:
    for name, pattern in CATEGORIES:
        if text and pattern.search(text):
            return name
    return "Other"


def pr_number(text: str | None) -> int | None:
    m = PR_URL.search(text or "") or re.search(r"pull request #(\d+)", text or "")
    return int(m.groups()[-1]) if m else None


def parse_time(value) -> float | None:
    """The engine stores SQLite text timestamps; the loop stores epoch seconds."""
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return float(value) / (1000 if value > 1e12 else 1)
    text = str(value).replace("T", " ").replace("Z", "")
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=timezone.utc).timestamp()
        except ValueError:
            continue
    return None


def snapshot(path: str) -> sqlite3.Connection:
    """A private in-memory copy, so a long read never holds the engine's database.

    A read-only open of a WAL database must create its -shm file when the engine has none
    open, and the collector may not write in the engine's folder. Then it copies the files
    into a private folder and reads the copy; a copy torn by a concurrent write fails the
    integrity check and the run is skipped until the next one.
    """
    mem = sqlite3.connect(":memory:")
    try:
        src = sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=30)
        src.backup(mem)
        src.close()
        return mem
    except sqlite3.OperationalError:
        pass
    with tempfile.TemporaryDirectory() as tmp:
        copy = Path(tmp) / "archon.db"
        shutil.copyfile(path, copy)
        if Path(path + "-wal").exists():
            shutil.copyfile(path + "-wal", str(copy) + "-wal")
        src = sqlite3.connect(copy)
        if src.execute("pragma quick_check").fetchone()[0] != "ok":
            raise RuntimeError("the copied engine database is inconsistent; next run will retry")
        src.backup(mem)
        src.close()
    return mem


def load_loops(spec: str) -> dict[str, dict]:
    loops = {}
    for part in filter(None, spec.split(",")):
        name, path = part.split("=", 1)
        try:
            loops[name] = json.loads(Path(path).read_text(encoding="utf-8")).get("jobs", {})
        except (OSError, ValueError):
            loops[name] = {}
    return loops


def project_of(repo: str | None, names: list[str]) -> str:
    tail = (repo or "").split("/")[-1].lower()
    return next((n for n in names if n.lower() == tail), tail or "unknown")


def title_of(text: str | None) -> str:
    text = " ".join(str(text or "").split())
    return text if len(text) <= 140 else text[:139].rstrip() + "…"


def collect(db: sqlite3.Connection, loops: dict[str, dict], pool: dict, now: float) -> dict:
    names = list(loops)
    repos = {cid: name for cid, name in db.execute("select id, name from remote_agent_codebases")}
    pr_to_issue: dict[tuple[str, int], int] = {}
    for project, jobs in loops.items():
        for job in jobs.values():
            m = PR_URL.search(job.get("pr") or "")
            if m:
                pr_to_issue[(project, int(m[2]))] = int(job["issue"])

    runs: dict[str, dict] = {}
    for rid, cid, wf, status, meta, started, done in db.execute(
            "select id, codebase_id, workflow_name, status, metadata, started_at, completed_at "
            "from remote_agent_workflow_runs"):
        try:
            text = json.dumps((json.loads(meta or "{}") or {}).get("inputs") or {})
        except ValueError:
            text = ""
        project = project_of(repos.get(cid), names)
        if project not in names:
            continue  # test and manual runs outside the enrolled projects
        issue = None
        m = ISSUE_URL.search(text)
        if m:
            issue = int(m[2])
        else:
            for m in PR_URL.finditer(text):
                issue = pr_to_issue.get((project, int(m[2])))
                if issue:
                    break
        runs[rid] = {"project": project, "workflow": (wf or "").removeprefix("archon-"), "status": status,
                     "issue": issue, "start": parse_time(started), "end": parse_time(done),
                     "cost": 0.0, "ready": None}

    models: list[str] = []
    steps = []
    for rid, step, created, data in db.execute(
            "select workflow_run_id, step_name, created_at, data from remote_agent_workflow_events "
            "where event_type = 'node_completed' order by id"):
        run = runs.get(rid)
        if run is None:
            continue
        try:
            d = json.loads(data or "{}")
        except ValueError:
            continue
        so = d.get("structured_output")
        if isinstance(so, dict) and isinstance(so.get("ready"), bool) and run["workflow"] == "review":
            run["ready"] = so["ready"]  # the review's verdict; the last one in the run wins
        tokens = d.get("tokens")
        if not isinstance(tokens, dict):
            continue
        model = ((d.get("model_usage") or {}).get("resolved")) or "unknown"
        if model not in models:
            models.append(model)
        turns = int(d.get("num_turns") or 0)
        est = price(model, tokens, turns)
        c = est if est is not None else float(d.get("cost_usd") or 0)
        run["cost"] += c
        steps.append({"t": parse_time(created), "run": rid, "project": run["project"], "model": model,
                      "workflow": run["workflow"], "input": int(tokens.get("input") or 0),
                      "output": int(tokens.get("output") or 0), "cacheRead": int(tokens.get("cacheRead") or 0),
                      "cacheWrite": int(tokens.get("cacheWrite") or 0), "turns": turns,
                      "seconds": round(int(d.get("duration_ms") or 0) / 1000, 1), "cost": round(c, 5)})

    failures = []
    for rid, step, created, data in db.execute(
            "select workflow_run_id, step_name, created_at, data from remote_agent_workflow_events "
            "where event_type in ('node_failed', 'workflow_failed') order by id"):
        run = runs.get(rid) or {}
        try:
            d = json.loads(data or "{}")
        except ValueError:
            d = {}
        text = str(d.get("error") or d.get("message") or "")
        failures.append({"t": parse_time(created), "project": run.get("project"), "issue": run.get("issue"),
                         "workflow": run.get("workflow"), "kind": "run" if step is None else "step",
                         "category": category(text)})

    by_task: dict[tuple[str, int], list[dict]] = {}
    for run in runs.values():
        if run["issue"]:
            by_task.setdefault((run["project"], run["issue"]), []).append(run)
    tasks = []
    for project, jobs in loops.items():
        for job in jobs.values():
            issue = int(job["issue"])
            linked = sorted(by_task.get((project, issue), []), key=lambda r: r["start"] or 0)
            reviews = [r for r in linked if r["workflow"] == "review" and r["ready"] is not None]
            delivers = [r for r in linked if r["workflow"] == "deliver"]
            stage = job.get("stage")
            started = parse_time(job.get("started")) or (linked[0]["start"] if linked else None)
            finished = max((r["end"] or 0 for r in linked), default=0) or None
            reason = job.get("reason") if stage == "blocked" else None
            tasks.append({
                "project": project, "issue": issue, "title": title_of(job.get("title")),
                "url": job.get("url") if ISSUE_URL.match(job.get("url") or "") else None,
                "pr": job.get("pr") if PR_URL.match(job.get("pr") or "") else None,
                "status": STATUS.get(stage, "other"),
                "stage": stage if stage in STATUS else "other",
                "blockedBecause": category(reason) if reason else None,
                "started": started, "finished": finished if stage == "done" else None,
                "runs": len(linked), "reviews": len(reviews),
                "firstReviewReady": reviews[0]["ready"] if reviews else None,
                "repairs": max(int(job.get("repairs") or 0), len(delivers)),
                "failures": int(job.get("failures") or 0),
                "cost": round(sum(r["cost"] for r in linked), 4),
            })

    logins = []
    for name, state in sorted(pool.items()):
        until = parse_time(state.get("blockedUntil"))
        out = bool(until and until > now)
        logins.append({"login": name, "available": not out, "until": until if out else None,
                       "lastUsed": parse_time(state.get("lastUsed"))})

    return {
        "version": 2,
        "generated": now,
        "projects": names,
        "weights": WEIGHTS,
        "prices": {m: list(p) for m, p in PRICES.items()},
        "steps": steps,
        "runs": [{"id": rid, **r} for rid, r in runs.items()],
        "tasks": tasks,
        "failures": failures,
        "logins": logins,
    }


def write_atomic(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".tmp-")
    with os.fdopen(fd, "w", encoding="utf-8") as sink:
        sink.write(text)
    os.chmod(tmp, 0o644)
    os.replace(tmp, path)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", required=True, help="folder the web server serves")
    ap.add_argument("--db", default=DB)
    ap.add_argument("--pool", default=POOL)
    ap.add_argument("--loops", default=LOOPS)
    args = ap.parse_args(argv)
    try:
        pool = json.loads(Path(args.pool).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        pool = {}
    data = collect(snapshot(args.db), load_loops(args.loops), pool, time.time())
    write_atomic(Path(args.out) / "data.json", json.dumps(data, separators=(",", ":")))
    print(f"wrote {len(data['steps'])} steps, {len(data['runs'])} runs, {len(data['tasks'])} tasks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
