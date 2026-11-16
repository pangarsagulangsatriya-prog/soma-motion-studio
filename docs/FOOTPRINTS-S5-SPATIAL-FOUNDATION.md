# SOMA Footprints S5.0 — Floor Coordinate & Footstep Event Foundation

**Status:** implemented as pure TypeScript library, review branch only. Production Stage-first Studio and existing Footprints stay unchanged.

## 1. One physical floor coordinate system

`src/footprints/spatial/coordinates.ts` describes a **flat** rectangular dance floor.

- **Units:** metres; field dimensions `widthM` (stage left/right) and `depthM` (downstage/upstage).
- **Origin `(0,0)`:** DOWNSTAGE LEFT, from the performer's spatial orientation.
- **+X:** stage-right. **+Y:** upstage.
- Top-down stage UV and raster/projector UV use a different orientation: origin top-left, +V downward.
- Transform: `U = xM / widthM`, `V = 1 - yM / depthM`.
- `defaultFloorSpace(8,6)` is **a software example only**. Measure the actual marked floor before using a physical projection.
- Out-of-bounds points, NaN, invalid sizes and mismatched schema versions are rejected.

### Two distinct transforms

**Camera image → physical floor**
1. Place four known physical marks on the floor: UPSTAGE LEFT → UPSTAGE RIGHT → DOWNSTAGE RIGHT → DOWNSTAGE LEFT.
2. Record those four image points as `cameraQuad`, expressed from the **unmirrored raw camera image** as 0–1 values.
3. Map the assumed grounded image contact point to the floor rectangle with a projective transform.
4. Ignore samples outside the calibrated floor or below the confidence threshold.

**Physical floor → projector output**
1. Find the corresponding four floor corners in the projector output raster, also in UL → UR → DR → DL order.
2. `floorToProjectorUV(floor,contact,quad)` returns the raster-normalized position.
3. `projectorUVToFloor` is the inverse, used for debugging alignment.
4. The new functions reuse `projection/geometry.ts`, `homography`, `inverse3`, and `transform`. No second projection window or homography library was introduced.

**IMPORTANT:** The existing `ProjectionOutput` also applies a calibration transform. A floor renderer must choose **one** of two paths:

- Draw unwarped floor UV into a floor-sized artwork and let the existing SOMA Projection transform it **once**; OR
- Draw directly into output projector UV and bypass the other spatial warp for that artwork.

Never apply the floor-to-projector warp and the current `artworkTransform` again: that would double-warp the image.

**Camera limitation:** a perspective homography only maps points **assumed on one physical plane**. It cannot determine the real landing point of a foot lifted in the air, the sole's height, pressure, or exact force. Camera events remain marked `calibrated-estimate`.

## 2. Footstep Event Model (v3)

`src/footprints/spatial/events.ts` defines `FootstepEvent`:

| Field | Description |
| --- | --- |
| `id` | Unique event ID within a session |
| `performerId` | Distinct person/rig; intended for two performers |
| `foot` | `left` / `right` |
| `kind` | `swing`, `contact`, `release`, `move`, `prediction` |
| `timestampMs` | Monotonic session timestamp |
| `positionM` | `{xM,yM}` on the floor plane |
| `headingRad` | Floor-space heading; 0 faces +X, +π/2 faces upstage |
| `source` | `camera`, `simulation`, `replay`, `legacy` |
| `positionBasis` | `calibrated-estimate`, `simulated`, `illustrative` |
| `confidence` | Relative tracking confidence, 0–1, **not a calibrated physical accuracy** |
| `joinPrevious` | Optional flag preventing unintended line joins after discontinuities |

`FootstepEventEngine` processes independent foot observations for every `performerId` and side.

- Entering a supported stance creates **one** `contact`; repeated standing does not create duplicate stamps.
- Leaving stance creates `release` at the **last known grounded position**, never at an invented airborne position.
- Moving a grounded foot beyond `moveThresholdM` creates `move`.
- A lost camera track requires seeing swing before a new contact stamp; the engine does not invent a new step at reacquisition.
- `prediction` is reserved for a future ghost-step layer and is **never** treated as a confirmed contact stamp.

## 3. Session schema and legacy compatibility

Version 3 session:
```json
{
  "schema": "soma.footprints.floor-session",
  "version": 3,
  "floor": {
    "schema": "soma.footprints.floor-space",
    "version": 1,
    "unit": "m",
    "origin": "downstage-left",
    "xAxis": "stage-right",
    "yAxis": "upstage",
    "widthM": 8,
    "depthM": 6
  },
  "events": []
}
```

`validateFloorSession` rejects invalid versions, duplicated IDs, out-of-order time, nonfinite coordinates, impossible floor points, and more than 100,000 events.

`legacyV2ToIllustrativeSession(oldJson, floor)` converts a valid V2 session for an **illustrative preview only**. V2 coordinates remain proportional stage-image coordinates; substituting a chosen floor size does not make them physical positions. Legacy events are stamped `positionBasis: "illustrative"`; `requireProjectable` blocks them from metric projection. They can be inspected through `floorSessionToPreviewSamples`, which uses the old SVG renderer for **one performer**. The function explicitly rejects multi-performer sessions rather than connecting the wrong left/right footprints.

`calibratedGaitContact` accepts one validated/debounced `GaitSample` contact stamp after camera-floor calibration. It undoes the original aspect fit and maps only confirmed-by-heuristic stance samples. It returns null when calibration, confidence, phase, or point geometry prevents a grounded estimate.

## 4. Integration boundary (next sprint)

S5.0 provides a tested data foundation. It does **not** change:

- The Live Studio camera or MediaPipe tracker.
- Footprints canvas / renderer.
- Existing Projection output, calibration state or the Blackout and Hold controls.
- Existing V2 JSON export/import behaviour.
- Physical floor lighting or tracking.

**S5.1** will connect a Direct Puppet / 3D rig to `FootstepEventEngine` and render the events onto a top-down floor preview. The same data can later enter S5.2 projector output without opening another camera.

**S5.2** must use real floor markers and a single calibrated output warp. Do not call current projection `quad` a floor calibration unless it was measured against the **floor**.

**S5.3** will bind calibrated camera contacts and tracking-loss events to the live Footprints scene.

## 5. Required tests / acceptance

Automated: `npm test` and `npm run build` in GitHub Actions.

- Physical floor↔UV round trips with inverted Y.
- Four-point skewed floor↔projector inverse alignment.
- Camera quad mapping, raw camera 16:9 fit reversal, confidence and out-of-bounds safety.
- Left/right and multiple performer event separation.
- One contact per touchdown, floor-level release, no contact duplicate while standing.
- Lost tracking does not generate a false contact at reacquisition.
- V2 illustrates but never silently qualifies for metric projection.
- V3 JSON round trip, validation and prediction-stamp separation.

**Not yet validated:** real-world calibration error in centimetres, camera optical distortion, occlusion, track swaps when two performers overlap, video latency, frame-rate with a 3D rig, and physical projector placement. These are required before any stage-readiness claim.
