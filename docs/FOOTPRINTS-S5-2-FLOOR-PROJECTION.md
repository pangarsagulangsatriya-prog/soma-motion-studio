# SOMA Footprints S5.2 — Floor Projection Bridge

**Scope:** Direct Puppet (S5.1) → common SOMA Projection output (S5.2).
**Branch:** `feat/footprints-s5-floor-projection-20261116`, stacked on the S5.1 feature branch. Do not merge straight into production before S5.0/S5.1 are reviewed.

## What has been implemented

- One hidden **1280×720, 16:9 floor artwork canvas** in the 3D Direct Puppet dialog, populated from the same S5.0 `FloorSession` and `FootstepEvent` timeline as its 2D preview.
- `useProjection` now selects the simulated floor artwork **before** the existing live camera Footprints source while the simulator is open. No second `ProjectionLink`, camera, output window, or stored calibration.
- `floorBridge.ts` derives a simulator-only view from the existing Projection config, keeping its **four-corner screen quad**, brightness and raster resolution while forcing:
  - `mirror=false`
  - `mode='screen'`
  - `registration.enabled=false`
  - `placement=placementDefaults()`
  - `motion='fixed'`
  The original saved Projection configuration remains untouched.
- The artwork canvas contains unwarped floor UV positions (`U=xM/widthM`, `V=1-yM/depthM`); the already-installed `artworkTransform` applies the shared SOMA quad **once** in the output window. Do not additionally call `floorToProjectorUV` on canvas pixels or apply a second homography.
- `ProjectionLink.sendArtwork` now avoids sending any new `ImageBitmap` during **Hold**, **Blackout** or calibration-pattern mode. Hold retains the last output bitmap; Blackout hides it and prevents new light from the simulator. A pending asynchronous bitmap is discarded if the transport is no longer Live.
- The simulator provides a **four-corner alignment test** (real raster corners, no inset) and **manual confirmation of physical floor calibration**. With no confirmation, only the corner test may be transmitted; arbitrary simulated footprints remain black.
- Camera-free projection source selection uses the existing SOMA connection. It does not require MediaPipe or browser camera permission.
- On exiting or opening calibration, the simulator returns the projector to **Blackout** and revokes its approval. The approval fingerprint covers the applied quad and output resolution, so changes demand renewed confirmation.

## Stage operator guide

1. In the S5.2 Preview, choose **Studio → Footprints → Simulasi 3D · tanpa kamera**.
2. Create two or three virtual steps by dragging a foot and releasing it; inspect the floor preview.
3. In **Floor → Projection**, click **Buka output**. The output starts in Blackout. Move that window to the physical projector screen and enter fullscreen there.
4. Click **Kalibrasi lantai**. This exits the simulator and opens the existing SOMA Projection workspace. Select **Kalibrasi**, choose screen/four-corner mapping, place its four corners on the actual floor boundary (upstage-left → upstage-right → downstage-right → downstage-left), then **Terapkan**. If desired, save that calibration under a distinct floor-specific preset name.
5. Return to Studio → Footprints → Simulator. Click **Tanda 4 sudut uji**. Click **Live**. Only four alignment crosses and the frame boundary should appear. Visually measure their alignment at the actual floor corners.
6. For any mismatch, click **Blackout**, reopen **Kalibrasi lantai**, adjust the same four-point mapping, apply it and repeat the alignment test.
7. Once physically aligned, check **Saya sudah memeriksa proyeksi empat sudut lantai**. Switching from test mode to normal artwork automatically selects Blackout. Click **Live** again: confirmed virtual footsteps can now appear.
8. Test **Hold** while changing virtual positions: the projector must keep the last artwork frame. Click **Live** to resume. Click **Blackout** to extinguish it.
9. Close the simulator. The projector must stay on Blackout until an operator chooses a new output state.

## Safety and geometry constraints

- A valid four-corner quadrilateral is a mathematical prerequisite. **It is not evidence that the physical stage was measured**. The confirmation checkbox stays under operator control.
- Floor X points stage-right; Y points upstage; the canvas has Y downward and 16:9 output coordinates. A wrong performer/viewing orientation will produce a mirrored visual floor. Use the numbered physical markers to catch it.
- The simulator draws points from `positionBasis='simulated'`, not measured foot contacts. Live Camera → physical floor remains S5.3.
- Physical stage dimensions (defaults like 8×6 m) must match the actual marked floor. Calibrate after relocating the projector, changing output resolution, or changing stage area.
- Brightness, color/visibility, ambient light, screen shape, pixel aspect, lens effects and body shadowing still require physical testing.
- Artwork projection is controlled by the **shared** transport. A second uncalibrated projection warp or independently open simulator output must never be introduced.
- The four test markers are located at the mathematical frame corners; their strokes extend inward and labels sit just inside the screen. These positions intentionally avoid misleading insets.

## Implementation files

| File | Purpose |
| --- | --- |
| `src/projection/floorBridge.ts` | Source priority, calibration fingerprint, single-quad simulator config and safe output state |
| `src/footprints/simulator/floorCanvas.ts` | Deterministic unwarped 16:9 artwork and exact four-corner test markers |
| `src/projection/useProjection.ts` | Reuse `ProjectionLink` with simulator artwork priority and safe source gating |
| `src/projection/channel.ts` | Live-only artwork frame submission; true Hold/Blackout |
| `src/footprints/simulator/FloorProjectionPanel.tsx` | UI: output window, calibration, test corners, verification, Live/Hold/Blackout |
| `src/footprints/simulator/PuppetSimulator.tsx` | Hidden projector canvas repainted from event data; physical output panel |
| `src/App.tsx` | Reuse one Projection hook and output window, revoke approval on exit |
| `tests/footprints-floor-projection.test.ts` | Single-warp algebra, raster alignment, gating, Freeze/Blackout logic, marker rendering |

## Review and release gates

Automated: `npm test` + `npm run build` pass in GitHub Actions.

Manual acceptance (not yet verified):
- Preview opens simulator with webcam disabled.
- Projection window pop-up opens black, and survives dialog interactions.
- Four corner alignment crosses physically sit at the intended floor corners.
- After explicit confirmation, two simulated performers' footprints map to the same floor as the alignment marks.
- Hold freezes the output picture for at least 5 seconds while virtual feet continue to move. Live resumes with latest artwork.
- Blackout truly extinguishes visible projection content.
- Closing simulator leaves output black and requires a new confirmation after reopening.
- Changing shared projection quad/resolution invalidates the previous approval.
- Existing live Footprints, Body Projection, Organic, archived presets and saved calibrations still work.

**Not delivered in S5.2:** measured ground-truth accuracy, physical calibration automation, webcam camera-to-floor tracking, and future-step gait prediction. Do not label this deployment production-ready without these device checks.
