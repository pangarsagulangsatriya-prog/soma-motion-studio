# SOMA Footprints S5.6.1 — Real-Time Event-to-Floor Rendering Audit

**Code status:** feature branch built on S5.6 (PR #12); requires browser/device/physical rehearsal before merge and Production deployment.

## Audit conclusion and targeted fix

The previous S5.5 `LiveFloorWorkspace.tsx` inspected the Footstep Event Engine every **170 ms** (`setInterval(tick,170)`). The renderer included a useful 900 ms unchanged-frame heartbeat, but the workspace's 170 ms inspection interval meant that a new physical contact could sit until the next polling tick before its raster was updated. Tracking itself ran separately through existing MediaPipe poses.

S5.6.1 introduces a **direct change notification** from the existing `LiveFloorTrackingEngine`. Events emitted by the engine invalidate the view and request the **next browser animation frame**, coalescing multiple left/right and A/B events into a single raster paint. The previous 170 ms foot-frame polling gate is removed. A 120 ms watchdog checks camera stream binding and ghost TTL and updates browser diagnostics; it is **not** the primary path for new contact events.

The shared SOMA Projection hook still ticks at 33 ms and applies the existing `sendArtwork` minimum transfer interval of 50 ms and control/ack backpressure. S5.6.1 does NOT eliminate those delays or video tracking inference time. The whole signal-to-light path has not been measured on stage.

### Data flow

```text
CameraTracker video frame → existing MediaPipe pose (one camera)
       ↓
StudioFootprints → GaitAnalyzer / MultiPoseGaitRouter
       ↓
LiveFloorTrackingEngine.ingest(...)
       ├── append FloorSession V3 event
       ├── update revision
       └── notify subscribers immediately (event + browser timing)
             ↓
        FloorRepaintScheduler (coalesce to next RAF)
             ↓
        FloorRenderGate (skip identical frame, heartbeat 900 ms)
             ↓
        FloorCanvas 1280×720 (same calibrated floor)
             ↓
        Existing ProjectionLink.sendArtwork
             ↓
        Same-origin Output window and frame ACK
             ↓
        Fullscreen projector display (physical video measurement needed)
```

## What is instrumented

Three timing measurements are exposed in **Live Floor → 03 / Validasi fisik & performa**:

| Browser-only metric | Definition | Limit |
| --- | --- | --- |
| Foot event → raster P50/P95 | Time from event insertion/notification to completion of drawing calibrated floor canvas | Excludes pose inference and output |
| Camera frame submitted → raster P95 | Time from CameraTracker's monotonic processing timestamp to completion of the floor raster for that frame's event | Does NOT measure camera exposure time |
| Bitmap transfer → output ACK P95 | Time from postMessage transfer to acknowledgement after drawing the bitmap into Output's canvas | ACK does NOT prove a screen refresh or photons at the stage |

The separate camera inference/pipeline P95 and remote-output FPS/P95 diagnostics remain present. Avoid adding the individual values together to claim real camera-to-projector latency: they cover overlapping/uneven samples and have different time intervals.

The exported S5.5 JSON now carries `softwareAtExport`, `realtimeSoftwareAtExport`, and `outputAckAtExport`. The physical-video latency section remains unchanged and empty until an operator records actual footage.

**Measurement provenance:**
- `CameraTracker` already sends `MotionFrame.telemetry.capturedAt` as a `performance.now()`-based frame-processing timestamp. The name is inherited and means **frame submitted**, not physical sensor exposure.
- `LiveFloorTrackingEngine` optionally receives the source frame timestamp, stores no video, and sends a transient `FloorUpdate` to current listeners only.
- `FloorRealtimeTimingWindow` retains at most 180 recently painted event samples, discards values with invalid clocks, and excludes events that only generated projector calibration test markers or occurred under revoked camera confirmation.
- `ArtworkTransferWindow` stores 180 ACK spans; closes and reopens reset these numbers.
- No real-person images/footage are saved by these measurements.

## Operator before/after benchmark

1. Use identical machine, browser, lighting, fixed camera, projector, floor and 10–15-minute stepping score for both Preview S5.6 and Preview S5.6.1.
2. Calibrate the same four camera floor corners and four projector corners, confirm both before Live.
3. Walk one performer first: quick step, slow step, stationary stance, toe pivot, slide, return, foot leaves frame, foot reappears. Repeat with two performers, crossing and reset.
4. Read **event → raster P50/P95** and **frame submitted → raster P95** in S5.6.1. S5.6 lacks the instrumented values; for quantitative before/after, use the same Chrome Performance trace on BOTH versions, mark source event/raster updates, and compare event-to-raster delays from recorded traces. Do **not** compare a new telemetry value to an invented S5.6 baseline.
5. Read **bitmap → ACK P95** with the separate SOMA Output window connected. The output must be visible and in Live, not Hold/Blackout, to gather ACK samples.
6. For physical touchdown-to-visible-projected-mark delay, film a foot landing and its projected footprint in the same shot at 120/240 fps or similar. Enter frame differences using the existing S5.5 panel. This remains the only physical delay measurement in the app.
7. Test Hold and Blackout even during rapid stepping. Change camera track and resolution to verify revocation and dark output. Close the workspace to ensure no events from the old listener are ever painted after exit.
8. Save a JSON validation report for each hardware configuration. Annotate missed contacts, false contacts and A/B identity switches.

## Evidence / limitations

### Automated regression tests

`tests/footprints-realtime-pipeline.test.ts` covers:
- Engine notifies immediately on contact/release; no notification during unchanged stationary stance; unsubscribe on teardown.
- Consecutive invalidations collapse to one next-frame raster update; cancel works, including RAF ID 0.
- Correct event-to-raster and frame-submission-to-raster calculations; sample ring bounded to 180.
- Test patterns/uncalibrated output cannot contaminate foot response measurements.
- Bitmap ACK spans are bounded, ignore failed/duplicate/out-of-order ACKs.
- Hold/Blackout, camera binding change and missing calibration cannot stream new floor art.

All previous S5.0–S5.6 tests remain in CI.

### What this sprint does not deliver

- No gait model retraining, 3D foot-contact inference, physics simulation, sensor fusion or clinical gait analysis.
- No automatic geometric correction, lens-distortion calibration or projector photometric calibration.
- No guarantee of stable two-person identity during crossing.
- No verified input-to-light milliseconds, false positive rate or centimetre accuracy.
- No actual webcam/projector automation in GitHub Actions.
- No automatic production release: upstream S5.0–S5.6 PRs remain stacked drafts.

**Next appropriate sprint:** S5.6.2 — Adaptive Gait & Contact Engine, driven by annotated video from the same rehearsal test matrix and actual false/missed contact baseline. Keep this feature in draft until event-triggered Live Floor and all three telemetry paths have been manually observed in browser.
