# Technical specification — SOMA V5.1
Version 1.0 · 24 November 2026 · Proposed engineering contract

## 1. Baseline and implementation gap
Baseline main 1c41010aa5edd4ea7da334ab8a822f815d980df7. `UnifiedNodeWorkspace.tsx` currently owns source registry, refs/state, renderer RAF, capture and cue transport. `NodeGraphModel.ts` declares typed ports, validates edges, compiles via hardcoded node IDs and induced edges. `VisualRuntime.ts` uses GaitAnalyzer, TwoPersonIdentityTracker, DualTrace renderer, timestamped visual events, IndexedDB latest-session persistence and replayUntil. CameraHubRegistry owns trackers and streams; F3 modules handle crop, capture, consent and punch detection. Current graph is a visualization/planning kernel: editing SVG wires alone cannot modify engine execution.

Existing optical path: DualSurfaceSessionStore / ProjectionOutput / StageHardwareGate. V5.1 must not mislabel BODY mapping as a calibrated CANVAS output; preview only until explicit verified adapter. Existing V5 route and legacy Studio are rollback paths.

## 2. Proposed architecture
```text
WorkspaceShell
  ├─ GraphViewport → graph projection / grouping → typed ports / inspector
  ├─ SourceController → persistent CameraHubRegistry → source telemetry
  ├─ CueController → immutable PreparedCue → transition transaction
  ├─ RuntimeRouter → approved adapters
  │    ├─ motion → Footprint + DualTrace → SessionRecorder
  │    ├─ archive decoder → Canvas compositor
  │    ├─ gesture + audience → F3Capture / PhotoBank
  │    └─ session playback → Floor / Canvas compositor
  ├─ SurfaceController → local preview / explicit gated hardware adapter
  └─ TransportBar + Inspector → commands, never duplicate engine instances
```
Use React 19 and TypeScript as already installed. Evaluate @xyflow/react against existing SVG approach in an isolated spike; prefer it for handles, keyboard, viewport, fit and custom nodes if bundle/performance gates pass. Pin a reviewed version and lockfile only after design approval. No package changes in this spec. Keep engine modules independent of UI library. React Flow is optional implementation detail, not data source.

## 3. Data contracts
```ts
type CueId = 'F1'|'F2'|'F3A'|'F3B';
type Role = 'performer'|'audience'|'gesture';
type NodeStatus = 'idle'|'connecting'|'ready'|'processing'|'waiting'|'stale'|'error';
type Surface = 'floor'|'canvas';
type SourceId = string;
type GraphRevision = number;
interface SourceRecord {
  id: SourceId; kind:'device'|'phone'; deviceKey?: string;
  status:NodeStatus; lastFrameAt:number|null; fps:number|null; generation:number;
}
interface Endpoint { nodeId:string; portId:string; }
interface Edge { id:string; from:Endpoint; to:Endpoint; type:PortType; }
type PortType='video'|'pose'|'gesture'|'footsteps'|'stroke'|'photo'|'media'|'session'|'frame';
interface GraphDocument {
  schema:'soma.signal-workspace';version:1;revision:GraphRevision;
  nodes: LogicalNode[]; edges:Edge[]; roleBindings:Partial<Record<Role,SourceId>>;
}
interface ViewDocument {
  schema:'soma.signal-view';version:1;
  positions:Record<string,{x:number;y:number}>;collapsedGroups:string[];
  viewport:{x:number;y:number;zoom:number};
}
interface PreparedCue {
  id:CueId; graphRevision:GraphRevision;
  bindings:Readonly<Partial<Record<Role,SourceId>>>;
  requiredSourceIds:readonly SourceId[]; edgeIds:readonly string[];
  mediaGeneration?:number; sessionGeneration?:number; photoGeneration?:number;
}
interface CueTransport {
  selected:CueId; running:CueId|null; phase:'idle'|'preflight'|'running'|'blocked'|'stopped';
  pending:PreparedCue|null; blockers:Blocker[];
}
interface SurfaceState {
  surface:Surface; mode:'preview'|'hardware'; latch:'clear'|'blackout';
  health:'idle'|'ready'|'processing'|'blocked'|'stale'; generation:number;
  hardwareAuthorized:boolean; lastPresentedAt:number|null;
}
```
LogicalNode extends existing GraphNode with stable port contract. View nodes/groups are projections; grouping/collapse never alters edges. Persist logical config and view separately, not runtime tokens/consent/frames/latches as cleared. Data model supports one source fan-out to multiple compatible consumers; F3 audience and gesture must be distinct. Explicit role-binding validation translates current cam1/cam2/cam3 IDs. Role placeholders are not physical camera sessions.

## 4. Source ownership and lifecycle
Registry lives above graph viewport; a single owner per physical device or phone pairing. Deduplicate by deviceId when available; handle blank IDs through controlled permission flow and never register duplicate from default probe. Source removal closes stream once, revokes bindings and marks dependents blocked; running changes must be staged or require explicit Stop. Source status derived from actual video track, video ready/paused, monotonic frame freshness; existing 950ms beta freshness threshold is starting point, tune with hardware data. Media readiness is separate from tracker readiness: camera live + no pose = waiting. Reconnect uses epoch/cancellation guard; stale asynchronous completions ignored. Phone pairing components remain mounted outside inspector lifecycle, no QR reconnection on selection; disconnect invalidates epoch. Browser reload cannot preserve MediaStream; restore preferences only and request user action.

Camera previews use existing stream/video element through a subscriber; never call getUserMedia in a thumbnail. A visual graph card does not own a tracker. Preview frames cap at 6–10 fps for thumbnails, downsample to 240x135, skip offscreen. Pause thumbnails for hidden tab / reduced performance; preserve core runtime. 3 physical sources target; 10 synthetic producers stress test, physical capacity measured. Extra camera can be registered without auto-running all inference workers: enable only required consumers when supported, report limits and resource use.

## 5. Graph edits and compile
Phase A: fixed approved graph with dynamic source binding and draggable view nodes. Supported drag connections must call same binding command as inspector; all other engine wires read-only, clearly identified. Phase B: supported rewiring only after runtime router adapters exist. Do not expose arbitrary connect/reorder as functional while RAF still hardcodes branches.
- Validate endpoint exists; direction, type equality, fan-in cardinality; allow fan-out, reject self-loop and directed cycles.
- Validate all required input ports per cue; current compileCuePlan validates nodes but must also check required edges/reachability and dependencies, not only node membership.
- Prepare exact edge IDs and immutable source snapshots. Reject invalid or unsupported edits without mutating previous graph.
- During running cue, view edits allowed; logical edit goes to draft or requires Stop. GO compiles new revision; if revision changed since preflight, rerun preflight. Do not partially apply an invalid graph. Undo/redo only view and draft routing; never revert camera consent, capture, recording, or optical authorization.
- Node groups: Session has three endpoints (record sink, saved source, replay processor) with port identity preserved; Floor/Canvas wrappers retain mixer and output port IDs. Render wire reroutes from endpoints; when collapsed use labeled external handles, no implied cyclic data flow.
- Expose provenance (camera/phone/media/fixture/replay), not fake activity based on cue selection.

## 6. Cue transition state machine
```text
SELECT(next) -> selected=next; running unchanged; calculate blockers
GO -> snapshot selected, graph revision, source generations
   -> validate source freshness, required routes, decoded media, session & privacy
   -> failure: show blockers; previous running cue and latches unchanged
   -> success: at next render boundary:
      save/stop old F1 recording if moving away; disarm old F3 capture
      activate approved adapters and new clock; running=selected
      keep blackout latches; recompute per-surface health
STOP -> stop cue + recording flush + disarm; outputs black; selected retained
BLACKOUT(surface/all) -> immediate gate; keep running clock and recording
RESUME(surface) -> explicit action + current preflight + no fault latch; physical authorization separately
SOURCE_LOST -> mark affected routes stale; latch impacted output; disarm affected capture
```
GO never unblanks a manually latched surface or auto-arms capture. New cue selection never calls stopRecord/disarm. UI state cannot authorize optical light. Double-click GO is idempotent via transition ID; pending operation cancel/timeout leaves previous cue running. Reject stale async operations via generation. Allow explicit new F1 take without clearing live renderer; use separate event origin from performance clock, preserve current ink. Saved log generation atomically changes only after successful save; on storage failure retain in-memory/export status and previous disk log, distinguish unsaved take.

## 7. Runtime telemetry and visual truth
Source freshness from producer timestamp; edge activity from acknowledged payload/event delivered by adapter, not selection. Provide per-port lastDeliveredAt, sequence, payloadKind, generation; UI health snapshot aggregated 4–5 Hz via external store or stable subscription. Continuous video/pose can show animated packet only when recent delivery; event-only photo/footstep/stroke/record edges pulse on actual event, never simulate continuous traffic. Selected path shown with quiet outline; ready path static; active flow solid; waiting path static; stale dashed amber; error red with label. Avoid status churn (e.g. debounce positive transitions 100ms); loss and blackout immediate. Do not debounce safety. Use text/shape in addition to color.
No frame-level React state updates. Existing renderer RAF and worker own image pipeline. CSS transforms/opacity for UI. Performance metrics: render FPS, camera fps, inference p50/p95, dropped frames, long tasks, memory, frame age; report measured on reference Mac/Windows. Do not confuse preview paint with physical projector ACK.

## 8. Camera/photo/media handling
Reuse F3SessionMachine, F3PhotoStore, F3MotionFusion, F3FramingController, F3PunchEngine and F3StageRenderer. Verification of role and crop required before consent-dependent display/arm, no `setVerified(true)` solely on two fresh streams. Confirm operator view of correct audience framing; no audience preview imagery before appropriate permission and consent for intended use. Capture only B crop, gesture A. Async photo stillValid checks generation, consent, arm, cue, freshness and role IDs; duplicate event blocked, four slots max. Revocation immediately prevents pending capture commit, revokes object URLs, clears caches/preview and invalidates replay branch. Photos local memory; no analytics image upload. Preserve existing photo privacy model; any persistence feature requires separate approval.
Media node: decode/load ready/error distinct from file selected, revoke old URL after consumers release, safe fallback on decode failure. F3B preflight uses valid log + media ready + approved photo(s); four desired, >=1 current minimum explicit. Session log schema v1 maintained with migration support; event validation, monotonic times, storage quota, backup export. Test long session beyond old 60k-event cap or report/stop before loss; never silently truncate.

## 9. Projection and safety
Local monitor and fullscreen preview remain supported. Surface controller applies final gate before publishing pixels; blackout writes black immediately, cancels queued outgoing artwork and emits blackout command to any authorized output. If no hardware path, label PREVIEW, not LIVE. Hardware uses independent surface plans, calibration signatures, proof/ACK and explicit operator arming through StageHardwareGate and DualSurfaceSessionStore adapters. FLOOR camera calibration required before physical footprint; CANVAS is separate flat screen, not body mask. Existing hardware gate remains disabled unless existing environment and QA permit. Distinct floor and canvas output windows with clean raster and no UI. Fail closed on stale heartbeat, invalid calibration, disconnect, mismatched generation. No auto relight on new cue, reconnect, resize, fullscreen or refresh. Physical power cut remains independent. Verify actual black on both surfaces.
No CSS fade on projected blackout. UI indication may animate after the raster becomes black. Blackout overlay must not prevent ESC or accessible Stop.

## 10. Module boundaries and implementation sequence
| Phase | Proposed file/module | Purpose |
|---|---|---|
| M2 | `src/studio/v51/WorkspaceShell.tsx`, `GraphViewport.tsx`, `NodeCard.tsx`, `Inspector.tsx`, `TransportBar.tsx` | Presentational components, stable registry mount |
| M2 | `ViewModel.ts`, `TelemetryStore.ts`, `design-tokens.css` | state projection, UI tokens, snapshots |
| M3 | `SourceController.ts`, `GraphDocument.ts`, `RouteCompiler.ts` | dynamic source/typed routing |
| M3 | `CueController.ts`, `SurfaceController.ts`, `SessionAdapter.ts` | transactional transport, independent latches, recorder |
| M3 | `adapters/` | reuse VisualRuntime/F3/CameraHub/legacy projection |
| M4 | `tests/v51-*.test.ts`, `e2e/v51-signal.spec.mjs` | state, routing, pixel, usability |
| M5 | hardware calibration adapter | physical rehearsal and explicit signoff |

Keep `?workspace=nodes` beta stable while design is implemented behind a distinct feature flag / route. Switch default only after agreed release criteria; rollback doesn't alter saved log. No new build dependency before reviewed spike.

## 11. Performance, accessibility and QA
Target on reference laptop at 1440x900 with 3 actual sources: p95 UI input-to-feedback <=100ms; p95 canvas interactions frame <=24ms, UI animations target 60fps; <=5% renderer throughput regression compared with same-source V5 baseline, no extra inference for thumbnails; stable memory over 30 min (report slope). These are test targets, not measured claims. Use PerfObserver, browser traces, engine counters; record CPU/hardware and source resolution. Mobile is setup/monitor support, not certified show operation.
Keyboard: Tab logical order, Enter select/activate, Space pan only when canvas focused and not typing, arrow keys nudge selected node, +/- zoom, Fit shortcut optional, Escape closes popover then global blackout per explicit stage policy; ensure B does not fire while typing. Provide named controls, focus-visible, 4.5:1 normal text, 3:1 non-text controls, 44px touch targets on compact mobile; reduced motion suppresses flows/transition transforms. Never rely on color alone.

| Test ID | Scenario | Expected |
|---|---|---|
| Q01 | add 3 sources, extra source, duplicate, denial, unplug | one stream per source, actionable status, no leaked track |
| Q02 | assign/fanout/rebind and invalid types/cycle/occupied input | actual runtime route changes; invalid graph unmodified |
| Q03 | select F2 while F1 running/recording | F1 unchanged until valid GO |
| Q04 | F2 GO with missing/undecoded media | blocker; prior output remains if valid |
| Q05 | valid transition / double GO / stale async | atomic, no duplicate transition |
| Q06 | record/replay, stop/blackout, quota, reload | monotonic events, honest save state, explicit restore |
| Q07 | F3 role verification, consent revoke during capture, duplicate punch | correct source, no unauthorized photo, <=4 |
| Q08 | archive image pixel, fixture footprint, replay pixel | actual non-placeholder rendered pixel |
| Q09 | blackout per-surface / global / cue switch / reconnect | immediate black, latched until explicit resume |
| Q10 | drag/pan/fit/minimap/resize/keyboard/reduced motion | no stream restart, controls remain reachable |
| Q11 | screenshots at 1440,1280,1024,390 | no overlap/cut safety control; inspector scroll |
| Q12 | 3 real sources / 10 synthetic / 30min rehearsal | report latency, CPU, dropped frames, memory |
| Q13 | two real projectors, calibration invalidation, loss of ACK | fail closed and signed physical evidence |
| Q14 | legacy Stage1/Stage2/F3, QR pairing, existing test suite | no regressions |

Existing test `e2e/unified-node-v5.spec.mjs` asserts 17 visible nodes, GO missing camera message, F2 actual pixels, output blackout and global stop. V5.1 grouping changes visible count and blackout no longer stops cue: retain existing V5 test against old route or deliberately migrate to semantic assertions with new behavior. Never delete old pixel tests to make CI pass. Run npm ci, npm test, npm run build, browser QA and hardware gate separately.
