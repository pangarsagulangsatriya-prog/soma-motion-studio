# Design & Motion Specification — SOMA V5.1
Version 1.0 · 24 November 2026 · Figma handoff, before design production

## 1. Benchmark decisions
| Reference | Pattern to adapt | Avoid |
|---|---|---|
| [Resolume Wire node anatomy](https://resolume.com/support/en/wire-node-anatomy) | typed inlets/outlets, inspection of accepted types | exposing all low-level parameters |
| [Resolume Wire UI](https://resolume.com/support/en/7.4/wire-user-interface) | contextual node inspector | dense patching menus |
| [TouchDesigner Network Editor](https://docs.derivative.ca/Network_Editor) | visual node viewers and actual routing | every node showing a heavy live viewer |
| [React Flow custom nodes](https://reactflow.dev/learn/customization/custom-nodes), [handles](https://reactflow.dev/learn/customization/handles), [accessibility](https://reactflow.dev/learn/advanced-use/accessibility) | custom handles, selection, drag, viewport, keyboard | graph library controlling engine |
| [Carbon motion](https://www.carbondesignsystem.com/building-blocks/foundations/motion/overview) | short productive feedback, restrained easing | decorative animation during show |

These are pattern references; no copying logos or proprietary UI assets. SOMA keeps existing dark green. Color roles below extend the current palette only for functional status and data distinctions.

## 2. Tokens and layout
Assets: `assets/tokens.json` (DTCG-style tokens), `assets/tokens.css` (CSS variables + reference motion), `assets/node-assets.svg` (original vector primitives and state swatches), `assets/motion-lab.html` (interactive simulated micro-interactions, local browser).
- Base background #111714, canvas #121A15, panel #19221E, raised #202D25, border #34443B, text #EDF4EE, secondary #A7BBAE, accent #A7D4A8. Danger #D96C62, warning #E3BD79, focus #D4E8BF. Actor A red #E84B32 and B charcoal #202226 belong to artwork, not UI error status. On dark floor preview maintain existing B blue as needed; artwork palette not overwritten by UI tokens.
- Typography system-ui / platform sans; mono only timing, FPS and technical IDs. 20/24 brand; 14/20 node title; 13/18 control; 12/16 metadata; 11/16 minor diagnostic. No tiny uppercase paragraphs. Use sentence case, title case for fixed engine names.
- Spacing 4, 8, 12, 16, 24, 32; radius 4/6/8/12; border 1; focus 2. Node width 168–220 standard; compact 148–176; source preview ratio 16:9. Standard card min height 48, preview card 120–148. Node title one line where possible; ellipsis + accessible full name. Gap between columns >=48, node gap >=20. Grid dots 16–18 px, subdued; no visual texture above content.
- Desktop: header 50, transport 64, right rail 320, graph fills remaining area. 1440x900 primary frame; 1280x800 secondary; 1024x768 inspector drawer/pinned smaller previews; 390x844 setup-only with accessible compact safety controls. No fixed graph that clips core routes; Fit uses viewport bounds and zoom min/max, preserve layout while opening inspector.

## 3. Component inventory (Figma variants)
| Component | Properties / states | Interaction |
|---|---|---|
| Shell/Header | beta, source readiness, project | project menu, legacy, global blackout |
| Node/Source | empty, connecting, ready, processing, stale, error; device/phone; thumbnail on/off | add, bind, retry, details |
| Node/Processor | idle, ready, processing, waiting, stale, error; preview none/thumbnail | select, inspect, reset where supported |
| Node/Session | idle, recording, saving, saved, replay, error; collapsed/expanded | record, export, playback details |
| Node/Output | floor/canvas, idle/preview/blackout/blocked/authorized | fullscreen, black, mapping |
| Port | type, direction, default, compatible, incompatible, connected, focus | hover type, keyboard connect, drag supported |
| Edge | inactive, selected, ready, processing, event pulse, stale, error | inspect actual route, reconnect supported |
| Cue | idle, selected-next, running, blocked, complete | select next, GO separate |
| Transport | GO ready/blocked/busy; REC disabled/ready/recording/saving; Stop | persistent controls, feedback |
| Monitor | waiting, preview, blackout, error; full/local | actual pixels, fullscreen, independent blackout |
| Inspector | source/process/session/output, empty selection, collapsed | context settings; advanced disclosure |
| PhotoSlot | empty, capturing, filled, invalid/revoked | capture, delete, revoke |
| Toast / inline blocker | info/success/warning/error | action, dismiss; persistent blocker while unresolved |
| Tooltip | port/shortcut/technical help | hover 300ms, focus immediate; never only location of essential action |

Use Lucide (already dependency) for interface icons: Workflow, Camera, Smartphone, Film, Footprints, Activity, ScanLine, Hand, Database, Circle, Play, Square, Monitor, Maximize, Plus, X, Settings2, RefreshCw, AlertTriangle, Check, ChevronDown, Download, Trash2, Link, Unlink, ZoomIn/Out, LocateFixed. Verify actual exports when implementing. Icons 16 for controls, 18–20 for navigation; 1.5–2 stroke. Original vector sheet uses simple schematic primitives, not branded icon copies. Use live engine frames for previews in product; Figma fixture images must be labeled demo.

## 4. Port/edge semantics
Use four related hues and shape/label cues, not eight competing neon colors:
- Video/media: teal #79B6B0, circular connector, type label.
- Pose/gesture: muted blue #92AEE0, diamond connector.
- Footsteps/stroke/photo/frame: sage #A7D4A8, square connector.
- Session: violet #BAA2D8, rounded square/double-line motif.
Semantic stale/error overrides edge color and uses dashed/broken style and text in inspector. Idle/dim #53665A; selected outline #D4E8BF. Hover connected port highlights matching endpoint and fades unrelated edges. Compatible drop targets highlight; invalid targets show small reason; no error animation on all graph.

## 5. Motion tokens
| Name | Duration | Easing | Usage |
|---|---:|---|---|
| instant | 0ms | linear | output blackout, source invalidation |
| fast | 100ms | standard | button/hover, capture feedback after actual save |
| selection | 150ms | standard | node selection, edge focus |
| enter | 180ms | ease-out | add node, ready preview, cue outline, inspector |
| viewport | 220ms | standard | Fit, optional smooth zoom |
| toast | 240ms | ease-out | noncritical notification |
| flow | 1200ms cycle | linear | actual recent continuous frame delivery only |
| event | 240ms pulse | standard | real discrete event delivery only |

Standard cubic-bezier(.2,0,.38,.9); enter cubic-bezier(0,0,.2,1); exit cubic-bezier(.4,0,1,1). UI only, not performance imagery. Reduced motion: no continuous packet movement, no scale/slide, state switches immediately, keep static labels/contrast. User preference follows system and optional setting.

### Storyboards
M01 Add source: placeholder stays → new card appears opacity 0→1, y+4→0 over 180ms → connecting status; on actual frame fresh, thumbnail fade 180ms. No fake success.
M02 Select node: border/outline transition 150ms; related wires highlight; inspector content swaps with short opacity, focus remains predictable.
M03 Wire: drag handle creates temporary dashed edge; compatible ports highlighted; release triggers validation; accept = committed edge, reject = temporary edge disappears and specific reason.
M04 Signal: selected-ready line static; processing line static + at most one moving packet when real data fresh; discrete event pulses once. Drop stale immediately; never keep moving dots during idle/blackout branch.
M05 Cue: next cue gains outline without changing current-running indicator; GO accepted commits new state then old/new path highlight crossfade 180ms; no crossfade on actual output unless separately specified artistic transition.
M06 Record: actual recorder start fills red dot and elapsed timer; saving spinner only while IndexedDB transaction in flight; saved check only on commit. Recording continues through visual blackout.
M07 Photo: after real capture completes, slot fills with 100ms feedback; no strobe on audience display; denied capture leaves slot empty and reason.
M08 Fault: stale/error status appears immediately, downstream signal stops and affected output gates black; recovery action displayed; explicit resume, no animation implying automatic relight.
M09 Blackout: projected/local preview pixels black 0ms; control toggles selected state 100ms; current cue and REC indicators retained. Resume separate and preflighted.
M10 Viewport: Fit animates to computed bounding box 220ms; no animation when reduced motion or performance mode.
Do not use Lottie, GIF, video backgrounds or external animation runtime for UI. CSS/SVG and standard React state suffice; engine render loop unaffected.

## 6. UX writing dictionary
Fixed engine labels in English; operator guidance concise Indonesian. Avoid mixing English state terms in a single sentence. Consistent control names, no duplicate node-type headings.
| V5 label | V5.1 visible text | Details |
|---|---|---|
| NODE CANVAS / ONE GRAPH · LOCAL PREVIEW | Node Canvas (optional brand context) | remove subtitle |
| 0/3 role siap | 0/3 kamera siap | contextual count for selected cue; include all sources in tooltip |
| Camera Inputs / Camera / HP QR | Sources / + Kamera | chooser: Webcam/USB, HP QR |
| Camera 01 · Performer | Performer | assigned device subline |
| Camera 02 · Audience | Penonton | assigned device subline |
| Camera 03 · Gesture | Gestur | assigned device subline |
| Motion Detector / 33 landmarks | Motion | landmark details in Advanced |
| Footprint Generator / Gait / contact | Footprint | count, Decay |
| Dual Trace / Foot + head + shoulder ink | Dual Trace | detail in inspector |
| Session Recorder / Saved F1 Session / Trace Replay | Session | Record / Saved / Replay substate |
| Capture 4 Foto / Photo Bank | Photo Capture | 0/4 foto |
| Floor Composite / Floor Output | Floor | mixer details in inspector |
| Canvas Composite / Canvas Output | Canvas | mixer details in inspector |
| REC OFF | Record | state conveyed by icon/text accessible label |
| Black | Blackout | per output; clear label when latched |
| Tampilkan | Resume | explicit preflight, no auto relight |
| Studio lama | Legacy Studio | fallback menu |
| F1 READY before input | Menunggu kamera | ready only with actual preflight |

### Message catalog (actionable)
CAMERA_PERMISSION_DENIED: "Izin kamera ditolak." Action "Buka pengaturan".
CAMERA_MISSING: "Hubungkan kamera performer." Action "Tambah kamera".
CAMERA_STALE: "Kamera terputus." Action "Sambungkan ulang".
POSE_WAITING: "Menunggu performer masuk frame." No error toast.
IDENTITY_AMBIGUOUS: "Identitas A/B belum terbaca." Action "Reset A/B".
PORT_MISMATCH: "Port ini memerlukan video." Action select compatible source.
ROLE_CONFLICT: "Gunakan dua kamera berbeda." Action "Ganti sumber".
MEDIA_UNREADY: "Arsip belum siap." Action "Pilih file" / "Coba lagi".
SESSION_MISSING: "Rekam F1 terlebih dahulu." Action "Pilih F1".
CONSENT_REQUIRED: "Persetujuan penonton diperlukan." Action "Periksa persetujuan".
PHOTO_VERIFY_REQUIRED: "Periksa frame kamera penonton." Action "Verifikasi".
STORAGE_FAILED: "Rekaman belum tersimpan." Action "Ekspor JSON".
OUTPUT_BLOCKED: "Output gelap. Periksa kalibrasi." Action "Buka Map" (only when supported).
OUTPUT_RESUME: "Periksa sumber sebelum melanjutkan." Action "Resume".
Keep messages persistent while unresolved; transient success can fade after 3s. Do not show success before completion. Use aria-live polite for routine changes, urgent status for faults, avoid repeated announcements every frame.

## 7. Figma deliverables (next milestone)
Create one editable Figma Design file or page, using native components/variants and auto-layout; no screenshot-only frame. Use token collections `SOMA/Color`, `SOMA/Type`, `SOMA/Space`, `SOMA/Motion` with numeric duration variables and documentation. Components named by inventory. Import SVG asset sheet as editable vector primitives; recreate native text and controls using tokens. Keep fixture images distinct from product assets. Figma Smart Animate approximate UI transitions; annotate real signal events and zero-ms blackout, never claim prototype runs cameras.
Frames:
- 01 desktop empty graph (1440x900)
- 02 three cameras / F1 running + Record + next cue selected
- 03 F2 archive with floor intentionally black
- 04 F3A consent blocked, verified and armed, 4 photo slots
- 05 F3B replay with Session state
- 06 source loss + error recovery, current/next state
- 07 per-surface and global blackout latched
- 08 compact desktop 1280x800 / 1024x768
- 09 mobile setup 390x844
- 10 component states and motion annotations
All frames same workspace, no separate fragment navigation. Prototype paths: add/bind source, next cue then GO, record/save, capture, replay, blackout/resume, error recovery. Design review approves hierarchy, static copy count, contrast, source and output safety labels; no code implementation until review.
