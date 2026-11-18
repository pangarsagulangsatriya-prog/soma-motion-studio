# SOMA V3.5 — One-Click Projection & Safe Perform

**18 November 2026 · Implementation & physical UAT contract**  
**Code:** `main` → Footprints / Stage Setup / Projector / Surface Composer / Dual-Surface Output QA.  
**Goal:** first supervised camera-to-projection setup **under 10 minutes**, with already-mounted hardware. Repeat-profile target from V3.1 remains **≤2 minutes** and requires separate UAT evidence.

## Product experience

Operator path:

1. **Camera:** connect webcam/HP through existing Footprints source switcher.
2. **Tracking:** read fresh pose + performer A/B. During crossing or lost source, prevent contact/projector approval; preserve software preview.
3. **Floor:** choose saved stage profile, inspect four corners and explicitly confirm actual camera calibration.
4. **Visual:** existing clean Footprints FLOOR raster is the default if no media is imported. Selected Surface Composer media takes priority. Touch Demo's diagnostic overlay is never sent to physical output.
5. **Projection:** click **Projector**. The guided action opens the first incomplete step; after camera/tracking/floor pass, it opens existing Output QA in BLACKOUT.
6. **Second display:** under a supervised build with projection enabled, operator confirms the area is safe, clicks Buka output FLOOR, moves its black window to the projector, presses F for fullscreen and performs five-point physical QA. Browser pop-up and display permissions remain user-gesture operations. Body output has independent QA and Live.
7. **Perform:** once FLOOR window connected and QA five points is signed, the existing **PERFORM · FLOOR** control requests LIVE. The optical controller still validates tracking, mask, artwork, device, signature, QA and authorization on each frame.
8. **Recovery:** hardware disconnect, stale renderer heartbeat, lost camera tracking or unavailable artwork LATCHES the command to BLACKOUT. Reconnection never automatically re-enables light. If window is open but disconnected, **Pulihkan output** creates a fresh output session and invalidates old proof.
9. **BLACKOUT:** local toolbar and QA emergency remain available. The projector's physical power cutoff is still required for optical emergencies.

## What shipped

| Feature | Implementation |
|---|---|
| One-click guided preflight | `src/studio/v3/safeProjectionPreflight.ts`, FootprintsStageWorkspace, QuickStageSetup |
| Safe real-output authorization | Existing `DualSurfaceRoutingPanel` and `DualSurfaceCalibration`; no bypass |
| Clean FLOOR default artwork | SurfaceComposer reuses original floorCanvas; debug overlay remains on a separate canvas |
| Secondary display | Existing ProjectionLink/ProjectionOutput window + F fullscreen |
| Saved optical profile | `stageOutputDraftProfiles.ts`: local BODY/FLOOR geometry/resolution/brightness scoped to stable camera, raster, floor, performer count |
| Safe recall | Restored plans are drafts; Blackout both, invalidate all QA proof and re-arm state |
| Latch-recovery blackout | `shouldLatchProjectionBlackout` plus existing continuous source/safety gate |
| Physical setup benchmark | `safeProjectionBench.ts`, optional operator UAT form in Output QA, session timer begins from Quick Start/Projector |

**What is not automatic:** browser selecting the physically correct secondary monitor, user authorization for pop-ups/fullscreen/camera, calibration measurement, five-point physical QA, actual observation of light spill and glare, and hardware power cutoff. A saved projection profile never includes QA proof or operator arm. HTML5/Android Phantom Floor parity is outside this sprint.

**Production limitation:** `StageHardwareGate` intentionally keeps physical output locked unless a supervised build sets `VITE_SOMA_STAGE_OUTPUTS=enabled`. GitHub Pages may provide software preview and Output QA UI while prohibiting physical LIVE.

## Gate: supervised setup under 10 minutes

**Start time:** operator first presses Hubungkan kamera or Projector/Siapkan Proyeksi; stopwatch saved in the browser session.  
**Stop time:** after a valid software LIVE signal, an operator sees the actual correctly aligned effect on FLOOR and signs the independent UAT checkbox in Output QA.  
**Recorded evidence:** start timestamp, finish timestamp, elapsed milliseconds, target comparison and operator note in localStorage key `soma-v3-5-setup-uat-results`. These are operator reports, *not* a light sensor reading.

Test fixtures: a stable elevated camera, two performers where available, installed projector on secondary display, previously measured floor dimensions, and access to a manual blackout/power disconnect. Run first-time and saved-profile trials separately. Preserve exact hardware/browser details in notes.

Minimum physical acceptance:
- [ ] Video starts, shows correct camera and latest frame
- [ ] A/B identities do not silently swap during crossing; tracking loss is visible
- [ ] Four-point floor correspondences match the marked stage
- [ ] FLOOR clean feed contains expected footsteps; diagnostic grid/text overlays do not leak
- [ ] Window output moved to the correct display and fullscreen confirmed
- [ ] Five measured FLOOR positions, QA status within provisional target
- [ ] User manually checks safe viewing area, actual blackout and brightness
- [ ] PERFORM FLOOR visible on physical floor only after QA approval
- [ ] Disconnect/reconnect camera, close/reopen projector and verify latched BLACKOUT
- [ ] Previous QA proof is not reusable after output window, camera, floor or plan changes
- [ ] First setup elapsed <600 s; repeating a saved stage profile ≤120 s (separate gate)
- [ ] Continuous scene and dual-performer performance measured in real rehearsal

## Automated checks / open gaps

Automated unit tests: `tests/safe-projection-v3-5.test.ts`, `tests/safe-projection-bench-v3-5.test.ts`. Browser acceptance: `e2e/safe-projection-v3-5.spec.mjs`, plus existing Projector WYSIWYG and source-switching suites.

These tests cannot replace camera/projector physical UAT. MediaPipe overhead tracking quality, browser multi-display permissions, geometric accuracy, artifact latency and <10-minute performance remain physical acceptance items. Do not claim the end-to-end timing goal achieved until at least one supervised full run is documented. Output on GitHub Pages remains software-only when the production hardware gate is disabled.

## Next

Once physical performance and safety gates pass: simplify the first-time camera/marker calibration (V3.2), connect procedural Snowfall scene into clean floor routing (V3.4), add the remaining scene catalogue, and compare end-to-end setup timing across operators.
