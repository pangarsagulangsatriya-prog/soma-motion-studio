# UX-06 — SOMA Stage 1 End-to-End Release Checklist
Date: 2026-11-19
Status: PENDING — no successful E2E, build, physical or deployment evidence attached

## Important constraints
- Source code changes in GitHub do not prove Pages deployed, and passing unit tests do not prove projector safety.
- Never reopen optical output solely from restored scene/cue/preset. Explicit Map QA must authorize physical output.
- Do not mark a case PASS without environment, steps, expected/actual, date, operator and evidence URL.
- For rehearsal without physical hardware mark BODY/FLOOR five-point checks BLOCKED, not PASS.

## Test matrix (all initially PENDING)
| ID | Setup / action | Expected outcome | Status |
| --- | --- | --- | --- |
| T01 | Webcam, 2 actors, Track → Compose → Map → Perform | Motion changes selected scene; calibration matches floor; GO updates software preview only | PENDING |
| T02 | MP4 two-actor crossing, seek, change scene | Identity uncertainty visible, no historical foot events after seek, hardware locked | PENDING |
| T03 | 3D puppet, contact and idle | New contact creates visual once, idle generates no duplicate contact, hardware locked | PENDING |
| T04 | Phone pairing, disconnect, reconnect | Honest source health; reconnect without stale contacts or unexpected output | PENDING |
| T05 | Switch source while composing and return | Preset/scene preserved, stale frames cleared, input status refreshed | PENDING |
| T06 | Camera/tracking lost mid-session | Visible warning, unsafe physical output blackout, deliberate recovery | PENDING |
| T07 | Projector popup/HDMI disconnected mid-Perform | Safe blackout and explicit re-QA before new LIVE | PENDING |
| T08 | Execute/edit eight Perform cue slots via UI and shortcut | One cue owner per scene/layout; Previous/Next/Hold/Resume/Blackout remain reachable | PENDING |
| T09 | Save and restore cue/scene/stage profile | Artistic state restored; no previous physical authorization reused | PENDING |
| T10 | Keyboard, 390px mobile, 1366px desktop | Primary action reached, focus visible, no duplicate nav, emergency blackout always accessible | PENDING |

## Automated command gate
1. `npm ci` (Node 22+)
2. `npm test` — attach log
3. `npm run build` — attach log and build hash
4. `npm run qa:release -- init qa/release-<commit>.json <commit>`
5. Enter individually signed results only after hands-on measurement.
6. `npm run qa:release -- check qa/release-<commit>.json <commit>` — must exit successfully for release eligibility.

## Measurement
- First session setup: <600 seconds, observed operator/device.
- Returning setup: <=120 seconds, observed profile/device.
- Preview P10: >=30 FPS, sustained measured sequence.
- GPU memory growth: recorded, never fabricated.
- BODY and FLOOR separate five-point test: performed with actual projector hardware, including light spill, blackout and recovery.
- Track connection failures, HDMI disconnect and software blackouts independently.

## Deployment verification
- Confirm exact latest `main` SHA in GitHub repository.
- Inspect Actions build/deploy event for that SHA (not only PR-triggered workflows).
- Open https://pangarsagulangsatriya-prog.github.io/soma-motion-studio/ in an uncached browser and verify current bundle.
- Execute smoke sequence on deployed build; record timestamp, browser, screenshot and version.
- Capture rollback commit/asset references.
- Keep UX-05 and UX-06 open while any P0/P1 bug or unsatisfied gate remains.

## Current implementation references
- [UX-05](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/96)
- [UX-06](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/97)
- [PRD](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/blob/main/docs/SOMA_UX_UI_E2E_RECOVERY_PRD_V1.md)
