# Footprints V2 — incremental release

Implemented: camera/mouse entry actions; active foot layer; time-aware smoothing and shortest-angle heading; deliberate-pause stamps (experimental, no floor/contact claim); six palettes; brush size; retained session timeline separate from fading preview; PNG transparent/solid composition from SVG geometry; editable SVG; versioned JSON validation/import and recoloring; reset view independent of session clear; unsaved-session warning.

Accumulation retains up to 100,000 samples, then displays an export warning; it never silently discards oldest session samples. Session coordinates are camera-normalized and uncalibrated. JSON contains samples and explicit pause-stamp flags, not measured floor contacts. PNG resolution is 1280×720. Imported sessions reopen in Hold; Capture re-renders the imported timeline. Current video playback/download remains available.

Verification: production build PASS; 119 unit tests PASS (4 new Footprints tests). Browser smoke script added at tests/footprints-smoke.cjs, but execution BLOCKED: Chromium socket creation denied by environment. PNG browser decode/alpha and responsive screenshots therefore UNTESTED. Physical camera/projector, codecs and 10-minute session UNTESTED.

Remaining: full event grammar, calibrated contact estimates, One Euro filter tuning, six mature visual styles, time-range composer/replay, density map, IndexedDB, ZIP, projection channel adapter, event-based audio. Current fallback stamps deliberate pauses and must remain labelled experimental.

Rollback baseline: 62585a5ac8c848a46e18556e5d4e4b902427c1c5. Restore via reviewed revert commit or Vercel previous deployment; retain exported JSON before switching versions.
