# SOMA Compose Footprint Recovery & Visual Style Library Report

- **Date:** 2026-11-20
- **Overall Readiness Status:** **CONDITIONAL**
  - **Software Pipeline, Accuracy Invariants, Visual Style Library & Browser QA:** **READY** (788/788 automated unit + acceptance tests passing; TypeScript strict build clean; live headless Chromium WebGL2 QA passing with `0` console errors and `0px` desktop/mobile overflow).
  - **Physical Stage Hardware Accuracy (Real Camera/Projector cm RMSE, Latency & Dual-Surface Alignment):** **PENDING PHYSICAL QA** (cannot be claimed or fabricated in a headless software environment; must be verified on physical stage optics using the checklist in Section 5).

---

## 1. Summary of Changes Made

### A. P0 Footprint Accuracy & Event Provenance Recovery
1. **End-to-End Real Heel-to-Toe Orientation (`headingRad`) Preservation:**
   - Added optional finite `headingRad` to `FloorInteractionEvent` and `FloorContactInput` in `src/footprints/scenes/FloorInteractionEngine.ts`, validated on `FootMotionEventV2` in `src/footprints/scenes/FootMotionEventV2.ts`, preserved on `TimelineEvent` and converted to `headingDeg` in `reconstructTimelineFootprints` (`src/studio/v3/composerEventTimelineModel.ts`), and forwarded cleanly in `composerLiquidTrackEvents` (`src/studio/v3/composerLiquidAdapter.ts`).
   - Removed the fabricated `.62` pivot spin fallback in `composerLiquidAdapter.ts`; when orientation is uncertain, `headingRad` is omitted and `orientationKnown` stays `false`.
2. **Per-Foot Gait Phase Forwarding (`slide` / `pivot` / `release`):**
   - Added deduplicated, non-stamping `motionPhase()` to `FloorInteractionEngine` (`verified: false`, never mints a new contact stamp).
   - Updated `interactionAdapters.ts` so Camera (`LiveFloorTrackingEngine`), Video (`ReplayGaitEvent`), and 3D Simulator forward `slide`, `pivot`, and `release` alongside `contact`. This also resolved Timeline Replay stalling at 2 imprints per performer when `release` was previously dropped.
3. **Eliminated Generic Oval (`ellipse`) Fallbacks:**
   - Replaced `.ellipse(...)` rendering in `SurfaceComposer.tsx` (Timeline Replay) and `interactionAdapters.ts` (`paintFloorInteractionOverlay`) with `paintAuthenticFootprint` using real `left`/`right` 5-toe anatomy and heel→toe heading.
4. **Wired Operator Controls & Honest Provenance:**
   - Connected Compose `Ukuran` (`footprint.size`) via `footprintSpriteDimensions(...)` (preserving nominal `0.095 / 0.26` width-to-length ratio) and `Durasi jejak` (`footprint.life * 1000`) directly to both `composerLiquidTrackEvents` and `PixiLiquidImprintCompositor`.
   - Added explicit Stage Monitor provenance indicator (`LIVE DETECTED`, `VIDEO ESTIMATE`, `SIMULASI 3D`, `DEMO SINTETIK`, `MENUNGGU TRACK`) and isolated `Demo (Uji)` backdrop from stale simulator/camera floor layers.
   - Removed visible internal jargon (`MAT-03`) from operator-facing Compose labels without breaking legacy DOM QA hooks.

### B. Creative-Coding Visual Style Library & Live Performance Steering
- Added `src/footprints/materials/composeVisualStyles.ts` with 6 distinct procedural GPU shader styles inspired by TouchDesigner / Resolume / Hydra / teamLab / LUMOplay:
  1. **Mineral Ink** (`Organik Cair`)
  2. **Neon Flux** (`Elektrik`)
  3. **Ember Thermal** (`Bara Termal`)
  4. **Aurora Mist** (`Spektral`)
  5. **Topo Vector** (`Generatif`)
  6. **Chromatic Ripple** (`Interferensi`)
- Extended `src/footprints/materials/liquidMaterialShader.ts` and `src/footprints/materials/PixiLiquidImprintCompositor.ts` inside the **single existing PixiJS v8 WebGL2 context (`contexts: 1`)** — zero new WebGL contexts, zero new npm dependencies, every style strictly clipped inside the 5-toe anatomical foot mask and responsive to `contact`, `slide`, `pivot`, and `release`.
- Added live performance steering in `src/studio/v3/SurfaceComposer.tsx` & `src/studio/v3/cpux-compose-focus.css`:
  - **2×3 Style Library** gradient swatch selector cards
  - Interactive **Live Steer XY Pad** (`Flow × Turbulence`, supporting pointer drag, touch, and arrow keys)
  - 4 instant macro presets (`Halus`, `Panggung`, `Kinetik`, `Netral`)
  - Live `Glow`, `Warna (Hue)`, and `Pulse` sliders

---

## 2. 12-Scenario Acceptance Verification Table

All 12 software acceptance scenarios plus geometry/style/no-ellipse invariants are encoded in `tests/compose-footprint-acceptance.test.ts` and executed via `node --experimental-strip-types --test`.

| # | Scenario | Automated Software QA | Real Physical Stage Hardware QA | Notes / Evidence |
|---|---|---|---|---|
| S01 | Stationary foot 10s (0 duplicate stamps) | **PASS** | PENDING PHYSICAL QA | `GaitAnalyzer` + `FloorInteractionEngine` + `collectLiquidImprints`: exactly 1 stamp over 10,000 ms (`0` duplicates). |
| S02 | Forward walk 6 steps (count, side, heading) | **PASS** | PENDING PHYSICAL QA | 6 alternating `left`/`right` landings preserved into PixiJS & Timeline Replay with `< 0.5°` heading error (`orientationKnown: true`). |
| S03 | Backward walk (heel→toe vs body travel) | **PASS** | PENDING PHYSICAL QA | Synthetic backward gait keeps heel→toe heading within `< 2.0°` of toes, independent of `-X` travel vector. |
| S04 | Lateral steps (calibrated floor X/Y) | **PASS** | PENDING PHYSICAL QA | Exact UV floor mapping across lateral `xM` coordinates (`< 1e-6` UV error in software projection). |
| S05 | 90° and 180° turns | **PASS** | PENDING PHYSICAL QA | Heel→toe heading matches 90° and 180° targets within `< 2.0°` synthetic ground truth. |
| S06 | Pivot on supporting foot | **PASS** | PENDING PHYSICAL QA | `0` extra contact stamps; `pivot` phase forwarded (`deformation.mode === 'pivot'`). |
| S07 | Slide / drag | **PASS** | PENDING PHYSICAL QA | `0` false contact stamps; `slide` phase forwarded (`deformation.mode === 'slide'`, non-zero travel). |
| S08 | Rapid stop–start | **PASS** | PENDING PHYSICAL QA | Origin `eventId` deduplication + sub-threshold jitter rejection prevent duplicate stamps. |
| S09 | Two performers crossing (1P/2P isolation) | **PASS** | PENDING PHYSICAL QA | A/B stamps isolated; ambiguous crossing frame emits `0` stamps and `0` identity swaps. |
| S10 | Foot occluded 0.5–2s | **PASS** | PENDING PHYSICAL QA | Visibility `0.20 < 0.55` emits `0` fabricated stamps for 1.2s; clean recovery upon re-entry. |
| S11 | Disconnect / reconnect / session reset | **PASS** | PENDING PHYSICAL QA | `bus.reset()` increments session epoch; stale pre-disconnect capture is dropped cleanly. |
| S12 | Mode transitions (`Demo ↔ Camera ↔ Video ↔ Simulator`) | **PASS** | PENDING PHYSICAL QA | Cross-source writes rejected; `liquidOutputAuthorized() === false` and `footMotionAuthorizesPhysicalOutput() === false`. |

---

## 3. Observed Software & Browser QA Metrics (Honest Measurements Only)

- **TypeScript (`npx tsc --noEmit`):** 0 errors.
- **Automated Test Suite (`npm test`):** **788 / 788 PASS** (775 pre-existing regression tests + 13 new Compose acceptance & visual steering tests; 0 failures, 0 skipped).
- **Production Bundle (`vite build` / `compile_applet`):** PASS.
- **Headless Chromium Browser QA (`playwright-cli` on `http://localhost:3000`):**
  - WebGL2 PixiJS v8 single-context compositor: active (`mat03Active: "drawn"`, `contexts: 1`), `0` console errors, `0` uncaught page errors.
  - Visual verification confirmed distinct shader outputs strictly clipped inside the 5-toe anatomical sole across `Mineral Ink`, `Neon Flux`, `Ember Thermal`, `Aurora Mist`, `Topo Vector`, and `Chromatic Ripple`.
  - Live Steer XY Pad (`Flow × Turbulence`), macro presets, and provenance tags (`SIMULASI 3D` vs `DEMO SINTETIK`) verified interactively.
  - Responsive layout: `0px` horizontal overflow at both `1440×900` desktop and `390×844` mobile.
  - **Not Measured (Hardware-Dependent):** Physical floor position RMSE (cm), physical projector brightness contrast, high-speed camera end-to-end glass-to-glass latency (ms), and multi-person physical occlusion under stage theatrical lighting remain **PENDING PHYSICAL QA**.

---

## 4. Safety & Architecture Integrity Verification

- Projector hardware safety gates (`StageHardwareGate`, `DualSurfaceCalibration`, fail-closed blackout, `liquidOutputAuthorized() === false`) were **not modified or weakened**.
- Compose still consumes the **single existing event pipeline** from Track (`FloorInteractionEngine → FootMotionEventV2 → composerEventTimelineModel → composerLiquidAdapter → PixiLiquidImprintCompositor`); no second camera stream or pose inference worker was added.

---

## 5. Remaining Physical Stage & Projector QA Checklist

Before declaring **READY** for live public performance with physical floor projection:
1. Calibrate 4 floor corners in Track (`LiveFloorTrackingEngine`) and verify physical meter-to-projector correspondence in Map (`3×3` / 4-corner warp).
2. Perform S01–S10 physically on stage with tape markers at 1 m intervals and measure actual toe/heel landing offset (cm) and heading error (degrees) on camera + projected floor.
3. Verify `Blackout` (`B` / `Esc`) cuts physical projector light immediately during active stepping and rapid style steering.
4. Confirm glass-to-glass latency and 30–60 fps GPU thermal stability on the target performance laptop/projector setup across 15 minutes of continuous 2-performer stepping.
