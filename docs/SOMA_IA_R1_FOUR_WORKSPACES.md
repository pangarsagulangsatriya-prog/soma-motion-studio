# SOMA IA-R1 — Track / Compose / Map / Perform

**Design decision — 18 November 2026.** Four workspace destinations. No second navigation row inside Footprints. Repo: `pangarsagulangsatriya-prog/soma-motion-studio`. Main source remains owned by the existing App and Stage.

| Destination | What appears first | Extra controls |
|---|---|---|
| Track | Input, skeleton, A/B, contact preview | Camera setup and Advanced diagnostics |
| Compose | Large stage canvas, 14 scenes, inspector | Collapsed Media, Layers, Hydra, Presets |
| Map | BODY/FLOOR mapping and four-corner calibration | Five-point physical QA in existing surface panel |
| Perform | Monitor, eight cue slots, GO/Hold/Blackout | Recovery, cue editor |

**Only global header:** one SOURCE selector, source status, output lock, Blackout command. Other legacy experiments live under the secondary Tools drawer. Footprints is the default scene inside Compose, not a fifth workspace.

**Navigation contract:** Source selection opens Track for MP4 upload/phone pairing. Track→Compose renders the same FootprintsStageWorkspace and its underlying camera/video source. Compose→Map uses the existing SurfaceComposer Map mode with the same scene and FootMotion event bus. Compose→Perform shows the shared Stage monitor, not a hidden Composer. Exit Perform goes to Compose with an explicit Resume for software preview after blackout/hold. Blackout does not mean physically observed darkness.

**This PR covers IA/UI and routing only.** It does not fix known MP4 inferencing (issue #86) or guarantee correct MP4 BODY composite/Hydra archive processing. Keep physical `VITE_SOMA_STAGE_OUTPUTS=disabled`. Validate real browser Source→Track→Compose→Map→Perform→Compose plus persistent input and re-ID; run npm tests and build. Screenshots and GPU/physical UAT still required before release.
