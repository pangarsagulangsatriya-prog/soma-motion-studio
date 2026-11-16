# SOMA Footprints S5.5 — Physical Validation & Performance Tuning

**Status:** implemented rehearsal instrumentation and software optimizations; hardware measurements pending.
**Branch:** `feat/footprints-s5-physical-validation-20261116` stacked on S5.4. Keep PR draft until floor-camera-projector trial. Main/Production unchanged.

## Changes implemented in the app

1. **Physical stage data capture:** Live Floor now contains **03 / Physical Validation**, where an operator selects an existing real *camera* contact and manually enters the physical landing point measured with a tape measure, in floor metres from downstage-left. The program records both positions, event ID, performer, foot, context and **Euclidean error in centimetres**. Duplicate event pairings, off-floor coordinates, simulation contacts and ghosts are rejected.
2. **Operator video latency:** The operator films physical landing and illuminated footprint in **one continuous high-speed camera view**, then enters frame difference and recorded FPS. `latencyMs = 1000 × frames / fps`. This is an externally measured *event-to-light* estimate with uncertainty of at least ~one high-speed video frame. Browser stats MUST NEVER be described as physical latency.
3. **False/missed-contact and crossing annotations:** The operator records time/location and performer notes for missed contacts, false contacts, identity mismatches, occlusions and other visible problems. Counts remain zero until recorded by an observer; an unreported problem should NOT be interpreted as proof that none occurred.
4. **Summary and exports:** Mean, median, P95, max and RMSE spatial error from manually matched events; median and P95 external-video delay; observation counts. `SOMA-S5-5-stage-validation-report.json` embeds physical samples, operator notes and clearly labeled browser metrics at export. `SOMA-S5-5-physical-contact-errors.csv` exports spatial pairs. The app does **not** capture or upload the physical reference video.
5. **Software-only diagnostics:** Bounded 180-sample browser ring tracks raster paint cadence/cost, MotionFrame pose inference/pipeline timings (de-duplicated by frame completion time), and shared Projection output heartbeat FPS/P95. These are **diagnostics** and cannot reconstruct camera-to-projected-light delay.
6. **Event revision cache:** Validated `FloorSession` is cached until the contact stream changes; contact tally is O(1), rather than filtering every event on every UI tick. The floor SVG rebuilds only for relevant event/ghost/floor changes.
7. **Event-driven raster output:** The hidden 1280×720 floor raster repaints when contacts, ghosts, calibration/test-pattern mode or floor size change, or once every 900 ms for heartbeat safety. The previous approach repainted every 170 ms despite an unchanged session. The existing CameraTracker, GaitAnalyzer, media access, and projection calibration remain untouched.
8. **Duplicate bitmap suppression:** `ProjectionLink` uses the floor raster revision to send changed frames immediately and refresh an unchanged image at most about once per 900 ms. Other artwork sources without a floor revision retain their old streaming cadence. A pending bitmap is discarded if its revision is stale or output permission is revoked; Hold and Blackout are respected.
9. **Ghost expiration after camera stops:** S5.4 possible-next-step outlines expire by monotonic wall time even if the last Body pose timestamp stops advancing, so they cannot remain hanging on screen indefinitely when tracking stalls.
10. **Tests:** `tests/footprints-stage-validation.test.ts` covers empty reports, manual error computation, invalid provenance, frame-derived physical latency, operator annotations, bounded software metrics, cached session invalidation, raster gating and bitmap-transfer/blackout policy. All prior S5.0–S5.4 tests remain in CI.

## Stage setup and calibration

- Mark the physical floor perimeter: **downstage-left as (0,0) m**, +X stage-right, +Y upstage.
- Put 4 clearly visible markers at the real corners. Use the S5.3 **raw unmirrored camera** calibration in order: upstage-left, upstage-right, downstage-right, downstage-left. Enter actual floor dimensions.
- In shared SOMA Projection, align exactly 4 output corners on the same surface. Test all 4 projection crosses with the actual projector.
- For physical measurements, use a tape measure or checked physical stage grid. The reference coordinate for a contact must represent **where that foot visibly landed**, *not* the visually estimated software dot. Mark its X,Y and choose the corresponding camera contact in the validation panel.
- The camera and projector should be fixed in place through the validation run. Moving either invalidates the comparison, requiring a new calibration and a separate report.
- Keep projection **Blackout** during camera setup, physical repositioning, and alignment of the four corners; only enable Live after both calibrated mappings are confirmed.

## Practical test matrix

| Session | Trial | Data to collect |
| --- | --- | --- |
| A — Static 1-person | At 9 floor positions (3×3 grid), land each foot 3 times; 54 contacts in total where feasible | X/Y ground truth, error cm, false stamps during stationary stance |
| B — Dynamic 1-person | Straight, curved and interrupted walking, several short strides, 10–15 minutes | Missed and false contacts, jitter, renderer timing, output drift |
| C — Two performers | Parallel, opposing, crossing, one performer exits/returns | A/B identity notes, missed contacts, explicit reset behavior |
| D — Predicted ghost ON/OFF | Repeat selected paths with toggle | Ghost expiry ≤450 ms, no dashed ghosts exported to V3 contact JSON |
| E — Camera and calibration faults | Change camera track/resolution; temporarily block feet; change quad | Tracking stops or asks for re-verification; no uncalibrated live artwork |
| F — Shared projection | Live → Hold → Blackout; repeat, open/close output, resume | Hold freezes; Blackout truly extinguishes; no stale bitmap after revocation |
| G — End-to-end delay | Use external 120/240 fps video that shows physical foot touchdown and projected contact in same view | Frame difference, exact external FPS, delay ms; use 20+ repeated samples across both feet |

For session A, ask an observer to label physical landing points and match specific contact event IDs. The human observer should document mis-pairings and cases where no software contact appeared. Report measurement uncertainty (marker width, shoe size, camera FPS, lens angle and reference point choice).

## Measured quantities and what they mean

| Metric | Measurement | Important limitation |
| --- | --- | --- |
| Spatial error (cm) | Euclidean distance between camera-calibrated event and manually surveyed landing reference | 2D floor-plane approximation, not pressure centre |
| Error mean / P95 / RMSE | Computed from manually entered matched pairs | Unmatched/missed contacts must be separately annotated |
| Physical latency (ms) | Frame difference × 1000 / recorded external FPS | Requires one-shot footage of landing AND projector; resolution limited by external camera |
| Frame/render cadence | Performance clock measurements of floor raster paint | Inactivity gating reduces paint FPS by design; not camera capture FPS |
| Pose inference/pipeline (ms) | Existing CameraTracker telemetry | Does not include photons, shutter delay, display scanout |
| Projection output FPS/P95 | Existing output heartbeat stats | Output rendering diagnostic, not measured motion-to-light |
| Silent A/B switches | Operator-observed identity anomalies | Two-person MediaPipe detection doesn't supply persistent identity IDs |
| False/missed contacts | Operator-noted deviations from physical steps | Must be actively observed; zero reports alone do not prove zero faults |

## Before/after comparison

Measure the S5.4 Preview and this S5.5 Preview using the **same laptop, camera, projector, browser, lighting, floor dimensions, session and number of steps**. Collect a full 15-minute rehearsal for each build. Compare browser CPU/paint and transfer cadence through the provided telemetry and browser profiler, along with the measured stage error/latency values. No performance improvement numbers are supplied before completing these trials. Inspect the browser console for missing permissions and dropped frames.

**Provisional release gates to review with the artistic team:**
- The entire 15-minute two-performer score can finish without an uncaught runtime error, unrequested camera restart or lost stored session.
- No silent identity transfer when performers cross: ambiguous state must demand operator reset.
- Both calibrations and source changes fail safely to a visibly dark output.
- No predictions counted as true contacts or saved to the V3 observed-event dataset.
- Spatial error, latency, false/missed contacts and identity problems **have measured baselines**, with acceptable thresholds determined after a representative pilot, not invented in software.

## Real hardware validation not performed here

CI covers browser source/build and deterministic pure unit tests. The model and GitHub Actions cannot see the user's physical stage, control projector focus, film touchdown, or verify centimetre-scale fidelity. **S5.5 is an instrumented validation candidate, not a physically certified final release.** The PR should remain draft until an operator attaches an actual S5.5 JSON report and the team signs off physical thresholds.

## Files

- `src/footprints/validation/StageValidationRecorder.ts`: physical reference and external latency model, summary statistics, browser metrics.
- `src/footprints/validation/StageValidationPanel.tsx`, `stage-validation.css`: rehearsal input and report exports.
- `src/footprints/live/LiveFloorTrackingEngine.ts`: cached validated event session + revision counter.
- `src/footprints/live/FloorRenderGate.ts`: event/heartbeat raster invalidation.
- `src/footprints/live/LiveFloorWorkspace.tsx`: embedded panel, event-driven preview and metrics.
- `src/footprints/live/MultiPoseGaitRouter.ts`: expiry of transient predicted ghosts if the camera pauses.
- `src/projection/channel.ts`: floor-revision bitmap sending, heartbeat, stale-frame/Blackout guards.
- `tests/footprints-stage-validation.test.ts`: measurable software gates.
