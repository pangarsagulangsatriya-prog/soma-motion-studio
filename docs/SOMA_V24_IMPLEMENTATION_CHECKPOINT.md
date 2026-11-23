# SOMA V2.4 — Implementation Checkpoint
**Tanggal:** 23 November 2026  
**Status:** BETA IMPLEMENTED / opt-in di Compose; belum Stage-Ready dan belum menggantikan default V2.3  
**PRD:** [SOMA V2.4 PRD](SOMA_V24_SPATIAL_COVERAGE_MOTION_INK_PRD.md)  
**Arsitektur:** [SOMA V2.4 Technical Architecture](SOMA_V24_SPATIAL_COVERAGE_MOTION_INK_TECHNICAL_ARCHITECTURE.md)

## 1. Perubahan kode yang sudah dipush

| Work ID | Modul | Perubahan |
|---|---|---|
| SP24-01 | `CoverageTraceRecorderV24.ts` | Simpan riwayat XY A/B terbatas, membedakan raw-foot stage, fused dan smoothed; ekspor JSON lokal |
| SP24-02 | `SourceFrameGeometryV24.ts`, `SourceFrameNormalizer.ts` | Geometri sumber: width/height, aspect fit, mirror, rotasi; reversible raw ↔ stage |
| SP24-03 | `coordinates.ts` existing + source geometry propagated | Camera-floor mapping menerima sourceGeometry saat tersedia; perubahan framing mengganti transform signature |
| SP24-04 | `ActorSpatialFusionV24.ts`, `ActorGroundTrajectoryEstimator.ts`, `ActorMotionFrameBuilder.ts` | Gunakan side-foot raw + hip delta sekali; kurangi penyusutan akibat dua tahap damping |
| SP24-05 | `ActorSpatialFusionV24.ts`, Continuity V2.3 retained | Pisahkan dual-foot, single-foot, swing, stance-switch dan pivot; gap tetap memakai bridge validator V2.3 |
| SP24-06 | `GroundTrajectoryEngineV2.ts`, `LineTrailsV3.tsx`, `DualTraceV2Renderer.ts` | Gabungkan fusi/smoothing/renderer, hitung cakupan, terapkan transform sumber yang sama pada cap |
| SP24-07 | Unit + browser fixture, private E2E opt-in | Golden sintetis A/B; private real-MP4 test tersedia untuk dijalankan pada perangkat pemilik video |
| MS24-08 | `AdaptiveMotionSmootherV24.ts` | One-Euro-style filter adaptif, anti-jitter STOP, posisi tetap dekat accepted sample |
| MS24-09 | `PathSplineFitter.ts` existing | Tetap memakai centripetal spline; feed berasal dari accepted + smoothed trajectory |
| IN24-10 | `SumiRibbonMeshBuilder.ts` | Noise tepi berkelanjutan berdasarkan arc length, dibatasi 18% lebar; centerline tidak berubah |
| IN24-11 | `DirectionalInkPainter.ts`, `PersistentPathStore.ts` | Dry-bristle erosion berserat dan deterministik; atlas retained/active tetap seperti V2.3 |
| UX24-12 | `DualTraceControlsV2.tsx`, `SurfaceComposer.tsx` | Toggle Spatial V2.4, smoothing presets, Rough Sumi, Roughness, ekspor JSON |
| QA24-13 | `spatial-motion-rough-sumi-v24-qa.yml` | npm test + tsc/build + Playwright Chromium + screenshot artifacts |
| QA24-14 | QA fisik dan soak 30 menit | **Belum dijalankan**; harus diuji pada perangkat proyeksi nyata |

## 2. Perilaku yang sekarang tersedia

1. **Fusi raw foot + hip** dipilih ketika operator mengaktifkan Spatial V2.4 beta. Dua kaki yang bergerak koheren mempertahankan perpindahan badan; satu kaki ayun tidak boleh menyeret lintasan ke tepi palsu.
2. **V2.3 Continuity tetap mengendalikan gap dan crossing**. Prediksi hip-only tidak langsung masuk committed ink dan kandidat yang gagal pulih tetap diputus.
3. **Motion smoothing** membaca timestamp input dan memfilter tiap actor/stroke. Pilihan Responsif, Seimbang, Stabil. Filter direset pada CUT/source/epoch change.
4. **Rough Sumi** dapat dipilih terpisah dari mode tracking. Parameter kekasaran 0–100% mengubah tepi/bristle, bukan koordinat jalur.
5. **Source-frame aspect geometry** mempertahankan raw-to-stage fit saat ada profil sumber; track yang berubah framing tidak tersambung dengan riwayat lama.
6. **Export trace** tersedia di panel Tracking jalur ketika Spatial V2.4 aktif. Berkas JSON berisi timestamp dan koordinat, **tanpa menyertakan frame video**.
7. Fullscreen, Map dan Perform tetap memakai jalur final raster existing. Blackout dan arsitektur output tidak diganti.

## 3. Pengujian yang telah diperiksa

- Tes unit V2.4: coherent feet, one-foot swing, in-place pivot, jangkauan kiri-kanan dengan router compressed, smoothing saat STOP, reset source, roughness deterministik/zero-mode dan batas tekstur.
- Tes source geometry: aspect 16:9, portrait, rotasi 0/90/180/270, mirror, roundtrip, invalid geometry, letterbox margin.
- Tes browser: operator mengaktifkan V2.4 dan Rough Sumi; synthetic A/B melintasi kanvas hingga sisi jauh, raster tetap berwarna dan path panjang.
- Regresi V2.2/V2.3 tetap dipantau dalam workflow GitHub.
- [V2.4 browser + unit QA berhasil](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/actions/runs/45215678722).
- [GitHub Pages deployment berhasil](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/actions/runs/45215678724).

**Pembatasan:** browser QA di atas memakai data jalur sintetis dan belum membuktikan nilai coverage pada MP4 dua aktor 15,04 detik. Test private E2E tersedia di `e2e/private-real-mp4-spatial-v24.spec.mjs`, perlu file MP4 lokal dan persetujuan pemilik untuk menyimpan screenshot QA.

## 4. Cara operator mencoba

1. Buka **Track → Video MP4**, pilih file dua aktor dan pastikan snapshot pose diterima. Jika diperlukan, simpan bidang kamera empat sudut.
2. Buka **Compose → Dual Trace V2 · Gabung**.
3. Di **Tracking jalur · V2.2**, aktifkan **Spatial V2.4 (beta)**. Pilih **Stabilitas gerak: Seimbang**.
4. Di **Sapuan & gestur**, pilih **Rough Sumi · serat kasar**, atur Kekasaran tepi sekitar 70–85% sebagai titik awal.
5. **Bersihkan semua**, putar MP4 dari detik nol hingga akhir. Periksa apakah jalur A/B benar-benar mendekati ujung perjalanan kanan/kiri, berbelok, lalu berhenti.
6. Setelah playback, gunakan **Ekspor posisi A/B · JSON** jika ingin memeriksa titik waktu saat lintasan menyusut atau drift.
7. Jika hasil tidak wajar, matikan Spatial V2.4 untuk fallback V2.3; pastikan V2.2 tetap aktif bila ingin fusi hip lama.

## 5. Masih terbuka sebelum default/stage-ready

- P0 — Eksekusi private real MP4 bersama anotasi support-foot dan actor identity; ukur coverageX target awal >=90% dan endpoint error, bukan sekadar jumlah stroke.
- P0 — Verifikasi Map, fullscreen, projector Blackout dan recovery pada perangkat panggung.
- P0 — Periksa crossed-actor IDs pada frame asli; tidak ada unsafe A/B bridge.
- P1 — Bandingkan Rough Sumi pada monitor dan proyektor nyata, adjust density/roughness jika terlalu menyerupai pita.
- P1/P2 — Stress webcam/HP cable/HP Wi-Fi dan soak 30 menit dengan rekaman FPS/memori.
- P2 — Kemampuan menyimpan setiap parameter material historis secara penuh bila operator mengganti Roughness saat satu stroke lama masih aktif. Untuk QA artistik sekarang, bersihkan lukisan lalu replay setelah memilih material.

**Kebijakan rilis:** V2.4 beta di GitHub Pages; **tidak ada deploy Vercel**. Jangan menyatakan P0 real-MP4 coverage atau QA perangkat fisik selesai sebelum bukti diuji.
