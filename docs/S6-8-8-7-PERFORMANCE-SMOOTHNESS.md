# SOMA S6.8.8.7 — Performance, Latency & Smoothness

Scope: MP4 Stage and advanced Video Motion Lab. Existing live camera/phone worker handling remains independent.

## P0
- **Profiler:** per-device exponential rolling timings for Pose, Hands, downstream analysis, UI overlay canvas rendering, end-to-end inference pipeline, observed frame gaps, and processed FPS.
- **Video/AI separation:** native video rendering runs freely. RequestVideoFrameCallback selects decoded frames (RAF fallback). Asynchronous ImageBitmap → MediaPipe worker avoids blocking the video UI. At most one frame in flight; late frames are dropped, never queued. Backend falls back to CPU when worker initialization or inference fails.
- **Adaptive Hands:** defaults to ~3Hz in moderate movement and ~7Hz with rapidly moving wrists, with extra backoff when pose inference becomes expensive. Lab offers Adaptive, Detail, Off. 21 landmark interpretation remains present when the detector reports a new sample.
- **Render optimization:** React live snapshots update at most ~7 FPS and contain only 64 most recent gait/semantic events; complete event records remain in engine for export. MP4 Stage Camera/BODY redraw separately at 30 FPS using native video frames; FLOOR redraws only when analysis snapshot changes.

## P1
- **Inference Worker:** CPU MediaPipe PoseLandmarker (2 people) and optional HandLandmarker (4 hands) live in a dedicated Vite module Web Worker when supported. The worker receives ImageBitmap, returns pose coordinates + timings, and closes transferred bitmap. Worker errors trigger reset and main-thread fallback. Live webcam/HP already use separate pose-worker handling; no duplicate integration.
- **Adaptive temporal smoothing:** EMA time constant contracts for fast movements to reduce delayed wrist/foot response, and grows for small stationary movement to damp jitter. The new value affects temporal joint metrics, so existing numerical baselines must be recalibrated using real footage.

## Safety and scientific limits
Semantics and floor event gates remain independent of visual overlay. MP4 cannot open physical projectors. AI inputs only sample decoded frames; 30 FPS preview does not imply 30 FPS inference. Worker support varies by browser. Labels and numerical measures come from instrumented browser runtime; no device-level benchmark claimed until real-world video tests.

## Verification
1. Open Footprints → MP4 → Lanjutan → Video Motion Lab.
2. Expand Performance Profiler while video is playing. Compare Pose, Hands, Analysis, Render, FPS, and skipped frames.
3. Toggle hand cadence Adaptive → Detail → Off and compare impact while preserving body pose.
4. Try 720p/1080p sources with two moving performers, seek repeatedly, and verify actor labels do not cross segments.
5. Confirm BODY/FLOOR physical outputs remain locked for MP4.
