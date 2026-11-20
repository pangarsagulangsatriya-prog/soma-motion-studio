# SOMA — Compose Footprint Audit Findings
**Tanggal:** 20 November 2026  
**Scope:** Tab **Compose** dan adapter kontrak data `Track → Compose → Map/Perform` (tanpa mengubah gerbang keselamatan proyektor atau membuka kamera/inferensi kedua).

---

## 1. Ringkasan Eksekutif & Provenance Pipeline
Jalur aktual yang diaudit dari sumber hingga piksel Compose:
`Camera / Video / 3D Simulator → MotionFrame / ReplayGaitEvent / FootstepEvent → interactionAdapters.ts → FloorInteractionEngine → FootMotionEventV2 → composerEventTimelineModel.ts → composerLiquidAdapter.ts → liquidImprintTimeline.ts → PixiLiquidImprintCompositor.ts (PixiJS v8 WebGL2) → SurfaceComposer.tsx`

### Status Temuan Awal (Terverifikasi dari Kode Aktual)
| ID | Prioritas | Status | Lokasi (`path:line`) | Bukti & Dampak Nyata |
|---|---|---|---|---|
| **P0-1** | **P0** | **PROVEN** | `src/footprints/scenes/interactionAdapters.ts:85-87,113-115,133-135`, `FloorInteractionEngine.ts:8-20`, `FootMotionEventV2.ts:12-19`, `composerLiquidAdapter.ts:39`, `composerEventTimelineModel.ts:50` | **Arah telapak (`headingRad`) hilang di 4 handoff.** `GaitAnalyzer` (`gait-analysis/index.ts:85-88`), `FootstepEvent` (`spatial/events.ts:13`), dan `ReplayGaitEvent` (`videoGaitAnalysis.ts:7`) sudah menghitung sudut heel→toe nyata, tetapi `interactionAdapters` tidak meneruskannya ke `FloorInteractionEngine`. Akibatnya `composerLiquidAdapter.ts:39` meng-hardcode `headingRad: item.kind==='pivot'?.62:undefined` (seluruh jejak Track selalu terkunci vertikal `0°`, dan pivot memakai sudut rekaan `0.62 rad`). |
| **P0-2** | **P0** | **PROVEN** | `src/footprints/scenes/interactionAdapters.ts:80-81,109-110,130-131` | **Event `slide`, `pivot`, dan per-foot `release` dibuang sebelum masuk Compose.** Filter `if (e.kind !== 'contact') continue` membuat fase shader/deformasi `slide`, `pivot`, dan drain `release` di `PixiLiquidImprintCompositor` mati total pada mode Track dan hanya pernah jalan di mode Demo. |
| **P0-3** | **P0** | **PROVEN** | `src/studio/v3/SurfaceComposer.tsx:559-565`, `src/footprints/scenes/interactionAdapters.ts:176-183` | **Fallback `ellipse(...)` menggantikan geometri telapak akurat.** Saat Timeline Replay aktif di Compose, `SurfaceComposer.tsx:563` menggambar oval generik vertikal (`g.ellipse`) alih-alih geometri 5-jari kiri/kanan (`paintAuthenticFootprint`) beserta `headingRad` aslinya. `paintFloorInteractionOverlay` juga menggambar oval miring tetap `Math.PI/9`. |
| **P0-4** | **P0** | **PROVEN** | `src/studio/v3/SurfaceComposer.tsx:481-483`, `src/studio/v3/composerLiquidAdapter.ts:27` | **Slider `Ukuran` dan `Durasi jejak` tidak terhubung ke renderer PixiJS.** `SurfaceComposer.tsx:482` meng-hardcode `widthPx: 118, lengthPx: 190, lifeMs: 9000`, dan `composerLiquidAdapter.ts:27` memotong event di `9000 ms`, sehingga perubahan ukuran/durasi di Inspector tidak mengubah jejak PixiJS di Stage Monitor. |
| **P1-1** | **P1** | **PROVEN** | `src/studio/v3/SurfaceComposer.tsx:772-799` | **Jargon internal & provenance sumber kurang tegas di UI operator.** Label `aria-label="Material MAT-03 Liquid Imprint"` mengekspos kode internal. Stage Monitor belum menampilkan badge provenance eksplisit (`LIVE DETECTED` / `VIDEO ESTIMATE` / `SIMULATION` / `DEMO SYNTHETIC`) untuk mencegah preview demo dikira data pelacakan nyata. |
| **P1-2** | **P1** | **PROVEN** | `src/footprints/materials/liquidMaterialShader.ts:18-79`, `SurfaceComposer.tsx:771-813` | **Satu gaya visual statis dengan satu slider (`Aliran`).** Dibanding benchmark performa creative-coding (TouchDesigner, Resolume, Hydra, LUMOplay, teamLab), Compose belum memiliki pustaka gaya visual animasi GPU yang bisa dikendalikan live (*steerable* XY pad, glow, hue, turbulence, pulse) di dalam mask telapak anatomis yang akurat. |
| **P2-1** | **P2** | **VERIFIED SAFE** | `src/footprints/materials/PixiLiquidImprintCompositor.ts:97-201` | **Single PixiJS v8 WebGL2 context (`contexts: 1`), cleanup GPU aman.** Tidak ada kamera atau inferensi ganda di Compose; hanya 1 instance `Application` dengan `autoStart: false` yang di-render sinkron dari loop RAF `SurfaceComposer`. |
| **P2-2** | **P2** | **UNVERIFIED (HARDWARE)** | `docs/FOOTPRINTS-S5-5-PHYSICAL-VALIDATION.md` | **Pengukuran akurasi fisik (cm) di panggung nyata masih pending.** Tidak ada sensor tekanan/depth fisik terhubung di lingkungan browser ini; semua klaim hardware/cm tetap ditandai *pending physical QA*. |

---

## 2. Audit Kontrol UI/UX Compose (`KEEP / MERGE / MOVE / REMOVE`)

| Elemen UI Compose | Keputusan | Alasan |
|---|---|---|
| Stage Monitor (`BODY A \| BODY B \| FLOOR \| SPLIT \| INPUT`) | **KEEP + ENHANCE** | Pusat kerja Compose; tambahkan badge provenance jujur (`LIVE DETECTED / VIDEO ESTIMATE / SIMULATION / DEMO SYNTHETIC`) agar sumber tak pernah rancu. |
| Header bar (`Compose · Preview · Display · Opsi`) | **KEEP (MERGED)** | Sudah diringkas 1 baris tanpa kotak ganda; menjaga Stage Monitor penuh *above the fold*. |
| Inspector Tabs (`Material \| Layer \| Objek`) di atas panel kanan | **KEEP** | Standar workbench visual; kontekstual sesuai permukaan/objek aktif. |
| Label internal `MAT-03` pada UI/ARIA | **REMOVE (UI)** | Ganti dengan istilah operator yang jelas (`Visual Lantai · Style & Steer`); pertahankan atribut `data-*` internal hanya bila dibutuhkan uji regresi. |
| Sumber `Track` vs `Demo` pada panel Material | **KEEP + CLARIFY** | Pisahkan jelas sebagai **`Track (Aktif)`** vs **`Demo (Uji Visual)`** dengan peringatan bahwa Demo adalah pratinjau sintetik. |
| Pustaka Gaya Visual + Live Steer XY Pad (`Flow × Turbulence`, `Glow`, `Hue`, `Pulse`) | **ADD (IN MATERIAL TAB)** | Memenuhi benchmark creative coding live performance sambil tetap 100% diklip ke mask telapak 5-jari terverifikasi. |
| Kontrol `Ukuran` & `Durasi` jejak | **KEEP + WIRE TO PIXI** | Hubungkan langsung ke `widthPx`/`lengthPx` (rasio anatomis nominal `0.095 / 0.26`) dan `lifeMs` pada PixiJS + adapter timeline. |
| `Timeline`, `Layer`, `Media` drawer | **KEEP (COLLAPSED DEFAULT)** | Tersedia saat dibutuhkan tanpa mengganggu fokus Stage Monitor. |
| Fallback `g.ellipse(...)` di Timeline Replay | **REMOVE / REPLACE** | Ganti dengan `paintAuthenticFootprint` memakai `side` (`left`/`right`) dan `headingRad` asli dari event. |
