# SOMA MAP-R2 — Audit Kondisi Aktual Workspace Map

- **Tanggal:** 2026-11-20
- **Commit / Workspace State:** Local workspace snapshot (direktori kerja AI Studio tidak memiliki metadata `.git`, sehingga SHA git tidak tersedia secara lokal; seluruh temuan diverifikasi langsung terhadap source tree aktif dan live preview `http://localhost:3000`).
- **Build & Test Baseline (Sebelum MAP-R2):** `npx tsc --noEmit` (0 error), `npm test` (`788/788 PASS`), `vite build` (sukses).

---

## 1. Peta Route, Komponen Aktif & Ownership State

| Layer | File & Baris | Tanggung Jawab | Status Audit |
|---|---|---|---|
| Navigasi workspace | `src/studio/v3/StageModuleNav.tsx` | Tab `01 Track › 02 Compose › 03 Map › 04 Perform` + CTA kanan | **Source-reviewed & Observed:** Konsisten 4 workspace; tidak ada kebocoran navigasi Compose. |
| Host Map | `src/studio/v3/FootprintsStageWorkspace.tsx:912-930` | Mount `SurfaceComposer` dengan `mapMode={mappingOpen}` | **Source-reviewed & Observed:** Saat `mapMode=true`, `SurfaceComposer` merender cabang khusus `.map-r1-workspace` (`SurfaceComposer.tsx:674-682`). Kontrol layer/timeline/media Compose **tidak** ikut bocor ke layar Map. |
| Panel Map utama | `src/footprints/stage-optics/DualSurfaceRoutingPanel.tsx:308-564` | Memegang surface switcher (`FLOOR`/`BODY`), kecerahan, resolusi, `MapFourCornerEditor`, `ProjectorWysiwygPreview`, stepper 5-langkah, checklist keamanan, kartu output `BODY` & `FLOOR`, QA 5 titik, profil, dan UAT setup | **Observed (P0/P1):** Terlalu padat pada layar default (`33` tombol, `5` disclosure, `3.418` karakter teks). |
| Editor 4 sudut | `src/studio/v3/MapFourCornerEditor.tsx:105-210` | Canvas backdrop + SVG 4 sudut (`PROJECTOR`/`SOURCE`) + pola overlay + 4 kartu koordinat X/Y permanen | **Observed (P0/P1):** Saat tanpa kamera, kanvas kosong/hitam seperti kotak wireframe abstrak; 4 kartu koordinat X/Y permanen memakan ~120px dan mendorong WYSIWYG ke bawah lipatan layar. |
| Kalibrasi Kamera→Lantai | `src/footprints/live/InlineFloorCalibration.tsx` | 4 titik kamera→lantai & ukuran lantai (preset `5×5 m`) | **Source-reviewed (P1):** Terpisah di workspace Track, namun di Map tidak ada tautan satu-kalimat `Kalibrasi kamera` yang membedakan registrasi kamera→lantai dari warp proyektor. |
| Preview WYSIWYG | `src/footprints/stage-optics/ProjectorWysiwygPreview.tsx:17-95` | Menampilkan raster output (`bodyOutput`/`floorOutput`) atau test pattern melalui `artworkTransform(config, w, h)` | **Source-reviewed & Observed (P1):** Menggunakan `artworkTransform` yang sama dengan jendela output, tetapi terletak jauh di bawah lipatan layar dan selalu merender 2 kartu sekaligus. Tetap bukan bukti optik fisik (`Hardware-pending`). |

---

## 2. Pengukuran Live Browser (BEFORE MAP-R2)

Bukti screenshot diambil pada headless Chromium `http://localhost:3000`:
- Desktop `1440×900` (`.playwright-cli/map-before-1440.png`): `0px` overflow, **33 tombol**, **5 disclosure**, **3.418 karakter** teks terlihat/tersusun dalam `.map-r1-workspace`.
- Mobile `390×844` (`.playwright-cli/map-before-390.png`): `0px` overflow, tetapi pengguna harus melewati 3 layer header/card bersarang sebelum melihat kotak wireframe kosong.

---

## 3. Daftar Temuan Prioritas (P0–P3)

| ID | Sev | Tipe Bukti | Lokasi | Temuan | Dampak ke Operator |
|---|---|---|---|---|---|
| MAP-F01 | **P0** | Observed | `MapFourCornerEditor.tsx:130-196` & `DualSurfaceRoutingPanel.tsx:319-391` | Saat Map dibuka tanpa sumber aktif, monitor utama hanyalah kotak wireframe kosong tanpa panggung, tanpa figur tubuh A/B, tanpa jejak kaki, dan tanpa CTA `Gunakan simulasi`. | Operator baru tidak melihat konteks panggung nyata dan mengira sistem error/blank. |
| MAP-F02 | **P0** | Observed | `DualSurfaceRoutingPanel.tsx:308-563` | 33 tombol, 2 kartu output ganda, stepper 5-langkah, kecerahan, resolusi, 4 kartu koordinat UV permanen, dan WYSIWYG bertumpuk tanpa alur 3 langkah (`Pilih → Cocokkan → Uji`). | Beban kognitif tinggi; alur kerja terasa seperti konsol debug bukan meja kalibrasi panggung. |
| MAP-F03 | **P1** | Observed | `DualSurfaceRoutingPanel.tsx:309-315` & `SurfaceComposer.tsx:674-676` | Judul ganda (`Map` + `Kalibrasi & Output Proyektor`) dan status teknis panjang di bawah judul; istilah `PROJECTOR / SOURCE`, `Target Proyektor UV`, `X 0.000 · Y 0.000` muncul di layar utama. | Pengulangan informasi dan jargon teknis membingungkan operator non-engineer. |
| MAP-F04 | **P1** | Source-reviewed | `DualSurfaceRoutingPanel.tsx:321-391` | Tidak ada preview panggung perspektif terpadu (`Panggung / Kamera / Hasil Proyektor / Split`) yang menghubungkan pose A/B, footprint Compose, mask tubuh, dan batas proyektor dalam satu monitor utama. | Operator sulit memverifikasi apakah jejak lantai dan mask tubuh A/B selaras di panggung. |
| MAP-F05 | **P1** | Source-reviewed | `SurfaceComposer.tsx:674-682` & `DualSurfaceRoutingPanel.tsx:418-442` | Tidak ada tindakan cepat `Kalibrasi kamera` (jika kamera→lantai belum siap) maupun footer CTA `Ke Perform` dengan status dominan 4-tahap yang ringkas di dalam workspace Map. | Operator bingung langkah sebelumnya (kamera→lantai) dan kapan aman masuk ke Perform. |
| MAP-F06 | **P2** | Source-reviewed | `MapFourCornerEditor.tsx:111-115` | Tidak ada Undo/Redo riwayat drag sudut, opsi Snap grid, atau konfirmasi ringan sebelum Reset Quad. | Kesalahan geser sudut sulit dibatalkan cepat saat rehearsal. |
| MAP-F07 | **P2** | Hardware-pending | `DualSurfaceRoutingPanel.tsx:467-504` | Pengukuran fisik 5 titik (cm RMSE, P95, blackout nyata, spill wajah/mata) membutuhkan rig kamera + proyektor fisik di panggung 5×5 m. | Tidak dapat diklaim lulus otomatis dari browser; harus tetap gated manual. |

---

## 4. Inventaris Elemen UI Map & Keputusan (Keep / Merge / Move to Advanced / Remove)

| Elemen di Map (BEFORE) | Keputusan | Alasan | Risiko & Guard |
|---|---|---|---|
| Judul `Map` (`SurfaceComposer.tsx:675`) | **Keep** | Satu judul workspace utama konsisten dengan Track/Compose. | — |
| Sub-header `Kalibrasi & Output Proyektor` | **Remove** | Duplikasi judul di bawah `Map`. | Pastikan `aria-label` section tetap jelas untuk aksesibilitas. |
| Switch `FLOOR / BODY` | **Merge → `Lantai / Tubuh`** | Bahasa operator panggung jelas; tetap sinkron ke `selected` (`'floor' \| 'body'`). | Pertahankan perilaku toggle `selected` dan tes `DualSurfaceRoutingPanel`. |
| Status panjang `bodyStatus · FLOOR ... · Status cahaya...` | **Merge → 4 Status Dominan** | Ganti dengan 1 status dominan (`Belum dikalibrasi`, `Siap diuji`, `Perlu QA fisik`, `Siap Perform`) + 1 baris blocker kontekstual + tag sumber kecil. | Jangan hilangkan fakta bahwa output fisik belum terverifikasi. |
| Kotak wireframe `WARP 4 SUDUT` berdiri sendiri | **Merge → Stage Map Monitor** | Gabungkan handle 4 sudut interaktif langsung ke Stage Map Monitor (`Panggung / Kamera / Hasil Proyektor / Split`); tetap pertahankan `MapFourCornerEditor` pada mode edit/Advanced agar kompatibel penuh dengan `editPlan` & guard MAP-R1. | Jaga `onCommit`, `onReset`, `ArrowLeft`, `AlignmentOverlay`, dan `urgentBlackout` 100% utuh. |
| 4 kartu koordinat permanen (`1 · TL X 0.000 · Y 0.000` dst.) | **Move to Advanced + Inline Active Hint** | Mengurangi clutter; saat drag/fokus tampilkan 1 baris koordinat sudut aktif di dekat kanvas, angka presisi 4 titik tetap di `Advanced`. | Uji keyboard `1-4` + panah tetap bekerja. |
| Switch `PROJECTOR / SOURCE`, `Kecerahan`, `Resolusi 720p/1080p`, `Grid 3×3`, `Angka presisi 4 titik` | **Move to Advanced** | Parameter teknis optik tidak perlu memenuhi layar utama operator baru. | Tetap tersedia 1 klik dalam drawer `Advanced` dan mempertahankan semua guard `map-r1`. |
| Dua kartu output besar (`BODY` + `FLOOR`) & `Uji setup (<10 menit)` selalu terbuka | **Move to Advanced (ringkas di Step 3)** | Step 3 menampilkan aksi fokus untuk surface aktif (`Uji proyektor`, `QA Fisik 5 Titik`, `Simpan profil`, `Blackout`) sementara kontrol dual-window lengkap & UAT timer tersusun rapi di `Advanced`. | Pertahankan seluruh handler `open`, `close`, `changeMode`, `shouldLatchProjectionBlackout`, `STAGE_HARDWARE_ENABLED`. |
| Tombol `Blackout` | **Keep (always visible)** | Keselamatan proyektor wajib selalu dapat diakses satu klik. | Terhubung langsung ke `allBlackout()` / `urgentBlackoutDualSurface`. |
