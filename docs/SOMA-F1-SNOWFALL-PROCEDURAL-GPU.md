# SOMA FLOOR — F1 Snowfall & Procedural GPU

**18 November 2026 · integrated into Footprints Stage (existing FLOOR pane)**

## First complete interactive scene

1. Open **SOMA → Footprints**. Select the input (Webcam, Phone, MP4, 3D Direct Puppet or Touch Demo).
2. In the existing **FLOOR** pane select **SCENE → Snowfall · Procedural**.
3. Touch Demo: tap/click on the pad six times at separate positions. The counter reads **6 jejak**, each footprint remains visible and gradually refills with snow.
4. **Jeda** freezes scene and ignores intermediate contact input; **Lanjut** resumes cleanly without printing the backlog. **Reset salju** restores the full snow field, consumes historical event IDs and resets the mark count.
5. **Atur** changes snowfall intensity and approximate recovery time; the default is 55% snowfall, 75 s recovery time constant. The print has heel, arch, ball and toe geometry, mirrored for left and right, oriented using the actor's last movement vector when known.
6. Select **Footprints** to return to the existing FloorSession footprint renderer. Other Stage controls, INPUT, BODY, Quick Start and Projector remain in place.

## Data architecture

`FloorInteractionEngine` contains the five-source bus and exposes a monotonically increasing `generation`. Source change and MP4 seek/loop reset its generation. `SnowfallScene` consumes only events with `kind=contact/touch` and `verified=true`; `presence`, `movement`, anonymous crossing observations and stale tracking cannot stamp.

- **Source adapters:** webcam, phone, video MP4, direct puppet and touch continue through the F0 bus. No second camera or AI model.
- **Snapshot ingestion:** deduplicate on `generation + event.id`; a 480-event rolling buffer can be polled repeatedly without duplicating prints. Reset/import/seek safely invalidates old marks.
- **Two performers:** marks retain actor ID, foot, source, and XY. A/B crossing quarantine remains owned by F0; the scene does not infer an otherwise missing contact.
- **Heightfield:** CPU Float32 density grid 320 × 180, starting as unbroken snow; each unique stamp reduces density along a foot-shaped region. Recovery approaches original snow level smoothly as elapsed time passes. History retains up to 200 marks; displayed unique counter is independent of snowfall fade and never grows from standing still.
- **GPU visual:** WebGL2 `R8` texture updated from the density grid, shaded by a fullscreen procedural fragment shader at 1280 × 720. Layered granular noise and falling flakes respond to snowfall intensity. 2D raster fallback is available when WebGL2 is unavailable. GPU context failure reports unavailable rather than falsely labelling a 2D result as GPU.
- **Clean output:** the Snowfall WebGL2/2D canvas replaces the default clean FLOOR source in the existing Surface Composer. Diagnostic bus rings, skeletons, UI text and calibration labels stay on separate canvases. The physical routing still requires stable live camera, calibrated floor, manually observed five-point physical QA, operator signoff and StageHardwareGate opt-in. MP4/3D/Touch Demo remain software-preview-only.

## F1 acceptance gate

| Scenario | Expected |
|---|---|
| Six discrete verified contact/touch events | Six distinct stamps, count **6** |
| Stationary body with repeated presence heartbeats | **0** additional stamps |
| Replaying the same F0 event buffer every animation frame | No additional stamps |
| Two performers A/B with alternating left/right | Each stamp keeps correct owner/foot |
| Ambiguous crossing | Anonymous presence remains; no invented A/B contact |
| MP4 seek or source change | A new bus generation resets prior snow events |
| Pause/resume | No contact backlog printed on resume |
| Snowfall | Existing footprint gradually fills; counter remains unchanged |
| Touch on tablet/mouse | Software preview only, never opens physical output |
| No GPU | 2D fallback with truthful renderer label |
| Projector | Clean scene routed via existing QA-locked FLOOR output |

**Automated tests:** `tests/snowfall-procedural-f1.test.ts` and `e2e/snowfall-procedural-f1.spec.mjs`, plus existing F0/SOMA source, projection and safety tests. The code gate is measured by CI. Actual performance target ≥30 FPS, physical projector mapping and overhead dual-actor accuracy still need a supervised hardware rehearsal.

## Important limits

- Touch interactions use synthetic contacts; video contacts are 2D estimates, camera contact relies on existing calibrated inference. The scene makes **no pressure sensor** or force claim.
- GPU is an optional local browser capability and can be blocked by hardware/driver settings. 2D fallback uses the same unique event count and recovery model.
- Procedural snow is the first completed scene, not delivery of the full 13-theme Phantom Floor catalogue.
- The clean scene raster is subject to the same Stage Output QA requirements. A green CI build does not establish physical output safety.
