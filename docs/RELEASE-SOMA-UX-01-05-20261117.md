# SOMA — UX 01–05 Production software release — 2026-11-17

**Release source:** `feat/soma-ux-04-05-progressive-perform-20261117` (stacks UX 01/02 #23, UX03 #24, UX04/05 #25).  
**Release branch:** `release/soma-ux01-05-production-20261117`.  
**Target:** `main`, linked to SOMA Vercel Production deployment.

## Scope

- UX01: Footprints is now the default/main Studio workspace; the four legacy scenes move into the Instruments submenu without deleting their engines.
- UX02: Stage overview with camera, lower-body BODY mask, FloorSession FLOOR pad and task inspector; same original Body camera and contact engines.
- UX03: Unified Stage status for camera, performer A/B, floor calibration and distinct BODY/FLOOR output sessions; consolidated camera, recording, capture, preview Hold/Live, output QA and always-visible Blackout.
- UX04: Inspector divided into Tracking / Visual / Archive / Projection / QA; diagnostics and engineering settings collapsed by default.
- UX05: Perform Mode becomes a minimal **local monitor** with four non-optical cue layouts: Overview, BODY, FLOOR, Split. GO/PREV, Hold/Resume Preview, Rekam and global Blackout are available.

**Important artistic scope limit:** Current Perform BODY output is mask geometry, **not persistent archival video**. Entering Perform disposes the nested media editor and local uploaded footage, sending software Blackout. GO changes monitor layout, not physical projector light or stage content. The physical show cue controller remains a separate future project.

## Production hardware safety

The existing `src/footprints/stage-optics/StageHardwareGate.ts` is UNCHANGED and denies dual surface output in a default Vite Production build. Opening physical outputs requires explicit build-time `VITE_SOMA_STAGE_OUTPUTS=enabled`. **Do not set that variable in Vercel Production until independent S5.7.5 physical safety acceptance**. Even then, S5.7.4 manual per-surface QA, five measurements, approval and frame guards still apply.

The global UI Blackout commands software output, not a safety-rated physical shutter. Never infer projector photons from a green CI check.

## CI

Verify `npm test` and `npm run build` on the exact release commit through GitHub Actions, then merge `main`. Previous UX04/05 feature CI run #490 passed. Compare branch is 43 commits ahead of `main` before release note.

## After merge

1. Confirm `main` merge SHA and GitHub Actions verification on merged commit.
2. Vercel Git integration should deploy `main` to Production. Verify Vercel deployment **READY**, exact Git source SHA and domain. A GitHub successful deployment check is only partial evidence when Vercel account scope is unavailable.
3. Open `https://soma-motion-studio.vercel.app/` in a supported real browser. Confirm initial navigation lands in Footprints, four instruments remain selectable, and the new Stage overview is responsive.
4. Smoke test camera permissions, two-performer identity crossing, body mask fail-to-black, FLOOR contact events with dialog closed, Archive media upload/switch/blackout, production hardware lock.
5. Switch Build ⇄ Perform and cycle Overview/BODY/FLOOR/Split; verify GO changes only operator monitor; hold and record use the original Footprints engine. Verify Blackout keyboard B/Escape and physical power cutoff separately.
6. Check no browser console errors at 1440/1024/768/390 px. Check and monitor Vercel runtime errors. Document any stage camera/optical mismatches.
7. Roll back through Vercel prior Production deployment or revert release merge if critical regression occurs.

**Do not claim full browser or stage validation from the automated tests.**
