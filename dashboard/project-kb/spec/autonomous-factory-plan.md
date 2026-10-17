# One factory, running around the clock

Status: plan, not built. Written 2026-10-17 with the `converge` method
(`D:/projects/dev-system/skills/synced/*/converge/SKILL.md`): one objective, a
capability table with its gaps, the data model, the cut, a build order by dependency,
and the owner decisions. It lives beside `control-room-plan.md`, the other
factory-wide plan, because the fork has no other fork-owned home for plans.

## The objective

Every enrolled project's open issues get built, reviewed and merged with no person in
the loop, day and night. The factory finds its own new work and repairs itself. The
owner is asked only for decisions that are really theirs.

Owner's words, 2026-10-16: "I need the AI Factory continually building,
monitoring/auditing and adding issues/tasks that are then automatically completed and
the cycle of self-improvement and optimization and self-healing continues 24/7", done
"system wide so the other projects using AI Factory get the update from OUR fork."

## What exists today

Four separate things do parts of this.

- **The JournalX loop**: `journalx/harness/factory_loop.py`, about 1,000 lines. It runs
  from the project checkout and updates itself from JournalX `main`. It takes issues
  labelled `factory`, and the backlog sync applies that label once an issue's
  dependencies close.
- **The Fathom loop**: `fathom/harness/factory_loop.py` plus `scrutiny.py`. The service
  runs a hand-installed copy in `/root/factory-loop/`, so nothing updates it by itself.
  Since 2026-10-17 it takes every open issue filed by someone with push access, lowest
  milestone first.
- **Upstream `archon-loop` and `archon-manager`**, at the fork's pin `5fa0a816`. They
  are not installed anywhere.
- **The dashboard** (`dashboard/`). It reads both loops' `milestone-loop.json` and
  the engine database.

The two loops started as one file and have been patched separately ever since. Every
fix made in 2026-10 had to be written twice, and Fathom was a week behind until
fathom PR 708.

### Capability table

One row per step of the cycle. **Gap** means nothing does it.

| Step | JournalX loop | Fathom loop | archon-loop / manager @5fa0a816 |
|---|---|---|---|
| Take every open issue, keep up with new ones | label + backlog sync | yes (2026-10-17) | yes, skips `needs-owner` |
| Respect `Depends on` | backlog sync labels | triage BLOCKED waits | yes |
| Several laps at once | no | no | yes (claims) |
| Build, review, merge with main, repair | yes, 3 laps | yes, 3 laps | yes, 3 attempts |
| Hand open review threads to the repair | yes | yes | reads comments, resolves none |
| Re-run checks the engine blamed on the environment | yes | yes | **gap**: the attention wait is never woken |
| Act on triage's decline (close, amend, decide, wait) | yes | yes | partly |
| Recover a run cut off by a restart | yes | yes | claim expiry after 6 hours |
| Take a stopped task up again by itself | yes, twice | yes, twice | partly (manager) |
| Agent scrutiny of database, CI and Worker changes | n/a | yes | **gap** |
| Hold files that can reach the signing key | yes, mechanical | n/a | prompt only |
| Test-count-only workflow edits merge | yes | n/a | **refused**: counts drift low |
| Rotate across the six subscription logins | yes (engine pin) | yes (engine pin) | **gap**: rotation removed from the engine |
| Audit the project and file new issues | **gap** | **gap** | manager: holdout failures, red main, repeated fixes, at most 5 a pass |
| Improve the factory itself from its own failures | **gap** | **gap** | **gap** |
| Ship a loop fix to every project from one place | **gap** (per project) | **gap** (hand copy) | the pin, but nothing advances it on the host |
| Enroll a new project | `init` by hand | `init` by hand | `init` by hand |
| Work an issue that needs two repositories | **gap** | **gap** | **gap** |
| Tell the owner | Slack | Slack | a GitHub issue |

Sources: the gap analysis of 2026-10-17 (session `62d0779b`), which cites every row to
file and line. Its two load-bearing findings:

1. At `5fa0a816` the engine no longer rotates across the subscription logins.
   `account-pool.ts` and `ARCHON_CLAUDE_ACCOUNTS` are absent under
   `packages/providers/src/claude/`. That rotation is how six subscriptions run one
   factory without paying for usage, so moving to that pin today would stall the
   factory at the first usage limit.
2. archon-loop has none of Fathom's scrutiny floors. Those floors stop a schema change
   that drops data, a weakened CI workflow, and a faked required check. Fathom deploys
   on merge.

### What the empty rows mean

- **No single loop.** This is the root cause of most of October's repeated work.
- **No auditor.** Nothing looks at a project and files the next issue.
- **No self-improvement.** The dashboard records why runs fail. Nothing turns that
  record into a fix.
- **No path for cross-repository work.** This is why fathom #614 has been parked since
  2026-10-05.
- **No rollout.** A fix merged in one place does not reach the others.

## Decision: one loop, owned by the fork, not archon-loop yet

We keep our loop and make it the only one. It moves into the fork at a new fork-owned
path, `loop/`. Every project runs that one copy. We do not move to `archon-loop` while
the engine lacks login rotation and the Fathom floors. The fork's TODO line that says
"move both projects onto archon-loop" is replaced by this plan.

**Revisit when** a pin that contains `archon-loop` also rotates logins. The check is
the gap table above, rerun against the new pin. `TODO.md` keeps that line.

**Why the fork and not a project.** This is the owner's "from our fork". It is also
the only repository whose job is the factory.

`loop/` is a fork-only path, like `dashboard/`. Upstream never touches it, so the daily
upstream sync never conflicts on it. Step 1 declares it in a root `PROJECT-LAYOUT.json`
and in `AGENT-GUIDE.md`'s ownership table.

## The data model

The loop's state today is one `milestone-loop.json` per project. Each file maps an
issue number to a job with free-form keys that the two loops have grown differently.
One model replaces it.

### Project

What the loop needs to know about one enrolled repository. Its home is
`harness/loop.config.json` in that project, so the project owns its own rules.

| Field | Meaning |
|---|---|
| `repo` | `owner/name` |
| `checkout` | host path, for example `/root/fathom` |
| `intake` | `"*"` for every open issue, or one label |
| `held` | path patterns that only the owner merges |
| `count_only` | workflow files where a raised test count may merge |
| `fact_sections` | headings in the instruction files that may change |
| `gated` | surfaces that need scrutiny: `data`, `controls`, `workers` |
| `required_checks` | the CI job names that must pass, and their workflow file |

### Task

Identity is `(repo, issue)`. An issue number alone collides across repositories, and
that is the identity trap the cross-repository row exposes. A task owns a list of pull
requests, and each one is identified by `(repo, number)`. So one Fathom issue can own a
Fathom PR and a Spider PR.

Fields:

- `stage`: one of `ship`, `review`, `scrutiny`, `queue`, `repair`, `deliver`,
  `waiting`, `blocked`, `done`, `closed`
- counters: `repairs`, `failures`, `readmits`, `ci_reruns`, `waits`
- `run` and `lap`, for the run in flight
- `stop`, set only while blocked

### Stop

| Field | Meaning |
|---|---|
| `kind` | `retryable` (ran out of laps or steps), `owner` (held file, owner decision), or `foreign` (a PR the factory does not own) |
| `reason` | plain-language text |

Only `retryable` stops are taken up again by themselves.

### Where it lives

`.factory/loop-state.json` in each project, written atomically under the existing
`flock`. The schema lives once, in `loop/state.schema.json`. The loop and the dashboard
collector both validate against it. A test fails when the two disagree.

The dashboard reads `loop-state.json` and still reads old `milestone-loop.json` files
until every project has moved.

## The cut for version one

**In:**

- one loop in `loop/`, with project policy in `harness/loop.config.json`
- scrutiny as an optional gate, for any project whose config lists `gated` surfaces
- one systemd template unit, `factory-loop@<project>.service`
- self-update from the fork
- the auditor
- the self-improvement pass
- Spider enrolled
- cross-repository tasks through `Depends on: owner/repo#n` between per-repository issues

**Out, and why:**

- **Parallel laps.** The six logins already run out between resets. More laps would
  only spend them faster.
- **Moving to archon-loop.** It is a regression on the four highest-stakes guards.
- **A new notification channel.** Slack works today.
- **Changing the engine pin.** JournalX runs `e2799053`, Fathom runs `31d0021`, both
  from `Cameron-Fulton/Archon`. Unifying them is its own task, and nothing in this plan
  depends on it.

## Build order

Each step names what it unblocks. Each is its own branch, in its own worktree under
`D:/projects/.worktrees/<repo>/<lane>`, and merges through a pull request.

### 0. Reconcile what is open first (operating rule 15)

- The shared fork checkout `D:/projects/ai-software-factory` sits on `feat/supervisor`.
  It has untracked `bin/supervisor.py`, which carries INC-2026-872, plus `CLAUDE.md`,
  `CONTEXT.md` and `lifecycle/`. Land or drop the supervisor work, then return that
  tree to `main` (TODO.md says how).
- Record the pins actually running: JournalX `e2799053`, Fathom `31d0021`. The
  committed `factory/pack.json` in both projects says `24796870`.

Unblocks: every later fork change starts from a clean `main`.

### 1. The shared loop in the fork

Merge the JournalX loop, the Fathom loop and `scrutiny.py` into `loop/`:

- `factory_loop.py`
- `scrutiny.py` and `scrutiny_prompts/`
- `state.schema.json`
- tests that are the union of both suites, with every test kept

Everything project-specific moves into `harness/loop.config.json`:

- JournalX's held list and the count-only and fact-section exceptions
- Fathom's gated surfaces, required checks and check provenance

The two current configs must reproduce each loop's behavior exactly. A test runs both
configs through the old fixtures.

Unblocks: steps 2 to 7.

### 2. Install and cut over on the host

1. Install from the host's fork clone `/root/ai-software-factory`, which is
   fast-forward only. Run the tests on the host, then copy into `/root/factory-loop/`.
2. Add one template unit, `factory-loop@.service`, with `KillMode=control-group`.
   Keep the `needrestart` exclusion and widen it to the new unit name.
3. Cut over JournalX first, then Fathom. For each project:
   1. touch `.factory/STOP`
   2. wait until no `consumer.py` child is running
   3. convert `milestone-loop.json` to `loop-state.json` with a one-time script
   4. start the new unit and stop the old one
   5. watch one full lap
4. Then delete `harness/factory_loop.py` from both projects, through a pull request in
   each (Rule 23).

Unblocks: one code path for every later change.

### 3. Self-update from the fork

Between ticks, the loop fast-forwards `/root/ai-software-factory` to fork `main`. It
runs `loop/` tests on the host and re-executes into the new code only when they pass.
That is JournalX's existing self-update, pointed at the fork and with a test gate added.

Unblocks: "the other projects get the update from our fork", with nobody copying files.

### 4. Enroll Spider and build fathom #614

1. Clone `SearchActions/fathom-spider` to `/root/fathom-spider`.
2. Run `bin/factory.py init` at Fathom's pin `31d0021`.
3. Write `MISSION.md`, the harness config (required check: the job in `ci.yml`) and
   `harness/loop.config.json`. The `gated` field gets `data`, because the importer
   writes to Fathom's stores.
4. Start `factory-loop@fathom-spider`.
5. Add Spider to the dashboard collector.
6. Split #614 by repository:
   - a Fathom issue for the authoritative site-identity lookup the importer will call
   - a Spider issue for the importer check, with `Depends on: SearchActions/fathom#<n>`
   - #614 stays open as the parent, and the loop closes it when both children close
7. Remove #614's `archon-blocked` label only once both child issues exist. Its own
   text sets that condition.

First, read `sync-crawl-to-fathom.ts` and the Fathom side it writes to. That fixes the
exact contract before the issues are written.

Unblocks: every future Spider issue, and the cross-repository pattern.

### 5. The auditor

A daily lap per project, run as a scheduled step of the same loop, so it shares the
login rotation. It reads:

- the project
- its incident and landmine notes
- the dashboard's failure categories for that project

It files at most 5 new issues per day per project. They are authored by the loop's own
account, so intake trusts them, and they carry the label `factory-found` with
acceptance checks. Before filing, it searches open and recently closed issues and does
not file a duplicate.

Unblocks: the factory finds its own work.

### 6. The self-improvement pass

A weekly lap on the fork itself. It reads the dashboard's failure categories across all
projects and files issues against the fork for recurring causes, the way October's six
stop causes were found by hand.

The fork is enrolled like any project, with `loop/` held, because the loop is the judge.
See decision 1 for whether that hold can relax.

Unblocks: self-healing that does not depend on a person noticing.

### 7. The dashboard reads the new state

- `loop-state.json` across all enrolled projects
- the auditor and self-improvement counts

Unblocks: the owner can see the whole system on one page.

## Git rules every step follows

- One worktree and one branch per change, under `D:/projects/.worktrees/<repo>/<lane>`.
  Never `git switch` a shared checkout.
- Stage files by explicit path.
- Check `git remote -v` before any push.
- Fork pull requests always pass `--repo Cameron-Fulton/ai-software-factory`, because
  the `upstream` remote otherwise makes `gh` target Cole's repository. Never push,
  open pull requests or comment upstream.
- Never edit upstream-owned fork paths (`bin/`, `template/`, `docs/`, `README.md`).
  New fork code goes in `loop/`, and `AGENT-GUIDE.md`'s ownership table gains that row.
- Fathom pull requests that change only the harness or docs carry `[skip cd]`.
- Delete each merged worktree and its branch in the same session.
- Host checkouts are fast-forward only. Never hand-edit tracked files there: that stops
  self-update.

## Decisions for the owner

1. **May the factory change its own loop without a person?**
   - What hangs on it: step 6 can only file issues against the loop, and someone has
     to merge them.
   - Recommendation: yes. The tests must pass on the host, and a mechanical check
     refuses any change that removes or loosens a guard: the held list, scrutiny
     floors, the ownership checks, or the caps. Those can only grow without the owner.
     A loosening waits for the owner, as a single plain-language question.
   - If no answer comes: the factory builds loop fixes and leaves them as ready pull
     requests.

Nothing else here needs the owner. Spider joining the factory with unattended merges
was decided on 2026-10-17 ("Lets add it to the factory now").
