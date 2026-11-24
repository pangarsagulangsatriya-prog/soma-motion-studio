# V5.2 UX & Motion Contract | pre-Figma handoff
G0 proposal · #269 #270 #271. Extend V5.1 design tokens and Motion Lab; no Figma file or new production UI in G0.

## 1. Layout and hierarchy
One canvas, green palette unchanged (#111714 background, #19221E panel, #A7D4A8 accent). Header: project, readiness, settings, global Blackout. Main: sources → process → session → outputs; camera directly in graph; group expand/collapse preserves typed handles. Right rail: two pinned resizable monitors; collapsible inspector, own scrolling. Footer: running/next cue, primary blocker, REC timer, Stop, GO. No extra workspace per fragment. Compact desktop uses drawer; mobile setup-only, critical controls visible. At low zoom show node title/status, hide nonessential meta. Minimap and Fit use actual bounds. Output monitors canonical; processor thumbnails demand-driven.

## 2. Interaction matrix
| Interaction | UI feedback and command | Negative flow |
|---|---|---|
| Add source | chooser in graph, connecting card, fresh thumbnail | cancel releases pending resources; denied/stale actionable |
| Select/inspect | contextual details, highlight full upstream/downstream | no engine restart; focus remains |
| Drag typed wire | temporary line follows pointer, compatible handles lit, drop validates | type/role/cardinality/cycle rejection, prior route unchanged; occupied input Replace confirmation |
| Keyboard connect | choose port, list compatible targets, Enter to commit | Escape cancel and restore focus; stage blackout shortcut separate |
| Pan/zoom/fit | pointer, Space, wheel/pinch, fit bounds | no accidental control activation; reduced motion |
| Auto-arrange/minimap | explicit layout change / viewport navigate | view-only undo, not runtime or safety history |
| Group | collapse/expand session/mix internals | required ports still visible, no implied feedback loop |
| Cue select | next outline; running retained | blocker focus; no output reset |
| GO | pending then actual commit; UI path transition | reject retains current cue; no fake success |
| Record/save | red REC dot + elapsed, saving, saved check | quota/error export; don't erase existing art |
| Capture | real slot count and actual saved photo | consent/crop/source check, duplicate blocked, max4; revoke clears |
| Retry | inline source action and connecting state | stale callback ignored; explicit resume |
| Blackout/resume | instant black; latch label and separate resume | invalid readiness blocks resume; hardware gate separate |

## 3. Motion contract
Reuse V5.1 durations, tokens and easing; UI only. Use CSS/SVG transforms/opacity; no extra animation runtime or decorative loop. Continuous packet signal from actual deliveries; event pulse once per sequence, no activity inferred solely from cue selection. Cancel transitions on fault/revocation. No raster crossfade on blackout.
| ID | Trigger → state | Duration | Easing / reduced-motion |
|---|---|---|---|
| M01 | Source added → card enters; fresh frame → thumbnail | 180 ms | enter / immediate |
| M02 | Select → node and reachable wires highlight, inspector swaps | 150/180 ms | standard / immediate |
| M03 | Wire drag → temporary line follows pointer; valid drop commits | direct / 150 ms | no lag; invalid cancels |
| M04 | Continuous payload fresh → packet; discrete event → pulse once | 1200 ms cycle / 240 ms | linear / static state or count |
| M05 | GO committed → path highlights switch | 180 ms | standard / instant; raster unchanged by UI |
| M06 | Recorder state → red dot; actual storage pending/saved/error | 100 ms | standard / static label |
| M07 | Capture committed → slot fills | 100 ms | standard / immediate; no output flash |
| M08 | Fault → downstream activity stops, retry shown | 0 ms safety, 150 ms UI | immediate fault |
| M09 | Blackout → final raster black, control state | 0 / 100 ms | no raster transition |
| M10 | Fit → new viewport | 220 ms | standard / immediate |
| M11 | Inspector collapse/expand | 180 ms | enter/exit / immediate |
| M12 | Notice appears; success expires; blocker persists | 240 ms / 3s success hold | reduced: static, no fade |
Standard cubic-bezier(.2,0,.38,.9), enter (0,0,.2,1), exit (.4,0,1,1). Motion lab fixture must label simulation. Test interrupted animation, reduced motion and rapid input; safety events never debounce. Asset deliverable at #271: token deltas JSON/CSS, original SVG ports/status/empty states, isolated interactive state lab and motion annotations. No copying benchmark logos.

## 4. State inventory and wording
Source: empty, connecting, ready, stale, error; inference: waiting/processing; edge: planned/ready/delivered/stale/error/masked; cue: next/running/blocked/pending; session: idle/REC/saving/saved/error/replay; output: standby/preview/blackout/blocked/authorized; capture: consent required/verify/armed/capturing/saved/revoked/fault. Each has explicit state label or accessible name; color not sole cue. Avoid exposing LIVE unless hardware approved.
Fixed engine names English (Motion, Footprint, Dual Trace, Session, Floor, Canvas); guidance concise Indonesian. One blocker + next action, no repeated headings. Examples:
- "Hubungkan kamera performer." → Tambah kamera
- "Kamera terputus." → Retry
- "Menunggu performer masuk frame." → no false error
- "Port ini memerlukan video." → select compatible source
- "Periksa crop penonton." → Verifikasi
- "Rekaman belum tersimpan." → Ekspor
- "Kalibrasi belum valid." → Mapping
- "Output gelap." → Resume (only after preflight)
Technical metrics in Advanced; status and safety labels remain visible. 4.5:1 text, 3:1 non-text control contrast targets, keyboard focus, touch targets on compact setup. Record copy-count baseline and matched screenshots at four sizes.

## 5. Figma handoff gate
Before #273: reviewed ADRs, supported route matrix, statecharts, component variants, interaction/motion matrix, copy catalog, token deltas, SVG assets and motion lab, QA fixtures, known limitations. Figma creates editable native components/variables with ten frames: empty, F1 REC/next, F2, F3A consent/capture, F3B replay, fault, mapping, blackout, compact/mobile, library/motion. Keep one workspace. Prototype no real camera or projector claim. User approval before #274.