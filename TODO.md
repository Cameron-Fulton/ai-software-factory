# ai-software-factory - TODO

## Machine-generated findings (triage; not queued)

- INC-2026-872 (SEV:2): Knowledge entry K-1119: supervisor queues the first open PR matching a head branch name for approve-mode merge - root cause: bin/supervisor.py:220 (local branch feat/supervisor, unpushed) lists open PRs by head branch name and launches archon-merge-queue with mode=approve on prs[0], so a fork or collaborator PR on a same-named branch would .... Ref: `_system/incidents/INCIDENT-LOG.md`. [auto-skip]

## Backlog

- [ ] One shared factory loop. JournalX and fathom each carry their own `harness/factory_loop.py`, so last night's self-recovery fix (journalx #178, #180) never reached fathom. On the host, JournalX's service runs its 777-line `harness/factory_loop.py`; fathom's runs `/root/factory-loop/factory_loop.py` (498 lines, identical to fathom's harness copy); `/root/factory-loop-next` holds a staged loop and `swap.sh`. Diff the host copies against the repo copies first. Move the loop into this repo, run one copy per enrolled project via `FACTORY_APP_ROOT`, and remove the project copies. An agent does the rollout and watches the next laps; Cam does not watch (2026-10-14). Origin: Cam, 2026-10-14 chat.
- [ ] Upstream sync PRs that stop on a conflict or a red test notify nobody; an agent has to look for the `upstream-sync-conflict` and `upstream-sync-tests-failed` labels. Origin: phase 0 build, 2026-10-14.
- [ ] If upstream ever adds `.github/workflows/`, the sync job's push is refused (its token lacks the workflows permission) and the sync stops. Origin: phase 0 build, 2026-10-14.
- [ ] Dashboard expansion, phases 2 to 6 (phases 0 and 1 built 2026-10-14): `dashboard/project-kb/spec/control-room-plan.md`. Origin: Cam's planning session, 2026-10-14.
- [ ] Uncommitted work in the shared checkout `D:/projects/ai-software-factory` (branch `feat/supervisor`): `bin/supervisor.py`, `bin/test_supervisor.py`, `CLAUDE.md`, `CONTEXT.md`, `lifecycle/`. Land it or drop it; supervisor.py carries INC-2026-872. Move the untracked `CLAUDE.md` and `CONTEXT.md` aside before returning that tree to `main`: the committed root copies would block the fast-forward. Origin: found 2026-10-14 during the dashboard merge.

