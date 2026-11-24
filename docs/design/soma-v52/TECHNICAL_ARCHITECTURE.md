# V5.2 Technical Architecture | decision and spike brief
Proposed for technical architect · G0 · #261
Current entry points: src/studio/v51/SignalWorkspace.tsx (runtime/RAF/state), SignalGraph.tsx (fixed graph view and role connections), SignalModel.ts (preflight), src/studio/v5/NodeGraphModel.ts, VisualRuntime.ts, src/studio/v3/CameraHubRegistry.ts, src/f3/*, existing DualSurfaceSessionStore / ProjectionOutput / StageHardwareGate. Keep existing adapters until proven replacement.

## 1. Proposed architecture boundaries
WorkspaceShell (UI only) → Commands / selectors → graph draft + prepared cue → runtime router → existing engine adapters → surface controllers.
SourceRegistry owns media once per source; demand scheduler manages role consumers. Session service receives timestamped engine events and owns storage/replay. Capture service owns consent, crop and slot generation. TelemetryStore owns delivery snapshots; view layout store owns position/collapse/viewport. No dependency from engine render loop to Figma or UI animation.
Suggested modules (names provisional): SourceController, InferenceScheduler, GraphDocument, RouteCompiler, RuntimeRouter, CueController, SessionRecorder, ReplayClock, CaptureController, SurfaceController, TelemetryStore, ViewDocument. ADRs must specify reuse, migration, rollback and supported inputs.

## 2. Core interfaces (proposal)
```ts
type PortType = 'video'|'pose'|'gesture'|'footsteps'|'stroke'|'photo'|'media'|'session'|'frame'
type Endpoint = { nodeId: string; portId: string }
type Edge = { id: string; from: Endpoint; to: Endpoint; type: PortType }
type Source = { id: string; generation: number; frameSeq: number; frameAt: number; status: 'connecting'|'ready'|'stale'|'error' }
type GraphRevision = { revision: number; nodes: LogicalNode[]; edges: Edge[]; roles: RoleBindings }
type PreparedCue = { cue: CueId; revision: number; sourceGenerations: Record<string,number>; dependencies: string[]; plan: CompiledRoute; transitionId: string }
type Delivery = { edgeId: string; seq: number; at: number; mode: 'continuous'|'event'; generation: number }
type OutputState = { surface: 'floor'|'canvas'; latch: 'clear'|'blackout'; mode: 'preview'|'hardware'; calibrationSignature: string|null; ackAt: number|null; generation: number; authorized: boolean }
```
LogicalNode, RoleBindings, CueId, CompiledRoute defined in ADR; do not add arbitrary node types. Persist graph and layout separately. Grouping is view projection, not an edge rewrite. Validate known endpoints, direction/type, single writer/fan-out rules, cycle prevention and all required inputs including mixer reachability. Only adapter-supported connections editable. Invalid edits do not mutate active graph. During show view edits safe; runtime routing goes to draft or explicit stop. Source generation guards async callbacks.

## 3. Cue transport contract
SELECT → draft next only. PREPARE/GO → validate revision, source generations, media decode and playback preparation, session and privacy; reject without altering current cue. Commit once on frame boundary; flush old REC/disarm as needed, atomically activate new runtime. STOP → close recording/capture and black outputs. BLACKOUT → black final raster immediately and latch, keep clock/recording running. RESUME → explicit current readiness check, separate hardware authorization. SOURCE LOST → affected branch stale, latch affected surface, disarm F3; reconnect does not relight. Transition IDs make double GO idempotent; late promises cannot affect a newer cue. Validate whether media play may be prepared without disrupting active archive; document browser restrictions and recovery.

## 4. Source and performance
Dedup device IDs where present, permission probe closes safely; a source used by multiple consumers shares stream and video element. Role demand: performer body/feet; audience video-only; gesture body/hand as needed; unassigned video-only. Reuse compatible pose result, do not launch redundant models. Measure freshness from source timestamps and inference result separately. Keep QR lifecycle independent of inspector; use generation and cancellation for disconnect/rebind, no auto permission or consent on reload.
Telemetry snapshots 4–5Hz, thumbnails 6–10fps, 240x135 or less; visible nodes only; keep render RAF independent. Record actual payload acknowledgements; continuous animation only while recent continuous deliveries, event pulse once per seq, masked output distinctly shown. Existing edge 16 photo-bank delivery and output render-call telemetry need review. Baseline reference hardware + same fixture/resolution, report p50/p95, dropped frames, memory and 30-minute slope. Ten synthetic producers ≠ ten physical camera certification.

## 5. Session and media
Session schema v2 proposal: header (version, session ID, source provenance, start, duration, art settings), immutable ordered event chunks (relative timestamp, seq, kind, actor, payload), checkpoint index, commit status. Migrate v1 read-only, validate imports, no silent overwrite. Recorder separate time origin; normalize nested trace timestamps consistently; do not reset existing visual ink/tracking when starting REC. Chunked IndexedDB transactions with bounded queue and explicit quota/failure recovery; preserve previous committed take, export partial if approved. ReplayClock owns play/pause/seek/speed; media decoder tracks same clock with drift policy; deterministic checkpoint rebuild after seek. Verify 60k-event and 10k-visible-mark limits replaced/handled safely, avoid unbounded rendering memory. Test log order, import limits, save error, 10-minute real recording and 30-minute soak.

## 6. Capture/privacy
Audience and gesture different IDs; verify actual crop with operator and consent before display/arm. Capture token includes cue generation, camera generation, crop revision, consent revision, frame ID and event ID. Before commit recheck token, current crop and freshness, duplicate event and max four. Revoke cancels, clears photos/caches/affected pixels and invalidates F3B. Never upload frames; store photos locally only per current contract. Reconnect/rebind requires re-verification, no automatic arm. Manual capture fallback remains if gesture detector fails. Provide statechart and tests.

## 7. Projection
FLOOR has camera→stage-plane mapping; CANVAS uses independent flat-screen mapping, not legacy BODY mask by relabel. 4-point geometry validation (convex, nondegenerate, within supported bounds), separate calibration signatures including resolution/display transform, test pattern, clean raster no editor chrome. Browser display APIs optional; fallback manual output window placement, no unsupported promise. Output window handshake/heartbeat/ACK with generation; missing ACK or mismatched calibration fails closed. Global/per-output black applied to raster before publishing, no fade. Physical stage gate remains authoritative; explicit rearm after fault. Test disconnected display, invalid mapping, late message and independent blackouts physically at G3.

## 8. ADR register / dependency
| ADR | Owner role | Issue |
|---|---|---|
| ADR-01 baseline & rollback | architect/QA | #262 |
| ADR-02 source ownership & inference | vision architect | #263 |
| ADR-03 graph/cue transaction | runtime architect | #264 |
| ADR-04 session timeline & storage | media architect | #265 |
| ADR-05 surface calibration & transport | projection architect | #266 |
| ADR-06 capture privacy | capture architect | #267 |
| ADR-07 telemetry/perf | performance architect | #268 |
| ADR-08 view/interaction persistence | frontend architect | #270 |
Each ADR: context, alternatives (including reuse), decision, interfaces, statechart, migration, risks, measurable test evidence, unresolved questions. Avoid replacing legacy engines just for graph appearance. Architecture proposals not yet approved.

## 9. QA contract
Unit: graph validation, routing, session schema/order, source state, privacy, output latch. Browser fixture: real pixels F1–F3B, actual supported route changes, source loss, recording through blackout, consent revoke, 50 cue transitions, keyboard and responsive. Legacy Stage1/Stage2/F3/old node route smoke; isolate stale selectors vs regression. Hardware: 3 actual sources, 2 displays, 10-min F1 record, 30-min full rehearsal, blackouts verified physically. #272 owns traceability. Pages-only release/rollback; Vercel auto-deploy remains off.