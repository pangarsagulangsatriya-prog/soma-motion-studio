# Perform → TouchDesigner, 20 November 2026

The third Perform output route sends JSON through one operator-owned loopback WebSocket. Pairing establishes the connection; starting the stream is a separate action. The downloadable Python starter creates a local Web Server DAT, protocol callbacks, channels, a test circle preview, and an independently armed output gate. Existing SOMA Direct and Resolume routes retain their output path.

## Contract and lifecycle

- `soma.td-bridge`, version 1. Every packet has connectionId, sessionId, generation, seq and monotonic sender atMs. Heartbeat replies echo ackSeq.
- `hello` includes ephemeral receiver token and origin. Receiver permits only the listed SOMA origins and one paired client. The server binds to 127.0.0.1, max 16 KiB packet, never executes packet content.
- `state`: at most 20 Hz; actors A/B or original source identity, per-foot x/y/confidence/heading/status. Coordinates are explicitly per-foot: floor-uv, image-uv or simulated-floor-uv. Pose ankle samples are continuous; presence/body-centre samples never manufacture feet. Unavailable feet are null and stale observations expire using receiver-independent sender wall time.
- `event`: immediate canonical contact/slide/pivot/release. Dedupe by generation and eventId; no historic bus replay. Unassigned actor events are suppressed. Touch/simulator and manual trigger are synthetic; MP4 is rehearsal.
- `control`: start, stop, reset, cue, blackout. Source generation/calibration changes stop the stream and require manual restart. SOMA blackout, hidden tab, leaving Perform and teardown stop transmission. Missing acknowledgement or backpressure closes the sender rather than building a delayed queue.
- Receiver watchdog drops the armed output gate after >1s without packets or streamed state. Explicit arming in TD is required again. Network stop is not a physical light cut-off.

## Validation

- Application unit suite passes (including sender state-machine tests).
- Python receiver tests cover dedupe, sequence, payload validation, pairing, stop/reset/blackout, disconnect and timeout.
- Real WebSocket integration exchanges production sender packets with the production Python protocol core: hello, test pulse, state, heartbeat, blackout.
- TypeScript and Vite production build pass.
- Browser localhost access is unavailable across this session's execution boundary; production UI smoke follows the deployment.
- Native TouchDesigner node creation, Mac browser local-network permission, real cameras/HP, stage projection and 15–30 minute soak remain hardware checks. No signed hardware QA or tested binary .tox is claimed.

Run:

```sh
npm test
python3 -m unittest discover -s tests -p 'test_touchdesigner_receiver.py'
SOMA_TD_INTEGRATION=1 node --experimental-strip-types --test tests/touchdesigner-websocket.test.ts
npm run build
```

The integration test needs Python `websockets`; standard npm test skips it when SOMA_TD_INTEGRATION is unset. Setup instructions and files ship under public/touchdesigner and can be downloaded from Perform → TouchDesigner → Setup & detail.

Reference APIs: https://derivative.ca/UserGuide/Web_Server_DAT and https://derivative.ca/UserGuide/WebserverDAT_Class
