# SOMA — TRK-05 Visual Regression, End-to-End, Release QA

## Scope / release contract

Track remains **one source/control rail on the left and one 16:9 INPUT preview on the right**.
Compose retains **FLOOR, BODY and INPUT**; Map keeps calibration, and Perform keeps
separately gated physical projection. Do not change an output approval or source
router simply to make a screenshot pass.

The GitHub Pages workflow now runs the Node unit suite, TypeScript/Vite build and
Chromium browser tests **before** deployment. Failed browser assertions block the
new Pages publication. Browser screenshots and a report are retained as a GitHub
Actions artifact named `trk05-browser-qa-<commit>` for 30 days.

## Automated visual matrix

Each viewport is captured in fixed Chromium, locale `id-ID`, DPR 1, dark theme,
reduced motion enabled. Each contains **Track empty**, **source dropdown open**,
**MP4 without a selected file**, and **Simulasi 3D**.

| Viewport | Requirement |
|---|---|
| 1920 × 1080 | source ≤ 294px, camera ≤ 960px, 16:9 |
| 1440 × 900 | camera ≤ 960px, no overlap |
| 1366 × 768 | camera ≤ 760px, within viewport |
| 1024 × 768 | sidebar ≤ 294px, camera ≤ 760px |
| 768 × 1024 | source above camera |
| 390 × 844 | one column, no horizontal overflow |

Browser tests measure actual browser rectangles, canvas ratio, preview visibility,
horizontal overflow, dropdown keyboard Escape and focus restoration.

Desktop E2E additionally checks:
- fake-device webcam connection and mounted camera canvas
- webcam → empty MP4 without previous camera frame bleeding through
- uploading a generated WebM fixture, decoded metadata, play and seek
- simulator session and a synthetic footstep; one source control dock
- phone pairing in the sidebar without a second preview
- Compose's three surfaces after switching sources
- Map navigation and return to Track without losing its source panel

The generated video is a deterministic test pattern, **not** evidence of reliable
pose inference or real ankle landmarks. These tests cannot validate physical
WebRTC pairing, actual camera tracking quality, projector calibration or stage
conditions.

## Screenshot visual regression

`scripts/trk05-browser-qa.mjs` stores:
- `artifacts/trk05/*.png`: viewport/state captures, with **no source footage saved**
  beyond the synthetic, fake-camera test frames
- `artifacts/trk05/report.json`: assertions, measured rectangles, baseline state
- `artifacts/trk05/report.md`: human-readable QA report
- `artifacts/trk05/*__diff.png`: failures against approved goldens, when available

Golden reference PNGs belong in `tests/visual-baselines/trk05/`, with filenames
matching the screenshots. Each checked-in baseline activates pixel comparison
(0.5% allowable changed pixels, pixelmatch threshold 0.12, antialias ignored).
**When a reference image does not exist, the image is marked PENDING rather than
PASS**. The website may deploy after layout/E2E assertions pass, but pixel-perfect
approval stays open until approved references are committed and compared.

To approve baselines, download the latest CI artifact, review each screenshot
against the intended stage layout, then copy the approved PNGs into the baseline
directory and commit. Do not blindly approve the first generated output: it
might contain a layout bug.

## Manual UAT still required

| Test | Acceptance evidence |
|---|---|
| Webcam: no access / accepted / revoked | screenshots + observed recovery |
| Two real actors walk, cross and partially occlude | verified A/B persistence, no swapped attribution |
| Ankles, heel, toes partly outside the image | appropriate framing/visibility status |
| MP4 with real footage, repeated seeks and file swaps | correct decoder, stale event reset |
| Phone QR and manual fallback, reconnect | pairing and stable WebRTC track on actual phones |
| Calibration four points and Stage QA | mapping points and safe preview in Map |
| Projector BODY and FLOOR monitors | blackouts, recovery, no unapproved physical output |
| Six viewport screenshot review | no clipping, stuck overlay, layout overlap or overflow |

Release status vocabulary:
- **PASS**: directly observed by the referenced automated test or manual record
- **PENDING**: screenshot reference/manual hardware evidence not yet collected
- **FAIL**: reproducible regression with screenshot and issue reproduction

Do not label the entire release **pixel-perfect PASS** while any approved baseline
or physical UAT evidence remains pending.

## Run locally

```sh
npm ci
npm test
npm run build -- --mode githubpages
npm install --no-save --package-lock=false playwright@1.56.1 pixelmatch@6.0.0 pngjs@7.0.0
npx playwright install --with-deps chromium
node scripts/trk05-browser-qa.mjs
```

Check CI report and screenshot artifacts in the GitHub Pages workflow run.
