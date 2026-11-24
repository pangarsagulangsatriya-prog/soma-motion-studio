# SOMA V5.2 — Stage-Ready Node Workspace | PRD
24 November 2026 · Proposed · Architecture-first · Epic #261
Baseline: main 6021cc1b56630b4f22239f4fbaa7ab0db9d2aa14; V5.1 PR #260. Read alongside [V5.1 PRD](../soma-v51/PRD.md), [technical spec](../soma-v51/TECHNICAL_SPEC.md), and [motion spec](../soma-v51/DESIGN_MOTION_SPEC.md). V5.1 remains available throughout this work. This is planning, not a new release.

## 1. Problem and objective
SOMA V5.1 unifies the stage graph, dynamic camera cards, local Floor/Canvas monitors, cue transport and contextual inspector. Audit found a fixed engine graph (only source bindings editable), role-aware inference missing, incomplete event telemetry, local-only outputs, incomplete layout/session persistence, and gaps in motion and interaction. CI verified two V5.1 browser scenarios, but Stage 1/2 smoke [45346643100](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/actions/runs/45346643100) had four failures; cause not established. Hardware readiness is unverified.
Objective: reliable, readable single workspace for the 30-minute Unpacking run, with honest signal and output states, fast operator actions and minimal text. Technical architect approves contracts before a new Figma design.

## 2. Scope and priorities
P0: regression baseline, source lifecycle, role-specific processing, cue transaction, F1 session and F3 replay, consent/crop capture, two calibrated output adapters, telemetry and acceptance matrix.
P1: hierarchy, dynamic graph interaction, accessible port connections, contextual previews, compact inspector, minimap, auto-layout, view/draft undo, persistent workspace, component and motion contract.
P2 deferred: arbitrary user-defined shaders, general-purpose graph scripting, extensible node marketplace, unlimited camera inference, new visual engine algorithms. Do not redesign Footprint/Dual Trace artistic output or remove legacy Studio. Do not claim ten physical cameras; ten synthetic producers are a stress target.

## 3. Users and cue contract
Creative technologist sets sources, routes, calibrates and diagnoses. Operator prepares next cue and executes with permanent Record/GO/Stop/Blackout. Director reviews visual composition and changes parameters. All use the same workspace.
| Cue | Source / prerequisite | Floor | Canvas |
|---|---|---|---|
| F1 Jejak | Fresh performer source, pose state separately visible | Live footprints | Dual Trace A/B; record foot and stroke events |
| F2 Arsip | Decoded local media | Black by cue | Archive media |
| F3A Foto | Separate audience and gesture sources; explicit consent and verified crop before GO; arm after GO | Black by cue | Background/cropped video and four photo slots |
| F3B Replay | Valid saved F1, decoded archive, approved photos (>=1 current minimum; target 4, show partial count) | Synchronized footprint replay | Recorded trace, archive, photos |
Selecting next cue never stops running cue, recording or clears blackout. GO checks a fresh snapshot and commits at a frame boundary only on successful preparation. Stop is distinct from blackout. Manual blackout remains latched through cue change and reconnect. Resume requires explicit preflight; physical rearm separately. Privacy revocation clears audience images and pending capture; no upload.

## 4. Requirements and traceability
| ID | Outcome and acceptance | Issue |
|---|---|---|
| R01 | Reproduce legacy failures vs baseline; no hidden regression | #262 |
| R02 | One physical producer; per-role inference; fresh frame and inference independent; retry and safe reconnect | #263 |
| R03 | Typed route drafts, required reachability, atomic cue transition; supported edits affect actual runtime | #264 |
| R04 | 10-min F1 recording, deterministic replay/seek, synchronized archive, validated import/export; no silent truncation | #265 |
| R05 | Independent Floor/Canvas mapping, 4-point calibration, clean raster, output ACK, explicit hardware gate | #266 |
| R06 | Consent, exact crop verification, source generation, max four photos, revoke and stale callbacks rejected | #267 |
| R07 | Actual edge payload telemetry, bounded thumbnails, independent RAF and UI; measured performance | #268 |
| R08 | Compact hierarchy, two pinned monitors, collapsible inspector, persistent transport, actionable labels | #269 |
| R09 | Typed source/engine port affordances, drag/pan/pinch/fit, minimap, auto-layout, view/draft undo, restore preferences | #270 |
| R10 | Motion tokens/state matrix, real packet/pulse events, reduced motion, no raster fade | #271 |
| R11 | Complete requirement→test matrix, regressions, pixel evidence, fixture vs physical gate | #272 |

## 5. User flow and interaction
1. Open one workspace → add camera in graph → choose webcam/USB or HP QR → see true connection/freshness → assign role or validated port.
2. Configure engine parameters in selected inspector; simple defaults, Advanced disclosure. See actual preview for supported processor, no duplicate trackers.
3. Prepare next cue while current continues → show one blocker with action → GO commits valid transition; reject leaves current intact.
4. Record F1 in transport, see timer and save result. Stop REC separately; export/restore if storage fails. Replay uses shared clock for floor/canvas/archive; seek and speed only when supported.
5. Verify audience crop and consent, arm F3A, capture manually/gesture, inspect 0–4 slots. Revoking consent cancels pending capture and clears images.
6. Select output, calibrate and test pattern with explicit preview/hardware distinction. Blackout always reachable. Fault shows Retry and affected path, never auto-resume.
7. Save layout/role preferences; reload restores configuration, never camera permission, consent, armed capture or light.

## 6. Measurable goals (targets, not current evidence)
- Five formative operators: >=4/5 locate Add, GO, Record, Blackout and correct an input blocker without instructions.
- Prepared F1 start <=3 actions after permission; next cue select+GO <=2.
- Static copy >=40% less than original V5 under matched conditions; compare V5.1 too, keep safety labels. Header/transport visible at 1440x900 and 1280x800; compact layouts at 1024 and 390 without losing safety actions.
- 50 scripted transitions without unexpected source reopen, cue interruption or relight; 10-minute capture log; 30-minute soak.
- Reference device p95 UI input-to-feedback <=100 ms, p95 interaction frame <=24 ms, <=5% render-throughput regression vs matched V5.1 baseline. Report measurement method and device; do not invent physical capacity.

## 7. Delivery gates and non-goals
G0 (#262–#272): baseline, architecture decision records, API/state contract, supported feature matrix, UX/motion inventory, fixture spikes and acceptance plan. Technical architect signoff; unresolved risks explicit. This stage may use isolated prototypes, not new production visuals.
G1 (#273): editable Figma frames/components/variables, operator walkthrough, user review. Same green palette and one canvas.
G2 (#274): incremental runtime and reviewed UI, feature flag, CI/E2E/performance; legacy rollback available.
G3 (#275): approved Pages preview release; hardware live release additionally requires real two-surface mapping and signed rehearsal. Never deploy Vercel for this work.
Definition of Done: acceptance evidence linked to each issue, no open P0 release blocker, no mock animation labeled live, and any unsupported function clearly excluded from release claims.