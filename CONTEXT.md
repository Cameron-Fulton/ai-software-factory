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
A pull request that merges new upstream commits into the fork on a `sync/upstream-<date>` branch. Designed in phase 0 of the dashboard plan.

## Fork-owned path
A path upstream does not ship (`dashboard/`, `memory/`, `.knowledge/`, `TODO.md`, the root agent files). The fork's version always wins in a sync.
