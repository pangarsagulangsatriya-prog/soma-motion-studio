# SOMA UX 04 + UX 05 — Preview Build / Perform

This preview branch is stacked on UX 03 (Draft PR #24) and belongs to Draft PR #25. **Production has not changed.** Source test/build passed on the feature branch in GitHub Actions #490.

## Build — progressive inspector

In **Footprints Stage** the contextual inspector now has five job tabs:
- **Tracking:** source, one/two performers, camera/floor calibration; open **Diagnostik kaki dan event** only when needed.
- **Visual:** choose Campuran / Tapak / Garis / Titik. Expand **Detail visual** for size, lifetime and palette.
- **Archive:** go to the original video A/B Lower Body Mapping and Contact-to-Archive editor.
- **Projection:** legacy projector status, distinct BODY/FLOOR software state, manual QA routing.
- **QA:** physical calibration/rehearsal panel and 3D Direct Puppet Simulator; **Engineering diagnostics** is hidden until expanded.

No second camera, recording engine, motion model or floor events system was created.

## Perform — intentionally minimal local operator monitor

Press **Perform** in SOMA top navigation while Footprints is selected. The app first requests Blackout on all output sessions. The Footprints page switches into a stage monitor with large previews and a simple sticky control bar.

Monitor cue sequence, selectable directly or via GO:
1. **Overview:** live camera plus BODY and FLOOR previews
2. **BODY:** enlarge lower-body mask raster
3. **FLOOR:** enlarge metric floor pad
4. **Split:** BODY and FLOOR side-by-side

The local monitor cues change only the operator's **preview layout**. They do not issue light output cues, open projectors, play copyrighted media or automatically arm a stage device.

Operator buttons:
- **GO / Sebelumnya** changes the local cue index.
- **Hold / Resume Preview** uses Footprints' existing local visual hold; tracking and event collection stay live.
- **Rekam / Stop REC** calls the existing Footprints recorder and only allows recording with a ready Body camera.
- **BLACKOUT** sends software Blackout to legacy Projection and any mounted BODY/FLOOR routes; projector hardware power-off is separately required during a physical emergency.
- **Kembali Build** returns to the editable Footprints inspector and also sends Blackout.

Keyboard: Space or → GO, ← previous, B or Esc Blackout. Typing in a form or using a modal suppresses operator shortcuts.

## Important caveat

The operator BODY preview shows lower-body mask **geometry**, not the full selected archival footage. Entering Perform closes the Archival Mapping editor and releases its local video files, by the prior UX02 safety rule. This sprint does **not** deliver an armed live archival-performance cue system; persistent media and optical cue staging need a separate, reviewed integration. All new physical BODY/FLOOR projector controls remain gated by StageHardwareGate in Production.

## Browser QA before merge

- At 1440, 1024, 768, 390 px switch Build/Perform and all four monitor cues; verify no overlap or lost Blackout button
- Run one-person and two-person tracking, perform a crossing; confirm black BODY mask when identity unsafe
- Hold/Resume BODY and FLOOR while foot event counts keep increasing
- Verify recording, stop/save and frontend camera permission without a second acquisition
- Verify navigation back to Build, another Instrument, Archive and Projection disarms outputs
- Verify keyboard shortcuts do not fire while editing or dialogs are open
- Observe optical hardware shutdown/black level in a supervised rehearsal; CI does not certify the physical stage

Full spec: `docs/SOMA-UX-04-05-PROGRESSIVE-PERFORM.md`.
