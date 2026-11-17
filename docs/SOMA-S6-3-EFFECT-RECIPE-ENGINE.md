# SOMA S6.3 — Effect Recipe Engine

**Status:** feature branch stacked on S6.2 (Draft PR #31), itself stacked on S6.1.3 (#30). Production unchanged. S6.3 uses the **existing** Footprints camera, FloorSession V3, GaitAnalyzer, A/B identity router, archive compositor, Contact Archive Bridge and two-surface output routes.

## What the engine does

Each existing movement event can change how the uploaded archival clips appear:

| Event | Source | Default action | Output |
| --- | --- | --- | --- |
| Contact | FloorSession V3 `contact` | Reveal | BODY and FLOOR fragments |
| Slide | GaitAnalyzer `slide` rising edge, or simulation `move` | Hold | FLOOR fragment, pause matching archive video |
| Pivot | GaitAnalyzer `pivot` rising edge | Decay | BODY archive fades back to black |

These labels come from **camera estimates**; the software does not measure foot pressure, true physical contact force or 3D floor friction.

The rule UI in **Footprints → Archival Mapping → S6.3 Effect Recipe Engine** lets you set:

- enabled/disabled per event and for the entire engine;
- behavior **Reveal**, **Hold**, or **Decay**;
- target **BODY**, **FLOOR** or **both**;
- target performer **all**, **A**, or **B**;
- fade-in (attack), hold and decay durations, effect intensity, and confidence threshold.

Three starting presets:
1. **Archive Residue**: Contact reveals BODY/FLOOR; Slide holds FLOOR; Pivot fades BODY.
2. **The Disappearing Path**: Contact briefly reveals FLOOR; Slide fades FLOOR; Pivot holds BODY.
3. **Body Exchange**: Contact reveals BODY; Slide reveals FLOOR; Pivot fades BODY/FLOOR.

Video remains in the same local IndexedDB stage session and never uploads to a recipe service. The S6.3 configuration is stored in the existing Stage Session metadata (V1 backward-compatible in-memory migration). Old projects start with recipes **disabled**.

## Rendering and safety behavior

- The recipe engine reads existing `FootstepEvent` objects and current gait motion states without mutating FloorSession events, opening another camera, or running a second body/foot tracker.
- Independent A/B envelope values scale **archive opacity** before the existing BODY compositor. When enabled, recipe-controlled FLOOR gains scale the real frozen archive thumbnails and slide paths in `ContactArchivePadPreview`.
- When a recipe is enabled, Contact Bridge supplies original video fragments even if its previous legacy hold switch is off. Previous Contact Bridge hold and new recipe Hold share one video playback state per performer; no extra media element is created.
- Live pivot/slide triggers are **debounced as movement episodes**, so one planted foot does not fire a new Pivot each display frame. A new episode needs a different intermediate gait label.
- Losing tracking, valid calibration, frame freshness or A/B identity clears gains and video holds; old FloorSession events are **consumed**, never replayed as a catch-up flash. The panel is fail-closed.
- A/B changes, media replacement, switching the source and new sessions reset the renderer/bridge. Projector authority is unchanged: the existing S5.7.4 independent BODY/FLOOR physical output proof and global Blackout remain mandatory.
- Manual **Preview A / Preview B** events work only when the source is **Simulation**. These create no FloorSession event and never count as real camera contacts or optical validation.
- The JSON report exports configuration, event counters, the local file **names**, and safety disclaimer. No video pixels, media binaries, camera captures, SDP/IP addresses or credentials are exported.

## Rehearsal checklist

1. Open S6.3 Preview (HTTPS). Load two actual archive clips via **Archival Mapping**.
2. Choose **Simulation**, play both clips, turn on Effect Recipes, select `Archive Residue`. Verify Contact reveals a BODY mask and pad fragment; Slide holds the correct media; Pivot fades the correct BODY channel. Try the manual simulation cue buttons if you need repeatable tests.
3. Switch to **Live Body** and confirm a fresh calibrated camera frame with stable A/B performer identity. Do not count events generated before the live preview opened.
4. For each performer independently: step and land, slide without lifting, pivot on a planted foot. Confirm counts and gains, then swap A/B positions or cross. Ambiguous identity should yield a black/safe output.
5. Turn the recipe off while playback is running. Previous archive/bridge rendering behavior should return unchanged.
6. Change source, stop the camera and disconnect the phone. Ensure a lost camera or floor calibration blocks any new recipe light/hold; no old event should appear after recovery.
7. Test high/low intensity and attack/hold/decay values. Export the JSON recipe metadata. Reload the app to confirm recipe settings persist in the existing Stage Session.
8. Separate optical rehearsal: verify physical projectors, masked spill, five-point QA and hardware emergency cutoff; a browser snapshot cannot certify those.

## Automated tests

`tests/footprints-effect-recipe-engine.test.ts` tests the following with **synthetic fixtures**:
- strict preset and parameter validation;
- time envelopes and complete decay to black;
- independent A/B Hold and Pivot, with no per-frame retrigger;
- live bridge priming of old events and fail-closed tracking loss;
- simulation-only manual cues and natural event clock rollover;
- backward compatibility with old StageSessionStore metadata;
- no duplicate event generation.

CI also needs `npm test` and `npm run build` to succeed, plus the browser Preview smoke test. None of those automated results verify the physical BODY/FLOOR projection or real-world foot contact accuracy.

## Remaining work beyond S6.3

- More accurate pivot and slide labeling under poor lighting or crossing A/B requires real-device trials.
- Projector latency, floor-mapping accuracy and optical surface spill remain physical S5.6/S5.7 QA items.
- True non-linear effect chains, arbitrary multi-rule conditions, gesture-trained effects, cross-slot media mixing and media library routing belong to a later **S6.4 Interactive Surface Composer**. This version deliberately uses one bounded rule per movement type for predictable stage behavior.
