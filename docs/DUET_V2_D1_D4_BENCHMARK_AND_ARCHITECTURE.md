# SOMA Duet V2 — D1–D4

Status: **experimental branch**, opt-in Video Motion Lab. The existing MP4 Pose/Gait and projector routes remain unchanged until performance and recall are verified on the actual user video.

## Input evidence
Reference file uploaded in the user conversation: `Dancers_executing_footwork_in_th…_b68ff163.mp4`.
- H.264, 640x360, 24 FPS, 192 frames, duration ≈8.04s.
- Two performers appear in the 16 reviewed stills, with frequent crossings around 0.5s, 5.5s and 7.5s.
- These 16 reviewed stills **are not an annotated ground-truth label for all 192 frames**.
- The MP4 is intentionally **not committed** to the repo. The user's file stays in their browser.

## Architecture
```
Decoded MP4 frame (native playback independent, one bitmap in flight)
   ↓
TensorFlow.js WASM Worker → MoveNet MultiPose Lightning
   ├─ D1: 384 and 512 max input dimension, full 192-frame diagnostic run
   └─ D2: bounding boxes, tracking ID, motion prediction and torso color
          → actor A/B state (visible, occluded, uncertain, lost, reacquiring)
             ↓
      D3: Crop A / Crop B + MediaPipe Pose Lite IMAGE (33 landmarks each)
             ↓
      Normalized full-video coordinates, per actor; confidence filtered
             ↓
      D4: operator-only preview + FPS/latency measurements; no actor
          guessed from absence, no physical projector permission
```

D1 uses the public TFHub MoveNet MultiPose model via the pinned TensorFlow.js package; the matching TFJS WASM runtime ships in `public/tfjs-wasm/`. If the model URL is inaccessible in a browser, the experimental Lab reports the error and preserves the existing SOMA path.

## D1 acceptance gate
Open SOMA → Footprints → Video MP4 → Lanjutan → Video Motion Lab → Duet V2.
Use the already-selected source video. Run the full 192-frame benchmark.
Outputs: 384 and 512 detected-two count, A/B observed count, Pose33 pair count, detector/total P50-P95 latency, ambiguous frames, JSON and CSV.
Target ≥95% two-person detection *among frames confirmed manually to contain two distinguishable people*; this is provisional until an annotated 192-frame ground truth exists.
No benchmark number should be entered manually.

## D2 acceptance gate
Persistent A/B assignment handles raw detector order changes, nearby performers and one missing person. Appearance score is sampled from torso RGB, plus bounding box and history. No face recognition. Ambiguous matches are marked. Reidentification after >900ms requires multiple consistent observations. Never reassign missing B to the observed A.

## D3 acceptance gate
A single MediaPipe Lite IMAGE detector runs sequentially on padded crop A/B. The 33 normalized keypoints are remapped into full frame coordinates and low-quality frames withheld. The test at 512 includes D3 when the checkbox is enabled; D1 384 measures detection alone. The model's per-crop world coordinates are local estimates and must not be treated as calibrated world positions.

## D4 acceptance gate
The native MP4 player remains independent from AI. During live preview, no queue of old frames is formed; the worker processes one ImageBitmap at a time and new decoded frames may be skipped. The benchmark and preview operate only in Video Motion Lab and do not unlock BODY/FLOOR physical outputs.
On unsupported Worker/WASM/model runtime, show a concrete error and leave the existing PoseLandmarker pipeline available.

## Release criteria
- CI (unit tests, TypeScript/Vite build, experimental browser UX, MP4 projector lock) must pass.
- Run **the actual 192-frame benchmark** on the user's target browser, inspect JSON, manually verify crossings and label switches, and compare 384/512.
- Do **not** merge into the default Stage tracking merely because synthetic tests pass.
- Select a resolution based on actual detection coverage and measured pipeline P95, then test sustained 24 FPS playback.
