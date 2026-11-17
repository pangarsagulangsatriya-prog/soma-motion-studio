# SOMA S6.2 — Assisted Projected Calibration

**Status:** stacked on S6.1.3 Draft PR #30. Production remains unchanged. S6.2 uses the already-existing **Live Floor Tracking** projector link and the current five-point camera–projector QA.

## Stage operator flow

From **Footprints → Guided Setup → Calibration**, press **S6.2 · Marker proyeksi, drag empat titik & QA lima titik**. This opens the existing Live Floor Tracking dialog; the existing manual corner editor, output panel and physical QA remain intact.

1. Install the same fixed camera aimed at the whole floor and confirm that an authorised operator has control of Blackout and physical projector power.
2. Confirm the actual projector raster covers the intended **floor patch**. This stage alignment is a manual observation; a camera cannot infer where the intended physical floor boundaries lie from projected colors alone.
3. Expand **S6.2 / Assisted Auto Calibration**. Check the floor-alignment witness control.
4. Click **1 · Rekam baseline & siapkan marker**. SOMA requests Blackout, waits 650 ms and captures one RAW camera frame; no baseline pixels are saved or transmitted to a server.
5. Click **2 · Buka jendela proyektor**, put that window on the FLOOR projector, and click **3 · Tampilkan marker (Live Test)**. This uses the existing projector artwork path, not a duplicate output window. Four distinct colored circular markers appear at 10% inset from the raster corners: magenta UL, cyan UR, yellow DR, green DL.
6. Confirm all four actual spots appear on the intended floor and remain visible in the raw camera. Click **4 · Cocokkan marker dari kamera**. SOMA reads five frames, subtracts the Blackout baseline, rejects stationary colored props and checks marker confidence, quadrilateral validity, stability, and full-frame containment.
7. The calculated outer **camera-floor quad** appears as a candidate; the system requests Blackout and revokes existing projector approval. **Drag any of the four corner handles** (or click new points manually) on the unmirrored camera picture.
8. Click **Terapkan 4 titik kamera**, inspect and check the manual camera confirmation checkbox. Camera-floor mapping uses the existing `LiveFloorTrackingEngine` and will reset any old floor event session. A changed camera, resolution, lens or projector position requires recalibration.
9. Use **S5.6.3 Camera–Projector QA** immediately below the new panel. Run five independent projected crosses one by one, select Live Test only under operator supervision, click observed light centers on the raw camera, inspect RMSE/P95, and export the QA report.
10. If auto matching is unreliable, select **Blackout / Batalkan** and use the existing manual four-corner editor. The five-point QA remains the same.

## Architecture and safeguards

- The existing `paintFloorCanvas` draws a marker test overlay in its `markersOnly` mode. The marker variant is selected only by an explicit operator button and routed through the **existing** `useProjection` live-floor transport.
- Camera sampling uses the existing `videoRef`. No new camera device, MediaPipe tracker, WebRTC room, remote API, cloud upload or stage output is opened by the marker matcher.
- S6.2 color detection is based on S6.1.3 marker hue thresholds, but uses a **Blackout baseline** to reject stationary colors. Marker candidate coordinates are measured inside the projected raster; a homography maps them back to projected raster outer corners.
- Failed/unstable matches do not save camera calibration, and any accepted draft revokes prior projection acceptance and requests Blackout **before** new calibration can be applied.
- Physical test output requires explicit **open output**, **Live Test**, and operator floor alignment. S6.2 never enables normal BODY/FLOOR live projection automatically.
- Existing physical dual-surface BODY/FLOOR proof, five-point QA, and emergency projector power cutoff remain separate.
- The output gate in Production is configured separately; this branch does not alter or disable `StageHardwareGate`.

## Known limits

1. The camera→raster mapping is trustworthy only when the projection raster has already been physically aligned to the **desired** floor plane. Four projected colors cannot prove physical floor boundaries on their own.
2. Projector color gamut, white balance, sunlight, lens distortion, and automatic camera exposure may make marker detection fail. A clean background, fixed tripod, and stable room light help. Manual four-point calibration remains available.
3. The method is for the **flat FLOOR**. It does not establish a moving three-dimensional BODY surface projection geometry. Existing BODY output calibration remains independent.
4. The five-point QA currently measures camera and floor registration based on manual clicks. It does not measure actual projector photons, foot pressure, physical power-off behavior or body occlusion by itself.
5. This is a supervised semi-auto prototype. No claim about actual on-stage centimetre accuracy is made until the operator performs field trials.

## Validation

- `tests/footprints-projected-marker-calibration.test.ts` uses synthetic projected frames and a known camera quad, and checks baseline rejection, missing colors, quadrilateral extrapolation and moving-marker failure.
- Required: `npm test` and `npm run build`.
- Preview browser test at 1440/1024/768/390 px, including pointer-drag in Chrome/Safari.
- Real device: Android/iPhone cameras, projected marker readability and two-performer stability; complete S5.6.3 five-point physical QA and store report.
- Do not promote to Production on CI alone; require an explicit release decision.
