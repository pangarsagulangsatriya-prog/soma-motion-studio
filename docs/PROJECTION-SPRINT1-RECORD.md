# SOMA Projection — Sprint 0–1 implementation record

## Audit and integration decisions

Baseline: Studio 09, commit eefe8d62bbe041d5ad59c6cc8176528e623b9002.

App already owns one CameraTracker, one video element and one MotionFrame ref.
Body mode already creates PoseLandmarker with segmentation enabled. Existing
segmentation is a 96 × 96 union for kinetic text/Hydra. Archive already has an
independent output route for archive compositions, which remains untouched.

The new Projection subscriber adds a copied 256 × 256 first-person mask only while
the workspace or its output is active. MediaPipe results close after both mask
copies and the shared motion callback. No second detector, camera stream, recorder
or audio engine is created. Source switches use the main tracker's stream reuse.
The Projection workspace hides the original UI while keeping its video, photo wall,
text state and audio session mounted. The main camera gesture stays available via
Hands; Body and Hands inference do not run simultaneously in Sprint 1.

Projection state lives alongside the existing state. Closing its workspace leaves
an open projector running. Changing source away from Body invokes the configured
tracking-loss policy. Closing the output does not stop the camera or recorder.
Focusing an open projector no longer invokes the main Studio blur mute; explicit
Mute remains available. Hidden/minimized browser behavior still needs rehearsal.

## Implemented files

| New file | Responsibility |
| --- | --- |
| src/projection/model.ts | Typed configuration; validated convex quadrilateral; 8-variable homography solve; inverse transform; Live/Hold/Blackout and tracking-loss model. |
| src/projection/renderer.ts | Full-screen WebGL silhouette shader and calibrated pattern; Canvas 2D fallback with cached inverse-map lookup and threshold LUT. |
| src/projection/channel.ts | Popup lifecycle; BroadcastChannel control/heartbeat; one acknowledged mask buffer in flight via exact-origin postMessage. |
| src/projection/useProjection.ts | Shared MotionFrame subscription, output state, local calibration presets, JSON import/export. |
| src/projection/ProjectionWorkspace.tsx | Operator UI, main camera controls, preview, transport, corner drag/keyboard/numeric editing, preset controls. |
| src/projection/ProjectionOutput.tsx | Clean canvas-only receiver; explicit fullscreen; heartbeat fail-black; no tracking lines or operator controls. |
| src/projection/projection.css | Responsive dark operator layout and isolated black projector output. |
| src/projection/ports.ts | Shape, Time, Archive, Data and Cue extension interfaces; no simulated production features. |
| tests/projection.test.ts | Eight geometry, validation, freeze, recovery and calibration-state tests. |
| tests/projection-browser.html / .tsx | Real App integration fixture with synthetic camera/pose at the hardware boundary. |
| docs/PROJECTION-MANUAL.md | Operator, Mac, webcam/HDMI, calibration, physical rehearsal and limitations. |
| scripts/build-projection-manual.py | Escaped static user-manual page and downloadable Markdown. |
| public/projection-manual.html / SOMA-PROJECTION-MANUAL.md / SOMA-PROJECTION-ENGINE.md | In-app manual and implementation/validation downloads. |

| Existing file changed | Change |
| --- | --- |
| src/App.tsx | Projection menu/workspace/hook; shared camera and device controls; projector focus policy; Studio 10 labels. |
| src/engine/types.ts | Optional projectionMask on MotionFrame. |
| src/engine/tracking.ts | Optional first-person mask copy; capture-resolution request on the existing stream. |
| src/main.tsx | bodyProjection output route; existing Archive projection query retained. |
| README.md | Entry point and Projection manual links. |
| public/soma-source.zip | Updated source offer after final build. |

## Camera to projector

1. Existing webcam stream updates App's video element.
2. Existing PoseLandmarker supplies pose and optional per-person segmentation.
3. CameraTracker copies the first mask into projectionMask and dispatches the same
   MotionFrame through App's callback, audio/visual mappers and shared ref.
4. ProjectionModel samples that ref, rejects stale/non-Body/missing/low-confidence
   data, selects live or held imagery, and applies output/recovery state.
5. The renderer fits the camera aspect into a 16:9 composition. A homography maps
   the composition's four corners to the calibrated projector quad. The fragment
   shader uses the inverse transform to sample the binary/probability mask.
6. Operator preview stays local. BroadcastChannel sends controls and heartbeat.
   A copied 64 KiB mask buffer transfers to the popup via postMessage. The receiver
   checks exact origin, opener, session, sequence and bounded mask dimensions.
   Acknowledgements bound transfers to one outstanding frame; the shared mask is
   never detached. The receiver retains only the latest image buffer.
7. Projector renders only a canvas. F/double-click requests browser fullscreen.
   Missing control heartbeat beyond 2.8 s forces black, even during Hold; live
   masks that stop arriving also fail black. A restored connection resumes state.

No Three.js or OpenCV dependency was needed for this planar pass: the WebGL shader
and a tested 3 × 3 transform perform the required operation directly. This does not
implement lens distortion correction, projector extrinsics, depth reconstruction,
3D surface warping, automatic display selection or frame-lock synchronization.

## Current limits

- One visible actor is the tested V1 scope. The first detector result has no stable
  identity through crossings. Existing multi-pose data for other modules remains.
- Body Mapping is explicitly a flat-plane prototype. Hardware registration error
  has not been measured. Moving closer/further, turning or lying down can misalign
  light with the body; no 3D accuracy claim is made.
- MediaPipe inference still runs in the existing main-thread loop. Worker migration
  is deferred to a measured shared-engine change; a separate Projection tracker
  was deliberately not introduced.
- The 256-square mask resamples the original camera frame; rendering restores its
  aspect ratio. Fine contour detail follows mask/camera resolution and lighting.
- WebGL requests 720p or 1080p output. No-WebGL fallback renders 480 × 270 and labels
  that resolution. Real camera tracking itself still needs WebGL as before.
- The operator must move the popup to the extended display and trigger fullscreen.
  Browser popup blocking is reported. Keep the operator window visible; tab
  throttling and OS sleep may trigger the fail-black watchdog.
- Sample age is measured after inference, not motion-to-photon latency. No artistic
  delay is implemented, and no technical delay is presented as an artistic effect.
- Calibration stores geometry/config only; it does not store camera permissions,
  hardware position, audio recordings, live transport or an enabled microphone.
- Source resolution changes use ideal camera constraints. Actual dimensions can
  differ and require a framing/calibration check.

## Validation, 27 October 2026

- Production TypeScript/Vite build: passed.
- Node suite: 74 passed, including eight new Projection tests and all existing
  camera/voice/photo/audio/mapping/archive/visual tests.
- Real-App browser integration: 22 checks passed with synthetic video and pose.
  They cover menu/no extra camera, default blackout, real silhouette pixels,
  transferred output/heartbeat, canvas-only Clean, Hold while camera continues,
  Blackout override, Live resume, tracking loss/reacquisition, Hold recovery,
  keyboard corner change, save/recall, Body Mapping limitation label, recording
  continuity, existing controls, workspace roundtrip, broken/restored heartbeat,
  camera stop, output close, and camera recovery.
- Existing camera performance integration: 16 checks passed, including voice
  activation, resizing, one-shot punch capture, square camera crop, recording
  continuity, Clean, tracking loss, cancel, full-wall guard, selected-slot
  replacement, one camera stream and denied microphone permission. The first
  run timed out on a synthetic replacement strike; a fresh run passed all 16
  without production changes. Timing-sensitive physical gestures still require
  rehearsal on the actual device.
- Browser fixture opens the output inside the initiating click. An earlier async
  test opening exceeded transient user activation and correctly reported popup
  blocked. Direct operator click works. Initial HTTP-preview UUID incompatibility
  was corrected with random bytes; production HTTPS supports the original API too.
- WebGL is unavailable in the cloud browser. Browser checks exercise the actual
  Canvas 2D fallback and actual cross-window transport. They do not validate the
  GPU shader, physical MediaPipe inference, Mac, webcam, HDMI or projector.
- Hardware 30 FPS/60 FPS, P95 <=150 ms, a 20-minute rehearsal and Body Mapping
  accuracy remain unmeasured. The manual contains a rehearsal checklist and
  measurement method, rather than invented results.

## Next sprint

Add Melar/Terbelah through ShapeEngine, then timestamped bounded delay/Echo through
TimeEngine. Benchmark the shared camera loop on the stage device; move inference
into one shared worker if measurements justify it. Keep technical latency and
artistic delay separate. Follow with cue recall, archive fusion and data mapping.

## Primary references

- https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js
- https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
- https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API
- https://support.apple.com/en-gb/guide/mac-help/mchlb5f905a1/mac
