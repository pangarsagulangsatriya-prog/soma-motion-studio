# SOMA Stage 1 · Single Performer Brush — Tracking Fix
Date: 2026-11-22

## Corrected behavior
- One performer produces **one active painted line** even when both feet are visible to the pose detector.
- The single path follows one measured foot at a time. It locks the visible foot and switches after the other foot visibly moves for at least five successive fresh observations, or immediately if the active foot disappears.
- Switching feet starts a separate path. It never draws a connection between two distant feet.
- No tracked foot means no new paint. Old marks stay only while the operator uses the existing **Tetap** option; **Memudar** fades history. Changing the source clears old-source images.
- Foot orientation follows the observed heel-to-toe vector where available, with angle smoothing. Fallback heading uses movement only when toe/heel direction is missing.
- The Sapuan renderer draws one continuous stroke with one sole at its latest tip. It never repeats dozens of anatomical soles along the curve.
- Turn Jejak Kaki ON: thin lines are turned OFF by default to avoid a double visual. The existing Tampilkan garis checkbox can explicitly restore an overlay.
- Jarak cetak is removed from the panel in Sapuan because spacing does not apply to a continuous brush stroke.
- Pijakan remains discrete, using only valid contact events; it still does not manufacture contacts from image motion.
- Preview and fullscreen reuse the same canvas renderer. Physical projector gate/blackout are unchanged.

## QA cases
- One actor and two feet → one path and one footprint head.
- Moving-foot switch after sustained motion; no teleport between feet.
- Tracking dropout and repeated frames never produce invented new marks.
- Orientation follows heel-to-toe.
- Continuous canvas brush remains one stroke, with one anatomical sole, fade/keep/blackout preserved.
- Unit, build, two desktop browser breakpoints, native fullscreen, Liquid regression.

## Limits
The path is an image-space estimate until Track/Map calibration; the application has no pressure sensors. Fast occlusions and person swaps may temporarily stop the brush. Device-camera and physical projector QA still require rehearsal.
