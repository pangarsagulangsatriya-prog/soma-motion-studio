# SOMA / UNPACKING — S5.7.3 Contact-to-Archive Bridge Preview

The preview branch contains S5.7.3 on top of S5.7.2. Draft PR #20 is still open. Production is unchanged.

## Practical preview

1. Open **Studio → Footprints → Live Floor Tracking → 00 Stage Optics → 02 Archival Video Mapping**.
2. Select one or two performers. Upload your own grayscale/suitable footage of legs and feet walking, for example footage from agricultural paths, industrial routes or docks. Separate A/B archives are supported.
3. Press **Putar video** and choose **Simulasi gerak tanpa kamera** first.
4. In **03 / Contact-to-Archive Bridge**, select **Aktifkan Bridge**. At the next simulated contact, the relevant person's video briefly freezes; a thumbnail of that exact video is left on the separate black **PAD / FROZEN ARCHIVE RESIDUES** preview.
5. Each contact gets one residue. At the sample slide event, a short drag line appears and no second contact stamp is made. Release and subsequent steps do not erase old residues. Changing clips, performer count, source, or resetting the loop clears the prior take.
6. Set hold duration (0–1500 ms). Reset deliberately for a new exploration. Use **Ekspor event JSON** for event IDs, coordinates and counts — no video bytes are included.
7. For camera mode, confirm the existing floor calibration and A/B tracking first. The bridge deliberately starts at the current session tail so old contacts do not flood the pad. Occlusion, stale bodies, missing video data or unconfirmed calibration force black preview and no queued catch-up.
8. Verify the pad and body live in **two separate preview canvases**. This sprint does not alter the actual Floor Projection transport or send archival pixels to stage projectors.

## Acceptance and limits

CI tests verify repeat-resistant contact handling, A/B independent holds, drag vs new stamp, cleanup, camera safety, source filtering and JSON hygiene. Physical stage tests remain outstanding: no optical split, 3D body correction, pressure measurement, projector calibration or real photon latency is certified.

Full technical specification: `docs/FOOTPRINTS-S5-7-3-CONTACT-ARCHIVE-BRIDGE.md`.
