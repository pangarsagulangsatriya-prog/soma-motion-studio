# SOMA S6.7.2.5 — Responsive & End-to-End QA Protocol

**Scope:** Browser Footprints → tracking → Visual/Archive → Projector. Protect existing engine and software Blackout gates. Evidence belongs in the GitHub Actions Browser QA run; manual checks below require real hardware.

## A. Automated browser checks
- Viewports: 1440 × 900, 1366 × 768, 1024 × 768, and 390 × 844.
- With no input, Source offers Webcam, Kamera HP, MP4, Simulasi 3D; no empty BODY/FLOOR previews.
- No horizontal scroll, inaccessible primary controls or obscured Blackout button.
- Source → Tracking → Visual & Archive → Projector → Footprints navigation preserves context.
- Tracking Inspector: open, ArrowDown to controls, Escape returns focus, tab reselect closes.
- SOMA Labs: drawer search, Escape, focus restoration; legacy functions stay discoverable.
- Denied camera permission: actionable error and alternate source; no output window opens.
- Projector navigation and software Blackout commands do not create automatic physical output windows.
- Screenshots, HTML report, and traces attached to workflow. Outcome mirrored on `qa-results` branch.

## B. Physical stage test sheet (manual; do not mark PASS from CI)
| ID | Input / action | Expected observable result | Gate |
|---|---|---|---|
| H01 | Fresh load on 1366×768 laptop | Source selections visible, Blackout always reachable | Blocker |
| H02 | Webcam Body permission granted | Camera frames visible; readiness checks separate from connection | Blocker |
| H03 | Deny / revoke webcam permission | Explicit recovery, choose another source | Blocker |
| H04 | Pair and disconnect phone camera over supported secure connection | Session changes and disconnect handled; tracking recovers safely | Blocker |
| H05 | Load 1- and 2-person MP4, seek/reset | Deterministic pose/gait events; no stale identity carried into next recording | Blocker |
| H06 | 3D puppet feet walk, slide, pivot | Floor coordinates and contact events match intended movement | Major |
| H07 | One performer enters/exits frame | A visibility/identity and output gating update accurately | Blocker |
| H08 | Two performers cross; A/B partially occlude | Ambiguous identity visibly flagged; unsafe mapping does not continue as valid | Blocker |
| H09 | Confirm four floor corners, move camera, recheck | Calibration invalidates or requires confirmation after changed binding | Blocker |
| H10 | Open BODY and FLOOR projection outputs deliberately | Separate canvases/screens, correct destination and aspect ratio | Blocker |
| H11 | Test Hold and Blackout on both software windows | Commands reach windows; stage projector optical response checked by operator | Blocker |
| H12 | Shift+Escape from Guided Setup, Inspector, Labs | Software Blackout command still works; overlays do not swallow safety shortcut | Blocker |
| H13 | Disconnect camera during Live | Stale frames/identities never labeled current; projector status is truthful | Blocker |
| H14 | Rehearsal: 30 minutes with two bodies and real projector | No sustained drift, unhandled disconnect, or unintended window/brightness change | Major |
| H15 | MacBook/HP at 390–1024 CSS px, touch and keyboard | Scroll, focus, labels, hover alternatives, and close controls remain usable | Major |

### Recording evidence
For each row record **Date/Time, tester, laptop/OS/browser, camera source, projector model, viewport, actual result (PASS/FAIL/BLOCKED), screenshot/video, and defect link**. A photo of the projected surface is needed for BODY/FLOOR optical QA.

### Release gate
Any unresolved Blocker prevents declaring the physical performance system ready. Chromium CI tests validate browser behavior only. **Blackout software is a command, not an electrical or optical safety certification**; use a real hardware cut-off for emergencies.

### Current limitations
Automated tests run with browser stubs and synthetic camera error paths; they cannot validate actual camera latency, Wi-Fi pairing reliability, movement recognition accuracy, alignment of optical projection, or physical power cutoff.
