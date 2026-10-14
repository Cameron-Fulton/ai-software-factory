**MEMORY PACKET — mp-20261014-175949-factory-dashboard-merge | 20261014 | factory-dashboard-merge**
**Parent:** —

**Goal:** Make the AI factory one project Cam can work in (factory + dashboard together, one shared loop for every enrolled product), keep it in step with Cole Medin's upstream, then build the dashboard expansion (metrics, live tracker, control panel, avatars, 3D board) from the control-room plan.

**Context:** 2026-10-14 session rooted in dev-system: triaged the Claude sessions dropped by the 02:29 PC shutdown, relayed Cam's answers to three of them, then merged factory-dashboard into ai-software-factory (first packet in this repo).

**User Profile:** Non-developer owner (Cam); wants plain answers, every question restated in full, and agents that decide technical matters themselves.

**Entities Discussed:**
- ai-software-factory — Cameron-Fulton fork of coleam00/ai-software-factory; the factory template (template/factory, template/harness, bin/). Now also holds `dashboard/`.
- dashboard/ — the former Cameron-Fulton/factory-dashboard repo, merged with history by git subtree (PR #1, merge eb090b1). Collector (Python, src/factory_dashboard/collect.py) + Next.js static web app; installed on the host at /opt/factory-dashboard by dashboard/deploy/install.sh (path-relative, unchanged behavior).
- Archon — coleam00/Archon engine; local fork D:/projects/archon has `upstream` remote. Kept separate; pinned via template/factory/pack.json.
- factory_loop.py — our own loop (not in upstream template), copied per project: journalx/harness 905 lines, fathom/harness 575 lines. Takes FACTORY_APP_ROOT, so one central copy can serve every project.
- build-server-us-west-2 (5.78.214.154) — factory host; runs factory-loop.service per project and the dashboard units.
- control-room-plan.md / agent-avatar-system.md — Cam's planning docs, now at dashboard/project-kb/spec/. Phases 0 (upstream sync) to 6 (scoring).
- Upstream drift — plan says fork is 23 commits behind coleam00, merges clean; upstream PR #16 moved scheduling into Archon triggers (rollout needs Cam watching).
- claude --bg --resume <id> --permission-mode auto — how dropped sessions were relaunched in the background; `claude attach|logs <id>`.

**Decisions Made (ranked by priority):**
1. Merge factory-dashboard into ai-software-factory under dashboard/ — ADOPT (done, Cam approved) — one project; new top-level folder never conflicts with upstream syncs.
2. Keep Archon a separate fork — ADOPT — merging cuts off Cole Medin's updates.
3. Products (JournalX, fathom) stay in their own repos, not folders in the factory — ADOPT — own issues, CI, deploys; one bad merge would hit all.
4. One shared factory loop run centrally per project via FACTORY_APP_ROOT — BUILD (Cam said yes, deferred to next session) — copies drifted; fathom lacks the self-recovery fix.
5. Next session: review the control-room plan, then build phases 0 and 1 per Cam's starting prompt — ADOPT.
6. Do not archive the old factory-dashboard GitHub repo or delete D:/projects/factory-dashboard without asking Cam — CAUTIOUS.

**Rejected (with reasoning):**
- Products as folders inside the factory repo — mixes issues/CI/deploys; shared blast radius.
- Folding Archon into the factory repo — loses upstream updates.
- Squash-merging the subtree PR — would drop the dashboard's history; used a merge commit.

**Critical Risks Identified:**
- Shared-loop rollout and upstream scheduling change touch the factory host and running projects — do only with Cam watching (Cam's starting prompt: stop and ask first).
- Shared checkout D:/projects/ai-software-factory is on branch feat/supervisor with uncommitted bin/supervisor.py (+test), CLAUDE.md, CONTEXT.md, lifecycle/, .knowledge — supervisor.py carries INC-2026-872 (approve-mode merge of first PR by branch name). Don't lose it; don't ship it unfixed.
- Old D:/projects/factory-dashboard and its GitHub repo still exist; agents may edit the stale copy — Rule 23 says retire it.
- searchactions_gmail login hit its extra-usage cap; Cam asked if it's past due (it isn't). He decided 2026-10-09 "no pay-per-use overflow".

**Lessons Learned (this session):**
- Sessions whose transcript mtime matched the shutdown were not all "dropped"; four had already been reopened → compare last-record timestamps and gaps before calling a session dropped.
- `rmdir` on a top-level drive folder (D:\tmp-unused) is blocked by a built-in safety check → hand top-level folder deletions to Cam; don't retry another way.
- "Merge it" was ambiguous (JournalX redesign was already merged; the held build-file change had been merged by the factory) → check PR state before acting on a merge request, and report when there is nothing to merge.
- Jq string literals in gh --jq reject `\.` escapes → avoid regex escapes inside --jq test() strings.

**Open Threads:**
- Dashboard expansion: next session reviews dashboard/project-kb/spec/control-room-plan.md, then runs Cam's starting prompt (host read-only checks, phase 0 sync workflow, phase 1 collector/Compare view). Prompt paths must use ai-software-factory/dashboard/... and writes go to Cameron-Fulton/ai-software-factory only.
- Shared factory loop (TODO.md Backlog) — needs Cam watching for host rollout.
- Ask Cam: archive Cameron-Fulton/factory-dashboard on GitHub and retire D:/projects/factory-dashboard.
- Background sessions relaunched with Cam's answers: 8685365b (Callytics call-tracking plan, in D:/projects/workx), e3a6c496 (v1.link page ownership, delete test pages), 967f0ba8 (remove duplicate v1.link sidebar on NCCT recon report). Check results with `claude logs <id>`.
- Cam still owes: call-analysis trial review (transcriber 89640ecc); delete D:\tmp-unused; install the JournalX app later today. wp-scanner PR #20 is with the dev team.
