# SOMA / Footprints — S5.6.3 Camera–Projector Calibration QA

**Development branch:** `feat/footprints-s5-6-3-camera-projector-qa-20261116`
**Base:** S5.6.2 Adaptive Gait & Contact Engine. **Do not merge directly into Production.**

## Why this step exists

Four corner correspondences mathematically fit a planar homography. A transform can return the corners perfectly and still produce a wrong illuminated location in the middle of the stage. S5.6.3 adds **five independent interior projector-light observations**, taken *after* the camera and projector quadrilaterals have been fitted. Each checkpoint is physically projected, then an operator clicks the actual luminous cross as seen by the existing raw, unmirrored SOMA camera.

The workflow does not open another webcam, retrain a gait model, modify floor V3 event data or duplicate SOMA Projection. The old four-corner test pattern remains available.

## Five independent checkpoints

| Target | Raster UV, origin upstage-left | Floor coordinate if 8 × 6 metres |
| --- | --- | --- |
| Q1 · Rear left | (0.20, 0.20) | (1.6, 4.8) m |
| Q2 · Rear right | (0.80, 0.20) | (6.4, 4.8) m |
| Q3 · Middle | (0.50, 0.50) | (4.0, 3.0) m |
| Q4 · Front left | (0.20, 0.80) | (1.6, 1.2) m |
| Q5 · Front right | (0.80, 0.80) | (6.4, 1.2) m |

Measured camera points are mapped back to the floor via the existing camera-to-floor homography. For each target, calculate `dxCm`, `dyCm`, and Euclidean error in centimetres; summarize **RMSE, interpolated sample P95, maximum and mean**. Never derive a zero-error validation from the same four corner points that were used to solve the homography.

**Provisional working thresholds** for five operator clicks: RMSE ≤ **8 cm**, sample P95 ≤ **15 cm**. These are adjustable rehearsal gates, *not measured device performance, manufacturer specs, or a clinical/scientific certification*. P95 from only five observations is descriptive; additional independent points and physical measurement are preferable before live performance.

## Step-by-step stage operation

1. Fix the camera and projector in their performance positions. Mark measured stage width/depth, upstage, and downstage physically. Avoid mirrors, camera crop changes and projection keystone changes mid-test.
2. Open **Studio → Footprints → Live Floor Tracking**. Start the existing SOMA Body camera. Mark the four *unmirrored* camera floor corners in order (upstage-left, upstage-right, downstage-right, downstage-left). Apply and confirm camera calibration.
3. Open the existing Projection Output; select the display actually connected to the projector. Use its four-point floor calibration and the **Tanda 4 sudut** mode to align the screen quad to the measured floor.
4. In **01B / CAMERA–PROJECTOR QA**, click **Mulai uji 5 titik**. The mode enables the test raster but **does not automatically activate Live**. Explicitly choose Live on the Projection panel; ensure the cross is visibly projected on the stage.
5. Click the *luminous cross centre on the raw camera view* (not the desired target location, actor's foot, or an artificial screen overlay). The next cross is projected automatically. Repeat Q1 → Q5.
6. The projector is set to **Blackout** after Q5; the QA measurements remain visible. Inspect each error and the aggregate. Export **SOMA-S5-6-3-camera-projector-QA.json**.
7. If error is large or a cross falls outside the floor, adjust camera or projector calibration and repeat *all five* checkpoints. The QA measurements are cleared whenever the stored camera calibration, camera binding, projector quad or resolution changes.
8. Run **S5.5 Physical Validation** separately with performer contact locations measured by tape and external video. S5.6.1 software timestamps are not physical camera-to-light latency. Confirm blackout, hold and reconnection behaviours on the real projector.

## What can and cannot be claimed

- This QA reveals the **combined camera–projector mapping residual** from operator clicks under a static, planar-floor assumption. It cannot uniquely locate whether the error originated in camera landmarks, projector lens geometry, physical corner measurement or the observer's click.
- Five projected crosses are not ground-truth foot contacts. They do not measure foot pressure, sole friction, contact false positives, gait accuracy or touchdown-to-photon delay.
- Changing the physical camera/projector pose without changing its stored configuration cannot be detected reliably in software. The operator must rerun the procedure.
- Projectors may show radial lens distortion or nonlinear warp that a 4-point homography cannot fully correct. A 5-point check can reveal spatial error, but S5.6.3 does **not** implement lens-distortion correction or automatically replace the existing matrix.
- Calibration points are **never inferred** from AI pose samples. All QA records identify their manual click origin. The exported context includes camera binding, projector quad, output resolution, camera calibration, per-point observations and summary.
- S5.6.3's successful automated tests show internal coordinate and UI raster logic, **not centimetre precision on a physical stage**.

## Regression checks

`tests/footprints-calibration-qa.test.ts` covers:
- five checkpoints distinct from four fitted calibration corners;
- camera UV → floor metres → centimetre residuals;
- incomplete/five-sample provisional classification;
- changed projector geometry, output resolution or camera binding makes older samples stale;
- QA raster shows a single selected cross while preserving the original four-corner mode.

Also run `npm test` and `npm run build`. The additional UI depends on the existing camera, Projection transport, FloorRenderGate, StageValidationPanel and FloorSession V3.

## Release gate

- [ ] CI build and automated tests green.
- [ ] Five projected crosses seen on actual stage (include projection hardware, camera resolution and lighting).
- [ ] Save QA JSON for ≥2 repeated five-point passes; review mean/RMSE/P95/max and bias by area.
- [ ] Same hardware stage comparison of S5.6.2 vs S5.6.3, with actual measured foot contact position error and uncertainty.
- [ ] Actual high-FPS foot + projection video check confirms physical end-to-end latency.
- [ ] Verify output remains dark on Blackout, unplug, camera mismatch and stale calibration.
- [ ] Human approval before merging a stacked draft PR; Production unchanged until approved.

**Recommended next stage:** S5.6.4 — annotated on-stage contact dataset and physical validation against S5.6.1–S5.6.3.
