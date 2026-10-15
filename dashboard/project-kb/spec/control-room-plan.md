# Factory dashboard expansion plan

Written 2026-10-14 for Cam's request covering metrics analysis, upstream sync, a control panel, a live tracker, agent avatars, a 3D board and scoring.
The avatar spec it builds on is [agent-avatar-system.md](agent-avatar-system.md).

## Summary

The dashboard already records most of what the metrics goals need.
The work is to keep a few fields the collector throws away, add per-model and per-combination views, and test the hypotheses on real data.

The build runs in seven phases.
Phases 0 and 1 are independent; phase 1 only gains the effort field from phase 0.
Each later phase uses the one before it:

- Phase 0: upstream sync for the factory repo.
- Phase 1: metrics. Close the data gaps and answer the model questions.
- Phase 2: live feed and agent-speed progress tracker.
- Phase 3: control panel. File issues, factory controls, chat.
- Phase 4: agent identity and avatars.
- Phase 5: 3D board.
- Phase 6: scoring and levels.

Phases 0 to 2 can start now on the recommended defaults.
Phases 3 to 6 each wait on one decision listed at the end.

## What exists today

`src/factory_dashboard/collect.py` runs every 15 minutes on the factory host.
It reads Archon's `archon.db`, each project's `.factory/milestone-loop.json` and the account pool, and writes `data.json`.

Per step it keeps the model, input, output, cache read and cache write tokens, turns, seconds and an estimated cost.
Per run it keeps the workflow, status, linked issue and the review verdict.
Per task it keeps status, review count, whether the first review said ready, repairs, failures, cost, start and finish.

The web app (`web/`) aggregates in the browser.
It already shows cost by model, first-try review rate, rework per task, failure causes and an efficiency score.
It does not split first-try rate or rework by model, and it has no notion of a model combination.

## Findings that change the plan

**The upstream is public and needs no access grant.**
The fork's history and README name it: `coleam00/ai-software-factory` (Cole Medin).
The Cam task "identify the upstream and grant access" is done.

**There are two upstreams.**
The factory repo pins an Archon revision in `template/factory/pack.json`.
Syncing the factory repo moves that pin, so it also moves the engine.

**The fork merges upstream through a daily sync job (since 2026-10-15).**
`.github/workflows/upstream-sync.yml` checks upstream every day at 06:17 UTC. Its first merge, PR #6, was started by hand.
To see the current gap, run `git rev-list --left-right --count upstream/main...origin/main` (behind, then ahead).
Fork commits touch only fork-owned paths: `dashboard/`, `memory/`, `.knowledge/`, `.github/`, `TODO.md` and the root agent files.
A conflict or failed test leaves the sync PR open with a label, and no new sync starts until it is settled.

**Upstream changed how the factory is scheduled.**
Upstream PR #16 (2026-10-07) moved scheduling into Archon triggers and retired `.factory/loop.sh` and `factory-timer.service.example`.
Syncing the repo is safe, but rolling the new version out to JournalX and fathom changes how laps start.
An agent does that rollout and watches it (Cam, 2026-10-14).

**The dashboard reads a file neither repo writes.**
`milestone-loop.json` appears in neither the fork nor upstream.
Each project's own `factory_loop.py` writes it (see the host facts below), so the upstream scheduling change does not touch it as long as those loops keep running.

**Host facts, checked read-only on 2026-10-14.**

- Recorded per step today: model (`model_usage.requested` and `.resolved`, both model names, not tiers), tokens, turns, duration, cost and structured output. `tier`, `effort`, `attempt` and `failure_kind` are absent from all 6,222 `node_completed` events: the projects' Archon pin predates them.
- Node names: 54 distinct ones carry a model call, nested as `deliver__review__code`, `deliver__corrections.fix__implement` and so on. The collector's role map is keyed on the last `__` segment and was built from that list.
- Loop state: `/root/<project>/.factory/milestone-loop.json`, written by `factory_loop.py`. JournalX's service runs `/root/journalx/harness/factory_loop.py` (777 lines). fathom's runs `/root/factory-loop/factory_loop.py` (498 lines, identical to `/root/fathom/harness/factory_loop.py`). `/root/factory-loop-next` holds a staged loop and a `swap.sh`.
- Deploys: the fork has no GitHub workflow that deploys, and nothing on the host pulls it. The host's clone `/root/ai-software-factory` tracks the fork and sits at `e167ddc`, untouched since it was cloned. A merge to the fork's `main` changes nothing that runs.
- Tasks: 34 for JournalX (27 merged, 5 closed, 1 needs a person, 1 in progress) and 37 for fathom (20 merged, 16 closed, 1 needs a person).
- Cache: 95% of all input tokens (3.46 billion of 3.64 billion) are cache reads.
- Models: Sonnet 5 ran 1,331 steps, then Opus 5.5 took over (777). Fable 5.1 never ran. Haiku 5.5 ran once, in a smoke test. Archon's tier settings map small to Haiku 5.5 and medium and large to Opus 5.5.
- Milestones: JournalX uses GitHub milestones (M1 to M7). fathom has none; its factory work is chosen by the `milestone-2` label.
- `node_started` times add nothing beyond `duration_ms`: a step's start plus its duration equals its completion to within a second. Waiting time is the gap between steps and runs, not inside them.

**Effort level reaches a project only after `factory.py init` reruns there.**
From Archon revision `5674fd42` (the repo's pin after PR #6; upstream has since moved to `02c96342`), `node_completed` events can record `tier`, `effort`, `attempt` and `failure_kind` (`packages/workflows/src/node-record-serialization.ts`). `failure_kind` appears only on failed steps, and `tier` and `effort` only when the step has them set.
The repo's pin follows upstream with each sync (see `template/factory/pack.json`). The projects still run `24796870` from their last `init` (host `consumer.json`, checked 2026-10-14). That revision predates the file, so their events carry no effort (see the host facts above).
Archon also records `model_usage.requested` (the tier); the collector reads only `model_usage.resolved`.

**The collector drops the step name.**
It selects `step_name` and then discards it.
Without it the dashboard cannot tell which model built and which model reviewed, so "Opus with Haiku" cannot be measured.

**Agents are workflow steps, not persistent workers.**
Archon runs nodes such as triage, plan, implement, review and verify.
No agent carries memory or skills from one task to the next.
Names, avatars and levels need a stable identity to attach to; the plan proposes one in phase 4.

**The price gap depends on how much input is cached.**
From `prices.py` (checked against Anthropic's current table), Fable 5.1 costs 10 times Haiku 4.5 for fresh input and output, but only 2.5 times for cache reads ($0.25 against $0.10).
Against Haiku 5.5 the gaps are 100 times and 25 times.
If most factory input is cache reads, Haiku can cost more per finished task than Fable with far fewer redos than the fresh-token prices suggest.
The cache hit share decides this, so it is measured first.
Haiku's other costs, time, stuck tasks and tasks that end with a person, are reported alongside.

**Dollars are not the binding cost.**
The factory runs on subscriptions, and the dashboard already treats dollars as estimates.
The limit that actually stops work is logins running out of usage.
The account-pool file records only when a login is blocked and when it was last used, not how much of its window is spent.
So usage per task cannot be measured directly; the closest proxy is tokens per login between one reset and the next block.

**Model comparisons are confounded by task size.**
If Fable gets the hard issues and Haiku the easy ones, raw rates mislead.
Observational data can hint at answers; a fair comparison needs controlled runs on the same kind of task (phase 1, experiments).

**Two projects do not make a polygon.**
The board rule "one side per project" breaks below three projects, and the factory has two.

## Phase 0: upstream sync

Repo: `ai-software-factory` (the upstream-synced part: everything outside `dashboard/`).

**Mechanism.** A scheduled GitHub Actions workflow in the fork, daily and on demand:

1. Fetch `upstream/main`. Stop if there is nothing new.
2. Merge it into a new branch `sync/upstream-<date>` with a merge commit. Never rebase or force-push `main`.
3. Run the repo's own tests: `bin/test_consumer.py`, `bin/test_runtime_host.py`, `bin/test_runtime_resource.py`, `bin/_test_install.py` and the other `bin/test-*.py` files.
4. Open a pull request that lists the upstream commits and the Archon pin change.
5. Clean merge and green tests: the job merges its own PR. A conflict or a failed test leaves the PR open with a label (`upstream-sync-conflict`, `upstream-sync-tests-failed`).

The tests need only Python 3.12: all seven pass in a clean Linux container after merging upstream (2026-10-14).
The job sets `merge=ours` for fork-owned paths in `.git/info/attributes` with `git config merge.ours.driver true`, so upstream's `.gitattributes` stays untouched.
Built as `.github/workflows/upstream-sync.yml`: daily at 06:17 UTC and on demand.

**A push to the fork's `main` deploys nothing** (checked 2026-10-14, see the host facts above), so merging a sync PR changes no running project.

**Conflict policy.**

| Path | Owner | On conflict |
| --- | --- | --- |
| `dashboard/`, `memory/`, `.knowledge/`, `.github/`, `TODO.md`, root `CLAUDE.md`, `AGENTS.md`, `AGENT-GUIDE.md`, `CONTEXT.md` | Fork | Fork wins automatically (`merge=ours`, written to `.git/info/attributes` by the sync job) |
| `template/`, `bin/`, `README.md`, `pack.json` | Upstream | Upstream wins unless the fork changed the same lines |
| Same lines changed on both sides | Both | PR stays open, labeled, with the conflicting files listed; an agent resolves it |

Keep local changes out of upstream-owned files where possible.

**Upstream is read-only.** `coleam00/ai-software-factory` and `coleam00/Archon` are not ours.
Nothing is ever pushed, opened as a pull request, filed as an issue or commented on there.
The sync only fetches from them; every write goes to `Cameron-Fulton/ai-software-factory`.
Each syncing clone, and the Actions job, must add `upstream` with its push URL disabled (`git remote set-url --push upstream DISABLED`); the commands are in the root `AGENT-GUIDE.md`.

**Rollout to projects.** Syncing the repo changes nothing on running projects.
Each project upgrades when `factory.py init` reruns in it.
That step stays manual; an agent runs it for the scheduling change and watches the next laps.

**Done when** the fork is level with upstream, the workflow has opened at least one sync PR on its own, and the projects run the new pin with the dashboard still reading loop state.
The rollout to projects is the part with real risk; it can finish after phase 1 starts.

## Phase 1: metrics and model analysis

Repo: `ai-software-factory`, folder `dashboard/`.

**Collector changes** (`collect.py`, `data.json` version 3):

- Keep `step` (node name) and `role`, mapped from the node name to builder, reviewer, planner, verifier, merger or triage.
- Keep `tier`, `effort`, `attempt` and `failure_kind` when Archon records them.
- Keep `node_started` events, so time waiting is separable from time working.
- Snapshot the Archon tier configuration on each collection, so a later tier change does not rewrite history.
- Record the usage-window state per login over time, not only the current state.
- Keep the no-free-text rule: new fields are names, enums and numbers only, and `tests/test_collect.py` asserts it for each new field.
- First list the real node names in `archon.db`. Names such as `deliver__pr__pr` are nested, so the role map is built from data, not guessed.

**Derived metrics** (`factory-data.ts`):

| Metric | Definition |
| --- | --- |
| Combination | Builder model and effort plus reviewer model, such as builder Opus 5.5 high with reviewer Haiku 4.5. Other roles are shown per role, not folded in, or every task becomes its own combination |
| First-try success rate | Share of reviewed tasks whose first review said ready with no repair pass |
| Redo count | Repairs plus failed attempts plus review rounds after the first |
| Cost of failure | Estimated cost of repair passes, failed attempts and review rounds after the first, per task. A review that says not ready is a failure even though its run completed |
| Cost per completed task | Estimated cost of every run on a merged task, failed and redone runs included |
| Cache hit share | Cache read tokens divided by all input tokens |
| Speed | Hours from pickup to merge, and working hours excluding waits |

All of these are sliced by model, by role and model, and by combination.
Every rate carries a confidence range, and groups too small to separate from the others are never named as winners.

**New view: Compare.**
One table of combinations with first-try rate, redo count, cost per completed task, hours per task and cache hit share.
The cheapest and fastest combination with enough tasks are named in a sentence above the table.

**Experiments.**
A way to run the same issue under two configurations and compare them fairly.
Archon accepts a per-run model rebinding (`--model`, at upstream's pin), so each arm runs with its own models without changing the global tier settings.
The second arm runs in preview: no PR published, nothing merged, then judged by the same review step.
One arm should be the stronger model at lower effort; on current models that often matches a cheaper model at high effort, and a single model keeps one prompt cache, which mixed combinations give up.

Sample size is the hard limit.
Telling a 20-point gap in first-try rate apart needs roughly 50 paired issues.
At one pair per project per week that is about six months; decision 2 sets three, about two months.
The dashboard groups by experiment and reports the difference with a confidence range.

**Done when** each hypothesis below has a measured answer or a stated reason it cannot be answered yet.

## Phase 2: live feed and progress tracker

Fifteen-minute collection is too slow for a tracker built for agent-speed work.

**Live feed.** A second collector mode runs as a long-lived service and writes `live.json` every 5 seconds.
The browser polls it every 5 seconds.
Server-sent events can replace polling later; polling keeps the existing rule that the web server never reads `/root`.

Today's collector copies the whole engine database each pass, because a read-only open can need to create a file in the engine's folder.
That copy is too heavy every 5 seconds.
The live mode first tries Archon's own status output (`consumer.py status --all --json`), then a read-only open of new event rows, and keeps the full copy for the 15-minute pass.

**Tracker view.**

| Column | Source |
| --- | --- |
| Queued | Open issues in enrolled repos with none of the factory's state labels (the same rule lifecycle intake uses) |
| In progress | Tasks with a running Archon run, showing the current node, its role and model, and time in that node |
| In review | Tasks whose current run is a review |
| Redo | Tasks in a repair pass, with the redo count |
| Needs a person | Tasks the loop marked blocked, with the fixed failure category |
| Done | Tasks merged in the last 24 hours |

Time to completion comes from the median remaining-stage durations of past tasks in the same project; the combination is not known until the task ends.
It is shown as a range in minutes, and hidden when there are too few past tasks.

The queued column needs the open issue list.
The collector reads it with a read-only, fine-grained GitHub token scoped to the enrolled repos, never the factory's own token.

**Done when** a node starting on the host shows in the tracker within 10 seconds.

## Phase 3: control panel

Today the dashboard cannot change anything.
Every control added here is a new write path into the factory, so each one is narrow and logged.

**Write service.** The actions need the factory's root-owned credentials, and the web side must never hold them.
So the web-facing service runs unprivileged and only writes a request file into a spool folder.
A root-side worker reads the spool, checks each request against the allowlist below, runs it and writes the result back.
The allowed actions:

| Action | What it runs | Risk |
| --- | --- | --- |
| File an issue | Creates a GitHub issue in an enrolled repo | Low: the factory still triages it |
| Pause new laps | `consumer.py halt` | Low |
| Resume laps | `consumer.py unhalt` | Low |
| Cancel a run | `consumer.py cancel <run>` | Medium |
| Approve a held merge | `consumer.py approve <run>` | High: merges code |

Each action is a fixed command with validated arguments, never a shell string.
Every action is written to an audit log with time and result.
Actions need a confirm step, and requests carry a CSRF token on top of the proxy's password.
A shared basic-auth password is too weak for approving merges; that action needs a second factor or a network allowlist before it is enabled.
Issue creation uses an issues-only token for the enrolled repos.

**Chat.** Two stages:

1. Ask the factory: questions answered from `data.json` and `live.json` only. No run text, which keeps the no-free-text rule.
2. Tell the factory: chat proposes one of the actions above and Cam confirms it. Chat never gets a shell.

Chat runs on the Claude API, which is billed per token, unlike the factory's subscription logins.
Issue titles in the data are free text anyone with issue access can write, so chat treats them as data, and stage 2 never runs an action without Cam's confirmation.

**Done when** Cam can file an issue and pause the factory from the dashboard, and both show in the audit log.

## Phase 4: agent identity and avatars

**Identity.** An agent is a role on a team, and a team is a project:
JournalX's builder, JournalX's reviewer, fathom's builder and so on.
That gives stable names that persist across tasks, and stats that mean something, because the same role on the same project does comparable work.
Whichever model fills the role that day is shown as the agent's current gear, not as a different agent.

The original idea has agents level up by gaining skills and saving memories.
Nothing in the factory does that: the agents' prompts live in Archon's shared workflows, and the factory's rules forbid local copies of them.
So in this plan a level reflects an agent's track record, not new abilities.
Making levels change behavior would mean per-role memory fed into the workflows, which is decision 6.

**Avatars.** Follow [agent-avatar-system.md](agent-avatar-system.md), with these changes:

- Day one: DiceBear pixel-art avatars seeded by agent ID, in the tracker and roster. No accounts needed.
- Live states come from the phase 2 feed, mapped as the spec's table describes. The audit answered the spec's open question: Archon's `node_started`, `node_completed` and `node_failed` events are the event source, so the Pixel Agents transcript fallback is not needed.
- Run the spec's first test (3 agents, 3 tiers) with PixelLab once decision 3 is made.
- Skip Meshy at first. Show the pixel sprites on the 3D board as upright billboards. One art pipeline keeps one style, and the spec's hardest pass criterion (3D figure matches the 2D avatar) disappears. Add Meshy figures only if billboards look wrong on the board.

**Done when** every agent in the tracker has a name and an avatar that changes with its live state.

## Phase 5: 3D board

**Stack.** three.js through React Three Fiber and drei, inside the existing Next.js app on its own view.
It loads client-side only, so the static export still works.

**Board shape.**

| Projects | Board |
| --- | --- |
| 1 | Square, all four sides one project |
| 2 | Square, two adjacent sides per project |
| 3 or more | Regular polygon, one side per project |

**Squares.** One square per milestone.
The factory works from issues, so a milestone is a GitHub milestone where the repo has them, and otherwise one square per issue in backlog order.
Which one applies is checked on the host before building.

**Live play.** Agents stand on the square of the task they are working on, using the phase 2 feed and phase 4 states.
A redo shows on the same square as a failure flash and a redo count, since a square is a milestone or issue, not a stage; a merge advances the agent.
The board rotates slowly and turns to face the square with the newest event.

**Center canvas.** The output of the selected task shows in the center, facing the viewer.
A design or running app is embedded as a live, clickable page with drei's `Html` transform (three.js `CSS3DRenderer`), so it can be zoomed and used.
Code output shows as the pull request's diff.
Embedding needs the project's deployed preview URL and a site that allows framing; tasks without one fall back to the diff.

**Fallback.** A flat 2D board for small screens and reduced-motion settings.

**Done when** the board shows both projects live and the center canvas opens a merged task's output.

## Phase 6: scoring and levels

Waits on decision 4.

**What earns points.** Proposed, for Cam to change:

- Merged task: points scaled by issue size, measured by the plan's size or files changed, never by tokens, which would reward waste.
- First-try pass: bonus for the builder.
- Redo: deduction for the builder.
- Reviewer: points for findings that a repair then fixed, and a deduction when `archon-regress` later finds a bug in work it passed.

The last rule matters.
Scoring builders on first-try passes alone teaches nothing to the reviewer, and a lenient reviewer would inflate every builder's score.

**Levels.** Four tiers per the avatar spec, earned by points plus a minimum task count, so one lucky task cannot level an agent.

**Points and money.** AI agents cannot receive money, so the question is who would.
Two options:

- Points become factory budget: an agent with a strong record gets a higher model tier or more repair attempts. This ties scoring to the cost goal and needs no legal work. Experiment runs are exempt, or better agents getting better models would skew the model comparison.
- Points become cash for people, such as staff who file or review factory work. That is a compensation plan, with payroll tax treatment, and needs an accountant before it ships.

Recommendation: budget, not cash.

## Data model

**Per task** (one row per issue the factory picked up): project, issue, title, status, combination, effort per role, review outcomes in order, redo count, tokens by type, cache hit share, working time, waiting time, estimated cost, usage share, experiment label.

**Per step** (one row per model call inside a run): time, run, project, node name, role, tier, model, effort, attempt, tokens by type, turns, seconds, estimated cost, outcome, failure kind.

**Derived, by model, role and model, and combination:** first-try success rate, redo count per task, cost per failure, cost per completed task, hours per task, cache hit share, sample size.

**Per agent** (phase 4 on): agent ID, team, role, name, avatar fields from the avatar spec, points, tier.

## Hypotheses and how each is tested

| Claim | Test | When |
| --- | --- | --- |
| Fable rarely fails review, so it gets more done first try | First-try rate for builder Fable against other builders, same project | Phase 1, observational; experiment to confirm |
| Most factory requests are cached | Cache hit share across all steps | Phase 1, first day; the data already exists |
| Haiku fails so often it costs more per task than Fable | Cost per completed task by builder model; price gaps above make this unlikely in dollars, so time and stuck tasks are reported too | Phase 1 |
| Opus with Haiku is faster than Fable | Hours per merged task by combination | Phase 1, observational; experiment to confirm |
| Project tools are built for human pacing | Median minutes per stage from the tracker data; a reference point, not a test | Phase 2 |

## Decisions made (Cam, 2026-10-14)

1. **Upstream sync:** clean, green sync PRs merge themselves.
2. **Experiment pace:** three issues per project per week run twice.
3. **Avatar art and accounts:** pixel art. PixelLab is approved with a starting cap of $25 a month, set by the agent because Cam had no figure; raise or lower it from real use. Third-party reviews put PixelLab's middle plan at $24 a month (unverified; its pricing page did not load). Signing up needs Cam's payment details, so it is raised with him when phase 4 starts.
4. **Points:** become factory budget, not cash.
5. **Control panel powers:** every phase 3 action except approve-merge.
6. **Levels:** track record only, for now.
7. **Oversight:** Cam is not a developer and does not watch host changes or rollouts. Agents make them, watch the result and roll back what misbehaves.

## Hypothesis answers so far (2026-10-14)

From the host's records: 47 merged tasks with both a builder and a reviewer step.

| Claim | Answer |
| --- | --- |
| Fable rarely fails review | Cannot be answered: Fable has never run in the factory. Needs experiment runs. |
| Most factory requests are cached | Yes. 95% of input tokens are cache reads, 72% to 98% by role and model. |
| Haiku fails so often it costs more per task than Fable | Cannot be answered: neither model has built a task. |
| Opus with Haiku is faster than Fable | Cannot be answered: no task has used either pairing. |
| Sonnet 5 against Opus 5.5 (the pair that did run) | Not separable yet. First-try review: Sonnet 5 28% (8 of 29, range 15% to 46%), Opus 5.5 13% (2 of 16, range 3% to 36%). Cost per completed task: $29.73 against $27.04, with overlapping ranges. The two ran in different weeks, so time confounds the comparison too. |
| Project tools are built for human pacing | Phase 2. |

The Compare view shows these numbers live and names a combination only when its range clears every other group's.

**Off-the-shelf observability tools (Langfuse, Helicone, Arize Phoenix) were checked and not adopted.**
Each collects traces at call time through an SDK, a proxy or OpenTelemetry, which means instrumenting Archon, upstream code we do not edit.
They store full prompts and replies, which breaks the no-free-text rule.
None of them knows tasks, review verdicts or repairs, the joins the comparison needs.

## Risks

- **New write paths.** Phase 3 makes the dashboard able to change the factory. Mitigation: fixed action list, separate service, audit log, narrow tokens.
- **Loop state source.** Rolling out upstream's scheduling change could stop whatever writes `milestone-loop.json`. Mitigation: confirm the writer on the host first.
- **Small samples.** Two projects produce few tasks per week. Rates carry confidence ranges and overlapping groups are never named as winners.
- **Accidental deploy.** Checked: a merge to the fork's `main` deploys nothing. Re-check if a deploy workflow or a host pull is ever added.
- **Price table drift.** Cost estimates go stale when prices change. `prices.py` stays the single source, and unknown models fall back to Archon's own cost figure.
- **Board effort.** Phase 5 is the largest piece and the least tied to the cost goal, so it comes after the phases that answer the model questions.

## Original task list mapped to phases

| Task | Status |
| --- | --- |
| Identify the upstream repo and grant access | Done: `coleam00/ai-software-factory`, public |
| Audit what the factory logs and list gaps | Done: findings above |
| Spec the metrics data model | Done: data model above; built in phase 1 |
| Spec and build upstream sync | Specced: phase 0 |
| Spec the dashboard | Specced: phases 1 to 3 |
| Research observability tools; build, buy or integrate | Before the phase 1 build, timeboxed to a day. Current lean: keep building, because the core unit here is an issue through review and redo, which tracing tools model only as spans |
| Research 3D rendering and prototype the board | Specced: phase 5; prototype is its first step |
| Spec agent naming, avatars, leveling and scoring | Specced: phases 4 and 6 |
| Legal and tax of redeemable points | Needed only if decision 4 is cash |
| Decide whether points convert to money | Decision 4 |
