# UNPACKING / SOMA — S5.7.1 Lower-Body Mask Engine

**Branch:** `feat/footprints-s5-7-1-lower-body-mask-20261116`
**Depends on:** S5.7.0 Stage Optics & Spatial Design; S5.6.4 Physical Acceptance.
**Release:** Draft branch only; current single Projection output and Production unchanged.

## Visual contract

The user’s stage reference shows two bodies isolated in a black box from around the abdomen/shorts to bare feet, with isolated white footsteps below. S5.7.1 supplies **only a moving lower-body alpha-mask geometry**. There is no video archive compositing, body-projector calibration, floor-pad event bridge, active dual projector transport or artificial physical-contact claims here.

The top of each body mask follows a point along the **hip → shoulder vector**, adjustable 0–35% of the torso from the hip, initially 19%. This is a **camera-relative ratio**, not the 1.27 m physical height band defined in S5.7.0. S5.7.2/3 need an actual calibration between camera body pixels and physical body/projection.

## Engine

`src/footprints/stage-optics/LowerBodyMaskEngine.ts` takes the **existing** `MotionFrame`:
- Single actor: `frame.pose` or one `frame.poses` entry.
- Two performers: two distinct `frame.poses` from SOMA’s body tracker; there is no new camera/video stream.
- Each required limb point must have normalized in-frame coordinates and confidence above the threshold (default 0.58): shoulders 11/12, hips 23/24, knees 25/26, ankles 27/28, heels 29/30, feet 31/32.
- Geometry: one pelvis band, two thighs, two shins, and ankle/heel/foot capsules per detected person. Output is one grayscale `BodyMask` with 160×90 pixels by default plus source polygons. The face, upper chest, arms, and background never form part of the intended geometry.
- Segmentation: if the optional `frame.segmentation` union mask is present, it can **only reduce alpha** inside the shape polygons. The segmentation does not contain stable A/B identity. When segmentation is unavailable, the preview explicitly labels the result as a landmark-only geometric estimate; an optional safety setting can require segmentation and fail black.
- Feathering happens **inward within the allowed geometry**, so alpha does not spread above the top cutoff or beyond mask boundaries.
- Tracking loss, stale data (>450 ms), a missing foot/hip point, unexpected performer count, or spatial overlap in two bodies returns a zero-alpha raster. A/B identities at crossing still depend on the existing `TwoPersonIdentityTracker`; a locked-ambiguous identity also blacks out the preview.

## Operator preview

Open **Studio → Footprints → Live Floor Tracking → 00 / Stage Optics & Spatial Design → 01 / Lower-Body Mask Engine**.

Select:
1. **Simulation** for synthetic two-pose walking on a black background (can animate/pause). Enable the crossing/overlap checkbox to verify the blackout response.
2. **Live SOMA Body** to reuse `frameRef` from the current camera. The preview canvas displays an alpha mask on black, not raw camera footage and not projector light.
3. **Torso extension** 0–35% of hip-to-shoulder geometry.
4. **Inward feather** 0–6 preview pixels; low-res result supports safety/shape inspection, not stage-resolution output.
5. **Require segmentation** to blank the geometry if the captured frame has no silhouette mask.

A 2-person setting expects two valid people; a solo setting expects one. The preview will not force an unrecognized person into the wrong identity track.

## What still needs physical validation

- Bare feet moving at actual stage heights, including lift, drag, planted pivot and low foot clearance.
- Black upper body during leaning, turning, squatting and when upper camera/pose landmarks move outside the frame.
- Projector alignment to live moving body surfaces; one RGB camera provides a planar-camera approximation, **not** depth-accurate projection mapping.
- Mixed light: body archive footage and floor pad simultaneously without spilling onto stage walls, audience, torso, or actor face.
- Identity and segmentation behaviour when two actors cross. Current union segmentation and simple geometry intentionally BLACK OUT when occlusion makes attribution unreliable.
- Real camera FPS, CPU raster cost, output renderer latency, projector brightness spill and safety when a physical projector actually runs. Synthetic unit tests cannot prove these.

## Regression

`tests/footprints-lower-body-mask.test.ts` includes isolated two-person pose geometry, no head light, single/two-person mode rules, overlap blackout, missing toes, stale tracking, optional union segmentation intersection, inward-only feather, stable input data and unsafe parameter rejection.

Use `npm test` and `npm run build` before PR review. The Stage Optics design drawer is unchanged except for a lazy-loaded preview. **The new mask never calls `useProjection`, sends to the output bridge, or changes floor-event data.**

## Roadmap

**S5.7.2 — Archival Video Mapping**: combine monochrome feet/worker-route archival footage with this alpha mask in a new preview compositor. Define clip ownership, texture scale, playback and fragment aging.

**S5.7.3 — Contact-to-Archive Bridge**: couple gait and pad events to archive behaviour after testing a single performer, then two performers.

**S5.7.4 — Dual-Surface Calibration**: physical body vs. floor projection coordinate frames, output windows and independently verified Blackout; avoid mapping a 2D camera silhouette directly onto an uncalibrated 3D human body.

**S5.7.5 — Rehearsal QA**: measured upper-body light spill, dynamic registration and actual foot-to-light latency.
