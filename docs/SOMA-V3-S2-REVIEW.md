# SOMA V3 — S2 UI Implementation & Review

**Status:** candidate for operator review. **DO NOT MERGE TO MAIN** until manual webcam / projection / responsive acceptance is complete.
**Basis:** S1 Information Architecture Reset (42 fitur, 15 temuan S0). Engine, audio, MotionFrame, photo storage, projection calibration, Archive cue, and saved settings stay unchanged.

## What changed
- `GlobalNav`: Studio/Archive/Projection, preset, Perform — no permanent rail.
- `ScenePicker`: five first-class Visual Scenes. Footprints prompts for Body + camera explicitly rather than starting camera silently.
- `StudioTransport`: source, camera, sound instrument/routing, audio/video record, Capture, canvas Hold, projector Live/Hold/Blackout, tracking status details.
- `SceneInspector`: fast Gaya/Bahan/Respons controls, palette and shape context-aware; full Hydra/Mapping retained in Advanced.
- `CaptureHub`: photo four slots, audio takes, Footprints pattern PNG/SVG/JSON + import; video Footprints downloads when stopped.
- Perform remains the same mounted canvas; CSS hides editor shell and allows inspector overlay through existing Clean dock.
- Responsive layout and reduced-motion styles updated.

## State and engine guardrails
- Still **one** `CameraTracker`, `MotionFrame`, `AudioEngine`, `ProjectionLink`.
- Footprints uses existing `StudioFootprints`, `GaitAnalyzer`, and pattern export. No new camera source.
- Audio and video capture retain their separate recorder implementations. The app does not promise synchronized AV files.
- Footprints contact is an estimate; webcam does not measure foot pressure.
- `Tahan gambar` controls Hydra or Footprints canvas. `Tahan output` and `Layar proyektor hitam` apply to projector only.
- Original localStorage / IndexedDB keys are untouched. Footprints session data is cleared only via its explicit new-session confirmation.

## Manual acceptance tasks for operator
1. **First visit (desktop 1440x900 / laptop 1280x720):** Scene Picker and canvas visible without scrolling through large introductions; open Inspector; verify scene palettes affect the live canvas.
2. **Input:** change Mouse / Hands / Body / Face using Transport; accept/deny camera permission; check lost-tracking message and error retry.
3. **Footprints:** choose from Mouse → see explicit Body prompt → click Use Body & camera; choose Campuran/Tapak/Garis/Titik, change colors/size/trail; capture PNG, SVG, JSON; import JSON; start a new session with confirmation; recording video must stop and download.
4. **Photo:** Capture → Foto → Buka bingkai; dialog closes to expose the camera overlay; zoom from wrists, punch in every direction and press manual shutter; verify four-slot replacement, delete and undo.
5. **Sound:** choose Theremin/Drone/Percussion/Lab under Suara; play and mute; select Visual/Suara/Keduanya; record audio and check Capture → Rekaman play/download.
6. **Projection:** Output → Buka jendela; wait for heartbeat, click Live, Tahan output and Blackout. Verify only external output changes; calibration presets still work in Projection Workspace.
7. **Archive:** enter Archive, test cue manual/live and saved project, return to Studio with camera/audio intact.
8. **Perform:** switch via header, use C/F/T/Space as appropriate; ensure no Studio header, scene strip or inspector covers canvas; open settings through dock and return.
9. **Accessibility:** keyboard reachability, focus outlines, 390x844 tap targets, reduced motion; ensure popovers are understandable by keyboard.

## CI and release gates
- `npm test` / `npm run build`: must pass on candidate SHA.
- Test actual webcam + projector and photo gestures before merge.
- Preview Vercel branch `preview/soma-v3-s2` can be deployed independently; work branch `feat/**` remains preview-disabled according to `vercel.json`.
- On pass, open review/merge PR to `main`. Keep old implementations in repository for rollback until field validation succeeds.

## Known work for subsequent iterations
- E2E browser visual snapshots and real device testing are still pending (CI currently covers unit/build).
- Legacy `src/Footprints.tsx`, `LiveVisualBar.tsx` remain as fallback source; no behavior changes to old code.
- Archive and Projection use their established domain-specific headers; S2 focuses on unifying Studio first to avoid cue or calibration regression.
- Some Advanced controls intentionally remain verbose and need operator review before further reduction.
