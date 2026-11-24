# SOMA V5.3 — Issue backlog and design review
Epic #278; all tasks open, proposed owner roles only.
| ID | Priority | Issue | Owner | Depends |
|---|---|---|---|---|
| L01 | P0 | #279 Workspace layout | Frontend architect | — |
| L02 | P0 | #280 Floating/dockable inspector | Frontend engineer | L01 |
| L03 | P0 | #281 Independent monitor dock | Frontend/runtime | L01 |
| C01 | P0 | #282 Parameter registry | Frontend/engine | L01 |
| C02 | P0 | #283 Photo Capture flow | UX/capture | C01,L02 |
| C03 | P1 | #284 Quick controls | Frontend | C01,L02 |
| G01 | P1 | #285 Graph ergonomics | Frontend | L01,L02 |
| U01 | P0 | #286 UX writing/blockers | Product/frontend | C01,L03 |
| M01 | P1 | #287 Motion/accessibility | Design systems | L02,C02,C03,G01,U01 |
| Q01 | P0 | #288 QA | QA lead | L01–M01 |
| R01 | P0 | #289 Release gate | Engineering/QA | Q01 |

## Execution waves
Wave 1: audit current layout and node capability, approve geometry/state contract (L01,C01), review safety shortcuts and runtime boundaries. Wave 2: layout/inspector/monitor + context flow and blockers (L02,L03,C02,U01). Wave 3: quick controls, graph ergonomics, motion assets (C03,G01,M01). QA develops fixtures from start and completes acceptance after integration. R01 only after relevant review/CI.
## Design review checklist
Before implementation, show editable design or labeled HTML prototype for floating, docked, clean, short desktop, capture missing/consent/verified/armed/full, error, quick controls, and monitor black states. Validate primary actions and real capabilities. A Figma file is optional if prototype and user review suffice; no Figma creation in this planning branch. Use same green palette.
## Evidence and scope
Every issue has specific acceptance criteria and cross-links. Keep V5.2 #262–#268 open (legacy regression, source inference, runtime routing, session timeline, projection and physical QA). Related #269–#272 remain parent contracts. No arbitrary node execution, new artistic features or hardware authorization under V5.3. No code/deploy at planning stage; future Pages-only release after approval.