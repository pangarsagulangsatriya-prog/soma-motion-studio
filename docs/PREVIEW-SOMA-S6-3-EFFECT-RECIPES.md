# SOMA S6.3 — Effect Recipe Engine Preview

**Preview branch:** `preview/soma-s6-3-effect-recipe-engine`. Draft PR #32 (stacked on #31 S6.2 and #30 S6.1.3). GitHub Actions #631 **321 tests passed, 0 failed; TypeScript/Vite build passed**. Production remains unchanged.

## Run in SOMA

1. Open the HTTPS Preview using the correct Vercel access permissions.
2. Footprints → Archival Mapping → upload at least one original local archive video; choose **Simulation** and click **Putar video**.
3. In **S6.3 / MOVEMENT → MEDIA**, enable Recipe Engine, choose **Archive Residue**. Use per-actor **Preview A / B** Contact, Slide and Pivot controls when in simulation.
4. Confirm Contact reveals archival pixels, Slide controls Hold/paused video, Pivot progressively Decays the BODY output. Watch gains and event counters in the S6.3 panel and both BODY/FLOOR preview canvases.
5. Change attack, hold, decay, intensity, target surface, A/B scope, confidence and preset; confirm independent A/B behavior.
6. Check **The Disappearing Path** and **Body Exchange**. Disable recipes to return to the previous archival compositor.
7. Turn on Contact Bridge too and check no two simultaneous playback components fight over video pause/resume.
8. Save the recipe using the existing Stage Session; reload Preview and check the restored options. Old projects should load recipes off by default.
9. Switch to **Live SOMA Body** with real calibrated camera. Test normal Contact, slow Slide, Pivot and performer crossing. Ambiguous identity/old frame/camera disconnect should clear all recipe gains and prevent backlog flashes.
10. Independently verify Dual-Surface physical outputs only with operator, five-point QA, emergency Blackout and optical safety checks. The browser preview does not prove projected photon accuracy.
11. Export S6.3 JSON. It must contain settings/counters/file names only, no raw images/video or camera/network secrets.

## Engineering constraints

Recipe Engine reads **existing** camera FloorSession contact/move events and per-foot GaitAnalyzer slide/pivot labels. It does not build an additional pose engine, save another FloorSession, or create a new projector output. Bounded per-performer envelopes are applied to the original BODY archive compositor and FLOOR frozen-fragment canvas. No output is automatically armed.

**Physical checks pending:** performer A/B identity under crossing, foot contact truth/precision, frame freshness on phones, projector optical timing and actual Blackout. Keep PR #32 Draft until a supervised stage rehearsal has verified the results. No Production merge is part of this task.
