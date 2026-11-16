# SOMA / UNPACKING — S5.7.3 Contact-to-Archive Bridge

**Branch:** `feat/footprints-s5-7-3-contact-archive-bridge-20261117`  
**Base:** S5.7.2 Archival Video Mapping (Draft PR #19)  
**Status:** preview-only, Production unchanged.

## The stage rule

Two performers stand in isolated lower-body light. Their actual chosen archival video material appears on the hips, thighs, calves and feet **inside the S5.7.1 mask**; the surrounding digital frame is black. The floor pad receives an **image fragment that belongs to a physical or simulated contact event**.

The bridge uses an economical, repeatable action rule:

| Action | Body archive | Floor pad |
| --- | --- | --- |
| Foot contacts floor | Only that performer's video pauses briefly (default 420 ms) | One frozen frame sampled from the performer's actual uploaded clip stays at the calibrated contact coordinate |
| Foot remains planted | Video playback resumes after the hold interval | The fragment remains where contact was emitted |
| Foot slides (`move`) | Do not create a second hold | A narrow drag line joins successive ground positions; no second sole stamp |
| Foot releases (`release`) | The held video completes its duration; release does not clear it | The already deposited frame remains |
| New contact | The next original frame is captured | Another fragment accumulates; previous ones stay |
| Identity ambiguous, camera lost, calibration unsafe | Stage preview returns black, no new cue | Pad preview blacks out while retaining prior fragments in memory until reset |
| New take / explicit Reset | The preview event clock starts fresh | Old fragments are cleared for the new scene |

A contact can leave a residue that the next walking action must pass or cross. This visual condition is made by the performer's own path, not by a random procedural background. Variations of the rule can be explored in rehearsal; this implementation deliberately avoids generic particles, flashes and automatic animation on every movement.

## Data contracts

**Input:** existing `FloorSession V3` `FootstepEvent`, `FloorSpace V1`, S5.7.2 frame pixels from actual local uploads, and the existing S5.7.1 mask-composite preview. Camera foot contact remains a calibrated **estimate** (not a pressure sensor). Body pose and camera frames do not create separate foot events.

**Pure engine:** `src/footprints/stage-optics/ContactArchiveBridge.ts`
- Accepts `contact`, `release`, `move`, and no other event kinds. Prediction, swing, legacy data, uncalibrated data and mismatched source mode never stamp archival fragments.
- Uses **append-only event cursor** so frame polling does not double-process one event. Context/session replacement, reduced event count, changed event-prefix signature or rewound simulation clock clears old state.
- A real-video clip is sampled at touchdown into a fixed 16×24 grayscale thumbnail. No clip loaded for that performer means **no artificial fragment** is generated.
- Uses existing `performer-1 → A`, `A → A`, and `B → B` channel mapping. Body identity safety remains with S5.7.2 `MultiPoseGaitRouter`.
- Supports bounded history (default max 80 fragments), separate A/B hold timers, a recent-cue journal, configurable hold 0–1500 ms from UI, and confidence minimum .60.
- Old events more than 800 ms behind the preview clock are not replayed to avoid catch-up flashes. During tracking/identity blackout, pending events are skipped permanently; frozen history stays until explicit reset/session change.
- Manual JSON export retains source filenames, event IDs, floor positions, cue counts and thumbnail **dimensions only**. It does not export video bytes, frozen thumbnails or footage.

**Pad preview:** `src/footprints/stage-optics/ContactArchivePadPreview.ts`. This draws only to a **second local preview canvas** underneath S5.7.2's body composite. The frozen image becomes a shoe-sized grayscale imprint at `floorToUV()` coordinates, with drag lines. It never writes to the active physical projector raster, never replaces `paintFloorCanvas`, and never mutates FootSession V3.

## Operation

Open **Studio → Footprints → Live Floor Tracking → 00 Stage Optics → 02 Archival Video Mapping**.

1. Select two authentic clip files from the local computer, one for A and one for B (or a single clip in solo mode). Select clips that show feet/paths rather than faces, ideally with provenance notes kept separately.
2. Select **Simulasi**. Click **Putar video**. Turn **Aktifkan Bridge** on.
3. The simulator supplies deterministic **`source:'simulation'`** FootstepEvents: alternating contact, release and one drag for each performer over a looping rehearsal cycle. They are explicitly simulated data, not camera observations.
4. Observe body clip A briefly stop at its own contact while clip B continues. White-grey still frames from the actual footage appear at the corresponding X/Y coordinates in the separate black pad preview. Repeated calls to the same event do not create duplicate imprints.
5. Adjust pause duration, change clip A/B and reset the accumulated pad at the beginning of a new exploration. Switching source/clip resets bridge residue to prevent assigning an old fragment to an unrelated video.
6. In **Live** mode, verify S5.6.3 calibration and two-person IDs. Bridge is primed at the current live session tail, **ignoring old contacts** before the panel was enabled. Only freshly received camera `contact` and `move` events may change the two previews. Lost identity or stale mask blacks out and prevents catch-up.
7. Export **SOMA-S5-7-3-contact-archive-preview.json**. The file provides an event-level dramaturgical trace without footage.

## Limits and unresolved integration

- This is a software video-and-pad **preview**, not light delivered on the physical stage. No second body projection transport, per-projector blackout channel, 3D moving-body calibration, new pressure pad, new webcam or new tracking model is added.
- The body archive mask remains camera-relative and coarse (160×90), and the preview is capped by S5.7.2 at ~15 FPS. Physical face spill, projector brightness and precise body registration remain unmeasured.
- Media playback is controlled by HTML video pause/play. Automatic restart after hold may depend on browser media policies; video must first be started by a user click.
- A "frozen frame" comes from the **current sampled browser frame** when a contact arrives in preview. It does not claim guaranteed synchronization between HDMI photons and camera touchdown.
- The pad preview demonstrates the relationship between body and floor but does not send the residual images through the physical Floor Projection pipeline, which must remain unchanged until S5.7.4.
- A single RGB camera's contact estimate and A/B routing can be uncertain during crossing. This bridge deliberately prefers black over attaching another performer's archive to the wrong leg.

## Regression gates

`tests/footprints-contact-archive-bridge.test.ts` covers exactly-once consumption; A/B independent hold; persistent frame capture and release; slide trail rather than new stamp; live-prime skip; blackout with no catch-up; rejection of ghost, replay, legacy, low-confidence or stale inputs; session reset; memory cap; coordinate orientation; and a JSON report free of media pixels.

Run `npm test` and `npm run build`. Confirm simulation with actual uploaded clips in Chrome/Edge, then test live camera in realistic low light. Record any mismatches in video-to-body motion and event-to-pad timing.

## Next build

**S5.7.4 — Dual-Surface Calibration & Output Routing:** independently calibrated body video and existing floor quad, separate verified projector windows, safe projector blackout, opacity cap, and real optical alignment. S5.7.3 is prerequisite logic; it does **not** claim completed physical mapping.

**S5.7.5 — Rehearsal & Visual QA:** investigate contact accuracy, physically observed projector latency, A/B identity crossing, spill on upper body and performers' safe movement.
