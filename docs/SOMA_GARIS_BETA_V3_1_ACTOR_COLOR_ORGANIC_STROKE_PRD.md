# SOMA — Garis BETA V3.1
## PRD: Actor Color & Organic Stroke

**Status:** PROPOSED — spesifikasi UI/rendering; belum diimplementasikan  
**Tanggal:** 23 November 2026  
**Area:** Stage 1 → Compose → Garis BETA  
**Ruang lingkup:** pengelompokan warna per aktor, kualitas garis, simplifikasi panel, pengujian keterbacaan.  
**Landasan:** implementasi Garis BETA V3 di \`src/studio/v3/LineTrailsV3.tsx\`, \`src/footprints/lines/v3/TrajectoryRenderer.ts\`, dan \`DualFootTrajectoryEngine.ts\`.  
**Terkait:** [PRD V3](./SOMA_GARIS_BETA_V3_DUAL_FOOT_TRAJECTORY_PRD.md) · [Technical Architecture V3](./SOMA_GARIS_BETA_V3_TECHNICAL_ARCHITECTURE.md).

> **Sasaran:** penonton mengikuti perjalanan **Aktor A** dan **Aktor B** dari jejak garis yang luwes. Kaki kiri dan kanan tetap terlacak terpisah, tetapi identitas warna utama mengikuti aktor. Garis berkarakter seperti sapuan tangan tanpa memalsukan arah, titik belok, diam, atau terputusnya pelacakan.

---

## 1. Masalah dari V3 saat ini

1. **Warna dikunci per kaki.** \`V3Settings.colors.left/right\` dan \`paintOne()\` mengambil warna dari \`stroke.foot\`. Aktor A dan B akhirnya berbagi dua warna yang sama, padahal penonton perlu membedakan dua tubuh di panggung.
2. **Rendering garis terlalu kaku.** \`TrajectoryRenderer.ts\` menggambar setiap segmen menggunakan \`moveTo/lineTo\` lurus. Hasil mengikuti data, tetapi pada jalur yang banyak perubahan kecil terlihat seperti plot koordinat.
3. **Serpihan garis.** Screenshot V3 menunjukkan 57 titik dan 18 segmen, dengan status **\`MP4 · analisis tertunda\` / \`stale-frame\`**. Banyaknya putus kemungkinan berkaitan dengan ketersediaan frame yang lolos gate, selain cara render. **Wajib benahi observabilitas frame terlebih dahulu**; menyembunyikan serpihan saja tidak menyelesaikan penyebabnya.
4. **Panel memprioritaskan kaki.** Kontrol “Kaki kiri” dan “Kaki kanan” tampil sebagai warna utama; untuk operator 2P, struktur yang lebih tepat dimulai dari Aktor A dan Aktor B.

**Keputusan V3.1:** data tracking V3 tetap sumber geometri; lapisan presentasi memutuskan warna per aktor dan karakter sapuan. Kaki kiri/kanan memiliki jalur data independen dan dapat di-custom melalui pengaturan lanjutan.

## 2. Pengalaman utama

### Default

- **Aktor A:** merah \`#E44F32\` — kedua kaki menggunakan warna ini.
- **Aktor B:** hitam arang \`#242424\` pada latar terang; pada latar gelap warna tampil otomatis sebagai abu terang \`#D8D6D0\` agar tetap terbaca.
- **Kaki kiri dan kanan:** warna utama sama menurut aktornya. Pembeda sekunder, jika diaktifkan: opacity, bentuk ujung, atau variasi dash yang sangat ringan; default **dua garis solid**.
- **Karakter garis default:** **Luwes**. Mode **Presisi** tersedia untuk QA; **Lukis** untuk eksplorasi visual.
- **Latar default:** putih tulang seperti V3 saat ini.
- **Jejak:** durasi Tetap / 8 detik / 20 detik; warna/karakter tidak mengubah riwayat mentah.

### Panel kanan — default ringkas

\`\`\`text
Garis · Lintasan                          V3.1

● MP4 / Kamera — status tracking
Aktor A                      [Merah]   [Tampil]
Aktor B                      [Hitam]   [Tampil]
Karakter garis    [Presisi] [Luwes] [Lukis]
Ketebalan                       ━━●━━ 3 px
Durasi              [Tetap] [8 dtk] [20 dtk]
[Bersihkan]                          [Coba Demo]

▸ Detail kaki
▸ Periksa jalur
▸ Pengaturan lanjutan
\`\`\`

- Pada 1P hanya **Aktor A** muncul sebagai kontrol utama. Identitas \`performer-1\` harus dipetakan konsisten ke palet A; jangan merujuk warna default kaki kiri/kanan.
- Pada 2P kedua aktor tampil; \`Aktor B\` tidak boleh terlihat aktif jika sumber hanya mengandung satu performer.
- \`Detail kaki\`: override kiri/kanan per aktor, reset ke warna aktor, tampil/sembunyi per kaki, dash/opacity bila diperlukan. Seluruh override default **off**.
- \`Periksa jalur\`: raw vs processed, source time, stale/gap/cut reason, actor, foot, jumlah segmen. Inspector tidak memenuhi layar utama.
- \`Pengaturan lanjutan\`: latar, overlay kamera/skeleton, rollback V2, dan parameter artistik. Mode Pijakan tetap P1 disabled sampai gate kontak siap.
- Perubahan pilihan memberi umpan balik langsung pada preview; tidak menghapus trajectory history.

## 3. Tiga karakter garis

| Mode | Tujuan | Pengolahan |
| --- | --- | --- |
| **Presisi** | Debug dan pembuktian jalur | Polyline observasi valid; sudut dan gap tetap apa adanya; tidak memakai efek artistik |
| **Luwes** *(default)* | Garis terasa mengalir seperti jejak tangan | Resampling lokal + smoothing terbatas dengan *corner guard*, taper sangat ringan; pusat garis tetap dekat koordinat valid; tidak ada blur/glow |
| **Lukis** | Sapuan lebih ekspresif | Semua batas geometri Luwes tetap berlaku; variasi lebar/opacity mengikuti perubahan kecepatan 2D yang diukur, tekstur tipis dan taper; tanpa klaim tekanan telapak aktual |

### Larangan untuk seluruh mode

- Tidak menambahkan titik jalan yang tidak pernah teramati; interpolasi hanya **di dalam** segmen dengan dua observasi valid, bukan melintasi tracking loss.
- Tidak menghubungkan kaki kiri ke kanan, Aktor A ke B, atau dua epoch MP4 yang berbeda.
- Tidak membuat garis memanjang saat kedua kaki diam, pause, atau source frame duplikat.
- Tidak menggeser puncak belokan tajam hanya demi keluwesan; tidak boleh overshoot ke luar koridor jalur teramati.
- Tidak menggunakan jitter acak yang mengubah pusat lintasan; karakter tekstur cukup pada lebar/alpha relatif terhadap centerline.

### Rancangan algoritme “Luwes”

1. Baca daftar \`V3Stroke.points\` yang sudah diterima oleh \`DualFootTrajectoryEngine\` **tanpa memodifikasi data raw**.
2. Hilangkan jitter sub-ambang yang tidak menunjukkan perpindahan; jangan hapus titik penentu belokan atau jeda.
3. Resample **di antara pasangan titik valid pada segmen yang sama** untuk spacing visual stabil.
4. Gunakan kurva interpolasi **lokal dan dibatasi** (mis. centripetal Catmull–Rom, atau kurva Bézier dengan kontrol terbatas). Implementasi dipilih setelah dibandingkan dengan fixture; hindari Chaikin berulang yang menggerus sudut tajam.
5. **Corner guard:** titik dengan perubahan arah mendadak atau jeda harus tetap menjadi simpul penting. Pada 90° atau belok balik, kurangi smoothing hingga mendekati polyline asli.
6. Jika hasil kurva terlalu jauh dari ruas yang teramati, turunkan tension atau kembali ke ruas lurus. Tidak boleh menyambungkan cut.
7. Taper awal/ujung ringan, berbasis panjang arclength dan hanya memengaruhi visual, bukan posisi.
8. Cache hasil presentasi per stroke/revision; jangan hitung ulang seluruh 30 menit jejak pada setiap \`requestAnimationFrame\`.

### “Lukis” secara bertanggung jawab

- Ketebalan dapat berubah sedikit menurut **kecepatan posisi pada gambar**; jangan menyebutnya tekanan kaki.
- Kecepatan dihitung dari frame source time yang sama; clamp lonjakan akibat jitter atau perubahan playbackRate.
- Tekstur ditempatkan **di dalam batas tebal stroke**; pusat garis tetap sama dengan Luwes.
- Tidak ada blur/glow sebagai default; operator dapat menyalakan tekstur sebagai pengaturan lanjutan.

## 4. Serpihan, observasi stale, dan fallback

**P0-A, sebelum polish:** ukur penyebab 18 segmen pada screenshot. Inspector menunjukkan:
- \`source frame time\` vs \`media.currentTime\`; status seek/pause/lag;
- frekuensi frame valid, jumlah reject dan cut reason \`stale-frame\`, \`time-gap\`, \`missing-foot\`;
- \`actorId\`, \`foot\`, age frame, jumlah titik per segmen;
- apakah engine terus memutus segmen untuk snapshot video yang terlambat tetapi sumber masih memutar video.

**Tindakan visual P0-B:**
- Segmen berisi kurang dari **3 observasi valid** atau panjang visual kurang dari ambang awal **8 px pada kanvas 1600×900** boleh ditahan dari **main stroke** selama masih menunggu titik berikutnya yang sah; raw data dan catatan gap harus tetap tersedia di debug.
- Jika sebuah segmen sudah diputus, render sebagai jejak pendek redup atau sembunyikan sesuai preset; **jangan digabung** dengan segmen berikutnya.
- Ambang diukur pada koordinat output dan diuji agar gerak kecil yang disengaja tetap bisa terlihat. Segment dengan event penting tetap dapat tampil meski pendek melalui QA override.
- Jika data terus stale, tampilkan **“Analisis video tertunda”** dengan informasi frame, tanpa membuat interpolasi antar-gap.
- Pilihan Presisi dan debug tetap memperlihatkan semua segmen valid; *display pruning* tidak boleh menghapus evidence.

## 5. Arsitektur perubahan (usulan)

\`\`\`text
Track / MP4 / Kamera HP
    → Foot observations + actor identity + source clock
    → DualFootTrajectoryEngine (V3, unchanged source of truth)
       ├── raw trajectory + cut reasons → Periksa Jalur
       └── PresentationStrokeBuilder (new)
             ├── ActorPaletteResolver (A merah, B charcoal, background-aware)
             ├── FootStyleOverride (optional)
             ├── SegmentEligibility (visual only)
             └── Style path: Presisi / Luwes / Lukis
                   → TrajectoryRenderer (Compose + fullscreen)
\`\`\`

### Modul terdampak

| Kode | Rencana |
| --- | --- |
| \`src/footprints/lines/v3/TrajectoryRenderer.ts\` | Ganti \`colors.left/right\` menjadi skema actor-first, tambah \`styleMode\`, builder stroke dan pemetaan palet berdasarkan \`stroke.actorId\`. |
| \`src/studio/v3/LineTrailsV3.tsx\` | UI actor-first, 3 mode garis, kontrol default ringkas, detail kaki dan QA di disclosure. |
| \`src/studio/v3/line-trails-v3.css\` | Layout ringkas; hindari kontrol berulang / panel terlalu panjang. |
| **Baru, bila diperlukan:** \`src/footprints/lines/v3/ActorPaletteResolver.ts\` | Pilih warna actor A/B dan override per kaki, aksesibilitas kontras latar. |
| **Baru, bila diperlukan:** \`src/footprints/lines/v3/PresentationStrokeBuilder.ts\` | Penyederhanaan visual, segment eligibility, smoothing terbatas, taper, texture. |
| \`src/footprints/lines/v3/DualFootTrajectoryEngine.ts\` | Pertahankan data mentah; hanya tambah metadata/telemetri jika dibutuhkan. Jangan ubah gate untuk menyiasati tampilan. |
| Tests/E2E baru | Kontrak warna, mode, fidelity, cut, fullscreen, regresi V2/Camera Hub/F3. |

**Kompatibilitas:** migrasi preset \`colors.left/right\` lama melalui fungsi versioned, dengan hasil deterministik dan opsi reset default; jangan diam-diam menafsirkan warna kiri sebagai Aktor A. Simpan kedua warna lama sebagai override per kaki pada jalur migrasi legacy. Pada preset baru, default pakai actor palette. V2 rollback tetap tersedia.

## 6. Acceptance criteria

| ID | Skenario | Hasil yang wajib |
| --- | --- | --- |
| AC-01 | 1P, kedua kaki bergerak | Kedua jalur berwarna **merah Aktor A**, tetap memiliki sejarah kaki terpisah |
| AC-02 | 2P A/B bergerak bersamaan | A merah, B hitam/charcoal; identitas konsisten saat silang dan berhenti |
| AC-03 | Operator mengubah warna Aktor B | Kedua kaki B mengikuti warna baru; A tidak berubah |
| AC-04 | Operator membuka Detail kaki lalu override B-kanan | Hanya B-kanan berubah; B-kiri tetap warna B; reset kembali mengikuti B |
| AC-05 | Background gelap | B beralih ke warna terang yang terbaca tanpa mengubah identitas aktor; override eksplisit tidak diam-diam ditimpa |
| AC-06 | Pilih Presisi → Luwes → Lukis pada jejak yang sama | Perubahan hanya pada presentasi; koordinat raw, jumlah accepted sample dan cut reason identik |
| AC-07 | Belok 90°, balik arah, pivot | Luwes tetap mempertahankan lokasi belok; tidak membuat loop atau overshoot visual |
| AC-08 | Kaki berhenti, video pause, MP4 seek, missing foot | Tidak muncul pertambahan garis palsu; seek/loss tidak membuat sambungan lintas segmen |
| AC-09 | Segmen sangat pendek akibat frame stale | Main canvas tidak dipenuhi serpihan, inspector tetap memperlihatkan raw/cut count; tidak menggabungkan segmen |
| AC-10 | MP4 menghasilkan banyak \`stale-frame\` | Diagnostik memperlihatkan timestamp, age, dan alasan cut; jangan mengklaim masalah tracking sudah terselesaikan hanya karena serpihan disembunyikan |
| AC-11 | Preview → fullscreen → kembali | Geometri, palet dan karakter garis sama; fullscreen tidak menampilkan UI, overlay default OFF |
| AC-12 | Bandingkan latar putih/dark, ukuran 1366×768 dan 1440×900 | Identitas aktor dan warna tetap terbaca, kontrol utama tidak terpotong |
| AC-13 | Rollback engine V2 dan buka lagi V3 | Brush/gaya lama tetap berfungsi, tidak kehilangan input kamera/MP4 |
| AC-14 | Blackout, Map/Perform, Camera Hub, F3 | Tidak membuka gate output, tidak mengubah routing atau koneksi yang sudah ada |

### Target numerik awal (harus dikalibrasi lewat fixture)

- **Luwes centerline** berada di koridor maksimum **≤ 8 px** dari segmen referensi pada kanvas 1600×900; uji P95 dan titik terjauh, jangan hanya nilai rata-rata.
- Untuk belokan ≥ 75°, deviasi puncak terhadap titik belok yang diterima **≤ 8 px**, dan tidak boleh menghasilkan titik di sisi salah arah belokan.
- **0** sambungan antar-cut (seek, missing-foot, actor swap, gap).
- **0** pertambahan titik source selama MP4 pause atau frame duplikat.
- Cache render harus menghindari kerja ulang seluruh history; target waktu paint **P95 ≤ 16 ms** pada perangkat QA yang dicatat.
- **30 menit** sesi 2P dengan memori dan cache presentasi tetap bounded.

Target di atas belum diverifikasi pada video atau perangkat panggung fisik.

## 7. Urutan kerja dan exit gate

| Tahap | Perubahan | Gerbang penerimaan |
| --- | --- | --- |
| P0-A | Audit frame stale dan segmen pendek; debug source-vs-media time | Penyebab serpihan dapat direproduksi dengan MP4 pengujian |
| P0-B | ActorPaletteResolver + migrasi settings | AC-01–05 lulus |
| P0-C | Luwes bounded smoothing, corner guard, segment eligibility | AC-06–10 + golden trajectory lulus |
| P0-D | Lukis stroke width/taper/texture dan panel ringkas | AC-06, 11–12 lulus |
| P0-E | E2E/regresi/soak, fallback V2 | AC-13–14, QA 30 menit, blackout tetap aman |

**Definition of Done:** build + npm test + E2E Chrome dua viewport lulus; klip MP4 nyata diverifikasi dengan raw/render overlay; pemetaan aktor dan warna konsisten; bukti before/after visual dan angka trace dilampirkan; tidak mengubah jalur proyektor maupun deployment Vercel tanpa instruksi tersendiri.

## 8. Catatan keputusan

- Default **aktor**, bukan kaki, sebagai unit identitas visual.
- Default **Luwes** dengan keterbatasan geometri; Presisi dipakai untuk pembuktian; Lukis dipakai untuk karakter tambahan.
- Fragmentation/stale-frame wajib diaudit sebagai **masalah kualitas observasi**, sebelum dipoles secara visual.
- Semua kontrol artistik hanya berada pada presentasi, tidak mengubah sumber data Track.
- Dokumen ini memandu implementasi V3.1; commit dokumentasi tidak menjalankan feature maupun deployment.
