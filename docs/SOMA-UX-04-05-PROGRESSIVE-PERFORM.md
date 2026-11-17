# SOMA UX 04–05 — Progressive Controls & Minimal Perform

**Branch** `feat/soma-ux-04-05-progressive-perform-20261117` (stacked on UX 03; Production unchanged).  
**Scope:** Footprints Studio user interface. Existing S5.6/S5.7 camera engines, floor events, archival video router and S5.7.4 optical safety guards remain untouched.

## UX 04 — Progressive controls

The **Build** workspace uses task-based context inspector tabs:

| Tab | Default surface | Expanded controls and destination |
| --- | --- | --- |
| Tracking | Camera state, number of performers and calibration button | **Diagnostik kaki dan event** (contacts/events) |
| Visual | Four style presets (Campuran, Tapak, Garis, Titik) | **Detail visual** (foot size, age, palette) |
| Archive | BODY/FLOOR source status | Existing S5.7.2–S5.7.4 Archival Video Mapping, Body Mask, Contact-to-Archive and Output QA |
| Projection | Independent BODY/FLOOR command reports and legacy projector state | Existing guarded Dual-Surface Calibration; no new Live shortcut |
| QA | Physical QA and Direct Puppet simulator links | **Engineering diagnostics** (real floor events, contacts, mask status and renderer reason) |

These choices reorganize existing controls; they do not duplicate tracking or create a second recorder. Engineering information stays closed until requested, so the first-screen inspector fits an active rehearsal instead of resembling a developer dashboard.

## UX 05 — Minimal Perform

For Footprints, the existing top-right **Perform** button now opens a dedicated operator layout instead of the old generic Studio Clean display. For legacy Instruments, the prior Clean behavior remains.

### Deliberate operator flow

1. Prepare tracking, physical floor calibration, archive footage, and QA from Build.
2. Choose **Perform**. SOMA sends the global Stage Blackout request before switching modes. The operator monitor opens at cue `01 · Overview`. The Archive editor unmounts and local uploaded files are released under the existing UX02 safety lifecycle.
3. Monitor the same Footprints Stage engine: camera preview, lower-body mask geometry, and metric FloorSession pad. No webcam or gait engine is created. Camera tracking and foot events continue during local preview cue changes.
4. Four **monitor-layout cues** can be selected in the operator ribbon:
   - `01 · Overview`: camera plus BODY/FLOOR previews
   - `02 · BODY`: large mask preview
   - `03 · FLOOR`: large floor contact preview
   - `04 · Split`: BODY and FLOOR side by side
5. **GO · Cue Berikutnya** and **Sebelumnya** change the operator's monitor layout only. They do **not** change video content, physical projector Live state, routing configuration, or calibrated optical output. Cues are explicitly local until a separate, supervised physical cue protocol is implemented.
6. **Hold Preview** freezes BODY and FLOOR preview rasters; tracking and data collection continue. **Resume Preview** refreshes them using the latest frame/events. The existing FootprintConfig hold state remains shared with Studio.
7. **Rekam / Stop REC** uses the existing `StudioFootprints.toggleVideo()` and the original Body camera availability checks; no duplicate recorder.
8. **BLACKOUT** is always available and calls `requestStageBlackout()` for legacy Projection and open BODY/FLOOR output sessions. Use actual projector power cutoff during a physical emergency.
9. **Kembali Build** sends global Blackout and reopens the editing workspace. Switching to Archive, Projection or another Instrument also clears Perform state and commands Blackout.

### Keyboard controls (Perform only)

- `Space` or `Right Arrow`: next local monitor cue
- `Left Arrow`: previous cue
- `B` or `Escape`: global Blackout
- Shortcuts do not fire when typing in inputs, controls, menus, when a dialog is open or during IME composition. Repeated keydown is ignored. No shortcuts can activate physical Live or start recording inadvertently.

## Safety and explicit limitations

- **No physical auto-Live.** Entering Perform and changing cues never opens a projector window or arms output. The existing S5.7.4 production build lock stays in effect, including `VITE_SOMA_STAGE_OUTPUTS`.
- **BODY in the new operator monitor is geometry/mask preview**, not the complete uploaded archival video from the nested Archival Mapping editor. Returning to that editor is necessary to load footage and work with real body-textured output. Physical show-time video-cue routing/persistent media transport belongs to a future, safety-reviewed sprint.
- Switching Build→Perform deliberately unmounts the prior Archival Mapping panel, clears its locally selected clips and disarms any mounted dual surface windows, following UX02's safe cleanup policy.
- Operator cue names describe views, not dramaturgical movement instructions or actual stage lighting cues.
- Frame age and A/B identity safety checks are inherited from UX03 and the S5.7.1 mask engine. The new console displays a camera/calibration warning when prerequisites are unavailable; it never claims measured optical safety.
- No calibration or Projector QA is silently completed by software. Physical light cutoff, registration and foot-to-photon latency need real stage trials.

## QA checks

Automated: `tests/footprints-progressive-operator.test.ts` validates five task tabs, four bounded cue transitions, active shortcuts and input-safety suppressions. Run `npm test` and `npm run build`; all previous Footprints regressions must remain green.

Manual browser checks:
1. Select Footprints, switch Build ⇄ Perform. Verify Perform opens Overview, the two preview canvases continue updating, and the source camera never restarts.
2. Switch all four cue focus layouts at 1440, 1024, 768 and 390 px. Look for overlay, clipping, enlarged low-resolution mask limitations and lost button focus.
3. Use Space, arrows, B and Escape with and without focused form controls. Confirm Blackout is reachable while scrolling.
4. Begin/stop video recording. Verify file export comes from the existing Footprints recorder. Hold/resume should freeze/update local BODY/FLOOR previews while gait/contact counters keep receiving events.
5. In Build, confirm Visual details and Engineering diagnostics are collapsed by default. Verify camera calibration / simulator / archive buttons still reach the existing workspaces.
6. During supervised local QA only, verify global Blackout reaches both output windows. The physical power cutoff remains necessary.
7. Ensure Production build still shows **Terkunci di Production** for new physical dual-surface outputs.

**Release:** Draft PR only; no Production merge or claim of physical performance readiness from CI.
