# SOMA — UI/UX AUDIT & IMPLEMENTATION PLAN
Version: UX-R1 · 2026-11-18
Status: UX-R1 implementation pass delivered to main · automated and physical QA tracked separately
Scope: whole SOMA application, priority Footprints Stage (video MP4), then Projector, Perform, Labs
Evidence: four supplied MP4 UI screenshots (0.5 s, 6.1 s, crossing, source selector), connected GitHub Pages tab, code on main as of 2026-11-18.
Ownership: UI shell / presentation / interaction only. Preserve A/B identity and projector interlocks.

## Implementation progress — 2026-11-18

The code updates in UX-R1 are an incremental stage UX pass on the original engine and canvas refs, not a new app.

| Sprint | Delivered in main | Remaining explicit gate |
| --- | --- | --- |
| UX-R1.1 Baseline | Audit of four provided MP4 screenshots; initial acceptance checks in `e2e/ux-r1-stage.spec.mjs` | Capture approved visual baselines / pixel diffs during UAT |
| UX-R1.2 Stable status | Short A/B presence chips, fixed MM:SS timecode, MP4 scrub commits when released | Replay real 8s and 15s videos for timing/identity behavior |
| UX-R1.3 Focus preview | Click, keyboard or focus button to enlarge BODY/FLOOR/INPUT, Escape/Split restore; BODY/FLOOR thumbnails preserve canvas instances | Real MP4 focus replay and crossing capture |
| UX-R1.4 Source switcher | Trigger-anchored viewport collision placement, capped menu scroll, Tab wrapping, Escape focus restoration | Manual Safari/mobile device review |
| UX-R1.5 Responsive composition | Scoped CSS for desktop, tablet/mobile and short viewports; no new style architecture or engine duplicate | Capture actual 320px/390px/768px/1024px/1440px screenshots and zoom 200% |
| UX-R1.6 Context inspector | Compact stage-level tracking with optional detailed A/B/performance popover; full feature panels kept | Keyboard and screen-reader field test |
| UX-R1.7 Projector/Perform | Shorter status chrome, explicit software-only terminology, sticky Perform operator control, maintained blackout action | Projector hardware test and blackout drill remain separate |
| UX-R1.8 Micro-interaction | Focus/hover/pressed state, actor presence colors, reduced-motion CSS, minimum operator touch controls | Device testing for touch and reduced motion |
| UX-R1.9 Regression & release | New browser E2E checks for canvas persistence, focus restore, source dialog, timecode and overflow; existing broad QA retained | All checks must be green at same latest SHA; visual/performance baselines still outstanding |

Critical guardrails: `VideoPoseGaitEngine`, A/B identity tracker, persistent mask bridge and projector authorization were not modified in this UX pass. Physical output from MP4 must remain locked. All projectors must retain manual physical cut-off procedures. Failed/unfinished CI runs must never be described as passed.

Files modified:
- `src/studio/v3/FootprintsStageWorkspace.tsx`
- `src/studio/v3/FootprintsExperimentalSource.tsx`
- `src/studio/v3/FootprintsSourceSwitcher.tsx`
- `src/studio/v3/UnifiedStageConsole.tsx`
- `src/studio/v3/ux-r1-stage.css` (new, last-stage scoped presentation override)
- `tests/footprints-s0-6-1-persistent-actor-registry.test.ts` (status assertion follows new UI while preserving engine invariant)
- `e2e/ux-r1-stage.spec.mjs` (new, runs in existing Browser QA matrix)

\n## 0. Executive decision
Use a **stage-first operator workspace**: one persistent production canvas region, one compact transport, explicit preview focus, stable diagnostics, contextual controls. Do not add another wizard, a duplicate tracking engine, a second preview pipeline, or a second projector transport. UI should show what's happening, allow inspection quickly, and remain still while actor positions and counts change.

Recommended order:
1. P0 layout stability, clipping/overlays, source selector and stable live status.
2. P0 Focus Preview (BODY/FLOOR/INPUT) with fast return to split; preserve canvas mounts and software blackout.
3. P1 context-sensitive controls and feedback; streamline tracking diagnostics.
4. P1 projector/perform consistency, mobile/tablet and keyboard accessibility.
5. P2 interaction polish, persistence, optional overlays, observability and visual regression.

## 1. Evidence and diagnosis (do not treat screenshots as measured telemetry)

### Screenshot A — full three-pane MP4 view at ~0.5 seconds
- Main visual area: FLOOR and BODY evenly share broad left panel, INPUT video sits in much narrower right column.
- Status strip lists clip time, actor count, tracking status and A/B chips simultaneously. Long text consumes width and can wrap/shift between states.
- BODY/FLOOR/INPUT headings and footers repeat "video", "preview", "tracking" and safety phrases; useful facts are fragmented.
- Some stage pixels are unused by letterboxing, while text and chrome occupy multiple horizontal rows.

### Screenshot B — same layout at ~6.1 seconds / crossing
- A and B overlap in skeleton viewport, labels and bones become hard to distinguish. A/B diagnostics need a focus/inspection affordance.
- FLOOR footprints and BODY pose can be inspected together, but there is no obvious large, one-click examination for crossing.
- Actor-status text can change continuously at precisely the moment when one needs to keep watching the moving image.

### Screenshot C — source picker open
- Picker opens over the INPUT preview and partly obscures actor motion.
- Menu is tall relative to its four options; no explicit indication of the current source beyond selected row.
- It should be positioned in a dedicated floating layer anchored to the trigger, with viewport collision handling, rather than depend on arbitrary z-index increments.
- Opening selector must never pause video, reinitialize tracker or arm projector. Source change itself may reset pipeline only after deliberate selection.

### Screenshot D — skeleton mismatch / actor occlusion
- On a later frame one gray skeleton appears with A/B absent. This is an observation of a screenshot, NOT proof of a broken re-ID algorithm. Investigate source frame, mask gate and rendering mode with frame-by-frame replay; UX needs a visible "held/uncertain" state that does not claim two actors are always detected.
- FLOOR events continue to accumulate; count updates should not resize or rearrange stage.

### Architectural evidence from repository
- FootprintsStageWorkspace.tsx already owns stage, PREVIEW split/body/floor, source selector, transport and multiple canvases. Extend this component; do not fork it.
- FootprintsExperimentalSource.tsx owns MP4 transport, analysis status and actor chips. Many independent changing text strings create layout instability.
- Styles are layered in footprints-stage-workspace.css, compact-stage.css, source-switcher-layout.css, persistent-stage-workspace.css, s6-8-7-simplified-stage.css, s6-8-8-1-full-skeleton.css. Multiple grid and height overrides use !important and breakpoints. Consolidation should be incremental with documented precedence.
- FootprintsSourceSwitcher.tsx uses a locally positioned menu and document listeners; strengthen focus management and positioning.
- LiveBodyProjectionBridge and existing physical-output gates are safety boundaries. Never let UI preview / focus mode bypass them.
- Connected tab also exposes legacy instruments and Archive Studio in the DOM. Distinguish mounted-but-hidden modules from visible UI; do not delete legacy functionality blindly.

## 2. UX goals and constraints
- Frame stability: changes in timecode, status, event count, actor labels and options must not change preview panel bounds.
- Maximize usable visual canvas. No unnecessary text in the live viewport; technical detail remains available on request.
- One click to focus BODY, FLOOR or INPUT; one click/Escape to restore the workspace.
- Continuous stage: switching preview mode, opening settings, switching focus and toggling skeleton must not restart MP4 or replace canvas refs.
- Safety in every state: software BLACKOUT remains reachable in <=1 action; physical output from MP4 stays locked until existing authorization gates pass.
- No surprise new windows, autoplay audio, fullscreen API without a direct gesture, or animation that masks an error.
- Support mouse, touch, keyboard, assistive tech and reduced-motion preference.
- FPS, inference and canvas updates are decoupled from React UI changes where feasible.

## 3. Proposed information architecture

Header (global): SOMA | current workspace | Perform | Help
Sidebar (icon compact, discoverable labels): Footprints / Projector / Labs
Footprints toolbar: Tracking | Visual / source switcher / current source status
Persistent stage:
  Top transport: upload/change file | play/pause | scrub/timecode | compact status A/B
  Canvas region:
    Split default = FLOOR 50% + BODY 50% + INPUT narrower but usable
    Focus BODY / Focus FLOOR / Focus INPUT = selected surface ~70-80% of canvas region, remaining surfaces thumbnail rail (or tabs at tablet)
    Optional fullscreen/presentation preview = large software-only overlay
  Bottom transport: output health | Projector (safe route) | BLACKOUT, fixed stable size
Context inspector: docked on wide viewports; sheet/drawer on narrow screens
Advanced metrics: available inside inspector, not permanently in transport
All existing performer and effect controls remain available via Tracking/Visual or Labs, with no duplicated implementation.

## 4. Layout contract
- Desktop >=1440: stable workspace grid; stage occupies primary area. INPUT minimum usable width 280px. BODY and FLOOR preserve aspect ratio, no clipping. Split remains default.
- Laptop 1100–1439: same mental model, allow preview mode focus; no horizontal overflow. Use CSS grid minmax(0,...) and explicit min-width:0.
- Tablet 761–1099: stacked PREVIEW over INPUT or select-focused pane; no giant 390px minimum surface per item when available viewport is shorter. Bottom transport stays accessible.
- Mobile <=760: one main preview at a time, segmented BODY/FLOOR/INPUT control, thumbnail or tab access. Switcher uses an anchored/dialog sheet inside viewport. Avoid panel overlays blocking the stage or buttons.
- 320–390px and 200% zoom: no horizontal overflow; 44x44 CSS px minimum touch targets for primary controls; label/caption wrapping confined to fixed regions.
- Preview canvas uses contain for scene integrity; empty letterbox zones stay black. No arbitrary cropping of actor feet or skeleton.
- All stage surfaces maintain stable width/height during playback; avoid changing grid spans based on status text.
- Source dialogs use viewport collision and max-height with internal scroll; no overlap with click target, bottom blackout, or offscreen actions.
- Inspector open/closed changes available width predictably; capture comparison screenshots and guard against scroll jumps.

## 5. Live status contract (P0)
Replace competing variable-length sentences in top transport with a stable diagnostic strip:
  [play/pause] [time 00:00 / 00:08] [tracking: 2/2] [A: tracked|held|lost] [B: tracked|held|lost] [details]
- Fixed-width/tabular-nums timecode. Reserve min/max width for each chip. Duration changes never move canvas bounds.
- Short statuses only; extended Indonesian explanation lives in tooltip/aria-description/Details panel.
- State machine: idle, loading, analyzing, 0 detected, 1 detected, 2 detected, crossing, recovering, uncertain, error, paused, ended.
- "Terdeteksi" may be shown ONLY when actor presence genuinely visible; "Tertahan"/"Memulihkan"/"Hilang" must reflect engine state; do not derive green badges from a stale persisted identity.
- Rate-limit visual status changes independently of tracking math (e.g. 250ms updates plus urgent unsafe transitions immediately). Never throttle actual safety output decisions.
- Track count/event count in fixed-width footer fields; no unnecessary rerender per video frame.
- Present two separate concepts: source capability (MP4/demo) and projector authorization (locked). Never imply physical output is available.

## 6. Interaction specifications
### 6.1 Preview focus/expand
- Clicking stage card or keyboard Enter/Space on its explicit Focus button opens Focus Preview for BODY, FLOOR or INPUT.
- Focus layout retains three existing canvas elements / refs. Do not remount engine, reset MP4, lose optical flow mask or drop accumulated floor events.
- Esc, button "Kembali ke Split" and visible close action restore previous view.
- Focus switching BODY <-> FLOOR <-> INPUT stays within one component with stable source clock.
- Provide Fit / 1:1 zoom for diagnostic inspection (not projector scale), optional pan when zoom >1; clearly label software preview.
- Two levels: Focus (in-workspace enlargement) and Fullscreen (optional user-gesture-only). First ship Focus only; native fullscreen a separate QA gate.
- INPUT may show skeleton ON/OFF and labels; BODY/FLOOR overlays independent of INPUT; do not copy raw detections to physical output.
- BODY actor A/B legend stays pinned. Crossing warning appears only on uncertain frames and disappears deterministically; allow overlay guides toggle.

### 6.2 Stable file transport
- Keep a single upload/replace control, single play/pause and scrubber, one timecode.
- Seek interaction: show scrub preview while dragging; on release execute existing seek/reset path once. No unbounded inference queue and no repeated full resets on each pointer pixel.
- Disabled loading controls expose why; completed clip loops according to existing behavior unless an explicit setting changes.
- Timings use monospace with tabular numerals; buttons do not change width for Pause/Play.

### 6.3 Source picker
- One source switcher for Webcam, Phone, MP4, Simulator; selected source visibly marked.
- Floating overlay/sheet in appropriate layer with collision detection, max-height: min(available height, ~480px), internal scroll, safe area insets.
- Escape closes and restores trigger focus; outside click closes; focus must stay managed; selected item keyboard reachable.
- When a source is chosen: explicit pending state and source-specific readiness; keep blackout safety and existing source-switch reset semantics.
- Switching between sources preserves composition settings, not stale actor identity.

### 6.4 Context and micro-feedback
- Status changes: subtle 120–180ms color fade; no moving badges, pulse only for loading; prefers-reduced-motion disables transitions.
- Button pressed/hover/focus states consistent with existing palette; no layout-changing font weight.
- Avoid toast storms during per-frame tracking; critical errors persist until fixed/dismissed, benign details live in inspector.
- Empty/blocked preview: short one-line actionable explanation, detailed troubleshooting one click away.
- Tooltips show keyboard shortcuts and full truncated labels.
- Skeleton ON/OFF: immediate feedback confined to INPUT overlay and explicit indication that BODY safety continues separately.
- BLACKOUT: a single click, immediate visual confirmation without interrupting the action; do not require a modal for emergency blackout.

### 6.5 Operator and lab separation
- Tracking inspector: performer count, A/B state, floor calibration, QA; progressive disclosure.
- Visual inspector: forms, palettes, effects and archive recipes; preview still visible.
- Projector workspace: dedicated output controls, calibration and WYSIWYG; explicit differentiation of software preview and hardware connection.
- Perform mode: reduced chrome, large cue/navigation and an always accessible blackout.
- Labs: secondary search/discovery, return to Footprints with source state preserved where permitted.

## 7. Design tokens (initial proposals; validate with screenshots)
- Spacing scale: 4/8/12/16/24px; card gap 8px desktop / 6px compact.
- Toolbar control height: 36–40px desktop, >=44px touch in compact/mobile.
- One main type scale: 11px utility / 12–13px controls / 14px critical status / 20px title; avoid >3 competing type scales on live stage.
- Label length: <=20 visible characters in compact controls when possible; full text in accessible label and tooltip.
- Background nearly black (#0b100c), muted green surfaces, actor A light lime and actor B cyan as existing; warnings warm amber; blackout red distinct.
- Contrast: WCAG AA where feasible, focus indicator >=2px and high contrast against all panel surfaces.
- Status colors must be paired with label/icon, not color-only.
- Transitions only opacity/background/transform; never animate layout width/height of active preview during tracking.

## 8. Technical implementation boundaries
Primary files:
- src/studio/v3/FootprintsStageWorkspace.tsx — preview focus state, card actions, status contract, keyboard and inspector routing
- src/studio/v3/FootprintsExperimentalSource.tsx — compact MP4 status, seek and timecode presentation
- src/studio/v3/FootprintsSourceSwitcher.tsx — stable focus/overlay/source menu
- src/studio/v3/persistent-stage-workspace.css — preview layout baseline
- src/studio/v3/s6-8-7-simplified-stage.css, compact-stage.css, source-switcher.css — CSS consolidation and responsive styles
- src/studio/v3/FootprintsFlowInspector.tsx — concise controls and detail drawers
- src/studio/v3/workspace-navigation.css, projector-shell.css — consistent global navigation
- src/studio/v3/stagePreviewModel.ts — focus modes and persistence contract
- e2e/soma-responsive.spec.mjs, e2e/simplified-stage.spec.mjs, e2e/source-flow.spec.mjs, e2e/identity-recovery.spec.mjs, e2e/projector-wysiwyg.spec.mjs — regression tests

Protected:
- src/stage/VideoPoseGaitEngine.ts
- src/stage/moveNetIdentityTracker.ts
- src/stage/persistentActorRegistry.ts
- src/stage/persistentBodyMaskEngine.ts
- src/stage/liveBodyProjectionBridge.ts
- projector authorization / output transports.
Any changes to these files require a separately reviewed feature with safety tests, not a styling sprint.

No additional canvas engine, independent MP4 player, duplicate status registry, cloned BODY/FLOOR rendering pipeline, or additional projector approval path.

## 9. Sprint roadmap with acceptance gates

### UX-R1.1 — Baseline & layout regression (P0)
Work: capture reference screenshots by viewport (1440/1366/1024/768/390), fixed videos at 0.5 / 6.1 / crossing / 7.5s, document element bounds and text overflow. Record a test fixture in repo with non-sensitive footage or synthetic frames.
Pass: zero clipped control labels, no horizontal overflow, no overlapping stage control and source popover; deterministic geometry baseline.

### UX-R1.2 — Stable transport and A/B status (P0)
Work: status view model, reserved widths for chips/timecode, condensed long strings, progress/seek contract, details accessible on demand.
Pass: pixel bounds of preview canvases unchanged while 0→1→2→crossing→recovered; no misleading detection chip; emergency blackout accessible throughout.

### UX-R1.3 — Three-pane focus preview (P0)
Work: BODY/FLOOR/INPUT click-to-focus, back-to-Split, zoom/fit, keyboard and Escape; preserve mounted canvases.
Pass: on focus transitions, current videoTime monotonic, video element and canvas identity unchanged; output remains software-only for MP4; floor events not reset.

### UX-R1.4 — Source switcher / overlay system (P0)
Work: collision-safe layer, dialog/sheet on mobile, focus and pointer handling, transitions; remove arbitrary z-index patchwork.
Pass: source picker always reachable at 320/390/768/1024/1440, with no overlay interception even if advanced controls open; Escape returns focus.

### UX-R1.5 — Responsive composition & CSS consolidation (P1)
Work: simplify conflicting grid overrides in the existing stylesheets, define breakpoint contracts, aspect ratios and stable reserved regions. No forced massive min-height on short/mobile screens.
Pass: tests at 320/390/768/1024/1366/1440, 200% zoom, landscape tablet, no offscreen blackout or interrupted video.

### UX-R1.6 — Contextual Tracking / Visual inspector (P1)
Work: progressive disclosure; simple status on stage, detailed metrics in inspector; fixed typography, measured labels, state-specific guidance.
Pass: <=1 click to full tracking details; no duplicate calibration/preview controls; UI focus restored when closing.

### UX-R1.7 — Projector and Perform consistency (P1)
Work: unify output naming, connected / hold / blackout / locked states, operator cues, stable nav, safe feedback.
Pass: MP4 source never authorizes hardware; blackout visible in every mode; projector popup never opens inadvertently; physical QA remains required.

### UX-R1.8 — Micro-interactions, polish and accessibility (P2)
Work: subtle hover/focus/pressed/drag feedback; reduced motion; accessible headings and dialog labels; context tooltips.
Pass: keyboard-only happy path, screenreader labels, touch hit targets, reduced-motion screenshots, no UI jump during tracking.

### UX-R1.9 — Visual regression, performance & release gate (P0 release)
Work: E2E snapshot matrix (all viewport/state combinations), a narrow browser trace for 2-person crossing, layout-shift and render telemetry, CI workflow coverage at same commit SHA.
Pass:
- npm test, npm run build, all browser QA green at HEAD;
- no horizontal overflow at defined widths;
- preview card bounding boxes stable for all actor state changes (tolerance <=2 CSS px);
- focus/zoom retains video/canvas refs and A/B identities;
- no physical output opened by MP4/simulator;
- no unacceptable change to frame processing latency compared to baseline (record before/after; reject sustained >10% degradation);
- source menu and blackout usable during crossing and track recovery;
- manual user acceptance of recorded video and actual projection separately.

## 10. QA scenarios (include tests, do not merely document)
1. MP4 load → play → pause → scrub → focus BODY → focus INPUT → Split, all without remount.
2. A and B apart → overlap → one occluded → separate → both reacquire; status chips match engine truth; UI layout unchanged.
3. BODY/FLOOR/INPUT split while replay continues; validate foot and pose remain frame-aligned.
4. Source selector opens while video plays; menu intercepts no wrong target; select same source without unintended reset.
5. Source switch MP4↔webcam↔phone↔simulator; no stale skeleton, no accidental hardware authorization.
6. Tracking and Visual inspector alternate; keyboard focus restored, video never resets.
7. 320/390 mobile, tablet landscape and desktop; video fully visible in contain canvas; long Indonesian labels safe.
8. Blackout during popup, focus mode, Perform and Projector; software command immediate; hardware interlocks unchanged.
9. Reduced-motion, high-contrast and 200% browser zoom; no clipped controls.
10. Browser QA passes alongside Verify and Pages for the exact same commit SHA.
11. MP4 safety cannot be bypassed by Focus/fullscreen or Labs.
12. Layout shift and paint performance recorded on real 8s clip and >15s clip.

## 11. Interaction patterns: recommendation vs rejection
Adopt:
- Single-click Focus Preview, persistent split state, anchored source picker, compact A/B chips, hover details, command feedback, fixed geometry.
- Optional diagnostic overlays for IDs/keypoints/bounds only in software preview.

Reject:
- Auto-opening windows when status changes.
- Every camera/footprint panel turning into a modal.
- Animations on skeleton paths that conceal identity glitches.
- Repeated banner/toast alerts from every inference frame.
- Hidden BLACKOUT, unsafe hover-only actions, modal confirmation before emergency blackout.
- Any change that silently unlocks MP4 hardware output.

## 12. Definition of done / handoff
Each sprint produces: short issue checklist, implementation diff, before/after screenshots at all four primary breakpoints, unit tests, browser E2E, QA logs, regression note and one commit/PR. Prefer small PRs; only merge after green checks. Incomplete items remain explicit. UX-R1.1 through UX-R1.4 are the first implementation batch. Do not begin a full visual rebrand; maintain SOMA's quiet green-on-black identity and tactile live-performance usage.

## 13. Current audit limits
- Evidence is four still screenshots, current connected tab's accessible text, and repository code. No measured layout shifts, CPU/FPS comparisons, or interactive browser clicks performed during this audit.
- Screenshot with one gray skeleton requires replay instrumentation; cannot conclude identity pipeline is wrong from one frame.
- Projector/Perform/Labs recommendation is code-informed; deeper interaction audits of those modes remain implementation discovery tasks.
- This PLAN.md does not claim UI fixes are shipped. No engine or visual CSS is modified by creating it.
