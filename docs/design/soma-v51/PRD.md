# Product Requirements Document — SOMA V5.1 Signal Workspace
Version 1.0 · 24 November 2026 · Proposal for design review

## 1. Product problem
SOMA V5 already places the Unpacking cue network in one canvas. Current `UnifiedNodeWorkspace.tsx` renders 17 logical nodes and 18 connections at fixed coordinates. Physical cameras appear in a separate source-card strip, while three role placeholders appear in the graph. Edges indicate cue membership, not actual traffic. Cue selection calls stopRecord/disarm, stops the running preview, resets output blanks. The inspector repeats category, name, and technical description; Record is available only when specific nodes are selected. Monitor and inspector share a scrolling column. GO validates some inputs on click, but the selected cue can be displayed as READY before sources are ready. This is a source-code and current-tab audit, not a measured user study.

## 2. Outcome and design principles
One persistent canvas from setup to rehearsal and show. All camera sources, processing, media, session and stage outputs can be understood in context. The UI should emphasize the next action and actual state. Preserve the SOMA dark green scheme and all existing engine behavior. No separate workspace per fragment; no return to menu-heavy Track/Map/Perform navigation for everyday operation. The legacy Studio remains an explicit fallback for tools not yet ported.

Users: artist/director (reads overall graph); creative technologist (binds sources and diagnoses signal); operator (preflight, cue, record, blackout). In a live show, stage operator does not need to understand MediaPipe landmark internals to run a prepared cue.

Success targets (proposed, not achieved):
- First-time operator locates Add source, GO, Record, and Blackout without instruction in a 5-person formative test; at least 4/5 complete each.
- Prepared F1 launch in <=3 deliberate actions after input permission; next cue selection + GO in <=2 actions.
- Default workspace static copy reduced >=40% from V5 on an identical empty-project state, measured using visible text excluding media names and tooltips; keep safety/privacy copy.
- No unexpected cue interruption, stream restart or relight in 50 scripted cue transitions.
- Default 1440x900 and 1280x800 workspace fits core controls without document scrolling; graph can pan/zoom and inspector scrolls separately.
- Preserve preview render and inference performance; technical budgets in TECHNICAL_SPEC.

## 3. Scope and non-goals
P0: unified shell, source nodes in graph, truthful node/edge status, fit/pan/drag, typed source assignment, cue preflight and queued/current cue separation, pinned previews, record control, independent visual blackout, accessible wording and keyboard.
P1: grouping/collapse, contextual thumbnails, validated rewiring for supported routes, minimap, undo/redo of non-runtime layout, layout persistence, motion polish, inline mapping adapter with hardware safety tests.
P2: search, additional node templates, reusable project presets, import/export graph, richer diagnostics, extensible routing.
Non-goals: arbitrary runtime nodes or shader/scripting language, automated output arming, redesign of artistic rendering algorithms, replacement of existing optical gates, guaranteed 10 physical cameras on every laptop. Audio/Stage 2 remain available in legacy; do not silently delete them.

## 4. Information architecture
Top bar (48–52 px): SOMA / project, source readiness contextual to next cue, legacy/tools menu, persistent global Blackout. Hide BETA only after release sign-off. No marketing subtitle.
Canvas: 4 visual families — Sources, Processing, Session, Outputs; groups are visual wrappers around stable runtime nodes. Sources include every registered camera device/phone (one card per device), unassigned role slots only when needed, Archive. Add source lives within canvas, never a duplicate card strip. Node inspector opens on selection; one read-only compact health strip.
Right rail (300–340 px): pinned Floor and Canvas monitor stack; inspector below, independently scrolling. Monitor headers expose output state and fullscreen/blackout controls. At smaller viewports collapse inspector into overlay/drawer in the same workspace, without remounting sources.
Transport bottom (56–64 px): four cue buttons, current/next marker, preflight blocker/action, REC, GO, Stop. Never hide blackout or transport under a popover. Status text uses one message, not several repeated banners.
Default visible 11–12 logical visual groups excluding additional physical cameras; internal 17-node graph remains available in Expand details. Do not change the 18 logical edges merely to match the illustrative sketch.

Visual node grouping:
- Cameras: one per registered physical stream; default three unbound role slots Performer / Audience / Gesture. Assigned source card absorbs its empty slot; multi-role assignment is visibly labeled. Extra cameras remain visible unassigned with Add role action.
- Motion, Footprint, Dual Trace, Gesture, Photo Capture, Archive remain distinct; Photo Bank may appear as a subpanel/output of Photo Capture, still retains its logical storage node.
- Session groups Recorder / Saved session / Replay as three separately labeled internal endpoints, with record and replay status independent. No live feedback loop.
- Floor groups Floor Composite and Floor Output; Canvas groups Canvas Composite and Canvas Output; separate input ports for live/replay/media etc. These two nodes route to pinned monitors; don't duplicate full preview at both sizes. Small node thumbnail optional; monitors are canonical.

## 5. Core flows
| ID | Flow | Acceptance |
|---|---|---|
| UX01 | Empty start | All cue targets and missing sources visible. Add source at input group. Selecting a cue never requests camera permission. |
| UX02 | Add camera / HP QR | Choose device or phone pairing. Show Connecting immediately, thumbnail only on fresh frames, no duplicate physical device stream. Cancel cleans pending resources. |
| UX03 | Assign camera | Select role from source inspector or drag typed output to role input. Occupied input requires explicit Replace. Invalid route shows reason and no mutation. Two different source IDs mandatory for F3A. |
| UX04 | Explore graph | Drag header, pan with Space+drag or middle pointer, wheel/pinch zoom around cursor, Fit uses both dimensions, selection highlights upstream/downstream. View changes never restart inference. |
| UX05 | Prepare next cue | F1 keeps running while F2/F3 is selected. Next cue card and its readiness shown separately. No output blank or recorder interruption on selection. |
| UX06 | GO | Revalidate current source/frame/media/session state at GO. Failed check leaves current cue running; successful transition commits atomically at frame boundary, closes prior recording/capture safely. Preview does not authorize physical light. |
| UX07 | Record F1 | Global Record available only when F1 is running with fresh valid source. Start explicit new take, preserve existing saved session until successful commit. Recording and preview timeline separate; recording must not erase already-visible ink. Stop saves, shows actual local commit status; export JSON if storage fails. |
| UX08 | Archive F2 | Select local media, await decode, choose F2 and GO; Floor intentionally black, Canvas renders file. Loading/error shows recovery action. |
| UX09 | Capture F3A | Two fresh distinct sources, verified audience camera/crop, explicit consent and arm, gesture or manual trigger. Four slots maximum. F3A output stays black until allowed; revoke consent immediately disarms, removes photos and clears affected preview/output. No upload. |
| UX10 | Replay F3B | Valid F1 log + decoded archive + >=1 approved photo per current V5 gate; 4 photos shown as target, partial collection explicitly indicated. Start new replay cursor; floor and canvas use same timeline. |
| UX11 | Blackout | Per-surface Blackout immediately gates that surface; global Blackout gates both without stopping recording or cue unless explicitly pressing Stop. State latched across cue, reconnect and fullscreen. Explicit resume is separate; hardware rearm follows physical QA. |
| UX12 | Fault recovery | Source loss causes affected branch/output to darken, disarms capture, shows concise reason + recovery action. No automatic unblackout. Retry does not restart unrelated inputs. |
| UX13 | Save/reopen | Restore approved UI layout and role preferences, not permission, consent, arm, or live output. Missing device prompts reconnection; no unexpected camera start. |
| UX14 | Legacy fallback | Explicit switch confirms active recording/output; save/stop and issue blackout before navigation; no change to legacy routes. |

## 6. Cue definitions
| Cue | Required source / state | Floor | Canvas |
|---|---|---|---|
| F1 Jejak | Performer video fresh; tracking status displayed separately | Footprint | Dual Trace |
| F2 Arsip | Local image/video decoded | Black | Archive |
| F3A Foto | Audience + gesture fresh and distinct; consent/verification required before viewing audience or arming | Black | 4-slot photo grid + audience crop/performer background |
| F3B Replay | Valid F1 log, decoded archive, >=1 approved photo; 4 target | Footprint replay | Trace + archive + photo composition |

F1 missing tracked bodies after fresh video = waiting for performer, not camera offline. Ambiguous A/B tracking cuts strokes; existing identity reset remains explicit. F3A may be prepared before consent, but audience imagery and capture are gated. Blackout applies to output only, does not revoke consent; privacy revoke independently clears imagery and capture. Use F3A/F3B IDs internally and user-facing cue names consistently; no fragment renumbering.

## 7. Prioritized requirements
| Priority | Requirement | Release proof |
|---|---|---|
| P0 | One workspace with actual dynamic source nodes and typed bindings | Camera add/remove/reconnect, no duplicate source list, same route and mounted registry across cue |
| P0 | Truthful feedback | Tests distinguish selected, ready, processing, stale, error and masked; no signal animation on selection alone |
| P0 | Current/next cue and preflight | Rejected GO leaves current running; valid GO transactional, no source reopen |
| P0 | Global transport | REC, Stop, GO, blackout always reachable; per-surface and global latches |
| P0 | Preserve F1/F2/F3 behavior and legacy | Actual output pixel tests, log replay and capture tests; current QA remains |
| P0 | Responsive/accessibility | 1440/1280/1024 layouts, keyboard paths, reduced motion, contrast checks |
| P1 | Supported typed port editing + safe graph grouping | Approved transaction, rejects cycle/incompatible/multiple writers; runtime adapter dispatches route, not cosmetic wire |
| P1 | Inline mapping and clean feed | Adapter for distinct floor/canvas calibration, explicit QA and physical output approval |
| P1 | Viewport polish | fit, minimap, drag, save layout, contextual inspector, thumbnails, motion asset states |
| P2 | Workflow scale | search/presets, project import/export and history |

## 8. Definition of done and release gates
Design gate: approved Figma frames with empty, loading, ready, running, degraded, blackout, capture, replay, compact view and keyboard behavior. Build gate: test/build and relevant old browser suites; actual V5.1 E2E uses video/image/pose fixtures with labeled simulation. Pixel gate: Floor and Canvas independent and immediate black, archive actually painted, F1 events replay deterministically, F3 captures from correct source only. Performance gate: measured reference laptop, no meaningful regression. Hardware gate: two physical surfaces, calibration and rearm, projector disconnect, black verified, rehearsal 30 minutes. If physical QA incomplete, label local preview beta; do not enable production projector path.
