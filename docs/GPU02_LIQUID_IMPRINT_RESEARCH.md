# SOMA V5 — GPU-02 / Liquid Imprint Research Gate

Status: **QA prototype; not connected to Stage, Composer, or projector**.

## Current pipeline

`FloorInteractionEngine` (read-only) → `collectLiquidImprints`
→ GEO-01B left/right foot masks (Canvas2D, 160×320 per live stamp)
→ a single WebGL2 compositor + original alpha clipped shader
→ dev-only `gpu02-lab.html`.

The prototype uses **native WebGL2** to test material-shader behavior without installing another renderer in production. The V5 full reset plan still prefers **PixiJS v8** for the eventual production compositor. This prototype does **not** pass the Pixi ENGINE-02 integration requirement or authorize publishing any preset.

## Material contract

- Input: one verified contact per foot. Movement/slide/pivot/release adjust an existing stamp and never make a second contact.
- Geometry: heel, narrow arch, ball of foot, **five toes** on independent left/right masks. GEO-01B alters the mask during heel-strike, planted rotation, slide and toe-off.
- Liquid material: time-evolving pigment and advection sampled **within** the original alpha. The shader uses the original mask alpha for its final output; no rings or noise fields outside the foot.
- Separate actors: A/B receive distinct tint; source/actor/foot/origin event ID are part of a unique key.
- Unknown orientation: fall back to neutral screen alignment, and report `orientationUncertain`. No fabricated 3D precision or pressure measurement.
- One WebGL2 context per laboratory instance, one external scene clock, and no internal rendering loop.
- Hard cap: **32** material textures, texture lifetime on aging stamps expires with the timeline, default 9 seconds. GPU textures are explicitly deleted on expiry/destroy.
- The renderer never imports projection authorization or opens a hardware output; old HYDRA/TRACE/ECHO/RIFT effects stay retired.

## How to review locally

```sh
npm ci
npm test
npm run build
npm run dev
```

Open `http://localhost:4173/gpu02-lab.html` for interactive scenarios.

For reproducible Chromium captures:

```sh
npm install --no-save --package-lock=false playwright@1.56.1
npx playwright install chromium
node scripts/geo01b-browser-qa.mjs
node scripts/gpu02-material-browser-qa.mjs
```

Review `artifacts/gpu02/*.png` and `report.json`; test rendering uses synthetic contacts clearly labeled in the lab, never live pose.

## Release blockers

1. Verify Vite/TypeScript, unit tests, and **actual** browser WebGL2 pixel QA in GitHub Actions.
2. Human-review 1/2/6 impacts and independently inspect slide, pivot, release, idle, A/B overlap. Pixel nonblack checks alone do not establish artistic quality.
3. Profile 10-minute live loops, dropped frames, context-loss recovery, projector blackout and laptop GPU consumption.
4. Evaluate PixiJS v8 renderer/mask compatibility and retain one production GPU context. Avoid duplicate compositor contexts and unused dependencies.
5. Review the material before any Composer inspector, catalog option, Stage output, or preset is enabled.

## Deferral

Pressure Residue and Archive Cut remain separate, unimplemented studies. No archive image/video is fabricated inside Liquid Imprint.
