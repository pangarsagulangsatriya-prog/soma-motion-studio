# SOMA — Audit Fungsional End-to-End (Tracking → Compose → Map → Perform → Projector)

```text
SOMA AUDIT SNAPSHOT
Branch / commit / deployment: Workspace lokal AI Studio (tanpa metadata .git; repo target pangarsagulangsatriya-prog/soma-motion-studio; dev server http://localhost:3000; build production Vite 6.4.6 + TS 5.7.2)
E2E status: FAIL (terdapat 4 P0 show-stopper pada keberlanjutan output proyektor lintas tab, blackout otomatis saat pindah tab, isolasi visual Compose→Output, dan monitor Perform terpotong/terkunci)
Tracking nyata: PARTIAL — MediaPipe PoseLandmarker (33 landmark) nyata pada CameraTracker (webcam/HP) & VideoPoseGaitEngine (MP4) + DirectPuppetSession (Simulasi 3D); hardware kamera fisik & MP4 2-orang belum dapat diuji langsung di container headless (PHYSICAL QA PENDING)
Actor A/B: PARTIAL — MP4 memakai MoveNetIdentityTracker + PersistentActorRegistry (re-ID appearance); kamera live memakai TwoPersonIdentityTracker yang mengunci permanen saat crossing sampai reset manual
Visual → mapping: FAIL — Material Liquid Imprint (PixiJS v8) di Compose dikunci hanya preview software & default Demo, tidak pernah mengalir ke floorOutput / StageRoute / ProjectionOutput
Output monitor/proyektor: FAIL — ProjectionOutput (?bodyProjection=...&stageSurface=...) bersih (0 tombol, 0 teks chrome), TETAPI berpindah dari Map ke Perform/Compose langsung meng-unmount DualSurfaceRoutingPanel dan menutup paksa kedua jendela proyektor + menghapus kalibrasi & QA
Blackout / recovery: PARTIAL — Global Blackout bekerja (0 console error), tetapi navigasi antar tab memicu blackout otomatis; Map memiliki 4 tombol Blackout terpisah; Perform mengunci Resume Preview saat sumber non-kamera
P0: 4 | P1: 4 | P2: 4 | P3: 2
3 masalah terbesar:
1. Unmount DualSurfaceRoutingPanel saat meninggalkan tab Map menutup paksa jendela proyektor & menghapus quad kalibrasi serta bukti QA 5 titik.
2. Material visual Compose (Liquid Imprint) default di mode Demo dan terputus total dari floorOutput / StageRoute sehingga preview Compose ≠ output proyektor.
3. Workspace Perform mendorong monitor panggung ke bawah fold (y=855px), mengunci Resume Preview pada simulasi/MP4, dan tab switching memicu blackout + toast palsu berulang.
Keputusan UX utama:
- Hapus: Toast "Footprints dipilih..." saat sudah di Stage 1, duplikasi tombol Blackout di dalam panel Map/Perform (sisakan 1 Blackout global + status lokal), prefix mekanis "04 / DUAL-SURFACE OUTPUT ROUTING", default Demo yang menimpa data Track aktif.
- Gabung: Status kesehatan header (Sumber · Tracking · Output dalam satu bahasa), Map 2-kolom (WYSIWYG + Four-Corner Editor di atas fold; QA 5 titik & profil dalam disclosure terstruktur), Perform layout stage-first (monitor berdampingan dengan cue grid).
- Pertahankan: 4 workspace lokal Stage 1 (Track, Compose, Map, Perform) dengan satu session & output host persisten; ProjectionOutput tanpa chrome; safety gate blackout untuk perubahan optik/kalibrasi.
Implementasi pertama yang direkomendasikan: Batch P0 — Persistenkan host output proyektor & kalibrasi lintas tab (Map ↔ Perform ↔ Compose), hubungkan visual Compose ke floorOutput, hilangkan blackout/toast palsu saat navigasi, dan perbaiki layout stage-first Perform & Map.
Yang belum bisa diuji: Kamera overhead fisik, koneksi WebRTC HP nyata lintas LAN/HTTPS, proyektor fisik 1 & 2 layar (Display API multi-monitor), serta 2 performer manusia sungguhan (ditandai PHYSICAL QA PENDING).
```

---

## 1. Inventaris Aktual & Arsitektur Jalur Data

### 1.1 Lingkungan Uji & Build Baseline

| Item | Nilai Terukur | Bukti |
|---|---|---|
| Runtime Node | `v22.23.2` | `node -v` |
| Framework / Bundler | React `19.0.0`, Vite `6.4.6`, TypeScript `5.7.2`, PixiJS `8.23.0`, MediaPipe `0.10.22-rc.20250304`, Hydra `1.4.0` | `package.json` |
| Unit Tests (`npm test`) | **769 pass / 0 fail** (16.22s) | `node --experimental-strip-types --test tests/*.test.ts` |
| Production Build (`npm run build`) | **PASS** (16.94s) — `dist/assets/index-*.js` = **2,038.23 kB** (541.72 kB gz), `index-*.css` = **559.14 kB** (89.85 kB gz) | `tsc -b && vite build` |
| Dev Server & Browser QA | `http://localhost:3000` diuji via Chromium headless (`playwright-cli`), `1440×900` & `390×844` | 0 console error pada seluruh layar |
| Deployment Parity | `.git` tidak tersedia di sandbox; `vite.config.ts` memakai `base: '/soma-motion-studio/'` saat `mode === 'githubpages'`; `StageHardwareGate.ts` mengunci output fisik di production kecuali `VITE_SOMA_STAGE_OUTPUTS=enabled` | `vite.config.ts:3`, `StageHardwareGate.ts:9-11` |

### 1.2 Arsitektur Rantai Data Aktual

```text
[INPUT]
  ├── Webcam / USB ──► CameraTracker (src/engine/tracking.ts) ──► MediaPipe PoseLandmarker (worker / CPU)
  ├── Kamera HP    ──► PhoneCameraReceiver (WebRTC) ──► CameraTracker
  ├── Video MP4    ──► FootprintsExperimentalSource ──► VideoPoseGaitEngine (MoveNetIdentityTracker + PersistentActorRegistry)
  └── Simulasi 3D  ──► DirectPuppetSession (src/footprints/simulator/puppet-controller.ts)
           │
           ▼
[POSE / ACTOR ID / FOOT CONTACT]
  ├── Live 1 orang : StudioFootprints ──► GaitAnalyzer ──► LiveFloorTrackingEngine (FootstepEventEngine)
  ├── Live 2 orang : StudioFootprints ──► MultiPoseGaitRouter ──► TwoPersonIdentityTracker ──► LiveFloorTrackingEngine
  ├── Video MP4    : VideoPoseGaitEngine ──► GaitAnalyzer ──► FloorInteractionEngine (via feedVideoFloorInteractions)
  └── Simulasi 3D  : DirectPuppetSession.session ──► FloorInteractionEngine (via feedSimulatorFloorInteractions)
           │
           ▼
[VISUAL ENGINE & COMPOSITION]
  ├── floorCanvas (FootprintsStageWorkspace) ◄── paintFloorCanvas / paintExperimentFloor
  ├── bodyCanvas  (FootprintsStageWorkspace) ◄── buildLowerBodyMask / paintExperimentBody
  ├── SurfaceComposer (Compose tab)
  │     ├── PixiLiquidImprintCompositor (MAT-03) ──► HANYA digambar ke preview canvas & composeFloorOverlay (PUTUS ke floorOutput!)
  │     ├── bodyOutput / floorOutput ──► hanya menggambar media layer + floorCanvas lama (tanpa Liquid Imprint)
  │     └── stageRoute ref ──► dikirim ke DualSurfaceRoutingPanel
  └── [PUTUS SAAT PINDAH TAB!] DualSurfaceRoutingPanel hanya ter-mount saat mapMode === true
           │
           ▼
[CALIBRATION / WARP & OUTPUT WINDOW]
  ├── DualSurfaceRoutingPanel ──► MapFourCornerEditor (sourceQuad/projectorQuad) + 5-Point QA
  ├── ProjectionLink (BroadcastChannel + window.open + ImageBitmap postMessage)
  └── ProjectionOutput (?bodyProjection=<id>&stageSurface=body|floor) ──► CSS matrix3d(artworkTransform) + WebGL/2D renderer
```

### 1.3 Peta Fitur Aktual

| Fitur | Lokasi File Utama | Status Aktual | Bukti |
|---|---|---|---|
| Navigasi Stage 1 (Track/Compose/Map/Perform) | `src/studio/v3/StageModuleNav.tsx`, `GlobalNav.tsx`, `App.tsx` | **Aktif (bermasalah UX/lifecycle)** | Pindah tab memicu `requestStageBlackout` & toast `Footprints dipilih...` |
| Input Webcam / USB + Pose 33 titik | `src/engine/tracking.ts`, `src/engine/poseWorker.ts` | **Aktif (PHYSICAL QA PENDING)** | Kode real MediaPipe + fallback CPU; hardware kamera tidak ada di container |
| Input Kamera HP (WebRTC) | `src/stage/PhoneCameraReceiver.tsx`, `PhoneCameraSender.tsx`, `api/phone-pair.ts` | **Parsial / PHYSICAL QA PENDING** | Protokol & UI ada, butuh 2 perangkat nyata |
| Input Video MP4 + Dual Actor Re-ID | `src/stage/VideoPoseGaitEngine.ts`, `src/stage/persistentActorRegistry.ts` | **Aktif (teruji unit test)** | Unit test S6.8.8.1–7 pass; belum diuji dengan berkas MP4 nyata di browser |
| Input Simulasi 3D (Direct Puppet) | `src/footprints/simulator/puppet-controller.ts`, `FootprintsExperimentalSource.tsx` | **Aktif & Berfungsi** | Diuji di browser: Langkah kiri/kanan menghasilkan kontak sintetis & muncul di Track + Compose |
| Gait & Foot Contact Engine | `src/footprints/gait-analysis/index.ts`, `src/footprints/spatial/events.ts` | **Aktif & Teruji Unit** | Debounce stance/swing/pivot/slide mencegah double-stamp saat diam/pivot |
| Live 2-Person Identity (`TwoPersonIdentityTracker`) | `src/footprints/live/TwoPersonIdentityTracker.ts` | **Parsial (Lock Permanen)** | Crossing memicu `identityLocked = true` hingga reset manual; tanpa auto-recovery |
| Compose Visual & Liquid Imprint (PixiJS v8) | `src/studio/v3/SurfaceComposer.tsx`, `PixiLiquidImprintCompositor.ts` | **Parsial / Terputus ke Output** | PixiJS merender 50 FPS di preview Compose, namun default Demo & tidak dikirim ke `floorOutput` |
| Map 4-Corner Calibration & Dual Output | `src/footprints/stage-optics/DualSurfaceRoutingPanel.tsx`, `MapFourCornerEditor.tsx` | **Rusak saat pindah tab (P0)** | `DualSurfaceRoutingPanel` ter-unmount di luar Map → `dispose()` menutup jendela output & menghapus state |
| Perform Cue Grid & Operator Console | `src/studio/v3/OperatorStageConsole.tsx`, `performCueModel.ts` | **Parsial / Rusak Layout** | Monitor terpotong di bawah 900px; cue hanya ubah view monitor; Resume terkunci pada sumber non-kamera |
| Projection Output Window | `src/projection/ProjectionOutput.tsx`, `src/projection/channel.ts`, `artwork.ts` | **Aktif & Bersih** | Diuji di `?bodyProjection=audit-e08&stageSurface=floor`: 0 tombol, 0 teks UI, 2 canvas bersih, shortcut `F`/dblclick fullscreen |
| Legacy Instruments / Tools (Hydra, Sound, Archive, Photo) | `src/VisualStage.tsx`, `src/archive/*`, `src/photos/*` | **Terisolasi di Tools (static import membengkakkan bundle)** | `VisualStage.tsx` static import `@mediapipe/tasks-vision` membuat main chunk 2.04 MB |

---

## 2. Matriks Pengujian Wajib E01–E14

*Perangkat uji: Linux container, Node v22.23.2, Headless Chromium (`playwright-cli`), resolusi desktop `1440×900` dan mobile `390×844`.*

| ID | Skenario | Hasil | Bukti & Catatan Terukur |
|---|---|---|---|
| E01 | Buka aplikasi baru, pilih sumber, izinkan kamera | **PARTIAL / PHYSICAL QA PENDING** | Buka `http://localhost:3000`: 0 error, `scrollHeight=900px`, dropdown sumber berfungsi (`Simulasi 3D` langsung aktif). Izin kamera fisik tidak tersedia di container headless. |
| E02 | Gunakan video dua performer | **NOT TESTED (Browser) / PASS (Unit)** | Unit test `s6-8-8-2-multi-actor.test.ts` & `video-pose-gait.test.ts` pass; belum ada sampel video MP4 2-performer di workspace untuk uji browser. |
| E03 | Dua performer saling silang & menutupi | **FAIL (Live Camera) / PASS (Unit MP4)** | `TwoPersonIdentityTracker.ts:37-41` mengunci permanen (`identityLocked=true`) saat crossing tanpa pemulihan otomatis saat terpisah kembali. Jalur MP4 (`MoveNetIdentityTracker`) lulus unit test recovery. |
| E04 | Berjalan, berhenti, slide, pivot, berjalan lagi | **PASS (Unit + Simulasi 3D Browser)** | Unit test `footprints-adaptive-gait.test.ts` & `footprints-floor-events.test.ts` pass; di browser `Langkah kiri` + `Langkah kanan` menghasilkan 2 kontak tepat tanpa duplikasi saat diam. |
| E05 | Ubah scene/layer/parameter | **FAIL** | Mengubah parameter Liquid Imprint di Compose mengubah preview software (50 FPS), tetapi TIDAK memengaruhi `floorOutput` / `StageRoute` (`SurfaceComposer.tsx:455-456`), dan default `Demo` menimpa jejak nyata. |
| E06 | Kalibrasi empat titik FLOOR, simpan, muat ulang | **FAIL (Session Loss antar tab)** | `MapFourCornerEditor` bekerja secara visual & draft profil bisa disimpan ke `localStorage`, namun pindah dari Map ke Compose/Perform menghapus state `plans` di memori karena `DualSurfaceRoutingPanel` unmount (`DualSurfaceRoutingPanel.tsx:52-55`). |
| E07 | Pindah BODY/FLOOR, uji dua surface | **PARTIAL** | Pilihan `BODY` / `FLOOR` dan WYSIWYG preview ada di Map, tetapi WYSIWYG tampak hitam pada Simulasi 3D dan `DualSurfaceRoutingPanel` hancur saat keluar dari tab Map. |
| E08 | Kirim tampilan ke display kedua | **FAIL (Lifecycle) / PASS (Clean Window)** | `?bodyProjection=audit-e08&stageSurface=floor` bersih (0 tombol, 2 canvas, 0 teks). Namun di Map production output terkunci (`StageHardwareGate`), tidak ada Window Management API, dan pindah ke Perform menutup jendela output. |
| E09 | Putuskan & sambungkan display/proyektor | **PARTIAL (Unit) / PHYSICAL QA PENDING** | `shouldLatchProjectionBlackout` mengunci blackout saat `link.connected` putus dan tombol berubah ke `Pulihkan output` (`DualSurfaceRoutingPanel.tsx:114-122,472`). Belum teruji pada proyektor fisik. |
| E10 | Blackout saat frame sedang berjalan | **PASS (Software) / PHYSICAL QA PENDING** | Klik `Blackout` global di Perform selesai tanpa error (~480ms termasuk Playwright settle), memicu `STAGE_BLACKOUT_EVENT` & `SOFTWARE_PREVIEW_BLACKOUT_EVENT`. |
| E11 | Reload, ganti kamera, tutup popup, izin ditolak | **PASS (Unit & Code Trace) / PARTIAL (Browser)** | `CameraTracker.stop()` membersihkan track & worker; `ProjectionLink.ack` memvalidasi `origin/source/session`; `App.tsx:146` memakai `sourceChangeLock` mencegah double-stream. |
| E12 | Sesi panjang, ubah scene berulang | **PARTIAL** | `VideoPoseGaitEngine` membatasi history 5.000 event & 64 segmen; `LiveFloorTrackingEngine` membatasi 100.000 event. Namun remount `SurfaceComposer` berulang kali menciptakan & menghancurkan konteks PixiJS v8 setiap kali pindah tab. |
| E13 | Audit keyboard & aksesibilitas | **PARTIAL** | Semua kontrol utama punya `aria-label` & `<button>` native, mobile 390px 0 horizontal overflow (`scrollWidth=390`). Cacat: fokus `Map` terlalu panjang (34 tombol, 31 input), konflik shortcut & toast menutupi kontrol bawah di 390px. |
| E14 | Dua output fisik (FLOOR + BODY) | **PHYSICAL QA PENDING** | Protokol dual `ProjectionLink` (`body` + `floor`) ada di kode, tetapi terputus saat keluar tab Map dan memerlukan 2 proyektor fisik untuk verifikasi akhir. |

---

## 3. Daftar Temuan Bug (Terurut Berdasarkan Prioritas)

| ID | Sev | Area | Actual | Expected | Evidence | Root Cause | Recommendation | Verification |
|---|---|---|---|---|---|---|---|---|
| **F-01** | **P0** | Map → Perform Output Lifecycle | Pindah dari Map ke Perform/Compose langsung meng-unmount `DualSurfaceRoutingPanel`, memanggil `ports[id].dispose()`, menutup kedua jendela proyektor, dan menghapus `plans` serta `proofs`. | Jendela proyektor, kalibrasi 4-titik (`plans`), dan status QA (`proofs`) tetap hidup saat operator berpindah antar tab `Track ↔ Compose ↔ Map ↔ Perform`. | `FootprintsStageWorkspace.tsx:48,330`, `SurfaceComposer.tsx:624-631`, `DualSurfaceRoutingPanel.tsx:48-58,161-167` | State `ProjectionLink`, `plans`, dan `proofs` disimpan lokal di komponen Map yang di-unmount saat ganti tab. | Angkat kepemilikan state kalibrasi (`plans`, `proofs`) & pertahankan `SurfaceComposer` / `DualSurfaceRoutingPanel` ter-mount (CSS `hidden` atau host persisten di `FootprintsStageWorkspace`) agar output tidak mati saat pindah tab. | Buka output di Map → pindah ke Perform & Compose → pastikan `ports` tetap tersambung, jendela tidak tertutup, dan quad kalibrasi tetap utuh. |
| **F-02** | **P0** | Compose → Projector Visual Sync | Material Liquid Imprint PixiJS di Compose default ke `Demo` (menimpa pijakan nyata) dan tidak pernah disalin ke `floorOutput` sehingga output Map/Proyektor tidak menampilkan visual yang diedit di Compose. | Saat sumber Track aktif, Liquid Imprint otomatis membaca event Track (dengan opsi Demo eksplisit berlabel) dan hasil komposisi FLOOR mengalir konsisten ke `floorOutput` / WYSIWYG / Proyektor. | `SurfaceComposer.tsx:123,449-456,485-497`, `.playwright-cli/audit-compose-floor.png` | `SurfaceComposer.tsx:455` sengaja memisahkan `liquidCanvas` dari `floorOutput` dan menginisialisasi `liquidMode` ke `'demo'`. | Otomatis arahkan `liquidMode` ke `'track'` saat sumber gerak aktif (Demo hanya bila dipilih/belum ada input, dengan badge jelas) dan kompositkan `liquidCanvas` ke `floorOutput` saat `liquidEnabled` aktif. | Uji Simulasi 3D / Track di Compose → verifikasi jejak Liquid Imprint muncul di `floorOutput` & WYSIWYG Map tanpa demo palsu. |
| **F-03** | **P0** | Tab Navigation Side Effects | Setiap klik tab `Track / Compose / Map / Perform` memanggil `requestStageBlackout()` dan `selectScene('footprints')` sehingga output langsung padam & toast kuning `"Footprints dipilih. Hubungkan kamera Body..."` terus muncul menutupi panggung. | Berpindah tab di dalam Stage 1 tidak boleh memadamkan output panggung secara sepihak dan tidak boleh menampilkan toast "Footprints dipilih" saat sudah berada di Stage 1. | `App.tsx:339-348,195-201`, `FootprintsStageWorkspace.tsx:660`, `.playwright-cli/audit-compose-1440.png`, `audit-map-1440.png`, `audit-perform-1440.png` | `onNavigateStageWorkspace` selalu memanggil `requestStageBlackout` dan `selectScene('footprints')` meski `footprintsActive` sudah `true`. | Hapus blackout paksa pada navigasi tab internal Stage 1 (pertahankan blackout hanya saat ganti sumber kamera / masuk Tools / klik Blackout eksplisit) dan jangan tampilkan toast `Footprints dipilih` jika sudah aktif. | Klik Track → Compose → Map → Perform berurutan; pastikan 0 toast palsu dan status output tidak di-blackout otomatis. |
| **F-04** | **P0** | Perform Stage Visibility & Rehearsal Lock | Di Perform (`1440×900`), preview panggung terdorong ke `top: 855px` (hampir seluruhnya terpotong di bawah fold), dan `Resume Preview` terkunci (`disabled`) saat Simulasi 3D/MP4 aktif atau kamera mati. | Preview panggung dominan terlihat utuh di atas fold berdampingan dengan Cue Grid + kontrol GO/Hold/Blackout, dan mode preview software (Simulasi 3D/MP4) tetap bisa di-Hold/Resume untuk latihan. | `OperatorStageConsole.tsx:27-102`, `FootprintsStageWorkspace.tsx:325-333,602-619`, `.playwright-cli/audit-perform-1440.png` | `OperatorStageConsole` merender blok vertikal tinggi di atas `.fp-stage-overview`, serta `operatorMode` langsung men-set `hold:true` dan `performUnsafe` memblokir `canResume`. | Rancang ulang layout Perform menjadi 2-kolom (monitor panggung dominan di kiri/atas, cue grid + transport di kanan/bawah), izinkan Resume preview software pada mode Simulasi/MP4, dan perbaiki label sumber manusiawi. | Buka Perform pada `1440×900` → monitor panggung tampil penuh di atas fold (`top < 250px`), Resume Preview aktif pada Simulasi 3D, GO & Hold berjalan mulus. |
| **F-05** | **P1** | Compose Default View | Saat membuka Compose dengan sumber Simulasi 3D atau MP4, `previewArrangement` otomatis diset ke `'input'` sehingga layar menampilkan input mentah yang sama persis dengan Track, bukan hasil komposisi `FLOOR`. | Compose harus langsung menampilkan `FLOOR` (hasil visual komposisi) agar operator langsung melihat efek & layer yang sedang diracik. | `SurfaceComposer.tsx:88-89`, `.playwright-cli/audit-compose-1440.png` | `useEffect(() => { if(experimentSource) setPreviewArrangement('input'); }, [experimentSource])`. | Ubah default `previewArrangement` ke `'surface'` (`FLOOR`) untuk semua sumber, tetap sediakan tombol `INPUT` opsional di bar monitor. | Pilih Simulasi 3D → klik Compose → Stage Monitor langsung membuka `FLOOR`. |
| **F-06** | **P1** | Map Calibration Buried & Layout Overload | Halaman Map setinggi `2925px` (3.25× layar) dengan 602 kata, 34 tombol, 31 input; editor 4-sudut baru muncul di `y > 1300px`. | WYSIWYG Preview & Four-Corner Editor terlihat langsung di layar pertama (`1440×900`), sedangkan QA 5-titik, profil tersimpan, dan uji timer 10 menit berada di panel/disclosure rapi. | `DualSurfaceRoutingPanel.tsx:383-591`, `.playwright-cli/audit-map-1440.png`, `audit-map-scroll.png` | Seluruh kartu status, dokumentasi, dan QA ditumpuk vertikal sebelum editor kalibrasi. | Tata ulang Map ke grid 2-kolom bersih: Kiri = WYSIWYG + Four-Corner Editor + pemilihan Surface (`FLOOR`/`BODY`); Kanan = Kontrol Output & Disclosure (Profil, QA 5-titik, Uji Setup). | Buka Map pada `1440×900` → Four-Corner Editor dan WYSIWYG keduanya terlihat tanpa scroll berlebih, jumlah tombol Blackout turun dari 4 → 1 global (+ status per surface). |
| **F-07** | **P1** | Live 2-Actor Crossing Permanent Lock | Pada kamera live 2 performer (`TwoPersonIdentityTracker.ts`), begitu dua orang berdekatan (`< 0.115`), `identityLocked` menjadi `true` permanen dan tidak pernah pulih otomatis setelah berpisah kembali. | Identitas ditahan saat ambigu/crossing (tidak diam-diam tertukar), lalu menyediakan jalur pemulihan otomatis terkontrol (atau tombol reset instan di Track) ketika kedua tubuh terpisah jelas dan stabil. | `src/footprints/live/TwoPersonIdentityTracker.ts:37-41,98` | `this.identityLocked = true` di-check di baris 37 sebelum mengevaluasi frame baru, tanpa syarat keluar selain `reset()`. | Pertahankan sifat fail-safe saat crossing (unit test ada), tambahkan tombol `Reset A/B` cepat di Track feedback bar saat `identityStatus.ambiguous === true` agar operator bisa memulihkan dalam 1 klik tanpa membuka panel lanjutan. | Unit test `footprints-d2-identity.test.ts` tetap hijau + tombol pemulihan A/B tampil instan di Track saat status ambigu. |
| **F-08** | **P1** | Production Projector Lock & Multi-Display Guidance | `StageHardwareGate.ts` mengunci tombol `Buka output` di build production (termasuk GitHub Pages), dan belum ada deteksi display kedua (`getScreenDetails()` / `window.screen.isExtended`) atau panduan fallback jelas. | Deteksi dukungan layar kedua bila API tersedia, serta izinkan mode output window terpisah yang bersih dengan panduan fallback manual (`Buka output → pindahkan ke proyektor → tekan F`) dan tetap hormati safety gate hardware. | `StageHardwareGate.ts:9-11`, `DualSurfaceRoutingPanel.tsx:206-230`, `channel.ts:14-16` | Guard build-time `VITE_SOMA_STAGE_OUTPUTS` memblokir seluruh pembukaan jendela proyeksi di production tanpa opsi Preview Window eksternal. | Tambahkan deteksi layar kedua (`window.screen.isExtended` + optional `getScreenDetails` feature-check) dan tombol **Buka jendela output** dengan instruksi fallback 1-baris bila API multi-layar tidak tersedia. | Cek Map di browser: deteksi status layar tampil jujur, tombol buka output & fallback manual jelas. |
| **F-09** | **P2** | Terminologi Campuran & Redundan | Header memakai `SOURCE:` + `Belum terhubung`; Perform memakai `ACTIVE SOURCE: simulator`, `OFFLINE BODY`, `Kembali Build`; Map memakai `04 / DUAL-SURFACE OUTPUT ROUTING`; Compose berjudul `Composer`. | Satu kosakata konsisten (Bahasa Indonesia ringkas + istilah teknis panggung universal: `Track`, `Compose`, `Map`, `Perform`, `FLOOR`, `BODY`, `Blackout`). | `GlobalNav.tsx:174-177`, `OperatorStageConsole.tsx:30-41`, `DualSurfaceRoutingPanel.tsx:384`, `SurfaceComposer.tsx:635` | Penambahan fitur bertahap lintas sprint (S5.7 → S6.8 → IA-R1 → V5) tanpa penyatuan kosakata. | Seragamkan seluruh label status, judul workspace, dan tombol aksi sesuai tabel terminologi di `SOMA_AUDIT_UIUX.md`. | Snapshot DOM keempat workspace: 0 enum mentah (`simulator`), 0 prefix `04 /`, 0 tombol `Kembali Build`. |
| **F-10** | **P2** | Bundle Size & CSS Fragmentation | Main JS chunk `2,038 kB` (`VisualStage.tsx` meng-import statis `@mediapipe/tasks-vision`) dan 35+ file CSS patch menumpuk menjadi `559 kB` CSS. | Code-splitting MediaPipe & konsolidasi aturan layout tanpa menumpuk override `!important`. | Output `npm run build`, `FootprintsStageWorkspace.tsx:60-85` | Import statis di modul legacy & CSS patch per tiket (`trk02`..`trk09`, `cp01`..`cp04`). | Audit & dokumentasikan jalur lazy-load `VisualStage` (Batch P3) serta rapikan CSS terpusat untuk layout recovery baru. | `npm run build` tetap lulus tanpa regresi. |
