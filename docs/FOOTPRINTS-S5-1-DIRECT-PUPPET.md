# SOMA Footprints S5.1 — 3D Direct Puppet

**Status:** working UI implementation in a separate feature branch. Built on top of S5.0 floor-coordinate and footstep-event foundation. S5.1 should be reviewed as a stacked PR, before any production merge.

## What is actually implemented

**Camera-free interactive software 3D.** S5.1 renders a perspective lower-body rig using a small deterministic 3D camera and the browser's Canvas 2D rasterizer. The pose is defined in real X/Y/Z coordinates (metres), with camera yaw, elevation, perspective, and unprojected cursor rays. This is a functional interactive 3D scene, **not** a photorealistic anatomical character, WebGL/Three.js scene, or clinical gait simulator. Zero new dependencies.

Files:
- `src/footprints/simulator/scene3d.ts`: physical 3D camera and inverse mouse-ray/flat-floor intersection; hip/knee/ankle/sole rig.
- `src/footprints/simulator/draw3d.ts`: grid, stylized lower limbs, ankle selection outlines, foot orientation and confirmed foot contacts in perspective.
- `src/footprints/simulator/puppet-controller.ts`: lift/drag/rotate/land gesture controller on shared `FootstepEventEngine`; two independent performers; event timeline and approximate replay pose.
- `src/footprints/simulator/floor-artwork.ts`: SVG generated from S5.0 floor session, multi-performer footprints, optional trails, grid and timeline filter.
- `src/footprints/simulator/PuppetSimulator.tsx` + `simulator.css`: modal workspace, 3D view, floor preview, pointer & keyboard controls, recording/replay, JSON/SVG/PNG export and V3 session import.
- `src/studio/v3/ScenePicker.tsx`, `SceneInspector.tsx`, `src/App.tsx`: entry from the existing Footprints visual mode. Camera permissions are not required to open the simulator.
- `tests/footprints-direct-puppet.test.ts`: software projection inverse, gesture/event integrity, two performers, replay, and SVG export.

## How to open and play

1. Open SOMA Studio → choose **Footprints** in the Scene Picker.
2. Choose **Simulasi 3D · tanpa kamera**, or use the **3D Direct Puppet** button in the Footprints inspector.
3. Click a virtual foot and drag it to another floor position, then release. The foot lifts while dragged. On release, the S5.0 Footstep Event Model emits one **contact** stamp.
4. Drag the empty background to orbit the camera. Scroll over 3D view to zoom. The Floor Preview on the right renders the resulting path from the same physical floor coordinates.
5. Select one or two performers. Their left/right feet and contact events are kept separate.
6. Export **JSON** to save the V3 floor session; export **SVG / PNG** for the flat artwork. **Putar ulang** replays the recorded swing/contact events without the camera.
7. Optional keyboard after focusing the 3D canvas: `1` left foot, `2` right foot, `3` select performer B's left foot when two performers enabled, `Space` lift/land, `W/A/S/D` move in 0.16 m increments, `Q/E` turn by 15°.

## Measurement and provenance

- The demo floor defaults to **8 × 6 m**, with software presets 6 × 4 and 10 × 7 m.
- Floor X points stage-right, Y points upstage, Z is above the floor. All event positions use metres.
- A mouse gesture produces `source:'simulation'`, `positionBasis:'simulated'`; no camera measurement or physically confirmed ground-force event is implied.
- A virtual foot creates a stamp only when landing, while every drag move records a `swing` event. Footstep contact engine is reused from S5.0.
- Projected footprint positions are previewed in two views via the same floor space.
- Imported V3 JSON is validated through `validateFloorSession`; input replaces the current session with confirmation. Existing V2 JSON remains usable through the S5.0 adapter but direct V2 import into this workspace has not been exposed yet.

## Deliberately outside S5.1

- The stage projector **is not connected** to the new simulator. S5.2 will transport simulator floor artwork through the **existing** SOMA Projection link and a **single** calibration transform. S5.1 workspace marks `PROJECTOR DISCONNECTED` explicitly.
- No camera/body pose tracker is started; no second camera or projection settings are created.
- The puppet uses an illustrative two-leg skeleton, not physically constrained inverse kinematics or measured gait.
- Replay reconstructs positions from event samples and does not perform motion interpolation; fast movements may look stepped.
- Gestural interactions, accessibility, touch and device performance have not yet been validated on an actual production laptop/projector.
- Recording/replay is kept in the workspace for S5.1; unified Capture Hub integration can follow in S5.2.

## Manual acceptance tests to run before merging

| # | Action | Required result |
|---|---|---|
| 1 | Studio → Footprints → Simulasi 3D with camera OFF | Simulator opens without browser camera prompt |
| 2 | Click-drag left foot, release | Foot lifts, moves through 3D, lands and makes exactly one footprint on 2D floor |
| 3 | Click-drag right foot, use different direction | Separate right-foot stamp, correct heading |
| 4 | Drag blank 3D space and scroll | Camera orbits and zooms without moving a foot |
| 5 | Enable 2 performers; move performer B's right foot | B's footprint uses separate colour and identity |
| 6 | Select foot, press Space / WASD / Q/E | Lift, translate, rotate and land without keyboard affecting SOMA underneath |
| 7 | Click Putar ulang | Event timeline replays to the final footprint; direct editing restores live mode |
| 8 | Export JSON/SVG/PNG and re-import JSON | Saved files open; V3 session matches event positions and IDs |
| 9 | Change floor preset with existing events | Warning before erasing session, fresh floor dimensions used |
| 10 | Narrow viewport around 390×844 and 768×1024 | Canvas, controls and Close button remain accessible without clipping |
| 11 | Open/close simulator 3–5 times | No stuck overlay, duplicate camera, or lost Studio state |
| 12 | Check output controls | No claim that simulated footsteps are projected onto physical floor yet |

GitHub CI must pass `npm test` and `npm run build`. Real-world visual and input testing is still needed. Keep the S5.1 PR draft until these acceptance tasks are checked.
