# ai-software-factory - TODO

## Machine-generated findings (triage; not queued)

- INC-2026-872 (SEV:2): Knowledge entry K-1119: supervisor queues the first open PR matching a head branch name for approve-mode merge - root cause: bin/supervisor.py:220 (local branch feat/supervisor, unpushed) lists open PRs by head branch name and launches archon-merge-queue with mode=approve on prs[0], so a fork or collaborator PR on a same-named branch would .... Ref: `_system/incidents/INCIDENT-LOG.md`. [auto-skip]

## Backlog

- [ ] One shared factory loop. JournalX and fathom each carry their own `harness/factory_loop.py` (905 lines in JournalX, 575 in fathom, 2026-10-14), so last night's self-recovery fix (journalx #178, #180) never reached fathom. Move the loop into this repo, run one copy per enrolled project via `FACTORY_APP_ROOT`, and remove the project copies. Changes the factory host and running projects: do it with Cam watching. Origin: Cam, 2026-10-14 chat.
- [ ] Dashboard expansion, phases 0 to 6: `dashboard/project-kb/spec/control-room-plan.md`, starting with phases 0 and 1. Origin: Cam's planning session, 2026-10-14.
- [ ] Uncommitted work in the shared checkout `D:/projects/ai-software-factory` (branch `feat/supervisor`): `bin/supervisor.py`, `bin/test_supervisor.py`, `CLAUDE.md`, `CONTEXT.md`, `lifecycle/`. Land it or drop it; supervisor.py carries INC-2026-872. Origin: found 2026-10-14 during the dashboard merge.

## Doc-drift audit — /end 2026-10-14 (god-developer review, do this FIRST next session)

- **Importance:** MEDIUM
  **Classification:** MISSING
  **Location:** repository root (no `CLAUDE.md`, `AGENTS.md` or `AGENT-GUIDE.md` on `origin/main`)
  **Quote:** none; the only agent guide is `dashboard/AGENT-GUIDE.md` > `## Deployment`
  **Evidence:** `git ls-tree --name-only origin/main` lists `.factory .gitattributes .gitignore .knowledge README.md TODO.md bin dashboard docs template`. The shared checkout `D:/projects/ai-software-factory` has an untracked `CLAUDE.md` and `CONTEXT.md` that were never committed.
  **Why it matters:** An agent opening the repo root loads no project instructions. It won't learn that everything outside `dashboard/` tracks coleam00 upstream and must stay unedited, or that upstream is read-only. The constitution requires a canonical guide with a `## Deployment` section.
  **Suggested resolution:** Add root `CLAUDE.md`/`AGENTS.md` loaders and one root guide (or promote `dashboard/AGENT-GUIDE.md`) covering the upstream rule, the dashboard and the host. Reconcile with the untracked local copies first.

- **Importance:** MEDIUM
  **Classification:** WRONG
  **Location:** `dashboard/project-kb/spec/control-room-plan.md` > `## Phase 0: upstream sync` > "Upstream is read-only."
  **Quote:** "The local `upstream` remote has its push URL disabled."
  **Evidence:** `git -C D:/projects/ai-software-factory remote -v` on 2026-10-14 shows only `origin` (Cameron-Fulton/ai-software-factory). There is no `upstream` remote in that clone.
  **Why it matters:** Phase 0 assumes the remote exists with push disabled. An agent that adds it with a normal push URL could push to coleam00, which is forbidden.
  **Suggested resolution:** Add `upstream` = https://github.com/coleam00/ai-software-factory.git and run `git remote set-url --push upstream DISABLED` in each clone the sync uses, then verify.

- **Importance:** LOW
  **Classification:** DRIFT
  **Location:** `dashboard/project-kb/spec/control-room-plan.md` > `## Findings that change the plan` > "The fork is 23 commits behind and 2 ahead"
  **Quote:** "The fork is 23 commits behind and 2 ahead, and merges clean today."
  **Evidence:** PR #1 (merge eb090b1, 2026-10-14) added the whole dashboard history under `dashboard/`. The fork is now far more than 2 commits ahead, all in a path upstream never touches.
  **Why it matters:** The ahead count no longer describes "librarian housekeeping only". The phase 0 conflict policy should also name `dashboard/` and `memory/` as fork-owned.
  **Suggested resolution:** Re-measure behind/ahead after adding `upstream`. Add `dashboard/` and `memory/` to the plan's fork-owned path row.
