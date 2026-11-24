# SOMA V5.1 — Signal Workspace
Design handoff · 24 November 2026 · specification only

Baseline: main @ `1c41010aa5edd4ea7da334ab8a822f815d980df7`. This package does not modify production code, deploy Pages/Vercel, or claim hardware approval. Figma design is the next separate milestone.

## Read in this order
1. [PRD](PRD.md) — decisions, flows, requirements and acceptance criteria.
2. [Technical specification](TECHNICAL_SPEC.md) — runtime contracts, source routing, state, safety, QA.
3. [Design & motion specification](DESIGN_MOTION_SPEC.md) — tokens, components, copy, assets, Figma checklist.
4. [Design tokens JSON](assets/tokens.json), [CSS tokens](assets/tokens.css), [vector asset sheet](assets/node-assets.svg).
5. [Motion lab](assets/motion-lab.html) — open locally in a browser, no cameras or actual engine connected. Contains simulated states, reduced motion, cue and blackout interactions.

## Source of truth
- Existing [V5 PRD](../../SOMA_V5_UNIFIED_NODE_CANVAS_PRD_AND_FUNCTIONAL_QA.md).
- Existing `src/studio/v5/UnifiedNodeWorkspace.tsx`, `NodeGraphModel.ts`, `VisualRuntime.ts`, `unified-node.css`, `src/studio/v3/CameraHubRegistry.ts`.
- Existing `e2e/unified-node-v5.spec.mjs` and graph/session unit tests.
- Unpacking: In Passing [FigJam](https://www.figma.com/board/9Oj9BkxjBqZjSnhrvjnggW/Unpacking---In-Passing?node-id=0-1).
- Current [Pages beta](https://pangarsagulangsatriya-prog.github.io/soma-motion-studio/?workspace=nodes).

Do not treat an illustrated graph, selected cue, or UI animation as evidence of a live source or calibrated output. Fixture data must be labeled. Preserve legacy Studio, all current engines, and explicit optical safety checks.

## Milestones
M0 specification/assets → M1 Figma design review → M2 UI shell + telemetry → M3 cue/source/runtime adapters → M4 browser QA → M5 calibrated hardware rehearsal → release. No production changes before design review.
