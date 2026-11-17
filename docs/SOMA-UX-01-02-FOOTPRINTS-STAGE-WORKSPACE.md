# SOMA UX 01 + UX 02 — Footprints-first Stage Workspace

**Branch:** `feat/soma-ux-01-02-footprints-stage-workspace-20261117`  
**PR:** #23, Draft, target `main`. Production unchanged until reviewed and merged.  
**Scope:** Studio shell and Footprints stage presentation. Camera, gait, FloorSession V3, archive compositor and physical projection safety gates remain the existing implementations.

## 1. Information architecture

| Main navigation | Function |
| --- | --- |
| **Footprints** (default) | Stage Workspace; tracking, BODY, FLOOR, mapping, calibration and QA |
| Archive | Existing photo/text/media archive workspace |
| Projection | Existing shared projector workspace and calibration |
| Instruments (dropdown) | Teks Cair, Jejak Berulang, Potongan, Siluet × Teks |
| Perform / Preset / Help | Existing operator actions remain |

The five equal-weight scene buttons and wide duplicate “Footprints menunggu kamera Body” banner are removed from the default Studio layout. With no camera, one primary action appears in the tracking preview: **Mulai kamera Body**, alongside a secondary **Simulasi** action.

Clicking another instrument uses the existing `selectScene` and `switchLiveMode` functions. The former scenes, sources, keyboard shortcuts and sound engines remain in the repository.

## 2. Main Stage layout

The new `FootprintsStageWorkspace` renders:

1. **Tracking camera:** a read-only copy of the already existing SOMA Body video element into a 16:9 local preview canvas; no second `getUserMedia`.
2. **BODY mask:** S5.7.1 `buildLowerBodyMask` from the same `frameRef`. The default preview shows only lower-body alpha geometry in white/grey on black. It **does not claim to be the full archival video texture**. Two-person identity uncertainty, stale frames, missing limbs or lack of camera keep the mask black.
3. **FLOOR pad:** independent local canvas painted from the existing `LiveFloorTrackingEngine.session`, using `paintFloorCanvas` only when the original `eventRevision` changes. Coordinates and events are unmodified. Without camera-floor calibration, the pad stays black and the operator sees a one-line explanation.
4. **Context inspector:** Tracking, Visual, Mapping, Output. Tracking controls performer count/camera/calibration; Visual controls existing Studio footprint recipe; Mapping opens the actual S5.7.2–S5.7.4 video + Contact-to-Archive panel; Output shows existing projector status, Blackout and calibration access.

The top row keeps **Live Stage / Archival Mapping** as two views of the Footprints workspace, with Simulasi 3D, Kalibrasi & QA and Blackout directly accessible.

### Deliberate source reuse

The original generic Studio stage is retained in the DOM offscreen (non-interactive and visually hidden) while Footprints Stage is shown, because it owns the current camera video element, `StudioFootprints`, engine refs, audio and recording state. A complete architectural extraction would require a separate camera provider and renderer handoff, which exceeds UX 01/02 and carries unnecessary performance risk.

**Important correction:** `StudioFootprints.forceGaitForLiveFloor` and the single/dual performer `onGaitSample` and `onPoseFrame` callbacks now operate whenever Footprints is the active workspace. Previously these events only reached the floor engine while its large calibration modal was open. That modal remains available for four-point calibration, QA and physical approval, but users can close it and continue collecting grounded floor events.

## 3. Archival Mapping source and lifecycle

Opening **Archival Mapping** in the main Stage displays the existing `ArchivalMappingPanel`: two uploaded video clips (A/B), lower-body masks, contact-to-archive bridge, frozen pad frames, and nested independent dual-surface output QA. No second copy of the archive engine was created.

Leaving Archival Mapping unmounts the media panel and disposes local video URLs. The nested S5.7.4 dual output router sends its Blackout commands during unmount, while the main toolbar also clears the existing shared projector route. **The current UX prioritizes a safe cleanup over persisting uploaded local video between tabs**. Operators should keep footage locally and re-select it for a new take.

## 4. Operator safety

The header and footer Blackout buttons call `requestStageBlackout()`. That function blackouts the existing Studio projection and broadcasts a separate same-page request to any mounted S5.7.4 BODY/FLOOR router. Each active window immediately disarms and sends Blackout, bypassing the regular control throttle. Losing/closing an archival panel also disposes its output sessions.

The Vite Production build still locks new BODY/FLOOR hardware opening through `StageHardwareGate.ts`. This redesign does **not** bypass that guard, assert a physically verified Blackout, auto-arm hardware, or claim accurate moving-body projection on 3D performers. An operator must still keep a physical projector power cutoff available.

## 5. QA and release gates

Automated:
- `npm test` includes `tests/footprints-stage-workspace-ux.test.ts`: Footprints default, four separate legacy instruments, frame freshness and A/B identity blackout, and legacy blackout callback.
- `npm run build` runs TypeScript and Vite compilation.
- Existing S5.1–S5.7.4 tests must continue passing, especially calibration/QA and output gating.

Browser / operator checks required before merge:
1. Fresh Chrome browser opens **Footprints**, without prompt banners stacking above the stage.
2. With camera off, BODY, FLOOR and status remain quiet; primary button triggers the existing Body permission workflow.
3. With camera live and one performer, BODY mask updates. A/B identity crossing produces a black mask in two-performer mode.
4. Floor calibration and confirmation happen in the existing QA modal. Close the modal; walking contacts should continue appearing on the main pad (same FloorSession V3).
5. Select Instruments → Teks Cair / Jejak Berulang / Potongan / Siluet × Teks and return to Footprints, checking input/recording source survives.
6. Select Archival Mapping, upload two local videos and observe their separated compositing and floor archive residue. Return to Live Stage and verify both preview routers are released and blackout.
7. Simulate projector disconnect; use main Blackout while dual routing is mounted. Check Studio and both dual output windows blank; inspect actual hardware separately.
8. At widths 1440, 1024, 768, and 390 px, verify stage preview, inspector, menu dropdown, and keyboard focus remain usable.

### Known limitations / follow-up

- BODY quick preview shows alpha mask geometry, while the Archive view shows actual video textures. They are intentionally different data views until a unified sharing layer is implemented.
- File state is currently held in the archive editor component and is cleared on leaving it, to release physical-output sessions. A future persistence layer needs a safety-aware media lifecycle.
- Full operator Perform redesign remains UX 05. This branch preserves the existing Perform action and controls.
- No real low-light camera/projector tests have been performed by automated CI.

Do not promote this draft to Production from test/build alone; verify visual layout in a browser, test hardware safety where relevant, and then merge deliberately.
