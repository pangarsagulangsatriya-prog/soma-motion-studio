# SOMA Footprints S5.6 — End-to-End QA & Simulation Lab

**Status:** implemented on the S5.5 feature base. CI tests/build pass on the feature branch. Not merged into Production.
**Purpose:** deterministic integration regression for existing S5 Footstep Event Engine, 3D Direct Puppet, Floor Artwork, shared Projection path and transport safety. Synthetic software checks only.

## Entry and use

1. Open the S5.6 Preview → **Studio → Footprints → Simulasi 3D · tanpa kamera**.
2. Inside **3D Direct Puppet**, choose **Masuk QA Lab · dua performer**.
3. The same 3D stage now replays two synthetic lower-body performers. The Floor Preview and shared SOMA Projection artwork use the same FloorSession V3 events. You can orbit the view by dragging empty space.
4. Press **Jalankan** and select **1×, 4×, 16× or 64×**. Use the 15-minute timeline or phase buttons to jump to a portion.
5. Enable/disable **Sertakan gangguan** to compare uninterrupted walking with fault recovery.
6. Click a fault time to jump to a tracking, identity, camera or projection interruption.
7. Inspect the **Assertion Report** (PASS/FAIL per invariant). Save **QA JSON** or **Scenario V3**. The latter is explicitly stamped `source:'simulation'`, `positionBasis:'simulated'`.
8. Optional: use the **same Floor → Projection** panel. Align the physical four corners and confirm floor calibration before opening Live. When QA Lab reaches a scripted fault, it may only restrict the selected real transport to **Hold/Blackout**; it cannot override an operator-selected Hold or Blackout to turn on the projector.
9. Exit QA Lab to return to manual 3D Direct Puppet. Changing the floor dimensions or switching modes revokes the running output; do not mistake synthetic positions for actual camera contacts.

## Fifteen-minute score

| Elapsed | Section | Synthetic behavior |
| --- | --- | --- |
| 00:00–03:00 | Labour | Repeated traversals, side-to-side steps |
| 03:00–06:00 | Leisure | Reroutes and different body headings |
| 06:00–09:00 | Active Rest | Alternating slower bends and turns |
| 09:00–12:00 | Crossing | Two bodies occupying shared floor space |
| 12:00–15:00 | Return Pressure | Repeated returns, projection Hold / Blackout |

All trajectories are deterministic mathematical paths to stress the system; none came from a real performer.

### Injected events

| Timestamp | Synthetic disturbance | QA expectation |
| --- | --- | --- |
| 03:40–03:44 | Tracking loss | No new contact in window; later swing rearms |
| 07:06–07:12 | Identity crossing/ambiguity | Contact generation pauses; A/B retain separate IDs |
| 10:09–10:15 | Camera changes | Contact generation pauses; simulated projector transport black |
| 12:14–12:19 | Hold | Contact events continue, output frame is held |
| 13:32–13:38 | Blackout | Contact events continue, physical projection output off |

**Scope note:** the scripted crossing is a deterministic rejection window applied to the shared FootstepEventEngine. Real identity recognition and real camera reacquisition are separately covered by S5.3/S5.4 unit tests, and require live two-performer QA. The synthetic scene alone cannot prove tracking quality.

## Assertion report

`src/footprints/simulator/SimulationQAReport.ts` checks:
- Session V3 format, timestamps, IDs, event provenance.
- Two performers and independent left/right contact streams.
- One contact per gait cycle and in-bounds floor coordinates.
- No contact within invalid camera/identity windows, then continued valid events.
- Floor metres → normalized raster → one shared calibrated homography; disabled artistic mirror/extra registration.
- Transport gate: user confirmation is mandatory; scripted Hold and Blackout never increase actual output privileges.
- Recorded events never contain `prediction` ghosts or claimed physical camera measurements.
- Complete synthetic 900,000 ms run with final events near minute 15.

**Important:** PASS means these software invariants passed against generated event data in the test runner. It does NOT mean real webcam tracking, anatomical biomechanics, projection timing, physical positioning or UI controls were independently tested.

## Implementation files

| Path | Role |
| --- | --- |
| `src/footprints/simulator/QAScenario.ts` | Deterministic 15-minute score, two performers and timed faults |
| `src/footprints/simulator/SimulationQAReport.ts` | Actual assertions over shared event, geometry and projection modules |
| `src/footprints/simulator/SimulationLabPanel.tsx` | Play/pause, speed, time scrub, phase jump, fault jump, status and exports |
| `src/footprints/simulator/PuppetSimulator.tsx` | Reuses 3D rigs, Floor Preview and common projector canvas in QA mode |
| `src/projection/floorBridge.ts` | Effective transport can restrict but never override operator Blackout/Hold |
| `src/projection/useProjection.ts` | Runs scripted Hold/Blackout through existing one-window ProjectionLink |
| `src/App.tsx` | Shared QA transport state and reset on simulator exit |
| `tests/footprints-qa-lab.test.ts` | Regression for complete score, repeatability, faults, recovery, warp, projection and data isolation |

## QA matrix for operator browser testing (not yet executed)

- Preview opens QA Lab with camera **OFF** and no permission prompt.
- At 00:00 / 07:30 / 15:00, 3D view and floor pattern show consistent A/B positions.
- Using 64× reaches end of the 15-minute virtual timeline; Play/Pause/Seek still works.
- During scripted tracking-loss or identity-crossing window, no new contact stamps appear.
- At 12:14, manual Live output moves into Hold; at 13:32 it becomes Blackout; outside fault, the previous operator-selected transport and floor calibration still gate Live.
- With projector manually Blackout, the simulated script cannot turn it Live.
- Report download has `physicalAccuracyCm:null` and `physicalLatencyMs:null`. Synthetic event export contains `source:'simulation'` and unique IDs.
- Exit QA Lab and verify the original manual puppet session remains intact, its foot controls work, and output is Blackout until re-authorized.
- Check responsive layout on 390×844, 768×1024, 1280×720, 1440×900 and real keyboard/pointer interaction.
- Run S5.5 physical validation separately for camera/projector hardware and performer safety.

## Release gates and known limits

Automated CI: `npm test` (Node TypeScript tests) and `npm run build` (TypeScript/Vite).

The suite exercises real software data models and transport policies with synthetic inputs. It does **not** execute an automated Chromium/Playwright browser journey or measure GPU/real webcam/projector performance. Such tests and an actual 15-minute two-performer run should be completed before promoting the S5.0–S5.6 PR chain.

Keep S5.6 as **draft**, stacked above S5.5. No automatic merge to main.
