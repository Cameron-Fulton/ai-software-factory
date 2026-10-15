**MEMORY PACKET — mp-20261015-025027-dashboard-phase0-1-sync | 20261015 | dashboard-phase0-1-sync**
**Parent:** mp-20261014-175949-factory-dashboard-merge

**Goal:** Turn the factory dashboard into a control room that answers which model combinations are cheapest, fastest and most reliable, while keeping the fork level with Cole Medin's upstream without manual work, so Cam (not a developer) can run the factory without watching it.

**Context:** 2026-10-14/15 session: resolved the doc-drift audit, got Cam's six plan decisions, retired the old factory-dashboard repo, built and shipped plan phases 0 (upstream sync) and 1 (collector v3 + Compare view), and ran the first real upstream sync.

**Entities Discussed:**
- Cameron-Fulton/ai-software-factory — our fork (public); dashboard/ and memory/ are fork-owned, everything else tracks upstream
- coleam00/ai-software-factory, coleam00/Archon — third-party upstreams; fetch only, never write
- `.github/workflows/upstream-sync.yml` — daily 06:17 UTC + manual; `test` job (read-only token, runs bin tests on merged tree) then `publish` job (merges tested SHA, opens PR, self-merges when clean+green); `GH_REPO` pins gh to the fork
- Root `AGENT-GUIDE.md` / `CLAUDE.md` / `AGENTS.md` / `CONTEXT.md` — added PR #3; canonical repo guide with path ownership, upstream rule, Deployment, CodeRabbit wait
- collect.py data.json v3 — steps gain step, role, repair, started, tier, effort, attempt, failureKind, all validated to names/enums/numbers
- Role map — keyed on last `__` segment of Archon node names (implement→builder; scope/synthesize/code/tests/seams/simplify/docs/errors→reviewer; validate/await-checks→verifier; pr/merge/assess→merger; plan→planner; triage/classify→triage); `corrections` in name = repair
- Compare view — dashboard/web compare.tsx + data-table.tsx (house table: #050E30 header, left-aligned, search, sort, column picker); Wilson/t 95% ranges; names a winner only when ranges clear and ≥5 tasks
- Factory host — runs Archon, both project loops and the dashboard; access details are in the private dev-system vault, not here
- Loop services — JournalX and fathom each run their own copy of `factory_loop.py` on the host, at different versions; a staged replacement exists there
- CodeRabbit — reviews every PR on the fork (Team plan, fair-use limit); Qodo removed by Cam (lapsed subscription)
- PixelLab — avatar art service; approved, $25/month starting cap; signup needs Cam's card at phase 4

**Decisions Made (ranked by priority):**
1. Upstream sync PRs merge themselves when clean and green — ADOPT — Cam 2026-10-14 ("just merge"); verified no deploy path from fork main
2. Cam does not watch host changes/rollouts — ADOPT — Cam 2026-10-14; agents act, watch, roll back; new kinds of project-touching change still get a plain-words go-ahead
3. Experiments: 3 issues per project per week run twice — ADOPT — Cam accepted recommendation
4. Pixel art avatars; PixelLab $25/month cap — ADOPT — Cam asked agent to set budget
5. Points become factory budget; control panel allows all actions except approve-merge; levels track record only — ADOPT — Cam accepted recommendations
6. Old repo Cameron-Fulton/factory-dashboard archived, local D:\projects\factory-dashboard deleted — ADOPT — Cam approved; content verified carried into dashboard/
7. Upstream tests run in a read-only job; write job never executes repo code — ADOPT — god-infra + background security review
8. Do not adopt Langfuse/Helicone/Phoenix — REJECT — need Archon instrumentation (upstream code), store full prompts (breaks no-free-text), lack task/review joins

**Rejected (with reasoning):**
- Editing upstream `.gitattributes` for merge=ours — upstream-owned file; set in `.git/info/attributes` at runtime
- Tier-config snapshot and login-history in collector — tiers not recorded per event; requested model already captures it
- Asking Cam to watch rollouts — he is not a developer and cannot judge them

**Critical Risks Identified:**
- Sync self-merges third-party code into fork main — nothing deploys today; re-check if a deploy workflow or host auto-pull is ever added
- Failed sync PRs (conflict/tests) notify nobody — agent must look for labels upstream-sync-conflict / upstream-sync-tests-failed (TODO)
- Upstream adding .github/workflows would make the sync push fail (token lacks workflows scope) (TODO)
- Model comparison confounded: Sonnet 5 and Opus 5.5 ran in different weeks; Fable never ran, Haiku once; hypotheses need experiments
- Shared checkout D:/projects/ai-software-factory parked on feat/supervisor at e167ddc with uncommitted supervisor work (INC-2026-872) and untracked CLAUDE.md/CONTEXT.md that block fast-forward to main

**Lessons Learned (this session):**
- Deleted D:\projects\factory-dashboard after checking only `git status` (ignored files hidden); its gitignored .env held the dashboard login → before deleting a folder, list ignored files too (`git status --ignored`) and move any .env first. Recovered from the host's copy without printing it.
- `gh pr create` in a clone with an `upstream` remote targets the PARENT repo (coleam00) → always pass `--repo` or set `GH_REPO` on every gh call in fork clones and workflows.
- Merged PR #4 before CodeRabbit finished; it cannot review closed PRs → wait for CodeRabbit's review on every fork PR before merging.
- Running upstream's tests in a job holding a write token lets third-party code push to the fork → run untrusted repo code only in read-only jobs with persist-credentials false.
- Repo settings changes and GitHub settings pages are blocked for the agent by the permission classifier → hand Cam the exact link and checkbox instead of retrying another way.
- Windows git checkouts convert to CRLF; scripted str.replace edits miss → normalize line endings in edit scripts or use the Edit tool.

**Open Threads:**
- Shared factory loop (TODO Backlog): diff host loop copies vs repo copies, move one loop into ai-software-factory, run per project via FACTORY_APP_ROOT; agent does rollout and watches; Cam already approved
- Roll the synced upstream (new Archon pin, Archon-trigger scheduling) to JournalX/fathom via `factory.py init` — changes how laps start; confirm milestone-loop.json writers survive
- Dashboard phases 2-6 (live feed, control panel, avatars, 3D board, scoring) per dashboard/project-kb/spec/control-room-plan.md
- Experiment runs (3/project/week) to answer Fable/Haiku/Opus+Haiku hypotheses
- Shared checkout cleanup: land or drop feat/supervisor work, move untracked CLAUDE.md/CONTEXT.md aside, return tree to main
- Background sessions from the parent packet (workx, v1.link) — check them with `claude logs <id>`
