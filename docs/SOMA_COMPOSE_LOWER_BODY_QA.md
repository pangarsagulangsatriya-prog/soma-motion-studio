# SOMA Compose Lower-Body, Wide Camera & Perform Resolume Feed QA

## 1. Automated Verification
- **TypeScript (`npx tsc --noEmit`)**: 0 error.
- **Unit & Regression Test Suite (`npm test`)**: seluruh suite lama + `tests/compose-lower-body-and-resolume.test.ts` diverifikasi lulus 100%, mencakup:
  - Default kamera horizontal 16:9 (`1280×720`), tidak pernah vertikal.
  - Urutan tab Compose wajib dimulai dari `FLOOR` (`FLOOR`, `LEG A`, `LEG B`, `SPLIT`, `FOOT`, `SKELETON`).
  - 8 Quick Presets lower-body, clamp mask geometry, simulasi `STEP L/R`, `SLIDE`, `PIVOT`, `CROSSING` (*identity guard*), serta simpan preset lokal.
  - Format URL `?feed=resolume` dan kontrak tombol `SOMA Direct` / `Feed Resolume` di Perform.

## 2. Browser Visual & Interactive QA (Playwright Headless Chromium)
- **Compose (`1440×900`)**:
  - Verifikasi urutan tab mulai dari `FLOOR` dan perpindahan mulus ke `LEG A`, `SPLIT`, `FOOT`, `SKELETON`.
  - Verifikasi visual kanvas ortografis (`UPPER THIGH CUTOFF`, kaki kiri/kanan, confidence `A / B`, strip `EVENT TEST`, preset `Texture Linen`, dan mode `SKELETON`).
  - Verifikasi drawer `Advanced` terlipat secara default saat berada di tampilan lower-body/foot/skeleton.
- **Perform (`1440×900` & `1366×768`)**:
  - Verifikasi toggle `SOMA Direct` <-> `Feed Resolume`, CTA `Buka Clean Feed Resolume (FLOOR)`, tombol `Buka Feed` + `URL` per channel (`FLOOR` & `BODY`), serta muat 100% di atas lipatan layar laptop `1366×768` tanpa console error.

## 3. Batasan Kejujuran Hardware Fisik
- **Status Proyektor Fisik / Kamera Fisik / Resolume Arena Fisik**: **BELUM DIUJI FISIK** di dalam lingkungan container headless. Pengujian optik langsung pada proyektor panggung dan capture Spout/Syphon ke Resolume Arena wajib dilakukan operator pada perangkat keras panggung sebelum pertunjukan.
