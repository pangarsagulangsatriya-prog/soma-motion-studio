# SOMA — Perform Output Recovery & 4-Workspace Consistency QA

**Tanggal:** 20 November 2026  
**Catatan Git:** Direktori workspace lokal tidak berisi folder `.git` (`not a git repository`), sehingga commit/push langsung ke remote `main` dilakukan dari repositori Git pengguna.

---

## 1. Temuan Audit Kritis (Before → After)

| Area | Temuan Sebelum | Perbaikan |
|---|---|---|
| **Akses Output dari Perform (P0)** | `OperatorStageConsole.tsx` hanya menampilkan teks `BODY Offline · FLOOR Offline` tanpa tombol buka/fokus output. Operator terpaksa kembali ke Map. | Menambahkan kontrol output langsung di Perform lewat `DualSurfaceSessionStore` yang sama (`openDualSurfaceOutputWindow`, `closeDualSurfaceOutputWindow`, `armDualSurfaceLiveFromPerform`): 1 CTA dinamis + kontrol channel `FLOOR` & `BODY` terpisah, selalu mulai **Blackout**, fokus ulang tanpa popup ganda (`focusOutput()`), dan pemulihan inline saat pop-up diblokir. |
| **Kejujuran Cue & Kerapian Perform (P1)** | 4 kartu status + 8 slot cue permanen + banner warning membuat panel kanan meluap melewati tinggi layar `900px`. | Header 1 baris minimal identik Track (`Perform` + status global + badge `FLOOR`/`BODY` + `Edit Compose` + `Blackout`), 4 cue terdekat tampil ringkas dengan label jujur (`Pilih cue untuk mengganti layout monitor`), seluruh 8 cue + editor + `Rekam` dilipat rapi di `<details>`. |
| **Konsistensi Navigasi, Judul & Skala Monitor (P1)** | Navigasi atas & judul tiap tab bergeser horizontal (`Track` kiri vs `Compose`/`Map` tengah vs `Perform` tanpa header atas); monitor Compose tidak mengikuti batas tinggi layar laptop seperti Track (`max-height: 850px`). | Menyeragamkan seluruh 4 workspace (`Track`, `Compose`, `Map`, `Perform`) pada lebar terpusat **`1252px`**, header judul 1 baris minimal dengan tinggi/posisi konsisten, serta batas skala monitor 16:9 responsif tinggi layar (`840px` desktop, `740px` laptop `<=850px`, `600px` `<=700px`). |

---

## 2. Benchmark Operasional (Resolume / TouchDesigner / MadMapper)

- **Resolume Arena / MadMapper:** Pemisahan tegas antara *Control Console* di laptop dan *Output Window* bersih di proyektor eksternal (`Buka` → pindah layar → `F` fullscreen), dengan status target `FLOOR` dan `BODY` terbaca sekilas.
- **TouchDesigner Perform Mode:** Console pertunjukan tenang dan minimal — hanya 1 aksi primer kontekstual, ringkasan cue `AKTIF → BERIKUTNYA`, transport ringkas, dan tombol `BLACKOUT` permanen (`B` / `Esc`).

---

## 3. Ringkasan Verifikasi & Batas Fisik

- **TypeScript (`npx tsc --noEmit`):** `0` error.
- **Unit & Regression Tests (`npm test`):** seluruh suite (termasuk `tests/perform-output-recovery.test.ts`, `tests/ops-r1-perform-cues.test.ts`, `tests/audit-recovery.test.ts`, `tests/map-r2-acceptance.test.ts`, `tests/trk02-responsive-layout.test.ts`) diverifikasi PASS.
- **Browser Playwright (`1440×900`, `1366×768`, `390×844`):** verifikasi kesejajaran X/Y nav & header di 4 tab (`Track`, `Compose`, `Map`, `Perform`), Compose tidak melebar berlebihan, Perform muat 100% di atas fold, 0 error console/pageerror, `0px` horizontal overflow.
- **Uji Proyektor Fisik (Extended Display 2 proyektor, QA 5 titik nyata, latensi frame-to-light):** **`BELUM DIUJI FISIK`** — build guard (`StageHardwareGate`), fail-closed blackout, dan validasi QA 5 titik tetap dipertahankan utuh tanpa kompromi.
