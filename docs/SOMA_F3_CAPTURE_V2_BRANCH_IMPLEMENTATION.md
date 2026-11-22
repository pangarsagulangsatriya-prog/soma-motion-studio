# SOMA F3 Capture V2 — Audit, Rencana, dan Catatan Implementasi

**Sumber:** PRD V2 `SOMA_F3_CAPTURE_PRD_V2_FULLSCREEN_STAGE.md`.  
**Batas rilis:** branch `feat/f3-capture-v2-fullscreen-stage` dan draft PR #161. Dilarang merge ke `main` atau deploy GitHub Pages/Vercel sebelum persetujuan.

## Audit `main` (baseline `1e52f250`)

| Komponen SOMA | Temuan | Keputusan F3 |
|---|---|---|
| `CameraTracker` — `src/engine/tracking.ts` | Mengelola stream, MediaPipe, liveness, worker; memilih **body atau hands**. | Default Track tidak disentuh. F3 memiliki satu adapter pose+hands dari **snapshot pixel A yang sama**. |
| `CameraLiveness` | Memeriksa perubahan `currentTime`, batas stale 8 detik. | Dipakai dalam registry bersama gate rana lebih ketat 850ms. |
| `CameraFraming` | Smoothing wrist, displacement, zoom lama, crop persegi. | Prinsip stabilisasi direuse; F3FramingController sendiri untuk pinch+dual-hand spread, crop B beraspek 1,36 dan clamp 20–100%. |
| `useCameraCue` / `photoSignal` | Trigger foto lama, sumber kamera tunggal, pinch bisa trigger. | Tidak dipanggil F3. F3PunchEngine mempunyai tahap prepare → impact → cooldown → neutral-rearm; resize mendahului punch. |
| `capturePhoto` | `src/photos/store.ts` mengekstrak JPEG dari area piksel video. | Dipakai untuk Kamera B live, ROI persis seperti StageRenderer; fallback `drawImage` yang sama untuk MP4 fixture. |
| `usePhotoArchive` dan `soma-photo-wall` | IndexedDB persisten, risiko pencampuran dengan foto penonton. | F3PhotoStore memori saja, 4 slot, consent, undo/replace/ZIP, tanpa pengiriman data jaringan. |
| HP/phone | `src/engine/landscapePhoneCamera.ts` dan integrasi sumber Stage 1 tersedia. Kelas bernama `PhoneCameraReceiver` tidak ditemukan pada lokasi standar audit. | Input F3 menerima `videoinput` (USB/Continuity) dan MP4; adapter WebRTC HP khusus F3 belum disambungkan. |
| GlobalNav / App | Global sidebar Stage 1 & Stage 2. | Item F3 Capture ketiga; `StageModuleNav` tidak diubah. |
| Map/Perform — BODY/FLOOR | `DualSurfaceSessionStore` mempunyai otorisasi LIVE, QA, gate hardware, `urgentBlackoutDualSurface`. | F3OutputAdapter mengacu ke **BODY**, fail-closed. Jalur FLOOR dipertahankan. Tombol proyektor F3 belum dapat membuka output fisik. |

## Rencana pelaksanaan dan kemajuan

| Tahap | Target | Kondisi |
|---|---|---|
| F3-00 | Audit main, branch terisolasi, draft PR | Kode dibuat pada branch; baseline main tetap |
| F3-01 | Kamera A/B independen, dua MP4 berbeda | Registry dan generator fixture tersedia; uji real dua kamera masih diperlukan |
| F3-02 | Pose+hands satu frame A | F3MotionFusion memakai buffer canvas dari frame A tunggal sebelum dua inferensi |
| F3-03 | Pinch zoom, Strict Straight/Uppercut, B pixel capture | Implementasi + tes positif/negatif dan cooldown |
| F3-04 | StageRenderer kanonik 2:1, empat foto kiri, video B kanan | Painter canvas sama di Setup dan fullscreen; projector adapter mengacu painter sama |
| F3-05 | Fullscreen klik, Esc tidak restart, fallback inline | Implementasi; pengujian browser otomatis diperlukan |
| F3-06 | Output projector 1 melalui gate Map/Perform, FLOOR tidak berubah | **Blocked oleh validasi panggung**; tidak membuka output proyektor dari prototype |
| F3-07 | Screenshot 1366/1440, E2E, dua kamera nyata, Safari/HP, rehearsal 15 menit | Dalam pengujian; uji perangkat fisik belum dijalankan |

## Kontrak Stage View

- Canvas gambar: 1600 × 800 (2:1) dengan letterbox bila layar berbeda.
- Empat slot 2×2 pada 30% kiri; gutter 2%; video piksel B 68% kanan.
- Kamera A dan skeleton tetap di Setup; keluar fullscreen tidak merestart media stream.
- Saat source hilang, slot lama bertahan, panel video tidak menampilkan frame stale.
- Local Fullscreen aktif setelah A/B fresh. Consent + gesture verification hanya untuk mengaktifkan rana, bukan untuk membuka Stage View.
- Simulasi dua MP4 berlabel **SIMULASI**, tidak dibaca sebagai hasil kamera sungguhan.

## Acceptance yang perlu dibuktikan

1. Build TypeScript, 886+ tes regresi, QA khusus gestur dan ROI.
2. E2E dua video berbeda: `Coba Fullscreen` → 0/4 → zoom tanpa jepret → 2/4 → 4/4 → `Esc` dengan source ID dan currentTime tetap.
3. Screenshot Setup, 0/4, 2/4, 4/4 pada 1366×768 dan 1440×900.
4. Kamera A/B fisik (USB/Continuity/WebRTC yang didukung), iPhone/Android, browser Safari/Chrome, latensi P95, false trigger pada 15 menit gerak negatif.
5. Verifikasi pengaman blackout serta output projector 1/BODY, proyektor 2/FLOOR pada perangkat panggung.

**Tidak ada klaim hasil uji fisik atau proyektor.** Keluaran stage yang sudah divalidasi pada QA browser tidak menggantikan kalibrasi proyektor, tes cahaya, dan pengujian aktor.

## Risiko desain terbuka

- Preset Straight/Uppercut berbasis landmark dua dimensi memerlukan latihan kamera/angle. Forward-punch belum dibuka.
- Benchmark P95 ≤150 ms crop, P95 ≤400 ms foto, dan 0 false trigger selama 15 menit belum terukur.
- Chrome dan Safari berbeda dalam dukungan codec MP4, MediaDevices, dan Fullscreen. Fixture CI di-encode sebagai MP4 VP9 untuk Chromium; file produksi memerlukan codec browser-supported.
- Koneksi HP yang tidak terdaftar sebagai `videoinput` masih memerlukan adapter WebRTC terpisah tanpa menggandakan sesi kamera Track.
- Uji proyektor F3 belum memperoleh sertifikasi; adapter BODY tetap fail-closed dan tombol output dinonaktifkan.
