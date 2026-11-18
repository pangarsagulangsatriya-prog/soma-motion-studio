# SOMA Stage Studio — Footprint-first Generative Visual PRD
**Status:** Proposed / specification only  
**Version:** 1.0 · 18 November 2026  
**Scope:** Consolidation of Footprints, Surface Composer and Projection UI; all FLOOR scenes become footprint-responsive artistic treatments. Existing runtime, hardware safety gates and older presets remain supported.

## 1. Product decision
Every FLOOR scene must answer: **what changes on the stage because a foot touched, moved, slid, pivoted, lifted, returned, or followed a path?** The output is an artistic interpretation of movement, not a decorative screen saver. Use Hydra as an optional visual synthesis/post-processing layer (feedback, oscillators, noise, displacement, keying, compositing), not as the pose detector or event source. Users should be able to produce coherent visual art with no code.

One unified app with three workspaces:
- **Compose**: source selection, scene library, scene art direction, motion mapping, media, layers, BODY A/B and FLOOR preview.
- **Map**: physical surfaces, projector routing, warp/calibration, safe output and five-point QA.
- **Perform**: cue/scene recall, global transport, previews, performer status, hold and emergency blackout.
Technical diagnostics remain accessible through an Advanced drawer.

## 2. Codebase baseline verified
- `src/footprints/scenes/sceneRegistry.ts` defines 13 named FLOOR scenes; legacy Footprints remains a distinct mode. Preserve all 13 IDs and all current default presets.
- `src/footprints/scenes/ProceduralSceneRuntime.ts` contains shared event ingestion and procedural Canvas 2D scene rendering; `SnowfallScene` remains separate.
- `src/studio/v3/FootprintsStageWorkspace.tsx` already includes source switch, video/3D inputs, FLOOR interaction, scene selector and stage preview.
- `src/studio/v3/SurfaceComposer.tsx` already handles BODY A/B/FLOOR, imported media, masks, layers, effect recipes and dual output routing.
- `src/studio/hydraConfig.ts` has Hydra settings, motion mapping and a patch template; `hydra-synth@1.4.0` is in `package.json`.
- `src/projection/ProjectionWorkspace.tsx` is a separate legacy Projection UI. Preserve its screen mapping, organic and calibration capabilities through Map/Advanced; do not create a second camera or renderer.
- The live DOM reports MP4/3D experimental source with locked physical output; do not lift that restriction as part of the UI redesign.

## 3. Shared footprint contract
Inputs: live camera, MP4 rehearsal, 3D puppet and touch simulation. Source status must explicitly distinguish **LIVE**, **REHEARSAL/MP4**, **SIMULATION**. Source changes must never silently enable physical projectors.

Canonical event packet (typed schema, versioned):
```ts
type FootMotionEvent = {
  eventId: string; sessionId: string; generation: number;
  actorId: 'A'|'B'; foot: 'left'|'right'|'unknown';
  kind: 'presence'|'contact'|'lift'|'movement'|'slide'|'pivot'|'release';
  atMs: number; x: number; y: number;
  speed: number; confidence: number; source: 'camera'|'mp4'|'puppet'|'touch';
  verified: boolean;
};
```
Coordinates normalized to calibrated FLOOR; identity A/B must remain stable through crossings, ambiguous tracks hold last confirmed identity and do not produce phantom contact. Gate genuine contact stamps behind contact verification; presence/movement may animate continuous material but must not stamp a footprint. Do **not** label `movement` as verified `slide` or `release` as verified `pivot`. Until classifiers pass validation, these are explicitly **approximation** events used only for preview or a named fallback style, not claimed as recognized physical action.

Temporal rules: each verified contact has stable eventId and exactly one stamp; stationary feet do not create duplicates; stale events do not replay after a scene switch, reconnect, blackout, or performance reset; opacity, trails and particle aging use delta time, not frame count. Two feet and two performers coexist in one engine. Recorded event fixture is reproducible with identical deterministic seed.

## 4. Shared art engine
**Pipeline:** camera/MP4/puppet/touch → single tracking + re-ID → unified floor event bus → Footprint Geometry (pressure proxy, heel/toe direction, stride line, lifetime, historical path) → Material/Behavior → Hydra/PostFX (optional) → Layer/Mask Composer → surface routing → safe physical output.

Scene schema proposal (`soma.footprint-scene.v2`):
```ts
type FootprintSceneV2 = {
  id: string; title: string; legacySceneId?: string;
  visualFamily: string; footprintMode: 'imprint'|'trace'|'negative'|'field';
  triggerMap: Record<string, { effect: string; gain: number; verifiedOnly?: boolean }>;
  material: { texture: string; scale: number; density: number; decaySec: number; seed: number };
  hydra: { enabled: boolean; style: string; distortion: number; feedback: number; blend: number; motionAmount: number };
  palette: string[]; background: string; layers: string[];
  audio: { enabled: boolean; amount: number };
  outputSurfaces: ('FLOOR'|'BODY A'|'BODY B')[];
};
```
Presets persist in local storage and support validated JSON import/export with schema versioning and migrations. Save file references with explicit unresolved-media placeholders; do not pretend blob URLs survive reload. Motion events and visual output stay decoupled, so style switching never resets source tracking.

**Basic controls visible per scene:** Scale, Intensity, Persistence, Motion Response, Palette, Seed/Variation, Audio Reactive (optional), Reset. **Advanced:** texture, shaders/Hydra graph/patch, masks, transform, feedback safety limits, blend, event-specific mapping. Provide reversible reset and history where feasible. Presets must work without editing code; experimental Hydra patch editor only in Advanced/Labs with compile/error isolation, syntax and resource safeguards.

Hydra techniques grounded in official documentation: osc, noise, shape, voronoi, modulation, blend, mult, diff, feedback. Derive parameter values from motion/event states through bounded uniforms, never start a new Hydra instance per contact. Use offscreen textures/FBO where supported, Canvas 2D/WebGL fallback. Prevent recursion explosions and GPU feedback persistence after blackout.

## 5. Scene catalog: 14 footprint-first artistic scenes
Legacy identifiers must remain valid. Titles below are proposed **art-direction labels**, not a change to canonical stored IDs. No scene may animate a contact-specific mark on inactivity. Any ambient motion must remain visually secondary to the path/body response.

| Legacy ID | Proposed visual title | Footprint behavior | Hydra / artistic treatment | Distinctive acceptance |
|---|---|---|---|---|
| `footprints` | **Trace / Palimpsest** | left/right imprint, walking line, path accumulation and erasure | monochrome multi-layer echo, luminance feedback, uneven grain | 6 real contacts → exactly 6 marks; no stamp while still |
| `snowfall` | **Compression / White Noise** | pressure-like negative impression, slowly fills | noisy white textures, granular displacement and temporal feedback | contacts remain identifiable while material recovers |
| `christmas` | **Warm Interference** | step activates warm spectral bands in pressed snow | constrained warm/cool interference, gentle scanline and trails | no independent blinking decoration dominates footsteps |
| `hanukkah` | **Eightfold Resonance** | walking creates restrained groups of eight light traces | repeated light echoes and phase offsets | retained legacy scene ID and title in compatibility mode; controls avoid reducing religious iconography to decoration |
| `spring-garden` | **Germination** | each contact grows branching marks along existing path | organic noise-driven growth, deformation, afterimage | growth begins only from actual path/contact |
| `fall-leaves` | **Displacement** | path reveals swept areas and remaining leaf silhouettes | layered luma keying, turbulence, directional flow | motion moves material, no false foot stamp |
| `the-swarm` | **Avoidance Field** | moving shoes repel particles; old paths become vacancies | Voronoi/grain and flow-field distortion | pressure/presence separation visible |
| `ectoplasmic-fog` | **Negative Memory** | footprints carve cavities in haze | temporal feedback, alpha masks, subtle luminance inversion | cavities follow actor A/B and decay predictably |
| `ground-smoke` | **Low Drift** | sliding paths drag thin smoke ribbons | displacement feedback, turbulence, directional soft noise | unverified slide labeled approximate in preview |
| `cursed-fluid` | **Viscous Archive** | contact pulls dark liquid into displaced silhouette | ripple modulation, high-viscosity feedback, limited chromatic edges | multiple contacts persist without runaway feedback |
| `living-water` | **Wave Record** | footprints create overlapping wave histories | periodic modulation, displacement and long echo | waveform depends on event timing and position |
| `fireworks` | **Impact / Fracture** | one verified contact → one restrained fractal burst | sharp noise fragmentation, geometric rays, fast decay | one-to-one burst mapping and no idle explosions |
| `pool-splash` | **Surface Rupture** | step creates rupture, directional droplets and residual rings | refraction-style displacement, short feedback | contact and movement response distinct |
| `fireflies` | **Afterglow Paths** | lights gather around walked routes, leave with decay | point-field, blend feedback, pulsing tied to activity | path-readable even with ambient particles |

Cross-scene requirements: every scene offers **Footprint visibility toggle**, **Path visibility toggle**, event debug overlay in Preview only, and one **Artistic / Literal** macro (default artistic). The Artistic macro alters representation, never event accounting. All visual palettes support stage-black rendering, monochrome and accessible contrast. Test variations must not reproduce generic fantasy/holiday clip art. Original source content remains available behind the creative styling.

## 6. UI/UX spec
Global header: project/profile, Source chip (Camera/MP4/3D), tracking A/B state, output status, global BLACKOUT. Left rail: Compose | Map | Perform, optional Labs. Compose: scene thumbnail grid; dominant Preview (BODY/FLOOR/SPLIT); selected layer/motion recipe; right Inspector collapsed or simplified by default. Scene card must preview its own treatment, not a reused generic thumbnail. Compact bottom panel can show event counters and source diagnostics only when requested.

Compose interactions:
1. Choose source once, connect or load it.
2. Choose scene; preview immediately from source/event fixture when permissible.
3. Adjust creative macros; select BODY A/B/FLOOR and optional media/mask layers.
4. Save composition/scene preset, switch freely while preview and recording remain continuous.
5. Enter Map to calibrate outputs, then Perform for live operator controls.

Map: visual four-corner handles on preview, separate BODY and FLOOR calibration, physical five-point QA, calibration profile; advanced numeric coordinates in disclosure drawer. Projection legacy Organic/Motion options become advanced effects or composition templates. Physical QA remains explicit and cannot be auto-completed from a software preview. Body masking safeguards never relax. Perform: scene/cue grid, transport, output states and master blackout; inspection is optional. Operator should not see sprint IDs or long explanatory copy.

Status semantics must be distinct: `Tracking Ready`, `Preview Ready`, `Output Disabled by Source`, `Output QA Pending`, `Live Safe`, `Blackout Command Sent`. Software command is **not** proof of optical blackout. No UI may claim projection performed when only software preview changed.

## 7. Quality, safety and non-goals
- Cold stage setup target <10 minutes only on defined tested hardware; repeat session ≤2 minutes using saved profile, with physical re-verification mandatory.
- Tracking/render separation: no growing inferencing queue; scene switch no camera/worker reinitialization. Aim 30 FPS preview on defined reference hardware; report actual render and inference FPS separately.
- Test all 14 scenes with fixed fixtures: idle 10 s, 6 contacts, walking, crossing two actors, occlusion, missing frame, source switch, reset, blackout and repeated scene toggles. No event duplication, no leaked RAF/worker/texture handles.
- Memory and performance must be bounded; adaptive quality downshifts gracefully. Hydra compile errors leave last known-good visual in preview, output safety behavior unchanged.
- Output physical restricted to approved live camera/hardware gate and independent QA, as today. Test/video/3D cannot bypass it through UI/preset/JSON import.
- Artistic visuals must remain legible on uneven physical surfaces; brightness, coverage and motion-sensitivity constraints supported.
- Non-goal: automatically accurate foot pressure from a single 2D camera, perfect 3D body projection on deforming fabric, or treating fallback movement/release as proven slide/pivot.

## 8. Validation scenarios
A. MP4 two actors crossing: actor IDs remain stable or explicitly ambiguous, no actor swap silently; preview artistic marks follow accepted contacts.  
B. 3D puppet: visual test clearly marked simulation; physical output remains locked.  
C. Live camera: stage mapping retains four-point geometry; physical QA required before live stage activation.  
D. Scene switching for 14 presets: common event bus remains active, no restart and no replay of historic events.  
E. Export/import: deterministic seed, preset version and media links validated.  
F. BLACKOUT: central command immediately masks digital visual outputs and operators verify optical blackout separately.  
G. Portrait BODY A/B vs FLOOR: compositions do not contaminate each other's raster, identity ambiguity blocks unsafe body projection.

## 9. References
- SOMA repository baseline: `src/footprints/scenes/sceneRegistry.ts`, `ProceduralSceneRuntime.ts`, `src/studio/v3/SurfaceComposer.tsx`, `src/studio/hydraConfig.ts`.
- Hydra: https://github.com/hydra-synth/hydra and https://hydra.ojack.xyz/
- Resolume composition/layer model: https://resolume.com/support/en/vocabulary
- Resolume effects model: https://www.resolume.com/support/en/effects

This PRD specifies planned work; it does not assert feature completion or production readiness.
