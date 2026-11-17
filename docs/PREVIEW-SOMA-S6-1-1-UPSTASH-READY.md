# S6.1.1 Upstash-ready Preview — operational smoke checklist

Source: Draft PR #28, stacked on PR #27. This Preview uses the original SOMA camera, tracking and projection safety gates; Production stays unchanged.

## Detected project configuration

Vercel Upstash integration supplies server-only `KV_REST_API_URL` and `KV_REST_API_TOKEN` for Preview. S6.1.1 now supports these names as well as `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. No secrets belong in GitHub, query parameters or client-side Vite variables.

## Preview validation

1. Confirm the deployment shows READY and this branch's commit; inspect Vercel Functions logs if `/api/phone-pair` returns an error.
2. In SOMA laptop: Footprints → Guided Setup → Kamera HP → Scan QR otomatis → **Buat QR kamera HP**.
3. Verify scannable QR with 3-minute expiry, and that first phone can join only once; second phone or expired QR returns 410.
4. On phone: Safari/Chrome using the same **HTTPS Preview deployment**; allow rear camera and keep browser visible.
5. Confirm camera video enters the existing laptop Footprints tracker, performer identity, floor contact engine; change source invalidates old floor calibration.
6. Switch to tripod, calibrate floor, test walk / crossing and recorded video. Blackout should engage when phone/browser disconnects.
7. Manual OFFER/ANSWER remains a fallback when Redis signaling or QR fails, but it cannot fix NAT/firewall conditions that require TURN.
8. Check SSO/Deployment Protection: if Preview is access restricted, authenticate or share via Vercel's intended mechanism, never disable all preview protection casually.
9. Do not enable S5.7 physical BODY/FLOOR routing from this QR test. Independent optical QA and emergency hardware power cutoff remain necessary.

## Actual deployment status

This checklist is part of the source branch. Verify deployment and server/real-device outcomes separately: GitHub Actions passing does not prove Upstash API routing or camera stream stability.

## Completed infrastructure check

Installed Vercel Upstash publishes `KV_REST_API_URL`/`KV_REST_API_TOKEN` server-side. S6.1.1 now supports them. The POST Vercel Function initially had a `ERR_MODULE_NOT_FOUND` from a TypeScript cross-folder import; its self-contained runtime version fixed this (GET without handler returned 405). The temporary Preview-only GET test verified **real Redis room create/join/poll/close**, HTTP 200; test route subsequently removed. Real Android/iPhone WebRTC and stage QA still outstanding.
