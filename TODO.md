# ai-software-factory - TODO

## Machine-generated findings (triage; not queued)

- INC-2026-872 (SEV:2): Knowledge entry K-1119: supervisor queues the first open PR matching a head branch name for approve-mode merge - root cause: bin/supervisor.py:220 (local branch feat/supervisor, unpushed) lists open PRs by head branch name and launches archon-merge-queue with mode=approve on prs[0], so a fork or collaborator PR on a same-named branch would .... Ref: `_system/incidents/INCIDENT-LOG.md`. [auto-skip]

## Backlog

- [ ] One shared factory loop. JournalX and fathom each carry their own `harness/factory_loop.py`, so last night's self-recovery fix (journalx #178, #180) never reached fathom. On the host, JournalX's service runs its 777-line `harness/factory_loop.py`; fathom's runs `/root/factory-loop/factory_loop.py` (498 lines, identical to fathom's harness copy); `/root/factory-loop-next` holds a staged loop and `swap.sh`. Diff the host copies against the repo copies first. Move the loop into this repo, run one copy per enrolled project via `FACTORY_APP_ROOT`, and remove the project copies. An agent does the rollout and watches the next laps; Cam does not watch (2026-10-14). Origin: Cam, 2026-10-14 chat.
- [ ] Upstream sync PRs that stop on a conflict or a red test notify nobody; an agent has to look for the `upstream-sync-conflict` and `upstream-sync-tests-failed` labels. Origin: phase 0 build, 2026-10-14.
- [ ] If upstream ever adds `.github/workflows/`, the sync job's push is refused (its token lacks the workflows permission) and the sync stops. Origin: phase 0 build, 2026-10-14.
- [ ] Upstream sync `merge=ours` only protects fork-owned files both sides changed; an upstream add or delete under `dashboard/` or `memory/` would pass through, and a conflict resolved in GitHub's web editor loses the protection. Origin: god-infra review of PR #4, 2026-10-14.
- [ ] Collector `failureKind` is checked only for shape; copy Archon's fixed list (`nodeFailureKindSchema` in `packages/workflows/src/schemas/node-execution.ts`) so the guard does not depend on the engine. Origin: god-security review of PR #4, 2026-10-14.
- [ ] Dashboard expansion, phases 2 to 6 (phases 0 and 1 built 2026-10-14): `dashboard/project-kb/spec/control-room-plan.md`. Origin: Cam's planning session, 2026-10-14.
- [ ] Uncommitted work in the shared checkout `D:/projects/ai-software-factory` (branch `feat/supervisor`): `bin/supervisor.py`, `bin/test_supervisor.py`, `CLAUDE.md`, `CONTEXT.md`, `lifecycle/`. Land it or drop it; supervisor.py carries INC-2026-872. Move the untracked `CLAUDE.md` and `CONTEXT.md` aside before returning that tree to `main`: the committed root copies would block the fast-forward. Origin: found 2026-10-14 during the dashboard merge.

## Doc-drift audit — /end 2026-10-15 (god-developer review, do this FIRST next session)

- **Importance:** MEDIUM
  **Classification:** WRONG
  **Location:** `AGENT-GUIDE.md` > `## Deployment` > row "GitHub deploys"
  **Quote:** "None: the repo has no `.github` workflows, so a push to `main` deploys nothing from GitHub"
  **Evidence:** `.github/workflows/upstream-sync.yml` exists on `origin/main` (PR #4, merged 7e4fa33; fixed in PR #5). It merges upstream and opens and merges PRs, but deploys nothing.
  **Why it matters:** An agent reading "no workflows" may skip checking the sync job's labels, or may add a deploy workflow believing the repo has none.
  **Suggested resolution:** Reword the row: one workflow exists (`upstream-sync.yml`), and nothing deploys from GitHub.

- **Importance:** LOW
  **Classification:** DRIFT
  **Location:** `dashboard/project-kb/spec/control-room-plan.md` > `## Findings that change the plan` > "The fork is 23 commits behind and 11 ahead"
  **Quote:** "**The fork is 23 commits behind and 11 ahead, and merges clean (2026-10-14).**"
  **Evidence:** The first sync run merged upstream as PR #6 (2026-10-15). `git rev-list --left-right --count <coleam00 main>...origin/main` returned `0 20`.
  **Why it matters:** The plan reads as if the fork still lags upstream. Phase 0's "done when" condition, the fork level with upstream, is now met for the repository part.
  **Suggested resolution:** Mark the fork as level with upstream since 2026-10-15, kept level daily by the sync workflow.

- **Importance:** MEDIUM
  **Classification:** DRIFT
  **Location:** `dashboard/project-kb/spec/control-room-plan.md` > `## Findings that change the plan` > "Effort level probably arrives with the upstream sync."
  **Quote:** "The fork's pinned revision (`24796870`) predates that file, so its events may not carry effort; that is unverified."
  **Evidence:** After PR #6, `template/factory/pack.json` on `origin/main` pins `5674fd428432a0f4678887555f8e2fdc8a7d01fd`. The projects still run the old pin until `factory.py init` reruns there (host `consumer.json`, checked 2026-10-14).
  **Why it matters:** The fork no longer pins `24796870`, but the running projects do. An agent could wrongly conclude that effort fields are now recorded.
  **Suggested resolution:** State that the repo pin is now `5674fd42`, that projects get it only after `init` reruns, and that effort fields appear once that rollout happens.

- **Importance:** LOW
  **Classification:** DRIFT
  **Location:** `CONTEXT.md` > `## Sync PR`
  **Quote:** "Designed in phase 0 of the dashboard plan."
  **Evidence:** It is built and running: `.github/workflows/upstream-sync.yml`, first merge PR #6.
  **Why it matters:** This is minor, but it tells agents the feature does not exist yet.
  **Suggested resolution:** Replace the sentence with "Opened and merged daily by `.github/workflows/upstream-sync.yml`."
