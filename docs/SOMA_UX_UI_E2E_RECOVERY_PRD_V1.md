# SOMA Stage 1 — UX/UI & E2E Recovery PRD V1
Date: 2026-11-19
Status: Implementation backlog, pending QA

## Product outcome
One persistent end-to-end workflow: Track → Compose → Map → Perform. First-time setup target ≤10 minutes; returning session ≤2 minutes under documented hardware conditions. These are test targets, not measured performance.

## Evidence & constraints
Connected browser tab SOMA (2026-11-19) shows overlapping Stage navigation, scene selection in Perform and FLOOR, preview controls in cue/operator and BODY/FLOOR preview, blackout in global and local areas, lengthy copy and multiple system statuses. Browser content may include mounted-but-hidden legacy modules; verify visibility before removing controls. Repository paths inspected: src/studio/v3/GlobalNav.tsx, StageModuleNav.tsx, FootprintsStageWorkspace.tsx, StudioTransport.tsx, ia-r1-four-workspaces.css.

## Information architecture — one owner per task
- Global: Stage 1 / Tools navigation, concise read-only health indicator, one permanently reachable emergency blackout. Track owns source editing.
- Track: webcam, phone, MP4, simulator, switching, actor A/B, skeleton and live tracking health, device troubleshooting.
- Compose: choose among 14 scene presets, effects, footage/media, Hydra, audio-reactive routing, scene preset save/restore, software preview.
- Map: BODY/FLOOR route, four-point calibration, screen geometry, projector/physical preflight, explicit QA grant.
- Perform: cue edit/run, GO, previous/next, hold/resume, monitor layout, projector/live state; scene changes via cue editor only.
Preserve state across tabs; scene and input share one canonical engine. Do not silently restore physical projector authorization on preset reload. Global emergency blackout may be reachable everywhere; avoid separate competing primary blackout controls.

## UX rules
- Active workspace title and primary action visible, keyboard operable, with 44px touch targets in small layouts.
- A single source picker in Track. Other workspaces show source status and shortcut to Track.
- A single scene picker in Compose; Perform cue editor selects cue scene by design, no standalone global scene picker.
- One software preview surface per appropriate workspace. Map adjusts physical geometry; Perform chooses operator monitoring layout.
- One status vocabulary: disconnected, tracking, preview, QA needed, authorized, live, hold, blackout, error, with truthful distinctions between software and physical hardware.
- Keep short actionable errors in place; move operator manuals and shortcuts into expandable help; Advanced controls in inspector.
- Loss of camera, tracking or projector must not result in false-ready status or dangerous automatic reactivation.

## Sprint 01 — Information Architecture cleanup
Tasks: inventory control owners in all four workspaces; remove duplicated Stage label/source selector; consolidate status; remove or relocate repeated scene, preview and transport controls; isolate legacy tools; unify keyboard focus and desktop/mobile nav.
Gate: zero duplicate owner actions (except safety blackout); all primary actions reachable at desktop 1366x768 and mobile 390x844; no broken existing path.

## Sprint 02 — Track & Quick Setup
Tasks: persistent source switcher webcam/HP/MP4/3D; inline permission/device recovery; A/B pose visibility, confidence and stale frames; status and diagnostic drilldown; source switch clears old contact events and preserves scene.
Gate: every source reaches live/preview or actionable blocked state; actor A/B labels never silently swap without warning; other workspace settings survive source switching.

## Sprint 03 — Compose & Visual Editor
Tasks: canvas-first scene library (14), compact scene/visual inspector, media/Hydra/audio-reactive UI, preset save/restore, active source read-only; ensure changes affect actual scene runtime.
Gate: 14 scenes selectable and previewed; saved scene changes survive tab switches; software preview changes do not alter hardware authorization.

## Sprint 04 — Map & Physical QA
Tasks: one four-point editor, BODY/FLOOR routing, projection surface selection, mapping diagnostics, QA check and output authorization state, safe recovery and blackout.
Gate: software preview works safely without connected output; no Live before QA authorization; tracked/simulated motion maps consistently; disconnect shows safe state.

## Sprint 05 — Perform & Operator Console
Tasks: compact cue grid, GO/previous/next/hold/resume, clear output status and blackout hierarchy, cue editing collapsed, keyboard shortcuts disambiguated, continuous rehearsal UI.
Gate: 8 cues can be played and edited without leaving Perform, controls usable with keyboard, false live state absent when source/projector unavailable.

## Sprint 06 — E2E QA, accessibility & GitHub Pages release
Tasks: smoke + regression + cross-viewport + accessibility + physical projector QA; record measured setup times and evidence; verify npm test, npm run build, deployed SHA and real Pages experience.
Gate: T01–T10 pass, no P0/P1 bugs, setup targets achieved in recorded test environment, verified production URL and rollback documented. If physical hardware unavailable, mark physical gate blocked rather than pass.

## E2E UAT scenarios
T01 laptop camera → A/B pose → Footprints → Map BODY/FLOOR → GO.
T02 MP4 play/seek → 2-body identity → scene preview → no stale events.
T03 3D puppet → foot contact → scene responds → software projection.
T04 phone pairing/disconnect/reconnect.
T05 change input while composing → settings preserved.
T06 tracking lost → visible warning and safe recovery.
T07 projector disconnect mid-run → safe state and blocked Live.
T08 play eight cues + previous/hold/resume/blackout.
T09 preset re-open → restore visual/mapping, never physical authorization.
T10 keyboard-only and 390px touch navigation.

## Delivery contract
Each issue must include before/after capture, modified file list, unit/regression tests, proof of one canonical owner per control, QA result, and Pages deployment verification. No checkbox is marked complete before evidence is attached.
