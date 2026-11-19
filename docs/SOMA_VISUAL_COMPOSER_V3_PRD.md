# SOMA — Visual Composer V3
## PRD & Technical Specification · FLOOR Footprints + LEG Projection Mapping
Status: Proposed / documentation only
Date: 2026-11-20
Target: existing SOMA React 19 + TypeScript + Vite + MediaPipe + Hydra 1.4.0
Scope: Track → Compose → Map → Perform; implementation must remain within existing application.

## 0. Evidence, assumptions, and boundaries
- Reviewed current SOMA `package.json` and `README.md` on the repository default branch. Hydra-synth 1.4.0 is **already installed**. Do not blindly install a second Hydra instance.
- Screenshots (19 November 2026) show 3 top preview panels (FLOOR / BODY MASK / INPUT), an additional large black Stage Preview below, Scene Library cards, inspector with Hydra ready / Advanced / Blend / Effect Recipe, and Test Contact/Slide/Pivot. Source is disconnected in screenshots.
- Existing README documents shared tracking, projection, calibration and body masking, but does not establish physical projector accuracy or reliable dual performer identity in all scenes. Verify running code, not README alone.
- This PRD does **not** assert that the additional libraries have been integrated or stage-tested. No engine or existing feature is replaced as a side effect of this document.
- Two output surfaces: FLOOR = fixed world-space stage plane; LEG = dynamic deforming region, from upper thigh to foot, of performers A/B. Body mapping needs calibration in projector viewpoint, beyond floor homography.

## 1. Product goal
One operator can create and preview real footprints, author generative treatments, route to FLOOR and/or LEG, calibrate two projectors, and run a safe performance without leaving SOMA.
Primary journey: open Compose → choose Footprints → simulate Contact → tune footprint shape / timing → choose FLOOR or LEG → Map calibration → Perform projector output.
Keep source switching in Track; Compose never opens a second camera or second identity-tracking pipeline.

## 2. Decisions
1. Preserve existing top-level tabs: **Track | Compose | Map | Perform**. Use **Visual Composer** as the module's descriptive name, not a new navigation tab.
2. Hydra = optional *texture/effects processor*; deterministic footprint geometry and physical stage placement must run independently of Hydra.
3. Three.js/WebGL = compositing engine and render-to-texture pipeline, evaluated behind `RenderBackend`; retain existing Canvas2D fallback for unsupported GPU.
4. No Kinect required for FLOOR. LEG V1 uses 2D calibrated pose contours with conservative masks; 3D/depth support is a subsequent optional phase.
5. Design for two independent output streams `FLOOR` and `LEG`, never mirror the same warped frame into both.
6. One stable `ContactEvent` contract for real video, MP4, simulation, and 3D input.

## 3. Reference repositories and integration policy
| Repo | Intended use | Integration level | Notes |
|---|---|---|---|
| https://github.com/hydra-synth/hydra-synth | existing embedded Hydra for visual textures, feedback, modulation | Existing dependency; audit and wrap | AGPL-3.0; review license obligations; use non-global API and isolate canvas; control effect lifetime and dispose |
| https://github.com/almerito/nodemaru | reference for node-based visual UI, preview and patches | **Design reference only** | AGPL-3.0; no source code copying until legal/license compatibility reviewed; full node graph should be advanced, not default |
| https://github.com/niccolofanton/image-trail-shader | ping-pong render targets and temporal decay | Adapt algorithm or selectively import with audit | MIT; overall feedback trail is different from per-footprint lifespan |
| https://github.com/bhoffmann93/three-projection-mapper | multi-surface warp, corner pin, polygon mask, projector window | Experimental adapter/prototype only | Upstream explicitly marks API as unstable / not production-ready. Pin commit, validate export and fallback |
| https://github.com/linalopes/tracking-body | dynamic silhouette / body-tracking study | Reference only | Review dependency and license before reuse; SOMA owns pose data |
| https://github.com/brandon-stargrave/hydra-mcp | optional agent-assisted Hydra sketch prototyping | External development tool, not runtime | Local service/extension required; separate access/security review |

Never import six entire apps wholesale. Start with adapters and legal/security review. Check exact license files, dependency tree, vulnerabilities, maintainer activity and browser compatibility before copying code or adding runtime packages. Do not expose arbitrary user-provided JavaScript to Hydra runtime.

## 4. Information architecture / interaction model
### Main Compose layout
- Header: source chip and actionable state (Connected / Offline Demo), mapping readiness, output status, persistent Blackout.
- **One** central Stage Monitor; view switch `FLOOR | LEG A | LEG B | SPLIT | CAMERA`. Remove duplicated large Stage Preview and repeated top preview. Resizable monitor with saved proportions and layouts.
- Left: Scene Library + Layers + Media as compact, resizable rail; searchable / categorized by `Footprint`, `Trail`, `Mask`, `Archive`, `Generative`.
- Right: **Inspector follows selection**. Tabs `Shape | Motion | Look | Timing | Output` (only relevant controls). Avoid simultaneously expanding Hydra, Advanced, Effects, and Presets.
- Bottom: single simulation strip `Step L / Step R / Slide / Pivot / Crossing / Reset`, timeline of events, FPS/latency compact status.
- Camera not active: visual demo events work; buttons that depend on live camera disabled with understandable reason; output readiness separately evaluated.
- All preview modes show a real frame/test card instead of silent empty black when no input exists, with a single `Try simulation` action.
- Presets cover `Bareprint`, `Dust`, `Contour`, `Residue`, `Erase`; every library card should render a live or cached honest thumbnail of its effect, not identical abstract placeholders.

### Default operator flow
1. Open Compose and immediately see simulation scene with one footprint and relevant controls.
2. Select a scene; stage view changes immediately; visible selected state.
3. Trigger Step L/R, Slide, Pivot; event status and visual update together.
4. Select footprint object or layer → edit shape/color/opacity/timing → preview synchronizes.
5. Set output routing FLOOR, LEG A, LEG B. Each surface has its own mask and preview.
6. Open Map and run calibration wizard in-place; return without losing draft.
7. Open Perform; rehearsal/live mode; output window on designated second display; Blackout always active.

## 5. Domain model / event contracts
```ts
type PerformerId = "A" | "B";
type FootSide = "left" | "right";
type ContactKind = "contact" | "release" | "slide" | "pivot";
type SurfaceTarget = "FLOOR" | "LEG_A" | "LEG_B";

interface FootEvent {
  id: string; tMs: number; performerId: PerformerId; foot: FootSide;
  kind: ContactKind; confidence: number; // 0..1
  stagePositionM: {x:number;y:number}; // measured in floor-local meters
  headingRad: number; contactArea?: number; pressureProxy?: number;
  trackingState: "tracked" | "estimated" | "lost";
}
interface FootprintInstance {
  eventId: string; performerId: PerformerId; foot: FootSide;
  positionM: {x:number;y:number}; headingRad:number;
  lengthM:number; widthM:number; createdAtMs:number;
  holdMs:number; decayMs:number; opacity:number; assetId:string;
}
interface VisualLayer {
  id:string; name:string; kind:"footprint"|"hydra"|"media"|"mask"|"trail";
  target:SurfaceTarget[]; visible:boolean; opacity:number;
  blend:"normal"|"add"|"screen"|"multiply";
  params:Record<string,unknown>;
}
interface CalibrationProfile {
  version:number; deviceFingerprint?:string;
  floor: {cameraToStage:number[]; stageToProjector:number[]; valid:boolean};
  legA?: {model:string; calibrationId:string; valid:boolean};
  legB?: {model:string; calibrationId:string; valid:boolean};
  projectorIds:{floor?:string; leg?:string};
}
```
Event idempotency: unique `eventId`, only create an imprint once on contact transition. Slide/pivot update or transform same contact footprint; no duplicate imprint per inference frame. Preserve performer/foot identity when crossing is uncertain; freeze or fade instead of silently switching A/B.

## 6. Footprint geometry & rendering
- Supply genuine directional left/right sole path assets (heel, arch, toes), not two arbitrary ellipses. Import SVG and transparent PNG with alpha, normalized local-foot coordinates. Optional geometric procedural modes: contour, pressure zones, fragmented grains.
- Defaults calibrated to measured performer shoe/foot dimensions; stage-space length/width in meters; preview overlay 1m reference grid.
- Editing: Length 0.15–0.40m; width 0.06–0.20m, rotation -180..180°, opacity 0..1, color, stroke/feather, texture scale, grain and seed. Ranges are editor limits, not anatomical truth.
- Each footprint has independent lifecycle `appear → hold → decay → clear`, with a configurable easing curve. Performance: render only active footprints, cap instances and texture memory, recycle buffers.
- Detected `contact`: stamp static footprint at stage position. `release`: leave at original world position. `slide`: smear from last sampled contact point with threshold spacing, capped by distance/time. `pivot`: rotate/accumulate heel- or toe-anchored wear depending on available landmarks.
- Distinguish visually between `contact pressure proxy` and actual load measurement; regular RGB pose does not measure real plantar pressure.
- Hydra receives footprint mask/texture or custom Canvas source, never owns stage coordinates or event registration.
- The Trail Shader is a post-processing effect for persistence; it cannot replace timed per-print records.
- Maintain identical output resolution and timing between preview and projector within performance budget; choose offscreen render targets and avoid canvas reinitialization during scene changes.

## 7. LEG mapping specification (upper thigh → toes)
- Region per performer and leg: crop boundary starts at selected upper-thigh ratio, excludes torso, hands, head. Dynamic polygons follow hip/knee/ankle/heel/toe, optionally widened by segmented body mask.
- Controls: source actor A/B, left/right/both legs, upper-thigh cutoff, mask dilation/erosion, softness, pose smoothing, safe fade-on-loss, anchor (hip / knee / ankle / locked stage reference).
- Surface modes: `Leg silhouette` (2D projected mask), `Contour band` (rings/stripes between joints), `Tracked texture` (UV approximately along segments). Mask must update frame by frame.
- Two-camera geometry warning: FLOOR homography maps one fixed plane and **cannot** keep graphics attached to moving thighs/betis. Add projector-view camera calibration or a 3D/depth model for higher-accuracy moving-surface projection. For a single RGB camera, show accuracy limitation and use conservative 2D approximation.
- Occlusion and A/B crossing: retain last reliable mask briefly then fade; never project a guessed swapped body ID at full intensity. Maintain an operator manual override.
- Initial safety: use white-on-black test patterns, no illumination above thigh boundary where possible, and easy Blackout. Track latency as motion-to-photon measurement on physical equipment.

## 8. Mapping and outputs
- FLOOR path: camera pixel → calibrated stage coordinate (meters) → projector pixels. Four-corner calibration only for flat floor. Store matrices per stage/device profile; residual reprojection error displayed.
- LEG path: tracking → dynamic body geometry → projector-view calibration/warp → masked output. Each projector has a distinct view transform.
- Stage profile captures real floor bounds (default 5×5m), projector native resolution, orientation, test grid, warp points, mapping type, and output screen ID.
- In browser: separate fullscreen projector window per target; `WindowSync` via BroadcastChannel/postMessage with reconnect state; require actual user click to open window/fullscreen. Avoid claiming browser can silently select/move to a display.
- `three-projection-mapper`: spike only, feature flag, exact commit pin; implement stable internal `WarpAdapter` fallback using existing homography pipeline. Do not create API dependency on unstable upstream.
- State machine: `UNCONFIGURED → PREVIEW → CALIBRATED → ARMED → LIVE`; on tracking loss, mapping invalid or window disconnect: freeze/fade per policy and offer Blackout. Header must show which output is ready; "Hydra ready" is NOT "Stage ready".

## 9. Software architecture
```
Track sources (camera | video | simulation | 3D)
  → SharedPoseFrame → ContactEventNormalizer
  → FootprintStore (world-space instances)
  → ComposeStore (scene/layer/target/preset)
  → GeometryRenderer (Canvas2D or Three/WebGL)
  → HydraEffectAdapter (optional)
  → CompositeRenderTargets (FLOOR, LEG A/B)
  → MapAdapters (floor warp, dynamic leg mask)
  → OutputController (preview, independent projector windows, Blackout)
```
Suggested new module boundaries (confirm actual source tree before edits):
`src/compose/VisualComposer.tsx`,
`src/compose/StageMonitor.tsx`,
`src/compose/SceneLibrary.tsx`,
`src/compose/Inspector.tsx`,
`src/compose/useComposeStore.ts`,
`src/engine/footprints/contracts.ts`,
`src/engine/footprints/contact-normalizer.ts`,
`src/engine/footprints/footprint-store.ts`,
`src/engine/footprints/footprint-renderer.ts`,
`src/engine/effects/hydra-adapter.ts`,
`src/engine/effects/trail-pass.ts`,
`src/engine/projection/warp-adapter.ts`,
`src/engine/projection/leg-mask.ts`,
`src/engine/projection/output-controller.ts`.
Names are proposals, not verified current paths. Extend existing engine modules rather than duplicate them.
Prefer explicit typed reducers with bounded undo/redo for scene edits. Store draft separately from applied live preset; do not change live output when calibrating a draft.
Persist scene presets with versioned schema and validation; provide import/export JSON with safe migrations and limits. Do not persist camera permission or projector fullscreen state.

## 10. Performance and quality targets (acceptance targets, not measured results)
- 1920×1080 preview + independent projector surface on target laptop: aim 30 fps steady; measure frame time p50/p95.
- Interactive control response ≤100ms typical under simulation; end-to-end tracking and projector latency to be benchmarked physically; no fabricated latency guarantees.
- No duplicate stamps during planted foot held ≥3s; zero A/B swaps silently accepted in crossing test fixture.
- Repeated scene switching 100 times: no rising active WebGL contexts, workers or event listeners; no stuck black monitor.
- 6 contact events produce 6 footprints; slide and pivot modify appropriate existing footprint.
- No phantom prints when lost/low confidence; test both left/right shoe textures and axis conventions.
- Mapping test grid on 5×5m floor; collect residual error at ≥9 surveyed points. Choose acceptable tolerance only after device test.
- LEG output follows thigh-to-foot polygons for both actors during turn and crossing; uncertain tracking shows explicit recovery behavior.
- Camera offline: demo view works; physically live controls report unavailable clearly.
- Dedicated display drop/reconnect and blackout tested on real projector hardware.
- Desktop 1440/1280 and laptop; 390px narrow view: no inaccessible inspector, scroll traps, offscreen commands; keyboard, focus, aria and reduced-motion respected.

## 11. Phased delivery with gates
### VC-00 — Source audit / dependency and license gates
Map existing Hydra initialization, scene contracts, stage monitor, mapper, projector output, package-lock; establish visual regressions, license compatibility and baseline builds. **Gate:** reproducible current build/tests, documented ownership of each frame and state, approved licensing.

### VC-01 — One Stage Monitor and UI hierarchy
Eliminate duplicate previews, resizable single monitor, compact left scene/layer/media rail, contextual inspector, local saved layouts. **Gate:** view switching does not reset scene or camera; no blank preview in demo; responsive accessible controls.

### VC-02 — Footprint Core + Geometry Composer
Implement separate left/right geometry, stage-scale dimensions, contact transition stamping, hold/decay, simulation test strip. **Gate:** 6 taps = 6 correctly located and oriented prints, stationary foot produces no extras.

### VC-03 — Hydra Effects + Trails
Audit already-installed Hydra, expose safe effect recipes and parameters; isolated runtime, shader feedback buffer and cleanup; fallback texture path. **Gate:** texture updates live, layer changes preserve tracker, repeated switch has no leaks.

### VC-04 — Layer graph, presets and media
Layer ordering/blends/target routing, import/export, true effect thumbnails, contextual inspector, undo/redo and reset. **Gate:** project reload returns exact composition and output routing.

### VC-05 — FLOOR Map adapter
Camera-to-stage scale, four points, correction grid/testcard, profile persistence, projectable floor texture. **Gate:** simulated and live events land at stable world positions after camera/projector calibration; residuals measured.

### VC-06 — LEG mask and body output
Implement independent masks per A/B, thigh cutoff, segment confidence/occlusion, scene binding; calibrate projector-view. **Gate:** mask never lights head or hands in controlled test; crossing uncertainty fades safely; real projector test mandatory.

### VC-07 — Perform e2e
Two output routing, windows/display, staged apply, blackout/recovery, logging/QA and rehearsal scripts. **Gate:** Track → Compose → Map → Perform in one session with both projector outputs; hardware results documented.

## 12. Test matrix / fixtures
- `simulation-two-actors-crossing`: actor A/B, left/right distinct shoe shape, 6 steps, turn, slide, pivot, 2s occlusion, reacquisition.
- `mp4-fast-footwork`: performance-stage video input at original frame timestamps, including actor overlap and stops.
- `offline-demo`: no camera permission, no second display; all visual edit controls remain testable.
- `projector-disconnect`: display disappears, reopen window, recover profile or Blackout; no false 'live' status.
- `leg-boundary`: lifted leg, rotating torso, hands passing thighs, crossing, severe occlusion.
- `calibration`: each output has independently saved transform; moving projector marks profile stale.

## 13. MCP / design workflow
- **Figma MCP/connector (recommended for design handoff):** construct editable wireframe/components, Stage Monitor, Scene cards, context inspector, state variants, and generate implementation-ready specs. Its availability does not itself alter the running SOMA. Use Figma design-to-code skill before tools that read design context.
- **GitHub connector/MCP:** source inspection, branch, PR, commits and CI; maintain implementation traceability per VC milestone.
- **hydra-mcp:** optional external local development service for assisting Hydra sketch authoring and inspection, not a substitute for in-app Compose; validate its security model before connection.
- No MCP is needed by end users to operate SOMA. Production interface must remain functional standalone from GitHub Pages/HTTPS after assets are built.

## 14. Non-goals for V3
- Building an unlimited generic TouchDesigner clone or default spaghetti node UI.
- Copying entire Nodemaru/other application into SOMA.
- Claiming one 2D homography projects perfectly onto 3D moving legs.
- Starting cameras/microphones without user gesture.
- Moving stage lights above upper thigh for mapping calibration.
- Rewriting stable tracking for aesthetic redesign.

## 15. Definition of Done
One source of tracking truth; one central monitor; genuine editable footprint visual; deterministic contact stamping and timed decay; optional Hydra recipes; separate FLOOR and LEG paths; independently calibrated hardware outputs; visible errors and safe Blackout; no duplicate camera/preview, validated presets, measured performance, staged legal review, and documented physical projection QA.

## Sources
- SOMA package.json + README.md (repository default branch, fetched 2026-11-20)
- https://github.com/hydra-synth/hydra-synth
- https://github.com/almerito/nodemaru
- https://github.com/niccolofanton/image-trail-shader
- https://github.com/bhoffmann93/three-projection-mapper
- https://github.com/linalopes/tracking-body
- https://github.com/brandon-stargrave/hydra-mcp
