# AI Factory: Agent Avatar System

Oct 10, 2026 · @Cam Fulton

## Goals and constraints

Every factory agent gets a named, video-game-style avatar that looks the same everywhere it appears and visibly upgrades as the agent levels up.

- **Two surfaces:** a 2D portrait and sprite in the dashboard and progress tracker; a 3D figure on the rotating board, working on its project's side.
- **Agents make the art:** every tool in the stack must be callable by the factory through an MCP server or API, with no human artist in the loop.
- **One style for the whole roster:** a mismatched team reads as clip art, not a game.
- **Live state:** the avatar shows what the agent is doing right now (working, in review, redoing, idle).
- **Levels show on the character:** gear, color and effects change by tier, not only a number next to the name.

## Recommended tool stack

Use PixelLab for 2D avatars, Meshy for 3D board figures, and DiceBear as the day-one placeholder; add Scenario only if PixelLab can't hold one style across the roster.

| Role | Tool | What it gives the factory | Access |
| --- | --- | --- | --- |
| 2D avatars (primary) | [PixelLab](https://mcpservers.org/servers/pixellab-code/pixellab-mcp) | Pixel art characters with 4 or 8 directional views, plus walk, run and idle animations | Hosted MCP server, API token |
| 2D avatars (full API) | [pixellab-forge-mcp](https://github.com/rabbitcannon/pixellab-forge-mcp/releases) | Community server covering the full PixelLab v2 API, including character states | npm, same PixelLab token |
| 3D board figures | [Meshy](https://github.com/meshy-dev/meshy-mcp-server) | Text or image to 3D, auto-rigging and animation, GLB export | Official open-source MCP server, API key |
| 3D alternative | [Tripo](https://glama.ai/mcp/servers/pasie15/tripo-ai-mcp-server/tree) | Text or image to 3D, rig, retarget preset animations, glTF/FBX export | Community MCP server, API secret |
| Style consistency | [Scenario](https://help.scenario.com/articles/2664328768-getting-started-with-the-scenario-mcp-server) | Derive a full character set from one base design; style training; rarity-variant apps | Hosted MCP server, Scenario account |
| Placeholder | [DiceBear](https://dicebear.com/introduction/) | Same avatar every time from a seed (the agent ID); pixel-art style available; MIT core | JS library, no account |
| Free 3D fallback | [KayKit, Quaternius, 100 Avatars, Kenney](https://app.cinevva.com/de/guides/free-rigged-3d-character-models) | Rigged, animated characters in glTF | Download; check each pack's license |

**Reference repo:** [Pixel Agents](https://github.com/pablodelucca/pixel-agents) already maps Claude Code agents, sub-agents and agent teams to animated characters by watching transcript files. Borrow its activity-to-animation approach for the live states.

**Avoid:** Ready Player Me. Its avatar creator and developer APIs went offline on January 31, 2026, after Netflix bought it ([Avatar SDK](https://avatarsdk.com/blog/2026/08/31/avatar-platforms-2026-whos-alive-whos-gone/)).

## Agent identity data model

Each agent's look is stored as a short character brief plus the generated asset IDs, so any tier can be regenerated from the same base and the art never drifts.

| Field | Type | Purpose |
| --- | --- | --- |
| agent\_id | string | Stable key; also the DiceBear seed for the placeholder |
| name | string | Agent's display name |
| team\_id | string | Links to the team; teams share a color and emblem |
| role | string | Orchestrator, builder, reviewer and so on; drives silhouette and props |
| character\_brief | text | 2 to 3 lines describing the character, reused in every prompt |
| style\_ref | asset ID | The roster's shared style reference image |
| base\_asset\_id | asset ID | Tier 1 design every later tier is derived from |
| tier | integer | Current visual tier (see leveling) |
| sprites | map of state to URL | 2D animations per live state (working, review, redo, idle, level-up) |
| model\_glb | URL | Rigged 3D figure for the board |
| model\_animations | map of state to clip name | 3D clips per live state |
| generated\_with | string | Tool and model version, so regenerations match |

## Generation pipeline

&#91;embedded content: avatar generation pipeline · 6 steps, 1 style check\]

PixelLab makes the base, views and animations; Meshy turns the approved base into a rigged GLB; a reviewer agent runs the style check against the roster's reference image. A level-up edits the base and sends it back through the same check.

## How avatars change as agents level up

Use four visual tiers, each an edit of the tier 1 base, never a fresh generation: the face and silhouette stay, the gear upgrades.

| Tier | Working name | What changes on the character |
| --- | --- | --- |
| 1 | Recruit | Base outfit in team colors, one role prop |
| 2 | Specialist | Upgraded prop, team emblem on the outfit |
| 3 | Veteran | New outfit layer (armor, coat), subtle glow |
| 4 | Legend | Signature effect (particles, aura), gold trim, unique idle animation |

- Tiers are generated by editing the base asset (PixelLab inpainting or style reference; Scenario's character-set derivation), so the agent stays recognizable.
- A level-up plays a short animation in the dashboard and on the board, then swaps in the new tier's assets.
- What earns a tier is still open; it depends on the scoring system.

## Dashboard and 3D board integration

One activity feed drives both surfaces: each factory event maps to a live state, and the state picks the 2D sprite and the 3D clip.

| Live state | Triggered by | Dashboard (2D) | Board (3D) |
| --- | --- | --- | --- |
| Working | Agent picks up or is executing a task | Typing or crafting loop beside the task card | Figure at its milestone square, working clip |
| In review | Task handed to the review step | Waiting pose, review badge | Figure faces the reviewer, idle clip |
| Redo | Task failed review | Short failure flash, then working loop; redo count on the card | Figure steps back one square, working clip |
| Done | Task passed review | Celebrate frame, points added | Figure advances to the next milestone |
| Idle | No assigned task | Idle loop in the team roster | Figure waits at the team's board edge |
| Level-up | Agent reaches a new tier | Level-up animation, new tier swapped in | Effect burst, new GLB loaded |

- **Dashboard:** 2D sprites as PNG or GIF sequences; DiceBear fills any slot whose art isn't generated yet.
- **Board:** rigged GLB figures, which three.js and Babylon.js load directly.
- **Event source:** depends on what the factory logs per task today; that audit is already on the factory task list. Pixel Agents' approach of reading Claude Code transcript files is a fallback if the factory doesn't emit events.

## Setup steps

Each server takes one API key and one config entry; keep keys in environment variables, never in the repo.

**PixelLab** ([setup guide](https://www.pixellab.ai/vibe-coding))

1. Sign up at PixelLab and copy your API token.
2. Add the hosted server to the factory's MCP config:

```json
{"mcpServers": {"pixellab": {"url": "https://api.pixellab.ai/mcp", "transport": "http", "headers": {"Authorization": "Bearer YOUR_API_TOKEN"}}}}
```

3. Ask an agent to generate a test character with 8 directional views to confirm it connects.

**Meshy** ([MCP server](https://github.com/meshy-dev/meshy-mcp-server))

1. Create a Meshy API key (it starts with msy\_).
2. In Claude Code:

```bash
claude mcp add-json meshy '{"command":"npx","args":["-y","@meshy-ai/meshy-mcp-server"],"env":{"MESHY_API_KEY":"msy_YOUR_API_KEY"}}'
```

3. Run /mcp and check that meshy shows as connected.
4. Optional: install Meshy's ready-made workflows with `npx skills add meshy-dev/meshy-3d-agent`.

**Scenario, only if needed** ([MCP guide](https://help.scenario.com/articles/2664328768-getting-started-with-the-scenario-mcp-server))

```bash
claude mcp add --transport http scenario https://mcp.scenario.com/mcp
```

The first call opens a browser tab to sign in to Scenario.

## First test: three agents, three tiers

Before building anything into the dashboard, have one agent produce 9 PixelLab avatars and 1 Meshy figure, then judge them against the pass criteria below.

- [ ] Write character briefs for three agents with different roles (an orchestrator, a builder, a reviewer)
- [ ] Generate one shared style reference, then each agent's tier 1 base from it
- [ ] Derive tiers 2 and 3 for each agent by editing the base
- [ ] Add idle and working animations to one agent
- [ ] Turn one agent's tier 1 image into a rigged Meshy GLB and load it in a three.js test page
- [ ] Log credits and minutes spent per asset

**Pass criteria**

- Someone who didn't see the prompts can match all 9 images to the right agent.
- All three agents look like they belong to the same game.
- Each tier reads as an upgrade at thumbnail size in the dashboard.
- The 3D figure is recognizably the same character as its 2D avatar.

If consistency fails, rerun the test through Scenario's character-set derivation before changing anything else.

## Decisions needed from Cam

- [ ] Art direction: pixel art (fits PixelLab and the Monopoly-board feel) or stylized 3D everywhere
- [ ] Approve API accounts for PixelLab and Meshy, and a monthly credit budget for avatar generation
- [ ] Agent and team names for the first three test agents, or let an agent propose them
- [ ] What earns a tier, once the scoring system is decided

## Sources

- [PixelLab MCP](https://mcpservers.org/servers/pixellab-code/pixellab-mcp)
- [pixellab-forge-mcp releases](https://github.com/rabbitcannon/pixellab-forge-mcp/releases)
- [Meshy MCP server](https://github.com/meshy-dev/meshy-mcp-server)
- [Tripo AI MCP server](https://glama.ai/mcp/servers/pasie15/tripo-ai-mcp-server/tree)
- [Scenario MCP guide](https://help.scenario.com/articles/2664328768-getting-started-with-the-scenario-mcp-server)
- [DiceBear](https://dicebear.com/introduction/)
- [Pixel Agents](https://github.com/pablodelucca/pixel-agents)
- [Free rigged 3D characters (Cinevva)](https://app.cinevva.com/de/guides/free-rigged-3d-character-models)
- [Avatar platforms in 2026 (Avatar SDK)](https://avatarsdk.com/blog/2026/08/31/avatar-platforms-2026-whos-alive-whos-gone/)
