# SOMA FLOOR — 13 Scene Library, Presets & Audio Reactive

**V3.6 / F5–F6 · 18 November 2026**  
**Basis:** `docs/SOMA-FLOOR-PHANTOM-PARITY-V2-IMPLEMENTATION-PLAN.md` catalogue and source interaction rules.  
**Status:** browser implementation in `main`; physical QA, GPU profiling, latency and 30-minute soak test require a supervised stage run.

## One-minute operator path

1. Open existing **Footprints** workspace. Camera/Phone/MP4/3D/Touch Demo remain in the same source selector.
2. On the existing FLOOR pane select **Scene**. All 13 PRD scene names appear. Start with **Snowfall** for contact persistence or **Fireflies** for presence.
3. Tap **Touch Demo** (software preview) or keep the camera streaming. Changing scenes does **not** restart camera, video decoder, pose inference, identity registry, calibration, projector window or the shared FloorInteractionEngine.
4. Open **Preset & Audio** for intensity, radius, persistence, quality (75/150/260 visual particles), saved presets and audio source. **Save preset** stores only local visual parameters. Calibration and projector approval are excluded.
5. Select **Audio SOMA** to reuse the existing SOMA AudioEngine analyser when enabled, or **Mikrofon lokal** to request browser microphone permission. **Off** closes the dedicated microphone tracks. No audio recording/upload or microphone-to-speaker loopback is introduced by these scenes. Audio only changes visual energy; it cannot create a foot-contact event.
6. For physical projection, the same clean FLOOR scene canvas goes into existing Surface Composer. The V3.5 second display, 5-point QA, manual operator consent, BLACKOUT and recovery continue to control light.

## Catalogue and dominant interaction

| PRD scene | Engine family | Main input | Visual behavior |
|---|---|---|---|
| Snowfall | WebGL2 / 2D fallback | Contact | Unique foot impression and gradual snow refilling |
| Christmas | Procedural 2D snow | Contact | Persistent snow impressions, green/warm festive light |
| Hanukkah | Procedural 2D snow | Contact | Persistent blue-night snow with eight silver/blue lights |
| Spring Garden | Procedural growth | Contact / movement | Roots, branching stems and flowers emerge from contact and movement |
| Fall Leaves | Procedural particles | Movement | Drifting leaves displaced by passing performers |
| The Swarm | Procedural particles | Presence / movement | Particles keep space around people |
| Ectoplasmic Fog | Procedural clearing | Presence / movement | Luminous fog clears around bodies |
| Ground Smoke | Procedural advection | Presence / movement | Low smoke curls with local disturbance |
| Cursed Fluid | Procedural displacement | Movement / contact | Dark purple pools and spreading waves |
| Living Water | Procedural ripples | Presence / movement | Animated current and expanding rings |
| Fireworks | Per-step particle burst | Verified contact only | Independent radiant explosion per accepted footstep |
| Pool Splash | Ripples / droplets | Movement / contact | Sprays and concentric surface rings |
| Fireflies | Procedural swarm attraction | Presence / movement | Luminous points gather and spread around people |

**Limit:** the current F0 bus has no separately validated `jump` event. Pool Splash reacts to movement/contact only; jumping cannot be claimed as a recognized biomechanical class. Snowfall uses WebGL2 when available; the other 12 are browser procedural Canvas 2D implementations. This sprint does not claim 13 GPU shaders.

## Architecture and safety

- `src/footprints/scenes/sceneRegistry.ts` maps the exact 13 PRD names to families, trigger semantics and local preset validation.
- `ProceduralSceneRuntime.ts` implements the twelve other scene behaviors with shared particles, swarms, ripple/clearing fields, winter heightfield and timed contact pulses. It reads F0 `FloorInteractionEvent` and the generation number; it never creates contact from movement or audio.
- `SnowfallScene.ts` / `SnowfallRenderer.ts` remain the original persistent WebGL2 Snowfall implementation and keep the six-step event gate.
- `FloorAudioReactive.ts` reuses `engine.analyser` for existing SOMA audio, or on a deliberate user interaction opens a local `getUserMedia` audio stream solely for amplitude analysis. Stop tracks and close AudioContext on Off/unmount/error.
- `FootprintsStageWorkspace.tsx` keeps INPUT, BODY, FLOOR, tracking and projector in one persistent layout. Additional scene canvas is never restarted on parameter change; changing scene reinitializes visual state and skips old F0 events. The input bus generation stays unchanged.
- `SurfaceComposer.tsx` continues to use `cleanFloorOutput.current` as an existing clean canvas source. The diagnostic event rings, stage text and skeleton are in separate preview canvases.
- `FloorSceneAdvancedControls.tsx` holds the compact audio/preset UI on the same FLOOR toolbar. Named presets save visual parameters only; no physical-output permission or media.

## Automated acceptance targets

| Test | Required result |
|---|---|
| UAT 13-scene catalogue | Exact 13 scene names present and each paints a nonempty visual canvas |
| Switch while tracking | Source selection, camera/video playback and F0 bus do not reset |
| Touch / movement / contact | Each scene receives same events, with true trigger semantics |
| Still performer | No extra contact from presence heartbeat |
| Six footsteps | Snowfall retains six unique stamps; Fireworks emits one burst per validated contact |
| Two performers | Separate A/B source IDs preserved; uncertain crossing cannot stamp |
| Reset / seek | No replay of consumed events in new visual state |
| Presets | Save, load and persist over browser reload; invalid inputs safely rejected |
| Audio Off | No mic request; visual still responds to motion |
| SOMA audio | Reuses existing analyser without opening a second synth engine |
| Microphone | Permission opt-in, amplitude visible, track stops on Off/unmount |
| Projector | Clean output only; hardware authorization still locked behind physical QA |
| Quality | Particle cap bounded at 75 / 150 / 260; no unlimited growth |
| 30-minute soak | Actual FPS, GPU/CPU and memory measured with two real performers |

**Current evidence:** `tests/floor-scene-library-f5-f6.test.ts`, `e2e/floor-scene-library-f5-f6.spec.mjs` and existing F0/F1/V3.5 safety suites. All physical staging checks, audio permission behavior on target operating systems, and 30-minute benchmark must be independently performed and logged.

## Planned improvements after acceptance

1. GPU/WebGL2 versions for high-load particle/flow scenes and measurable adaptive quality.
2. Explicit jump/slide/pivot trigger only after separate model validation with labelled performer footage.
3. Scene transitions/cross-fades, saved show cues, physical projectors on multiple displays.
4. Real rehearsal measurements for UAT-05..11 and UAT-18; no unsupported "complete parity" claim until gates pass.
