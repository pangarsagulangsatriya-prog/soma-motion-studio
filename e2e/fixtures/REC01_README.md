# REC-01 reproducible video inputs

Source: TensorFlow.js Models `pose-detection/test_data/pose_1.mp4` (Git blob `bb216491ddc649ec5c3457f5cea80bf0bd48c463`), https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/test_data/pose_1.mp4 . Apache-2.0 license copied in `TFJS-LICENSE`.

`rec01-dual.mp4`: scaled to 320 square, duplicated side by side; the right copy is mirrored and hue shifted. This is a **composited two-person detector fixture**, not a recording of independent performers or a crossing benchmark.

`rec01-idle.mp4`: first frame of the dual fixture held for 12 seconds, H.264 / yuv420p. This tests idle decoder/inference behavior, not natural human sway.

Generated with ffmpeg/libx264 CRF 24. These small local fixtures use the real MP4 decoder and MediaPipe Worker/CPU model in CI. Six-contact conservation and generation boundaries use separate deterministic event tests. Actual two-performer crossing and real foot-contact accuracy remain operator UAT; do not infer those gates from these fixtures.
