# SOMA — QA-R1 End-to-End UAT & Release Evidence

**Status: Pending manual UAT.** Passing CI proves automated contracts and TypeScript/build. It does not prove usable projection, measured contact accuracy with a real camera, physical blackout, or a stable 30 FPS. Keep PRs draft and the physical output locked until an operator completes the checklists and evidence.

## Scope and rig

One source manager and one tracking session across **Compose → Map → Perform**, plus 14 existing FLOOR scene IDs, 8 operator cue slots, two performers crossing, BODY A/B and FLOOR, Hydra failure/fallback, MP4, 3D simulator, and real webcam/phone.

Record the actual test date, browser/version, operating system, camera, GPU, driver, projector, screen resolution and physical stage dimensions. Label each report with the **exact Git commit**. Switching equipment, optical geometry, camera, browser, or commit requires rechecking affected evidence. Do not infer results from CI.

## Automated gate

1. Check out the QA-R1 branch with all predecessors included, `npm ci`, `npm test`, `npm run build`.
2. `tests/qa-r1-end-to-end-release.test.ts` checks six accepted contacts, zero duplicate contact IDs, stationary 10 seconds yielding zero contact marks, two-actor A/B separation, source session resets, 14 scene ingestion, and the hardware QA fail-closed case. Existing tests cover calibration, preset schema, motion recipes, operator controls and renderer guards.
3. Record CI run URL, commit hash, test log and build log in the **automated** item of the evidence JSON. A successful build does not complete other checks.

## Browser & stage acceptance matrix

| ID | Actions on real system | Evidence needed and pass criteria |
| --- | --- | --- |
| browser-chrome | HTTPS Chrome: open workspace, select webcam, Compose → Map → Perform → Compose | Screen recording, console log, no duplicate camera/tracker lifecycle |
| browser-safari | Repeat in Safari/WebKit; camera and WebGL permissions | Screen recording, console log; graceful no-WebGL fallback |
| mp4-replay | Use rehearsal MP4 with two actors moving/crossing; repeat 3 times | Recording + event trace; no unverified physical claim |
| simulator-replay | Load 3D direct puppet, move six contacts, reset and repeat | Trace shows six distinct IDs; no synthetic evidence mistaken for physical |
| live-camera | Real overhead camera, actor walking, 10 s stationary | Recorded input/output and event counter; six steps yield six verified detector contacts under test conditions and idle zero extra |
| dual-actor-crossing | Two real actors cross and occlude repeatedly | Video + A/B IDs; ambiguous frames are held rather than silently swapped |
| fourteen-scenes | Cycle 14 scenes on same source and return to Footprints | 14 labeled preview captures/recording; distinct visuals, no stale footprints after switch |
| source-switch | webcam → MP4 → simulator → webcam with Compose/Map/Perform open | No source duplication or stale event IDs, no unexpected hardware LIVE |
| profile-restore | Save cue/preset/profile, refresh, restore, change a quad and check QA | Data-only settings restored; physical QA invalidated, no auto-arm |
| keyboard-a11y | Navigate all workspaces with keyboard, trigger Hold, GO, B/Esc; screen reader labels | Focus order, blackout shortcut, visible focus, no shortcuts when editing a field |
| responsive | 390px, 768px, ≥1280px; Compose gallery, Map four corners and Perform grid | Screenshots without clipping, reachability of blackout |
| gpu-fallback | Enable Hydra, cycle effects, simulate context loss, use Canvas fallback | Recording and console, preview recovers, physical output stays original |
| fresh-setup | Fresh profile: camera/source selection through operator-ready preview | Timed video. **Under 600 seconds** |
| repeat-setup | Reload saved settings, verify camera/source and preview | Timed video. **At most 120 seconds** |
| performance | Record at least 5 min of preview FPS, p10 and long-session GPU memory delta | Export logs. **p10 ≥30 FPS**; GPU memory delta observed, inspect for unbounded growth |
| body-five-point | Measure five BODY points B1–B5 under supervised optics | Signed Map QA report with cm deviations, stage and device binding; within provisional thresholds |
| floor-five-point | Measure five FLOOR points F1–F5 under supervised optics | Signed Map QA report with cm deviations; within provisional thresholds |
| blackout-observed | With both projectors physically running, issue blackout from Perform and Map, inspect screen | Operator statement and footage confirming actual emitted light goes dark; UI status alone insufficient |
| light-spill-observed | Observe BYSTANDER area, audience tiers, physical BODY/FLOOR light spill | Signed operator notes and photo/footage; no unsafe light spill |

**Hardware gate:** BODY uses RMSE ≤12 cm and P95 ≤20 cm; FLOOR uses RMSE ≤8 cm and P95 ≤15 cm, following existing provisional calibration thresholds. Five points per surface, matching equipment signature, reviewer signature, fixed optics, real blackout observation and no unsafe spill are still required. These are project-specific provisional thresholds, not a substitute for on-site safety judgment.

## Evidence record, fail-closed release check

Use a commit hash from the build intended for release:

```sh
npm run qa:release -- init qa-evidence.json <exact-commit-sha>
# Edit each item's status only after the test is actually performed.
# Each manual PASS requires operator, recordedAt, device, artifact path/URL.
# Every physical PASS also requires notes. Populate measured timings & FPS.
npm run qa:release -- check qa-evidence.json <exact-commit-sha>
```

The check exits nonzero when any evidence is missing, blocked, failed, unsigned, bound to another commit, or when required setup/FPS metrics were not measured or missed. Do not upload a template with all statuses set to PASS. Keep raw recordings, diagnostic logs, 14 labeled captures, two signed physical QA reports, and emergency blackout evidence with the release ticket/PR. Do not commit personal footage or ID records to a public repository.

## Signoff and decision

- **Automated PASS:** eligible for operator-led UAT only.
- **Manual/browser PASS:** eligible for supervised hardware UAT only.
- **Physical QA PASS + timing/FPS measured + matching commit:** release candidate may be evaluated for production merge. Check hardware configuration, rollback, and operator availability.
- **FAIL / pending / stale commit:** **NO-GO**. Do not merge the feature chain or enable production hardware. Re-run the affected test after fixes.
- Rollback: issue global blackout, disable physical output, use last verified `main` commit, and restore software-only preview. If the light persists, physically cut projector output.

## PR dependency chain

#75 UX-R1 → #76 UX-R2 → #77 UX-R3 → #78 VIS-R1 → #79 VIS-R2 → #80 VIS-R3 → #81 VIS-R4 → #82 MAP-R1 → #83 OPS-R1 → QA-R1.

Do not assert end-to-end browser success or stage readiness from Node tests alone. PR approval, operator UAT, and release authorization are separate decisions.
