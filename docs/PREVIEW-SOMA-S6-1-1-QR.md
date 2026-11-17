# Preview SOMA S6.1.1 — Scan QR → Kamera HP

**Branch:** `preview/soma-s6-1-1-automatic-phone-qr`  
**PR:** #28 stacked on S6.0/S6.1 #27. **Production is unchanged.**

## 1. Preflight (must pass before a QR can be created)

- Use the actual **HTTPS Vercel Preview deployment** for this branch, on **both laptop and phone**. The live Production domain does not include S6.1.1 until an authorized merge.
- In Vercel project `soma-motion-studio`, connect a private Upstash Redis resource to **Preview** and verify server-only environment variables:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
- Redeploy the preview **after** connecting Upstash. No token belongs in a `VITE_*` variable. `api/phone-pair.ts` must remain server-only.
- Without those variables, **Buat QR** shows the explicit 503 error and the existing **Kode manual · cadangan** tab remains available. No simulated successful pairing is shown.

## 2. One-scan walkthrough

1. Laptop: Footprints → Guided Setup → **Sumber** → **Kamera HP** → **Scan QR · otomatis**.
2. Laptop: click **Buat QR kamera HP**. A short-lived, scannable QR appears with a countdown. It can be used by one phone and expires in **3 minutes**.
3. Phone: scan using the phone's built-in camera. Chrome Android or Safari iPhone opens `/?phoneCamera=1` at the same Preview origin. The access ticket is carried in the URL fragment, then cleared from history.
4. Phone: select camera **Belakang**, press **Aktifkan kamera dan hubungkan ke SOMA** and allow camera permission.
5. Both sides perform WebRTC SDP exchange automatically using the temporary Redis room; no manual copy and paste is required.
6. SOMA laptop receives the WebRTC video stream in the **existing** Body tracker / Footprints engine. Confirm green tracking, A/B identity, floor event quality.
7. Recalibrate the floor using the new phone camera perspective. Start with a fixed tripod on a private Wi-Fi network, capturing both feet and the walking zone.
8. Stop sender on phone or use laptop **Putuskan kamera HP**; a lost WebRTC heartbeat forces the desktop to revoke tracking and request global Blackout.

## 3. Regression / adverse cases

- Two phones scan the same QR: the first accepted phone consumes its invitation. Other phones must receive **410 ROOM_EXPIRED**.
- Wait 3 minutes and scan: the room must fail closed. New QR works.
- Lock phone / background Safari or Chrome: no capture heartbeat; desktop must stop trusting the camera and Blackout.
- Drop Wi-Fi, deny camera, or physically disconnect sender: desktop stops trusting old calibration.
- Change to laptop webcam while the HP is connected: the old peer must unmount/close and the floor requires calibration again.
- Use a different origin to call `/api/phone-pair`: reject with **403**.
- Remove Upstash Preview variables and redeploy: QR must show a **503**, and manual pairing must remain accessible.
- Verify the old S6.0 saved archival clips still persist across Build/Perform and reload. Check long-run phone battery/heat and frame freshness.

## 4. Limitations / safety

- Automatic pairing still needs **one Vercel Upstash setup step**. No Redis was provisioned by this branch.
- Only SDP is stored briefly by signaling; webcam video flows via encrypted WebRTC media. Upstash temporarily holds potential ICE networking metadata; treat the Redis store as private.
- Public STUN is configured; **TURN is not configured yet**. Mobile networks and isolated guest Wi-Fi may fail to establish direct video even when QR succeeds. The manual code alternative cannot fix TURN-related network blocks.
- QR changes camera connectivity only: there is no automatic physical projector Live. The S5.7.4 hardware gate and independent BODY/FLOOR QA are unchanged.
- Automated CI cannot verify iPhone/Android camera permission, real A/B crossing, body-to-floor alignment or physical projected light. Physical-stage acceptance remains mandatory.

See `docs/SOMA-S6-1-1-AUTOMATIC-PHONE-PAIRING.md` for architecture, security and provisioning requirements.
