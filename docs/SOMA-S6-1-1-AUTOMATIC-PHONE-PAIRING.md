# SOMA S6.1.1 — Automatic QR Phone Pairing

**Source:** stacked Draft PR #28 on S6.0/S6.1 (#27). **Production is unchanged.**

## Why this approach

A phone is a **camera sender**, while the SOMA laptop performs tracking, gait/contact inference, floor calibration and projector output. No native app, duplicate MediaPipe instance, or uploaded live video. QR starts a short-lived authenticated signaling room; WebRTC then carries encrypted video.

```
Laptop SOMA → POST /api/phone-pair create
                  → Redis HSET room with 180s TTL
                  ← room ID + desktop capability + single-use phone ticket
             → local SVG QR (ticket in URL #fragment)
Phone Safari/Chrome → scan QR → open /?phoneCamera=1#room=...&ticket=...
                   → consent getUserMedia rear camera
                   → POST join (ticket consumed atomically)
Laptop → poll joined → create recvonly RTCPeerConnection + health datachannel
       → offer (SDP stored in Redis until room expiry)
Phone → poll offered → answer + camera video track
Laptop → poll answered → setRemoteDescription → delete room
WebRTC media and heartbeat → existing CameraTracker → FloorSession + Stage Optics
```

### Security and lifecycle

- The phone ticket is a **random 192-bit capability**, once consumed cannot join another phone. The room ID is random 96 bits; desktop and joined phone get separate 192-bit capabilities. Server stores SHA-256 hashes of these capabilities, not their cleartext values.
- QR is rendered **locally** using an MIT-licensed QR implementation from Project Nayuki. The QR URL puts `room` and `ticket` into the fragment, which browsers do not send on the initial page request; the sender immediately removes the fragment from browser history after reading it.
- Vercel Function validates same-origin POST, source format, SDP size, and role-specific state transitions. Rate limits are enforced through Redis; room changes occur with atomic Lua `EVAL`. Expiry is **180 seconds**.
- Redis briefly holds SDP offers/answers (which may contain ICE network candidates) until consumed or TTL expires. Protect access to your Upstash resource and avoid logging response bodies. Live video/archival footage never goes through Redis or the Vercel API.
- A local WebRTC data channel sends capture heartbeats. If the HP tab becomes hidden or its camera/connection stops, the desktop closes the remote stream and requests the existing global Blackout and floor calibration revocation. The stage light's true physical state still needs external verification.
- Both pairing directions close resources on navigation/unmount, with old browser tabs and stale rooms unable to rejoin.
- This automatic path is optional. The **manual OFFER/ANSWER** route from S6.1 remains in a separate tab and requires no Redis. It is not advertised as QR-enabled while API credentials are absent.

### Provisioning Vercel Preview

The paired room store is **Upstash for Redis** via Vercel Marketplace, with no dependency on discontinued `@vercel/kv`.

1. Open Vercel project **soma-motion-studio** → **Storage / Marketplace** → **Upstash Redis** → connect/provision a resource (free-tier may be available).
2. Verify Vercel environment variables for the **Preview** environment:
   - `KV_REST_API_URL` and `KV_REST_API_TOKEN` (Vercel Upstash integration defaults), or
   - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (standalone integration names).
   - All remain **server-side secrets**, with Preview access; do not copy values to ChatGPT or Vite.
3. Redeploy the preview branch after the environment variables are available. **Do not put these values in any `VITE_*` variable** or in public GitHub files.
4. Confirm `POST /api/phone-pair` returns `503 NO_SIGNALING_STORAGE` when variables are deliberately absent. When configured, requesting a QR through the SOMA UI should create a three-minute room.
5. Keep physical BODY/FLOOR output opt-in disabled until stage QA. Any network source change revokes old calibration.
6. If the project currently lacks permission to manage Vercel resources, setup must be completed by a Vercel project owner.

### Operator walkthrough

Laptop:
- Open a deployed **HTTPS preview**, Footprints → Guided Setup → Source → **Kamera HP**.
- The default **Scan QR · otomatis** tab shows **Buat QR kamera HP**.
- Hold the QR visible; invite expires after three minutes.

Phone:
- With Chrome Android or Safari iPhone, scan QR using the built-in phone camera. The URL opens the SOMA camera page under the matching HTTPS preview domain.
- Pick camera belakang, press **Aktifkan kamera dan hubungkan ke SOMA**, grant browser camera permission.
- Leave the page active and the phone mounted on a tripod; audio remains disabled.

Laptop:
- QR room automatically performs offer/answer, then the original SOMA Body tracker receives the remote stream.
- Verify pose and A/B identity, recalibrate the floor and inspect foot-contact events before any physical projection. If a phone tab is hidden or Wi-Fi drops, expect failed tracking and Blackout.
- To disconnect, use the phone's **Putuskan kamera** or the laptop's disconnect control.
- If the server is unconfigured or pairing fails, open **Kode manual · cadangan** and follow the previous S6.1 flow.

### Limitations

1. **TURN fallback is not yet provisioned.** Public STUN discovery can fail on carrier networks, captive networks or isolated Wi-Fi. Prefer private Wi-Fi initially. Production-grade inter-network use needs a scoped TURN relay and short-lived credentials, with measured latency/packet-loss acceptance.
2. **Real-device QA is outstanding.** CI tests protocol and compilation but cannot prove iOS Safari camera permission, Android device constraints, full-body detection, A/B crossing, 2.4/5 GHz Wi-Fi stability, mobile background tab behavior, or true projector photon latency.
3. **No server managed live-video recording**. Browser local capture still follows S6.0, and archives remain in browser IndexedDB.
4. **Separate phone window and QR security**: never share a QR screenshot publicly. Scan within the temporary room window.

### Test gates

- `npm test` including `tests/phone-automatic-pairing.test.ts` and all existing Footprints tests.
- `npm run build` with TypeScript, Vite and vendored QR code generator.
- Preview browser smoke at 1440/1024/768/390 px; verify QR scanner readability and mobile controls.
- Simulated API test: unauthorized role, second phone attempting same QR, revoked/expired room, cross-origin reject, storage missing.
- Real device rehearsal: compare webcam laptop vs HP 720p, frame freshness, foot contact, A/B crossing, network disconnection, repeated setup, and hardware Blackout.
- Production merge **blocked** until physical and browser checks plus required Redis preview configuration succeed.

## Verified November 17, 2026

Upstash integration was installed on the Vercel project, with the `KV_REST_API_*` keys visible in Preview metadata. The existing Vercel Function was fixed to use the available keys and to avoid an unresolved cross-folder TypeScript import. A temporary **Preview-only** diagnostic executed a real Redis room lifecycle (create → join → poll → close) and returned `200 {"ok":true,"diagnostic":"upstash-room-cycle","stages":4}`. The temporary GET diagnostic was removed immediately after verification; only the original POST pairing API remains. **This verifies the signaling backend only**. No real smartphone-to-laptop WebRTC/foot tracking or optical acceptance has been witnessed.
