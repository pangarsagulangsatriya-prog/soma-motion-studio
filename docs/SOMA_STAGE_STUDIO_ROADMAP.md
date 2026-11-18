# SOMA — Footprint-first Stage Studio Roadmap
**18 November 2026** · Status: planned · Companion: [full PRD](./SOMA_STAGE_STUDIO_FOOTPRINT_FIRST_PRD.md)

## Shipping strategy
Implement vertically through one event bus and one render pipeline. Preserve legacy `sceneRegistry` IDs, stage output gates, projector calibration, and stored presets. Work in incremental PRs with tests, preview screenshots and acceptance evidence. Never deploy a visually complete mockup as a finished motion engine.

| Sprint | Priority | Deliverables | Gate / acceptance |
|---|---|---|---|
| **UX-R1 — Navigation and Source** | P0 | Single Compose/Map/Perform shell, global Source Manager, clear tracking/preview/output statuses, redirect legacy Projection and Composer entries | A source switch leaves exactly one active tracking session; all three workspaces see same source; no route regression |
| **UX-R2 — Footprint Event Contract** | P0 | Typed versioned event bus, A/B and left/right foot IDs, stable contact eventId, idle dedupe, verified vs inferred slide/pivot, fixture recorder/replay | 6 contacts → 6 IDs/marks; 10 s stationary → 0 new stamps; crossing ambiguity holds identities |
| **UX-R3 — Unified Compose** | P0 | Scene grid, dominant BODY/FLOOR/SPLIT preview, one Layer Stack + Inspector, media library, Basic/Advanced controls, native scene thumbnails | Select/adjust/save scene without leaving Compose; preview and source stay active |
| **VIS-R1 — Hydra Visual Core** | P0 | Persistent single Hydra synth instance where supported, offscreen textures, bounded uniforms from events, blend/noise/feedback/modulate, Canvas/WebGL fallback, compile isolation | Switching styles doesn't restart tracking; no memory growth or unsafe black-screen takeover; Hydra errors recover |
| **VIS-R2 — Core Artistic Footprints** | P0 | Four styles: Trace/Palimpsest, Compression/White Noise, Negative Memory, Wave Record; artistic/literal macro, path/footprint toggle | Six-step fixed fixture matches 6 contact marks; four styles clearly distinct and stable at idle |
| **VIS-R3 — Full 14-scene Library** | P1 | Footprint art direction for all remaining 10 catalog entries, compatibility names/IDs, custom thumbnails, palette and response presets | 14/14 scenes pass event, path and lifecycle tests; no decorative idle contact marks |
| **VIS-R4 — Motion Recipe & Media** | P1 | Contact/Presence/Movement/Slide/Pivot recipe editor, verified-only guards, Hydra processing on archival media, BODY A/B/FLOOR layer masks | Trigger maps edit and persist; unverified slide/pivot not presented as verified; no cross-surface leakage |
| **MAP-R1 — Unified Mapping** | P0 | Map surface editor with drag 4 corners, existing routing/QA, calibration profiles, advanced numerics and physical blackout verification UI | BODY/FLOOR retain independent calibration and 5-point physical QA; MP4/3D never enable live output |
| **OPS-R1 — Perform & Cues** | P1 | Scene presets, cue grid, hold, status center, global blackout, restore saved stage profile with safety recheck | Scene change without restart; operator can recover from tracking loss; true stage-ready status only after QA |
| **QA-R1 — UAT & Performance** | P0 before release | Repeatable MP4/3D/live fixtures, 14-scene test matrix, GPU/CPU fallback, multi-output regression, docs, accessibility, responsive | Setup <10min / repeat ≤2min on test rig; preview target 30 FPS; no event duplication; QA evidence attached |

## Dependency graph
UX-R1 → UX-R2 → UX-R3 → VIS-R1 → VIS-R2 → VIS-R3. VIS-R4 depends on VIS-R1 plus UX-R3. MAP-R1 can run parallel after UX-R1 but must preserve hardware gates. OPS-R1 depends on UX-R3 + MAP-R1. QA-R1 signs off all branches before physical production deployment.

## Per-sprint implementation notes
### UX-R1
Refactor `src/App.tsx`, `src/studio/v3/FootprintsStageWorkspace.tsx` and navigation without deleting existing components. Treat `src/projection/ProjectionWorkspace.tsx` as legacy feature adapter. Do not create duplicate camera streams or independent source state.

### UX-R2
Adapt `FloorInteractionEngine` and adapters with a versioned facade; preserve old event IDs and existing scene runtime until migration tests pass. Add fixtures for source timestamps, generator resets, idle, cross, actor occlusion and replay.

### UX-R3
Embed `SurfaceComposer` behind Compose instead of modal/window; preserve BODY A/B layer masks, image/video media, opacity/blend, local preset migration, original operator preview. Put numeric precision controls in Advanced.

### VIS-R1
Reuse `hydra-synth` already installed and `src/studio/hydraConfig.ts`; add explicit texture-lifecycle and GPU-fallback controls. Never reinitialize a synth instance or feedback buffer for every footprint. Distortion and feedback must be capped.

### VIS-R2
Build a canonical Geometry/Material/FX test harness. Render four flagship styles from identical event fixture and make distinctions legible in grayscale as well as color.

### VIS-R3
Map all 13 existing `FLOOR_SCENE_IDS` plus legacy `footprints` to artistic style recipes. Keep existing display names/IDs via compatibility layer, use optional new titles in UI. Update snapshots and screenshot tests for all 14.

### VIS-R4
Expand `SurfaceComposer` recipes into a visible motion graph with no-code default. Separate real verified contacts from movement-based appearance changes. Keep physical projector QA separate.

### MAP-R1
Reuse `DualSurfaceRoutingPanel`, floor calibration, existing five-point QA and hardware gate. Make editing visual-first, retain numerical precision controls. Never treat software blackout command as physical evidence.

### OPS-R1
Use common global state/transport; provide preview-only mode on MP4/3D. Profile recall restores editable geometry, not permission to emit physical light. Always require re-QA.

### QA-R1
Run `npm test`, `npm run build`, browser acceptance in HTTPS, real camera + real rig UAT. Record sample device, frame stats, output status and physical QA. This roadmap itself does not verify the actual implementation.

## Definition of Done for every PR
- Identified change scope, screenshots showing before/after and source-independent unit tests.
- No duplicate listeners, camera opens, RAF loops or runaway GPU allocations.
- Existing stored presets load; broken/missing media show a recoverable warning.
- Distinguish simulation from live and output readiness from tracking readiness.
- Keyboard, monitor-size and reduced-motion checks; no misleading physical-ready assertions.
- Changelog and regression proof in PR body.

## Release rule
Documentation can land on `main` now. Production functionality ships only after code changes, automated tests, and documented operator-led physical validation.
