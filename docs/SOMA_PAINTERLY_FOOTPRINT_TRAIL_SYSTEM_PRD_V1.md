# SOMA — Painterly Footprint & Trail System
## Product Requirements Document (PRD v1.0)

**Status:** PROPOSED — spesifikasi produk; belum diimplementasikan  
**Tanggal:** 23 November 2026  
**Area produk:** Stage 1 → Compose → Garis BETA / Painterly  
**Rilis sasaran:** P0 footprint + decay + kanvas putih; P1 material artistik; P2 eksperimen shader  
**Sumber acuan:** PRD Garis BETA V3/V3.1, implementasi terkini `LineTrailsV3.tsx`, `TrajectoryRenderer.ts`, `DualFootTrajectoryEngine.ts`, `FootprintBrushEngine.ts`, `authenticFootGeometry.ts`, dan `FootMotionEventV2.ts`.  
**Terkait:** [PRD V3.1 Actor Color & Organic Stroke](./SOMA_GARIS_BETA_V3_1_ACTOR_COLOR_ORGANIC_STROKE_PRD.md)

> **Janji produk:** Pada bidang putih seperti kanvas, langkah setiap aktor meninggalkan **bentuk tapak** yang dapat dikenali dan **garis perjalanan** yang luwes. Kedua bekas memudar dengan waktu masing-masing. Pengguna melihat arah jalan, jeda, dan pijakan yang diperkirakan, dengan identitas warna aktor tetap jelas.

## 1. Masalah yang hendak diselesaikan

Pada V3.1, kanvas menampilkan garis merah/arang yang lebih luwes, tetapi **tapak kaki tidak hadir sebagai objek visual utama**. Beberapa lintasan bertumpuk dan membentuk coretan kecil di bagian bawah kanvas. Kesan akhir lebih dekat ke plotting koordinat dibanding sapuan tinta yang tertinggal di bidang putih.

**Bukti dari kode saat PRD disusun:**
- `LineTrailsV3Stage` memanggil `paintTrajectory()` yang menggambar jalur, **tanpa layer footprint stamp V3.1**.
- `TrajectoryRenderer.ts` memiliki `decay/lifeMs` untuk lintasan, belum ada kebijakan lifetime tapak yang independen.
- SOMA sudah memiliki `paintAuthenticFootprint()` untuk siluet kiri/kanan dengan lengkung telapak, tumit, dan jari; `FootprintBrushEngine` mendukung cap peristiwa kontak dan brush di V2. Keduanya bisa digunakan ulang, bukan dibuat dari nol.
- `FootMotionEventV2` membedakan `video-estimate`, `detected-estimate`, `simulated`, dan `unverified`. Ini perlu dipertahankan pada cap V3.1.
- Komposisi lain di SOMA sudah menggunakan material shader berbasis PixiJS. Teknologi itu menjadi opsi lanjutan setelah engine dasar stabil.

Tidak ada klaim bahwa video MP4 monokular dapat menentukan tekanan atau kontak fisik lantai dengan akurat. Posisi kaki dari kamera biasa tetap ditandai sebagai **estimasi posisi gambar 2D** sampai ada pemetaan dan verifikasi terpisah.

## 2. Sasaran dan ruang lingkup

1. Menampilkan **dua lapisan bersamaan:** bentuk tapak dan garis lintasan.
2. Mengizinkan durasi fade yang berbeda, bisa diatur dalam **detik** tanpa mengubah data tracking.
3. Menjaga warna **Aktor A = merah `#E44F32`** dan **Aktor B = arang `#242424`**, termasuk override per kaki yang sudah tersedia.
4. Membuat kanvas tetap **putih tulang `#F5F5F2`**, bidang tenang, kontras tinggi, tanpa HUD pada fullscreen.
5. Menyediakan tiga material terbatas: **Tinta** (default), **Arang**, **Pigmen**. Ketiganya menumpang pada geometri yang sama.
6. Menghindari cap berulang setiap frame, tapak palsu saat tracking hilang, penyambungan lintasan saat MP4 seek, dan jejak yang melompat antaraktor.
7. Menjaga Camera Hub, Track, F3, Map, Perform, dan blackout proyektor seperti saat ini.

**Di luar P0:** memindahkan tracking ke Hydra, menafsirkan tekanan kaki, merekonstruksi lantai 3D dari satu kamera, memberi hak output fisik melalui efek visual, dan mengubah routing kamera.

## 3. Prinsip visual

**Referensi karakter:** jejak tinta/arang/pigmen yang terserap tipis pada kertas atau kanvas putih, terlihat seperti kerja tangan. Warna dipakai hemat. Tekstur mengikuti bentuk jejak, bukan menjadi latar dekoratif.

| Lapisan | Fungsi | Aturan |
| --- | --- | --- |
| Canvas | Permukaan putih tenang | `#F5F5F2`; noise serat opsional sangat samar, tidak bergeser bersama kaki |
| Footprint | Bentuk pijakan/tapak visual | Anatomi kiri/kanan terbaca, orientasi mengikuti heel–toe bila valid |
| Trail | Arah perpindahan | Luwes default, tidak melompati gap; lebih tipis dan memudar lebih cepat |
| Pigment treatment | Permukaan tinta/arang | Grain, dry edge, dan transparansi *di dalam mask jejak*; tidak menggeser pusat/arah |
| QA overlay | Pemeriksaan sumber | Hanya di editor saat dibuka, tidak masuk fullscreen secara default |

**Larangan visual:** glow/neon, feedback tak terkendali, blur seluruh layar, splatter acak di luar jejak, cap di setiap frame, atau tekstur yang menutupi dua warna aktor.

## 4. Dua bentuk tapak yang perlu dibedakan

### 4.1. Kepala tapak (*live sole head*) — P0

Saat kaki terdeteksi, tampilkan **satu siluet tapak bergerak untuk setiap kaki yang valid**, berpusat pada observasi terakhir, mengikuti orientasi heel–toe yang valid. Ini alat baca posisi kaki; tidak menumpuk cap permanen di setiap frame.

- Default opacity lebih rendah daripada cap peristiwa, misalnya `0.35`.
- Menggunakan ukuran display, bukan ukuran kaki fisik yang diklaim terkalibrasi.
- Jika pose kaki hilang, kepala tapak memudar segera dalam waktu transisi singkat (usulan 250–450 ms), lalu hilang; tidak meluncur ke prediksi posisi berikutnya.
- Khusus MP4, label sumber tetap **“Tapak terpantau · estimasi video 2D”**.

### 4.2. Cap langkah (*footprint impression*) — P0

Cap menetap sesaat di lokasi yang punya **peristiwa pijakan yang layak** lalu berkurang opacity hingga hilang.

Urutan sumber event:
1. **Prioritas 1:** `FootMotionEventV2` jenis `contact` yang lolos `footMotionCanStamp()`. Simpan ID peristiwa, aktor, kaki, orientasi, basis koordinat, confidence, dan jenis verification.
2. **Prioritas 2 untuk MP4 / webcam yang belum menyediakan event kontak:** estimasi artistik dari urutan posisi kaki yang valid, dengan syarat perpindahan melambat, stabil selama beberapa sampel, kemudian perubahan fase cukup jelas. Beri label **“Cap estimasi video”**, bukan kontak fisik. Deduplicate dengan cooldown per kaki/aktor dan jangan membuat cap saat data ambigu, lompatan, atau inference stale. Parameter contoh dimulai dari *dwell* 120–250 ms serta jarak minimum antarcap yang diukur pada fixture; bukan angka final.
3. **Fallback:** jika kedua jalur tidak memberi bukti memadai, tampilkan hanya kepala tapak dan lintasan; **jangan mencetak cap baru**.

Untuk demo gunakan event `simulated` dengan label DEMO. Tidak ada satu pun cap yang membuka otorisasi proyektor fisik.

**Ketelitian orientasi:** gunakan heel→toe dari satu frame valid jika tersedia. Saat hanya ankle tersedia, tampilkan tapak transparan tanpa rotasi baru atau tahan orientasi terakhir pada segmen yang sama; jangan menyimpulkan heading dari noise lintasan saja.

## 5. Aturan durasi dan fading

Dua clock visual independen; keduanya dapat diatur operator tanpa mengubah riwayat sumber.

| Elemen | Default | Kontrol | Kebijakan |
| --- | --- | --- | --- |
| **Cap footprint** | **8 detik** | Tetap, atau slider 1–30 detik | Bertahan jelas sebentar, kemudian berangsur hilang |
| **Garis lintasan** | **4 detik** | Tetap, atau slider 1–30 detik | Hilang lebih cepat agar kanvas tidak penuh |
| Kepala tapak terpantau | Sampel valid terakhir | Tidak masuk slider cap | Hilang cepat saat kaki tidak terdeteksi |
| Material kanvas | Tetap | Putih default | Tidak ikut decay dan tidak bergerak |

**Fungsi opacity usulan:** saat event muncul, opacity awal `alpha0` (mis. footprint 0.8, trail 0.7). Bertahan sampai 15% masa hidup, lalu menurun halus ke 0 tepat pada detik yang dipilih. Tidak memperpanjang masa hidup saat frame yang sama dirender ulang. Bentuk dan titik jejak tetap stabil sepanjang fade.

**Clock kontrak:**
- Kamera / HP live: usia jejak dihitung dari clock monotonic sesi, menggunakan waktu tampilan yang sama dengan renderer.
- MP4: usia jejak dihitung dari **waktu media video**; **pause membekukan decay**, resume melanjutkan, seek/loop/klip baru memisahkan epoch dan tidak menyambung jejak lama. Perilaku clear-on-seek default; opsi history replay membutuhkan keputusan lanjutan.
- Perubahan durasi diterapkan pada jejak yang masih aktif menurut timestamp asli; tidak membuat cap baru.
- Saat mode **Tetap**, batasi jumlah cap dan titik yang disimpan agar sesi 30 menit tetap aman; pembersihan tertua diperbolehkan dengan indikator batas yang jelas.
- Tombol **Bersihkan** menghapus cap dan garis dari tampilan/sesi Painterly bersama-sama; frame valid berikutnya dapat memulai jejak baru.

## 6. Material preset

| Preset | Bentuk | Karakter | Intensitas awal |
| --- | --- | --- | --- |
| **Tinta — default** | Tapak dengan ujung jari, garis sapuan halus | Serapan tipis, pinggir sedikit mengembang, pewarnaan rata dengan variasi alpha halus | Rendah |
| **Arang** | Tapak berbintik halus, garis lebih kering | Butir arang terputus kecil di dalam mask, tepi kasar tanpa menghilangkan bentuk telapak | Sedang |
| **Pigmen** | Jejak transparan beberapa kepadatan | Warna bertumpuk saat aktor mengulang jalur; pusat tapak tetap terbaca | Rendah |

Warna preset mengikuti warna aktor; jangan mengganti A/B menjadi warna preset. Tombol preset hanya memilih material. `Presisi/Luwes/Lukis` dari V3.1 tetap menjadi **karakter garis** pada opsi lanjutan; pilihan material tidak mengubah identitas waktu, arah, atau gate observasi.

**Tekstur deterministik:** bentuk grain dari `eventId/strokeId + seed` yang tetap selama umur jejak. Grain tidak digenerate acak pada setiap frame (mencegah flicker). Pertahankan pusat siluet, tepi jari, dan medial arch. Bandingkan setiap preset pada latar putih dan proyeksi hitam-putih.

## 7. Panel operator yang lebih ringkas

```text
Garis · Painterly                      V1 BETA
● MP4 · 2 kaki terbaca / analisis tertunda

Material       [ Tinta ] [ Arang ] [ Pigmen ]

Jejak
  [✓] Tapak kaki      Hilang [────●────] 8 dtk
  [✓] Garis lintasan  Hilang [──●──────] 4 dtk

Aktor A        [ Merah ]             [✓]
Aktor B        [ Hitam arang ]       [✓]

[Bersihkan]                       [Coba Demo]

▸ Detail kaki
▸ Karakter garis (Presisi / Luwes / Lukis)
▸ Periksa sumber / QA
▸ Pengaturan lanjutan
```

- Tampilkan **satu** penanda status sumber. Hindari pengulangan istilah “jejak”, “footprint”, dan “material” di beberapa kontrol.
- Slider fade memperlihatkan angka detik saat digeser; saat disetel Tetap, slider nonaktif dengan status jelas. Preset cepat 4/8/20 detik boleh ditempatkan dalam popover.
- Pada 1P hanya Aktor A muncul; pada 2P tampil A dan B. Per kaki tersimpan di Detail kaki.
- Kanvas putih memegang ruang terbesar; operator dapat fullscreen dengan satu tombol.
- Debug, input pose, dan panel teknis tidak ikut ke output fullscreen. Seluruh kontrol tetap dapat dibaca pada lebar laptop 1366 px.
- **Jika tapak tidak muncul**, UI menampilkan alasan spesifik: “Kaki belum terbaca”, “Belum ada langkah terestimasi”, atau “Event kontak tidak valid”. Jangan menampilkan kontrol aktif seolah cap sudah berhasil.

## 8. Alur pengguna

### Latihan satu aktor dengan MP4
1. Operator memilih MP4 di Track; melihat status pose/kedua kaki.
2. Masuk Compose → Garis BETA → Painterly. Kanvas putih muncul dengan jejak aktor A merah.
3. Dua kepala tapak mengikuti kaki teramati. Saat peristiwa langkah valid, muncul cap anatomis.
4. Garis menipis lalu hilang sekitar 4 detik; cap kaki bertahan lebih lama, sekitar 8 detik.
5. Pause MP4 menahan keadaan kanvas. Seek memulai epoch baru. Fullscreen memperlihatkan kanvas bersih.

### Dua aktor dengan kamera
1. Tracking valid membaca A/B beserta kaki masing-masing.
2. Garis dan tapak A merah; B arang. Jumlah cap tiap aktor boleh berbeda.
3. Saat berpapasan, identitas yang ambigu menghentikan cap pada kaki terkait; jejak yang sudah tercatat memudar normal.
4. Operator memilih Arang atau Pigmen sambil bergerak. Seluruh tapak yang terlihat berubah material secara konsisten, **tanpa merelokasi posisi sejarah**.

### Latihan tanpa event kontak
1. Pose dan kaki terlihat; kepala tapak bergerak di kanvas serta garis lintasan tampil.
2. Status menyatakan cap langkah belum tersedia/baru estimasi.
3. Tidak dibuat cap fiktif setiap frame untuk mengisi ruang kosong.

## 9. Arsitektur produk yang diusulkan

```text
Track / MP4 / HP (existing source & pose)
     → SourceFrameNormalizer / FootPositionResolver
     → DualFootTrajectoryEngine (A/B × Kiri/Kanan)
          ├─ TrajectoryRenderer V3.1 → material stroke → decay garis
          ├─ latest valid foot samples → live sole head
          └─ FootMotionEventV2 / optional video step-estimate gate
               → Footprint Impression Store (new, dedup & bounded)
               → paintAuthenticFootprint + seeded pigment mask
               → decay footprint
     → White Canvas Compositor
          ├─ Stage Monitor preview
          └─ Fullscreen clean output (same composition, viewport-scaled)
```

**P0 renderer:** gunakan Canvas2D SOMA yang sudah ada, menggabungkan footprint mask, renderer jalur, dan decay dalam **satu pipeline compositor**. Jangan membuka detektor/stream kedua atau mengambil video dari sumber lain. Fungsi `paintAuthenticFootprint()` boleh digunakan ulang; integrasikan `FootprintBrushEngine` dengan adapter V3 bila event model cocok, atau buat store khusus untuk menjaga kontrak stamp vs sole head.

**P1 material:** boleh memakai offscreen canvas/mask compositing untuk grain, bleed halus, dan varian opacity. Pakai cache seed serta rasio ukuran stamp yang konsisten di preview/fullscreen. Existing PixiJS/WebGL2 material pass dapat diuji terpisah jika Canvas2D tidak memenuhi budget paint.

**P2 Hydra:** eksperimen post-processing berbasis feature flag setelah P0/P1 teruji; input berupa **hasil komposisi raster**. Hydra tidak boleh menentukan koordinat, jumlah cap, jenis kontak, posisi jari, cut reason, atau decay sumber. Default produksi tetap renderer SOMA. Tidak menambah dependensi Hydra pada P0.

### Penyimpanan event cap — kontrak minimal

```ts
type Impression = {
  id: string; sessionId: string; generation: number;
  source: 'camera'|'phone'|'video'|'simulator';
  actorId: string; foot: 'left'|'right';
  x: number; y: number; headingRad?: number;
  coordinateBasis: 'image-2d'|'calibrated-estimate'|'simulated';
  provenance: 'detected-estimate'|'video-estimate'|'simulated';
  confidence: number; atSourceMs: number;
  materialSeed: number; eventKind: 'contact-event'|'estimated-step';
};
```

- Dedup berdasarkan `eventId` jika ada, atau `sourceSession + generation + actor + foot + temporal step window` untuk estimasi.
- Stamps dari epoch lama tidak dihubungkan ke epoch baru.
- Pisahkan storage impression vs sole head vs trajectory; semua dibatasi ukuran dan reset sesuai sumber.
- Jika heading/landmark hilang, tampilkan fallback yang jelas di QA, bukan bentuk sepatu random.

## 10. Ketergantungan & migrasi

- Tambah submode **Painterly** di dalam Garis BETA V3.1, atau jadikan Painterly tampilan default setelah QA; pertahankan Presisi sebagai baseline tes.
- Konversi `V3Settings.decay/lifeMs` lama ke **trailLifetime**, dan tambah **footprintLifetime**. Jangan mengubah preset V3.1 secara diam-diam; gunakan skema versi baru dan migrasi eksplisit.
- Gunakan `ActorPaletteResolver` untuk garis, sole head, dan cap yang sama; override per kaki tetap berfungsi.
- Suplai `motionEvents` existing ke Painterly jika tersedia; saat tidak tersedia, gunakan gate estimasi dengan label, lalu fallback kepala tapak.
- Jangan mengubah `footMotionAuthorizesPhysicalOutput()`, router F3, atau sistem blackout Map/Perform.
- Uji konten panggung dengan MP4 dan kamera nyata sebelum memindahkan default operator dari V3.1.

## 11. Acceptance criteria

| ID | Pengujian | Hasil wajib |
| --- | --- | --- |
| PF-01 | Pose 1P valid dua kaki | Dua kepala tapak anatomis bergerak mengikuti kaki; tidak tercetak cap setiap frame |
| PF-02 | Event kontak eligible A-kiri | Satu cap kiri muncul di koordinat event, heading sesuai metadata, tanpa duplikasi |
| PF-03 | MP4 tidak menyediakan event kontak | Bisa muncul cap berlabel estimasi setelah gate temporal; jika gate gagal, hanya sole head + garis |
| PF-04 | 2P crossing, satu kaki hilang | Cap A/B tidak tertukar; kaki yang hilang berhenti menghasilkan cap, kaki lain tetap berjalan |
| PF-05 | Durasi tapak 8 dtk | Pada source clock 8 dtk sejak cap, alpha mencapai 0; tidak diperpanjang redraw |
| PF-06 | Durasi garis 4 dtk | Garis lebih cepat hilang dari cap; perubahan durasi tak mengubah source history |
| PF-07 | Ubah tapak 3→12 dtk dan garis 4→20 dtk | Lifetime keduanya berubah mandiri dan terbaca di panel |
| PF-08 | MP4 pause/resume/seek/loop/replace clip | Pause membekukan fade, resume lanjut, seek tidak menjembatani/menampilkan stamp epoch sebelumnya |
| PF-09 | Ganti warna Aktor A | Tapak dan garis kedua kaki A ikut berubah; B tidak berubah |
| PF-10 | Pilih Tinta / Arang / Pigmen | Posisi, jumlah cap, identitas aktor, cut reason, dan trajectory tetap identik |
| PF-11 | Grain dan material selama 10 dtk | Tekstur stabil per event; tidak berkedip setiap frame; pusat footprint tetap terjaga |
| PF-12 | Fullscreen, ukuran layar berbeda | Preview/fullscreen sama secara geometris, bersih dari UI dan debug |
| PF-13 | Kaki berhenti, inference stale, identitas ambigu | Tidak muncul spam cap, interpolasi palsu, atau sambungan baru melintasi cut |
| PF-14 | White canvas dengan latar gelap nonaktif | Kanvas tetap putih tulang dan kedua warna aktor terbaca; tekstur tidak memenuhi seluruh layar |
| PF-15 | Blackout dan navigasi Track/Map/Perform/F3 | Output terjaga fail-closed; tidak ada stream baru atau regresi fungsi lain |
| PF-16 | Sesi 30 menit, 2P | Buffer cap, cache grain dan sejarah garis bounded; tidak terjadi pertumbuhan tanpa batas |
| PF-17 | Operator memilih Presisi | Semua titik valid dan segmen pendek dapat diaudit; visual Painterly tidak menghapus jejak sumber |

### Ukuran keberhasilan awal — target, belum diukur

- **0** cap terduplikasi untuk satu event eligible; **0** cap pada frame identitas ambigu atau sumber stale.
- **0** penambahan cap/garis selama MP4 pause ketika frame sumber tidak berubah.
- Durasi memudar mencapai nol dengan toleransi satu frame render setelah target source time (pada sumber frame yang tersedia).
- P95 biaya renderer ≤ 16 ms/frame pada mesin QA 1600×900 untuk 2P setelah efek P0, dengan source-inference latency dilaporkan terpisah.
- Deviasi pusat cap terhadap koordinat sumber ≤ 5 px pada fixture sintetis dengan transform viewport diketahui.
- QA visual harus membandingkan screenshot P0 vs V3.1: **tapak terbaca dari jarak tampilan panggung**, arah jalan jelas, kanvas tidak penuh coretan dalam sesi 60–120 detik dengan durasi default.
- Rekam perangkat, resolusi, tipe sumber, sampel FPS dan hasil aktual; jangan menyebut angka target sebagai performa terukur.

## 12. Urutan implementasi dan gerbang rilis

| Tahap | Implementasi | Exit gate |
| --- | --- | --- |
| **P0-A — Footprint visibility** | Sole head 1P/2P, sinkron dari Track/MP4, stamp store eligible dan label estimasi | PF-01–04 |
| **P0-B — Independent decay** | Lifetime cap/garis, source clock, pause/seek, slider dan preset | PF-05–08 |
| **P0-C — White canvas UX** | Panel ringkas, actor palette, preview/fullscreen, Reset dan QA info | PF-09, 12, 14–15 |
| **P1 — Painterly material** | Tinta/Arang/Pigmen mask terkontrol, deterministic grain, caching, texture settings | PF-10–11, 16 |
| **P2 — R&D** | Uji opsi PixiJS/Hydra post pass melalui feature flag | Tidak masuk production sampai parity + budget lolos |

**Gerbang QA:** unit tests geometri/event/fade/clock; E2E Chrome laptop 1366×768 dan desktop 1440×900; golden screenshots tiga material pada 1P/2P; uji MP4 pause/seek; uji Camera Hub/F3/Map/Perform; video kaki nyata, gerak menyamping, berputar, dan crossing; 30-menit soak dan blackout.

**Rollback:** pertahankan renderer Garis V3.1 sebagai pilihan **Lintasan klasik** selama evaluasi Painterly. Tidak melakukan deploy Vercel/Pages hanya dari dokumen ini. Perubahan stage/projector memerlukan QA terpisah.

## 13. Definisi selesai

- [ ] Tapak anatomis jelas pada kanvas putih ketika kaki valid.
- [ ] Cap hasil kontak dan cap estimasi diberi provenance yang benar; tidak spam frame.
- [ ] Durasi footprint dan lintasan terpisah, dapat diatur dalam detik, bekerja pada MP4/live dan fullscreen.
- [ ] Aktor A merah dan B arang pada garis/tapak; override kaki tetap ada.
- [ ] Material Tinta/Arang/Pigmen terbaca sebagai permukaan berbeda, dengan geometri tetap akurat.
- [ ] Perbandingan screenshot dan video panggung menunjukkan bentuk tapak, arah jalan, dan fade secara jelas.
- [ ] Unit test, browser QA, regresi V2/V3.1, blackout, dan soak test lulus.
- [ ] Status produk baru dinyatakan IMPLEMENTED setelah kode, review, bukti QA, dan deploy terverifikasi.

## 14. Keputusan produk

**Pakai renderer SOMA yang ada untuk P0**: sambungkan bentuk tapak yang sudah tersedia ke trajectory V3.1, pisahkan durasi tapak/garis, dan jaga kanvas putih. Keindahan berasal dari bentuk anatomis, penumpukan warna yang terbatas, tekstur dalam mask, serta ritme fade—tanpa melepas akurasi pelacakan.

**Hydra tetap pilihan R&D sesudah P0/P1**; tidak menjadi dependensi inti untuk menampilkan tapak kaki dan mengatur waktu hilangnya jejak.
