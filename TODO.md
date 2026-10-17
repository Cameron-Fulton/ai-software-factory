# ai-software-factory - TODO

## Machine-generated findings (triage; not queued)

- INC-2026-872 (SEV:2): Knowledge entry K-1119: supervisor queues the first open PR matching a head branch name for approve-mode merge - root cause: bin/supervisor.py:220 (local branch feat/supervisor, unpushed) lists open PRs by head branch name and launches archon-merge-queue with mode=approve on prs[0], so a fork or collaborator PR on a same-named branch would .... Ref: `_system/incidents/INCIDENT-LOG.md`. [auto-skip]

## Backlog

- [ ] One factory, running around the clock: one fork-owned loop for every project, an auditor, a self-improvement pass, Spider enrolled and fathom #614 split across repositories. Plan: `dashboard/project-kb/spec/autonomous-factory-plan.md`. It replaces the earlier "move both projects onto archon-loop" line: subscription-login rotation is our own patch on `Cameron-Fulton/Archon` (`e2799053`), absent from the upstream branch that carries archon-loop, and archon-loop lacks Fathom's scrutiny floors. Revisit when the rotation patch is ported onto a fork branch that has archon-loop and the floors exist as an archon-loop gate. Origin: Cam, 2026-10-16 and 2026-10-17 chat.
- [ ] Upstream sync PRs that stop on a conflict or a red test notify nobody; an agent has to look for the `upstream-sync-conflict` and `upstream-sync-tests-failed` labels. Origin: phase 0 build, 2026-10-14.
- [ ] If upstream ever adds `.github/workflows/`, the sync job's push is refused (its token lacks the workflows permission) and the sync stops. Origin: phase 0 build, 2026-10-14.
- [ ] Upstream sync `merge=ours` only protects fork-owned files both sides changed; an upstream add or delete under `dashboard/` or `memory/` would pass through, and a conflict resolved in GitHub's web editor loses the protection. Origin: god-infra review of PR #4, 2026-10-14.
- [ ] Collector `failureKind` is checked only for shape; copy Archon's fixed list (`nodeFailureKindSchema` in `packages/workflows/src/schemas/node-execution.ts`) so the guard does not depend on the engine. Origin: god-security review of PR #4, 2026-10-14.
- [ ] Dashboard expansion, phases 2 to 6 (phases 0 and 1 built 2026-10-14): `dashboard/project-kb/spec/control-room-plan.md`. Origin: Cam's planning session, 2026-10-14.
- [ ] Uncommitted work in the shared checkout `D:/projects/ai-software-factory` (branch `feat/supervisor`): `bin/supervisor.py`, `bin/test_supervisor.py`, `CLAUDE.md`, `CONTEXT.md`, `lifecycle/`. Land it or drop it; supervisor.py carries INC-2026-872. Move the untracked `CLAUDE.md` and `CONTEXT.md` aside before returning that tree to `main`: the committed root copies would block the fast-forward. Origin: found 2026-10-14 during the dashboard merge.
