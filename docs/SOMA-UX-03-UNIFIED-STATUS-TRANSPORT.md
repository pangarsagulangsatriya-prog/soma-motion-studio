# SOMA — UX 03 / Unified Status & Transport

**Build:** `feat/soma-ux-03-unified-status-transport-20261117`, based on UX 01–02 Draft PR #23.  
**Scope:** Footprints Stage operator UI, read-only dual-output software telemetry, and existing camera/record/capture/preview actions.

## Primary goal

A single Footprints Stage page now exposes the controls and statuses an operator needs while walking:
- camera mode and fresh tracking,
- performer 1 or valid A/B identities,
- camera-to-floor calibration status,
- independently connected BODY/FLOOR projection windows and their software modes,
- the existing single-output legacy Projection status,
- one persistent, global **BLACKOUT** action.

No new detector, second webcam, video uploader, dual projector driver, media server or physical safety certification is introduced.

## UI: five concise status tiles

The new `UnifiedStageStatusStrip` sits below the workspace title:
- **Kamera**: off, busy, error, wrong source, searching, or tracking.
- **Performer**: one camera performer, both A/B identifications, or ambiguity/stale frame.
- **Lantai**: not calibrated, awaiting confirmation, camera mismatch, or calibrated-camera **estimate**.
- **BODY Output**: panel closed, waiting for remote browser heartbeat, Blackout command, test command, or Live command.
- **FLOOR Output**: independent of BODY; same modes and state checks.

A small legacy Projection status keeps the original SOMA output visible without claiming it has the same configuration or optical gate as the two new Stage channels.

In Production, the BODY/FLOOR cards explicitly show **Terkunci di Production** when the S5.7.4 `StageHardwareGate` build-time opt-in has not been enabled. Output labels explicitly say **diperintahkan**, never claim photons are physically visible.

## Source of truth, not duplicated state

`DualSurfaceTelemetry.ts` publishes read-only software state from the **existing** `DualSurfaceRoutingPanel`, sampled about every 250 ms. Status is owned by its active panel instance and is cleared as soon as that panel unmounts. Old owners cannot publish after a new panel takes ownership. Reports older than 900 ms lose their connected/Live badges.

The central Stage reads camera mode and frame freshness from `frameRef`, A/B identity from `MultiPoseGaitRouter.status`, camera/floor calibration from the existing `LiveFloorTrackingEngine`, and the old projection output from `useProjection`. An A/B ambiguous/incorrect frame index or a camera source still set to `hands` cannot show a healthy Footprints tracking badge.

The telemetry store is **not a command bus**. Only the existing Dual-Surface Routing Panel may open, approve, TEST, arm LIVE, or close BODY/FLOOR hardware windows.

## UI: persistent transport, separated by actual operation

A single sticky dock replaces the scattered Blackout buttons in the header, inspector and footer:

| Transport group | Control | Actual effect |
| --- | --- | --- |
| INPUT / CAPTURE | Kamera / Stop Kamera | Reuses existing SOMA camera and body input. Stopping camera first requests global Blackout and revokes old floor calibration. A currently recording user must confirm stop. |
| INPUT / CAPTURE | Rekam / Stop REC | Reuses `StudioFootprints.toggleVideo()`, disabled until Body camera is ready; STOP REC remains available during an active recording. |
| INPUT / CAPTURE | Capture | Opens the existing Footprints Capture Hub. |
| VISUAL PREVIEW | Live | Resumes the existing Studio footprint visual (`FootprintConfig.hold=false`). Does not energize physical projector windows. |
| VISUAL PREVIEW | Hold | Pauses the existing Studio footprint visual (`FootprintConfig.hold=true`), without claiming to freeze camera or archival video. |
| STAGE OUTPUT | Output QA | Opens the S5.7 archival/projection panel; operator completes physical proof and opens/arms each projector from the existing S5.7.4 protected controls. |
| STAGE OUTPUT | **BLACKOUT** | Immediately Blackouts existing single-output Projection and broadcasts the same-page `StageBlackout` command received by both BODY/FLOOR sessions. The hardware power cutoff remains a separate necessary safety device. |

The old StudioTransport for the four additional Instruments stays in the original Studio engine's offscreen subtree while Footprints is active. It remains unchanged for legacy modes and can be reached when choosing another instrument.

## Safety details

1. The two optical channels keep their own S5.7.4 authorization, five-point hardware evidence, output-instance approval signature, local camera freshness, live/source guards, and emergency blackout handling. The new global dock cannot bypass these.
2. When the Archive view closes, the dual-output panel unmounts, sends Blackout and clears telemetry; stale Live badges cannot linger.
3. After a camera stop, the Footprints floor engine is explicitly revoked and A/B router reset. Calibration must be reconfirmed before using live stage output.
4. A stale channel heartbeat cannot be mistaken for an operational screen. The status bar describes command state from the browser, never a verified physical shutter.
5. The operator must still turn off projector hardware if a browser hangs or light reaches the performer/audience unsafely.

## Technical files

- `src/studio/v3/UnifiedStageConsole.tsx` — status strip and sticky transport.
- `src/studio/v3/unifiedStageStatus.ts` — pure display/status derivation and guarded legacy readiness model.
- `src/footprints/stage-optics/DualSurfaceTelemetry.ts` — lifecycle-bound, read-only live channel reports with TTL.
- `src/footprints/stage-optics/DualSurfaceRoutingPanel.tsx` — publishes only its actual connection/decision state.
- `src/studio/v3/FootprintsStageWorkspace.tsx` — consumes status and shows transport.
- `src/App.tsx` — routes existing camera, video capture, preview hold and global blackout callbacks.
- `src/studio/v3/footprints-stage-workspace.css` — status strip and transport responsive styles.
- `tests/footprints-unified-stage-transport.test.ts` — safety/state tests.

## QA requirements

1. `npm test`, including new status and stale/owner tests, and `npm run build` must pass.
2. Browser at widths 1440/1024/768/390: toolbar doesn't obscure BODY/FLOOR preview; Blackout remains reachable when scrolling. Keyboard focus is visible.
3. Camera off → no green/Live status. User clicks Kamera to choose Body input/ask permission. Stop Kamera while recording prompts confirmation, ends video properly and revokes calibration.
4. With two performers, a crossing or reordered MediaPipe pose list produces an A/B warning, not a false healthy status.
5. Opening/closing BODY and FLOOR windows during supervised local rehearsal updates each tile independently. Disconnect or inactivity causes offline. Production hardware-lock label persists.
6. Archive view's nested stage router receives Blackout from the sticky dock. Both old and dual output routes should blank in browser. Physical projection test remains outstanding.
7. Rekam, Stop REC, Capture, Live and Hold operate existing Footprints engine; no duplicated recorder or camera stream.

**No Production promotion** from CI alone. Browser smoke test and independently witnessed optical-stage acceptance are still necessary.
