# F3 Capture V3.1 — Operator Monitor & Motion Polish

Date: 22 November 2026
Branch: feat/f3-capture-v2-fullscreen-stage
Depends on: SOMA_F3_CAPTURE_PRD_V3_INPUT_MOTION_PERFORM.md

## Scope

1. **Perform operator-only Camera A thumbnail.** Adds a small real video preview of the actor beside the Stage View. Preview has its own label and connection/tracking indicator. Its DOM node is outside F3StageView, so native fullscreen/projection still contains only the four photos and live camera B.
2. **Motion checklight.** Motion shows a clear tracked/not-tracked light, with a native Skeleton On/Off checkbox. The skeleton is painted only for a fresh, sufficiently visible pose. Camera A and B remain mounted while steps change.
3. **Near-square archive.** Four photo slots inside the canonical Stage renderer are now 2×2, close to a 1:1 ratio and vertically centered in the left 30% column. Stage aspect stays 1600×800 (2:1), right video stays 68%, gap stays 2%. Saving/loading/capture sources remain unchanged.
4. **Smooth framing and capture fidelity.** Real-time hand-controlled crop uses an eased display ROI on each animation frame. Both the displayed stage frame and the saved photo use that same display ROI, so the operator does not photograph a different crop from the one shown. A new B source starts from its target ROI, rather than easing from the previous source's coordinates.
5. **Small UI motions.** Zoom meter, active tracking light, panel transitions, and selection states use restrained 150–250 ms animation. Reduced-motion preference disables decorative transitions.

## Safety and regression

- No change to the gating of gesture capture: valid arm, verified rehearsal, consent, cooldown, and four-slot limit still required.
- The camera A preview is operator-only and does not add Camera A to Stage View or saved photos.
- Physical projector output remains fail-closed; only local browser fullscreen is covered by E2E.
- Added tests for photo tile geometry, source transition, and crop smoothing; updated Chromium QA for skeleton checkbox and actor monitor.
- Device-specific camera and long-distance gesture tuning still require rehearsal with physical camera A/B.

## QA checklist

- [ ] Stage 1/2 unchanged.
- [ ] Build and typechecking pass.
- [ ] F3 isolated Node and Chromium tests pass.
- [ ] Perform contains visible Camera A thumbnail in operator UI.
- [ ] Fullscreen excludes Camera A thumbnail.
- [ ] Motion has working Skeleton toggle and tracking status.
- [ ] Stage tiles are near-square and retain all 4 positions.
- [ ] Saved ROI matches visually eased Stage View ROI.
- [ ] MP4 A/B remain connected across Input → Motion → Perform → Esc.
- [ ] Pages deploy succeeds on this branch.
