# SOMA Footprints — S5.6.2 Adaptive Gait & Contact Engine

**Branch:** `feat/footprints-s5-6-2-adaptive-gait-20261116` stacked on S5.6.1. Keep in draft; Production untouched.

## What actually changed

The existing **one-camera MediaPipe / SOMA Body** pipeline stays unchanged. No additional pose model, camera stream, tracker, stage calibration or new projector window has been added.

- `src/footprints/gait-analysis/index.ts` — upgraded `GaitAnalyzer` to track per-foot stance anchors, image-space and hip-relative foot motion, recent contact headings, adaptive hip-span scale and slow baseline drift.
- The algorithm distinguishes the artistic hypotheses `hold`, `step`, `pivot` and `slide`. These are **heuristic labels**, not measurements of friction, force, or ground-contact truth.
- **Slow step with visible low lift:** a small rise relative to the prior stance and a small upward image displacement can trigger swing even if the speed is below the old fast-walk threshold. The new contact still requires a stable low foot for the existing **110 ms** onset debounce and a **320 ms** contact cooldown.
- **Pivot:** substantial foot angle change around approximately the same foot center stays in stance and never adds another sole stamp.
- **Slide:** persistent foot position change close to its previous ground height stays in stance. Its accumulation can now become a calibrated `move` FloorSession V3 event after the 0.12-metre movement threshold, with contact count unchanged.
- **Hip movement:** a performer shifting, bending, or lowering their pelvis above a visually still foot should not automatically create a swing/contact. Comparing heel/toe image displacement against relative hip movement reduces this false positive.
- **Loss and low visibility:** per-foot state is still reset after poor landmarks or a large frame gap; the existing S5.3 rearm protection prevents unknown reacquisition from stamping an unobserved second contact.
- The `LiveFloorTrackingEngine.status.footMotions` list exposes the current hypothesis by performer and left/right foot. The Live Floor UI shows it near the floor preview in a compact state row for observation during rehearsal.
- When **Live Floor** is active, the calibrated contact pipeline always receives gait samples even if the user disabled gait analysis in the older illustrative V2 Footprints mode.
- The exported physical FloorSession schema remains **V3**. The optional `motionKind` appears on individual GaitSample records in illustrative tracking, while calibrated `contact` and `move` retain their established event kinds and provenance.

## Technical boundaries

1. The single RGB camera cannot directly establish heel pressure, plantar contact, friction, body weight, or whether the shoe truly touched the stage.
2. A shoe being dragged rapidly along the floor may look like a low swing; a very low airborne stride can look like a slide. Camera perspective, shadows and partial occlusion can change the result.
3. `motionKind` is live diagnostic metadata, NOT independently ground-truthed. The algorithm is deterministic and configurable through code, not a machine-learning model trained on labeled performer-specific data.
4. Tracking across performer crossings remains protected by the separate conservative A/B identity gate; S5.6.2 does not solve persistent person re-identification.
5. No numerical improvement in false contacts, missed contacts, response latency or floor centimetre accuracy is claimed without matching physical recordings.

## Browser rehearsal checklist

| Movement | Expected app response | Observer checks |
| --- | --- | --- |
| Stand still 5–10 seconds | `Hold`, exactly one initial contact | No repeated sole stamps |
| Bend at hips with planted shoes | Stay stance / Hold | No false foot contact when pelvis moves |
| Translate torso above planted foot | No unnecessary swing | Observe camera landmark stability |
| Slowly lift a single foot 2–4 cm in reality | `Step`/swing may appear, then one contact on lowering | Capture missed low lifts from camera viewpoint |
| Pivot on a planted left shoe | `Pivot`, no additional contact stamp | Is the heel actually stationary? |
| Drag one shoe slowly 20–50 cm | `Slide`, calibrated `move` may appear | Difference between drag and small airborne step |
| Step quickly then stop | `Step` then `Hold` | No second contact while stationary |
| Hide one heel or toe | Suppressed/unknown; later rearm on swing | No ghosts/contacts on bad visibility |
| Two performers walk/cross | Each foot has its own label, A/B gate persists | Misassigned A/B and resets |
| Camera changes or projector Blackout | No uncalibrated output | Output must remain dark |

### How to measure reliability

1. Open S5.6.2 Preview → Studio → Footprints → **Live Floor Tracking · Kamera**; calibrate four camera corners and four projector corners separately.
2. Record each movement from a side angle with an external camera while also recording the SOMA preview, then **manually label actual lifts, contact points and slides**.
3. Compare labeled contacts with the exported FloorSession V3. Report **precision, recall, false stamps/minute and missed contacts/minute** separately per category and per performer.
4. Use the existing **S5.5 Physical Validation** panel to pair true landing coordinates against camera-inferred points and measure error in centimetres.
5. Measure physical touchdown-to-projected-light delay with one external high-FPS shot covering both the foot and illuminated footprint; S5.6.1 browser timing diagnostics must remain separate.
6. Repeat the same score on S5.6.1 and S5.6.2 under the same fixed camera, lens, lighting and stage positions. The new synthetic tests are a regression safety net, NOT a substitute for this comparison.

## Tests

`tests/footprints-adaptive-gait.test.ts` now checks:
- only one onset per stable stance;
- no false second imprint during foot pivots;
- no false swing from hip bending/translation over a planted foot;
- slow slides remain stance and do not stamp duplicate contact;
- subtle foot lift can still lead to one new stable touchdown;
- loss of foot visibility and 500-ms tracking gaps reset/rearm;
- cumulative measured-floor slide sends a `move` event, leaves contact count unchanged, and preserves unique V3 events.

Previous S5.0–S5.6.1 tests, including two-performer routing, calibration, floor rendering, blackout and data export, remain in CI.

**Release gate:** pass automated tests/build, run manual browser camera test, obtain a short annotated physical-gait dataset, quantify contact errors and stage latency, then compare against S5.6.1. Leave PR draft until these tests pass.

**Recommended next engineering task:** S5.6.3 — Camera–Projector Calibration QA, followed by physical stage validation.
