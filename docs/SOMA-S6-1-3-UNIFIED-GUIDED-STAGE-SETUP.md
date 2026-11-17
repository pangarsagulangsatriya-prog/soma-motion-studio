# SOMA S6.1.3 — Unified Guided Setup (2026-11-17)

**Scope:** integrated Footprints Stage wizard, 4-point camera-floor editor, assisted color floor marker scan, existing CAMERA/BODY/FLOOR preview and fail-closed five-step readiness. Implemented on feature branch; Production unchanged until explicit release.

## Workflow

1. **Source**: webcam laptop, phone QR/WebRTC, or separate simulation lab. For a physical stage wizard, the source gate requires an active Body camera, a fresh tracked frame and a real video stream. A selected but disconnected HP does not count as ready.
2. **Calibration**: raw, **unmirrored** camera canvas embedded in the wizard. Click corners 1→4 and enter physical floor width/depth in metres; save to the existing `LiveFloorTrackingEngine.configure`, then manually confirm. Any point/dimension modification revokes previous projector approval through the original App blackout lifecycle and invalidates identity tracking. Camera binding detects source or resolution changes.
3. **Tracking**: read-only CAMERA/BODY/FLOOR previews copied from the existing Stage Workspace canvases (no second media stream, Body mask builder, FloorSession or projector engine). Checks camera/floor binding, one valid estimated contact, and stable A/B identities for two performers. Provides an optional S6.1.2 real-device validation drawer.
4. **Archive**: existing stored A/B video archive and direct editor shortcut; explicit **skip archive** choice supports mask-only shows. No hidden skip of earlier calibration.
5. **Rehearsal**: read-only previews and Stage project name. Perform button stays disabled until required input, geometry, identities, archive/skip and both preview surfaces are valid.

Wizard step tabs and **Berikutnya** use the same derived readiness gates; users can revisit earlier stages when the prerequisites are satisfied. Each blocked action gives a local reason rather than a silent failure.

## Assisted auto marker workflow

Four high-saturation **physical floor markers**:
- UL (kiri belakang): magenta `#EF1C9A`
- UR (kanan belakang): cyan `#02D9F1`
- DR (kanan depan): yellow `#F6D511`
- DL (kiri depan): green `#59E62D`

Place at the actual floor corners visible in the raw camera. Expand **Auto Scan · marker warna di lantai**, then run the five-frame scan. The detector tests hue/saturation, minimum region counts and convex quadrilateral geometry; it rejects unstable marker locations across frames. Resulting points remain a **draft** until the user saves and confirms.

This scan determines **camera→flat floor** corners only. It does **not** automatically measure projector homography, identify moving-leg surface geometry or authorize stage optical Live. The existing S5.6.3/S5.7.4 five-point physical calibration, independent BODY/FLOOR QA, and emergency power cutoff remain in force.

## Evidence and limitations

- `tests/footprints-guided-stage-setup.test.ts` verifies synthetic full-colour marker frames, missing markers, unstable quadrilaterals, source pairing, two-performer identity and five-step gating.
- Run `npm test` and `npm run build` on this branch, and visually test the wizard at 1440/1024/768/390px.
- Manual real-camera QA must ensure marker colour detection under actual lights and camera white balance; similar costumes/sets may confuse a hue-only detector. It deliberately rejects ambiguous frames rather than presenting false certainty.
- Real projector light must still be checked with physical five-point QA. Stage software transport status is not optical measurement.
- This release does not change hardware gates or make auto-projection Live on page load.
