# ai-software-factory - TODO

## Machine-generated findings (triage; not queued)

- INC-2026-872 (SEV:2): Knowledge entry K-1119: supervisor queues the first open PR matching a head branch name for approve-mode merge - root cause: bin/supervisor.py:220 (local branch feat/supervisor, unpushed) lists open PRs by head branch name and launches archon-merge-queue with mode=approve on prs[0], so a fork or collaborator PR on a same-named branch would .... Ref: `_system/incidents/INCIDENT-LOG.md`. [auto-skip]

## Backlog

- [ ] One shared factory loop. JournalX and fathom each carry their own `harness/factory_loop.py` (905 lines in JournalX, 575 in fathom, 2026-10-14), so last night's self-recovery fix (journalx #178, #180) never reached fathom. Move the loop into this repo, run one copy per enrolled project via `FACTORY_APP_ROOT`, and remove the project copies. Changes the factory host and running projects: do it with Cam watching. Origin: Cam, 2026-10-14 chat.
- [ ] Dashboard expansion, phases 0 to 6: `dashboard/project-kb/spec/control-room-plan.md`, starting with phases 0 and 1. Origin: Cam's planning session, 2026-10-14.
- [ ] Uncommitted work in the shared checkout `D:/projects/ai-software-factory` (branch `feat/supervisor`): `bin/supervisor.py`, `bin/test_supervisor.py`, `CLAUDE.md`, `CONTEXT.md`, `lifecycle/`. Land it or drop it; supervisor.py carries INC-2026-872. Move the untracked `CLAUDE.md` and `CONTEXT.md` aside before returning that tree to `main`: the committed root copies would block the fast-forward. Origin: found 2026-10-14 during the dashboard merge.

