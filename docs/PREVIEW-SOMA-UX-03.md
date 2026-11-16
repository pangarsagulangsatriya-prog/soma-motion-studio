# SOMA / UX 03 — Unified Stage Status & Transport Preview

This preview branch is based on UX 01/02 (#23) and includes UX 03 Draft PR #24. **Production is unchanged.** All GitHub Actions tests/build passed on the feature commit (`2408fb72`, run #471).

## What changed

The Footprints Stage landing page has one compact five-signal status bar and one sticky transport dock. Legacy generic Studio transport remains available when selecting an instrument other than Footprints.

### Status from real SOMA sources

1. **Kamera** — off / connecting / wrong Body source / tracking / lost / error
2. **Performer** — one person / stable A+B / ambiguous or lost identity
3. **Lantai** — not calibrated / awaiting confirmation / camera mismatch / camera-calibrated estimate
4. **BODY Output** — unopened / disconnected / Blackout software command / limited test / Live command
5. **FLOOR Output** — distinct from BODY; independently reported by the physical output routing panel

When the physical output panel is closed or the report is older than 900 ms, the status reports offline rather than preserving an obsolete Live badge. A Production build with physical hardware routing disabled visibly reports **Terkunci di Production**. The small legacy output label is distinct from these two output channels.

### One operator dock

- **Kamera / Stop Kamera**: reuses the current Body acquisition. Stop while recording requires confirmation. It requests global Blackout, revokes camera-floor calibration, resets A/B identity and then stops camera.
- **Rekam / Stop REC**: uses the original Footprints video recorder, disabled when camera Body isn't ready; Stop remains available while recording.
- **Capture**: opens the existing Footprints Capture Hub.
- **Live / Hold**: controls the local Studio **visual preview**, not hardware projector light.
- **Output QA**: opens the actual S5.7 archival/dual-surface controls and independent five-point physical QA; the operator may activate hardware Live there only after the existing safety gates succeed.
- **BLACKOUT**: remains available even when camera or projector is disconnected; sends a request to Studio Projection and both active BODY/FLOOR routes.

### Test in a browser

1. Open Footprints on the preview build. With camera off, expect no green tracking badge; press Kamera.
2. Choose Body source, grant camera permission and stand in full view; verify tracking status and separate BODY/FLOOR preview.
3. Select 2 performers; have A and B cross. Expect an identity warning when assignments become ambiguous.
4. Finish four-point camera-to-floor calibration in the existing QA panel, return to the main page and confirm that contacts continue updating FLOOR.
5. Start Footprints video recording, then Stop REC, Capture, Preview Hold and Preview Live. Verify all operations use the existing studio recording/visual state.
6. Open Archival Mapping, load your own A/B video clips, enable the Contact-to-Archive Bridge and (on supervised **development hardware only**) inspect the separately labeled BODY/FLOOR output sessions.
7. Click the sticky BLACKOUT while the archive output panel is open; check that its output commands update immediately. This is not a certified hardware shutter.
8. Check viewport widths 1440, 1024, 768 and 390px; the status bar, inspector, and critical Blackout must remain reachable without overlapping.
9. Confirm that closing the archive output panel clears the two physical-output statuses instead of leaving a phantom LIVE state.

Full technical and QA notes: `docs/SOMA-UX-03-UNIFIED-STATUS-TRANSPORT.md`.

## Remaining gates

User-facing visual/browser QA and physical stage observation haven't been performed here. The PR stays Draft. Physical projector hardware remains disabled in Production without explicit S5.7.4 opt-in and stage acceptance.
