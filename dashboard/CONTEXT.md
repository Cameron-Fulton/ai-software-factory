# Factory Dashboard — Domain Glossary

## Project intent
One private page that shows what the AI Software Factory built, what it cost at API prices, which
models did the work and why things failed, so the owner can watch models and the factory over time.

## Core entities
- **Task** — one GitHub issue the factory picked up, as recorded in a project's loop state. Its
  status is merged, in progress or needs a person.
- **Run** — one engine workflow run (ship, review, merge queue, deliver). Runs belong to a task
  through the issue address in their inputs, or through the task's pull request.
- **Step** — one engine node inside a run that called a model. It carries the model, tokens,
  turns, time and the engine's own cost figure.
- **First-try review** — a task whose first review said ready and that needed no repair pass.
- **Rework** — repair passes, failed attempts and extra review rounds on one task.
- **Efficiency score** — 0 to 100, weighted 40% first-try review, 30% cost per merged task, 15%
  hours per merged task, 15% rework. Cost and time score full marks at or below the all-time median.
- **Login** — one subscription account in the engine's pool; out of usage until its reset time.

## Modules
- **collect** — reads the sources and writes `data.json`; the only code that touches factory data.
- **prices** — the API price table behind every cost estimate.
- **web** — the dashboard app; it fetches `data.json` and does all aggregation in the browser.

## Out-of-scope concepts
- **Billing** — the factory runs on subscriptions; dollars here are estimates, not invoices.
- **Raw transcripts** — step output stays on the host; the page shows counts and short reasons only.
