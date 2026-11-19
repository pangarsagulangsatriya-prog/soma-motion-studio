# SOMA · TRK-06C / TRK-06D — Tracking Feedback & Browser Release QA

## Scope and output safety

Track retains one left input rail and **one INPUT preview**. Compose retains
**FLOOR, BODY, INPUT**. Nothing in this sprint authorizes a physical output.

- The camera tracker and router remain sources of truth for poses, A/B and 33 landmarks.
- `visiblePoseFeet` requires ankle, heel and toe landmarks in the image with
  confidence ≥0.45. This counts **image visibility**, not contact with the floor.
- The screenshot status never replaces the HIRA/floor tracking or projector QA gates.
- The synthetic camera and automated MP4 clips are QA fixtures, not evidence that
  field footage can reliably resolve occlusion or ground contact.

## TRK-06C — State ownership and safe stabilization

Source rail: device activation, connection error and retry.

INPUT monitor: frame freshness, partial feet, unstable identities, skeleton
overlay and A/B visibility. No repeated camera error overlay.

The 160 ms feedback sampler reads the current `MotionFrame` plus
`MultiPoseGaitRouter.status`. The UI does **not** claim `ready` until
the observed feet remain ready for at least 320 ms; live camera also requires
two distinct source frame timestamps. Video can stabilize while paused
without manufacturing new camera frames.

| Raw observation | UI state | A/B coloring |
|---|---|---|
| No source | idle | none |
| Camera connecting / frame absent | waiting | none |
| Feet partially outside image | framing, N/2 or N/4 | only verified actors |
| Identity association ambiguous/stale | uncertain | neutral |
| Valid feet, stabilization still ongoing | Memeriksa kaki | neutral |
| Ready after stabilization | visible N/N | confirmed A/B colors |
| Frame stale >450 ms or stream ended | waiting; revoke ready | no stale skeleton |
| MP4 / 3D input | local preview only | no physical output authorization |

Status downgrades occur **immediately**, while positive readiness uses the
stabilization delay. On source, connection phase or performer-count changes,
the previous ready state is discarded. The viewer stays readable during
`prefers-reduced-motion` settings.

## TRK-06D — Automation matrix

The GitHub Pages CI executes the existing six browser viewports
1920×1080, 1440×900, 1366×768, 1024×768, 768×1024, 390×844.
Controls are inspected by measured rectangles, not only by DOM presence.

| Scenario | Desktop | Mobile | Acceptance |
|---|---|---|---|
| Empty Track / source selector | ✓ | ✓ | Single source rail and 16:9 input, no overflow |
| MP4 empty | ✓ | ✓ | Play disabled, blank overlay covers stale camera pixels |
| Synthetic 3D footstep | ✓ | ✓ | One source dock, generated contact remains synthetic |
| Webcam active | ✓ | ✓ | Camera and controls visible, button targets ≥34px |
| Skeleton ON/OFF | ✓ | ✓ | aria-pressed and visual state synchronized |
| Stop camera | ✓ | ✓ | No stale ready indicator, return to one source action |
| Start/stop recording | ✓ | ✓ | aria-pressed changes and a WebM/MP4 file downloads |
| Unexpected camera track ended | ✓ | — | Source error, no ready feedback, retry restores camera |
| Webcam → MP4 → 3D → phone | ✓ | Source routes | No duplicate camera input/old frame |
| QR pairing | ✓ | Responsive layout | QR visual checked; real HP UAT pending |
| Compose and Map navigation | ✓ | CSS/layout matrix | Original Compose panes unchanged |

The synthetic disconnect test fires the `ended` event on the fake webcam's
video track, exercising the real CameraTracker error handler and existing
App recovery path. Recording runs on the actual MediaRecorder and canvas
capture path, validating a generated downloaded file, though the images are
synthetic.

### CI gate

The GitHub Pages build job runs:
1. Node unit and regression tests (TRK-06C model included).
2. TypeScript and Vite production build.
3. Chromium browser E2E, layout assertions and screenshots.
4. Upload of screenshots, `report.json`, `report.md` regardless of success.
5. Deployment **only after all preceding gates pass**.

The workflow artifact can be downloaded from GitHub Actions for manual review.
`tests/visual-baselines/trk05` is currently the location for approved
pixel comparison references. When baseline images are missing, comparison
reports **PENDING**, even when layout and E2E pass.

### Manual hardware / artistic UAT remains

- Two performers in view, crossing, partial occlusion, and deliberate identity re-association.
- Real laptop camera disconnect, switch, reconnect and permission denial.
- Physical phone QR/WebRTC pairing and reconnection, including weak Wi-Fi.
- Real projection output, calibration, blackout, frame dropping and recovery.
- Approve reference screenshots before claiming pixel-perfect release.

The browser tests do not prove reliable gait inference on all stage conditions.
