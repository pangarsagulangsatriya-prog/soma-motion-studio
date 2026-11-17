# SOMA S6.1.2 — Preview: Real-Device Validation

**Source:** Draft PR #29, stacked on S6.1.1 (#28) and S6.0/S6.1 (#27). **Production has not changed.** GitHub Actions #585 passed: 302 automated tests and TypeScript/Vite build.

## Scope of this preview

SOMA now records transport diagnostics from the **actual incoming phone WebRTC stream**, using the existing QR/manual receiver. It correlates browser video stats with the original Body tracker, performer A/B identity and calibrated Footstep contact events. A guided physical rehearsal form lets the operator record video and blackout evidence, and download JSON.

A synthetic test fixture passing does **not** prove any actual smartphone or optical projection quality.

## Step-by-step live device trial

1. Open this branch's **HTTPS Vercel Preview** on laptop and phone. Both need access to Preview protection. Choose Footprints → Guided Setup → Kamera HP → Scan QR otomatis.
2. Scan QR on Android Chrome or iPhone Safari, allow the rear camera, leave the phone browser visible and keep the phone on a tripod. Confirm laptop reports connected WebRTC.
3. Calibrate four camera/floor corners to the current phone camera and confirm. Enter Guided Setup → **Tracking** → open **Real-Device Validation · S6.1.2**.
4. Check live FPS, framesDecoded, jitter and network RTT. Where getStats cannot report values, tiles show an unavailable value instead of an invented measurement.
5. Enter phone model, browser, Wi-Fi conditions and filename of the separate witness video. Press **Mulai trial kamera HP** while phone video is active.
6. Walk normally, walk slowly, pivot, slide; for two actors, record each movement for A/B plus crossing. Add a short operator note and video frame reference for each.
7. Keep the test ≥60 s. Then interrupt phone Wi-Fi or hide the camera browser. Confirm the browser software blackout event was recorded **and physically observe the projector darkening**. The software event alone does not certify hardware.
8. Complete real-world checklist and named review, end trial, **Ekspor JSON laporan QA**. Retain a copy of external video, with physical footstep positions and light visible if optics are being tested.
9. Run one/dual performer trials on both Android and iPhone. Use the original S5.6.4 foot-contact video annotation and S5.7 optical calibration QA before any stage acceptance.

## Quality criteria (provisional)

- Connected ≥85% of samples, ≥30 connected samples, ≥600 decoded inbound video frames.
- Median video FPS ≥18. Fresh pose frames ≥85% within 450 ms.
- Calibrated binding valid ≥75%; pose tracked ≥75% when calibrated.
- Two actors both visible ≥60%; ambiguous assignments ≤15%.
- ≥6 camera-estimated foot contacts; all movement cases and witnessed disconnect recorded.
- Phone on tripod, feet visible, external video reference and physical blackout witnessed by a named reviewer.
- “ready-for-physical-review” is still **not** “approved for projector Live.” Photon latency, footfall precision/recall and calibration error need external measurement.

The report stores only diagnostic numbers and manual notes — no phone video, SDP, WebRTC tokens or IP addresses. Session is local to the tab and should be exported before reload.
