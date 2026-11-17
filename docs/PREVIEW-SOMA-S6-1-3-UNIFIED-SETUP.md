# SOMA S6.1.3 — Unified Guided Setup Preview

Preview branch: `preview/soma-s6-1-3-unified-setup`  
Feature PR: #30 (Draft) · GitHub Actions #601 passed: **307 tests**, `npm run build` passed.  
**Production unchanged by this PR.**

## Operator flow

1. Open the **HTTPS Preview** on laptop, Footprints → **Guided Setup**.
2. **Sumber**: start the laptop camera or choose HP and scan QR. The Next button stays disabled until actual live Body video is tracked. Simulasi 3D opens a separate lab and cannot masquerade as physical calibration.
3. **Kalibrasi**: click four corners of the physical floor in raw **unmirrored** camera video, ordered upper-left → upper-right → lower-right → lower-left, and enter width/depth in metres. Press `Simpan empat titik`, visually inspect, then `Konfirmasi Kamera`.
4. Alternatively, at four floor corners place large vividly coloured fiducials: magenta #EF1C9A (UL), cyan #02D9F1 (UR), yellow #F6D511 (DR), green #59E62D (DL). Expand **Auto Scan · marker warna di lantai**, click `Pindai empat marker`, inspect the detected quad. Five scans are needed with <2.5% positional variation. **Confirm manually**, never auto-arm projection.
5. **Tracking**: walk until the existing FloorSession logs at least one estimated foot contact. The CAMERA, BODY and FLOOR preview cards copy the actual existing Stage Workspace canvases. Two-performer mode needs a matched frame containing two unambiguous identities.
6. **Arsip**: enter Archival Mapping and attach A/B original videos; or explicitly check `Lewati arsip` for a mask-only show.
7. **Latihan**: inspect CAMERA/BODY/FLOOR previews. The `Buka Perform Monitor` control stays disabled until prerequisites and valid BODY/FLOOR previews are ready.

## Acceptance/limitations

- The existing **camera-floor** calibration and marker scan do not automatically estimate camera-to-projector homography. Keep five-point optical QA and separate BODY/FLOOR manual acceptance.
- A colour-based detector may be confused by costume/lighting of similar hues. Missing or moving markers must fail; manual corner placement always works.
- The wizard never opens a new camera/MediaPipe instance and never sends a physical projector Live command.
- Switching camera, resolution or modifying floor geometry invalidates the prior confirmation and projector approval. A new manual camera confirmation is required.
- Check 1440/1024/768/390px, camera from HP, perform crossing A/B, missing marker, blocked Step 2/3/4/5, and closed/reopened wizard.
- Existing Production projector opt-in remains separate. Hardware Blackout and physical emergency power cutoff must still be checked in rehearsals.

Live HTML and WebRTC camera pairing must be checked in the Vercel Preview environment; CI does not validate camera hardware, marker paper or optical photons.
