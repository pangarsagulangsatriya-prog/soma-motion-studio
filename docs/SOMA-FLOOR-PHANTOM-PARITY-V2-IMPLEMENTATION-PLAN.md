# SOMA / FLOOR — Operator Flow & Phantom Floor Feature Parity V2

Tanggal: 18 November 2026
Status: Audit implementasi + rencana. Semua fitur yang tercantum sebagai target masih perlu dibangun dan diverifikasi.
Acuan: dokumen pengguna PRD SOMA / FLOOR — Phantom Floor Feature Parity v1.0 (17 Nov 2026)
Target: mempertahankan engine utama SOMA, menambah satu alur interaktif yang bisa digunakan dari Touch Demo hingga proyeksi fisik.
Prioritas pertama: F0 event contract, dilanjutkan F1 Touch → Snowfall.

## 1. Kesimpulan audit repository (main, 18 Nov 2026)

| Kemampuan | Kondisi yang terlihat di kode | Gap terhadap PRD |
| --- | --- | --- |
| Input kamera / HP / MP4 / 3D | SourceSwitcher dan ExperimentalSource sudah ada | Belum ada Touch-as-Feet yang memberi event ke semua scene |
| Dua aktor, pose dan Re-ID | VideoPoseGaitEngine, persistentActorRegistry, flow buffer ada | Akurasi pada angle overhead/crossing belum tervalidasi |
| Contact event | FootstepEventEngine + LiveFloorTrackingEngine sudah ada | Kamera hanya mengestimasi contact; benchmark false duplicate belum ada |
| Posisi lantai | coordinates.ts dan kalibrasi empat sudut sudah ada | Perlu validasi aktual empat sudut + lima titik |
| Footprints raster | floorCanvas dan floor-artwork dapat menggambar tapak/jejak | Snowfall accumulating/recovering belum ada |
| Visual / GPU | SOMA punya Hydra, SurfaceComposer, preview | Tidak ditemukan registry 13 procedural FLOOR scenes sesuai PRD |
| Projector | floorBridge, gate dan blackout tersedia | UAT proyektor nyata dan scene clean canvas masih perlu |
| Audio | Instrumen audio SOMA tersedia | Audio envelope khusus scene lantai belum tersambung |
| Privacy | Pemrosesan lokal pada jalur browser | Inspeksi jaringan untuk 0 upload otomatis belum dijalankan |

PENTING: scene selector global SOMA berisi Teks Cair, Jejak Berulang, Potongan, Siluet × Teks, Footprints. Ini tidak sama dengan 13 scene Phantom Floor. Jangan menghitungnya sebagai feature parity.

PENTING: screenshot BODY hitam dan kegagalan pose overhead ditangani sebagai regresi tracking diagnostik terpisah. Efek reaktif berbasis PRESENCE atau MOVEMENT dapat bekerja ketika AI kaki gagal, selama gerak terukur. FOOTPRINT stamp hanya boleh tercipta dari CONTACT yang lolos validasi. Jangan mencetak jejak berdasar posisi tubuh yang ditebak.

## 2. Satu alur SOMA FLOOR yang harus mudah dipahami

### Jalur coba / rehearsal (belum memakai proyektor fisik)
1. Buka Footprints → Visual → FLOOR Scenes.
2. Pilih Input = Touch Demo (default untuk uji tanpa kamera), Video MP4, atau Simulasi 3D.
3. Pilih Scene = Snowfall.
4. Sentuh/klik preview FLOOR. Dua pointer/touch yang berbeda membuat dua interaksi independen.
5. Jejak muncul, bertahan, lalu tertutup kembali. Gerakkan pointer untuk melihat reaksi permukaan.
6. Gunakan Pause, Resume, Reset; sesuaikan Radius, Intensity, Persistence.
7. Status jelas: PREVIEW SOFTWARE; OUTPUT FISIK TERKUNCI.

### Jalur instalasi live (setelah demo lulus)
1. Pilih Webcam/USB atau kamera HP.
2. Periksa apakah frame video, kehadiran, dan pose benar-benar terbaca.
3. Kalibrasikan empat sudut lantai. Jalankan lima titik QA, simpan profil kamera/display.
4. Pilih scene. Uji PRESENCE, MOVEMENT, lalu CONTACT (kiri dan kanan jika valid).
5. Buka Projector, periksa koneksi layar kedua, test pattern, dan output clean.
6. Operator menekan Go Live hanya jika existing stage safety gates mengizinkan.
7. Saat terjadi fault, blackout dapat ditekan kapan saja; tidak ada output fisik dari MP4/Simulasi 3D dalam kebijakan sekarang.

### Teks status yang harus muncul
| Kondisi | Status Studio | Perilaku |
| --- | --- | --- |
| Touch Demo | TOUCH READY | Interaksi berfungsi tanpa kamera |
| MP4 | VIDEO REHEARSAL · SOFTWARE ONLY | Preview saja, tidak membuka hardware |
| Camera blocked | CAMERA PERMISSION REQUIRED | Jelaskan masalah; tawarkan touch fallback |
| Camera 0 poses | RAW POSE 0/2 | No fabricated footstamp; generic motion only if measurable |
| 2 raw poses, A/B ambiguous | TRACKS UNCERTAIN | Movement/presence boleh merespons; stamped A/B held |
| Contact valid, calibrated | CONTACT ACCEPTED | Satu stamp pada transisi pijakan |
| Calibration mismatch | CALIBRATION INVALID | Hardware output tetap aman |
| Output lost | PROJECTOR DISCONNECTED | Operator bisa memulihkan koneksi; blackout aman |

## 3. Pipeline tunggal (semua scene menggunakan kontrak seragam)

Input: Camera / Phone / MP4 / 3D / Touch
→ Source Adapter
→ Pose Tracking ATAU Presence / Motion Estimation
→ Camera-to-Floor / Normalized Floor Space (0..1)
→ Floor Interaction Event Bus
→ tiga event berbeda: PRESENCE, MOVEMENT, CONTACT
→ Shared Scene Runtime (Snowfall, Swarm, Fog, Leaves, dst.)
→ Studio Preview (boleh menampilkan diagnostik)
→ Clean Projector Output (hanya lewat existing gate).

Aturan:
- PRESENCE: orang atau area interaksi terlihat; bisa memengaruhi fog, swarm, fireflies.
- MOVEMENT: posisi dan kecepatan valid; bisa mengusik daun, cairan, riak.
- CONTACT: foot event tervalidasi dari contact state machine; satu footprint/burst untuk satu pijakan, tidak tiap frame.
- LOST / UNCERTAIN: jangan buat footprint baru; efek lama boleh memudar.
- Touch Demo menghasilkan event simulasi, tidak mengaku data kamera.
- MP4/3D tetap software-only.
- Jangan membuat kamera kedua, decoder kedua, tracker lain per scene, atau pipeline proyektor baru.

Kontrak adapter yang diusulkan:
- source: camera, phone, mp4, simulator, touch
- kind: presence, movement, contact, jump, touch
- actorId: optional A/B atau token source
- foot: left, right, unknown
- x/y: 0..1 pada floor
- radius, speed, confidence, atMs
- provenance: simulated, calibrated-estimate, presence-only

Gunakan FootstepEvent v3 di src/footprints/spatial/events.ts untuk kontak; jangan melakukan breaking change. Adapter baru harus mempertahankan provenance dan membatasi event yang boleh menghasilkan stamp.

## 4. Desain UI/UX stage-first

- Header: [INPUT] [SCENE] [STATUS] tanpa teks panjang dan perubahan ukuran.
- Kiri: Scene Library berisi scene siap pakai; lainnya terlihat sebagai Planned/Coming Later saja, jangan buat tombol aktif palsu.
- Tengah: preview FLOOR sebesar mungkin. BODY dan INPUT bisa difokuskan untuk debugging.
- Kanan: parameter scene (Sensitivity, Radius, Intensity, Persistence, Audio).
- Bawah: Play/Pause, Reset, Touch Demo, Projector, BLACKOUT.
- Bantuan: "Cara pakai FLOOR" 6 langkah yang bisa dibuka/ditutup, bukan wizard layar penuh.
- Setup dan kalibrasi menggunakan komponen lama. Tidak mengulang control projector atau tracking.

## 5. Katalog target 13 scene / tema dari PRD

| Scene | Trigger dominan | Shared render primitive |
| --- | --- | --- |
| Snowfall | contact | persistent accumulation + re-cover |
| Christmas | contact | winter profile |
| Hanukkah | contact | winter profile + night setting |
| Spring Garden | contact/movement | growth field |
| Fall Leaves | movement | particles + advection |
| The Swarm | presence/movement | avoidance swarm |
| Ectoplasmic Fog | presence/movement | clearing field |
| Ground Smoke | presence/movement | fluid advection |
| Cursed Fluid | movement/contact | displacement |
| Living Water | presence/movement | procedural reaction |
| Fireworks | contact | independent per-step burst |
| Pool Splash | movement/jump | ripple + splash |
| Fireflies | presence/movement | particle follow + phase |

ScenePlugin interface: initialize, onInteraction, update, render, reset, dispose.
WebGL2 renderer, fallback bila diperlukan. Semua shader dan aset ditulis sendiri. Urutan pembangunan tidak mengaktifkan 12 scene sebelum scene pertama benar-benar bekerja.

## 6. Roadmap implementasi dan release gates

### F0 — Event Truth, Source Adapters, Preview Status (P0 / blocker)
Tugas: FloorInteractionEvent, source adapters, provenance, shared event dispatch, diagnostics raw pose vs A/B vs contact. Reuse existing camera tracker, FootstepEventEngine dan floor homography.
Gate: 0/1/2 orang, lost/occlusion/seek/source switch, tidak membuat kontak dari data tidak pasti; tests + E2E.

### F1 — Touch Demo → Snowfall (P0 / FIRST VERTICAL SLICE)
Tugas: pointer/touch pada main FLOOR preview menghasilkan event; ScenePlugin Snowfall dengan jejak persisten dan penutupan salju bertahap; Pause/Reset; Intensity/Radius/Persistence.
Gate: enam langkah menghasilkan enam bekas; tetap terlihat setelah kaki pergi; fade gradual; diam 10 detik tidak menduplikasi; dua pointer independen; SOFTWARE ONLY.

### F2 — Camera Presence + Floor Calibration (P0)
Tugas: presence/motion generic dari kamera, foot contact debounced dari engine lama, empat sudut + lima titik, safe fallback jika pose gagal.
Gate: dua orang menimbulkan dua reaksi berbeda; tidak ada footprint salah saat crossing; kamera gagal tetap bisa masuk Touch Demo.

### F3 — Clean Projector Output (P0)
Tugas: satu scene canvas bersih ke Projector; reuse floorBridge, calibration signature, Live/Hold/Blackout, explicit operator approval.
Gate: UAT projector nyata, kalibrasi 5 titik, tanpa UI debug di output, blackout langsung; MP4/3D tetap terkunci.

### F4 — GPU Visual Primitives (P0)
Tugas: Snowfall WebGL2, particle, ripple, advection, growth; optimasi scene switching dan quality profile.
Gate: interaksi dua orang kontinu, tidak ada texture leak; 30-minute soak test.

### F5 — 13 Scenes (P0)
Tugas: registry, preset, scene inspector; implementasi 12 tema sisa dengan primitive bersama; thumbnail/scene control.
Gate: UAT-05..11 dan UAT-18 dari PRD.

### F6 — Audio + Profiles + Release QA (P0/P1)
Tugas: audio envelope opt-in, profile kalibrasi lokal, accessible controls, network/privacy QA, satu rilis dengan CI hijau.
Gate: seluruh UAT-01..18, dokumentasi frame rate/latensi/akurasi.

### F7 — Advanced SOMA Research (P2)
Tugas: benchmark overhead 33-keypoint/A-B, heel strike/toe-off, sliding/pivot, temporal archive, RTSP via gateway.
Gate: hasil pengujian video berlabel, tidak mengklaim tekanan telapak fisik.

## 7. Target performa dari PRD pengguna (belum hasil pengukuran)

- Output target 60 FPS, minimum yang diuji 30 FPS.
- p95 touch→effect ≤150 ms; p95 camera→effect ≤250 ms.
- 2 partisipan simultan.
- Contact false duplicate ≤5% dari 100 langkah berlabel.
- Camera-floor calibration ≤5% diagonal saat awal, 2% target lanjutan.
- Stabil 30 menit per quality profile tanpa crash.
- Tidak ada upload media kamera/mikrofon otomatis.
- Seluruh UAT-01..18, termasuk uji proyektor dan tombol blackout pada perangkat nyata.

## 8. Kode yang harus dipakai / tidak boleh diulang

Reuse:
- src/studio/v3/FootprintsStageWorkspace.tsx
- src/studio/v3/FootprintsFlowInspector.tsx
- src/studio/v3/FootprintsSourceSwitcher.tsx
- src/footprints/spatial/events.ts
- src/footprints/spatial/coordinates.ts
- src/footprints/live/LiveFloorTrackingEngine.ts
- src/footprints/simulator/floorCanvas.ts
- src/projection/floorBridge.ts
- src/footprints/stage-optics/StageHardwareGate.ts

Planned new modules (F0 onward):
- src/footprints/scenes/interactionEvent.ts
- src/footprints/scenes/interactionAdapters.ts
- src/footprints/scenes/sceneRegistry.ts
- src/footprints/scenes/SceneRuntime.ts
- src/footprints/scenes/SnowfallScene.ts
- src/studio/v3/FloorSceneControls.tsx

Protected during F0/F1: BODY skeleton renderer, identity thresholds, replay inference worker, stage hardware gate, source reset policy. Perubahan ke file ini harus melalui audit regresi tersendiri.

## 9. Definisi selesai yang jujur

Plan selesai: dokumen ini masuk main.
F0 selesai: event bus benar-benar dipakai main FLOOR, status sesuai evidence, tests green.
F1 selesai: satu TOUCH→SNOWFALL loop nyata di preview utama.
F2/F3 selesai: webcam dan proyektor nyata lolos UAT.
Feature parity candidate: 13 scene, touch, kamera dua orang, audio, kalibrasi, output, UAT-01..18 pada satu SHA rilis.
Jangan mengklaim "sudah parity" hanya karena dokumen, mock UI, daftar scene, atau test fiktif.

Rujukan: PRD terlampir dari pengguna (17 Nov 2026); halaman resmi Phantom Floor https://ximfinity.itch.io/phantom-floor-interactive-projector-floor-app . Detail HTML5 versi terbaru tidak terverifikasi penuh oleh audit web.

**Keputusan urutan:** bangun F0 → F1 lebih dulu. Jangan membangun 13 efek sebelum touch dan Snowfall bekerja utuh.
