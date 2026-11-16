# SOMA Footprints S5.4 — Multi-Performer & Predictive Ghost Steps

**Status:** review candidate on `feat/footprints-s5-multi-predict-20261116`, stacked on S5.3. GitHub PR must remain DRAFT until hardware rehearsal and identity crossing tests. Production remains unchanged.

## What this sprint actually adds

The existing SOMA MediaPipe PoseLandmarker is ALREADY configured with `numPoses:2` in both `src/engine/tracking.ts` and `public/workers/soma-pose.js`. `MotionProcessor` already forwards both detections through `MotionFrame.poses`. No extra camera, inference model, worker, or projection window was introduced.

1. **Two-person ID router**: `TwoPersonIdentityTracker.ts` assigns stable `A` and `B` to the two pose streams using hip centres, motion distance, and an ambiguity gate. MediaPipe detection order may switch between frames; foot events still use the assigned performer ID. When people overlap, the tracker refuses identity updates and **locks** until the operator explicitly selects **Reset identitas A/B**. This avoids silently swapping A/B after occlusion.
2. **Independent gait state**: `MultiPoseGaitRouter.ts` maintains one `GaitAnalyzer` per performer, with two feet per performer. It consumes the EXISTING Body `MotionFrame.poses[]` forwarded from `StudioFootprints`. It does not open another camera. Single-performer mode uses the existing S5.3 gait stream.
3. **Per-person event stream**: S5.3 `LiveFloorTrackingEngine` now stores `seen`, `grounded`, `received` and last grounded positions by `performerId:foot`. Both live performers write one ordered V3 `FloorSession` with unique IDs and the existing `source:'camera'` / `positionBasis:'calibrated-estimate'` provenance. No additional session format.
4. **First contact rearm fix**: gait starts in `unknown` while the stance heuristic settles. Initial unknown samples no longer force the event engine into the "lost-tracking" state. After a previously observed foot disappears, the original safety logic still requires a swing before stamping a new contact.
5. **Ghost steps**: `GhostFootstepPredictor.ts` needs two prior confirmed-by-heuristic contacts, a currently swinging foot, and sufficiently reliable tracking. It projects a SHORT, capped continuation of the last step vector (max 0.7 m), expires in 450 ms, disappears on actual contact/tracking loss, and is never written into the saved session.
6. **Ghost presentation**: optional checkbox **Jejak kemungkinan berikutnya (bayangan, bukan kontak)**. Predictions appear as dashed outline shapes in the Floor Preview and common Projection artwork. Solid sole stamps still signify estimated actual contact. Both are projected using the existing S5.2 one-warp setup; no second calibration.
7. **Operator controls**: Live Floor → choose **1 performer** or **2 performer**. Changing counts resets the event session and revokes projector approval. When identity is ambiguous, the UI explains why and offers **Reset identitas A/B**, which also clears the current session and revokes projector approval.
8. **Tests**: `tests/footprints-multi-predict.test.ts` verifies reversed MediaPipe pose order, independent per-foot events, ambiguous crossing lock, no silent reacquisition, bounded/expiring ghost predictions and absent ghosts in export JSON. Existing S5.0–S5.3 tests and build remain release gates.

## Artist / operator flow

1. Open the S5.4 Preview → Studio → Footprints → **Live Floor Tracking · Kamera**.
2. Calibrate FOUR camera-visible floor corners, select the actual floor size (metres), then confirm. In Projection SOMA, align the FOUR physical projector corners separately, test markers and confirm.
3. Select **2 performer**. This resets the floor session; both people must enter the camera view with hips, knees and feet clearly visible. The status panel identifies A and B. Camera images stay local.
4. Walk alternately with distinct paths. The two performers' left and right contact stamps enter the same floor preview and physical projector.
5. Check **Jejak kemungkinan berikutnya** to see dashed ghosts near the possible continuation of a walk. Ghosts are optional, lower confidence, fleeting and disappear when the foot lands. Uncheck it to see only recorded contacts.
6. Walk the performers towards each other. If the camera cannot distinguish them, status shows **Identitas belum pasti**. No new steps are stamped until **Reset identitas A/B**; perform this reset after both are physically separated.
7. Test **Live**, **Hold** and **Blackout**; saved **JSON V3** keeps only observed contact/release/move events, with no predictive ghosts.
8. Move/swap the camera or change resolution to verify automatic revocation of camera calibration. Change projector calibration to verify output requires new confirmation.

## Limitations and claims that must not be made

- **Only two bodies from one monocular camera.** Two MediaPipe poses in one frame are NOT persistent people identities; this sprint supplies a conservative assignment gate, not a modern person re-identification model.
- **Identity crossing requires intervention.** Physical overlap/occlusion, rapid changes and opposite-direction crossings cannot be reliably solved using simple pelvis coordinates alone. The safe response is to stop stamping and request an operator reset.
- **Ghost step = artistic short-range hypothesis.** A history-based extrapolation does NOT predict an individual performer's next real foot landing with validated accuracy. Never label a dashed ghost as measured contact, force, pressure, or clinical gait result.
- **Physical floor coordinates depend on manual calibration.** Camera ground homography projects only the assumed stance/grounded foot point onto the flat floor. Elevated feet, lens distortion and poor visibility introduce geometric error.
- **No measured physical accuracy yet.** Hardware tests must record false contacts, identity switches, missed strides, projected position error in centimetres and total camera-to-projection delay.
- **No automatic production release.** PR #6 S5.0, PR #7 S5.1, PR #8 S5.2, PR #9 S5.3 and S5.4 remain separate draft stages.
- **The ghost checkbox controls physical projection too.** Keep OFF for contact-only output. When ON, dashed ghosts appear on the shared output once the already-existing floor calibration gate is approved.

## Rehearsal acceptance tests (manual, still needed)

| Test | Acceptance |
| --- | --- |
| Stable two-person side-by-side | A/B contact patterns remain separate for each foot |
| Detection order swaps | A/B assignment stays with previously tracked pelvis |
| Two performers overlap/cross | New live contacts stop; reset prompt visible |
| A reappears after prolonged tracking gap | No contact stamped until safe reacquisition and swing |
| One performer leaves view | Other performer continues without forced remapping |
| Ghost enabled | Dashed outlines only after adequate contact history and swing; disappear promptly |
| Ghost disabled | Only solid contact stamps in preview and projection |
| Export JSON | No prediction events, valid V3 session order and unique IDs |
| Camera/projection calibration changes | Live output returns to safe gate / Blackout |
| Live/Hold/Blackout | Footprint artwork shares one SOMA Projection output |
| Browser 1280×720 and phone widths | Buttons, state labels and warnings remain legible |
| Physical projector and camera | Record lens distortion, floor error, ID switches and end-to-end delay |

**S5.4 is an experimental performance instrument, not a verified dual-person measurement system.**
