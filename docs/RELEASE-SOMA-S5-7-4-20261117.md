# SOMA Footprints S5 — Production software release (2026-11-17)

Release branch: `release/soma-s5-7-4-prod-20261117`  
Source: S5.7.4 feature stack, through Draft PR #21.  
Target: `main` (Vercel Production according to the existing repository deployment notes).

## Release scope

This release consolidates all yet-unmerged SOMA Footprints stages from S5.1 through S5.7.4. It includes:

- FloorSpace and FloorSession V3, 3D puppet/sim lab, camera floor tracking, predicted contact display and adaptive gait.
- Stage calibration QA, regression instrumentation, human physical acceptance recording.
- Stage Optics plan, dynamic lower-body mask, independently selectable black-and-white archival videos A/B.
- Contact-to-Archive Bridge that freezes sampled real video frames on the floor pad preview at actual computed foot events.
- Two separated stage BODY/FLOOR window routes, per-output UV registration and independently documented physical QA controls.

Previous SOMA modes and the existing shared Projection route remain intact.

## Strict release guard

**Production defaults to preview only for new dual-surface hardware.**

`stageHardwareAvailable(import.meta.env.DEV, import.meta.env.VITE_SOMA_STAGE_OUTPUTS)`

- Vite Production build with no explicit opt-in: **FALSE**.
- Video, simulation, foot tracking, calibration planning, QA annotations, and both local canvases stay available.
- Buttons for opening dual projector windows, restricted optical test and Live are disabled by the Production build.
- A separate, explicitly controlled deployment with `VITE_SOMA_STAGE_OUTPUTS=enabled` can allow opening stage windows. Even then, S5.7.4 still requires operator consent, verified live tracking, five manually measured points **per output**, QA reviewer, and both Blackout/safety checklists before Live can run.
- This environment variable is a build-time opt-in. Do not set it on Vercel Production until S5.7.5 physical stage trials and independent safety acceptance have been completed.
- Existing single-output SOMA Projection is unaffected by this new gate.

## What automated CI means

GitHub workflow `Verify SOMA changes` runs `npm ci`, `npm test`, and `npm run build`. A successful result verifies source tests and a compiled Vite application. It does **not** verify Vercel serving the deployment, camera permissions in production, camera-projector registration, real light cutoff on the actor, physical foot contacts, hardware Blackout or measured optical latency.

## Post-merge checklist

1. Verify the merged `main` SHA and GitHub Actions `push: main` test result.
2. Inspect the connected Vercel project Production Deployment, check the source commit SHA and status **Ready**, then open the production URL.
3. Smoke test the landing Studio, camera source switching, pre-existing Projection and Footprints menus in a real browser.
4. In Studio → Footprints → Stage Optics → Archival Mapping, upload locally owned footage, run simulated A/B body masks and contact-to-pad residue. Ensure dark background persists and the UI has no fallback generated images.
5. In Dual-Surface panel confirm *OUTPUT FISIK TERKUNCI DI PRODUCTION* and physical output/window controls cannot be activated.
6. Observe camera/pose failure, black screen, identity ambiguity and clip reset. Never run physical beam tests from Production until a supervised, intentionally enabled release.
7. Keep the production rollback option ready (redeploy prior Vercel deployment and/or revert merge commit) if smoke checks fail.

## Remaining block

S5.7.5 Physical Rehearsal & Visual QA is still required for actual actor/projection registration, light spill, projector-lens throw, blackout under failure and external high-FPS foot-to-light latency. Do not call the stage system performance-certified from a software release.
