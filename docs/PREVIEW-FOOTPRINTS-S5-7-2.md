# SOMA / UNPACKING — S5.7.2 Archival Video Mapping Preview

This branch previews Draft PR #19 on top of S5.7.1. **Production unchanged.** This feature does not send video to a projector.

## Run inside SOMA

1. Open **Studio → Footprints → Live Floor Tracking → 00 / Stage Optics & Spatial Design → 02 / Archival Video Mapping**.
2. Use simulation first. Set performer count to 2 in Live Floor and upload **your own** leg/feet footage for Performer A and Performer B (MP4/WebM/Ogg/MOV supported when your browser codec permits it, max 300 MB each). No archival footage is preinstalled.
3. Click **Putar video**. Choose separate speeds, zoom/crop, pan, contrast, brightness, film grain, opacity, and negative inversion for each performer. The compositor clips every grayscale video to its own lower-body mask.
4. Test **Uji crossing / blackout**. When two masks overlap, preview must become black.
5. Switch to **Live SOMA Body** once the existing camera is running and calibrated. Both two-person IDs must be stable in the same pose frame; uncertain identity, lost body landmarks, absent segmentation, and stale frames produce black.
6. Export settings JSON. It contains video **filenames/settings**, not video bytes. Retain source videos and their provenance/rights separately.

## Limits

This is a 160×90 preview updated at up to 15 FPS; not a measured physical projector mapping system. Body depth/perspective, projector calibration, optical spill, hardware blackout, archive source verification and contact-to-archive dramaturgy remain future stages.

Read `docs/FOOTPRINTS-S5-7-2-ARCHIVAL-VIDEO-MAPPING.md` for full specifications and QA gates.
