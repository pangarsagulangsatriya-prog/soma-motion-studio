# SOMA CI/CD — fast GitHub Pages release

## Automatic triggers
- **Push to `main`**: `.github/workflows/pages.yml` exclusively handles building and deploying the public app to GitHub Pages. Unit tests, the universal camera regression gate, and TypeScript/Vite build must pass first. The pinned MAT-03 lab is retained; browser visual regression is decoupled.
- **Pull requests**: `verify.yml` runs unit + TypeScript/Vite build. Selected QA workflows react to relevant source paths only. Sumi V3.4 keeps its focused Playwright QA on PRs that touch Painterly code.
- **Long-running regression / performance**: choose **Actions → workflow → Run workflow** when required. `browser-qa.yml`, `soma-performance-replay.yml`, `floor-scenes-uat.yml`, `trk05-visual-qa.yml` and `soma-checks.yml` are manual.
- **Stale runs**: each new QA workflow uses per-workflow/per-PR-or-ref concurrency cancellation. Pages has its own `soma-pages-preview` concurrency group. Already-queued runs created *before* this policy may require manual cancellation in GitHub Actions; changing YAML cannot retroactively cancel runs without matching concurrency.

## Release gating and rollback
1. PR: `verify.yml`, relevant targeted QA, visual review, manual physical camera/projector QA where needed.
2. Merge to `main` once ready; Pages build automatically runs all unit tests + camera regression + Vite githubpages build, then publishes the artifact.
3. Confirm both `build` and `deploy` jobs succeeded, then verify https://pangarsagulangsatriya-prog.github.io/soma-motion-studio/.
4. If the deployed app fails, revert the offending commit on `main` and confirm a successful Pages deploy. V3.2/V3.3 fallbacks remain available inside SOMA.

GitHub Actions does **not** offer guaranteed runner priority for Pages from these YAML changes. Decoupling heavy suites reduces runner demand; GitHub queue time can still be affected by external capacity, permissions, concurrency, or spending/usage restrictions. No Vercel deployment.
