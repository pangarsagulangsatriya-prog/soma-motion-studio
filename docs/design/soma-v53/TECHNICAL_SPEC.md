# SOMA V5.3 — Technical Specification
Proposed architecture contract · Epic #278 · baseline 5a7e91a
Review before implementation. Existing React/TS/Vite and CSS/SVG stack; no new dependency required without a measured need.

## 1. Baseline code and module boundaries
src/studio/v51/SignalWorkspace.tsx owns registry/runtime/photo/record/cue refs, monitor canvases, selection and inspector state. Lines 255–269 in baseline render graph, monitors and inspector in one main grid; .sw-rail is a flex column and .sw-monitors flex:none, .sw-inspector flex:1. SignalGraph.tsx renders position/drag/zoom, typed handles and minimap, onSelect currently opens inspector. Keep existing runtime lifetime above all layout presentation. Extract view layer without moving ownership or creating parallel streams. Maintain V5 and V5.2 fallback and separate hardware gate.
Proposed modules:
- WorkspaceLayoutStore.ts: validated geometry, modes, preferences, pure reducer.
- AdaptiveWorkspaceShell.tsx: header/work area/footer, safe rect measurement, responsive modes.
- FloatingInspector.tsx: one persistent inspector body with chrome; drag, resize, dock, close.
- MonitorDock.tsx: two persistent canvas hosts, independent sizing and output status.
- NodeParameterRegistry.ts: per-node descriptors with capabilities, real handlers and disabled reason.
- NodeQuickControls.tsx: anchored nonmodal controls.
- ActionStateResolver.ts: preflight and context action derivation, no engine side effects.
- ViewportController.ts / SignalGraph adapter: focus, fit, toolbar, minimap, hit targets.
- WorkspaceMotion.css: extend existing tokens and respect system preference.
Keep existing CameraHubRegistry, VisualRuntime, F3PhotoStore/Machine, Surface latch behavior and cue handlers. Prefer stable DOM placement with CSS grid/absolute positioning for dock/float; avoid reparenting via a changed portal container or keys. QR receivers remain mounted in runtime-owned host even if inspector closes. Do not use new media streams in quick controls or thumbnails.

## 2. State contract
```ts
type PanelMode = 'floating'|'docked'|'closed';
type Rect = { x:number; y:number; width:number; height:number };
type LayoutPreferences = {
  schema: 'soma.adaptive-layout'; version:1;
  mode: PanelMode; floatRect: Rect; dockWidth:number;
  monitorWidth:number; minimap:'auto'|'shown'|'hidden';
  reducedMotion:boolean;
};
type LayoutState = { prefs:LayoutPreferences; safeRect:Rect; compact:boolean;
  selectedNodeId:string|null; quickNodeId:string|null; previousOpenMode:'floating'|'docked' };
type LayoutAction =
  | {type:'SELECT'; nodeId:string|null}
  | {type:'OPEN'; nodeId:string}
  | {type:'CLOSE'} | {type:'DOCK'} | {type:'FLOAT'}
  | {type:'MOVE'|'RESIZE'; rect:Rect}
  | {type:'VIEWPORT'; safeRect:Rect; compact:boolean};
```
Selection, inspector mode and quick popover are distinct. SELECT highlights and optionally updates contents of an already open inspector, never opens a closed inspector. OPEN explicit. Drag start records origin; pointer threshold 4 CSS px; suppress click/open after drag. No layout reducer calls runtime commands. Only explicit supported parameter commands touch engine state. Save validated preferences to new localStorage key; schema and finite-number validation, clamp on restore, unknown schema fallback. Store only layout geometry and preferences, not current cue, consent, photos, streams, arm, calibration or latch clear. Debounce persistence on pointer end; no per-frame disk writes. Existing graph positions remain compatible.

## 3. Geometry and responsive behavior
Header 50px, transport 64px desktop; main fills remaining viewport using grid minmax(0,1fr), min-height:0 and overflow:hidden. Measure actual header/footer/main/rail with ResizeObserver; safeRect = visible graph rect minus reserved toolbar/minimap margin, not screen dimensions. Floating default width 360px, min 300, max 480; height content-driven up to min(600,safe height); min usable height subject to viewport, scroll only body if needed. Dock width 320–420. Monitor rail 280–440 constrained to retain usable graph width. Clamp rectangle: width=min(max(request,minWidth),safe.width); height=min(max(request,minHeight),safe.height); x=clamp(request.x,safe.x,safe.right-width), similarly y. When safe size below minimum use compact overlay/sheet rather than negative clamp. Margin 12px where available. Header and sticky applicable footer outside scroll body. Float never covers monitor rail, global header or transport. At 1024/short desktop fall back to float or compact nonmodal overlay if dock leaves insufficient graph; at 390 use bounded setup drawer, persistent safety controls. Restore user preference on wider viewport but never mutate runtime.
Two monitor hosts stable; each header and aspect-ratio 16:9 raster contained in height budget; cap preview height rather than crop output. If insufficient vertical room, two monitors side by side or explicit tabs with both canvas hosts mounted; hidden tab still renders as required by current runtime. No CSS transition on raster or blackout. Separate resize handle with accessible slider/keyboard alternative; no layout feedback loop. Use pointer capture on drag/resize and cancel on lost capture; transform updates at RAF, commit final geometry on end. CSS stacking layers: graph 0, wires/nodes, graph toolbar, popover/inspector, header/transport safety above all. Ensure no document scroll at desktop and no page clipping of essential controls.

## 4. Parameter and primary-action contracts
```ts
type CommandDescriptor = {
  id:string; nodeKinds:readonly string[];
  label:string; kind:'range'|'action'|'file'|'toggle'|'select'|'status';
  capability:string; quick:boolean;
  unit?:string; min?:number; max?:number; step?:number;
};
type ActionState = { id:string; label:string; enabled:boolean;
  blocker?:{text:string; recoveryId?:string}; severity?:'info'|'warning'|'error' };
```
Descriptor registry is capability-gated and receives actual state selectors + existing callbacks; one parameter value shared across inspector and popover. Never store a shadow decay value. Use existing decay 1000–60000ms step1000, display seconds. Reset A/B belongs to Motion and calls existing resetTracking; explain consequence. Source bind/retry/remove uses existing permission and active-cue locks; confirmation only for destructive or occupied binding. Archive picker belongs to Archive; Session import uses existing validated import (stopped), export/record actual state. Output controls use existing toggleSurface/full; no mapping placeholders. For proposed new sliders validate engine API first and link runtime task. Disabled states have visible reason, recovery links focus relevant node; no tooltip-only blocker.

## 5. Capture flow derivation
Resolve priority in this order from actual runtime snapshot: missing audience/gesture or same source → source action; consent absent → consent control; fresh source + consent but unverified crop → verify; verified but F3A not running → prepare/go F3A (existing transport); running and not armed → Arm; armed with <4 slots → Capture; >=4 → complete/review. Busy/capturing/fault disables applicable action with actual reason. Consent revoke and clear actions always reachable when applicable. Panel reconfiguration never calls disarm or clears photos. Revocation and source change keep existing generation checks; no auto-arm. Verify actual audience frame/crop per #267; UI cannot set verification automatically. Gesture node shows status and link to Capture, no duplicated consent and grid. On small screen show compact 4-slot strip, conditional preview, sticky current action. Do not expose unapproved imagery through thumbnails or popovers.

## 6. Monitor status semantics
Status selector precedence: manual latch → Blackout; explicit fault latch with reason → Fault/blocked (retain distinction from manual in UI metadata; do not infer from black pixel); no active cue → Standby; cue does not use surface → Cue black; required source/media invalid → No signal/blocked; otherwise local Preview based on actual renderer output. If current latch representation cannot distinguish fault/manual, add presentation reason metadata without altering safety contract. Preview not hardware LIVE. Preserve local canvas refs and independent blackout; header/transport always above panel. Review Escape contract: existing global Escape triggers blackout; do not silently repurpose. Either retain Escape as blackout and provide close via button/explicit shortcut, or approve scoped Escape policy with QA and keep dedicated B/Blackout controls. Never allow panel key handler to disable emergency action inadvertently.

## 7. Graph controls and motion
Zoom-aware hit targets: maintain at least ~24 CSS px effective desktop target where spacing allows, expand via screen-space handle overlays or inverse zoom hit region; avoid overlapping hit targets, use keyboard connect chooser at dense zoom; touch controls 44px where feasible. Fit uses actual graph viewport minus tool overlays; Focus selected node centers with bounds; visual reroute paths only, no edge mutation. Group viewport buttons; minimap auto-hide based on fit and explicit toggle. Preserve graph history as view-only. Node labels and status remain legible at semantic zoom; full title on focus. Pointer drag updates only layout.
| Motion | Duration | Trigger / interruption |
|---|---:|---|
| Inspector enter | 160ms | explicit open; cancel exit and animate from current state |
| Inspector exit | 120ms | close; focus restored, hidden/inert after exit |
| Dock/undock | 220ms | committed geometry; FLIP or short transform, no per-frame engine remount |
| Node focus | 220ms | explicit action; user pan cancels |
| Quick popover | 120ms | open/close; flip and clamp to viewport |
| Drag/resize/parameter | direct | pointer/actual command; no smoothing delay |
| Capture slot | 100ms | actual successful commit only |
| Error UI | 150ms | immediate state/fault; optional visual transition |
| Blackout raster | 0ms | immediate existing gate; no animation |
Use existing green tokens and standard (.2,0,.38,.9), enter (0,0,.2,1), exit (.4,0,1,1) easing. CSS transform/opacity; reduced motion disables nonessential transitions, static status. No simulated signal or decorative animation in live view. Keyboard: Tab predictable, Enter opens settings via focused control, close returns focus, no trap in nonmodal panel, labelled drag/resize alternatives, accessible names and non-color states. Target 4.5:1 text, 3:1 non-text. Keep focus and action visible on short viewport.

## 8. Test and rollout
Unit: reducer transitions, geometry invalid/NaN/small viewport, persistence migration, command ownership/capability, action precedence, monitor state precedence. Browser: desktop 1440×900/1280×800, 1024×768, 1280×600, 390×844; assert document scrollHeight <= viewport at desktop, safety buttons inside viewport and unobstructed using hit-test, primary action visible in each applicable node state. Drag/resize/dock/close/reopen, reload invalid prefs, focus restoration, reduced motion, panel switching and quick decay shared state. Actual archive pixel render while 50 layout actions, compare before/after, blackout and resume latch, cue/record unchanged; fixture cameras count open/close and assert no re-init; F3 consent revoke/crop/source and slot state preserved. Use existing e2e/v51-signal.spec.mjs tests as regression, add v53-specific tests. Run npm ci, npm test, npm run build -- --mode githubpages, targeted browser/legacy suites. Record baseline legacy failures (#262) separately; do not hide regression. Actual camera/projector test not implied by fixture. Flag/route rollback preserves V5.2. Pages verified SHA only; leave vercel.json unchanged. No production modifications in this spec branch.