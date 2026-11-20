# SOMA → TouchDesigner (local WebSocket data bridge)

The SOMA Vercel site sends *tracking data* to a locally running TouchDesigner instance. It sends no live camera video to Vercel. A TouchDesigner operator is responsible for physical calibration and projector arming.

## Setup in TouchDesigner (on the **same laptop** as SOMA's browser)

1. Add **Web Server DAT**, name it `webserver1`.
2. Set **Local Address** `127.0.0.1`, **Port** `8765`, **Active** On. **Do not expose it to a network interface**.
3. Add a **Text DAT**, paste `soma_webserver_callbacks.py`, set as `webserver1`'s **Callbacks DAT**.
4. Restart the Web Server DAT to run `onServerStart`. Open TouchDesigner Textport and type `op('webserver1').fetch('soma_token')`; copy the generated code. This code changes on server restart and is never committed to Git.
5. Add a **Script CHOP** with callbacks DAT containing `soma_script_chop.py`. The Script CHOP should cook each frame, referencing `webserver1` in the same network.
6. In SOMA Vercel → `04 Perform` → `TouchDesigner`, enter `127.0.0.1:8765` and the code; click **Hubungkan TouchDesigner**, then **Trigger Uji**.
7. If that works, choose a running source in Track, return to Perform, click **Mulai Kirim Data**.
8. In TD, use `a_left_x`, `a_left_y`, `b_right_x`, etc. to drive visual TOPs; `contact_A_L` or `contact_B_R` provides a short pulse. Add a CHOP Execute DAT or Trigger CHOP according to your patch.
9. **Before any projector test:** separately add your own manual arm toggle, Black TOP / safe-mute gate, physical power blackout, and test it with a real projector. `scene_gate` from the starter Script CHOP remains `0` intentionally. Do not use the received data as a physical-live authorization.

## How to know it works

- `Terhubung` appears only after the TD Web Server DAT returns the authenticated `hello-ack`.
- `Trigger Uji` produces exactly one pulse in `contact_A_L` and a new `last_test` in `webserver1` storage. Test data is marked synthetic.
- `Mulai Kirim Data` sends positions at up to 20 Hz; open Script CHOP viewer to see live channels.
- Stopping the send, closing the browser, losing Wi-Fi/USB video or stopping TD should make Script CHOP's `source_fresh` fall to `0` within ~1 second (as long as TD is still cooking). On unexpected disconnect, manual rearm is required.
- MP4 and 3D are tagged `mode: rehearsal`, data from live sources `mode: live`; this has **no relation to projector LIVE permissions**.
- The same terminal session works across supported sources, but the operator must press **Mulai Kirim Data** after switching source to avoid stale contact events.

## Security and transport limits

- Never bind Web Server DAT to `0.0.0.0` for this starter bridge; use only `127.0.0.1`.
- Local operator code is required and validated during `hello`. Do not store it in localStorage, URLs, or logs.
- SOMA's browser sends only to `ws://127.0.0.1:8765` / loopback equivalents. From an HTTPS page Chrome may require a *Local Network Access* permission prompt; allow it for the app during rehearsal.
- This project includes **Python callback sources**, not an automatically generated `.toe` or `.tox` binary. Run the setup inside an installed TouchDesigner application and validate with your TD version before stage use.
- Browser WebSocket has no guaranteed UDP timing. If you later need OSC UDP, build a separate audited bridge.

## Schemas

Protocol: `soma.td-bridge`, version `1`. Session starts with `hello` + token → `hello-ack`. Then `heartbeat` (500 ms), `state` (up to 20 Hz), `event` (immediate), and `control` (`cue`, `reset`, `blackout`, `stop`). Coordinates are 0–1. `floor-uv` is physical-stage calibrated only when the source supports it; `image-uv` is camera/video space; `simulated-floor-uv` is synthetic. Every foot object preserves `coordinateBasis`.

Receiver documentation: [Derivative Web Server DAT](https://derivative.ca/UserGuide/Web_Server_DAT) and [webserverDAT methods](https://derivative.ca/UserGuide/WebserverDAT_Class).
