# V5.4 Execution Backlog
Epic #293 · baseline b2164c4 · owner roles proposed, not GitHub assignments.
| ID | Priority | Issue | Owner | Depends on |
|---|---|---|---|---|
| A01 | P0 | #294 Document schema | Frontend architect | — |
| A02 | P0 | #295 Tool controller | Frontend architect | A01 |
| A03 | P0 | #296 Cue visual resolver | Runtime/frontend | A01 |
| G01 | P0 | #297 Group frames | Frontend | A01,A02 |
| G02 | P1 | #298 Collapse and notes | Frontend | G01,A03 |
| N01 | P0 | #299 Navigation/toolbar | Frontend | A02,G01 |
| N02 | P1 | #300 Selection/alignment/history | Frontend | A02,G01 |
| N03 | P1 | #301 Wire/ports | Frontend | A02,A03,G01 |
| U01 | P1 | #302 Hierarchy/copy | UX/frontend | A03,G01,N01 |
| M01 | P1 | #303 Motion/assets/accessibility | Design systems | A02,A03,G02,N01,U01 |
| Q01 | P0 | #304 QA | QA lead | All feature tasks |
| R01 | P0 | #305 Review/release | Engineering + QA | Q01 |

## Delivery waves
W1 technical contracts and fixture baseline (A01,A02,A03). Design review before feature integration: demonstrate group rename/move, Hand vs Select, F1–F3B dimming, running F1 + next F2, notes, collapse and five viewport sizes. Native Figma optional; labeled HTML prototype acceptable after user review.
W2 core editor (G01,N01); W3 polish (G02,N02,N03,U01,M01). QA develops tests from W1, signs acceptance after integration. R01 opt-in beta then canonical route only with review and passing gates. Prioritize P0; P1 exclusions explicitly documented and accepted, not silently counted complete.
## Cross-cutting constraints
Existing #270 #268 #285 #287 #288 may overlap; reuse evidence, keep open until full criteria. V5.2 runtime/optical/session work and V5.3 incomplete settings remain separate. No runtime rewrite or unsafe shortcuts. Each issue has acceptance criteria and evidence requirement. No production code, merge or deployment in this planning PR.
