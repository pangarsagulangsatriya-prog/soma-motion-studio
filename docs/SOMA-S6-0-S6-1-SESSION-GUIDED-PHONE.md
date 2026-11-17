# SOMA S6.0 — Stage Session Foundation / S6.1 — Guided Stage Setup & Phone Camera MVP

**Branch:** `feat/soma-s6-0-s6-1-session-guided-phone-20261117`  
**Base:** Production `main` as of 17 November 2026.  
**Status:** Implementation + automated tests in branch; **not** physical stage acceptance, not automatically promoted to Production.

## Architecture choice — HP as camera, laptop performs tracking

```
Android Chrome / iPhone Safari  (HTTPS SOMA /?phoneCamera=1)
     getUserMedia(facingMode: environment, video only)
       → RTCPeerConnection sender, audio=false
       ↕ DTLS/SRTP video; ICE host/STUN discovery
Desktop SOMA Footprints (HTTPS SOMA, Guided Setup → Kamera HP)
       → RTCPeerConnection receiver
       → existing HTMLVideoElement (no second hidden video pipeline)
       → existing CameraTracker / MediaPipe Pose & A/B identity
       → existing LiveFloorTrackingEngine / Contact Archive Bridge
       → existing BODY + FLOOR outputs and safety gates
```

A native app installation is **not necessary** for the MVP. The user opens a link in the phone's current browser and grants one-time/ongoing camera permission per browser policy. The laptop must remain the tracking/processing machine; phone heat, battery, camera sensor, and moving Wi-Fi links should not control physical safety.

## S6.0 implementation

- `StageSessionStore.ts`: versioned project metadata and original MP4/WebM/Ogg/MOV `File` data, up to **300 MiB per slot**, stored in IndexedDB on that browser/profile. Source choice (webcam/phone/simulation), performer count, two archival playback settings and bridge hold duration persist.
- `useStageSession.ts`: shared state in the Footprints Stage parent so archive editor can unmount while uploaded files remain selected in memory. On page reload the same local media files are rehydrated from IndexedDB. The archive editor reattaches saved video files on mount and revokes temporary object URLs when closing.
- No video content is sent to SOMA servers by the IndexedDB store.
- The Browser Storage API may evict IndexedDB data under low storage pressure, privacy/private browsing or user deletion. It is **not a permanent secure backup**. Original videos should be kept separately. Larger media may fail quota writes; UI will display error and preserve the last stored file.
- The release initially saves the single local Stage project named `local-stage`. Multiple distinct named projects and packed zip export/import are future upgrades. Foot/pose history is not recorded by this store.

## S6.1 Guided Setup

A new **Guided Setup** entry in the Footprints toolbar provides five nonblocking steps:
1. **Source:** local laptop Body camera / phone as WebRTC camera / 3D simulation.
2. **Calibration:** existing four-corner floor and five-point physical QA; no fictitious automatic marker matching.
3. **Tracking:** existing movement and performer A/B monitor, contact count and simulation lab.
4. **Archive:** saved original A/B footage with Contact-to-Archive Bridge and existing video mappings.
5. **Rehearsal:** local Stage project naming and minimal Perform entry.

The wizard is additional access to the existing Stage Workspace, not a copy of its tracking engine. It remains mounted (even while hidden), so closing it does not close a connected phone RTCPeerConnection. When the operator leaves Footprints or unloads the app, the phone session and camera are torn down.

### Phone pairing — operational MVP without signaling backend

**Currently manual SDP exchange.** The phone sender and laptop receiver exchange offer and answer strings through an out-of-band channel chosen by the user. This allows actual browser-to-browser video without an external signaling account.

1. Desktop: open SOMA → Footprints → Guided Setup → **Kamera HP** → **Buat kode OFFER**.
2. Phone: open `https://soma-motion-studio.vercel.app/?phoneCamera=1` in Safari/Chrome over HTTPS. Paste the OFFER sent privately from desktop.
3. Phone: select rear camera, press **Aktifkan kamera dan buat jawaban**, allow camera permission, then copy the generated ANSWER back to desktop.
4. Desktop: paste ANSWER, press **Sambungkan video HP**. The existing Body tracker starts on that remote MediaStream; calibrated camera/floor binding and projection approvals are revoked whenever the source changes.
5. Place the phone fixed on a tripod, landscape if possible, with actor's feet and floor fully visible. Keep phone page active and power available.
6. Stop via phone or desktop. On sender loss/disconnection, SOMA must stop trusting remote tracking and must issue Blackout before any new calibration or physical output.

**Limitations:** This is a **technical pairing MVP**, not the final SurfaBeam-like QR experience. It requires copying long codes, may fail across cellular/guest Wi-Fi/firewalls without TURN, and cannot continue streaming when a mobile browser suspends the tab. The page uses a public STUN service for discovery, so peers' networking metadata may reach the STUN operator; audio and archived footage are not forwarded through it. Avoid entering private offers into public chat channels.

### Recommended next incremental step — automatic QR pairing

After physical end-to-end tests, add a SOMA signaling service:
- Desktop generates a single-use random room identifier and short-lived token.
- Laptop displays a QR code pointing to the phone capture page with that room.
- Phone asks for camera permission, exchanges SDP/ICE over authenticated WSS signaling, then WebRTC carries video.
- Signaling stores metadata with short TTL and requires origin checks, per-room authentication, rate-limits and replay protection.
- Vercel Functions now support WebSocket connections, but room-to-room messages require durable shared state (for example an appropriately scoped Redis). No service, keys, or TURN relay have been provisioned in this branch. A QR appearance alone must not be claimed as working pairing.
- Consider TURN with TURN credentials scoped per session for real-world NAT failures and a mobile-source heartbeat/fail-closed policy.

## Physical acceptance and software safety

Existing `StageHardwareGate` and the S5.7.4 independent BODY/FLOOR QA are unchanged. Production remains opt-in locked for physical output, including `VITE_SOMA_STAGE_OUTPUTS=enabled`. This new feature does not activate hardware.

Phone camera setup should be measured at 720p/24–30 fps, including network packet loss, time to first video, MediaPipe inference latency, body-identification consistency during A/B crossing, camera-to-pad alignment, missed contact, and true projected foot-to-light latency. A new camera perspective invalidates existing floor calibration.

## Tests

- `tests/stage-session-phone-camera.test.ts`: strict session metadata/archival settings and manual WebRTC signal contract.
- Existing Footprints, archive, output, and projection regression tests must pass.
- `npm test` and `npm run build` run by CI.

## Post-merge browser checks still required

- Save A/B video, switch Stage→Archive→Build→Perform→Build→Archive; footage should remain in local project and player. Reload and verify IndexedDB restore.
- Open phone capture URL on actual Android Chrome and iOS Safari, allow camera, copy offer/answer, verify video plays on desktop without second MediaPipe instance.
- Switch from phone to local webcam and ensure old calibration/Live approval invalidated and previous PC released.
- Revoke camera permission or lock the phone screen; within tracking timeout, stop trusting frames and Blackout outputs.
- Measure 1440/1024/768/390 px wizard usability, IndexedDB quota error reporting and disabled output gate in Production.
