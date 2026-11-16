# UNPACKING / SOMA — S5.7.0 Stage Optics & Spatial Design

**Branch:** `feat/footprints-s5-7-0-stage-optics-20261116`, stacked above S5.6.4. Draft, **Production untouched**.

## Reference and visual contract

Source: the user's stage image provided 16 November 2026. Black-box space, two performers separated at first, illuminated below a soft waist/abdomen boundary, barefoot feet and white floor-pad footprints. Keep upper torso, faces, audience, backstage and floor outside the active pad dark. The actors need not remain permanently separated; walking and crossing remain available.

**Design outputs in S5.7.0**: optically plausible zones, saved device coordinate assumptions, beam overlap risks, body cutoff height, simple visual plan/elevation and operator QA. No independent live dual-projector transport, body segmentation or 3D body mapping is shipped in this stage.

## Coordinates and geometry

Reuse `FloorSpace V1`: downstage-left origin (0,0), +X stage-right, +Y upstage, +Z vertical. Use 8 × 6 m as **illustrative planning default**; 6 × 4 and 10 × 7 m presets are available in Studio's Stage Optics drawer. The actual theatre must be physically measured.

At 8 × 6 m, the two zones are derived from 0.65 m side margins, a 0.8 m central gap and 0.65 m up/down margins:

- **Zone A**: x≈0.65–3.60 m, y≈0.65–5.35 m.
- **Zone B**: x≈4.40–7.35 m, y≈0.65–5.35 m.
- **Crossing corridor**: x≈3.30–4.70 m, y≈2.04–3.96 m, accessible to both performers.
- **Floor pad**: the existing metric floor event plane, with visual pad/sensory field subject to later cue design; it is **not** a claim that a physical pressure-sensitive pad has been installed.
- **Body illumination height**: default 1.27 m from stage floor, adjustable 0.8–1.6 m in planner, with conceptual 7 cm feather at the upper edge. Top height references a stage design band and must be adapted to performer anatomy in physical calibration. Mask in S5.7.1 must include lower abdomen/waist and exclude face/upper body.
- **Two performers**: begin apart; contact and archive can cross through the central lane. The actors do not need to stay inside separate rectangles throughout the performance.

## Provisional equipment coordinates

Coordinates are rehearsal hypotheses, *not* surveyed rig points.

| Device | Initial XYZ (m) for 8×6 | Function |
| --- | --- | --- |
| CAM | (4, −4, 2.8) | Existing SOMA RGB body / pose tracker, aimed upstage |
| PB | (4, −3.7, 4.3) | Single shared lower-body archival projection in 2-projector design |
| PF | (4, 3, 5.4) | Overhead-oriented floor artwork projector |
| PB2 | (6.16, −3.7, 4.3) | Optional second body-only projector when switched to 3-projector layout |

For 2-projector mode, **PB** covers moving performers A and B; **PF** handles floor pad. For 3-projector mode, PB should be re-aimed to A and PB2 to B, with independent calibration and light control. One camera still supplies SOMA Body data; multiple cameras or marker-based motion capture are not added.

### Physical optical requirements

- Gather projector **make/model, actual lens throw ratio range, installation height, lens shift, image resolution, installation orientation, physical beam path**, and camera's measured horizontal/vertical field of view before choosing final positions.
- A throw ratio estimate in the planner divides **3D device–target reference distance by intended image width**; it is only a coarse exclusion check. Real lens throw distance is normally measured relative to the target/screen plane and depends on lens/zoom, tilt, keystone, optical shift, and target geometry. **Do not order equipment or rig lights from these estimates.**
- Footprint mapping uses a flat-floor homography already in SOMA. Moving body surfaces are 3D/nonplanar and require a future dynamic body mask and spatial mapping, not the same floor quad.
- Body projector lights must not illuminate faces, audience, ceiling or backstage during walking, bending and crossing. Blackout is a hardware-observed requirement; a black software canvas may still leak light.
- Camera tracking must see feet through each movement and crossing. RGB pose can fail with deep blackout, projector pattern, shadows and occlusion. Test low-level fill, lens exposure, physical camera position and camera video histogram empirically; never assume a second sensor, IR compatibility or perfect darkness.
- Check cable trip hazard, light source in performers' line of sight, rigging load safety, projector cooling, lens beam obstruction, actor skin reflection, and stage floor contrast.
- A floor projector can cast large shadows around standing actors even when the artwork is only at their feet. Test overhead geometry and light-spill at several positions instead of relying on a simulator drawing.

## Three distinct spatial surfaces

1. **Lower body mask**: a dynamic illuminated region following pelvis/knees/legs, feathered above waist and clipped to stage body; will be implemented in S5.7.1.
2. **Archive layer**: desaturated archival footage of walking legs in agricultural, industrial, harbour routes; should retain irregular visual texture and mapping imperfections; will be implemented in S5.7.2.
3. **Floor pad**: existing FloorSession V3 contacts, slide events and routes, mapped to physical floor once; artistic feedback to body footage planned for S5.7.3.

Single timeline/event source should feed both independent projection outputs; physical output ownership, per-output calibration and emergency blackout routing still need engineering after S5.7.0. Presently SOMA has one shared Projection window with Floor-only mode; this design tool **does not imply it already drives two projector windows**.

## How to use in Studio

Open **Studio → Footprints → Live Floor Tracking → 00 / Stage Optics & Spatial Design**. Select 2/3 projector mode and actual floor dimensions. Check top-down/elevation views, adjust upper body illumination band and chosen device XYZ. Enter throw ratio and FOV values only from actual specifications. Inspect warnings, export `SOMA-S5-7-0-stage-optics-plan.json`.

This drawer stores design locally while open and exports a standalone plan. It does not modify current SOMA camera/floor/projector calibration, nor enable Live, Hold or projector transmission.

## Physical Stage Optics acceptance protocol (still outstanding)

1. Survey measured stage X/Y/Z and rig points. Mark two lateral performer start zones and a shared crossing area. Record a 15-second walk across centre and both side limits.
2. Test **PB only**: project a neutral white/black low-body cutoff on each performer while stepping, lunging, turning and bending. Record the **highest illuminated body point** and unintended spill onto face/chest/wall at each stop.
3. Test **PF only**: test pad light spots in heel, toe and centre positions while performers walk across. Record cast shadow, foot disappearance and floor light falloff.
4. Test **PB + PF** together: measure whether beams collide, crossing changes visible masks, brightness causes RGB tracking loss, or one projection washes out the other.
5. Test CAM-only with scenic lighting set to realistic performance conditions, *not bright rehearsal mode*. Observe tracking confidence, two-performer swaps, heel visibility, missed contacts and fallbacks.
6. Trigger **Blackout**, projector loss, camera loss, recover and repeat. Verify no unexpected live image reappears without fresh operator control.
7. Verify actual projector throw/lens shift with the manufacturer calculator, test pattern or optics contractor. Photograph every physical setup and keep its configuration separate from the JSON planning estimates.

### Proposed design-review conditions (not software proof)

- Both performers can move through full lane plus crossing area; no required movement forces stepping outside the visible floor field.
- Whole face, upper torso and audience remain dark in recorded rehearsal; upper-body cutoff stays soft and stable during bends and jumps.
- Body archival area and contact floor pad each remain legible; shoe shadows and projector flare are documented and acceptable to the performance team.
- Per-output Blackout is demonstrated with actual hardware. 2-projector vs 3-projector choice is justified by test footage, masking, beam obstruction, pixel density and available lenses.
- Camera pose/feet detection is adequate under the very lighting that will be used live; S5.6.4 measurement still governs physical contact reliability.

**Next:** S5.7.1 — Lower-Body Mask Engine; begin with 3D/2D simulation and internal renderer test before using moving bodies in Production.

## Reference for physical throw calibration

Epson's installation documentation ties physical throw distance to image size, zoom/lens range and lens offsets:
https://files.support.epson.com/docid/cpd5/cpd55708/source/setup/reference/plpc4040_plhc5040ub/projection_distance_plpc4040_plhc5040ub.html

The JSON planner purpose is research/prototyping, not certified rigging or a numerical reproduction of the photographic reference.
