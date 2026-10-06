# ai-software-factory - TODO

## Machine-generated findings (triage; not queued)

- INC-2026-872 (SEV:2): Knowledge entry K-1119: supervisor queues the first open PR matching a head branch name for approve-mode merge - root cause: bin/supervisor.py:220 (local branch feat/supervisor, unpushed) lists open PRs by head branch name and launches archon-merge-queue with mode=approve on prs[0], so a fork or collaborator PR on a same-named branch would .... Ref: `_system/incidents/INCIDENT-LOG.md`. [auto-skip]
