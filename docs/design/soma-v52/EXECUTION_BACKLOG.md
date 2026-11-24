# V5.2 execution plan and GitHub backlog
Epic #261 · baseline 6021cc1 · all issues open at creation. Proposed owner roles, not assigned GitHub users.
| ID | Priority | Issue | Owner | Depends on |
|---|---|---|---|---|
| A01 | P0 | #262 Regression baseline | Architect + QA | — |
| A02 | P0 | #263 Source lifecycle | Vision architect | A01 |
| A03 | P0 | #264 Graph/cue runtime | Runtime architect | A01,A02 |
| A04 | P0 | #265 Session/replay | Media architect | A01,A03 |
| A05 | P0 | #266 Projection | Projection architect | A01,A03 |
| A06 | P0 | #267 Capture/privacy | Capture architect | A02,A03 |
| A07 | P0 | #268 Telemetry/perf | Performance architect | A02,A03,A04,A05 |
| U01 | P1 | #269 Hierarchy & copy | Designer + architect | A01,A03,A05,A06 |
| U02 | P1 | #270 Interaction & persistence | Frontend architect | A03,U01 |
| U03 | P1 | #271 Motion/accessibility | Design systems engineer | A07,U01,U02 |
| Q01 | P0 | #272 QA matrix | QA lead + architect | All G0 |
| D01 | P1 | #273 Figma | Product designer | G0 approval |
| I01 | P0 | #274 Implementation | Engineering lead | D01 approval |
| R01 | P0 | #275 Release | QA/projection/operator | I01 |

## Work order and gates
Wave 1 baseline + source review. Wave 2 graph contracts, then parallel session, capture, projection ADRs/spikes. Wave 3 telemetry and UX state contracts, then interaction/motion. QA lead prepares matrix from day one, signs traceability after G0 outputs. No deadlines assumed; size tasks after baseline. G0 design entry: all 11 issues have reviewed deliverables or explicit accepted exclusions; no unresolved P0 architectural decision. G1 user approves editable Figma. G2 tested feature-flag integration. G3 physical acceptance for show use and Pages-only release. Do not advance simply because CI builds.
## Issue hygiene
Existing #100 #175 #188 #226 #241 #247 may overlap; link/reuse proven evidence and avoid duplicate implementation. Every issue has checklist, scope, proposed owner and dependency IDs. Attach ADR/fixture/test/metrics to issue, no close on screenshot alone. Use branch spec/soma-v52-stage-ready for docs and separate feature branches later. No code or deploy at planning stage.
