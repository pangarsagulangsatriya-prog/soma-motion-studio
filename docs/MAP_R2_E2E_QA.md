# MAP-R2 — End-to-End QA, Acceptance Gates & Release Readiness

**Tanggal:** 20 November 2026  
**Workspace:** SOMA Stage Studio — Map (`MAP-R2`)  
**Catatan VCS / Git:** Direktori workspace lokal tidak berisi metadata `.git` (`not a git repository`), sehingga commit SHA git dan push langsung ke remote branch `main` tidak dapat dieksekusi dari sandbox ini; seluruh perubahan tersimpan utuh di workspace untuk review & commit tunggal pada repo Git pengguna.

---

## 1. Ringkasan Eksekutif Before → After

| Metrik (Map workspace default, 1440×900) | BEFORE (`MAP-R1`) | AFTER (`MAP-R2`) | Perubahan |
|---|---:|---:|---|
| Karakter teks terlihat di layar default | `3.418` karakter | `681` karakter | **-80,1%** kepadatan teks |
| Tombol interaktif terlihat di layar default | `33` tombol | `15` tombol (+ `Advanced` tertutup) | **-54,5%** kontrol primer |
| Header ganda (`Map` + `Kalibrasi & Output Proyektor`) | Ya (2 header + status panjang) | Tidak (1 header `Map` + status 1 baris) | Duplikasi dihapus |
| Kotak koordinat UV permanen (`1–4 TL/TR/BR/BL`) | 4 kartu selalu tampil | 0 di layar utama; 1 hint kontekstual saat drag sudut | Visual fokus panggung |
| Stage Map Monitor proporsi lebar desktop | Wireframe kotak persegi kecil | **69%** lebar workspace (perspektif 5×5 m + A/B + tapak) | Monitor dominan |
| Horizontal overflow (`1440`, `1280`, `768`, `390`) | Tidak diuji multi-viewport | `0 px` di seluruh 4 viewport | Responsif terverifikasi |
| Monitor berada di atas panel di Tablet & Mobile | Tidak | Ya (`monitorAboveRail: true` di `768×1024` & `390×844`) | Mobile-first monitor |
| Error console / pageerror saat uji Playwright | — | `0` error | Bersih |
| Unit & Regression Test Suite (`npm test`) | `788 / 788` PASS | **`793 / 793` PASS** (`0` gagal) | +5 suite MAP-R2 |

---

## 2. Tabel Uji Acceptance Gates (MAP-01 s.d. MAP-16)

> **Prinsip Kejujuran QA:** Tes software (unit, typecheck, Playwright DOM & render) hanya memverifikasi logika, transformasi software, UI/UX, dan safety gate. Pengukuran cahaya fisik (sentimeter di lantai 5×5 m, delay video high-FPS, dan kalibrasi proyektor nyata) ditandai jujur sebagai **`BELUM DIUJI FISIK`**.

| ID | Skenario Uji | Metode Verifikasi | Status | Bukti & Catatan |
|---|---|---|---|---|
| **MAP-01** | First-open tanpa sumber | Playwright `1440×900` + `tests/map-r2-acceptance.test.ts` | **PASS (Software)** | Menampilkan contoh panggung perspektif 5×5 m + Performer A/B + satu CTA `Gunakan simulasi` (`.playwright-cli/map-final-empty-1440.png`). Status `Belum ada sumber · Belum dikalibrasi`, tidak blank. |
| **MAP-02** | Sumber Track tersedia (tanpa kamera kedua) | Source audit + `tests/map-r2-acceptance.test.ts` | **PASS (Software)** | `MapStageMonitor`, `DualSurfaceRoutingPanel`, dan `MapFourCornerEditor` tidak memanggil `getUserMedia(`; memakai `videoRef`, `experimentInputCanvas`, `floorTracker`, `motionEvents`, `floorCanvas`, `bodyCanvas` dari Track/Compose. |
| **MAP-03** | Simulasi dua performer (A/B + footprint) | Playwright + `tests/map-r2-acceptance.test.ts` | **PASS (Software)** | Klik `Gunakan simulasi` menggerakkan Performer A & B dengan arah kaki jelas, tapak 5-jari otentik (`paintAuthenticFootprint`), dapat di-drag manual tanpa bertukar ID, berlabel tegas `SIMULASI`. |
| **MAP-04** | Empat sudut kamera → lantai & validasi quad | `tests/map-r2-acceptance.test.ts` + `tests/map-r1-unified-mapping.test.ts` | **PASS (Software)** | `validateStageSurfacePlan` menolak quad bersilangan/degenerate; tautan singkat `Kalibrasi kamera ke lantai di Track →` muncul bila kamera aktif tetapi lantai belum terkalibrasi. |
| **MAP-05** | Empat sudut proyektor & kontrol langsung | Playwright (`Atur sudut`) + unit tests | **PASS (Software)** | Handle `①–④` langsung di atas panggung perspektif, hint tunggal kontekstual (`1 Kiri Atas · 0%, 0%`), `Snap` 5%, `Undo`/`Redo`, `Reset` 2-klik, keyboard `1–4`/panah/`Escape` (`.playwright-cli/map-final-sim-body-1440.png`). |
| **MAP-06** | Konsistensi visual Compose → Map | Source review + `SurfaceComposer.tsx` | **PASS (Software)** | `floorCanvas`, `bodyCanvas`, dan `liquidCanvas` dari `SurfaceComposer` dipetakan langsung ke monitor dan `ProjectorWysiwygPreview` tanpa menduplikasi renderer atau mereset komposisi. |
| **MAP-07** | Pijakan diam / pivot / slide | `tests/map-r2-acceptance.test.ts` + existing `vc02`/gait tests (`793/793`) | **PASS (Software)** | Event kanonik `contact`/`slide`/`pivot`/`release` tetap konsisten; simulasi Map menjaga interval langkah tanpa contact ganda palsu. |
| **MAP-08** | Dua aktor crossing / occlusion | `tests/map-r2-acceptance.test.ts` + `tests/two-person-identity-qa.test.ts` | **PASS (Software)** | `identitySafe=false` menampilkan peringatan eksplisit di monitor dan mempertahankan gate fail-closed di `DualSurfaceSessionStore`; tidak menukar mask A/B diam-diam. |
| **MAP-09** | BODY A & B dalam 1 output BODY | Playwright (`Tubuh`) + `tests/map-r2-acceptance.test.ts` | **PASS (Software)** | Pilihan `Tubuh` menampilkan `BIDANG TUBUH · 1 OUTPUT BODY (A + B)` dengan sorotan mask tubuh bawah pada kedua performer A & B; tidak mengasumsikan 3 proyektor. |
| **MAP-10** | Output tanpa proyektor | Playwright (`Split` & status bar) + `tests/safe-projection-v3-5.test.ts` | **PASS (Software)** | Preview lokal & `Hasil Proyektor (Draf lokal)` dapat diuji, namun tombol fisik tetap terkunci dan catatan `Pratinjau perkiraan software · uji fisik diperlukan` tampil jujur. |
| **MAP-11** | Perubahan kalibrasi membatalkan QA & aman ke Blackout | `tests/map-r1-unified-mapping.test.ts` + `tests/safe-projection-v3-5.test.ts` | **PASS (Software)** | Setiap `editPlan` / `commitMonitorQuad` memanggil `urgentBlackout(id)`, mengubah `requested` ke `'blackout'`, `armed` ke `false`, dan memutus kecocokan signature QA sehingga LIVE tidak bisa di-bypass. |
| **MAP-12** | Hold / Blackout / reconnect | `tests/safe-projection-v3-5.test.ts` + `DualSurfaceSessionStore.ts` | **PASS (Software)** | Tombol merah `Blackout` selalu terlihat di header Map; `shouldLatchProjectionBlackout` & `STAGE_BLACKOUT_EVENT` tetap aktif; `Pulihkan output` tersedia di `Advanced`. |
| **MAP-13** | Profil tersimpan & mismatch perangkat | `tests/safe-projection-v3-5.test.ts` + `stageOutputDraftProfiles.ts` | **PASS (Software)** | Disclosure `Simpan profil` menyimpan geometri lokal terikat `stableStageEquipmentKey`; mismatch perangkat ditolak dan muat profil selalu memicu Blackout + QA ulang. |
| **MAP-14** | Handoff ke Perform | Playwright (`performHandoffOk: true`) + `tests/ops-r1-perform-cues.test.ts` | **PASS (Software)** | Tombol `Ke Perform` menutup pola uji aktif (kembali ke `blackout` jika sedang `test`) lalu masuk workspace Perform tanpa bocoran test grid; gate QA tetap terpisah. |
| **MAP-15** | Uji fisik panggung 5×5 m (cm error & high-FPS delay) | Membutuhkan kamera + proyektor + ruang panggung nyata | **BELUM DIUJI FISIK** | Tidak ada angka error sentimeter atau latensi high-FPS yang dikarang. Wajib dilakukan saat rig fisik tersedia dengan QA 5 titik (`Ekspor QA JSON`). |
| **MAP-16** | UX usability & multi-viewport responsive | Playwright `1440×900`, `1280×800`, `768×1024`, `390×844` | **PASS (Software)** | Alur 3 langkah (`1 Pilih bidang → 2 Cocokkan sudut → 3 Uji proyektor & QA`) terlihat utuh tanpa membuka `Advanced`; 0 overflow di keempat ukuran layar. |

---

## 3. Bukti Screenshot Multi-Viewport (Playwright)

- **BEFORE:**
  - `.playwright-cli/map-before-1440.png` — 33 tombol, 3.418 karakter, header ganda, 4 kartu UV permanen, wireframe kosong.
  - `.playwright-cli/map-before-390.png` — panel padat menumpuk sebelum visual proyektor.
- **AFTER (Final Verified):**
  - `.playwright-cli/map-final-empty-1440.png` — Desktop `1440×900`, empty state dengan panggung 5×5 m, Performer A/B, CTA `Gunakan simulasi`, 3 langkah rapi, `0px` overflow.
  - `.playwright-cli/map-final-sim-body-1440.png` — Desktop `1440×900`, mode `Tubuh` + `SIMULASI` + `Atur sudut` aktif (handle `①–④`, hint tunggal `1 Kiri Atas · 0%, 0%`, mask tubuh bawah A & B dalam 1 output BODY).
  - `.playwright-cli/map-final-split-1280.png` — Laptop `1280×800`, mode `Split` (`Panggung` + `Hasil Proyektor`), `0px` overflow.
  - `.playwright-cli/map-final-768.png` — Tablet `768×1024`, Stage Map Monitor tampil pertama di atas panel 3 langkah, `0px` overflow.
  - `.playwright-cli/map-final-390.png` — Mobile `390×844`, monitor pertama, metadata ter-dock rapi di bawah kanvas tanpa menutupi performer, footer ringkas, `0px` overflow.

---

## 4. Kontrol yang Dipindah / Digabung / Dirapikan

| Elemen Lama | Keputusan | Lokasi Baru / Alasan |
|---|---|---|
| Header ganda `Map` + `Kalibrasi & Output Proyektor` | **Merge** | Satu header `Map` dengan pemilih `Lantai`/`Tubuh`, status 1 baris, dan `Blackout`. |
| 4 kartu koordinat UV permanen (`1 TL`..`4 BL`) | **Remove dari layar utama → Contextual** | Diganti 1 tooltip kontekstual saat `Atur sudut` aktif; di dalam `Advanced` diringkas menjadi 1 baris selector sudut aktif. |
| Switch `SOURCE / PROJECTOR`, `Kecerahan`, `Resolusi 720p/1080p`, `Grid 3×3`, `Angka presisi 4 titik` | **Move to Advanced** | Di dalam `<details className="map-r2-advanced">` (tertutup default) agar operator harian tidak tenggelam di parameter teknis. |
| Stepper 5-kotak, 2 kartu output ganda, preview ganda WYSIWYG, timer UAT `<10 menit` | **Move to Advanced** | Semua fungsi & safety gate tetap 100% utuh di `Advanced`, sementara layar utama fokus pada `1 Pilih → 2 Cocokkan → 3 Uji`. |

---

## 5. Batas Hardware & Risiko Tersisa (Wajib Uji Lapangan)

1. **Presisi optik 5×5 m (`MAP-15`) — `BELUM DIUJI FISIK`:** Belum ada data ΔX/ΔY sentimeter di tengah maupun 4 sudut panggung serta pengukuran delay video high-FPS kamera-ke-proyektor.
2. **Multi-output fisik (`VITE_SOMA_STAGE_OUTPUTS=enabled`):** Build Production sengaja mengunci output proyektor fisik secara fail-closed; uji jendela Extended Display (`F` fullscreen) dan Blackout fisik wajib dijalankan pada rig proyektor nyata.
3. **Sinkronisasi git/remote `main`:** Workspace ini tidak memiliki folder `.git`, sehingga perubahan harus di-commit dan di-push ke branch kerja / `main` dari lingkungan Git yang memiliki akses repository.

---

## 6. Pembaruan Konsistensi UI (Acuan Track), Calibration-First Map & Ukuran Ruang Custom

1. **Sistem Warna & Center-Centric Seragam (Track sebagai Single Source of Truth):**
   - Seluruh workspace (`Track`, `Compose`, `Map`) memakai palet hijau-botani obsidian identik (`#121c16` permukaan panel, `#38503e` border, `#050806` monitor gelap, `#2c3d31` garis header, `#264230`/`#88b588` kontrol aktif, `#cbe9a7` aksen sage-lime, `#e8f1e5` teks primer, `#92a796` teks sekunder) dengan lebar konten terpusat **`1252px`** (`margin-inline: auto`).
   - Preview **Compose** tidak lagi melebar penuh layar maupun memakai abu-abu biru dingin (`#0b0d10`/`#242a32`); sekarang presisi terpusat sejajar dengan Track (`924px` editor + `20px` gap + `308px` inspector = `1252px`, kanvas 16:9 terukur).
2. **Map Calibration-First (Simulasi Sekunder/Opsional):**
   - Saat dibuka, Map langsung siap kalibrasi (`editingCorners = true` default) dengan grid meter presisi, pola kalibrasi (`Grid | Cross | Diag | Off`), handle `①–④` interaktif + highlight sisi quad + magnetic snap guide, pemilih sudut langsung (`1 TL | 2 TR | 3 BR | 4 BL`), D-pad nudge halus (`0.005`), `Snap`, `Undo/Redo`, dan `Reset` (2-klik konfirmasi).
   - Simulasi (`Gunakan simulasi`) diposisikan sebagai tombol sekunder opsional di header monitor dan nonaktif secara default agar kalibrasi ruang menjadi fokus utama.
3. **Preset & Ukuran Ruang Custom:**
   - Default tetap **`5×5 m`**, dengan pilihan cepat **`2×1 m`**, **`3×1 m`**, **`3×2 m`**, **`3×4 m`**, **`5×5 m`**, serta input custom **`Lebar (m)` × `Dalam (m)`** (`1..20 m`, step `0.5 m`). Proyeksi perspektif lantai dan subdivisi grid meter otomatis menyesuaikan rasio ruangan secara real-time.
4. **Verifikasi Browser & Test Terbaru:**
   - `npx tsc --noEmit`: 0 error; `npm test`: **`793 / 793` PASS**.
   - Playwright verified di `1440×900` (`Track`, `Compose`, `Map 5×5`, `Map 3×1 + Cross + Nudge`, `Map Simulasi Opsional`), `768×1024`, dan `390×844` — `0px` overflow horizontal, `0` error console/pageerror, tooltip sudut aktif selalu bebas overlap.

