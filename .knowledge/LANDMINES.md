# ai-software-factory landmines (librarian auto-rules)

> Promoted `K-NNN` entries that apply to this project's stack. Read before planning or building.
> Canonical bodies live in `D:\projects\dev-system\_system\knowledge\`.

<!-- auto-rules-begin -->

<!-- K-1119: Picking a PR by head branch name and taking the first match can queue a fork's or another author's PR -->
- Never pick the factory's PR with `gh pr list --head <branch>` and `prs[0]`: `--head` matches the branch name in any head repository, so a fork or collaborator PR can be queued for approve-mode merge. Act on the PR number the ship step returned; if a search is unavoidable, keep only PRs with `isCrossRepository == false`, a repository-owner head, the factory's author login and the pushed `headRefOid`, and stop unless exactly one remains (INC-2026-872, `bin/supervisor.py` on `feat/supervisor`).
<!-- auto-rules-end -->
