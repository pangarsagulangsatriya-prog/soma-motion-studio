# SOMA — MAP-R2: Simplify Mapping, Visual Stage Simulation & E2E QA
**Prompt implementasi untuk Antigravity** · 20 November 2026  
**Repo:** https://github.com/pangarsagulangsatriya-prog/soma-motion-studio  
**Scope:** hanya workspace **Map** dan integrasi minimum yang diperlukan dengan Track, Compose, Perform.  
**Target:** Map intuitif, ringkas, terlihat seperti panggung nyata, akurat secara koordinat, aman untuk proyektor.

> **Tugasmu:** INSPECT kode dan UI Map yang berjalan sekarang terlebih dahulu. Audit fungsi dan pengalaman pengguna dengan bukti. Kemudian rancang dan implementasikan perbaikan bertahap pada branch kerja. Jangan berhenti pada dokumen atau mockup. Pertahankan engine, state, dan safety gate yang sudah benar. Jangan deploy ke Vercel; kumpulkan perubahan untuk satu deployment final setelah review.

## 0. Hal yang sudah ditemukan di `main` — wajib diverifikasi ulang
Temuan dari inspeksi kode awal, **bukan klaim pengujian fisik**:

- `FootprintsStageWorkspace.tsx` membuka Map dengan `SurfaceComposer` yang sama melalui `mapMode={mappingOpen}`. Periksa apakah heading, panel Compose, layer/media/timeline, dan output QA terlihat ganda atau salah konteks ketika berpindah ke Map.
- `MapFourCornerEditor.tsx` menyediakan switch SOURCE/PROJECTOR, empat titik drag, teks instruksi panjang, dan angka koordinat X/Y selalu terlihat. Pindahkan angka detail ke Advanced dan tampilkan penyesuaian langsung pada visual yang relevan.
- `InlineFloorCalibration.tsx` mengatur empat sudut **kamera → lantai**, yang berbeda dari empat titik **gambar → proyektor** di `CalibrationStudio.tsx` dan `DualSurfaceRoutingPanel.tsx`. Ini rawan membingungkan bila ditampilkan sebagai beberapa wizard yang setara.
- `DualSurfaceRoutingPanel.tsx` mengelola FLOOR dan BODY, status window, routing, bukti QA, alat uji, dan draft profil. Audit ulang hierarki dan interaksi; jangan membuang state/gate penting ketika merapikan panel.
- `ProjectorWysiwygPreview.tsx` sudah ada. Preview memakai gambar canvas + transform dan garis draf. Jangan menyebutnya bukti penyelarasan fisik atau *pixel-accurate projector simulation* sebelum diverifikasi terhadap renderer output.
- `Map` menangani dua **jalur output** (FLOOR dan BODY). Sementara Compose punya layer `FLOOR`, `BODY A`, `BODY B`. Dua tubuh A/B masuk ke satu jalur BODY yang bermasker; jangan tiba-tiba mengasumsikan tiga proyektor.
- `InlineFloorCalibration` mendukung ukuran 5×5 m. Gunakan 5×5 m sebagai **preset latihan**, tetap bisa diganti; jangan hard-code untuk semua venue.

**Audit ulang berdasarkan HEAD terkini**; beri SHA commit. Periksa implementasi nyata, tests, screenshot, state default, dan semua mode responsif. Jangan menganggap elemen sudah bekerja hanya karena komponen ditemukan.

## 1. Benchmark produk dan keputusan desain
Pelajari alur nyata dengan dokumentasi/screenshots resmi; catat bagian yang cocok dan batas penerapan:

| Referensi | Yang dipelajari | Adopsi untuk SOMA |
|---|---|---|
| **Resolume Arena — Advanced Output** | Pisahkan Input Selection, Output Transformation, screens/slices, masks | Pertahankan pemisahan koordinat input vs output di engine; tampilkan sebagai langkah sederhana, bukan dua panel teknis default |
| **MadMapper — Surfaces** | Manipulasi surface langsung di kanvas; pemilihan objek/permukaan; test pattern | Drag handle di stage monitor, pilih FLOOR/BODY, visual feedback seketika |
| **TouchDesigner — Kantan Mapper** | Polygon/mask langsung di viewport dengan visual sumber | Mode Advanced untuk polygon/body masking, bukan layar utama yang penuh parameter |
| **MapMap (open-source)** | Mapping 2D berbasis surface, UI sederhana | Rujukan untuk interaction model dan prototipe, jangan menyalin seluruh aplikasi |

Referensi:
- https://resolume.com/support/en/advanced-output
- https://resolume.com/support/en/input-selection
- https://resolume.com/support/en/output-transformation
- https://docs.madmapper.com/
- https://docs.derivative.ca/Projection_Mapping
- https://github.com/mapmapteam/mapmap

Bandingkan jumlah klik, tingkat kebingungan, istilah, kontrol visual, hubungan preview-output, recovery dari kesalahan, dan tahap pertama bagi operator baru. Jangan sekadar menyalin estetika produk lain.

## 2. Satu mental model: **pilih → cocokkan → uji**

**Map bukan tempat mengedit scene lagi.** Komposisi visual dibuat di Compose. Map menempatkan komposisi itu pada panggung dan memastikan posisi serta keluaran proyektor.

### Alur utama yang harus terlihat
1. **Pilih permukaan:** `Lantai` / `Tubuh`. Tampilkan visual dari Compose terakhir; untuk Tubuh tampilkan A dan B sebagai dua performer dalam satu BODY output.
2. **Cocokkan:** visual empat titik di atas panggung; operator drag titik dan melihat perubahan draf seketika. Jika butuh registrasi kamera-lantai yang belum tersedia, tampilkan satu tindakan singkat `Kalibrasi kamera` dengan penjelasan satu kalimat maksimal.
3. **Uji & simpan:** simulasi → test grid proyektor → bukti QA fisik → simpan profil. Tombol `Ke Perform` tersedia sesuai safety/readiness yang benar, dengan alasan ringkas jika terkunci.

Tiga tahap ini boleh berada dalam satu workspace, **jangan buat tujuh wizard**. Ketika mengedit, fokus pada objek dan pegangan sudut. Ketika QA, fokus pada output dan hasil pengukuran.

### Status yang boleh dominan
`Belum dikalibrasi` · `Siap diuji` · `Perlu QA fisik` · `Siap Perform`.
Satu status sumber (`Kamera / Video / Simulasi`) kecil di header. Tampilkan blocker yang relevan saja, tidak satu paragraf diagnosis permanen.

## 3. Rancangan visual — **orang dan panggungnya harus kelihatan**

Bangun satu **Stage Map Monitor** besar, memanfaatkan data yang **sudah dipakai Track dan Compose**. Bukan sekadar persegi kosong, koordinat, atau boneka stick figure sebagai visual utama.

**Mode preview:**
- **Panggung (default):** lantai perspektif sederhana, titik penanda ukuran, 1–2 representasi performer A/B yang bergerak, arah tubuh/kaki, jejak telapak kiri/kanan di lantai, bidang linen bila profil panggung memuatnya, batas proyeksi dan handle kalibrasi. Hindari fotorealisme palsu; tampilkan bentuk 3D/siluet tubuh yang jelas dan mengikuti gerak. Ukuran relatif perlu masuk akal.
- **Kamera:** feed sumber sebenarnya dengan pose/ankle/heel/toe sebagai overlay diagnostik opsional. Tandai kuadrilateral kamera-lantai bila tahap itu sedang aktif.
- **Hasil Proyektor:** raster yang benar-benar dikirim/akan dikirim oleh pipeline dan guides warp; bedakan draf simulasi dan status jendela/output aktual.
- **Split (opsional):** Panggung vs Hasil Proyektor untuk QA. Jangan memaksa 3–4 monitor hidup bersamaan.

**Sumber simulasi:** pakai `DirectPuppetSession`, `PuppetSimulator`/model simulator yang sudah ada, serta frame MP4 yang sudah dipakai Track, bila kompatibel. Jangan bangun tracker, kamera kedua, atau model 3D paralel. Pertahankan identitas A/B ketika berjalan, berputar, menyilang, dan terhalang. Jika sumber mati, pengguna masih bisa memindahkan dua tubuh virtual dengan demo terlabel **SIMULASI**.

**Semua visual tetap satu sumber kebenaran:** `Track frame / event` → `Compose scene` → `Map stage transform` → `Perform output`. Footprint tidak boleh 'meluncur' menjauhi titik pijakan karena camera quad, floor coordinates, output quad, mirror, rasio layar, atau CSS transform tidak sinkron. Gunakan mapping yang sama seperti renderer sebenarnya; jika kesetaraan belum terjamin, tampilkan `Pratinjau perkiraan`, lalu perbaiki ketidakcocokan.

### Sketsa tata letak desktop
```text
┌─────────────────────────────────────────────────────────────────────┐
│ Map     [Lantai] [Tubuh]              Kamera · Siap    [Blackout]  │
├───────────────────────────────────────────────┬─────────────────────┤
│                                               │  1 Pilih           │
│      [Stage Map Monitor: 2 tubuh + lantai]     │  Lantai / Tubuh    │
│                                               │                     │
│    A     footprint      B       corner ①–④    │  2 Cocokkan        │
│     perspektif panggung, grid tipis, mask      │  [4 titik] [Reset] │
│                                               │                     │
│   [Panggung] [Kamera] [Hasil] [Split]           │  3 Uji             │
│                                               │  [Test grid]       │
│                                               │  [Simpan profil]   │
├───────────────────────────────────────────────┴─────────────────────┤
│ Status singkat / blocker                              [Ke Perform] │
└─────────────────────────────────────────────────────────────────────┘
```
Tampilan aktual harus jauh lebih bersih daripada sketsa. Di layar kecil, monitor tetap pertama, lalu panel langkah berbentuk drawer/accordion. `Blackout` selalu terlihat pada konteks output fisik.

## 4. Pangkas teks dan panel — audit dengan keputusan tegas

Buat inventaris seluruh teks, label, menu, modal, tooltip, angka, status, dan pengulangan yang tampil di Map. Untuk setiap elemen catat: **Keep / Merge / Move to Advanced / Remove**, alasan, risiko penghapusan, dan test setelah perubahan.

Aturan UI:
- Hapus judul `Compose` atau kontrol komposisi yang bocor ke Map. Tetap satu navigasi utama `Track | Compose | Map | Perform`.
- Satu judul utama `Map`, satu monitor utama, satu panel kontekstual. Jangan ulang preview besar, judul surface, status, dan tombol output di tiga tempat.
- Gunakan tombol berlabel aksi konkret: `Pilih lantai`, `Atur sudut`, `Uji proyektor`, `Simpan profil`. Hindari label seperti `SOURCE UV / DESTINATION QUAD / STAGE PORT` pada layar default.
- Buka `Advanced` hanya untuk Source Quad, Projector Quad, koreksi numerik X/Y, mask/polygon, feather, brightness, channel routing, hardware diagnosis, telemetry, atau parameter teknis lain.
- Jangan keluarkan angka koordinat semua sudut secara permanen. Saat drag, tampilkan handle bernomor dan satu hint kontekstual di dekatnya.
- Instruksi maksimal satu baris per langkah; pesan error maksimal dua baris dengan satu tindakan recovery. Detail di tooltip/bantuan bila diperlukan.
- Empty state: tampilkan contoh panggung dan aksi `Gunakan simulasi` saat belum ada kamera; jangan blank screen yang menyerupai error.
- Mikrointeraksi: highlight surface, hover/focus handle, live draft, snap opsional, undo/redo, reset with confirmation, keyboard arrows, escape, focus management, safe disabled states, loading saat switching output.
- Konsisten icon, tipografi, spacing, status, drawer, istilah dan aksi dengan Track/Compose yang terbaru; jangan tambah gaya CSS keempat yang bertabrakan.
- Komponen atau CSS lama hanya dihapus bila terbukti tidak dipakai dan regression test lolos.

## 5. Audit fungsi: kamera sampai cahaya di lantai

Jalankan pemeriksaan berurutan, **jangan menggabungkan dua jenis kalibrasi yang berbeda**:

1. **Input:** kamera/HP/MP4/simulator dari Track; satu session store, jelas asal dan confidence-nya.
2. **Camera → Floor:** empat titik di gambar kamera, dimensi lantai, perspective transform, mirror/aspect, binding ke device/resolusi, invalidasi saat sumber berubah.
3. **Tracking:** heel/toe/ankle kanan-kiri, actor ID A/B, contact estimate, hold/slide/pivot/swing. Status simulated vs detected tidak boleh tertukar.
4. **Compose → Map:** scene/layer dan geometri footprint yang sudah dipilih harus masuk tanpa duplikasi renderer dan tanpa reset yang tidak diminta.
5. **Floor → Projector:** output quad / warp, crop, mask, resolution, bounds, aspect correction, test grid, per-output routing.
6. **Body mapping:** mask bergerak pada paha–kaki A/B, kehilangan deteksi/occlusion recovery, jangan biarkan proyeksi meluas di luar mask. BODY A/B berbagi satu output BODY kecuali konfigurasi hardware benar-benar menambah output.
7. **Preview parity:** bandingkan geometrinya di monitor Map dengan frame sesungguhnya pada output window. Tandai perbedaan software preview vs bukti fisik.
8. **Safety:** Blackout/Hold/Live, permission user gesture, fullscreen secondary screen, browser tab switch, detach/reconnect, camera lost, projector lost. Perubahan quad/device/resolusi wajib membatalkan kelayakan QA terdahulu dan aman kembali ke Blackout sesuai kontrak sistem.
9. **Profile:** simpan dan muat kalibrasi sesuai identitas perangkat dan ukuran lantai; perlihatkan tanda profil usang bila hardware/sumber berubah.
10. **Handoff:** buka Perform dengan state yang sama, tanpa proyeksi test grid tertinggal, dengan gate QA yang tidak bisa dilewati dari UI.

**Jangan membuat klaim “kalibrasi otomatis”, “presisi milimeter”, “contact measured”, atau “siap proyektor” dari pose kamera 2D maupun tes browser semata.** Bukti lapangan membutuhkan pengukuran nyata.

## 6. Skenario uji / acceptance gates

Gunakan Playwright untuk screenshot desktop 1440×900, laptop 1280×800, tablet 768×1024 dan mobile 390×844; buktikan tidak ada overflow, teks menumpuk, tombol hilang, atau monitor tertimpa panel.

| ID | Uji | Lulus jika |
|---|---|---|
| MAP-01 | First-open tanpa sumber | Stage demo terlihat, satu CTA `Gunakan simulasi`, tidak blank |
| MAP-02 | Sumber Track tersedia | Frame yang sama dipakai Map, tidak minta akses kamera kedua |
| MAP-03 | Simulasi dua performer | A/B jelas, kaki kanan-kiri bergerak, footprint ikut titik pijak |
| MAP-04 | Empat sudut kamera-lantai | Drag dan validasi koordinat; salah urutan/degenerate quad ditolak |
| MAP-05 | Empat sudut proyektor | Handle di gambar proyektor, preview warp berubah, simpan/aplikasikan jelas |
| MAP-06 | Konsistensi visual | Geometri/scene Compose tetap sama setelah pindah ke Map |
| MAP-07 | Pijakan diam/pivot/slide | Tidak ada contact ganda palsu; jejak tidak bergeser tak wajar |
| MAP-08 | Dua aktor crossing/occlusion | Identitas ambigu memicu peringatan/gate aman, tidak tukar mask diam-diam |
| MAP-09 | BODY A/B | Mask A/B bergerak mengikuti paha–kaki; tidak tampil di luar batas aman |
| MAP-10 | Output tanpa proyektor | Preview dapat diuji, indikator output fisik tetap belum terverifikasi |
| MAP-11 | Perubahan kalibrasi | QA invalidated, output kembali safe, tombol Live tidak bypass |
| MAP-12 | Hold / Blackout / reconnect | Tidak ada frame residual setelah blackout; recovery dapat dijelaskan |
| MAP-13 | Profil tersimpan | Reload sesuai perangkat, tanda mismatch pada perubahan resolusi/kamera |
| MAP-14 | Handoff Perform | Konten dan routing tetap, readiness benar; tidak mengaku siap tanpa QA |
| MAP-15 | Fisik 5×5 m | Uji titik tengah dan sudut; catat error cm dan delay video high-FPS, **bukan** angka karangan |
| MAP-16 | UX usability | Operator baru bisa menemukan alur 3 langkah tanpa membuka Advanced; rekam hambatan dan klik |

Standar kuantitatif QA fisik harus ditetapkan dari hasil trial dan kebutuhan panggung yang nyata, tidak ditetapkan sepihak oleh screenshot. Catat median/P95 error dan delay bila tersedia; jika belum ada hardware, tulis `BELUM DIUJI FISIK`.

## 7. Urutan kerja Antigravity

**Phase A — Inspect & Evidence (wajib pertama)**
- Dapatkan commit SHA; jalankan `npm ci`, `npm run build`, `npm test` jika lingkungan tersedia.
- Petakan route Map, komponen aktif, ownership state, transform, output paths. Inspect live dengan browser bila dapat diakses.
- Screenshot sebelum perubahan dan inventaris kepadatan teks/panel, termasuk status error, simulasi, dan ukuran layar kecil.
- Tulis temuan `Observed / Source-reviewed / Hypothesis / Hardware-pending`. Berikan severity P0–P3; lampirkan file/line/tes/screenshot.

**Phase B — Restructure Map UX**
- Wujudkan 3 langkah dan 1 Stage Map Monitor; pindahkan panel teknis ke Advanced. Singkirkan kontrol Compose yang muncul di Map.
- Gunakan design tokens/interaksi existing, jangan redesign seluruh aplikasi.

**Phase C — Stage Simulation & Preview Parity**
- Hubungkan pose A/B, floor footprints, body mask, visual Compose, camera quad, projector quad ke visual stage yang sama.
- Lebih baik simulasi sederhana yang benar secara transform daripada mockup cantik yang tidak sinkron.
- Bedakan simulator / preview / physical QA di status dan data model.

**Phase D — Functional Regression & Device Safety**
- Jalankan MAP-01 s.d. MAP-16, build, unit, Playwright, screenshot diffs, dan tes safety. Jangan ubah Track/Compose/Perform kecuali bug integrasi terbukti dan ada regression guard.

**Phase E — Final Review**
- Beri demo bukti before/after, diagram flow 1 halaman, daftar kontrol yang dihapus/digabung, risiko tersisa, status hardware pending.
- Buat satu PR yang dapat direview. **Jangan push langsung ke `main`, jangan trigger Vercel deployment** tanpa permintaan. Gabungkan perubahan lokal agar saat disetujui cukup satu deployment akhir.

## 8. Dokumen output yang wajib dibuat di repo

- `docs/MAP_R2_AUDIT_CURRENT.md` — evidensi Map aktual, screenshot, prioritas masalah.
- `docs/MAP_R2_BENCHMARK_UX.md` — Resolume, MadMapper, TouchDesigner, MapMap; adopsi/penolakan.
- `docs/MAP_R2_FLOW_AND_UI_SPEC.md` — flow 3 langkah, wireframe desktop/mobile, state, copy final setiap kontrol.
- `docs/MAP_R2_E2E_QA.md` — tabel MAP-01..16, hasil uji, screenshot, batas QA fisik.
- Implementasi source + automated tests; satu PR beserta commit SHA.

### Format jawaban akhir Antigravity (ringkas, jangan panjang)
1. **Status**: Selesai / Parsial / Terhalang, commit SHA, branch.
2. **Masalah utama sebelum → sesudah** (maks. 5 baris).
3. **Bukti**: screenshot before/after, tests pass/fail, browser preview.
4. **Masih terhalang**: hardware, presisi fisik, multi-output, risiko P0/P1.
5. **Tindakan berikutnya**: hanya aksi operasional konkret.

**Kriteria akhir:** Map berfungsi seperti meja kalibrasi visual yang bisa dipahami dengan melihat tubuh dan panggung. Panel teknis masih tersedia saat dibutuhkan, tetapi operator biasa cukup memilih permukaan, menyesuaikan visual, menguji, lalu membawa hasil yang sudah aman ke Perform.
