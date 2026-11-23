# SOMA Stage 1 — Audit UI/UX, Information Architecture & Information Hierarchy
**PRD V1.0 · 23 November 2026 · Status: spesifikasi / belum diimplementasikan**  
**Produk:** SOMA Motion Studio, Stage 1  
**Cakupan:** Track → Compose → Map → Perform; webcam/HP/MP4/simulator; FLOOR/BODY; Map Calibration Assist; pengamanan proyektor  
**Repositori:** pangarsagulangsatriya-prog/soma-motion-studio  
**Rencana rilis ketika disetujui:** GitHub Pages dahulu, Vercel tidak termasuk cakupan.

## 0. Ringkasan keputusan

Pertahankan empat workspace **Track → Compose → Map → Perform**. Bagi dua jenis kalibrasi berdasarkan data yang dikerjakan:

- **Camera-to-floor:** di Track, sebelum komposisi dibuat. Posisi kaki pada gambar kamera diubah ke koordinat lantai; profil mengikat sumber, resolusi, dan orientasi yang benar.
- **Floor-to-projector:** di Map, setelah Compose menghasilkan visual. Operator mengatur empat sudut bidang keluaran, menguji tapak, dan memeriksa kesiapan proyektor.

Compose memakai hasil Spatial Engine dari Track, sementara Map memakai raster Compose dan proyeksi output. Mengubah posisi kamera atau profil sumber mengharuskan pemeriksaan ulang koordinat terkait; mengubah proyektor tidak boleh menulis balik kalibrasi sumber.

**Aturan utama:** satu fungsi punya satu tempat pengaturan. Layar lain boleh memberi ringkasan status serta tautan ke tempat pengaturan tersebut.

## 1. Tujuan dan batasan

### Tujuan produk
1. Operator baru dapat menyambungkan sumber, melihat kaki terbaca, mengatur visual, memetakan keluaran dan memasuki Perform melalui alur yang terlihat berurutan.
2. Semua sumber (webcam, kamera HP, MP4, simulator) memakai istilah dan aturan posisi yang konsisten, dengan status kualitas data yang jujur.
3. Compose tetap menjadi tempat kerja kreatif. Pemakai tidak perlu memahami homography, matriks, track ID atau binding key hanya untuk mencoba Sumi dan Footprints.
4. Map memperlihatkan hasil Compose pada bidang output dan membantu operator memeriksa arah serta skala melalui Tes tapak.
5. Klaim “terkalibrasi”, “preview siap”, “QA proyektor selesai”, dan “LIVE” tidak saling menggantikan.

### Di luar cakupan V1
- Mengganti seluruh bahasa visual SOMA atau mendesain ulang Stage 2/3.
- Mengubah model deteksi pose, mengganti GPU/render engine, atau menambahkan layanan server.
- Mengaktifkan proyektor fisik melalui status preview.
- Migrasi produksi Vercel.
- Mengklaim akurasi metrik tanpa pengukuran lapangan.

### Kriteria keberhasilan yang diusulkan (belum diukur)
- Alur happy path software dapat dilalui tanpa loncat menu: Track → Compose → Map → Perform.
- Setiap workspace memiliki satu aksi utama, satu status dominan, dan konten utama yang jelas.
- Status navigasi menyebut tahap yang sungguh telah siap, bukan hanya kondisi sumber lain.
- Perpindahan kamera/MP4, refresh, dan kehilangan frame memperlihatkan peringatan yang dapat ditindaklanjuti.
- Tes tapak, kalibrasi, dan penyesuaian visual tidak pernah melewati pengaman output fisik.

## 2. Bukti audit kode dan risiko

Audit ini membaca implementasi di branch main. Lokasi berikut bisa berubah saat implementasi.

| ID | Sumber kode | Temuan aktual | Risiko bagi operator | Prioritas |
|---|---|---|---|---|
| IA-01 | src/studio/v3/StageModuleNav.tsx, NEXT_STEP | Tombol Track diarahkan ke Map, sementara tab tampil Track → Compose → Map → Perform | Pengguna melewati pembuatan visual | P0 |
| IA-02 | src/studio/v3/FootprintsStageWorkspace.tsx, status nav | trackReady dikirim; composeReady belum dikirim; mapReady diisi tracker.isConfirmed | Centang Compose tidak dapat menjadi indikator valid; Map tampak siap hanya karena lantai tersimpan | P0 |
| IA-03 | src/studio/v3/InlineFloorCalibration.tsx | Track sudah mempunyai pengaturan empat sudut dan konfirmasi camera-to-floor | Duplikasi saat fungsi yang sama tampil di Map | P0 |
| IA-04 | src/footprints/stage-optics/DualSurfaceRoutingPanel.tsx | Map masih dapat mengubah cameraQuad serta projectorQuad; status data-status='ready-perform' saat lantai confirmed | Tanggung jawab kabur dan status berlebihan | P0 |
| IA-05 | src/studio/v3/VideoSpatialCalibration.tsx + SurfaceComposer.tsx | Profil empat titik MP4 dikelola dari inspector Compose | Pengaturan posisi berubah bersama kontrol gaya; konsistensi antarsumber turun | P0 |
| IA-06 | src/studio/v3/MapWysiwygWorkspace.tsx | Map dua panel sumber/output, dengan editor sudut, simulasi, Tes tapak dan perubahan output | Banyak tindakan pada satu layar; perlu satu fokus per mode | P1 |
| IA-07 | src/studio/v3/useMapCalibrationAssist.ts | Overlay tapak, replay, freeze, clear sudah terpisah dari clean raster | Perlu tata letak ringkas dan label “SIMULASI” yang konsisten | P1 |
| IA-08 | src/studio/v3/SurfaceComposer.tsx | Compose berbagi renderer/raster dengan Map; beberapa mode visual, panel, inspector dan status | UI bisa membebani pengguna yang hanya hendak membuat satu visual | P1 |
| IA-09 | src/studio/v3/unifiedStageStatus.ts + safeProjectionPreflight.ts | Ada logika status camera, identity, floor, QA, dan transport fisik | Perlu satu sumber kebenaran status UI, serta label yang tidak berlebihan | P1 |
| IA-10 | src/studio/v3/PerformFinalPreview.tsx + gate output | Preview bersih dan pengamanan LIVE terpisah | UI perlu menegaskan preview vs keluaran fisik | P1 |

Keterangan: temuan di atas menggambarkan struktur kode, bukan hasil pengujian lapangan. Prioritas dan susunan UI berikut berasal dari evaluasi desain.

## 3. Model data dan aliran kerja

### Pipeline yang wajib
1. Input source: webcam / HP / MP4 / simulator.
2. Pose & identity: aktor A/B, keypoint kaki, arah, kualitas frame.
3. Spatial Engine: normalisasi gambar, camera-to-floor (jika ada profil cocok), koordinat lantai.
4. Compose: jejak, garis Sumi, Dual Trace, layer media dan styling memakai koordinat tersebut.
5. Map: warp hasil Compose dari bidang lantai/kanvas menuju quad proyektor.
6. Perform: output bersih yang mengikuti pengaman QA/LIVE/Blackout.

Kamera dapat menghasilkan estimasi posisi 2D tanpa profil lantai. Label **Estimasi 2D** wajib terlihat. Simulator memakai lantai virtual; MP4 memakai profil miliknya sendiri, terikat klip dan resolusi. Kedua status tersebut tidak boleh disamakan dengan QA proyektor fisik.

### Definisi dua kalibrasi

| Camera-to-floor | Floor-to-projector |
|---|---|
| Pemilik UI: Track | Pemilik UI: Map |
| Masukan: frame sumber dan empat sudut lantai | Masukan: raster Compose dan empat sudut bidang output |
| Keluaran: posisi X/Y lantai dan kualitas estimasi | Keluaran: koordinat output proyeksi |
| Invalidasi: kamera/klip/resolusi/orientasi berubah, sumber atau profile diganti | Invalidasi: proyektor, resolusi output, quad atau profil stage berubah |
| Tidak boleh mengubah warna dan efek | Tidak boleh mengubah titik kaki asli atau profil sumber |

### Satu sumber konfigurasi
Rancang CameraFloorProfileStore yang dikelola Track/engine, bukan state inspector Compose. Komponen lain hanya membaca profil, status dan revision-nya. Tidak perlu membuat pose detector kedua. Pertahankan binding-key dan logika invalidasi yang sudah berjalan.

Perubahan kamera/lantai menerbitkan revision dan memutus jejak yang tidak kompatibel; Compose menandai visual masih dapat dipratinjau tetapi hasil perlu diperiksa ulang. Perubahan quad proyektor membatalkan QA output terkait dan menjaga physical Blackout sesuai gate yang telah ada.

## 4. Information architecture — target

Stage 1
- **Track** — sumber dan koordinat gerak
  - Sumber: Webcam / Kamera HP / MP4 / Simulator
  - Monitor sumber + status deteksi aktor/kaki
  - **Sesuaikan bidang kamera** (4 titik + ukuran lantai), milik Track
  - Pemeriksaan lanjutan: skeleton, identitas A/B, koneksi dan diagnostik
  - CTA utama: **Lanjut Compose**
- **Compose** — penampilan visual
  - Kanvas utama (FLOOR / BODY / SPLIT)
  - Style: Footprints / Sumi / Dual Trace dan preset
  - Inspector artistik: warna A/B, ketebalan, panjang jejak, fade, layer
  - Status kecil ruang sumber: **Terkalibrasi / Estimasi 2D** + tautan **Perbaiki di Track**
  - CTA utama: **Lanjut Map**
- **Map** — posisi bidang proyeksi
  - Target: Lantai / Tubuh
  - Referensi kiri: gambar sumber + status posisi (read-only)
  - Output kanan: hasil Compose + projector quad yang bisa digeser
  - Tes tapak: Auto / Tes tapak / Replay / Bekukan / Bersihkan
  - Pengaturan output: ukuran bidang dan quad proyektor
  - Status: **Draft / Tersimpan / Perlu QA fisik**
  - Tautan sekunder: **Ubah bidang kamera di Track**
  - CTA utama: **Lanjut Perform** (boleh melihat pratinjau, tetap tunduk ke gate LIVE fisik)
- **Perform** — pengoperasian
  - Keluaran FLOOR/BODY bersih, fullscreen, dan indikator sumber
  - Status sambungan, QA, perintah LIVE/TEST/HOLD jika tersedia, Blackout dan recovery
  - Pengaturan teknis hanya muncul saat relevan; tidak membuka editor kreatif di layar operator
  - Tautan kembali: **Kembali ke Map**

### Hierarki yang terlihat
1. **Global**: brand SOMA, Stage 1, sumber aktif, status sambungan, Blackout global.
2. **Navigasi Stage**: empat langkah, status setiap langkah, CTA berikutnya yang tidak melompat.
3. **Workspace header**: judul singkat, status dominan, satu aksi utama.
4. **Area kerja**: monitor/surface paling dominan.
5. **Kontrol kontekstual**: pilihan mode, empat sudut, style, atau preset.
6. **Detail lanjutan**: fold/drawer untuk debugging, format input, FPS, sinkronisasi dan konfigurasi berisiko.
7. **Status bantuan**: pesan singkat yang menyebut apa yang harus dilakukan, tanpa menimpa gambar.

Status Blackout global tetap terlihat walaupun layar Compose/Map sedang fullscreen sejauh browser memungkinkan; shortcut keselamatan harus tetap efektif.

## 5. Layout dan aksi per workspace

### Track
**Layout:** judul + status sumber di atas; monitor aktif sebagai fokus; pilihan sumber ringkas; satu baris status aktor; tombol **Sesuaikan bidang kamera** di dekat monitor. Petunjuk setup kabel/QR/USB dimunculkan hanya saat sumber HP dipilih atau koneksi gagal.

**Kalibrasi:** empat titik di monitor sumber, urut 1–4, tampil live; simpan profil; cek kecocokan sumber. Gunakan komponen kamera yang kini berada di Track sebagai dasar. Profil MP4 dipindahkan ke sini dengan tetap mempertahankan validasi klip dan resolusi. Hindari duplikasi editor di Compose dan Map.

**CTA:** **Lanjut Compose**. Saat sumber belum aktif, tombol tetap dapat mengarahkan ke mode simulasi/software preview dengan status jujur atau menampilkan alasan spesifik saat aksi berbahaya perlu diblokir. Jangan menjadikan camera-to-floor selalu prasyarat mengedit karya 2D.

### Compose
**Layout:** satu kanvas utama besar, toolbar mode visual ringkas, inspector adaptif di sisi kanan. Default menampilkan style yang terakhir digunakan dan Footprints sebagai pilihan mudah. Advanced diagnostics dilipat.

**Kontrol prioritas:** aktor A/B → style → warna → ketebalan/ukuran → fade/durasi → clear/export. Jangan tampilkan pengaturan proyektor atau kamera sebagai konten utama.

**Status sumber:** satu label pada toolbar, misalnya **MP4 · Estimasi 2D**. Tautan **Sesuaikan lantai di Track** membuka profil sumber, lalu kembali ke Compose tanpa mengganti preset visual.

**CTA:** **Lanjut Map**.

### Map
**Layout:** tampilan dua panel tetap dipertahankan karena mempermudah pembandingan. Panel kiri menjadi referensi visual sumber/posisi tapak (read-only), panel kanan menjadi pusat operasi projector quad. Hanya handle output bisa diseret dalam alur normal.

**Kontrol utama:** pilih Lantai/Tubuh, **Sesuaikan proyektor**, **Tes tapak**, Simpan bidang. Replay dan Bekukan dapat masuk menu ringkas **Tes ruang**, bukan menjadi sederet tombol selalu terlihat.

**Kalibrasi kamera:** tampil sebagai status sumber dan tautan **Ubah bidang kamera di Track**. Selama migrasi, editor lama Map bisa tetap hidup melalui mode kompatibilitas yang tidak muncul pada alur biasa; penghapusan final setelah tes regresi kamera.

**Status:** **Bidang output belum disimpan**, **Bidang output tersimpan**, atau **QA proyektor perlu diulang**. “Lantai tersimpan” hanya menggambarkan profil kamera, tidak memberi status Perform siap.

**CTA:** **Lanjut Perform** membawa operator ke pratinjau Perform. Mode LIVE fisik tetap membutuhkan pemeriksaan dan izin terpisah.

### Perform
**Layout:** kanvas keluaran terbesar, status kecil untuk sumber dan target, tombol Blackout mudah dijangkau. Sembunyikan video diagnostik dan editor quad pada default. Sediakan pemulihan aman ketika sumber hilang.

**Perbedaan istilah:** “Fullscreen preview” hanya memperbesar pratinjau di browser; “Output proyektor” merujuk jendela/perangkat yang tersambung; “LIVE diperintahkan” tidak membuktikan cahaya fisik menyala.

## 6. Kontrak status, badges, dan navigation readiness

Jangan turunkan status Map atau Perform hanya dari tracker.isConfirmed.

Contoh kontrak state tunggal:
~~~ts
type StageReadiness = {
  source: { kind: 'camera'|'phone'|'video'|'simulator'|'none';
            connected: boolean; frameFresh: boolean; reason?: string };
  tracking: { actorCount: 1|2; stable: boolean; ambiguous: boolean };
  floor: { mode: 'calibrated'|'estimated-2d'|'virtual'|'missing';
           matched: boolean; revision: number };
  compose: { rasterReady: boolean; visualRevision: number; sourceRevision: number };
  map: { outputQuadSaved: boolean; outputRevision: number; mappedVisualRevision: number };
  physical: { connected: boolean; qaValid: boolean; enabled: boolean;
              mode: 'offline'|'blackout'|'test'|'live' };
};
~~~

Kriteria step:
- **Track selesai** saat sumber siap memberikan frame/pose sesuai kemampuan mode. Kalibrasi lantai boleh belum ada untuk jalur software 2D, dengan label jelas.
- **Compose selesai** saat raster visual yang dipilih tersedia dari source/session terbaru. Jangan mengisi composeReady dari trackReady.
- **Map selesai untuk software** saat output quad sudah tersimpan dan sesuai visual/source revision. Kesiapan fisik perlu field QA tersendiri.
- **Perform LIVE** hanya ditampilkan sebagai perintah transport ketika source, gate, sambungan, QA dan persetujuan operator cocok.

Perlu pembedaan warna/status: **Belum aktif**, **Sedang diproses**, **Siap preview**, **Perlu tindakan**, **Terputus**, **Simulasi**, **QA fisik belum selesai**. Satu status dominan per workspace. Badge warna terang dipakai saat sungguh membutuhkan tindakan, bukan untuk semua label.

## 7. Copywriting UI dan terminologi

| Istilah lama / ambigu | Gunakan | Keterangan |
|---|---|---|
| “Lanjut Map” dari Track | **Lanjut Compose** | Urutan tetap |
| “MAP / KAMERA” dalam Track | **Bidang kamera** | Menegaskan pemilik |
| “Sesuaikan lantai MP4” dalam inspector Compose | **Sesuaikan bidang video** pada Track | Profil per klip |
| “Lantai tersimpan” pada status Map | **Bidang output tersimpan** atau **Belum disesuaikan** | Membedakan dari camera floor |
| data-status=ready-perform saat kamera confirmed | **camera-floor-confirmed** | Status fisik dihitung terpisah |
| “LIVE” pada preview video | **Gambar langsung** | LIVE fisik hanya untuk transport output |
| “Estimasi 2D” | **Estimasi 2D** | Jangan memberi kesan pengukuran meter |
| “Tes tapak” sintetis | **Tes tapak · SIMULASI** | Tidak boleh tampak terdeteksi |
| “Output aktif” yang tidak terverifikasi | **LIVE diperintahkan** | Status cahaya fisik perlu pengamatan |

Nada pesan: singkat, langsung ke tindakan. Contoh: **Kamera HP terputus. Sambungkan kembali di Track.** dan **Bidang proyektor berubah. Ulangi QA sebelum LIVE.**

## 8. Negative flows dan aturan perilaku

| Kondisi | Respons layar | Pemulihan |
|---|---|---|
| Izin webcam ditolak | Status “Akses kamera ditolak”; tanpa prompt berulang | Buka petunjuk izin browser di Track |
| HP QR putus / refresh | Kamera **Terputus**, frame lama tidak diberi label LIVE | Sambungkan kembali; cek binding dan kalibrasi |
| Kamera berganti resolusi/orientasi | Kalibrasi sumber ditandai tidak cocok; jejak tidak menyambung | Sesuaikan bidang kamera ulang |
| Dua aktor crossing, ID ambigu | Hentikan cap baru yang salah dan tampilkan “A/B belum stabil” | Tunggu ID stabil; potong path lama |
| MP4 seek/pause | Status seek/jeda; jangan memakai pose dari detik lain | Lanjut analisis, reset segmen jejak |
| MP4 berganti file | Profil lama tidak terbawa | Pilih atau kalibrasi ulang profil sesuai file |
| Compose visual berubah setelah Map | Map diberi label “Periksa hasil komposisi terbaru” | Tinjau output tanpa reset quad yang masih valid |
| Quad output diedit | Draft ditampilkan; output fisik Blackout/QA invalid menurut gate | Simpan output dan ulang QA |
| Tes tapak tanpa deteksi | Lima titik **SIMULASI**; jangan masuk Track/Compose | Gerakkan kaki atau pilih sumber |
| Renderer hilang / output canvas kosong | Tampilkan alasan singkat dan tombol kembali ke Compose | Perbaiki renderer, jangan klaim QA sukses |
| Fullscreen ditutup | Kembali ke layout Map/Compose tanpa kehilangan sesi | Kontrol tetap tersedia |
| Output fisik putus | LIVE tak dapat dipercaya; perintah Blackout / aman | Sambung ulang lalu QA |

## 9. Micro-interactions, aksesibilitas, dan responsive

- Arahkan fokus keyboard ke judul workspace ketika berpindah layar; pertahankan state visual pada navigasi balik.
- Tombol yang mengubah keempat sudut punya undo/cancel yang benar dan penanda **Belum disimpan**.
- Geser sudut memakai pointer atau tombol panah; keyboard focus terlihat; nomor titik 1–4 tetap konsisten.
- Saat menggeser quad, perbarui preview dengan halus tanpa mengubah event tracking maupun status LIVE.
- Satu pesan status dominan berformat singkat; diagnostik detail hanya setelah operator membuka drawer.
- Mobile/narrow view: dua panel Map ditumpuk; header dan Blackout tidak menutupi area sentuh.
- Angka, warna A/B dan status source harus bisa dipahami tanpa hanya mengandalkan warna. Gunakan label teks.
- Kurangi animasi dekoratif; perubahan status dan transisi panel cukup ringan. Hormati prefers-reduced-motion.
- Layar preview tetap memakai aspect ratio asli atau letterboxing yang jujur; jangan memotong kaki demi memenuhi komponen.

## 10. Rencana migrasi agar sistem yang sudah berjalan tidak rusak

Tahap A — P0 navigasi dan status:
1. Betulkan NEXT_STEP Track → Compose, lalu unit + browser test.
2. Bangun pemetaan status StageReadiness untuk Track/Compose/Map; hilangkan interpretasi Map siap dari floor confirmed.
3. Pisahkan indikator “preview software tersedia” dari “QA fisik valid”.
4. Pertahankan gating existing, termasuk Blackout dan approval di DualSurfaceSessionStore.

Tahap B — P0 kepemilikan kalibrasi:
5. Jadikan InlineFloorCalibration di Track entry utama semua sumber.
6. Pindahkan akses VideoSpatialCalibration dari Compose ke Track, dengan satu store profil per klip/resolusi; jangan menghapus logika validasi klip.
7. Jadikan Map source quad read-only dengan tautan langsung ke Track; simpan kemampuan edit lama di balik flag sementara sampai regresi lulus.
8. Uji perubahan profil memutus path segment, membatalkan hasil QA yang relevan, dan mempertahankan setelan artistik Compose.

Tahap C — P1 penyederhanaan per layar:
9. Atur Compose menjadi canvas-first; kontrol utama paling sedikit, inspector kontekstual.
10. Map menjadi output-first: dua panel, kontrol projector quad, Tes tapak yang ringkas; physical QA tetap terlihat saat dibutuhkan.
11. Perform menjadi clean-stage-first dengan Blackout mudah dijangkau.
12. Satu istilah status dan pesan di setiap workspace, sesuai tabel copywriting.

Tahap D — P2:
13. Uji responsif, keyboard, tooltip, reduced-motion dan transisi sumber.
14. Audit sisa label teknis, duplikasi status, dan dead-end navigasi; hapus jalur kompatibilitas usang setelah tes lulus.

## 11. Backlog implementasi P0–P2

| ID | Prioritas | Deliverable | Acceptance |
|---|---|---|---|
| IA-P0-01 | P0 | StageModuleNav Track→Compose | CTA mengarah Compose; tidak menggandakan route lain |
| IA-P0-02 | P0 | Readiness contract Track/Compose/Map/Perform | Badge dan centang sesuai status faktual; belum QA tidak terlihat siap LIVE |
| IA-P0-03 | P0 | Camera floor profile owner tunggal di Track | Webcam/HP/MP4 bisa mengubah profil melalui Track; Compose membaca, Map mengacu |
| IA-P0-04 | P0 | Map projector-only editing dan migrasi aman | Camera quad read-only; re-open Track via tautan; projector quad tetap berfungsi |
| IA-P0-05 | P0 | Audit fail-safe status dan LIVE/Blackout | Tidak ada jalur UI untuk mengabaikan gate fisik |
| IA-P1-01 | P1 | Compose hierarchy canvas-first + inspector adaptif | Pemilihan style dan aktor mudah; diagnostik tidak menguasai panel |
| IA-P1-02 | P1 | Map Calibration Assist hierarchy + status draf | Output dan Tes tapak terbaca; hasil simulasi diberi label |
| IA-P1-03 | P1 | Perform hierarchy + mode recovery | Keluaran utama dominan, status jelas, Blackout mudah diakses |
| IA-P1-04 | P1 | Source switch/refresh recovery | Profil source dan status visual tidak salah terbawa |
| IA-P2-01 | P2 | Konsistensi microcopy dan label | Semua empat workspace memakai istilah yang sama |
| IA-P2-02 | P2 | Responsive, keyboard, reduced-motion | Tes layar sempit/fullscreen dan navigasi fokus lulus |
| IA-P2-03 | P2 | UAT dan perapian leftover code | Tidak ada editor/aksi duplikat yang membingungkan |

Urutan implementasi disarankan IA-P0-01 → IA-P0-02 → IA-P0-03 → IA-P0-04 → IA-P0-05, lalu kelompok P1 dan P2.

## 12. Skenario uji wajib

### Unit tests
- NEXT_STEP Track → Compose → Map → Perform.
- Baca status ready tiap langkah dari sumber status yang tepat.
- TrackReady tidak otomatis membuat MapReady/ComposeReady.
- CameraFloorProfileStore menolak source binding lama; MP4 menolak file/resolusi berbeda.
- Simulasi tidak mendapat status tracking fisik atau QA proyektor.
- Edit quad Map memicu invalidasi QA hanya pada output terkait.

### Browser E2E
1. Webcam 1P → Track → Compose Sumi → Map Tes tapak → Perform preview.
2. Dua aktor crossing → warna A/B dan status identitas tetap valid.
3. HP QR/USB → refresh/pindah halaman → recover/kalibrasi cocok, tidak terjadi status palsu.
4. MP4 16:9/4:3 → kalibrasi di Track → ubah preset Sumi di Compose → Map.
5. Simulator 3D → software preview → Map test, output fisik masih terkunci.
6. Map output edit → Batalkan / Simpan → status draf dan QA berubah benar.
7. Browser fullscreen ↔ normal → kontrol dan state tetap stabil.
8. Output fisik tidak tersambung → Perform preview bisa dibaca, LIVE tetap diblokir oleh gate.
9. Pergantian kamera atau klip di tengah replay → reset visual yang stale.
10. Navigasi keyboard dan viewport sempit: tidak ada kontrol tertutup atau dead end.

### UAT panggung
Dua aktor, kamera HP dan overhead, FLOOR sekitar 5×5 m, gerak maju/mundur/lateral/pivot/crossing. QA fisik dan arah proyeksi diperiksa manual, dicatat terpisah dari CI. Periksa persepsi operator terhadap empat langkah tanpa memberikan tutorial panjang.

## 13. Risiko dan rollback

- **Risiko** memindahkan editor MP4 dapat menghilangkan profil lokal bila state dikelola per-mount. **Mitigasi:** angkat state ke provider/store bersama sebelum mengganti lokasi UI.
- **Risiko** menyembunyikan editor kamera di Map dapat memutus alur pengguna lama. **Mitigasi:** tautan deep-link Track serta compat flag sementara.
- **Risiko** perubahan pipeline readiness dapat membuka physical LIVE terlalu dini. **Mitigasi:** hanya UI yang membaca status turunan; jangan melonggarkan gate output; test fail-safe.
- **Risiko** UI disederhanakan berlebihan sampai pengaturan panggung hilang. **Mitigasi:** pindahkan ke detail lanjutan, catat pemilik fungsi, jangan hapus fungsi tanpa tes.
- **Rollback:** kembali ke commit aplikasi sebelumnya jika navigasi/gating gagal; dokumen PRD tidak melakukan mutasi runtime.

## 14. Definisi selesai (Definition of Done)
- UI dan pemilik state sesuai peta empat workspace.
- Kontrak status tunggal dan label valid di masing-masing langkah.
- Tidak ada tombol utama yang melompati urutan, kecuali pengguna memilih tab lain secara sadar.
- Kalibrasi kamera dan quad proyektor tidak mempunyai dua pengaturan utama yang saling bertentangan.
- Regression unit + E2E lulus; pengujian perangkat fisik terpisah dan terdokumentasi.
- Browser GitHub Pages menampilkan build sesuai commit yang telah diuji.
- Tidak ada deploy ke Vercel dalam perubahan ini.

## 15. Referensi audit
Sumber utama: branch main GitHub, dibaca 23 November 2026.
- src/studio/v3/StageModuleNav.tsx
- src/studio/v3/FootprintsStageWorkspace.tsx
- src/studio/v3/InlineFloorCalibration.tsx
- src/studio/v3/VideoSpatialCalibration.tsx
- src/studio/v3/SurfaceComposer.tsx
- src/studio/v3/MapWysiwygWorkspace.tsx
- src/studio/v3/useMapCalibrationAssist.ts
- src/studio/v3/PerformFinalPreview.tsx
- src/studio/v3/unifiedStageStatus.ts
- src/studio/v3/safeProjectionPreflight.ts
- src/footprints/stage-optics/DualSurfaceRoutingPanel.tsx

**Catatan status:** PRD audit dan rencana perubahan; pembuatan dokumen tidak mengubah aplikasi, workflow, atau deployment.
