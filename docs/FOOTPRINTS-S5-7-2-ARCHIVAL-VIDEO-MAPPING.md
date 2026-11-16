# UNPACKING / SOMA — S5.7.2 Archival Video Mapping

**Branch:** `feat/footprints-s5-7-2-archival-video-mapping-20261117`
**Base:** S5.7.1 Lower-Body Mask Engine. **Draft PR / preview only; Production unchanged.**

## Source and visual rules

The stage image references two isolated bodies visible from shorts/abdomen to bare feet, white path fragments at their feet, and a surrounding black box. The requested imagery in earlier design discussions includes **actual archival legs and feet from agricultural routes, industry, and harbours**. S5.7.2 lets the operator upload their own existing local film clips for A and B. No archive footage was provided with this sprint; the code does **not** generate replacement footage or claim any uploaded video is historically verified.

Black/white output is formed by the *video texture within each tracked lower-body alpha mask*. Unilluminated floor, upper torso and background stay black inside the digital preview. Actual projector black level and optical spill require subsequent stage testing.

## Implementation

- New pure `ArchivalCompositeEngine.ts` operating on independently returned `perPoseMasks` from S5.7.1 (160×90 default), grayscale video frame RGBA buffers and validated visual controls. Each performer has their own brightness, contrast, scale/crop, XY offset, invert, playback speed, grain and alpha. 
- The full source image is sampled against the **per-pose bounding rectangle**, so the texture follows its wearer in camera preview coordinates, rather than being one enormous screen-wide image. The two channels are composited to a black RGB frame. Alpha outside the mask remains black; inward feather comes from S5.7.1.
- Input video is selected via local browser File input, using object URLs. Accept MP4, WebM, Ogg or MOV types up to 300 MB, *provided the browser codec supports the actual file*. Videos are muted and looped; playback requires the user to press Putar. Uploads do not leave the browser. Object URLs are revoked when replaced, cleared or the panel unmounts. The JSON export stores **file names and settings only**, not video bytes.
- One SOMA Body RGB source is reused. No second camera, camera ingestion, paid service, remote URL, persistent video storage or projector output added.
- **Identity safety:** a live two-person frame must use pose-index assignments supplied by the existing `TwoPersonIdentityTracker` as exposed by `MultiPoseGaitRouter.status.poseIndices`, with a matching `observedFrameTime`. Raw MediaPipe detection order cannot be assumed persistent. Both assignments must be present and unambiguous. During overlap, missing segmentation, lost tracking, or unmatched/stale identities, the composite returns opaque black. A lone performer uses channel A.
- S5.7.1 geometry is still approximate. Live preview now requires the existing segmentation mask to be available, but this is a **union**; it does not isolate identities or provide a 3D depth map.
- S5.7.2 adds UI only under **Studio → Footprints → Live Floor Tracking → 00 / Stage Optics → 02 / Archival Video Mapping**. The original 01 Mask Engine and FloorSession V3 events are unaffected. Neither `ProjectionLink` nor `useProjection` is invoked.

## Operator procedure

1. In Studio start an existing SOMA Body camera, or keep the preview on **Simulasi**.
2. Set performer count to 1 or 2 in Live Floor. Open the new **02 Archival Video Mapping** drawer.
3. Upload a clip for Performer A and optionally a different clip for Performer B. Use *actually cleared/owned archival footage*. Filenames should identify source and context, not just “archive 01.”
4. Press **Putar video**; adjust crop/zoom to keep the visible action on thighs and feet. Use black-and-white output, moderate grain and restrained contrast so performers' natural edges remain visible. Controls can differ between A and B.
5. Switch to **LIVE SOMA CAMERA** only when calibration and tracking have confirmed both performer IDs. Confirm video doesn't jump between bodies during a cross; ambiguous overlap must black out.
6. Press **Ekspor pengaturan JSON** to retain the choices with filenames. Keep source footage, provenance metadata, performance rights and timestamps separately.

## Required verification

- Test video A with agricultural foot-walking footage and B with industrial or harbour-route footage **supplied by the operator**. This sprint has no embedded archival sample.
- Confirm clear-to-black transitions with missing A/B video, failed codec, paused upload, missing limb, lost camera, two-person crossing and identity flip.
- Verify actual pixels outside the mask are black. Validate tone, crop and playback controls against real video at different aspect ratios.
- Measure browser CPU/render FPS; preview presently samples two small 192×108 video frames and renders 160×90 lower-body mask at at most 15 FPS. That is a preview budget, not live projector performance.
- Validate projection optics separately: body camera position and real projector perspective do not align automatically. Per-pose sample masks have no 3D surface correction; they do not follow actual moving body depth or guarantee no light on upper torso.
- Confirm independent footage permissions before performance. Do not invent provenance for videos selected by users.

## Automated regression

`tests/footprints-archival-mapping.test.ts` checks:
- Independent A/B clips, grayscale output and black pixels outside per-pose masks.
- Missing second clip stays black on that person, without duplicating the first clip.
- Pose-index reversal requires explicit reassignment; unknown, stale and duplicate indices fail black.
- Occlusion, stale frame and tracking loss cannot output archive pixels.
- Crop/zoom/brightness/grain/opacity preserve mask clipping; invalid controls and invalid pixel buffers fail appropriately.
- Exported session contains only filenames/settings and `projectionReady:false`.

Run `npm test` and `npm run build`. The final on-stage acceptance still depends on S5.7.4 dual-surface calibration and S5.7.5 physical rehearsal.

## Follow-up

**S5.7.3 Contact-to-Archive Bridge:** connect the *existing* S5.6.2 foot events to optional archival playback consequences. Event timing should have observable dramaturgical consequences rather than trigger a generic visual effect. A/B identity must stay reliable and fail black when uncertain.

**S5.7.4 Dual-Surface Calibration:** establish projector body plane vs. floor quad and independent output controls; archival compositor does not send photons.

**S5.7.5 Stage validation:** document measured spill, frame delay, identity swapping and physically observed image-to-skin registration.
