# SOMA / UNPACKING — S5.7.4 Dual-Surface Calibration & Output Routing

**Development branch:** `feat/footprints-s5-7-4-dual-surface-routing-20261117`  
**Base:** S5.7.3 Contact-to-Archive Bridge (Draft PR #20)  
**Status:** Draft; Production untouched.

## What physically changes in this sprint

S5.7.3 already provides two black preview canvases: moving monochrome archive footage restricted to the lower-body mask (BODY) and frozen real-video fragments on a metric pad (FLOOR). S5.7.4 adds **two separately opened browser output windows**, two independent Stage Projection communication sessions, two independent 2D calibration configurations, and manually gated output routes.

| Surface | Source | Calibration | Window | Safety |
| --- | --- | --- | --- | --- |
| BODY | existing S5.7.2 lower-body archival mask canvas | Camera-image UV → BODY projector UV (four-point planar approximation) | bodyProjection session with `stageSurface=body` | full black for tracking loss, stale frame, overlap, absent video or unapproved QA |
| FLOOR | existing S5.7.3 archival pad preview canvas | Metric floor raster UV → FLOOR projector UV (four-point) | distinct bodyProjection session with `stageSurface=floor` | full black for lost tracking, inactive bridge, old calibration, unapproved QA |
| Legacy Projection | existing SOMA shared projection route | unchanged | original existing Projection output | explicitly forced Blackout and closed before opening either new stage window |

**Both windows use existing** `ProjectionLink`/`ProjectionOutput` frame transfer and timeouts. No new HDMI driver or second camera, and no replacement of the existing FloorSession V3 renderer. The stage output points at the current pixel canvases, not a new artificial emitter.

### Why the calibration is separate

The floor homography models a fixed flat rectangle. The body canvas carries image-space masks following hips, legs and feet from one RGB camera. **One four-point homography cannot fully register imagery on the moving, curved 3D surface of a performer**. S5.7.4 implements an initial registration/route for actual projection experiments. It does not include multi-depth photogrammetry, pose-specific mesh warp, a guaranteed upper torso cutoff on actual skin, or permission to run the real show before dynamic registration QA.

Both `StageSurfacePlan` records contain:
- `sourceQuad` normalized image/sample corners; starts as a whole 16:9 preview rectangle.
- `projectorQuad` normalized physical screen corners; one per window.
- independent resolution and brightness (BODY defaults to 32%; FLOOR 38%, cap 60%).
- versioned format `soma.footprints.stage-surface v1`.

`stageSurfaceState()` uses existing Projection config `registration` and `artworkTransform()` in the output window. The four-point body registration is a planning/testing approximation until a real measured dynamic mapping solution is available.

## Operator workflow

Open **Studio → Footprints → Live Floor Tracking → 00 Stage Optics → 02 Archival Video Mapping → 04 Dual-Surface Calibration & Output Routing**.

1. Set up and calibrate the existing SOMA Body camera, fixed 8×6 m (or measured) floor, A/B identity tracker and per-performer archival files in S5.7.2. Activate the S5.7.3 Bridge. Confirm both previews draw correctly. Simulation remains available but **cannot activate physical routing**.
2. Confirm a responsible operator is watching the physical beam path. The operator must have access to physical projector power. The stage output buttons remain inactive until this checkbox is explicitly selected.
3. Click **Buka output** on BODY and FLOOR **separately**. Browser pop-up blockers may require one explicit click per output. Each new window opens in Blackout. The prior shared SOMA Projection output is closed and forced to Blackout first.
4. Move the BODY and FLOOR windows to their own hardware projector displays and fullscreen them (F / double-click). Check that the two windows are independently named and connected by heartbeat. No physical dimensions are inferred automatically from the browser output. 
5. Click **Uji terbatas** for BODY or FLOOR. BODY test is a dim neutral field restricted strictly to the currently tracked lower-body alpha mask; this avoids projecting a full-body grid on faces. FLOOR test is a **single small cross**, selectable F1–F5. Only the selected window receives the test.
6. Adjust per-output four UV source/destination corners and brightness as needed. This changes output signatures, immediately invalidating prior QA and Live permission. Do not rely on a QA saved for a different camera, projector viewport, window instance or floor configuration.
7. Use a **real physical tape/ruler and external camera/video** to measure displacement ΔX and ΔY in centimetres for five independent body positions (A still, B still, A walking, B walking, crossing) and five floor marks (rear-left/rear-right/centre/front-left/front-right). Record the observed errors manually; no pixel-based automatic measurement is claimed.
8. Confirm fixed rig optics, observed **physical** Blackout, and absence of harmful/undesired light spill on face, upper body or audience. Enter reviewer name and close the manual QA for each output.
9. Proposed preliminary thresholds: BODY RMSE ≤12 cm and P95 ≤20 cm; FLOOR RMSE ≤8 cm and P95 ≤15 cm. All five physical samples must exist. These are internal rehearsal targets, not a published standard or device specification.
10. Press **LIVE** separately on each qualified output. A new frame is transmitted only while the mode remains live, the window is connected, QA still matches the current device/camera/output geometry, real (non-simulated) camera tracking and mask are fresh, required video exists, the Bridge is active, and the operator has armed that window. No approval is automatically copied between outputs.
11. Press **BLACKOUT KEDUA OUTPUT** at any time to demand zero artwork on both windows. For any physical hazard or browser freeze, switch off the actual projector hardware as well. Closing a window also clears that output's session.

## Five-point independent QA model

`DualSurfaceCalibration.ts` stores:
- five named independently measured samples for each surface, as operator-entered signed ΔX/ΔY physical centimetres and an explicit measurement method.
- per-window `signature = [surface plan, camera binding, floor calibration identity, window session instance, viewport dimensions, device pixel ratio]`. Any change makes the old proof stale.
- RMSE, interpolated P95 and maximum physical error.
- reviewer and completed timestamp, three safety checklist attestations.
- an explicit `incomplete | needs-adjustment | within-provisional-target` result.
- independent `requested = blackout | test | live` and operator-armed flags.

Importantly, a manually entered proof cannot be treated as an automated sensor reading. A human can still enter an inaccurate number; the real video and tape markers remain necessary for review.

### Fail-closed behavior

- All outputs start Blackout and require a fresh user click to open and arm.
- Simulated input never qualifies for physical output.
- No camera calibration or stale tracking (age ≥450 ms) → Blackout.
- Missing body segmentation/mask or ambiguous two-performer IDs → Blackout.
- Missing files/body composite → BODY Blackout; Bridge disabled or blocked → FLOOR Blackout.
- Changes in camera binding, floor calibration, projector UV, output viewport, browser output window instance or image source configuration invalidate live approval.
- Remote output renderer also has its established link timeout (2800 ms), plus local control-frame TTL. This is browser health monitoring, **not** independent hardware blackout verification.
- Dynamic source windows are separate and cannot substitute for a power cutoff on projector hardware.
- Test images are tightly limited: BODY test is strictly clipped to the lower-body mask; FLOOR one cross at a time. Full-screen body patterns are avoided.

## Files

- `DualSurfaceCalibration.ts`: pure surface configuration, QA evidence, output proof signatures, fail-closed gate.
- `SurfaceTestPattern.ts`: constrained body mask/floor cross patterns.
- `DualSurfaceRoutingPanel.tsx`: two independent `ProjectionLink` instances, controls, QA UI and metered dispatch.
- `dual-surface-routing.css`: panel styles.
- `ArchivalMappingPanel.tsx`: shares existing body+pad preview canvases and route snapshot; no new foot events.
- `StageOpticsPanel.tsx` / `LiveFloorWorkspace.tsx`: ownership route to legacy Projection, which stays stable until operator deliberately opens new stage output.
- `ProjectionOutput.tsx` / `channel.ts` / `main.tsx`: optional per-window label; original output remains compatible.

## Acceptance gate and limitations

Run `npm test` and `npm run build` and keep the PR Draft. A CI pass validates software contracts only.

Physical signoff requires:
- The exact projector make/model/lens/rig and camera measured/recorded; no unexpected face or audience illumination.
- Five real spot measurements **per output**, measured on actual stage, with independent source video and signed QA reports.
- BODY movement tests: slow walking, drag, pivot, bending, A/B crossing, camera loss and re-entry. Observe true projected mask registration and optical black level.
- FLOOR tests: F1–F5, shadows around feet, visible fragments coinciding with actual contacts, stage footprint scale/orientation.
- Separate rapid Blackout and recovery for each output, disconnection and projector power test. Never rely solely on a browser blank canvas.
- Actual foot-to-light latency measurement from external same-shot high-FPS footage as in S5.6.4.
- Human approval for Production. Current 2D body mapping and QA threshold are engineering approximations, **not a certification of live 3D body tracking**.

**Next:** S5.7.5 — Rehearsal & Visual QA. Focus on independently witnessed registration/spill/latency during the real lower-body performance.
