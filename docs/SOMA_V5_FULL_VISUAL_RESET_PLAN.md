# SOMA V5 — Full Visual Reset & Footprint-First Renderer
Status: planning / proposed, **not deployed** · 20 November 2026

## Decision
- Remove all prior *visual presets and catalogues* from product UI, including FV-01 TRACE/ECHO/RIFT, 14 artistic Legacy scenes, the 13 procedural Stage scenes, old Hydra presets (Grain/Echo/Interference/Flow), static/animated old thumbnails, and their dedicated effect inspector.
- Old visual IDs must NOT reappear behind a Legacy accordion or in Inspector/source choices. Existing MP4, webcam, tracking A/B, FootMotionEventV2, media assets, map calibration, blackout, and Perform output safety remain.
- Do not blindly delete modules used by tracking or physical output. First sever imports; then delete dead visual modules and tests only after graph inspection.
- Move saved *visual* layers to an empty composition through a versioned migration. Preserve user-uploaded MP4/image assets and unrelated Stage Profiles. Do not quietly delete original media.

## Audit of existing code
- `src/studio/v3/SceneEffectBrowser.tsx` displays 3 flagship cards + collapsed 14 Legacy and 4 effects.
- `src/studio/v3/SurfaceComposer.tsx` directly references SceneEffectBrowser, FlagshipInspector, 14 catalogue recipes, @scene:* layers, @stage:hydra, default Scene dropdown, layer choices, persistence key `soma-s64-composer-v1` and presets key `soma-s64-presets-v1`.
- `src/studio/v3/FootprintsStageWorkspace.tsx` has a separate Stage scene registry and a Hydra runtime connected to the same Track/Map surface.
- `src/footprints/scenes/sceneRegistry.ts` exports 13 procedural Stage scenes, in addition to the 14 artistic gallery scenes. A product-level reset must cover both.
- Old Visual shader files: PersistentHydraFootprintRuntime, FootprintGpuMaterialRuntime, ArtisticFootprintRuntime, scene-specific renderers, previous flagship models. Remove the visual dependencies AFTER isolating Track/Map consumers.

## Open source shortlist (no blind repo import)
1. **pixijs/pixijs (MIT)** — preferred single 2D renderer: mask-based authentic foot sole artwork, left/right independent transform, GPU Texture, compositing, video-as-texture, WebGL fallback where supported. https://github.com/pixijs/pixijs
2. **pixijs/filters (MIT)** — selective, verified Pixi v8 filters: displacement, motion blur, simplex noise, shockwave, bulge/pinch. Import only effects required for accepted art studies; verify actual package entrypoints. https://github.com/pixijs/filters
3. **glslify/glslify (MIT)** — optional shader module bundling, only when shader complexity merits build-time composition. https://github.com/glslify/glslify
4. **regl-project/regl (MIT)** — alternative lower-level renderer IF Pixi cannot meet custom ping-pong feedback and texture performance. Do not mount alongside Pixi as a second active GPU context without explicit evaluation. https://github.com/regl-project/regl
5. **hydra-synth/hydra-synth (AGPL-3.0)** — already installed. Disable from default stage while V5 is developed. Evaluate legal obligations and retain only as an isolated optional research/post FX source if a validated use case remains. https://github.com/hydra-synth/hydra-synth
6. **pmndrs/postprocessing (MIT)** — NOT adopted: depends on three.js; unwanted heavyweight 3D pipeline for 2D imprint-first FLOOR visual. https://github.com/pmndrs/postprocessing

## Renderer contract
```
Track (MP4/camera) → verified Contact/Slide/Pivot/Release + actor A/B identity
   → sole geometry / alpha mask (realistic heel, narrower arch, broad ball, five toes)
   → material shader on same texture (liquid, pressure residual, archive cut)
   → one GPU compositor with persistent frames and bounded history
   → Stage Monitor → separately authorized Map / Perform
```
- A valid, readable footprint silhouette MUST exist before any shader effect.
- A/ B and left/right have independent geometry, transform and identity through crossing.
- Foot orientation derives from available heel/toe/ankle landmarks when trustworthy; low-confidence pose falls back with visible tracking status, not a fake precise anatomical impression.
- One WebGL renderer, one scene clock, one render loop; no hidden WebGL contexts in thumbnails.
- Synthetic demo, real MP4, and live input must be clearly distinguished in UI.

## Three experimental art studies (working labels only; do not ship a catalogue)
- **Liquid imprint:** exact foot alpha silhouette, interior liquid advection, contact fills, slide stretches, pivot twists, release leaves a fading bounded residue. Outer silhouette remains legible.
- **Pressure residue:** full footprint pressure texture, foot-shaped layers (not circles), ink/granular collapse, echo tied to cadence; stationary feet do not make new stamps.
- **Archive cut:** real foot alpha reveals original archival MP4 within the sole; slide drags local sampled image, pivot tears locally; untouched surroundings stay intact.
No UI preset is published until a rendered browser demo passes review.

## Delivery & acceptance gates
| Phase | Work | Gate |
|---|---|---|
| RESET-00 | Remove all former visuals and selectors; versioned cleanup of old visual IDs, remove Legacy; disable old Hydra from Compose and Stage. | No TRACE/ECHO/RIFT, 14 Legacy, 13 Stage scene choices, or Grain/Echo/Interference/Flow in user-visible Compose; Track/MP4/Map/Perform unaffected; no old visual layer rendered after refresh. |
| ENGINE-01 | Prototype custom anatomically legible left/right sole alpha masks and landmark-based orientation. | A blind image review identifies an actual footprint within 1 second; inspect four varied rotations and two crossed performers. |
| ENGINE-02 | Spike PixiJS v8 with one renderer and real masked sprite. | Vite build, real Chromium screenshot, stable readable footprint at native scale; zero extra GPU contexts in thumbnails. |
| MATERIAL-03 | Implement Liquid Imprint only, using existing events. | Contact/Slide/Pivot/Release visibly distinct; silhouette stays legible; 6 contacts yield 6 distinct stamps, no duplicates. |
| MATERIAL-04 | Pressure Residue and Archive Cut as independent optional studies. | Three visually distinct studies, not variations of identical circles; real archive sampling, bounded feedback. |
| STUDIO-05 | Reintroduce only APPROVED visual as Composer source + contextual inspector; no gallery until approved. | Slider affects actual Stage output in under 1 frame where possible; source/thumbnail/Stage same renderer output; no decorative fake thumbnails. |
| QA-06 | MP4 two performers, occlusion, 10-min loops, blackout, projector validation. | Real browser pixel QA plus visual reference review and 30 FPS floor target on chosen laptop; tracker identity doesn't silently swap; blackout/recovery tested. |

## Visual review gate (mandatory)
- Pixel non-black tests alone DO NOT prove artistic quality. Capture golden video/stills of 1/2/6 impacts, slide, pivot, idle, decays, crossing, and body mask.
- Reject circular echoes replacing the foot, loop/ellipse scribbles replacing sole anatomy, inconsistent scale, tiny illegible stamps, fake thumbnails, large noise fields.
- Require operator to select among 2–3 material studies using the SAME authentic sole mask. Do not ship a catalogue until the material passes in real browser footage.

## Change protection
- Use staged PRs; do not merge visual changes before TypeScript/unit and real Chromium image QA pass.
- Preserve media registry, timeline and projection safety boundaries. Deleting old preset IDs in saved projects may change authored compositions; ship visible migration notice and use non-destructive backup at version migration boundary until approved.
- Shader/runtime deletion requires reference search across App, Stage, Track, Map, Perform and tests. Delete obsolete catalogue assets only after no runtime dependency remains.
