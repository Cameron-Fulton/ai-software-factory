# Agent Guide -- AI Software Factory (fork)

> Read D:/SYSTEM.md first. It overrides everything below.

## Project

`Cameron-Fulton/ai-software-factory` is our fork of Cole Medin's `coleam00/ai-software-factory`.
Upstream supplies the factory pack: the installer, scheduling, project context and the Archon revision pin (`template/factory/pack.json`).
The fork adds the factory dashboard (`dashboard/`), session memory (`memory/`) and librarian housekeeping.
Domain terms are in `CONTEXT.md`. Known landmines are in `.knowledge/APPLICABLE.md`; read it before planning or building.

## Path ownership

| Path | Owner | Rule |
| --- | --- | --- |
| `dashboard/` | Fork | The dashboard. Read `dashboard/AGENT-GUIDE.md` completely before working there. |
| `memory/`, `.knowledge/`, `TODO.md` | Fork | Session packets, landmines, task list. |
| `CLAUDE.md`, `AGENTS.md`, `AGENT-GUIDE.md`, `CONTEXT.md` | Fork | Agent loaders and this guide. Upstream ships none of them. |
| Everything else (`bin/`, `template/`, `docs/`, `README.md`, `.factory/`, `.gitattributes`, `.gitignore`) | Upstream | Do not edit. Local edits turn every upstream sync into a conflict. |

## Upstream is read-only

`coleam00/ai-software-factory` and `coleam00/Archon` are not ours.
Only fetch from them. Never push, open a pull request, file an issue or comment there.
Every write goes to `Cameron-Fulton/ai-software-factory` on a feature branch through a pull request; never push to `main`.
CodeRabbit reviews every pull request here; wait for its review and settle any blocking finding before merging your own.
With an `upstream` remote present, `gh` defaults to the parent repo, so pass `--repo Cameron-Fulton/ai-software-factory` (or set `GH_REPO`) on every `gh` call.

A clone that syncs needs an `upstream` remote whose push URL is disabled:

```bash
git remote add upstream https://github.com/coleam00/ai-software-factory.git
git remote set-url --push upstream DISABLED
git remote -v   # upstream (push) must read DISABLED
```

The sync design is phase 0 of `dashboard/project-kb/spec/control-room-plan.md`.

## Deployment

| What | Value |
| --- | --- |
| Factory host | `build-server-us-west-2` (5.78.214.154) |
| How the pack reaches a project | `bin/factory.py init`, rerun by hand in each enrolled project (JournalX, fathom) |
| GitHub deploys | None: the repo has no `.github` workflows, so a push to `main` deploys nothing from GitHub |
| Dashboard | See `dashboard/AGENT-GUIDE.md` > `## Deployment` |

The host's clone `/root/ai-software-factory` tracks this fork and is never pulled automatically (checked 2026-10-14).
`.github/workflows/upstream-sync.yml` merges upstream daily and merges its own PR when the merge is clean and the tests pass.

Cam is not a developer and does not watch host changes or rollouts (2026-10-14).
Agents make approved changes on the host, watch the result and roll back what misbehaves.
A new kind of change that touches the running projects still needs his go-ahead, asked in plain words.
The dashboard login is in the shared checkout's root `.env` (`DASHBOARD_USER`, `DASHBOARD_PASSWORD`); the host copy is `/etc/factory-dashboard/login`.
