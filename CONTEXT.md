# AI Software Factory -- Context

Dashboard terms (task, lap, step, efficiency score) are in `dashboard/CONTEXT.md`.

## Upstream
Cole Medin's `coleam00/ai-software-factory`, the repo this one is forked from. Read-only for us: we only fetch.

## Fork
`Cameron-Fulton/ai-software-factory`, this repo. All our writes land here through pull requests.

## Pack
The factory files upstream ships in `template/` and installs into a project with `bin/factory.py init`.

## Archon pin
The Archon revision recorded in `template/factory/pack.json`. Syncing upstream moves it, which changes the engine every project runs after its next `init`.

## Sync PR
A pull request that merges new upstream commits into the fork on a `sync/upstream-<date>` branch. `.github/workflows/upstream-sync.yml` opens one on any day upstream has new commits and no sync PR is still open, and merges it only when the merge is clean and the tests pass.

## Fork-owned path
A path upstream does not ship (`dashboard/`, `memory/`, `.knowledge/`, `.github/`, `TODO.md`, the root agent files). The fork's version wins when a sync finds both sides changed it.
