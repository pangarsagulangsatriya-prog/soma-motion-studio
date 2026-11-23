# SOMA — Dual Trace V2: Layered Canvas
## PRD / Product Requirements Document

**Tanggal:** 23 November 2026  
**Status:** Draft siap implementasi — kode aplikasi belum diubah dalam pekerjaan dokumen ini  
**Workspace:** Stage 1 → Compose → Dual Trace  
**Sumber:** Audit tampilan Dual Trace 23 November dan kode pada branch main SOMA  
**Pasangan dokumen:** [Arsitektur teknis dan algoritme](SOMA_DUAL_TRACE_V2_TECHNICAL_ARCHITECTURE.md)

## 1. Masalah yang terlihat

Pada layar Compose saat ini terdapat dua kanvas kecil: Foot Path di kiri, Head & Shoulder di kanan, masing-masing dengan latar putih. Hasilnya terpisah dan menghabiskan area Stage Monitor. Foot Path, tapak, dan gestur upper memakai warna aktor yang saling berdekatan; sapuan tampak pendek, tipis, dan terkumpul pada sebagian kecil kanvas. Posisi head/shoulder dan foot path belum selalu berada pada basis koordinat yang sama.

**Temuan kode yang mendukung:**
- DualTraceCanvasHost.tsx mengatur dua panel/dua kanvas 1600 × 900 dalam grid.
- LineTrailsV3.tsx merender Foot Path memakai paintPainterlyCanvas; raster yang dikirim melalui outputRaster disalin sebelum upperInk.paint, sehingga upper belum menjadi bagian dari keluaran Map/Perform.
- UpperGestureInkRenderer.ts mengisi putih (#F7F6F2) sebelum menggambar kepala dan bahu; layar tidak dapat ditumpuk begitu saja melalui CSS.
- DualTraceControls.tsx mengubah actorColors yang sama; warna Foot Path, Footprints dan Head/Shoulder belum bebas per lapisan.
- PersistentPathStore menyimpan tinta dalam atlas raster; perubahan warna historis perlu strategi penyimpanan terpisah atau replay deterministic.
- UpperGestureAnchorAdapter.ts menghasilkan posisi head/shoulder dalam koordinat gambar 2D; Foot Path dapat memakai camera-to-floor. Menumpuknya tanpa transform bersama akan menggeser makna posisi.

## 2. Tujuan V2

1. Stage Monitor memperlihatkan **satu kanvas utama putih 16:9** untuk Foot Path, Footprints, dan Head & Shoulder yang bertumpuk.
2. Operator memilih mana yang terlihat di depan: **Tapak di depan** (default) atau **Gesture di depan**. Urutan layer dapat diperluas tanpa mengubah data gerak.
3. Warna **Garis / Tapak / Gesture** dibedakan untuk masing-masing aktor A dan B; mengganti warna mengubah lukisan yang sudah ada pada sesi ini.
4. Foot Path terasa seperti sapuan kuas: taper, serat, ketebalan bervariasi mengikuti karakter gerak, dengan pembatas yang mencegah noda acak.
5. Posisi Foot Path dan Gesture terkait pada transform ruang yang masuk akal, disertai label kualitas sumber (terkalibrasi, estimasi 2D, atau virtual).
6. Compose, fullscreen, Map, Perform, serta PNG gabungan menerima **raster final yang sama**.
7. Data pose tetap dihitung sekali. Tidak ada detector kedua atau pemutaran video tersembunyi.

## 3. Batasan dan prinsip

- Urutan SOMA tetap Track → Compose → Map → Perform.
- Penyimpanan profil camera-to-floor berada di Track; Map hanya mengurus floor-to-projector.
- Satu aktor A default merah; B arang. Semua channel milik aktor A/B bisa dikustomisasi.
- Bidang dasar putih tetap. Tidak ada video kamera/skeleton pada keluaran proyektor bersih.
- Footprints tetap memudar (default 6 detik), Foot Path dan Gesture dapat bertahan sampai di-clear.
- Teknologi harus bekerja pada webcam, kamera HP, MP4, dan simulator; head/shoulder yang memang tidak tersedia ditandai **Data gesture belum tersedia** di UI.
- Track tanpa kalibrasi tetap dapat menghasilkan komposisi 2D, berlabel estimasi. Jangan mengaku kedalaman/tekanan kaki telah diukur.
- V2 tidak menambah Hydra.js atau mengganti engine pose.
- Tidak ada perubahan ke output fisik atau QA/Blackout dalam implementasi visual.

## 4. Experience: Compose V2

### Tampilan utama

- Stage Monitor: satu bidang lukisan putih, sepenuhnya memakai area monitor tersedia. Responsif mengikuti aspect ratio 1600:900.
- Toolbar ringkas: **Gabung** (default) | **Pisah (Debug)**; **Tapak di depan** | **Gesture di depan**; **Layar penuh**.
- Mode Pisah menampilkan dua kanal diagnostik lama dengan **transform, skala dan clock yang sama**. Hanya mode Gabung menjadi raster production.
- Panel kanan: **Lapisan**, **Warna**, **Sapuan**, **Jejak**. Hanya bagian terpilih dibuka; kontrol teknis di Detail.
- Status sumber pendek: MP4 · estimasi 2D / Kamera · lantai terkalibrasi (estimasi) / Virtual · simulator.

### Urutan layer

Preset A (default): Background → Upper Gesture → Foot Path → Footprints → output.
Preset B: Background → Footprints → Foot Path → Upper Gesture → output.

Dengan dua preset tersebut, operator sudah bisa menukar prioritas visual. Kontrol per-layer order manual dapat ditunda ke P2.

### Default warna dan opasitas

| Channel | Aktor A | Aktor B | Opacity awal |
|---|---|---|---|
| Foot Path / garis | #963C38 (merah tua) | #303536 (arang) | 0.80 |
| Footprints / tapak | #E57762 (terakota) | #848B88 (abu batu) | 0.85, memudar 6 detik |
| Upper Gesture | #C8A09A (merah pudar) | #ADB5B0 (abu pucat) | 0.52 |

Head dan Shoulder mengikuti palet Gesture, tetapi lebar dan opacity-nya boleh berbeda melalui Detail. Perbedaan kanan/kiri kaki berasal dari bentuk/orientasi, bukan mengganti identitas warna aktor.

### Kontrol sapuan ringkas

- **Bobot sapuan:** default setara 22 px pada kanvas 1600 × 900; perubahan punya batas aman.
- **Karakter tinta:** Natural Sumi (default), Dry Brush, Dense Ink.
- **Respons gerak:** Halus / Ekspresif. Ekspresif memperkuat variasi yang dipicu perubahan langkah, bukan menambah random jitter.
- **Durasi tapak:** default 6 s.
- **Clear:** Seluruh lukisan / Path / Tapak / Gesture. Clear kanal tidak memusnahkan kanal lain.
- **Ekspor:** PNG gabungan; PNG per lapisan tersedia dalam opsi lanjutan.

### Status dan empty state

- Upper tidak valid: Foot Path dan Footprints tetap tampil pada kanvas utama; tampilkan pesan kecil di luar raster, **Menunggu pose kepala/bahu**.
- Demo kaki: Foot Path saja masih dapat dilihat, status **Simulasi kaki · gesture belum tersedia**.
- Perubahan kamera/MP4/kalibrasi: hentikan segmen lama dan evaluasi kesesuaian koordinat sebelum menyambungnya lagi.
- Fullscreen: hanya lukisan bersih; tombol operator, badge, dan diagnostik disembunyikan.

## 5. Karakter sapuan: peristiwa menjadi visual

| Peristiwa yang diturunkan dari gerak | Perubahan visual | Larangan |
|---|---|---|
| Langkah berlanjut | Sapuan memanjang mengikuti gerak aktor; serat tipis di tepi | Garis mengejar kaki yang sedang swing |
| Melambat / hesitation | Ujung sedikit lebih penuh, tetap mempertahankan arah | Blob membesar terus saat diam |
| Berbelok / pivot | Taper dan pembelokan mengikuti kurva; bisa ada tekanan sesaat | Sudut tajam jadi tumpukan garis acak |
| Berhenti | Satu deposit akhir kecil, kemudian kanvas stabil | Mengulang cap setiap frame |
| Berjalan cepat | Serat lebih kering, ujung meruncing | Stroke terputus saat pose tetap valid |
| Crossing A/B | Dua warna/layer tetap berbeda; identity yang ambigu memutus stroke | Teleport, pergantian warna aktor mendadak |

Jangan memakai istilah “tekanan kaki terukur”. Variasi ketebalan dan tinta dihitung dari fitur gerak sebagai **respons artistik**.

## 6. Acceptance criteria

**AC-01 — Satu lukisan:** dalam Gabung ada satu kanvas terlihat dan satu raster final; tidak ada dua kartu putih kecil.

**AC-02 — Pertukaran urutan:** pada posisi tumpang tindih, preset depan/belakang mengubah piksel final tanpa mengubah posisi tracking, riwayat atau clock.

**AC-03 — Warna per channel:** Aktor A/B masing-masing mempunyai Path, Footprint dan Upper; mengganti warna memperbarui jejak lama di layar tanpa clear.

**AC-04 — Integritas koordinat:** source dengan camera-to-floor valid menghasilkan komposisi semua layer dalam kanvas yang sama; tanpa kalibrasi menampilkan label estimasi 2D. Upper tidak diklaim memiliki kedalaman 3D.

**AC-05 — Komposit konsisten:** PNG gabungan sama dengan fullscreen, Map preview, dan clean Perform raster pada frame yang sama, sebelum warp projector. Tidak ada double warp.

**AC-06 — Waktu dan identitas:** source switch, MP4 seek/pause, crossing, epoch change dan reconnect tidak menyambung path yang salah. Clear per layer tidak menghapus layer lain.

**AC-07 — Empty states:** ketika hanya data kaki tersedia, FOOT tetap tergambar; Upper kosong dan status di luar output.

**AC-08 — Artistik terukur:** dua referensi video — lateral/pivot dan crossing — menunjukkan taper, perubahan bobot yang masuk akal, serta garis yang tidak bergetar ketika aktor diam. Hasil QA visual dibandingkan dengan video sumber.

**AC-09 — Keselamatan:** Blackout, gate QA, dan kontrol proyektor tidak berubah. Output tidak pernah mengandung kontrol studio.

**AC-10 — Stabilitas:** build, unit, visual/pixel test, browser E2E pada MP4, webcam/HP mock dan simulator lulus sebelum produksi.

## 7. Backlog P0–P2

| Issue ID | Prioritas | Pekerjaan |
|---|---|---|
| DTV2-01 | P0 | Kontrak tiga channel + atlas transparan per aktor (Foot Path, Footprints, Upper) |
| DTV2-02 | P0 | Single Stage Monitor + mode Gabung / Pisah Debug |
| DTV2-03 | P0 | Layer Compositor dengan dua preset urutan; output satu raster untuk Compose → Map → Perform |
| DTV2-04 | P0 | Palet A/B per channel, termasuk perubahan warna historis |
| DTV2-05 | P0 | Tes komposit piksel, blackout dan regression alur lama |
| DTV2-06 | P1 | Transform dan anchor Upper relatif ke posisi aktor di stage |
| DTV2-07 | P1 | Sumi Brush V2: motion-driven width, taper, dry edges, stop/pivot |
| DTV2-08 | P1 | Ringkas inspector UI: Lapisan, Warna, Sapuan, Jejak; clear/export |
| DTV2-09 | P1 | Source invalidation MP4/webcam/HP, crossing, replay dan no-upper state |
| DTV2-10 | P2 | Preset artistik, blend mode opsional dan manual layer order |
| DTV2-11 | P2 | Benchmark FPS/memory panggung serta QA output projector |

## 8. Yang tidak dibangun pada V2

- Depth 3D kepala dan bahu dari satu kamera biasa.
- AI generatif melukis garis acak di luar gerak aktor.
- Playback musik, perubahan source adapter, atau UI Track/Map baru.
- Perubahan workflow Vercel/Pages sebelum QA.

## 9. Definition of Done

- Satu kanvas utama dan urutan lapisan bekerja sesuai preset.
- Warna jalur, tapak dan gesture dapat diubah terpisah untuk A/B, termasuk jejak yang sudah digambar.
- Line + Footprint + Upper tergabung pada satu raster bersih yang dikirim ke Map dan Perform.
- Tracking, replay MP4, fullscreen, export, blackout dan simulator tidak regresi.
- Uji browser + pixel fixtures lulus; hasil pengujian kamera fisik dicatat terpisah.
- Developer dapat mengikuti kontrak pada dokumen arsitektur teknis tanpa menambah detector atau warp kedua.

## 10. Referensi kode yang diaudit

- src/studio/v3/DualTraceCanvasHost.tsx
- src/studio/v3/DualTraceControls.tsx
- src/studio/v3/LineTrailsV3.tsx
- src/footprints/dual-trace/UpperGestureInkRenderer.ts
- src/footprints/dual-trace/UpperGestureAnchorAdapter.ts
- src/footprints/lines/v3/PersistentPathStore.ts
- src/footprints/lines/v3/PainterlyCanvasRenderer.ts
- src/footprints/lines/v3/SumiRibbonMeshBuilder.ts
- src/footprints/lines/v3/DirectionalInkPainter.ts
- src/studio/v3/SurfaceComposer.tsx
- tests/dual-trace-v1.test.ts; e2e/dual-trace.spec.mjs

**Status dokumen:** PRD untuk review dan implementasi tahap berikutnya; belum mengubah renderer atau melakukan deploy.
