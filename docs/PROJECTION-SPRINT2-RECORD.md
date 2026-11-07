# SOMA Projection — Sprint 2 / Studio 11

## Kondisi awal dan lingkup

Audit dimulai dari commit Sprint 1 7fac93b4adfd48a8002bd6dd185c728d29bb5242. Working tree bersih. Seluruh 74 tes baseline lulus sebelum perubahan. PoseLandmarker sudah mengeluarkan masker; kamera, video element, MotionFrame, audio dan rekaman sudah dibagi oleh SOMA. Tidak diperlukan kamera atau tracking engine baru.

Sprint 2 memperluas modul yang sama. Source switching Hands/Body/Face, teks, Hydra, foto, kamera gestural, suara, Archive, dan rekaman tetap memakai App yang sama. Instrumen lama tetap terpasang selama Projection Workspace terbuka.

## Implementasi per story

| Story | Implementasi |
| --- | --- |
| S2-01 | Calibration Studio, empat titik drag/keyboard/numerik, grid/crosshair, ukuran raster aktual, draf, Reset, Apply, Save. |
| S2-02 | Dua jalur terpisah: warp komposisi ke layar; registrasi empat pasangan titik kamera asli ke raster proyektor. Preview sumber dan tujuan diberi nomor sama. |
| S2-03 | Bounding box dari piksel masker, Follow Body/Fixed Position, skala, offset, rotasi, mirror, crop, silhouette/outline, clipping bidang. |
| S2-04 | Filter posisi/ukuran adaptif, strength, responsiveness, confidence, Hold/Fade/Blackout, metrik browser terukur. |
| S2-05 | Preset JSON v2, perangkat/resolusi, matriks yang diperiksa terhadap titik, migrasi v1, catatan perbedaan perangkat, draf sebelum Apply. |
| S2-06 | Mode Body Mapping tetap menampilkan batas bidang datar; satu aktor, area dan jarak terbatas, offset manual. Belum mengoreksi permukaan 3D. |

## Aliran data

1. CameraTracker membuka atau memakai kembali stream utama SOMA.
2. Pada Body, engine mencoba satu classic worker dengan OffscreenCanvas. Bundle MediaPipe terkunci memakai importScripts; predev/prebuild menyalin bundle CJS resmi dari node_modules ke public/wasm.
3. Worker menerima ImageBitmap, menjalankan PoseLandmarker, menyalin masker gabungan 96 × 96 untuk fitur lama dan masker aktor pertama 256 × 256 untuk Projection. Worker menutup hasil MediaPipe serta bitmap setelah penyalinan.
4. Kamera utama menunggu satu hasil pada satu waktu. Tidak ada antrean frame tanpa batas. Sampel kamera teramati yang dilewati saat worker sibuk dihitung. Inisialisasi worker yang gagal mengembalikan proses ke detektor utama; kegagalan saat inferensi menghentikan sesi kamera dengan pesan untuk sambung ulang.
5. MotionProcessor mengubah hasil deteksi menjadi MotionFrame yang sama untuk suara, visual, Archive dan Projection. Telemetry menambahkan durasi inferensi, pipeline, backend, serta jumlah sampel dilewati.
6. ProjectionModel memeriksa sumber, umur sampel, confidence, masker dan pose. Bounding box berasal dari piksel masker. BodySmoother menghaluskan pusat serta ukurannya. Masker tetap berasal dari frame terbaru.
7. Renderer menerapkan matriks penempatan, crop, homografi dan clipping. WebGL mengerjakan sampling shader; Canvas 2D 480 × 270 menjadi fallback ketika WebGL tidak tersedia.
8. BroadcastChannel membawa kontrol dan heartbeat. Masker disalin lalu ditransfer melalui postMessage dengan pemeriksaan origin, opener, session, sequence dan ukuran. Maksimal satu buffer menunggu acknowledgement. Raw/smoothed bounds ikut dikirim agar kedua renderer menempatkan gambar dengan cara yang sama.
9. Output hanya merender kanvas. F atau klik dua kali meminta fullscreen. Hilang kontrol lebih dari 2,8 detik memadamkan output, termasuk Hold. Masker Live yang berhenti juga memadamkan output.

## Dua transformasi yang dipisahkan

**Bidang layar:** H_screen memetakan persegi komposisi ke empat sudut bidang output. Kamera masuk melalui aspect fit, orientasi cermin, koreksi posisi/ukuran, serta penyesuaian artistik.

**Registrasi:** H_registration memetakan titik kamera asli langsung ke titik raster proyektor. Empat pasangan perlu menunjukkan tanda yang sama pada satu bidang fisik. H_screen tidak dikalikan lagi pada jalur registrasi. Batas layar tetap memotong citra.

Matriks memakai koordinat normal 0–1. Editor mengubahnya menjadi piksel kamera/raster output aktual. Raster dan viewport dibedakan dalam preset. DPI, letterboxing, posisi jendela dan posisi perangkat masih perlu diperiksa pada layar fisik.

Pengujian numerik memeriksa pasangan titik yang tidak bertepatan dengan sudut kamera, invers, interior, dan degenerasi. Pengujian tersebut memeriksa aljabar; hasilnya tidak menunjukkan galat proyeksi dalam cm pada panggung.

Untuk pengukuran fisik awal, gunakan Follow Body, strength 0, mirror mati, offset 0, rotasi 0, skala 1. Smoothing dan penyesuaian artistik sengaja mengubah posisi citra.

## Draf dan sesi berjalan

Editor sudut serta pasangan titik mengubah draf preview. Output tetap memakai konfigurasi sebelumnya sampai Apply. Save dan Export menyimpan draf. Recall/Import memuat draf dan catatan perangkat tanpa membuka webcam atau memulai rekaman. Apply mempertahankan Live/Hold/Blackout.

Kontrol Gerak dan Output mengubah gambar langsung. Perubahan live ikut masuk ke draf agar Apply berikutnya tidak mengembalikan slider lama. Batalkan draf mengembalikan nilai yang sedang dipakai output.

Preset v1 tetap tersedia untuk migrasi. Preset lama tidak diberi klaim perangkat yang sudah terverifikasi. Perbedaan kamera, dimensi kamera, raster output, viewport atau DPR ditampilkan saat recall. Pemilihan webcam tetap dilakukan operator.

## Smoothing dan kehilangan tracking

Filter eksponensial memperhalus pusat serta lebar/tinggi bounding box. Konstanta waktu bergerak dari sekitar 8–120 ms menurut strength, lalu berkurang sesuai kecepatan dan responsiveness. Ini parameter algoritme, bukan hasil ukur latensi panggung. Strength 0 melepas filter. Gap, kehilangan tracking dan reacquisition mereset filter agar citra tidak mengejar posisi lama.

Fixed Position menggeser pusat ke tengah komposisi; bentuk serta ukuran dari pose terbaru tetap berubah. Siluet tidak dibekukan. Outline mengambil tepi masker, bukan rangka pose. Crop memotong koordinat kamera asli sebelum transformasi.

Hold manual menyimpan citra saat tombol ditekan. Hold saat tracking hilang memakai citra terakhir. Fade mengatur opacity menurut waktu berlalu; Blackout tetap menimpa keduanya dan pola grid.

## Pengukuran dan batasnya

FrameMetrics menghitung rata-rata FPS dan nearest-rank P95 dari maksimal 600 interval render terakhir. Output melaporkan angka itu lewat heartbeat, terpisah dari preview. Ekspor JSON menyertakan waktu ekspor, perangkat, ukuran output, serta keterbatasan metrik.

Telemetry kamera membedakan durasi pemanggilan detektor dari keseluruhan pipeline di browser. Sampel dilewati dihitung dari frame kamera yang teramati saat worker sibuk. Angka ini tidak mengukur semua frame yang hilang di perangkat, driver, OS, decoder, atau proyektor.

Umur sampel menghitung sejak timestamp frame dikirim ke detektor. Penjelasan Sprint 1 yang menyebutnya waktu setelah inferensi telah diperbaiki. Tidak ada klaim motion-to-photon dari metrik ini.

## Daftar perubahan file

| File | Perubahan |
| --- | --- |
| src/projection/geometry.ts | Homografi pasangan titik, invers, komposisi matriks dan validasi quad. |
| src/projection/motion.ts | Bounding box masker dan filter adaptif. |
| src/projection/metrics.ts | Pengukuran interval render dan P95. |
| src/projection/presets.ts | Schema v2, perangkat, matriks, migrasi dan catatan kompatibilitas. |
| src/projection/model.ts | Konfigurasi Sprint 2, Follow/Fixed, fade, filter dan matriks komposisi. |
| src/projection/renderer.ts | Sampling WebGL/CPU dengan crop, outline, transformasi terpisah dan crosshair. |
| src/projection/CalibrationStudio.tsx | Editor piksel, overlay drag/keyboard, kamera sumber, kontrol draft/Apply. |
| src/projection/MotionControls.tsx | Pengaturan gerak dan smoothing live. |
| src/projection/ProjectionWorkspace.tsx | Tab Gerak/Kalibrasi, metrik terukur, catatan preset, label Studio 11. |
| src/projection/useProjection.ts | Draft/applied state, preset v2, ekspor metrik, migrasi. |
| src/projection/channel.ts | Bounds dan telemetry output di jalur komunikasi yang sama. |
| src/projection/ProjectionOutput.tsx | Validasi kontrol v2, bounds dan laporan renderer; perbaikan cleanup heartbeat. |
| src/projection/projection.css | Editor registrasi, status draf, metrik dan kontrol responsif. |
| src/engine/poseWorker.ts | Bridge satu frame untuk worker, timeout dan pelepasan resource. |
| public/workers/soma-pose.js | Worker MediaPipe classic untuk pose/siluet, tanpa stream kamera kedua. |
| public/wasm/vision_bundle.cjs | Salinan bundle MediaPipe versi paket terkunci untuk loader worker. |
| src/engine/tracking.ts | Worker preferred, fallback utama, pengukuran inferensi/pipeline, sampel dilewati. |
| src/engine/types.ts | Telemetry opsional pada MotionFrame. |
| src/App.tsx | Label Studio 11; integrasi utama tetap dipakai. |
| scripts/prepare-pose-worker.mjs / scripts/setup-assets.mjs | Siapkan bundle worker dari paket lokal. |
| package.json | predev/prebuild menyiapkan aset worker. Tidak menambah dependensi. |
| tests/projection-s2.test.ts | Geometri, gerak, smoothing, fade, schema, matriks, kompatibilitas dan metrik. |
| tests/pose-worker.test.ts | Copy masker sebelum close, projection opt-in dan error cleanup worker. |
| tests/projection.test.ts | Regression Sprint 1; versi schema baru yang didukung. |
| tests/projection-browser.tsx | Integrasi App nyata dengan batas hardware sintetis, kontrol Sprint 2 serta output sync. |
| docs/PROJECTION-MANUAL.md | Panduan operator Sprint 2 dan protokol fisik Mac/HDMI. |
| docs/PROJECTION-SPRINT1-RECORD.md | Catatan Sprint 1 dipertahankan sebagai rekam pengembangan. |
| docs/PROJECTION-ENGINE.md | Audit, daftar file, hasil dan batas pengujian Sprint 2. |
| scripts/build-projection-manual.py / public/projection-manual.html | Panduan yang dibuka dari aplikasi. |
| public/SOMA-PROJECTION-MANUAL.md / public/SOMA-PROJECTION-ENGINE.md | Unduhan panduan dan laporan. |
| README.md / public/soma-source.zip | Titik masuk dan paket sumber yang mengikuti rilis. |

## Pengujian aktual — 28 Oktober 2026

- Baseline: 74 tes kode lulus sebelum perubahan.
- Suite terbaru: 95 tes lulus, termasuk 18 tes Sprint 2 dan tiga tes resource worker.
- Build TypeScript/Vite lulus. Peringatan ukuran chunk dan impor MediaPipe campuran tetap tercatat; tidak ada error kompilasi.
- Browser App nyata: 40 pemeriksaan lulus dengan kamera serta pose sintetis. Mencakup 22 alur Sprint 1 dan draft/Apply, grid/crosshair, pasangan sumber–tujuan, registrasi, mirror, outline, Follow/Fixed, offset, rotasi, crop, smoothing live, confidence, fade, metrik, dan isi preset v2.
- Browser output sync: tujuh pemeriksaan lulus. Piksel output tetap sama saat draf diedit, berubah sesudah Apply, serta cocok dengan preview untuk outline, skala, crop dan registrasi. Blackout menimpa transformasi. Fixture memilih mode Bidang layar secara eksplisit sebelum menguji draf geometri.
- Regresi kamera gestural: 16 pemeriksaan lulus. Perintah suara kamera membuka bingkai yang sama, telapak mengubah ukuran, pukulan menyimpan crop JPEG, empat slot dan penggantian slot bekerja, tracking hilang tidak memicu foto, Clean dan rekaman tetap berjalan, serta penolakan mikrofon menyediakan kontrol manual. Suara, video dan landmark sintetis menggantikan batas hardware; App, gestur, audio, penyimpanan dan rendering tetap aktual.
- Ekspor JSON melalui UI menghasilkan preset v2 berisi matriks, perangkat dan registrasi. Impor memulihkan titik serta status registrasi. Berkas uji dengan identitas kamera, resolusi kamera dan raster output berbeda memunculkan tiga catatan kompatibilitas yang sesuai.
- Saat pengujian awal, cleanup React pada output melepas canvas ref sebelum heartbeat berhenti. Akses ref tersebut memicu error. Renderer kini menyimpan elemen kanvas dalam closure; pengujian ulang 40 alur lulus.
- Browser cloud tidak menyediakan WebGL. Pemeriksaan citra memakai renderer Canvas 2D aktual dan transport lintas jendela aktual. Pose serta video diganti pada batas perangkat untuk uji deterministik.
- Unit worker memakai stub detektor untuk memeriksa protokol, buffer dan cleanup. MediaPipe fisik dalam worker, akselerasi GPU, kualitas segmentasi dan perilaku Mac belum diverifikasi pada perangkat panggung.

| Target fisik | Status aktual |
| --- | --- |
| 30 FPS stabil pada proyektor | Belum diukur |
| P95 motion-to-photon <=150 ms | Belum diukur; kamera eksternal belum tersedia |
| Galat registrasi pada bidang datar | Belum diukur pada kain/layar fisik |
| Kiri/kanan, mendekat/menjauh, berputar | Perlu aktor dan perangkat fisik |
| Sesi berkelanjutan minimal 20 menit | Belum diuji dengan webcam dan proyektor fisik |
| Akurasi proyeksi pada kulit 3D | Di luar klaim Sprint 2 |

Tidak ada hasil fisik yang diisi dengan angka sintetis. Panduan memuat cara mencatat FPS/P95, uji titik tambahan, latensi eksternal, dan sesi 20 menit.

## Antarmuka Sprint 3

ShapeEngine dan TimeEngine tetap berada di ports.ts. ProjectionImage membawa masker, timestamp, rawBounds dan smoothed bounds. Shape menerima citra terbaru dan konteks gerak; Time dapat menyimpan citra bertimestamp dalam buffer terbatas. Implementasi Stretch/Shrink/Split/Merge/Delay/Echo belum aktif. Hold memberi freeze manual yang sudah diuji, terpisah dari efek artistik berikutnya.

## Referensi primer

- https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js
- https://docs.opencv.org/4.13.0/d9/dab/tutorial_homography.html
- https://developer.mozilla.org/en-US/docs/Web/API/Window_Management_API
- https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
- https://support.apple.com/en-gb/guide/mac-help/mchlb5f905a1/mac
