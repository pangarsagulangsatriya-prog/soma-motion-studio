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

## ENGINE-02 PixiJS v8 compositor — integration status (20 November 2026)

The prototype now has an **optional, genuine PixiJS v8.23.0 WebGL2 compositor**.
The installed and locked package is `pixi.js@8.23.0`, with a committed
`package-lock.json` (the one-shot bootstrap workflow has been retired).

- `src/footprints/materials/PixiLiquidImprintCompositor.ts`: one `Application`
  initialized asynchronously, one WebGL renderer, no internally running
  ticker; the stage's external clock drives `app.render()`.
- Each contact gets a dynamic `CanvasSource` / `Texture` / `Sprite`
  made from GEO-01B's anatomically formed Canvas2D alpha mask.
- A PixiJS `Filter.from({ gl: { vertex, fragment }, resources })`
  renders the same liquid advection contract, per-stamp orientation,
  slide/twist/release and alpha clipping.
- Texture, sprite and filter resources are explicitly disposed on
  expiration and engine destruction; default maximum 32 active masks.
- Runtime selection occurs **before** renderer construction in
  `gpu02Lab.ts`. Native WebGL2 and PixiJS do **not** run concurrently.
- Track, Compose, Map, Perform, camera inputs and physical projector
  transport have no imports of this research compositor.

For local reproduction:

```sh
npm ci
npm test
npm run build
npm run dev
# Open /gpu02-lab.html?engine=pixi
# Compare with /gpu02-lab.html (reference)
```

Browser screenshot QA:

```sh
node scripts/gpu02-material-browser-qa.mjs
GPU02_RENDERER=pixi node scripts/gpu02-material-browser-qa.mjs
```

The same tests cover 1/2/6 events, slide, pivot, release, idle, crossing,
600 ms pigment variation, a stable sole-alpha silhouette, and an accelerated
10-minute synthetic timeline. Context instrumentation intercepts Chromium
`HTMLCanvasElement.getContext` and checks the actual stage canvas.
This test **does not** prove a production 30-FPS rate or projector readiness.

**Gate to ship:** visual operator review, target-laptop 10-minute real-time
profiling, actual MP4 A/B crossing, recovery after WebGL context loss, stage
profile calibration, Hold/Blackout and pixel-safe output integration.
Keep the PR in draft and leave Composer without a new visual preset until
those gates pass.
 
## MAT-03 — One Liquid Imprint study, four gait-specific responses

**Implementation gate:** COMPLETE in the isolated research lab; artistic and stage-projection approval remain pending.

All four states use the **same verified contact**, **same** left/right anatomical sole, and the same PixiJS v8 filter family. The state machine lives in `liquidMaterialResponse.ts`; the single shared shader lives in `liquidMaterialShader.ts` and is imported by both the Pixi compositor and the native WebGL2 comparator.

| Source event | Liquid behavior | Material control |
|---|---|---|
| Contact | Pigment fills from heel toward toes, with a visibly moving wet boundary | `contactFill` in the first 320ms |
| Slide | Long ink filaments align with the estimated sliding vector | `slideX`, `slideY`, `slideStrength` |
| Pivot | In-foot spiral veins twist around a planted forefoot | `pivotTwist`, `pivotStrength` |
| Release | Pigment thins immediately and drains into a bounded fading sole residue; the release timestamp survives toe-off settling | `releasedAtMs`, `releaseProgress` |

There is a fifth internal *settle* state for an older planted print, not another material or a catalogue option. CONTACT never repeats solely because a foot remains still. SLIDE/PIVOT/RELEASE only update an existing verified contact.

### Visual QA that isolates the shader

The standalone lab `gpu02-lab.html?engine=pixi` now has a second group of four buttons: **Contact · isi**, **Slide · tarik**, **Pivot · pilin**, **Release · sisa**. All four freeze the **same GEO-01B sole geometry**, actor, foot, heading, position, and elapsed contact time while varying only motion signals and liquid material. This *material-only* mode is QA-only; natural gait deformation remains active in other scenarios.

Script `scripts/gpu02-material-browser-qa.mjs` now captures four extra Chromium PNGs per renderer (`mat-contact-chromium.png`, etc.) and tests all **six** pairwise combinations with strict pixel thresholds and at least 90% silhouette overlap.

**Verified CI:** https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/actions/runs/44685972905  
788 unit tests passed, zero failed; Vite/TypeScript build and both native + PixiJS Chromium pixel suites passed.

PixiJS material-only comparison: lowest pairwise pigment change ratio **86.8%**, with same-sole-area ratio **99.6–100%**. Each scenario contains one verified contact and one GPU footprint; the shared mask does not leak pigment outside the anatomy.

### Remaining production gates

Real MP4 A/B performer footage, target 30 FPS performance for 10 minutes of wall-clock time, WebGL context-loss recovery, calibration on the actual 5×5 m floor, physical blackout, and operator artistic sign-off still block Stage/Composer activation. `MATERIAL-04` pressure/archive studies remain unimplemented. Keep PR draft; no legacy visual gallery returns.
