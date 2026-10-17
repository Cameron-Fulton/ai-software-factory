**MEMORY PACKET - mp-20261016-020547-doc-drift-loop-reshape | 20261016 | doc-drift-loop-reshape**
**Parent:** mp-20261015-025027-dashboard-phase0-1-sync

**Goal:** Keep the fork's docs true, close phase 0 of the control-room plan (fork synced with upstream automatically), and move JournalX and fathom onto one factory loop without building a fork-only copy of what upstream now ships.

**Context:** Session of 2026-10-15 (UTC): resolved the 2026-10-15 doc-drift audit (PR #8), confirmed the first scheduled upstream sync (PR #9), reshaped the shared-loop backlog item; the same session also set up a carrier test for a separate private project (Callytics, tracked in the private workx repo, not here).

**Entities Discussed:**
- PR #8 - docs fix: Deployment row names the one workflow; loaders name committed `.knowledge/LANDMINES.md` and say `.knowledge/APPLICABLE.md` is generated, uncommitted, shared-checkout only; CONTEXT sync PR + `.github/` fork-owned; plan's stale "23 behind" and effort-pin text replaced; TODO audit removed. CodeRabbit's 4 findings fixed before merge.
- PR #9 - first sync opened and merged by the scheduled run (cron 06:17 UTC fired late, 11:36 UTC). Brought upstream 5d0d475; `template/factory/pack.json` now pins Archon `02c96342`.
- upstream 5d0d475 - adds `archon-loop` (hybrid loop v2: one move per lap, routing, app check, reviewer that merges; parallel laps claim work items) and `archon-manager`; `schedule.json` gains `parallel` 1-8.
- `.knowledge/APPLICABLE.md` - librarian-generated digest with private incident titles; must never be committed on this public fork. The literal path must stay in the loaders (the librarian keys on it). Locally excluded via `.git/info/exclude`.
- `milestone-loop.json` - loop state the dashboard collector reads; written only by the project loops, so `archon-loop` will not write it.
- god-developer (cold review) - ruled on every drift finding and on the loop question.

**Decisions Made (ranked by priority):**
1. Shared loop: do NOT move JournalX/fathom `harness/factory_loop.py` into this fork - REJECT as written - upstream `archon-loop` covers the job; plan is compare, give the collector a new loop-state source, move both projects to `archon-loop` (`factory.py init`, `schedule install`), delete project loops (god-developer, 2026-10-15; TODO updated in PR #8).
2. If fathom needs JournalX's self-recovery fix (#178, #180) before the switch, port it into fathom's own copy - ADOPT as stopgap.
3. Phase 0 "opened at least one sync PR on its own" - met by PR #9 (scheduled run).
4. Never trigger the sync by hand to "prove" the schedule - a manual run proves nothing about the cron.

**Rejected (with reasoning):**
- Committing APPLICABLE.md - public fork; it carries private incident titles.
- "Opened and merged daily" wording - nothing opens without upstream commits or while a sync PR is open.
- Single loop via `FACTORY_APP_ROOT` copy - the two project loops diverged (905 vs 575 lines); never a plain move.

**Critical Risks Identified:**
- Switching projects to `archon-loop` breaks the dashboard's loop-state source unless the collector gets a new one first.
- Whether `archon-loop` covers JournalX's self-recovery fix is unchecked; fathom still lacks it.
- GitHub cron fires late (5h+ on 2026-10-15) or may skip; do not read a missing run as a failure until hours pass.

**Lessons Learned (this session):**
- The audit's own suggested fixes were stale within hours (upstream moved again) → have a cold reviewer re-verify every suggested resolution against live state before editing.
- Checked the scheduled sync 24 minutes after its cron time and found nothing → allow hours for GitHub scheduled runs before calling one missed.
- `git worktree remove` failed with "Permission denied" while the shell sat in that folder → leave the folder first, then `rmdir` the empty dir and `git worktree prune`.
- Git Bash mangles `origin/main:path` → prefix `MSYS_NO_PATHCONV=1` on `git show origin/main:...`.
- Probing a third-party trial account before building the test harness exposed blocking limits in one cheap call → probe the account's limits first, never assume trial behavior.

**Open Threads:**
- Shared loop: read `archon-loop`'s workflow at pin 02c96342, compare with both project loops (self-recovery first), design the collector's new loop-state source, then roll out with Cam's existing approval and watch laps.
- Archon pin rollout to JournalX/fathom (`factory.py init`) - do together with the loop move; expect `node_completed` to carry tier/effort/attempt/failure_kind.
- Dashboard phases 2-6 (phase 2 next), experiment runs, supervisor branch cleanup (INC-2026-872): unchanged from parent packet.
- Callytics carrier test: private, tracked in the workx runbook; handed to a rankability-transcriber session.
