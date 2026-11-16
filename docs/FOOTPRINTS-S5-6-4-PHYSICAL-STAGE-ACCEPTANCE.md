# SOMA Footprints — S5.6.4 Physical Stage Validation & Acceptance

**Development:** `feat/footprints-s5-6-4-physical-acceptance-20261116`, stacked on S5.6.3. **Draft PR; no Production deployment.**

## Why this step exists

The gait and floor pipeline now contains deterministic logic and five-point camera–projector alignment checks. Neither simulated test poses nor camera timestamps prove what a *real shoe* did on stage. S5.6.4 binds a frozen camera FloorSession V3 snapshot to an independently filmed real performer take. A human annotates every physical touchdown and pairs it with one camera contact event (or leaves it unmatched). Errors, missing contacts, extra camera contacts, and external-video foot-to-light delay are calculated from that evidence.

**No automatic synthetic PASS:** all physical coordinates, actual video touchdown frames, pairings and physical latency need manual annotation. Data is local in the browser until the user exports JSON. No new webcam stream, paid model, external upload or second Projection pipeline is required.

## Procedure

1. **Prepare the stage.** Measure floor width/depth with a tape and mark orientation downstage-left (+X to the right, +Y upstage). Fix camera, performer region and projector in their performance positions; verify the single SOMA Body stream.
2. **S5.6.3** Calibrate four raw-camera floor corners and four projector corners. Project and inspect five independent interior light crosses (Q1–Q5). Export their JSON. A pass requires all five to be observed and within provisional calibration limits; this still does not certify physical contact positions.
3. **Record a real take.** Use another camera aimed to capture *the feet and the illuminated projection in the same shot*, ideally high FPS. Note video name, length and actual FPS. Record ordinary walking, very low and slow lifts, pivot with foot planted, shoe dragged along floor, and A/B crossing for the two-person setup. Preserve source video outside the app.
4. **Freeze.** Open Live Floor → **04 / Physical Stage Acceptance**. Enter video reference, duration and FPS. Press **Bekukan sesi & Blackout**. This captures an immutable list of camera-sourced **contact** events from the FloorSession V3; simulated events, moves, and ghosts are excluded. Recording continues only in the original system; later events cannot contaminate the frozen snapshot. Confirm correct session/take before freezing.
5. **Ground-truth every touchdown.** Scrub the external video and create one entry per shoe touchdown, including performer, left/right, video frame, measured X/Y in metres and notes. Manually pair an actual touchdown with one genuine camera event. Use **Tidak tercetak** when no event corresponds. Event IDs cannot be reused or paired across performers/feet. For two performers, each must have at least twelve annotated touchdowns (provisional sampling minimum).
6. **Separate movement cases.** Add a timestamp/frame and observation for normal walk, slow/low steps, pivot, slide, and crossing. A pivot or slide can legitimately occur with no new contact; these narrative case records preserve that distinction.
7. **Measure foot-to-light delay.** On the same external video, record the frame difference from physical foot touchdown to the light being visible for at least five *matched* touchdowns. Milliseconds = frame difference / video FPS × 1000. Browser frame-submission-to-raster/ACK timing remains a software diagnostic, never physical latency.
8. **Audit and sign.** Complete the four hardware/marker/video/safety checklist items, inspect every camera event and every visible actual touchdown, enter reviewer name, then explicitly mark the review complete. Only now can unpaired camera contact events be interpreted as false positives.
9. **Export JSON** and retain together with the video, five-point QA report, position marker notes and fixed hardware context. The report contains snapshot, truth labels, per-performer quantities, measured errors, decision and provisional thresholds. A production merge still requires independent human review.

## Calculations

- `TP` = physical touchdown paired one-to-one with a camera contact.
- `FP` = camera contact in the frozen snapshot with no corresponding physical touchdown **after full review**.
- `FN` = physical touchdown visible in video with no matching camera contact.
- `precision = TP / (TP + FP)`; `recall = TP / (TP + FN)`. Undefined denominators stay null.
- `false contacts/min = FP / (video duration seconds / 60)`.
- `position error (cm) = 100 × distance(camera contact position in metres, manually measured physical touchdown point in metres)`.
- `P95` = interpolated 95th percentile over matched position errors, or independently filmed foot-to-light frame delays. These are sample quantities, sensitive to recording duration and sampling conditions.
- Per-performer truth counts prevent one actor’s data from hiding the other's failures. Event matching is reviewer-supplied, not silently inferred from unaligned video and app clocks.

## Provisional gates for S5.6.4

| Category | Proposed threshold | Evidence |
| --- | --- | --- |
| Independent interior calibration | Five targets, QA status within provisional target | Same physical camera/projector, S5.6.3 clicks |
| Physical truth | ≥12 touch-downs for each performer | Side video with marked frame and reference position |
| Coverage | Normal walk, slow/low step, pivot, slide; crossing for two performers | Annotated video frame and short description |
| Contact precision | ≥0.90 | Complete physical-to-camera event audit |
| Contact recall | ≥0.90 | Complete physical-to-camera event audit |
| Spurious events | ≤1 contact/minute | Whole-take duration and full review |
| Physical position | P95 ≤15 cm | Paired real contact and tape-marked floor point |
| Physical touch-to-light | P95 ≤180 ms with ≥5 samples | Same-shot external high-FPS video |
| Safety | All four checkboxes + named reviewer | Fixed hardware, stage markings, video, Blackout/reconnection |

These are **initial rehearsal engineering gates**. They do not originate from a universal biomechanical standard or prior empirical measurements on this device. Revise them only with documented performer recordings, benchmark context and operator approval. The app reports one of:
- `incomplete`: missing or invalid/stale physical or calibration evidence. Not accepted.
- `needs-adjustment`: evidence complete, but measured performance exceeds one or more limits. Not accepted.
- `meets-provisional-gates`: mandatory human evidence complete and measured values meet provisional thresholds. **A candidate for review**, not automatic Production approval.

## Important limitations

- A single RGB camera cannot measure true ground reaction force or plantar pressure. Physical touchdown truth originates in the independent video/marker review.
- Manual event pairing requires comparing the same take. The two cameras do not share automatically synchronized timestamps. The recorded video frame is an independent witness; the browser event timestamp remains diagnostic only.
- Missing a camera event can be counted only when the physical event has been annotated. An unfinished review must not be used for FP reporting or acceptance.
- Physical camera/projector repositioning that does not change saved settings cannot be detected by a software fingerprint. Recalibrate and retake after any movement.
- "Blackout checked" is an operator attestation. Automatic tests cannot establish real light extinction, nor can a browser ACK prove photon arrival.
- Five interior light checks do not verify contact stamping or latency. Keep S5.6.3 QA residuals separate from S5.6.4 paired physical landing residuals.
- No model retraining, biometric identity re-identification, lens distortion correction or automatic object-level shoe detection is claimed in this sprint.

## Release checklist

- [ ] TypeScript build and full automated suite pass.
- [ ] Two actors each have at least 12 reviewed real touch-downs and all movement cases captured.
- [ ] All event IDs matched or explicitly reviewed as unmatched; video and FloorSession same take.
- [ ] Repeat take with fixed hardware; evaluate centre/corners, occlusions, slow pivots and shoe dragging.
- [ ] Confirm five-point projector QA and real measurement errors separately.
- [ ] Verify Blackout/reconnect, projector movement invalidation, and camera resolution changes on the stage.
- [ ] Export and archive physical evidence; obtain responsible human acceptance approval.
- [ ] No deployment of unfinished draft PRs.

**Recommended next sprint:** S5.6.5 — Independent Rehearsal Comparison & Release Decision (compare repeated takes to S5.6.1/S5.6.2 baselines under identical physical settings).
