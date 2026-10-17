# One factory, running around the clock

Status: plan, not built. Written 2026-10-17 with the `converge` method
(`D:/projects/dev-system/skills/synced/*/converge/SKILL.md`): one objective, a
capability table with its gaps, the data model, the cut, a build order by dependency,
and the owner decisions. A cold `god-developer` audit on the same day found six blocking
errors in the first draft; this version corrects them. It lives beside
`control-room-plan.md`, the other factory-wide plan, because the fork has no other
fork-owned home for plans.

## The objective

Every enrolled project's open issues get built, reviewed and merged with no person in
the loop, day and night. The factory finds its own new work and repairs itself. The
owner is asked only for decisions that are really theirs.

Owner's words, 2026-10-16: "I need the AI Factory continually building,
monitoring/auditing and adding issues/tasks that are then automatically completed and
the cycle of self-improvement and optimization and self-healing continues 24/7", done
"system wide so the other projects using AI Factory get the update from OUR fork."
On 2026-10-17 the owner added SearchActions/fathom-spider to the factory, so that
fathom #614 gets built.

## What exists today

Four separate things do parts of this.

- **The JournalX loop**: `journalx/harness/factory_loop.py`, 1,038 lines. It runs from
  the project checkout and updates itself from JournalX `main`. It takes issues
  labelled `factory`, and the backlog sync applies that label once an issue's
  dependencies close.
- **The Fathom loop**: `fathom/harness/factory_loop.py` plus `scrutiny.py`. The service
  runs a hand-installed copy in `/root/factory-loop/`, so nothing updates it by itself.
  Since 2026-10-17 it takes every open issue filed by someone with push access, lowest
  milestone first.
- **Upstream `archon-loop` and `archon-manager`**, at the fork's default pin `5fa0a816`
  (upstream branch `factory/sdlc-on-dev`). They are not installed anywhere.
- **The dashboard** (`dashboard/`). It reads both loops' `milestone-loop.json` and
  the engine database.

The engines the loops call are our own Archon fork, `Cameron-Fulton/Archon`:

- JournalX runs `e2799053`. That is our login-rotation patch on branch
  `base/sdlc-24796870`.
- Fathom runs `31d0021`, our required-checks-only fix on top of that rotation patch.

Both projects' committed `factory/pack.json` still says `24796870`.

The two loops started as one file and have been patched separately ever since. Every
fix made in 2026-10 had to be written twice, and Fathom was a week behind until
fathom PR 708.

### Capability table

One row per step of the cycle. **Gap** means nothing does it.

| Step | JournalX loop | Fathom loop | archon-loop / manager @5fa0a816 |
|---|---|---|---|
| Take every open issue, keep up with new ones | label + backlog sync | yes (2026-10-17) | yes, skips `needs-owner` |
| Respect `Depends on` | backlog sync, JX ids only | triage BLOCKED waits | yes, same repository |
| Several laps at once | no | no | yes (claims) |
| Build, review, merge with main, repair | yes, 3 laps | yes, 3 laps | yes, 3 attempts |
| Hand open review threads to the repair | yes | yes | reads comments, resolves none |
| Read the merge queue's real hold reason | yes (journalx PR 209) | yes (fathom PR 762) | n/a |
| Re-run checks the engine blamed on the environment | yes | yes | **gap**: the attention wait is never woken |
| Act on triage's decline (close, amend, decide, wait) | yes | yes | partly |
| Recover a run cut off by a restart | yes | yes | claim expiry after 6 hours |
| Take a stopped task up again by itself | yes, twice | yes, twice | partly (manager) |
| Agent scrutiny of database, CI and Worker changes | n/a | yes | **gap** |
| Hold files that can reach the signing key | yes, mechanical | n/a | prompt only |
| Test-count-only workflow edits merge | yes | n/a | **refused**: counts drift low |
| Rotate across the six subscription logins | yes (our engine patch) | yes (our engine patch) | **gap**: our patch is not on that branch |
| Audit the project and file new issues | **gap** | **gap** | manager: holdout failures, red main, repeated fixes, at most 5 a pass |
| Improve the factory itself from its own failures | **gap** | **gap** | **gap** |
| Ship a loop fix to every project from one place | **gap** (per project) | **gap** (hand copy) | the pin, but nothing advances it on the host |
| Enroll a new project | `init` by hand | `init` by hand | `init` by hand |
| Work an issue that needs two repositories | **gap** | **gap** | **gap** |
| Tell the owner | Slack | Slack | a GitHub issue |

Sources: the gap analysis and the plan audit of 2026-10-17 (session `62d0779b`), which
cite every row to file and line. Two findings carry the decision below:

1. **Login rotation is ours, not upstream's.** It is the patch `e2799053`
   ("Rotate Claude steps across a pool of subscription accounts (#4)") on
   `Cameron-Fulton/Archon`. It is not on any upstream branch, so no upstream pin will
   ever bring it. That rotation is how six subscriptions run the factory without paying
   for usage. A pin without it stalls the factory at the first usage limit.
2. **archon-loop has none of Fathom's scrutiny floors.** Those floors stop a schema
   change that drops data, a weakened CI workflow, and a faked required check. Fathom
   deploys on merge.

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
path, `loop/`. Every project runs that one copy. The fork's TODO line that said "move
both projects onto archon-loop" is replaced by this plan.

**Revisit when both of these are true:**

- our rotation patch is ported onto a `Cameron-Fulton/Archon` branch at a pin that has
  `archon-loop`
- Fathom's scrutiny floors exist as an `archon-loop` gate

The check is the capability table above, rerun against that branch. `TODO.md` keeps
that line.

**Why the fork and not a project.** This is the owner's "from our fork". It is also
the only repository whose job is the factory.

## The data model

The loop's state today is one `milestone-loop.json` per project. Each file maps an
issue number to a job with free-form keys that the two loops have grown differently.
One model replaces it.

### Project

What the loop needs to know about one enrolled repository. Its home is
`harness/loop.config.json` in that project. The loop reads it from `origin/main`,
never from the working tree. The file matches its own `held` patterns, so a task can
never loosen the rules it is judged by.

| Field | Meaning |
|---|---|
| `repo` | `owner/name` |
| `checkout` | host path, for example `/root/fathom` |
| `intake` | `"*"` for every open issue, or one label |
| `held` | path patterns that only the owner merges |
| `count_only` | workflow files where a raised test count may merge |
| `fact_sections` | headings in the instruction files that may change |
| `gated` | named surfaces, each with its own path patterns and reviewer lenses |
| `required_checks` | the CI job names that must pass, and their workflow file |

Gated surfaces are named per project with their own paths. Fathom's `data` paths
(Prisma and ClickHouse) mean nothing in Spider. Spider names its own: the importer and
every ClickHouse write path.

### Task

- **Identity:** `(repo, issue)`. An issue number alone collides across repositories.
- **Pull requests:** a task owns pull requests in its own repository only.
- **Cross-repository work:** one issue per repository, linked by
  `Depends on: owner/repo#n`. A parent issue lists its children as `(repo, issue)`
  references and closes when all of them close as completed.

Fields:

- `stage`: one of `ship`, `review`, `scrutiny`, `queue`, `repair`, `deliver`,
  `waiting`, `blocked`, `done`, `closed`
- counters: `repairs`, `failures`, `readmits`, `ci_reruns`, `waits`
- `run` and `lap`, for the run in flight
- `stop`, set only while blocked
- `children`, on a parent only

### Stop

| Field | Meaning |
|---|---|
| `kind` | `retryable` (ran out of laps or steps), `owner` (held file, an owner decision MISSION.md reserves), or `foreign` (a PR the factory does not own) |
| `reason` | plain-language text |

Only `retryable` stops are taken up again by themselves.

### Scenarios the model was tested against

| Situation | What the model does |
|---|---|
| An issue is reopened after it was done | A new task revision with the same identity. The old history is kept. |
| A repository is renamed or transferred | `repo` is read from `loop.config.json`. GitHub redirects the old URLs. The state file is converted once. |
| The loop restarts mid-lap | `lap` and `run` survive. The run is settled or abandoned and run again (existing behavior). |
| Two issues in different repositories share a number | Distinct, because identity includes `repo`. |
| A child issue is closed as not planned | The parent stays open and gets a `stop` of kind `owner`. |
| The dashboard asks what a task looked like yesterday | Not answerable today. The state file holds only the latest state. The engine database keeps run history. Point-in-time task history is out of the cut. |

### Where it lives

`.factory/loop-state.json` in each project, written atomically under the existing lock
file `.factory/milestone-loop.lock`, so old and new code exclude each other. The schema
lives once, in `loop/state.schema.json`. The loop and the dashboard collector both
validate against it, and a test fails when the two disagree.

## The cut for version one

**In:**

- one loop in `loop/`, with project policy in `harness/loop.config.json`
- scrutiny as an optional gate per named surface
- release folders and one updater for rollout
- one systemd template unit, `factory-loop@<project>.service`
- the auditor, with a circuit breaker
- the self-improvement pass
- Spider enrolled
- cross-repository dependencies and parent closing

**Out, and why:**

- **Parallel laps.** The six logins already run out between resets. More laps would
  only spend them faster.
- **Moving to archon-loop.** See the decision above.
- **A new notification channel.** Slack works today.
- **Changing the engine pin.** Nothing in this plan depends on it.
- **Point-in-time task history.** Run history is in the engine database. Nobody has
  asked for task history.

## Build order

Each step names what it unblocks. Each is its own `feat/` or `fix/` branch, in its own
worktree under `D:/projects/.worktrees/<repo>/<lane>`, merged through a pull request
after CodeRabbit's review.

### 0. Reconcile what is open first (operating rule 15)

- The shared fork checkout `D:/projects/ai-software-factory` sits on `feat/supervisor`,
  with untracked `bin/supervisor.py` (INC-2026-872), `CLAUDE.md`, `CONTEXT.md` and
  `lifecycle/`. `bin/` is upstream-owned, so the supervisor either moves into `loop/` in
  step 1 or is dropped. Then return that tree to `main`, following TODO.md.
- The host's fork clone `/root/ai-software-factory` is 59 commits behind. Set
  `git config pull.ff only` there and fast-forward it.

Unblocks: every later fork change starts from a clean `main`.

### 1. The shared loop and its protection in the fork

1. **Declare the new path.** Add a root `PROJECT-LAYOUT.json` home and an
   `AGENT-GUIDE.md` ownership row for `loop/`.
2. **Keep upstream out of the judge.** In `.github/workflows/upstream-sync.yml`:
   - add `loop/**` and `/PROJECT-LAYOUT.json` to the keep-our-side lists
   - refuse to merge the sync PR by itself when the upstream diff touches either
3. **Fork CI.** Add a fork CI workflow that runs the `loop/` tests on every pull
   request. A test forbids `loop/` from importing anything under `bin/` or `template/`.
4. **Merge the loops.** Combine the JournalX loop, the Fathom loop and `scrutiny.py`
   into `loop/`:
   - `factory_loop.py`
   - `scrutiny.py` and `scrutiny_prompts/`
   - `state.schema.json`
   - the union of both test suites, every test kept
5. **Move project rules into config.** Everything project-specific goes into
   `harness/loop.config.json`:
   - JournalX's held list and the count-only and fact-section exceptions
   - Fathom's gated surfaces, required checks and check provenance

   A test runs both configs through the old fixtures and must reproduce each loop's
   behavior exactly.

Unblocks: steps 2 to 7.

### 2. Install, cut over, and keep the dashboard reading

1. **One updater, release folders.** A single updater unit fetches fork `main` into the
   host clone and runs the `loop/` tests there. When they pass, it copies `loop/` into
   `/root/factory-loop/releases/<commit>` and swaps the symlink
   `/root/factory-loop/current` in one step. Each loop instance runs from `current` and
   re-executes between laps when the symlink target changes. No loop ever fetches, and
   no file changes under a running lap. That matters because scrutiny reads its prompts
   at call time.
2. **Leave Fathom's live copy alone.** `/root/factory-loop/factory_loop.py` stays
   untouched until Fathom is cut over.
3. **Template unit.** Add `factory-loop@.service` with `KillMode=control-group`, running
   `/root/factory-loop/current/factory_loop.py --project <name>`. Widen the
   `needrestart` exclusion to it.
4. **Dashboard first.** The collector reads `loop-state.json` and the old
   `milestone-loop.json` side by side, so the page never goes stale.
5. **Cut over JournalX first, then Fathom after one clean JournalX day.** For each
   project:
   1. touch `.factory/STOP`
   2. wait until no `consumer.py` child is running
   3. `systemctl disable --now` the old unit
   4. convert `milestone-loop.json` into `loop-state.json` and keep the original file
   5. remove `STOP`
   6. `systemctl enable --now factory-loop@<project>`
   7. watch one full lap

   Rollback is the reverse: disable the new unit and enable the old one. The old code
   and the original state file stay in place until that lap passes.
6. **Project checkouts keep advancing.** The shared loop keeps JournalX's fast-forward
   of each project checkout between laps (today's `self_update`, pointed at the project
   rather than the loop).
7. **Retire the old loops.** After both cutovers, delete `harness/factory_loop.py`
   from both projects, each through its own pull request (Rule 23). Update
   `fathom/CLAUDE.md` line 158 and `fathom/docs/runbooks/factory-loop.md`, and
   `journalx/CLAUDE.md`'s factory section, in the same pull requests.

Unblocks: one code path for every later change.

### 3. Rollout order for every later loop change

The updater installs a new release for JournalX first. Fathom moves to it only after
JournalX has run one full lap on it. That is a per-project `release` pointer, advanced
by the updater.

Unblocks: "the other projects get the update from our fork", with nobody copying files
and Fathom never first.

### 4. Enroll Spider

1. Clone `SearchActions/fathom-spider` to `/root/fathom-spider`.
2. Run `init` from a fork tree at commit `e167ddc`, whose `pack.json` still pins
   `24796870`, with:
   - `--source https://github.com/Cameron-Fulton/Archon`
   - `--revision 31d0021eb6a54cd8b2253dc77b296c557dfabe3b`

   The current fork template names `archon-loop` and `archon-manager`, which do not
   exist at `31d0021`, so `doctor` would fail. This needs the full SHA and our source,
   which is the one with rotation.
3. Write `MISSION.md`, and set the harness config's `required_checks` to all three jobs
   in `ci.yml`.
4. Write `harness/loop.config.json`. Spider's gated surface is the importer and every
   ClickHouse write path, with the security and data lenses.
5. Start `factory-loop@fathom-spider`. Add Spider to the collector.

Unblocks: every future Spider issue.

### 5. Cross-repository work, then fathom #614

1. Build `Depends on: owner/repo#n` into intake: a task waits until every named issue
   is closed as completed.
2. Build the parent rule: a parent closes when its children all close as completed.
   It gets an `owner` stop if any child closes as not planned.
3. Read `packages/crawler/src/bin/sync-crawl-to-fathom.ts` and the Fathom side. The
   importer writes to ClickHouse directly. From that, write the split:
   - a Fathom issue for the authoritative site-identity lookup the importer will call
   - a Spider issue for the importer check, depending on it

   Both carry #614's acceptance checks.
4. **#614 is an access boundary in an app that deploys on merge.** Its own release
   condition asks for independent review of that boundary. Fathom's gated surfaces get
   an `access` surface with the security lens, and the Fathom child goes through it.
5. #614 stays `archon-blocked` as the parent and is never taken itself. The parent rule
   closes it.

Unblocks: #614, and the pattern for any later two-repository issue.

### 6. The auditor

A daily lap per project, run as a scheduled step of the same loop, so it shares the
login rotation. It reads:

- the project
- its incident and landmine notes
- the dashboard's failure categories for that project

It files at most 5 new issues per day per project, authored by the loop's own account
so intake trusts them. Each carries the project's intake label (JournalX: `factory`)
plus `factory-found`, and has acceptance checks. Before filing, it searches open and
recently closed issues and does not file a duplicate.

**Circuit breaker:** it files nothing while more than 10 `factory-found` issues are
open in that project, or while more than a third of the last 10 it filed ended
blocked.

Unblocks: the factory finds its own work.

### 7. The self-improvement pass

A weekly lap on the fork. It reads the dashboard's failure categories across all
projects and files issues against the fork for recurring causes, the way October's
stop causes were found by hand.

To build those issues, the fork is worked from its own host checkout,
`/root/factory-self`. It has the factory files installed and excluded through
`.git/info/exclude`, not `init`, because `init` appends to the upstream-owned
`.gitignore`. It must never be the clone the updater reads from. `loop/` is held there
(see decision 1).

Unblocks: self-healing that does not depend on a person noticing.

## Git rules every step follows

- One worktree and one `feat/` or `fix/` branch per change, under
  `D:/projects/.worktrees/<repo>/<lane>`. Never `git switch` a shared checkout.
- Stage files by explicit path.
- Check `git remote -v` before any push.
- Every `gh` call on the fork passes `--repo Cameron-Fulton/ai-software-factory`, and
  `gh pr create` also passes `--base main`. The `upstream` remote otherwise makes `gh`
  target Cole's repository. Never push, open pull requests or comment upstream.
- Wait for CodeRabbit's review on fork pull requests and settle any blocking finding
  before merging.
- Never edit upstream-owned fork paths: `bin/`, `template/`, `docs/`, `README.md`,
  `.gitignore`, `.gitattributes`.
- Fathom: `[skip cd]` only on a docs-only pull request (`fathom/CLAUDE.md` line 121).
- Delete each merged worktree and its branch in the same session.
- Host clones are fast-forward only (`pull.ff only`). Never hand-edit tracked files
  there.

## Decisions for the owner

1. **May the factory change its own loop without a person?**
   - What hangs on it: step 7 files issues against the loop, and someone has to merge
     them.
   - Recommendation: yes, for everything except the guard module. The guard module is
     the held list, the scrutiny floors, the ownership checks and the caps. It stays
     held, along with its own tests, because no script can fully decide whether a
     change loosens a guard.
   - Updates roll out to JournalX before Fathom (step 3).
   - If no answer comes: the same. The guard module stays held, and its changes wait
     as ready pull requests.

Nothing else here needs the owner. Spider joining the factory with unattended merges
was decided on 2026-10-17 ("Lets add it to the factory now").
