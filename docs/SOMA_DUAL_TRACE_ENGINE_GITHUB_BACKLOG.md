# SOMA — Dual Trace Engine V1 | GitHub implementation backlog

Status: issue dibuat di GitHub; **belum ada implementasi kode, merge, atau deploy Dual Trace**.

Epic: [#215](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/215) · [PRD V1](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/blob/docs/dual-trace-engine-v1/docs/SOMA_DUAL_TRACE_ENGINE_PRD_V1.md) · [Algoritme lengkap](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/blob/docs/dual-trace-engine-v1/docs/SOMA_DUAL_TRACE_ENGINE_RENDER_PIPELINE_V1.md)

## Kontrak artistik/teknis
- Dua kanvas utama: FOOT PATH kiri, HEAD & SHOULDER kanan (Split default).
- Satu inferensi pose, identitas A/B per frame; kedua view sinkron.
- Aktor A `#E84B32`, B `#202226`; latar `#F7F6F2`, warna konsisten pada semua channel.
- Foot path ~22px, footprint fade 6s, tinta menetap; head 8px α.75, shoulder 16px α.90, gain 1.35× (1.0–2.5×).
- Demo tanpa pose 33 head/shoulder → status unavailable; jangan mengarang gesture.
- No Vercel/Map/F3/output externals modifications.

## P0 — MVP
- [ ] **P0-01** · [#216](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/216) — PoseFrameBus: MP4/live → satu timestamp, identitas A/B
- [ ] **P0-02** · [#217](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/217) — UpperGestureAnchorAdapter: head/shoulder confidence
- [ ] **P0-03** · [#218](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/218) — GestureStrokeTracker: empat kanal, smoothing, CUT
- [ ] **P0-04** · [#219](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/219) — UpperGestureInkRenderer: head/bahu Sumi + persistent store
- [ ] **P0-05** · [#220](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/220) — DualTraceCanvasHost: Split, fullscreen, Clear independen
- [ ] **P0-06** · [#221](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/221) — DualTraceControls: gain, preset, per-actor palette
- [ ] **P0-07** · [#222](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/222) — Browser/MP4 QA: negative flows, 30min, physical QA

## P1 — karakter dan pengarsipan
- [ ] **P1-01** · [#223](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/223) — Body-relative translation + articulation + gain
- [ ] **P1-02** · [#224](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/224) — Material Sumi/dry/tonal presets
- [ ] **P1-03** · [#225](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/225) — Combined optional + PNG/session JSON export

## P2 — panggung
- [ ] **P2-01** · [#226](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/226) — Dua proyektor fisik + Perform routing
- [ ] **P2-02** · [#227](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/227) — Cue permainan performer + rehearsal

## Urutan dependensi
`#216 → #217 → #218 → #219 → #220 → #221 → #222` (rilis beta hanya setelah QA).
`#223` mengikuti adapter/tracker; `#224` setelah renderer; `#225` setelah dua kanvas. `#226–#227` setelah uji fisik/stage.

## Acceptance gate
- [ ] Gerak kepala dan bahu benar-benar mengikuti source pose per timestamp, tanpa loop dekoratif.
- [ ] Dua aktor 4 channel tidak swap, pose hilang/seek/reconnect CUT tanpa bridge.
- [ ] Head & shoulder diam 10 detik: 0 ADD/0 tinta baru.
- [ ] Layar foot & upper punya Clear dan fullscreen independen; Combined tetap sekunder.
- [ ] Test unit/browser/screenshot MP4 nyata, source parity dan soak 30m lulus.
- [ ] Gambar 1600×900 dan thumbnail 320px: dua warna tetap terbaca, karakter head vs bahu tampak berbeda.
- [ ] Verifikasi operator/perangkat fisik dicatat terpisah, tidak mengganti hasil uji simulasi menjadi klaim presisi.
