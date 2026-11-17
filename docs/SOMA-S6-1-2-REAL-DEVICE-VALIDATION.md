# SOMA S6.1.2 — Real-Device Validation

**Status:** Draft PR #29 stacked on S6.1.1 PR #28 and S6.0/S6.1 PR #27. Production remains unchanged. Real Android/iOS and stage hardware testing must be completed by an operator.

## Implemented

- PhoneDeviceTelemetry: read-only WebRTC receive statistics from actual QR or manual phone pairing. Browser counters include decoded frames, inbound FPS, packet loss, jitter and candidate-pair RTT. Individual fields may be unavailable in Safari and are never invented.
- RealDeviceTrial: bounded one-second sampling of real phone-video status plus existing SOMA frame age, pose inference time, A/B ambiguity, camera-floor calibration binding and FootstepEngine contact count.
- RealDeviceValidationPanel: Guided Setup → Tracking → Real-Device Validation. Phone model, browser, network and external video filename; manual observations of walking, slow walking, pivot, slide, A/B crossing and connection loss; software blackout event and physical light witness; exported JSON.
- Automatic and manual WebRTC receiver sessions share a single diagnostics stream; stale reports expire after 3.5 seconds.
- No SDP, access token, IP, video or images are saved in the QA JSON. No optical hardware command is sent by the QA recorder.

## Real rehearsal sequence

1. Open the same protected HTTPS SOMA Preview on laptop and phone. Ensure both devices have access. QR and manual pairing are supported. Do not switch the physical projectors to Live.
2. Attach the phone to a tripod. Verify camera permissions, stable illumination, floor visibility and both performers from the desired lens viewpoint. Begin with private non-isolated Wi-Fi.
3. From Footprints Guided Setup, choose the actual phone source; wait until the original SOMA body tracker receives WebRTC. Calibrate the camera to the marked floor and confirm its binding.
4. In Tracking, expand Real-Device Validation, enter device/browser/network details and the **separate external video reference**. Click Start Trial only while the real phone video is active.
5. For each performer, perform normal walking, slow walking, pivot and slide. With two performers, also do a crossing. Enter a short observation for each movement, with an external-video frame number where available.
6. Continue recording at least 60 seconds; the QA engine samples once a second. Compare inbound decoded FPS, frame age, inference time and estimated contact events.
7. Deliberately interrupt the phone link (Wi-Fi off, tab hidden, permission revoked). Check the browser software Blackout request and physically observe what the projectors display. Mark the physical blackout checklist only after personally witnessing it.
8. Enter a named reviewer, complete the evidence checklist, finish and **Export JSON**. The trial stays browser-local until exported. Keep the video source and separate witness recording.
9. Repeat trials for Android Chrome and iPhone Safari, with one and two performers. Repeat fixed-angle camera and floor conditions to make comparisons meaningful. Recalibrate whenever camera source, resolution or orientation changes.

## Provisional software quality gates

| Measurement | Provisional target | Interpretation |
| --- | --- | --- |
| Trial length | ≥60 seconds | Local QA duration |
| WebRTC connected samples | ≥30 and ≥85% of captured samples | Capture connection uptime |
| Decoded video | ≥600 inbound frames | Real browser decode counter |
| Video cadence | Median ≥18 FPS | Observed inbound frame rate |
| Fresh tracking frame | ≥85% at ≤450 ms | Frame timing inside laptop SOMA |
| Calibrated camera time | ≥75% of connected samples | Same active camera binding |
| Pose tracking | ≥75% of valid calibrated samples | Pose-tracked frames, not footfall ground truth |
| Dual-performer visibility | ≥60% together, ambiguity ≤15% | Software A/B assignments |
| Camera-estimated floor contacts | ≥6 | Estimated contact count |
| Movement case evidence | Walk, slow, pivot, slide for each performer; crossing if dual | Operator review of external video |
| Link-loss / blackout | Observed disconnect, nearby software Blackout, physical witness | Three separate kinds of evidence |

Network RTT and jitter are displayed. They do not measure one-way video delay or projector foot-to-light latency. The result **ready-for-physical-review** does not authorize Production or physical projector Live.

## Separate physical acceptance

- S5.6.4 validates actual footfalls against annotated video, with provisional precision/recall ≥90%, error P95 ≤15 cm and foot-to-projected-light P95 ≤180 ms.
- S5.7 optical calibration must be checked for BODY A, BODY B and FLOOR. A moving leg and thigh change geometry; four-point floor calibration cannot guarantee body-surface projection alignment.
- A human must observe the actual light going dark on connection loss. Browser Blackout only means the software command was sent. Real projector power cutoff remains the emergency measure.
- Real-world measurements are pending; CI only tests synthetic metrics fixtures and browser build compatibility.

## Validation matrix

| Device | Actors | Cases | Current evidence |
| --- | --- | --- | --- |
| Android Chrome / rear camera | 1 | Walk, slow, pivot, slide, disconnect | Pending real take |
| Android Chrome / rear camera | 2 | Each actor plus crossing/disconnect | Pending real take |
| iPhone Safari / rear camera | 1 | Walk, slow, pivot, slide, disconnect | Pending real take |
| iPhone Safari / rear camera | 2 | Each actor plus crossing/disconnect | Pending real take |
| Any device, Wi-Fi interruption | 1 or 2 | Software Blackout, observed physical cutoff | Pending real take |

## Known constraints

TURN fallback is not configured. A short-lived Vercel Redis room enables QR signaling but cannot overcome all restrictive NATs. WebRTC getStats fields vary by browser, and missing values remain unmeasured. Current trial data is held in memory until exported; browser reload before JSON export loses the trial. No user video is uploaded to the QA service. All physical results remain **unverified** until hardware and real humans are tested.
