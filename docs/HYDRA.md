# SOMA Studio 06 — Hydra engine

The October 2026 SOMA integration embeds hydra-synth 1.4.0 (Olivia Jack and contributors), unmodified, as an isolated visual synthesizer. The application/source distribution uses AGPL-3.0; see LICENSE and the in-app source download. The source ZIP includes SOMA, its exact dependency lock, setup/build scripts, and the pinned Hydra source and license in vendor/hydra-synth-1.4.0. Run npm ci, npm run setup:assets, npm run build to reproduce the application. The vendor directory is a reference copy; npm installs the pinned package.

## Operator

Open Visual. Hydra starts with Teks cair. Edit Teks panggung and upload a photo below the engine controls. Sources are independent: s0 text, s1 photo, s2 the existing camera video, s3 a live body mask. Body uses actual segmentation; Hands and Mouse use landmark surfaces. Face has no silhouette mask yet. Camera sampling does not request a second stream. The Lapisan camera switch controls the background video, separately from the Hydra camera source.

Choose Mouse to rehearse without camera permission. Move quickly for stronger distortion; hold P to pinch and alter the photo mix. On Hands, separation drives repeats in Jejak berulang and Potongan. Horizontal position slightly rotates feedback. Pengaruh gerak scales these changes. When tracking is lost, motion uniforms settle toward manual values. Feedback continues to decay; no stale mask is retained. Audio still uses the existing mapping/release system.

Clean and Studio share the same renderer; neither changes sound, recording, camera, nor settings. The Visual button pauses the visual layer. Mute only affects audio. Bersihkan feedback clears both sides of each GPU buffer without stopping audio or camera. Switching visual mode retains feedback and motion ink. Only the explicit clear control resets them. Presets save all source toggles, controls and custom code; photo assets stay in local IndexedDB and need re-uploading on a different device.

## Live controls

The bar below the Studio canvas offers Mode, Warna, Jejak, Rangka, and Bersihkan. In Clean it appears above the dock when pointer/touch activity reveals controls, and stays accessible while keyboard-focused. 1–4 selects the four built-in patches; R clears ink and feedback, T toggles the live skeleton. Shortcuts are inactive in text fields, selectors, dialogs and Archive. Sound, recording and camera state are not reset by these controls. Select Senja, Bara, Lumut or Spektrum; choose Menumpuk to retain old colors and strokes through mode changes.

## Engine

One lazy-loaded Hydra instance uses makeGlobal:false, autoLoop:false, detectAudio:false, enableStreamCapture:false. Four canvas textures feed WebGL. The stage's requestAnimationFrame drives texture uploads/synthesis at up to 30 Hz; tracking and audio retain their clocks. Width is 960, height follows the viewport (240–1200). Output is copied into the stage canvas; actual detection lines render last. Hydra receives no microphone audio. It synthesizes visuals; the existing Web Audio engine synthesizes sound from the same motion frame.

The built-in patches use additive source mixing, noise/oscillator modulation, repeated coordinates, mask operations, and a ping-pong output feedback loop. Feedback is capped at 0.94. A separate bounded 1280×720 canvas retains gesture ink over the Hydra output. It supports stack, fade (0.5–30 seconds), and off; stale tracking breaks strokes, and large position jumps never create connectors. Live skeleton strokes render above the ink with a dark outline for contrast. Palette changes affect new marks and the Hydra text/image colors; existing marks keep their colors. Readability adds a clean text layer. The first three presets have different modulation/repetition behavior. Siluet × teks masks the source composition; readability can retain some text outside the mask. Set Keterbacaan to zero for strict masking.

## Advanced patch editor

One Hydra texture expression, ending in .out(o0), is parsed into an AST. Supported sources: src, solid, osc, noise, voronoi, shape, gradient. Common combine, modulation, geometry and color methods are allowlisted in src/studio/hydraPatch.ts. Numbers, texture buffers s0–s3/o0–o3, and motion.x/y/speed/pinch/spread/mix/distortion/repeat/feedback/rotation are accepted. motion values become dynamic Hydra uniforms. JavaScript functions, global objects, loops, assignments, scripts and browser APIs are rejected; this is a bounded Hydra expression editor, not the full Hydra live-coding IDE. Only o0 may be written.

The editor has 8,000-character, depth and operation limits. Parse/compile failures retain the previous compiled output. A first invalid imported shader falls back to Teks cair. Syntax is validated again during preset import. The amount, source toggles and code are stored with settings. Custom patches only use sliders/motion fields referenced by their expression. Source toggles always clear the disabled texture; old feedback may linger until reset.

## Failure and verification

WebGL/context failure produces a visible status in the Visual panel and uses the existing basic renderer. A reload retries a lost WebGL context. Camera denial never blocks Mouse rehearsal. Browser storage failures continue to use the existing asset/preset error handling.

Run npm test for motion, preset, parser and existing instrument tests. Open /tests/hydra-browser.html through the development server for actual Hydra source/pixel, compilation, reset and fallback checks. It explicitly skips GPU checks if the test browser cannot create WebGL. Physical-camera latency, multi-minute performance with audio recording and stage-projector output require testing on the performance machine; passing unit tests does not establish stage readiness.


## Studio 06.1: render continuity fix

Resizing the viewport resizes both dimensions of all four source textures explicitly. Hydra 1.4.0 only auto-detects canvas width changes; a height-only resize could exceed the existing texture allocation. The completed GPU frame is now captured immediately into a persistent 2D canvas. Display frames between 30 Hz synthesis ticks reuse that copy, so WebGL drawing-buffer disposal cannot blank the visible text. Regression tests simulate source-upload bounds and GPU buffer disposal without requiring a physical camera.

## Studio 07 · live text and memory

Existing Hydra patches, sources, modes 1–4, palette choices, sounds, audio recorder,
Studio/Clean session and original material effects remain available. New controls
round-trip through the existing preset validator; old presets gain defaults.

- **Huruf elastis**: per-character springs, local pinch attraction, hand-spread stretch.
- **Huruf pecah**: four clipped glyph pieces separate with motion energy and reform
  as energy settles. Fragment detail is limited to 900 glyphs; remaining glyphs
  still render. This is a bounded glyph breakup, not a GPU particle fluid solver.
- **Arus huruf**: local velocity and rotational forces with inertia on characters.
  This release does not advect the uploaded photo or all feedback pixels in a
  physical fluid simulation.
- **Foto dalam kata**: the uploaded photo fills the moving text mask. Text falls
  back to palette color when no photo is available. The independent photo source
  remains available alongside the masked text.
- **Gerak kata lama** keeps the previous word-based renderer.
- **Pulihkan teks** restores the text while preserving ink, tracking and audio.
- **Tahan jejak** freezes MotionInk and historical skeletons, not live synthesis,
  detection, camera, audio or recording. Release starts a new stroke.
- **Gema rangka** retains at most 12 actual detected skeleton samples. Source changes
  clear unrelated skeletons; lost tracking never creates samples. The current
  detected skeleton stays on top, with its existing fade-on-loss behavior.
- Color modes: existing palette cycle, speed, hand grouping, and aged ink tint.
  Age tint intentionally recolors old ink; other modes keep old marks intact.
- Mode/typography changes dissolve the previous composed image over live synthesis
  for 0–3 seconds, using bounded 960px canvases. This is a previous-frame dissolve,
  not two simultaneously running synth patches. Existing Hydra feedback and ink
  persist. Reset clears transition memory as well as ink and feedback.

Validation for this release: 47 Node tests, 17 new browser pixel checks, 8 existing
ink checks and 7 Hydra continuity checks. The continuity tests use a deterministic
GPU stand-in, preserving the real pipeline and glyph renderer. Cloud preview has
no WebGL context; actual GPU rendering and physical camera input still need a
rehearsal on the performance device. No new dependencies or external data uploads.
