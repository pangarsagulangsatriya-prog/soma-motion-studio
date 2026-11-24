# SOMA V5.3 — Adaptive Workspace | PRD
24 November 2026 · Proposed · Epic #278 · Baseline main 5a7e91a (PR #277)
Related: [V5.2 PRD](../soma-v52/PRD.md), [UX Motion Contract](../soma-v52/UX_MOTION_CONTRACT.md), [implementation status](../soma-v52/IMPLEMENTATION_STATUS.md).

## 1. Problem
The operator screenshot shows Gesture selected, two black monitors on the right, and consent, Arm, Foto, Hapus foto and four photo slots in an Inspector below the monitors. The operator reports having to scroll down. Code audit of SignalWorkspace.tsx and signal-workspace.css confirms a flex column in which .sw-monitors is flex:none and .sw-inspector receives the remaining height; .sw-inspector-body scrolls. Rail resize also changes monitor height. Inspector collapsibility added in V5.2 does not solve this competition. Gesture, Photo Capture and camera roles share capture controls; Footprint, Motion, Dual Trace and Floor share decay/reset; Canvas duplicates Archive. SignalGraph.tsx opens inspector on pointer selection including node dragging. These are observed or code-derived findings; do not claim a measured usability study.

## 2. Product outcome
One green SOMA workspace, with persistent graph, two local preview monitors and cue transport. Parameter editing should be possible while watching results, without hunting below a monitor. Default nonmodal floating inspector; docked alternative and clean (closed inspector) state. Quick controls for frequent supported commands. No separate page per cue. No changes to artistic algorithms, source ownership, projection authorization or session format in this UX increment. V5.2 runtime backlog #262–#268 stays open; reuse #269–#272 deliverables and do not close those issues by completing this UI work.

## 3. Users and jobs
Operator: choose/prepare cue, find blocker, perform next action, monitor outputs, capture photos, record and blackout.
Creative technologist: bind cameras, inspect detection, adjust parameters, view graph and diagnose source errors.
Director: inspect preview and adjust supported artistic parameters without interrupting performer.
Optimize first for desktop 1440×900 and 1280×800, compact desktop 1024×768, short desktop 1280×600, mobile 390×844 setup/monitor (not certified show use).

## 4. Requirements
| ID | Requirement | Acceptance | Issue |
|---|---|---|---|
| R01 | Adaptive layout | No document vertical scroll at target desktop; panel geometry bounded to work area; header/transport never hidden | #279 |
| R02 | Floating/docked inspector | Float by default; open via explicit settings/double-click/keyboard; drag header, resize, pin/unpin, close; selection remains separate | #280 |
| R03 | Monitor independence | Both surfaces remain accessible; resize respects available height; existing canvases stay mounted; preserve fullscreen/blackout | #281 |
| R04 | Contextual settings | Each node owns only supported parameters/actions; no generic copy-paste sections or cosmetic controls | #282 |
| R05 | Capture workflow | Actual consent, camera/crop verification, F3A GO, arm, capture and slot state determine primary action; revocation remains accessible | #283 |
| R06 | Quick controls | Up to 3 frequent supported actions, one control state and command path shared with inspector | #284 |
| R07 | Graph ergonomics | Fit/focus, zoom-aware handles, compact labels, visual reroutes, optional minimap, grouped toolbar | #285 |
| R08 | Action hierarchy | Explain disabled action in visible blocker with recovery; keep global transport and privacy/safety | #286 |
| R09 | Motion and access | Event-driven motion, reduced motion, keyboard focus/restoration, original assets | #287 |
| R10 | QA | Layout geometry, continuity, pixel and fixture checks; report legacy failures and physical gaps | #288 |
| R11 | Release | Reviewed scope and acceptance; opt-in/rollback; GitHub Pages only | #289 |

## 5. User flows
### Setup & inspect
Open project → graph visible with both monitors and cue transport → select a node (highlight only) → settings icon/Enter/double-click opens inspector → change parameter → output changes through existing engine → close or dock. Dragging a node never opens or moves inspector. Clicking a blank graph clears selection only if not editing; it never stops cue.
### Float / dock / clean
Open inspector at safe default top-right of graph, avoid monitor rail, toolbar and transport. Drag within graph safe bounds, resize using edge grip; dock to independent full-height column; collapse into accessible Settings entry. Docking may reduce graph width; Fit/Focus remain available. Clean hides inspector without resetting selection or commands. Restore safe geometry on resize/reload; do not restore consent, camera permission, capture arm, cue running or hardware authorization.
### Quick edit
Click explicit node quick-controls button → anchored nonmodal popover → adjust supported decay or action → close. Popup flips/clamps when near edge; Escape closes topmost transient panel without firing unrelated actions, dedicated Blackout control/shortcut remains available according to reviewed safety contract.
### Photo Capture
Missing camera → connect/assign; source readiness → consent; consent granted → show correct audience preview/crop; verify → prepare F3A/GO if not running; arm → capture/manual fallback; 4 slots → completed. One primary action per step, while consent can always be revoked and existing photos can be reviewed/cleared. Do not hide required conditions. Gesture inspector shows detection/arm readiness and a link to Capture; it does not own consent or photo slots. Existing actual frame/crop validation limitations must be tracked in #267, not bypassed by visual state.
### Output and fault
Show output condition derived from actual state: standby, cue intentionally black, manual blackout, source fault/blocked, local preview. Monitor Blackout/Resume remains independent of current selection. Any source recovery follows existing preflight; no auto-relight. No claim of calibrated hardware output.

## 6. Parameter ownership and capability boundary
| Node | V5.3 supported | Proposed only, separate engine work |
|---|---|---|
| Camera / source | Connect, QR, Retry, Assign, remove when stopped | role-aware inference #263 |
| Motion | actual tracking status, Reset A/B | extra sensitivity controls |
| Footprint | Decay 1–60s | size, opacity if not exposed by active engine |
| Dual Trace | actual route/state and existing supported settings if verified | A/B color, brush, thickness until API verified |
| Gesture | detection/arm status, link to Photo Capture | sensitivity tuning |
| Photo Capture | consent, preview, verify, arm, manual photo, clear, 0–4 slots | new gesture algorithm |
| Archive | existing local media picker, decode status | advanced media editor |
| Session | actual record state, import/export | scrub/speed/pause until #265 |
| Floor / Canvas | local fullscreen, blackout/resume, actual status | integrated mapping #266 |
All buttons use actual commands; hide or explicitly label unavailable functionality. Never show fake thumbnails or simulated live signals.

## 7. Design requirements
Maintain current palette (#111714, #19221E, #A7D4A8) and existing visual identity. Inspector title = node name + status, no repeated type headings. Default primary control above fold; Advanced and diagnostics disclosed separately. Panel footer sticky only when action applies. Two monitors canonical; no duplicated full-size preview. Native modal reserved for file selection/confirmation or deliberate blocking tasks. No modal for everyday edits. Desktop no document scroll; long Advanced content can scroll inside its own panel. Compact/mobile may scroll within bounded drawer/sheet, keep safety controls available. Do not force all content to fit by shrinking font or hiding safety conditions. Pin preference and layout dimensions only; fit based on remaining viewport.
Motion specs and implementation contract in TECHNICAL_SPEC.md.

## 8. Success targets (not achieved yet)
- At 1280×800 and 1440×900: ordinary controls and one current primary action visible without vertical scroll; Graph, monitor and transport accessible. At short desktop/mobile, bounded overflow in advanced content permitted.
- 5 formative operators, >=4/5 locate settings, adjust decay, return to clean view and complete capture prerequisite navigation without instruction. Common node setting reachable in <=2 actions.
- Reduce persistent duplicate labels and irrelevant controls; measure visible text and actions vs same V5.2 node states. No arbitrary percentage claimed without measurement.
- 50 panel open/close/dock/resize transitions during active cue without extra camera session, recorder stop, image deletion, cue restart or latch reset.
- p95 UI response <=100ms on reference machine; no >5% matched render throughput regression (coordinate #268); actual measurements required.

## 9. Release scope
G0 review PRD, technical spec, supported action inventory and interactive state prototype. G1 implement incrementally behind opt-in route/flag; current V5.2 rollback retained. G2 browser/unit/build/legacy QA and operator review. G3 verified GitHub Pages SHA only; Vercel remains unchanged. Physical hardware acceptance, graph runtime expansion, replay timeline and role-aware inference remain separate. No code/deploy during this planning PR.