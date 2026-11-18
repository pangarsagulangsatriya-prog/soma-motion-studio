# SOMA IA-R1 — Track / Compose / Map / Perform

**Design update — 18 November 2026.** One global module **Stage 1** in SOMA sidebar. Track, Compose, Map, and Perform belong only to Stage 1 and appear as its local navigation strip. Other future SOMA modules own their own workspaces. No duplicate Footprints/Projector navigation. Repo: `pangarsagulangsatriya-prog/soma-motion-studio`. Main source remains owned by the existing App and Stage.

| Destination | What appears first | Extra controls |
|---|---|---|
| Track | Input, skeleton, A/B, contact preview | Camera setup and Advanced diagnostics |
| Compose | Large stage canvas, 14 scenes, inspector | Collapsed Media, Layers, Hydra, Presets |
| Map | BODY/FLOOR mapping and four-corner calibration | Five-point physical QA in existing surface panel |
| Perform | Monitor, eight cue slots, GO/Hold/Blackout | Recovery, cue editor |

**Scope:** the SOMA global sidebar lists modules, currently only **Stage 1**. A local nav inside Stage 1 displays Track → Compose → Map → Perform. The Stage 1 header owns SOURCE, tracking, output status and Blackout. Other modules must not inherit these controls by default. Legacy experiments live under secondary Tools (utility, not a module). Footprints stays a Compose scene.

**Navigation contract:** Source selection opens Track for MP4 upload/phone pairing. Track→Compose renders the same FootprintsStageWorkspace and its underlying camera/video source. Compose→Map uses the existing SurfaceComposer Map mode with the same scene and FootMotion event bus. Compose→Perform shows the shared Stage monitor, not a hidden Composer. Exit Perform goes to Compose with an explicit Resume for software preview after blackout/hold. Blackout does not mean physically observed darkness.

**This PR covers IA/UI and routing only.** It does not fix known MP4 inferencing (issue #86) or guarantee correct MP4 BODY composite/Hydra archive processing. Keep physical `VITE_SOMA_STAGE_OUTPUTS=disabled`. Validate real browser Source→Track→Compose→Map→Perform→Compose plus persistent input and re-ID; run npm tests and build. Screenshots and GPU/physical UAT still required before release.

**Module isolation contract:** the global module selector never lists Track/Compose/Map/Perform independently. Each future module registers its own local navigation and session owner. Stage 1 alone owns stage camera/MP4/3D, actor A/B, canonical foot events, mapping calibration, scene renderer, and cue grid. Stage state remains mounted across its four subviews; switching to another module uses explicit boundary/safety handling rather than reusing Stage navigation items.
