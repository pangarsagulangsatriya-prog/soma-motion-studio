# SOMA Dual Trace V2.1 — Path Continuity & Layer Clarity
## Product Requirements Document (PRD)

**Tanggal:** 23 November 2026  
**Status:** Draft implementasi — audit kode dan tangkapan layar; fitur belum diubah  
**Area:** Stage 1 / Compose / Dual Trace V2, dengan pemakaian perhitungan lintasan bersama pada Path Sumi V3.5  
**Repository:** `pangarsagulangsatriya-prog/soma-motion-studio`  
**Dokumen pasangan:** `SOMA_DUAL_TRACE_V21_TECHNICAL_ARCHITECTURE.md`

## 1. Ringkasan masalah

Tangkapan layar terbaru memperlihatkan satu kanvas putih dengan beberapa sapuan terputus dan berwarna pucat. Cap kaki yang sebelumnya tampak jelas hampir tidak terlihat. Status berbunyi **“MP4 · kaki belum terdeteksi”** dan **“Menunggu pose kepala/bahu”**, sementara tinta historis masih tersisa di kanvas.

Pengguna mengharapkan dua lintasan aktor A/B yang tumbuh sepanjang perpindahan, termasuk melengkung, berbelok, dan berpapasan. Tapak hadir di sekitar lintasan lalu memudar menurut waktu. **Garis tetap menetap saat tapak memudar.** Kepala dan bahu dapat ditumpuk sesuai urutan lapisan, dengan bobot lebih tenang agar jalur tetap terbaca.

Penilaian ini bertumpu pada screenshot yang tersedia dan audit kode repository. **Belum ada analisis per-frame terhadap file MP4 mentah** dalam penyusunan dokumen ini; sebab spesifik pada satu video perlu dibuktikan melalui instrumentasi dan pengujian.

## 2. Hasil audit: fakta dan dugaan yang perlu diuji

| Temuan pada layar | Bukti kode yang relevan | Status |
|---|---|---|
| Jalur terfragmentasi | `PathObservationRouter.ts` memiliki bobot perpindahan `0.08`, `0.12` pada beberapa kondisi; `ActorPathTracker.ts` mengabaikan gerak di bawah 4 px | Terverifikasi di kode; kontribusi pada video perlu diukur |
| Garis pucat | `DualTraceV2Renderer.ts` memberi opacity Path default 0.8 dan Upper 0.52, dengan opacity subkanal tambahan | Terverifikasi di kode; asal sapuan pucat perlu diuji via Split Debug |
| Cap menghilang seiring waktu | `PainterlyImpressionEngine.ts` memakai `lifetimeOpacity(...)`, sedangkan UI V2 memakai durasi tapak enam detik secara default | Perilaku sesuai rancangan, tetapi berpotensi membingungkan saat pose berhenti |
| Status pose terbaru berbeda dari tinta lama | `LineTrailsV3.tsx` mempertahankan persistent path dan memperbarui status input saat frame tidak siap | Perlu pemisahan status UI |
| Satu raster Compose untuk Map | `LineTrailsV3.tsx` menyalin kanvas gabungan ke `outputRaster`; Map memakai raster FLOOR bersama | Dipertahankan, diuji regresi |
| Upper Gesture mengikuti lantai secara relatif | `UpperStageAnchorMapper.ts` mengikat gesture pada titik lantai dengan perpindahan relatif gambar | Estimasi 2D ekspresif; tidak boleh diklaim rekonstruksi 3D |

## 3. Tujuan produk

1. **Path terbaca sebagai perjalanan.** Setiap aktor menghasilkan satu atau beberapa kurva kontinu yang berkorespondensi dengan perpindahan pusat tubuh pada lantai.
2. **Path dan footprints hidup berdampingan.** Path tidak terhapus saat cap menimpa garis, memudar, atau berubah warna.
3. **Identitas A/B stabil.** Ketika aktor berpapasan, tidak ada garis yang tiba-tiba berpindah dari satu aktor ke aktor lain.
4. **Upper Gesture tidak menenggelamkan Path.** Urutan depan/belakang tetap bisa dipilih; proporsi warna dan opacity mendukung pembacaan jalur.
5. **Kondisi tracking dan riwayat gambar mudah dipahami.** “Kaki belum terdeteksi sekarang” dipisahkan dari “jejak tersimpan”.
6. **Satu hasil untuk seluruh perjalanan produk.** Compose → Map → Perform dan ekspor PNG memakai raster gabungan yang setara pada timestamp yang sama.
7. **Perbaikan lintasan dipakai bersama** oleh Path Sumi V3.5 dan Dual Trace V2.1; hindari dua logika gait yang berbeda.

## 4. Di luar cakupan

- Rekonstruksi gerak tiga dimensi yang presisi dari kamera tunggal.
- Klaim pengukuran tekanan kaki; bobot tinta tetap interpretasi artistik dari kecepatan dan perubahan arah.
- Penggantian pose detector, Camera Hub, atau seluruh UI SOMA.
- Perubahan transport LIVE, izin proyektor, maupun pengaman Blackout.
- Penggunaan noise acak atau efek dekoratif untuk menutupi jalur yang gagal terbentuk.

## 5. Perilaku pengalaman yang dituju

### 5.1 Kanvas gabungan

- Latar putih hangat, rasio 16:9, ukuran raster acuan 1600 × 900.
- **Foot Path:** menetap sampai Clear; dominan secara visual dan bergerak mengikuti trajectory center.
- **Footprints:** cap individual dengan orientasi kaki yang terbaca; default fade enam detik; pemudaran tidak mengubah Path.
- **Upper Gesture:** kepala dan bahu membentuk sapuan tambahan dengan opacity lebih rendah; tampil hanya saat pose yang valid tersedia.
- **Split Debug:** dua kanal diagnostik Foot Path + Tapak serta Head + Shoulder; keduanya mengikuti waktu dan transform yang sama dengan komposit final.

### 5.2 Peristiwa gerak

| Gerak aktor | Path | Footprints | Upper |
|---|---|---|---|
| Berjalan lurus | Garis memanjang mulus dari pusat perjalanan | Cap muncul pada langkah yang valid | Gesture mengikuti perubahan pose |
| Melambat / hesitation | Ujung sapuan sedikit mengental, posisi tetap stabil | Cap terakhir memudar | Tidak menciptakan garis liar |
| Pivot / belokan | Kurva berubah arah dengan taper terkontrol | Cap mengikuti posisi/orientasi kaki | Tidak melebihi perpindahan aktor yang teramati |
| Stop | Satu akhir stroke; tidak bertambah saat posisi diam | Cap tetap mengikuti fade | Gesture boleh berhenti pada posisi terakhir |
| Berpapasan | Jalur A/B bersilangan; warna konsisten | Tidak bertukar identitas aktor | Saat identitas tidak pasti, kanal yang terdampak berhenti aman |
| Deteksi hilang sementara | Stroke aktif ditahan pendek atau diputus sesuai tingkat kepercayaan | Tidak membuat cap baru dari data lama | Status mengikuti frame saat ini |

### 5.3 Hierarki kontrol UI

Prioritas visual operator: **kanvas → sumber/status → pilihan lapisan → warna A/B → bobot jalur/durasi tapak**.

Toolbar utama di luar kanvas: **Gabung / Pisah Debug**, **Tapak di depan / Gesture di depan**, **Layar penuh**, **Bersihkan**, **PNG gabungan**. Saat fullscreen, semua kontrol hilang dari raster dan hanya lukisan yang tersisa. Detail teknik (smoothing, ambang gerak, cut reason, offset stage) dipindahkan ke panel Diagnostik.

### 5.4 Status terpisah

Dua baris status yang tidak saling meniadakan:

- **Sumber sekarang:** `MP4 · 2 aktor terdeteksi`, `MP4 · pose tertunda`, `MP4 · kaki tidak terbaca`, atau `MP4 · dijeda`.
- **Lukisan:** `Path A: 1 jalur · B: 1 jalur · Tapak aktif: 5`, atau `Jejak tersimpan · menunggu frame baru`.

Perubahan source, seek, hilangnya A/B, dan perubahan profil kalibrasi perlu status khusus. Label “LIVE” khusus transport proyektor, sedangkan preview MP4 memakai status **Pratinjau aktif**.

## 6. Persyaratan produk (P0–P2)

| ID | Prioritas | Kebutuhan | Penerimaan |
|---|---|---|---|
| PC-01 | P0 | Telemetry penerimaan observasi per aktor | Hitungan source frames, valid poses, observations, START/ADD/TURN/STOP/CUT dan alasan cut tampil di Debug |
| PC-02 | P0 | Perbaikan trajectory pusat aktor dengan movement accumulator | Gerak kecil yang konsisten tidak terus hilang di ambang 4 px |
| PC-03 | P0 | Path persisten dan footprints temporer terpisah | Saat cap memudar, raster Path masih identik sebelum dan setelah fade |
| PC-04 | P0 | Path Sumi V3.5 dan Dual Trace memakai trajectory engine yang sama | Fixture gerak yang sama memberi koordinat Path yang setara pada kedua mode |
| PC-05 | P0 | Fail-safe saat MP4 pose tertunda dan crossing A/B | Tidak terjadi lompatan, segmen palsu, atau pertukaran warna |
| PC-06 | P0 | Komposit dengan Path dominan dan alpha tertata | Garis dan cap tetap terbaca saat tumpang tindih; Map menerima frame yang sama |
| PC-07 | P1 | UI status sumber versus tinta historis | Operator dapat membedakan pose hilang dari hasil gambar yang tetap tersimpan |
| PC-08 | P1 | Penyederhanaan toolbar luar kanvas dan clean fullscreen | Tidak ada tombol atau pesan di raster keluaran |
| PC-09 | P1 | Perbaikan gerak kuas berdasarkan event | Hesitation, pivot dan stop memengaruhi sapuan setelah trajectory stabil |
| PC-10 | P2 | Benchmark MP4 + kamera sungguhan | Hasil visual, latency dan frame rate dilaporkan dengan perangkat/timestamp |

## 7. Keputusan desain awal untuk diuji

- **Path opacity:** mulai dari 0,95; evaluasi kontras dengan latar putih.
- **Footprint opacity:** mulai dari 0,85; fade enam detik, dapat disesuaikan.
- **Upper opacity:** mulai dari 0,35 agar gerak kepala/bahu memberi tekstur tanpa mengalahkan perjalanan kaki.
- **Warna aktor:** A Path merah tua, B Path arang; Footprints A terakota, B abu batu; Upper keduanya lebih pucat.
- **Lapisan default:** Upper → Foot Path → Footprints. Urutan dapat ditukar melalui preset, tetapi Path harus tetap dapat dibaca saat cap menutup sebagian garis.

Nilai tersebut **usulan awal**, belum hasil uji artistik. Hasil kerja lapangan bisa mengubah warna, opacity, atau lebar kuas tanpa mengganti kontrak data.

## 8. Skenario pengujian

1. **MP4 lateral 2 aktor:** A bergerak kiri–kanan, B kanan–kiri; garis masing-masing membentuk lintasan yang mengikuti arah gerak.
2. **MP4 crossing:** A/B saling mendekat dan melewati satu titik; jalur boleh bersilangan tetapi tidak saling tersambung akibat identity swap.
3. **MP4 maju–mundur dengan kamera miring:** empat titik kamera dikalibrasi di Track; gerakan kedalaman tidak mengumpul di satu sisi kanvas.
4. **Video pause 5 detik:** tinta Path tetap; tidak muncul cap baru; status berubah menjadi jeda.
5. **Seek dan loop:** potongan sebelumnya tidak tersambung dengan frame setelah seek; tidak ada double stamp.
6. **Footprints fade:** setelah enam detik cap memudar, garis tetap terlihat.
7. **Matikan Upper:** Path dan Footprints tetap sama, sehingga kanal yang membuat sapuan pucat dapat diidentifikasi.
8. **Ubah palette:** tinta lama berganti warna menurut aktor/kanal, bentuk perjalanan tidak berubah.
9. **Map dan Perform:** hasil komposisi setara dengan hasil Compose sebelum transform proyektor; Blackout tetap bekerja.
10. **Simulator dan kamera HP:** recovery source tidak menghubungkan jejak dua sesi yang berbeda.

**Baseline wajib:** simpan tangkapan layar hasil V2 saat ini dan kumpulkan telemetry dari klip uji yang sama. Bandingkan dengan V2.1 pada timeline yang identik. Raw MP4 belum menjadi bagian dari lampiran dokumen ini.

## 9. Metrik dan acceptance criteria

| AC | Kriteria verifikasi |
|---|---|
| AC-01 | Setidaknya satu garis A dan satu garis B muncul pada fixture dua aktor yang bergerak kontinu, dengan arah dan belokan yang cocok dengan ground truth fixture |
| AC-02 | Perpindahan konsisten di bawah ambang per-frame dapat terakumulasi; tidak mengakibatkan STOP palsu setiap frame |
| AC-03 | CUT hanya terjadi pada alasan yang tercatat; zero unlogged jump saat source/aktor berubah |
| AC-04 | Tidak ada tambahan tinta Path dari frame pose stale atau video pause |
| AC-05 | Penghilangan cap enam detik tidak memengaruhi state, panjang, ataupun piksel atlas Path |
| AC-06 | Kanal Upper dimatikan: Foot Path dan Footprints tetap terlihat jelas |
| AC-07 | Warna dan z-order mengubah komposit saja, tanpa mengubah trajectory event |
| AC-08 | Fullscreen, PNG, Map FLOOR, dan preview Perform mengambil final raster yang sama sebelum warp fisik |
| AC-09 | QA/Blackout proyektor dan jalur output lain tidak berubah |
| AC-10 | CI unit+build+E2E lulus; QA kamera/proyektor nyata dilaporkan terpisah |

Target numerik seperti FPS, akurasi lintasan, atau tingkat keberhasilan deteksi **baru boleh ditetapkan sebagai SLA setelah benchmark perangkat dan dataset dicatat**. Untuk fixture sintetis, kesesuaian koordinat dapat diuji secara deterministik dengan toleransi yang didefinisikan dalam tes.

## 10. Risiko dan rollback

- **Over-smoothing:** belokan kehilangan bentuk. Perbaikan: smoothing adaptif terhadap kecepatan dan sudut, bukan konstanta besar.
- **Under-smoothing:** sapuan bergetar. Perbaikan: dead zone kecil dan buffer perpindahan kumulatif.
- **Interpolasi palsu:** garis menghubungkan titik jauh setelah kehilangan pose. Perbaikan: batas waktu/perpindahan dan CUT yang tercatat.
- **Identity swap:** garis A/B tersambung silang. Perbaikan: status identitas dan reset segmen per aktor.
- **Perubahan render merusak Map/Perform:** pertahankan satu `outputRaster` dan pixel regression sebelum rilis.
- **Biaya CPU/memori atlas:** gunakan cache mask dan tinted atlas sesuai revision, jangan alokasi kanvas 1600×900 setiap frame.

**Rollback:** pertahankan flag versi trajectory lama dan Dual Trace V1 sampai fixture, tes browser, serta pengujian panggung lolos. Jangan mengubah Blackout atau preflight transport sebagai bagian perbaikan artistik.

## 11. Definition of Done

- Video uji dua aktor menampilkan lintasan yang terbaca dan terkait dengan gerak sumber.
- Footprints serta Path hidup terpisah sesuai clock dan clear action.
- Telemetry menjelaskan alasan semua pemotongan segmen.
- Status pose terkini terpisah dari jumlah path/footprints yang tersimpan.
- Compose, Map, Perform dan ekspor PNG mengonsumsi komposit bersih yang sama.
- Tes otomatis dan uji lapangan dicatat; hasil yang belum diuji tetap ditandai terbuka.

## 12. Referensi kode

Seluruh path berikut merujuk pada branch `main` saat audit 23 November 2026:

- `src/studio/v3/LineTrailsV3.tsx`
- `src/footprints/lines/v3/PathObservationRouter.ts`
- `src/footprints/lines/v3/ActorPathTracker.ts`
- `src/footprints/lines/v3/PersistentPathStore.ts`
- `src/footprints/dual-trace/DualTraceV2Renderer.ts`
- `src/footprints/dual-trace/UpperStageAnchorMapper.ts`
- `src/footprints/lines/v3/PainterlyImpressionEngine.ts`
- `src/studio/v3/DualTraceCanvasHostV2.tsx`
- `src/studio/v3/DualTraceControlsV2.tsx`

**Status dokumen:** spesifikasi untuk implementasi berikutnya. Pembuatan dokumen tidak mengubah aplikasi ataupun deploy.