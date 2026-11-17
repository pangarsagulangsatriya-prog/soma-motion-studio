# SOMA / PROJECTION — D1 Detector Benchmark

**Status:** D1 runner ready; real MoveNet inference and visual ground truth review **NOT RUN**. This change is isolated from the production MediaPipe Worker and Stage sessions.

## Test dataset
- Video: `Dancers_executing_footwork_in_th…_b68ff163.mp4`
- 640 × 360, 24 FPS, 192 frames, about 8.04 s
- Two visual challenge regions: F048–071 (crossing 1), F120–151 (crossing 2)
- Performer A wears brown/khaki; performer B wears dark blue at start; these are *preliminary review anchors*, not machine-labelled ground truth

## Run
1. Open `public/qa/movenet-d1.html` through the Vite public build or a local HTTP server.
2. Prefer **192 lossless PNG frames** extracted from the MP4, in order, then select all images in the frame input. This avoids repeated browser seek and guards exact 192-frame coverage. MP4 upload also works for exploration, but random-seek accuracy varies.
3. Start benchmark with internet access (pinned TF.js JavaScript bundles load from jsDelivr; default MoveNet weights load via TFHub).
4. Use the timeline inspector to review every frame, including crossing 1 and crossing 2; set manual labels. Check that two scored pose candidates really match two distinct people rather than a false duplicate.
5. Export JSON/CSV. Compare two-visible recall (only reviewed frames), number of duplicate/false detections and p50/p95 per-resolution latency on the same stage hardware.

**Detector config:** MoveNet MULTIPOSE_LIGHTNING, `multiPoseMaxDimension=384` and `512`, `enableTracking=false`, `enableSmoothing=false`, WebGL, same input per frame. Both models receive five warmups; odd/even frames alternate inference order. Model load/PNG decoding excluded from detector timing.

**Proposed acceptance gate:** 192/192 frames successfully processed by *both real models*, >=95% two-person recall on confirmed clearly visible frames, no duplicate-person false hit, crossing segments manually reviewed. A full run without ground truth is `COMPLETE_UNREVIEWED`, not PASS. D2 A/B tracking, D3 MediaPipe Dual-33, and D4 live playback optimization remain untouched.

**Verified in this build:** JavaScript syntax valid; browser mock completed all 192 extracted frames and JSON export. The mock proves the runner and timeline work, **not** model accuracy. TensorFlow model downloads and WebGL inference have not been verified on stage hardware.

## References
- https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/src/movenet/README.md
- https://storage.googleapis.com/movenet/MoveNet.MultiPose%20Model%20Card.pdf
