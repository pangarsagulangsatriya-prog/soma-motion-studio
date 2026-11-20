# SOMA — Benchmark Produk Matang & Rencana Pemulihan

## 1. Benchmark Produk Panggung & API Browser

Evaluasi pola dari empat produk panggung matang dan dua standar browser resmi, disesuaikan dengan batasan web app SOMA.

| Produk / Standar | Pola yang Dipelajari | Keputusan | Alasan & Penerapan di SOMA | Biaya / Kompleksitas | Kompatibilitas & Lisensi |
|---|---|---|---|---|---|
| **Resolume Arena** (Advanced Output) | Pemisahan tegas *Composition* vs *Advanced Output* (Screen/Slice), pemilihan display output, input/output warp 4-titik, blackout cepat. | **ADAPTASI** | Terapkan alur `Compose` (kreatif) → `Map` (Input/Projector 4-corner quad + pemilihan output BODY/FLOOR) yang tetap persisten saat pindah tab. Tolak fitur multi-slice kompleks (>2 surface) karena di luar kebutuhan Stage 1. | Sedang (`M`) | 100% konsep desain (tanpa dependensi/kode pihak ketiga; risiko lisensi 0). |
| **TouchDesigner** (Perform Mode & Window COMP) | Pemisahan total antara mode edit dan *Perform Mode*, Window COMP khusus output bersih tanpa UI, lifecycle sesi live tetap hidup saat jendela editor ditutup/berpindah. | **ADOPSI** | Output host (`ProjectionLink` + `plans` + `proofs`) tidak boleh ikut unmount saat operator beralih antara `Map`, `Compose`, dan `Perform`. `ProjectionOutput` tetap 0 chrome. | Sedang (`M`) | Standar DOM/BroadcastChannel/postMessage; risiko lisensi 0. |
| **MadMapper** (Surfaces, Quad Warping, Scenes/Cues) | Surface `FLOOR`/`BODY` visual-first dengan drag 4 sudut langsung di layar utama, penyimpanan profil surface, dan cue grid 1-klik di Perform. | **ADAPTASI** | Angkat `MapFourCornerEditor` & WYSIWYG ke bagian paling atas layar Map (2-kolom) agar kalibrasi langsung terlihat tanpa scroll 1,300px; tampilkan cue grid berdampingan dengan monitor di Perform. | Rendah–Sedang (`S–M`) | Konsep UI asli SOMA; risiko lisensi 0. |
| **LUMOplay** (Interactive Floor Setup) | Validasi kamera & area lantai singkat berbasis checklist visual langkah cepat (sumber → cek kaki → tandai 4 sudut → uji respons). | **ADAPTASI** | Pertahankan alur linear `Track → Compose → Map → Perform`, hindari wizard modal memblokir, tampilkan validasi interaktif ringkas dan jujur terhadap limitasi kamera 2D. | Rendah (`S`) | Konsep UX; risiko lisensi 0. |
| **Browser Window Management API** (`window.getScreenDetails`, `screen.isExtended`) | Deteksi keberadaan layar eksternal/proyektor untuk membantu penempatan jendela output pada layar kedua. | **ADAPTASI (Progressive Enhancement)** | Gunakan feature-check `window.screen.isExtended` / `getScreenDetails` (Chromium) untuk mendeteksi layar kedua secara jujur. Wajib sediakan fallback universal: **Buka jendela output → geser ke layar proyektor → klik ganda / tekan `F` untuk fullscreen**. | Rendah (`S`) | Chromium desktop saja (memerlukan user gesture & izin `window-management`); Firefox/Safari jatuh ke fallback manual. |
| **Browser Fullscreen API** (`requestFullscreen`) | Fullscreen hanya valid dalam user gesture di jendela target. | **ADOPSI** | Sudah tersedia di `ProjectionOutput.tsx` (`dblclick` & `KeyF`); tampilkan petunjuk singkat 1 baris di Map saat jendela output dibuka. | Rendah (`S`) | Didukung semua browser desktop modern. |

---

## 2. Gap Matrix (Target vs Kondisi Audit)

| Dimensi | Target Produk | Kondisi Saat Audit | Gap & Dampak |
|---|---|---|---|
| **Persistensi Output lintas tab** | Kalibrasi & jendela output tetap hidup saat `Map → Perform` | Unmount `DualSurfaceRoutingPanel` menutup jendela output & reset quad/QA | **P0** — Alur `Map → Perform` gagal total di panggung |
| **Sinkronisasi Visual Compose → Output** | Efek Compose terlihat identik di preview, WYSIWYG Map, dan Proyektor | Liquid Imprint default Demo & tidak masuk ke `floorOutput` | **P0** — Operator mengedit visual yang tidak pernah tampil di proyektor |
| **Stabilisasi Navigasi Stage 1** | Pindah tab aman tanpa memutus sesi atau memunculkan toast palsu | Tiap klik tab memicu blackout + toast `"Footprints dipilih..."` | **P0** — Gangguan langsung saat rehearsal & live |
| **Ergonomi Perform** | Monitor dominan + Cue Grid + GO/Hold dalam 1 layar `1440×900` | Monitor terpotong di `y=855px`; Resume terkunci pada Simulasi/MP4 | **P0** — Operator tidak bisa melihat panggung saat menjalankan cue |
| **Ergonomi Map** | WYSIWYG + Four-Corner Editor langsung terlihat di atas fold | Halaman `2,925px`, 602 kata, 4 tombol Blackout, editor di `y > 1300px` | **P1** — Setup pertama melampaui target ≤10 menit |
| **Fokus Compose** | Langsung membuka hasil `FLOOR` saat masuk Compose | Default membuka `INPUT · 3D/MP4` | **P1** — Operator melihat layar duplikat Track |
| **Pemulihan A/B Live Camera** | Crossing ditahan lalu mudah dipulihkan | `TwoPersonIdentityTracker` terkunci sampai buka panel lanjutan | **P1** — Operator kesulitan memulihkan A/B saat rehearsal |
| **Konsistensi Bahasa & Chrome** | 1 bahasa tenang, 1 Blackout global, rail minimalis | Mix EN/ID, enum mentah `simulator`, rail kiri 220px kosong | **P2** — Beban kognitif tinggi |

---

## 3. Backlog Pemulihan (P0 → P3) & Urutan Eksekusi

| Batch | Prioritas | Item Pekerjaan | File Terdampak | Estimasi | Acceptance Test & Rollback |
|---|---|---|---|---|---|
| **Batch 1** | **P0** | **Persistensi Output & Kalibrasi Lintas Tab:** Jangan unmount `SurfaceComposer` / `DualSurfaceRoutingPanel` saat berpindah `Track ↔ Compose ↔ Map ↔ Perform` (render terpasang di Stage 1 dengan visibilitas terkontrol) agar `ProjectionLink`, `plans`, dan `proofs` bertahan utuh. | `src/studio/v3/FootprintsStageWorkspace.tsx`, `src/studio/v3/SurfaceComposer.tsx` | **M** | Buka Map → ubah 1 sudut quad → pindah ke Perform lalu kembali ke Map → sudut quad & status output tetap sama. Rollback: revert mount persistence di `FootprintsStageWorkspace.tsx`. |
| **Batch 1** | **P0** | **Sambungkan Liquid Imprint ke `floorOutput` & Default Track:** Ubah default `liquidMode` agar otomatis memakai `track` ketika sumber gerak aktif (Demo hanya eksplisit dengan label jelas) dan kompositkan `liquidCanvas` ke `floorOutput` saat aktif. | `src/studio/v3/SurfaceComposer.tsx` | **S** | Unit test + browser: di Simulasi 3D/Track, Compose langsung menampilkan `FLOOR` + jejak nyata tanpa demo palsu; `floorOutput` menerima komposisi Liquid Imprint. |
| **Batch 1** | **P0** | **Hilangkan Blackout & Toast Palsu Saat Pindah Tab Stage 1:** Hapus `requestStageBlackout` saat navigasi internal Stage 1 dan hentikan toast `Footprints dipilih...` bila `footprintsActive` sudah `true`. | `src/App.tsx`, `src/studio/v3/FootprintsStageWorkspace.tsx` | **S** | Navigasi Track → Compose → Map → Perform menghasilkan 0 toast palsu dan tidak memutus preview/output. |
| **Batch 1** | **P0** | **Perform Stage-First 2-Kolom & Resume Software Preview:** Letakkan monitor panggung utuh di atas fold berdampingan dengan Cue Grid + GO/Hold; izinkan Resume Preview pada Simulasi 3D/MP4; rapikan label sumber (`Simulasi 3D`, bukan `simulator`). | `src/studio/v3/OperatorStageConsole.tsx`, `src/studio/v3/ops-r1-perform.css`, `src/studio/v3/FootprintsStageWorkspace.tsx` | **M** | Di `1440×900`, kanvas monitor Perform memiliki `top < 260px` dan utuh di layar; Resume Preview bekerja di Simulasi 3D; unit test `ops-r1-perform-cues.test.ts` pass. |
| **Batch 2** | **P1** | **Map 2-Kolom Calibration-First & Deteksi Layar Kedua:** Angkat WYSIWYG + Four-Corner Editor ke kolom kiri atas fold; kelompokkan kontrol Output + status `screen.isExtended` + fallback manual di kolom kanan; lipat QA 5-titik & Uji Setup dalam `<details>`; hapus duplikasi tombol Blackout di Map. | `src/footprints/stage-optics/DualSurfaceRoutingPanel.tsx`, `src/footprints/stage-optics/dual-surface-routing.css` | **M** | Di `1440×900`, `Four-Corner Editor` & `WYSIWYG` terlihat di layar pertama; jumlah tombol Blackout turun dari 4 → 1 global; tinggi halaman Map turun drastis (<1,400px saat disclosure tertutup). |
| **Batch 2** | **P1** | **Compose Default `FLOOR` + Tombol Cepat `Reset A/B` di Track:** Buka `FLOOR` secara default saat masuk Compose; tampilkan tombol 1-klik `Reset A/B` di Track feedback bar ketika `identityStatus.ambiguous` aktif. | `src/studio/v3/SurfaceComposer.tsx`, `src/studio/v3/FootprintsStageWorkspace.tsx` | **S** | Masuk Compose dengan Simulasi 3D langsung memperlihatkan tab `FLOOR` aktif; tombol `Reset A/B` muncul hanya saat status ambigu. |
| **Batch 3** | **P2** | **Simplifikasi Chrome, Terminologi & Sidebar Rail:** Default sidebar kiri diciutkan (`64px`), satukan status header berbahasa Indonesia konsisten (`Sumber · Tracking · Output` tanpa pill kotak menumpuk), perbaiki label `Composer` → `Compose` dan `Kembali Build` → `Edit Compose`. | `src/studio/v3/GlobalNav.tsx`, `src/studio/v3/ux-r1-unified-shell.css`, `src/App.tsx` | **S** | Snapshot keempat workspace menunjukkan 1 terminologi seragam, 0 enum mentah, 0 horizontal scroll di `390×844`. |
| **Batch 4** | **P3** | **Optimasi Bundle & Physical Stage Acceptance:** Lazy-load `VisualStage.tsx` agar `@mediapipe/tasks-vision` tidak masuk ke main chunk 2 MB, lalu jalankan protokol uji panggung fisik 10 menit / 2 menit bersama operator manusia. | `src/App.tsx`, `src/VisualStage.tsx`, dokumentasi QA fisik | **M** | Main JS chunk turun >35%; checklist fisik E01/E02/E08/E09/E14 ditandatangani operator. |

---

## 4. Uji Manusia Minimal (Untuk Area `PHYSICAL QA PENDING`)

Karena container headless tidak memiliki kamera fisik, HP WebRTC eksternal, maupun proyektor fisik, jalankan 4 langkah singkat ini di laptop panggung setelah Batch 1–3 selesai:

1. **Uji Kamera & 2 Performer (E01–E03, ±3 mnt):** Sambungkan webcam USB overhead → Track → pilih `Webcam` & 2 performer → dua orang berjalan, berpapasan, dan berhenti → cek status A/B & tombol `Reset A/B` bila crossing mengunci.
2. **Uji Compose → Map → Perform Tanpa Putus (E05–E08, ±3 mnt):** Masuk Compose → aktifkan `Liquid Imprint` mode `Track` → masuk Map → buka jendela `FLOOR`, geser ke monitor proyektor, tekan `F` untuk fullscreen → atur 4 sudut → pindah ke tab `Perform` → pastikan jendela proyektor **tetap terbuka & aktif** dan menampilkan efek Liquid Imprint.
3. **Uji Blackout & Cabut Kabel (E09–E10, ±2 mnt):** Saat frame live berjalan, tekan `Blackout` di header (atau `B` di Perform) → pastikan proyektor gelap instan (<200ms); cabut HDMI proyektor → pastikan status berubah ke offline/terkunci blackout, bukan freeze palsu.
4. **Uji Pengukuran Waktu Setup (Target ≤10 mnt pertama, ≤2 mnt muat profil ulang):** Catat waktu aktual dari buka browser hingga efek lantai terkalibrasi di proyektor; simpan profil di Map, reload tab, muat ulang profil, dan ukur waktu pemulihan.
