# SOMA V5.4 — Graph Editor Experience | PRD
24 November 2026 · Proposed · Epic #293
Baseline main b2164c4, PR #292. Related [V5.3 PRD](../soma-v53/PRD.md), [technical specification](../soma-v53/TECHNICAL_SPEC.md), [V5.2 PRD](../soma-v52/PRD.md).

## 1. Problem and evidence
User screenshot of V5.3 shows Sources/Process/Session/Output as plain column labels, a blue browser text selection on "Belum ada rekaman", and bright wires despite a standby output. User reports inconsistent selection/navigation and expects other cue branches to dim when F1 is chosen. Browser read confirmed V5.3 BETA, 0/1 camera ready, no running cue, and graph toolbar without a dedicated Hand tool.
Code audit:
- SignalGraph.tsx renders sw-column spans, hard-coded node positions and separate position history; group containers absent.
- loadPositions and persistence exclude source:* entries. Dynamic camera positions therefore do not survive reload through this store.
- Pointer handlers combine background, middle-button and Space pan; Space only sets state when viewport itself focused. Node title drag and click suppression are separate; no explicit persistent Hand mode.
- relatedEdges traverses entire logical GRAPH, not next/running cue scope; hover or selection can mark unrelated paths focused.
- CSS gives focused and delivered identical opacity, width and type colors. Fault/stale rules force full opacity. Planned nodes get a border but nonmembers are not dimmed.
- Cue buttons only setNext; old selection may continue illuminating unrelated paths.
These are observed/code-derived findings, not a measured usability study or proof of live tracking failure.

## 2. Objective
Create a predictable editor for one persistent stage graph. Operator can read the selected cue at a glance, arrange related nodes, name groups, annotate stage setup, and pan without accidental changes. Preserve green palette, Floating/Docked Inspector, two independent monitors, cue transport and artistic engines. Layout editing never changes runtime topology, calibration, permission, consent, recording or output latch.
Users: creative technologist arranges patch and binds sources; operator navigates and prepares cues; director reviews paths and notes.

## 3. Requirements
| ID | Feature and expected behavior | Issue |
|---|---|---|
| R01 | Versioned view document, stable group/node identities, safe migration and layout persistence | #294 |
| R02 | Select, Hand, temporary Space pan, Frame and Note modes; deterministic pointer and keyboard behavior | #295 |
| R03 | Distinct planned/running/delivered/inactive/fault states; selected cue highlights exact paths | #296 |
| R04 | Editable group containers: name, move members together, resize/auto bounds, create/ungroup | #297 |
| R05 | Collapse/expand with external proxy ports, editable notes, optional muted group accent | #298 |
| R06 | Trackpad pan, pointer-anchored zoom, Fit/Focus, grouped toolbar and minimap | #299 |
| R07 | Multi-selection, marquee, snap/alignment, atomic layout undo/redo, explicit auto-arrange | #300 |
| R08 | Wire readability, visual waypoints, screen-space port hit regions and keyboard connect | #301 |
| R09 | Compact cards, semantic zoom, contextual selection, actionable blocker copy | #302 |
| R10 | Motion tokens, accessible states and original interaction assets | #303 |
| R11 | Browser/contract QA, responsive safety, persistence and cue continuity | #304 |
| R12 | Reviewed prototype and tested release with canonical route and rollback | #305 |

## 4. Interaction design
### Groups
Default containers: Sources (camera roles, unbound cameras, Archive, Add camera affordance), Process (Motion, Gesture, Footprint, Dual Trace, Photo Capture), Session (collapsed recorder/saved/replay card), Output (Floor, Canvas). Group IDs stable, titles editable inline. Frame tool wraps selected nodes or draws an empty container. Membership explicit, one group per visible card, no nesting in MVP. Group header drag moves all members in one undo transaction. Resize defines minimum bounds plus padding; never clips member cards. Ungroup/delete frame preserves nodes and routes. Notes are plain text, attached to group or free on canvas. Optional group accent muted, never uses emergency red as decoration. Collapse is view-only: show boundary proxy handles for external edges and summary of actual state; preserve hidden node positions. No fake new runtime node.

### Tools
| Tool | Shortcut | Action |
|---|---|---|
| Select | V | Click selects, Shift toggles, background marquee, drag node/group, double-click opens Inspector |
| Hand | H | Pan from graph, node or wire; no selection, settings, connection or drag |
| Temporary Hand | Space held | Pan until release, return to prior tool; no stuck mode on blur |
| Frame | F | Wrap selection or draw frame; commit explicitly |
| Note | N | Place/edit note; return to Select after creation |
| Fit / Focus | Shift+1 / Shift+2 | Fit visible document / selected bounds |
| Undo / redo | Cmd/Ctrl+Z / Shift+Cmd/Ctrl+Z | View history only |
Escape retains emergency blackout; cancel transient wire/tool interaction as secondary effect without preventing global safety action. Ignore editing shortcuts inside inputs, contenteditable, file pickers and dialog controls; no intercept of Inspector wheel. Middle mouse pan. Plain wheel/trackpad deltas pan, ctrl-wheel/pinch zoom around pointer when browser exposes pinch as wheel; explicit zoom controls remain.

### Cue visual hierarchy
| Next cue | Visible planned node cards | Actual planned external edges |
|---|---|---|
| F1 Jejak | Performer, Motion, Footprint, Dual Trace, Session, Floor, Canvas | 01,02,03,04,05,06,07 |
| F2 Arsip | Archive, Canvas | 12 |
| F3A Foto | Penonton, Gestur, Gesture, Photo Capture, Canvas | 08,09,10,11 |
| F3B Replay | Archive, Session, saved-photo representation of Capture, Floor, Canvas | 12,14,15,16 |
IDs are edge-NN in existing GRAPH. Internal collapsed routes 13,17,18 remain part of compiler plan but do not render as external wires. Shared physical source cards deduplicate via viewId. F3B uses saved photos, no live capture implication. No running cue: nonmembers dim; planned route is clear but has no packet animation. Running cue differs from next: preserve running outline and true fresh delivery, next-only route dashed. Old focus outside next/running scope cannot brighten unrelated wires. Node selection has its own border and never equals delivery. Error on inactive branch retains accessible warning without full route brightness. Changing next never executes GO, opens camera, resets capture or releases blackout.

### Layout and copy
Left tool cluster: Select/Hand/Frame/Note. Navigation cluster: zoom, Fit, Focus, minimap. History cluster: undo/redo and layout menu (Reset behind confirmation). Group title and optional one-line note. Cards show name, state and one relevant detail, with settings affordance. At low zoom hide secondary text; title/status remain accessible. Prevent browser text selection except editor fields. Maintain view-only edits during active cue; runtime source rebind retains current lock rules.

## 5. Success criteria (targets)
- At 1440×900 and 1280×800 operator can see all four group headings via Fit; no page scroll. Test 1024×768, 1280×600, 390×844 compact setup too.
- 5 formative operators, at least 4 locate Hand, rename a group, return to Fit and identify next/running cue without instruction.
- 50 view operations during active archive cue without interruption, relight, recorder stop, or new source connection. Verify actual pixels and runtime state; fixtures do not certify physical equipment.
- F1–F3B exact membership tests; F1 running/F2 next, F3A running/F3B next and blocked GO cases.
- p95 interaction feedback <=100ms, no >5% matched rendering throughput regression vs V5.3 on documented reference hardware. No measured result claimed yet.

## 6. Scope and rollout
P0: document, tool controller, cue resolver, core grouping, navigation, QA/release. P1: notes/collapse, multi-select/alignment, wire polish, copy, motion. Do not add arbitrary graph execution, new engine parameters, integrated optical mapping, session replay redesign or role-aware inference; these remain earlier backlog. Design review via editable Figma or labeled HTML prototype, no need to recreate full shell. Implement opt-in beta, preserve V5.3 explicit rollback; canonical nodes route changes only after approval and route tests. Verify actual deployed header and build SHA. GitHub Pages only, Vercel untouched. No code or deployment in this planning PR.