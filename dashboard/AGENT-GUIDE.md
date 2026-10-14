# Agent Guide -- Factory Dashboard

> Read D:/SYSTEM.md first. It overrides everything below.

## Project

**Stack:** Collector and server: Python 3.12 standard library only. App: Next.js 16 static export on the
Untitled UI starter kit (React 19, Tailwind 4, Recharts). Hosting: systemd and the Coolify Traefik proxy on the factory host.
**Description:** A private dashboard app of the AI Software Factory's work and metrics: tasks, models,
tokens, estimated API cost, failures, retries, reviews passed on the first try and an efficiency
score, for every enrolled project (JournalX and fathom today).

## How it works

- `src/factory_dashboard/collect.py` runs on the factory host every 15 minutes as root
  (`deploy/factory-dashboard-collect.timer`). It reads the engine database
  (`/root/.archon/archon.db`, through an in-memory copy), each project's loop state
  (`<repo>/.factory/milestone-loop.json`) and the account-pool file, and writes
  `data.json` (steps, runs, tasks, failure categories, logins) into `/var/lib/factory-dashboard/www`.
- `web/` is the app. It fetches `data.json` every 5 minutes and does all aggregation in the
  browser (`web/src/lib/factory-data.ts`), so the range, project and model filters re-slice the
  same records. Views: overview, tasks, models, compare, failures, logins.
- `src/factory_dashboard/serve.py` serves the app folder on `172.17.0.1:8090` as a throwaway user
  that cannot read `/root`, and checks the same password as the proxy (any container on the host
  can reach the bridge). The Coolify proxy routes the public name to it behind basic auth
  (`deploy/traefik.yaml.template`, installed to `/data/coolify/proxy/dynamic/`).
- `src/factory_dashboard/prices.py` holds the API price table. Update it when Anthropic changes a
  price or a new model appears; an unknown model falls back to the engine's own cost figure.
- Series colors are the dataviz skill's validated palette (`web/src/styles/globals.css`), assigned
  in a fixed order by entity, so a model keeps its color under every filter.

## Rules for this project

- **No free text from a run reaches the data.** The engine stores model replies, code and issue
  text; the collector keeps counts, model names and times, and turns every failure into a fixed
  category (`CATEGORIES` in collect.py). Issue titles are kept. A test asserts it.
- **The web server never runs as root and never reads `/root`.** The factory host holds the
  factory's GitHub token and subscription logins.
- **Cost is an estimate at API prices.** The factory runs on subscriptions; never present the
  dollars as a bill.
- **The efficiency weights are the owner's choice** (2026-10-09: first-try review 40%, cost 30%,
  time 15%, rework 15%). Change them only when the owner asks.

## Deployment

| What | Value |
|---|---|
| Address | `https://factory.5.78.214.154.sslip.io` (password; user and password in the root `.env` of the shared checkout `D:/projects/ai-software-factory`) |
| Host | `build-server-us-west-2` (5.78.214.154), the factory host |
| Units | `factory-dashboard-collect.timer`, `factory-dashboard-collect.service`, `factory-dashboard-web.service` |
| Proxy route | `/data/coolify/proxy/dynamic/factory-dashboard.yaml` |
| Code on host | `/opt/factory-dashboard` |

Not a Coolify application: nothing to redeploy there. Rerun `dashboard/deploy/install.sh` to update.

The dashboard lives in the `dashboard/` folder of `Cameron-Fulton/ai-software-factory` (merged 2026-10-14). Everything outside `dashboard/` tracks Cole Medin's upstream (`coleam00/ai-software-factory`): keep local changes out of those files so upstream syncs stay clean, and never push, open a PR, file an issue or comment upstream.

## System Rules

1. Check `D:\projects\dev-system\_system\incidents\INCIDENT-LOG.md` before debugging known issues.
2. Check `D:\projects\dev-system\_system\knowledge\INDEX.md` before building integrations.
3. If you discover a reusable pattern, gotcha, or solution: write it to
   `D:\projects\dev-system\_system\librarian\intake\` (see SYSTEM.md for format).
4. File incidents only under SYSTEM.md Rule 8, using `devsys incidents file`; never edit the generated log.
5. Read `PROJECT-LAYOUT.json` before creating paths. Follow the canonical
   `D:/projects/dev-system/_system/docs/project-organization.md`.
6. Run `devsys layout check --project <project-path> --staged` before committing additions.

## Gotchas

- Claude Code writes one-hour cache entries, priced at twice the input rate. The engine's own
  `cost_usd` matches the price table only with that rate.
- The engine reports `input` tokens including cached ones; fresh input is input minus cache
  reads and writes.
