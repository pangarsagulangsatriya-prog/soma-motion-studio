# SOMA V5.4 — Technical Specification
Proposed contract · Epic #293 · baseline b2164c4
Reuse React/TypeScript/CSS/SVG. Read src/studio/v51/SignalGraph.tsx, SignalModel.ts, SignalWorkspace.tsx, signal-workspace.css, src/studio/v5/NodeGraphModel.ts, src/studio/v53/AdaptiveModel.ts and adaptive.css before implementation. Preserve engine owner lifetime, adaptive inspector and monitor refs.

## 1. Module boundaries
GraphDocumentStore owns view-only schema and transactions. GraphToolController owns tool and pointer state. CueVisualResolver is a pure derivation of compiler plans and runtime telemetry. GraphLayoutRenderer draws frames, cards, notes, ports and wires; ViewportController owns pan/zoom/fit/focus. Existing SignalWorkspace owns cue, sources, recording, consent, output latches and actual commands. No engine creation within renderer. Do not duplicate state from existing runtime or claim arbitrary editable runtime graph.

## 2. View document and migration
```ts
type Point = {x:number;y:number};
type Rect = Point & {width:number;height:number};
type Group = {id:string;title:string;note:string;members:string[];minRect:Rect;collapsed:boolean;accent?:string};
type Note = {id:string;position:Point;text:string;groupId?:string};
type ViewDocument = {
 schema:'soma.graph-view';version:1;
 positions:Record<string,Point>;groups:Group[];notes:Note[];
 viewport:{x:number;y:number;z:number};minimap:boolean;snap:boolean;
};
type Tool = 'select'|'hand'|'frame'|'note';
```
Stable logical node IDs, viewId aliases for grouped engine cards; group id independent of label. For physical camera cards use stable registry/source identity only if recoverable across reload; otherwise save role-based geometry and reapply after explicit rebind. Never persist streams, permission, consent, photos, armed state, running cue, latch clearance or hardware authorization. Dynamic source membership reconciles by identity; unbound/new sources in Sources. Add affordance is virtual and not an engine member.
Storage key soma.graph-view.v1; read legacy soma.signal-layout.v1 positions, validate finite bounds, maintain existing processors and role placeholders; keep old key for rollback. Missing/unknown version or corrupt entries fall back safely; cap document sizes (e.g. 100 groups, 500 notes, text 1000 chars; validate with actual use). Unique members, reject duplicates/orphans, no nesting MVP. Plain text rendered by React, no HTML injection. Persist on transaction end/debounce; no pointer-frame writes. View history 50 transactions, one snapshot per completed move/rename/resize/ungroup; undo/redo excludes cue and source binding. Selection/tool transient, viewport stored separately from undo when appropriate.

## 3. Tool and pointer state machine
```ts
type Interaction =
 | {kind:'idle'}
 | {kind:'press';pointerId:number;origin:Point;target:string}
 | {kind:'pan';pointerId:number;origin:Point;view:Point}
 | {kind:'move';pointerId:number;origin:Point;members:string[]}
 | {kind:'marquee'|'frame'|'resize';pointerId:number;origin:Point}
 | {kind:'wire';sourceId:string}
 | {kind:'edit';target:string};
```
Priority: emergency/global actions > editable fields/Inspector > explicit tool > target-specific command. Hand/middle/temporary Space starts pan even over card/port, except independent UI controls; never call node selection, open, drag or wire callbacks. Use capture on graph, pointer ID checks; release on pointerup, cancel/lostcapture/blur. Press threshold 4 CSS px (screen coordinates before zoom); commit click only if not moved. Clear suppression after gesture deterministically (do not suppress next unrelated click). Double-click only valid non-drag Select press. Native text selection disabled in graph via user-select:none, restored in text editor. Pointer motion graph-space delta = screen delta / zoom. Use RAF-coalesced view updates, no unnecessary inference or storage. Keyboard target guards include input/textarea/select/contenteditable/dialog and composed path. H/V/F/N only when graph active; Space temporary hand outside editing controls; blur/keyup restores prior tool. Escape continues current global blackout, do not stop propagation; cancel pending wire without runtime change. Accessible buttons and aria-pressed, shortcut tooltips, keyboard path for frame rename and notes.

## 4. CueVisualResolver
Input: logical GRAPH, next, running, bindings, delivery samples, time, actual fault state, selected/hovered card. Compile next/running plans once per cue change, map logical membership through viewId; dedup shared cards, do not traverse grouped card as feedback loop. Return per-card {planned,running,selected,focused,inactive,fault,detail} and per-edge {planned,running,fresh,focused,fault,muted,animate}. External edges filter mapped endpoints equal; internal edges remain in compiler plan. Exact planned sets listed in PRD.
Algorithm: eligible = nextEdges ∪ runningEdges; scope traversal to eligible edges (or next only for review emphasis, with running overlay preserved). Fresh = running membership AND signalFresh(actual payload sample, now) AND not stale/error AND not masked at final output; do not infer from planned selection. Continuous packets only for genuine continuous delivery, event pulse once per sequence. If telemetry not proven actual, use running/waiting, not fake delivered; review output ACK/render-call caveat under #268. Source error distinct from black pixels. Focus via separate halo/outline, never same class as delivered. Nonmember nodes opacity target .32–.45, edges .12–.22; preserve readable label/focus when editing but no unrelated line activation. Next-only planned line dashed; running line solid muted; delivered typed color + motion; inactive fault icon accessible without brightening branch. Selected group title stays readable. State changes do not affect commands or gates.
Cue selection changes next; clear unrelated graph focus/hover and stale quick-popover, but preserve explicit editing of a node in open Inspector with out-of-cue label or close on reviewed policy; never silently change value. Running indicators remain. F3B capture card label/detail Saved photos from existing photo count, no camera preview or arm implication; collapsed Session label Replay. F1 recorder membership represents planned recorder, not active recording.

## 5. Frames and notes geometry
Default frames computed around members with 16px horizontal padding, 34px header and 16px bottom padding, minimum rect optional. Preserve original layout during migration where possible; use explicit Auto Arrange if overlap. Layer order: background grid → frame fills → wires → cards/proxy handles → frame headers/notes → selection/marquee → toolbar/popovers. Group header drag snapshots member positions plus group rect/attached notes, applies single delta, commits once; independent node movement updates computed bounds. Resize changes minimum rect but cannot clip members. Frame creation wraps selection or marquee bounds, membership change explicit (no automatic reparent on accidental overlap). Delete frame ungroups; no runtime deletion. Collapsed frame stores expanded geometry, computes stable proxy handle per external logical endpoint and direction; multiple edges may share a proxy only if same underlying endpoint; keep edge ID, direction/type and delivery semantics. Do not allow new arbitrary routes via proxy; compatible camera role connection only when mapped precisely and unlocked; otherwise open group to edit. Notes plain text, no secrets or image blobs. Fit uses visible bounds incl frames/notes/proxies; no fixed 1108x680 minimum if actual geometry differs, reserve toolbar/minimap; empty document safe defaults.

## 6. Viewport, wire and selection
Plain wheel deltaX/deltaY pan, normalize deltaMode; ctrl-wheel zoom around pointer using clamped z .2–2, explicit buttons and keyboard; document browser pinch limitations. No wheel hijack in Inspector/popovers. Fit uses min of available width/height after margins and overlays, calculates translation from min/max bounds including negative positions if permitted; focus union selected bounds. Minimap shares same coordinate transform and aspect ratio; click maps screen→world, viewport outline clipped. Pan user action cancels animation. Persist view after interaction, clamp restored zoom, Fit available if offscreen. Auto-layout explicit, group order Sources→Process→Session→Output, avoid overlap and preserve member identity. Shift-click/marquee selection, multi-drag delta, snap grid (e.g. 12 world units) optional, guide tolerance in screen pixels. Align only visual positions. Wire curves avoid backtracking where feasible, visual waypoints keyed by edge ID, no graph mutation. Screen-space port hit targets >=24px where spacing allows, avoid overlapping hit zones and offer keyboard compatible target chooser when dense. Fixed engine edges read-only; use existing sourceAssignment and active cue lock, distinct audience/gesture requirement; invalid drop leaves bindings unchanged. Do not display draggable affordance on unsupported ports.

## 7. Motion, assets, accessibility
| State transition | Duration | Rule |
|---|---:|---|
| Cue dimming | 180ms | Next membership only; running delivery remains |
| Selection/group outline | 120ms | Focus distinct from telemetry |
| Collapse/expand | 180ms | Preserve edge identities; no fake packets |
| Fit/focus | 220ms | Cancel on manual pan/zoom |
| Drag/pan/resize | direct | No easing on pointer |
| Inline rename | direct | Enter commit, explicit cancel; Escape safety retained |
| Signal pulse | existing 240ms | Actual event sequence only |
| Blackout raster | 0ms | Existing safety path unchanged |
Reuse SOMA green tokens and existing easing. Original SVG tool assets or existing Lucide icons, tooltip strings, state fixtures and isolated interaction demo; label simulated data. Reduced motion disables nonessential transitions. Focus rings, screen reader names, keyboard navigation, contrast targets 4.5:1 text/3:1 controls; noncolor state indicators. Keep title/status legible without shrinking text excessively. Do not animate output raster or delay blackout.

## 8. Verification and release
Unit: schema migration, malformed prefs, group move/ungroup/collapse proxy identity, view history, pointer state, exact cue resolver (including shared sources and selection outside cue), viewport transform, stale/fault/masked states. Browser: test V/H/Space and pointer cancellation; Hand across node/port no command; group rename/move/notes, undo/reload; exact F1–F3B dim classes, F1 running F2 next; archive pixel continuity, 50 view operations, no camera reopen/record stop, Escape blackout, compact geometry and safety hit-test. Preserve V5.3 adaptive and V5.2 fallback tests, investigate legacy Stage 2 failures separately (#262). Test sizes 1440×900,1280×800,1024×768,1280×600,390×844; mobile setup not certified stage mode. Run npm ci, npm test, npm run build -- --mode githubpages, targeted Playwright. Measure latency and throughput on matched device/fixture, distinguish simulated and physical. QA gate #304, release #305. Proposed route nodes-v54 beta, nodes-v53 explicit fallback; canonical nodes switches after approval, test legacy entry link, deployed build marker and fresh browser. No Vercel changes. No production code in this specification.