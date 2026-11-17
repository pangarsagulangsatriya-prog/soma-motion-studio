# SOMA S6.0–S6.1 — Preview Guide

**Software PR:** #27 (Draft, Production unchanged). **Branch:** `preview/soma-s6-session-guided-phone`. CI run #523: `npm test` (290 passing) and `npm run build` SUCCESS.

## How to use the preview

Start SOMA from a preview deployment or local Vite build:
```sh
npm ci
npm run dev
```

The source is the same SOMA build; only the phone sender route is separate. The live Production domain does not contain S6.1 until a reviewed merge; use a deployed HTTPS preview domain for both laptop and phone. A laptop must access SOMA via HTTPS or localhost. The phone must open a public **HTTPS** hostname (use the preview deployment hostname once available, not a raw `http://192.168.x.x` URL).

### A. Persistent Session (S6.0)
1. Footprints → **Guided Setup** → **Arsip** → Archival Mapping.
2. Choose MP4/WebM/Ogg/MOV videos for A and optionally B. Each file is stored in the browser's IndexedDB, subject to available storage (max configured size 300 MiB per slot).
3. Tune archive speed, crop, contrast, brightness and hold duration.
4. Switch Build → Perform → Build → Archival Mapping. Video names and files should reappear. For browser reload persistence, refresh and open Archive again.
5. Remember: browser-local IndexedDB is not backup; retain the original archival video files and test browser storage limits. Do not clear site data between takes.

### B. Use a smartphone as a camera (S6.1 WebRTC MVP)

Laptop:
1. Open **Guided Setup → Sumber → Kamera HP**.
2. Press **Buat kode OFFER di laptop**, wait until ICE collection completes, and copy the code.
3. Send the OFFER privately to the phone (e.g. chat, notes or paste via direct transfer).

Phone:
4. Open `https://soma-motion-studio.vercel.app/?phoneCamera=1` (or the matching HTTPS preview domain). Use Chrome Android or Safari iPhone. Select the **rear camera**.
5. Paste OFFER, press **Aktifkan kamera dan buat jawaban**, allow the camera permission, then copy the ANSWER back to the laptop. Keep the phone page and screen active.

Laptop:
6. Paste ANSWER into Guided Setup, press **Sambungkan video HP ke SOMA**.
7. Allow video to appear. Confirm the main Stage shows valid tracking before performing floor calibration. The same original SOMA tracker, foot event router and Contact-to-Archive system should operate on the remote stream.
8. Recalibrate four real floor corners when switching from laptop to phone. Do not reuse a previous camera floor mapping or QA.
9. Stop the sender or disconnect the receiver to end the WebRTC session. Check SOMA Blackout and physical projector safety.

### Camera setup guidance

- Prefer the same private Wi-Fi network, with both devices away from guest-network isolation. Video travels over WebRTC, not through a new media server.
- Use a sturdy tripod, stable landscape placement, visible whole bodies and feet, consistent light and minimal shadows.
- Phone capture requests ideal 1280×720 and 24–30 fps, but the actual sensor/browser frame rate varies.
- Use a charger and turn off battery-saving mode if it pauses the camera. Many mobile browsers suspend capture when backgrounded.
- Audio capture is disabled. Tracking/inference stays on the laptop.
- This manual pairing MVP has no TURN relay; networks blocking peer-to-peer can fail even if both browsers support WebRTC. STUN resolves candidate discovery only.
- Copying OFFER/ANSWER strings is temporary. **QR + six-digit room** requires an authenticated shared signaling server; it is NOT implemented in this preview.
- Entering Perform still blanks physical outputs and the existing Production hardware opt-in gate is unchanged.

## Real-world signoff still missing

CI verifies logic and TypeScript compilation but not camera throughput, iPhone permissions, Android browser behavior, end-to-end latency, full-frame mobile movement, A/B crossing, or the true projector light path. Test these before enabling or deploying any physical stage output. No automatic Production merge.
