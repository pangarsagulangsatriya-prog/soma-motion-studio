# SOMA V3.5 — Backlog GitHub P0–P2

**Status:** **17 issue sudah dibuat** di GitHub: Epic [#194](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/194), P0 [#195–#203](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/195), P1 [#204–#207](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/204), P2 [#208–#210](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/208).  
**Rujukan GitHub:** [PRD V3.5](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/blob/docs/path-first-sumi-v35/docs/SOMA_PAINTERLY_V3_5_PATH_FIRST_SUMI_ENGINE_PRD.md) · [Algoritme V3.5](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/blob/docs/path-first-sumi-v35/docs/SOMA_PAINTERLY_V3_5_RENDER_PIPELINE_STEP_BY_STEP.md).

**Rujukan:** `SOMA_PAINTERLY_V3_5_PATH_FIRST_SUMI_ENGINE_PRD.md`, `SOMA_PAINTERLY_V3_5_RENDER_PIPELINE_STEP_BY_STEP.md`.

## P0 — Harus selesai sebelum rilis Path Sumi

- [#195](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/195) · **P0-01 · PathObservationRouter** — Gabungkan empat kaki menjadi satu pengamatan pusat per aktor; weighted support, missing-foot recovery, provenance yang jelas.
- [#196](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/196) · **P0-02 · ActorPathTracker** — State machine START/ADD/TURN/STOP/CUT; anti-teleport, separation A/B, source epoch dan actor ambiguity.
- [#197](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/197) · **P0-03 · PathSplineFitter** — Smoothing adaptif, centripetal Catmull–Rom, resample arc length, bounded overshoot, editable tail.
- [#198](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/198) · **P0-04 · SumiRibbonMeshBuilder** — Ribbon *kontinu* 26px, round joins, head/tail taper hanya pada START/CUT, hindari polygon per frame.
- [#199](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/199) · **P0-05 · PersistentPathStore** — Committed ink + editable active tail, dedup per klip MP4, clear dan cut terpisah, memory bounded.
- [#200](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/200) · **P0-06 · Runtime/compositor source parity** — Integrasi V3.5 ke `LineTrailsV3` / `PainterlyCanvasRenderer`, footprint fade 6s, fullscreen clean, blackout aman.
- [#201](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/201) · **P0-07 · UI & defaults** — Path Sumi, Actor Path, 26px, style/preview, fallback V3.4–V3.2; jangan mengganti default produksi sebelum signoff.
- [#202](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/202) · **P0-08 · QA & visual signoff** — 10 fixture, screenshot 1600×900 dan 320px, 30min synthetic soak, tes perangkat fisik terpisah.
- [#203](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/203) · **P0-09 · GitHub Pages release gate** — Gabungkan PR setelah tes/QA, cek deployment Pages, rollback; tidak menyentuh Vercel.

## P1 — Tingkatkan kualitas tinta

- [#204](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/204) · **P1-01 · DirectionalInkPainter** — Serat searah path, tepi alami, bleed terkendali, dry brush deterministik.
- [#205](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/205) · **P1-02 · Event accent engine** — Mikrosplatter pada pivot/turn valid, cooldown, 0–3 titik, STOP pooling sekali.
- [#206](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/206) · **P1-03 · Tonal overlap & presets** — Pengendalian opacity, identitas merah–hitam, Path Sumi/Dry Ink/Pigment Mass.
- [#207](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/207) · **P1-04 · Export & visual comparison** — PNG/session yang tak memuat kamera mentah, replay dedup, V3.4–V3.5 side-by-side.

## P2 — Eksplorasi setelah path kuat

- [#208](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/208) · **P2-01 · Wet/dry, nib dynamics** — variasi nib, panjang serat, kekeringan sepanjang stroke; tetap menjaga keterbacaan path.
- [#209](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/209) · **P2-02 · Foot Path alternatif** — L/R terpisah, satu warna per aktor; tracking valid, tidak mengubah default Actor Path.
- [#210](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/210) · **P2-03 · Composition review & stage diagnostics** — timeline 30 menit, occupancy/overlap, metrik frame dan komposisi; zoom Compose tidak mengubah Map.

## Urutan dan gerbang kerja

```text
P0-01 → P0-02 → P0-03 → P0-04 → P0-05 → P0-06 → P0-07 → P0-08 → P0-09
                                     ↘ P1-01 → P1-02 → P1-03 → P1-04
                                                           ↘ P2-01/02/03
```

P0-08 wajib berisi persetujuan artistik dan operator ≥4/5 untuk keterbacaan path, kontinuitas, kualitas material dan keterkaitan dengan jalan. Hasil 20–60 detik tetap berupa **dua jalur**, tidak berubah menjadi blob. Rilis GitHub Pages hanya sesudah verifikasi; Vercel tidak disentuh.