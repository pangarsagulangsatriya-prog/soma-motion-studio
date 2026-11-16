# SOMA — S5.7.1 Lower-Body Mask Preview

Preview branch of Draft PR #18 (stacked on S5.7.0), Production unchanged.

## Run

Open **Studio → Footprints → Live Floor Tracking → 00 / Stage Optics & Spatial Design → 01 / Lower-Body Mask Engine**.

- **Simulation:** view a dark-stage mask of one or two synthetic moving bodies (selected by the existing performer count). Play/pause. Check `Uji tubuh beririsan` to force fail-black.
- **Live:** start SOMA Body using the existing webcam connection. The mask preview uses the currently active `MotionFrame.pose/poses`, not a separate camera. Complete pose landmarks must be visible; missing feet, stale frames and ambiguous overlaps turn the preview black.
- Adjust torso extension from hips and inward feather; optionally require segmentation data.
- No projector or floor-pad output is activated from the new mask panel. Black background is an alpha mask visualization, not physical light.

## QA

Run `npm test` and `npm run build`. Inspect two-performer movement and occlusion at actual stage lighting, and compare the preview's upper cutoff with the visible pelvis/shorts in the user's reference photo. Separate stage-optics and projector validation remains necessary.

Full document: `docs/FOOTPRINTS-S5-7-1-LOWER-BODY-MASK.md`.
