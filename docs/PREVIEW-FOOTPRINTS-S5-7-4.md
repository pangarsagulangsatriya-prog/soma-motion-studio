# SOMA / UNPACKING — S5.7.4 Dual-Surface Calibration Preview

Stacked above S5.7.3, corresponding to Draft PR #21. Production remains unchanged.

## Open the two projector windows

1. Start SOMA Studio → Footprints → Live Floor Tracking. Complete camera and physical floor calibration; confirm live tracking, including stable A/B identities and visible toes.
2. Open **00 Stage Optics → 02 Archival Video Mapping**, upload actual local footage for A/B and press **Putar video**. Activate **03 Contact-to-Archive Bridge** and inspect the local BODY and PAD previews first.
3. Open **04 Dual-Surface Calibration & Output Routing**. Check the supervised physical light path consent. The control intentionally has no live output in simulation mode.
4. Click **Buka output** on BODY. The previous shared SOMA Projection output is blacked out/closed. Move the new BODY window to the correct projector. It begins in Blackout.
5. Click **Buka output** on FLOOR separately. Move that window to the floor projector. The two windows have different communication session IDs.
6. For each projector separately, adjust four source/projector UV corners, output brightness and resolution. Use **Uji terbatas** with camera/live tracking: BODY shows a dim image restricted to the actual lower-body mask; FLOOR shows one small test cross F1–F5. Do not use an unrestricted white grid on a performer.
7. Physically measure body projection offsets at five independent movement poses, and floor cross offsets at five marked positions. Record ΔX, ΔY in cm, operator name and all three safety checks. Close the QA manually. A software checkbox or zero value is not an independent physical measurement.
8. After both outputs report **within-provisional-target**, activate **LIVE** for BODY and FLOOR separately. Each output is polled independently; loss of fresh camera/identity, closure of the corresponding window, source changes, or stale/outdated approval forces that output black. Existing pad imagery continues to use the Contact Archive Bridge; no separate gait event detector exists.
9. Hit **BLACKOUT KEDUA OUTPUT** for software emergency blank. For an actual optical hazard, **turn off physical projector power**; software output is not a safety-rated shutter.
10. Export both physical QA records to JSON and retain camera video, hardware layout and physical measurement sheets alongside them.

## Scope notes

- BODY uses camera UV → projector UV **2D** registration. Moving 3D legs are not depth-calibrated. This is a real two-window routing implementation but not a physically validated performance-ready solution.
- FLOOR uses its own planar UV mapping, independent of the existing shared Projection config and its original S5.6.3 five-point QA. Recheck its own physical test positions.
- Browser window size and camera calibration are included in the approval fingerprint, and each reopened window requires a fresh QA.
- Automated test/build results verify software behavior; do not substitute them for actual stage measurements.

Full instructions: `docs/FOOTPRINTS-S5-7-4-DUAL-SURFACE-CALIBRATION.md`.

Next sprint: S5.7.5 — Rehearsal & Visual QA.
