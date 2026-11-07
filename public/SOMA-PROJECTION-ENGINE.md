# SOMA / PROJECTION — Studio 12 · Sprint 3

## Audit dan integrasi

Baseline Sprint 2: commit `839f2b963f931b9a2612673ceba11733670b52c7`, 95 tes kode lulus. Kamera utama, MotionFrame, pose, segmentation, audio, Archive dan rekaman sudah dibagi. Organic memakai data yang sama; tidak membuka webcam atau detektor tambahan. Catatan Sprint 2 disimpan dalam `PROJECTION-SPRINT2-RECORD.md`.

## Implementasi

| Story | Hasil |
| --- | --- |
| S3-01 | OrganicBodyEngine dengan konfigurasi tervalidasi, timestamp kamera, bentuk dan keluaran alpha mask. GPU WebGL dengan fallback CPU yang diberi status. |
| S3-02 | Stretch/Shrink manual atau mengikuti intensitas gerak, sumbu horizontal/vertikal/arah gerak, anchor pusat/kepala/bahu/pinggul/tangan, pengaruh lokal/global dan recovery. |
| S3-03 | Split 2–8 bidang horizontal/vertikal, perkiraan tiga zona anatomi, offset, delay tiap irisan, Satukan. Anatomi berbasis zona pose, tidak mengisolasi anggota tubuh yang saling menutupi. |
| S3-04 | Delay 0–5 detik, Echo 1–6 lapisan termasuk tubuh utama, jarak waktu dan fade, Freeze komposisi, Release. |
| S3-05 | Merge tubuh sekarang dengan riwayat atau pasangan tersimpan, blend, konvergensi, union/interpolasi alpha. Residue di ruang layar atau terpotong siluet saat ini. |
| S3-06 | Pustaka cue lokal, Save/Load/Duplicate/Rename, ekspor/impor JSON, Previous/Next/GO, transisi, pintasan kurung siku dan Z. Kalibrasi fisik tidak dipanggil oleh cue artistik. |
| S3-07 | Tab Organic, preview siluet live dan komposisi terpisah, pipeline ke Clean Output yang sama, metrik proses/memori, panduan operator. |

## Aliran kamera sampai proyektor

1. CameraTracker dan MotionProcessor SOMA menghasilkan satu MotionFrame, pose dan mask. Worker serta fallback Sprint 2 tetap dipakai.
2. ProjectionModel menolak sampel usang atau confidence rendah, menghitung bounds, smoothing, Follow/Fixed dan kebijakan kehilangan tracking.
3. Organic menyimpan sampel bertimestamp dalam ring buffer terbatas. Pemilihan Delay/Echo memakai waktu frame, tidak memakai nomor frame.
4. Shape layer menerapkan penempatan tubuh yang dihaluskan, crop kamera, threshold masker, deformasi lokal/global, dan potongan sumber. History mempertahankan pose serta bounds milik frame tersebut.
5. Compositor menggabungkan lapisan menjadi satu alpha mask. GPU memakai shader inverse-warp dan tekstur yang digunakan kembali; hasil dibaca menjadi buffer alpha. CPU memakai algoritme sampling yang sama pada resolusi lebih kecil.
6. Masker komposisi bertanda `processed` melewati renderer kalibrasi Sprint 2. Crop/threshold kamera tidak diterapkan dua kali. Homografi, mirror, rotasi, skala, clipping bidang, outline dan brightness tetap berada di jalur akhir.
7. Studio mengirim satu masker selesai melalui jalur postMessage/ack yang sama. BroadcastChannel tetap membawa kontrol dan heartbeat. Studio dan Clean tidak menghitung riwayat masing-masing, sehingga frame artistik yang dikirim sama.
8. Blackout menimpa Freeze/Hold/pola. Heartbeat yang hilang tetap memadamkan Clean.

Saat Organic belum diaktifkan, jalur render Sprint 2 dipertahankan. Preview kecil membaca citra live sebelum Organic; Freeze hanya menahan komposisi artistik. Kamera, data gerak, suara dan rekaman tetap berjalan.

## Waktu, memori dan kegagalan

Riwayat maksimal 300 masker 128 × 128, umur 12 detik, frekuensi penyimpanan paling tinggi 24 sampel/detik. Batas masker riwayat sekitar 4,69 MiB; angka ini tidak mencakup pose, objek JavaScript, framebuffer, GPU atau renderer SOMA lainnya. Residue maksimal 24 masker; interval rekam mengikuti durasi. Freeze, pasangan, Hold dan transisi menyimpan sejumlah salinan tetap.

GPU Organic merender 256 × 256, fallback CPU 128 × 128. Resolusi mask berbeda dari raster proyektor. Tidak ada janji kualitas detail kulit pada keluaran 1080p. Penskalaan kualitas otomatis belum tersedia. Readback GPU menambah biaya yang perlu diukur di laptop panggung.

Reset Organic melepas buffer/tekstur dan mengembalikan konfigurasi artistik. Keluar dari workspace ketika jendela output juga tertutup melepas engine; masuk kembali membuat resource seperlunya. Pergantian mode memakai resource yang sama. Hilang konteks WebGL memadamkan komposisi dan memberi pesan; Reset Organic membuat ulang engine.

Hold membekukan komposisi saat transport berubah. Freeze mengambil komposisi sebelum homografi, sehingga koreksi proyektor masih bisa diubah. Crop/deformasi yang sudah dibekukan baru berubah setelah Release. Residue ruang layar bertahan terhadap gerak aktor, namun mengikuti perubahan kalibrasi seluruh komposisi. Residue body-clipped hilang di luar siluet saat ini. Kehilangan tracking mengikuti Hold/Fade/Blackout; bekas artistik dan Freeze bisa bertahan sesuai pengaturan, sedangkan tombol Blackout selalu memadamkan.

## Preset dan cue

Format `soma-organic` versi 1, maksimal 32 cue dan impor 100 KB. Nilai angka, enum, ID, nama dan versi divalidasi. Pustaka menyimpan parameter artistik serta nama referensi kalibrasi. Tidak menyimpan stream, izin perangkat, pixel history, status rekaman, atau matriks kalibrasi fisik. Impor memuat pustaka; operator menekan GO untuk memainkan cue. Storage gagal menghasilkan pesan dan ekspor JSON tetap tersedia.

## Berkas berubah

| Berkas | Perubahan |
| --- | --- |
| src/projection/organic/config.ts | Konfigurasi, validasi dan schema pustaka cue. |
| src/projection/organic/history.ts | Ring buffer timestamp, salinan frame dan downsample. |
| src/projection/organic/shape.ts | Anchor pose, inverse warp, penempatan dan irisan. |
| src/projection/organic/compositor.ts | Shader WebGL, komposisi alpha, fallback CPU, disposal. |
| src/projection/organic/engine.ts | Shape/Time/Merge/Residue/Freeze, batas memori dan surface Sprint 4. |
| src/projection/organic/useOrganic.ts | Integrasi React, lifecycle, cue, storage, pintasan. |
| src/projection/organic/OrganicPanel.tsx | Kontrol artistik dan pustaka cue. |
| src/projection/model.ts | Citra live dan penanda masker selesai. |
| src/projection/renderer.ts | Menjaga alpha hasil komposisi tanpa crop/threshold ganda. |
| src/projection/channel.ts, ProjectionOutput.tsx | Mengirim dan memvalidasi masker selesai lewat transport yang sama. |
| src/projection/useProjection.ts | Organic sebelum render/link, raw preview, reset/disposal, metrik. |
| src/projection/ProjectionWorkspace.tsx, projection.css | Tab Organic, dua preview dan tata letak Studio 12. |
| src/projection/ports.ts | Kontrak material/data untuk Sprint 4. |
| src/App.tsx | Label Studio 12. |
| tests/projection-organic.test.ts | Pengujian geometri, waktu, buffer, preset, Freeze/Hold dan residue. |
| tests/projection-browser.tsx | E2E Organic dan sinkronisasi output dengan input sintetis berlabel. |
| docs/PROJECTION-SPRINT3-PLAN.md | Audit dan rencana perubahan. |
| docs/PROJECTION-SPRINT2-RECORD.md | Rekam Sprint 2. |
| docs/PROJECTION-MANUAL.md, PROJECTION-ENGINE.md | Panduan dan laporan Studio 12. |
| scripts/build-projection-manual.py, public/projection-manual.html | Panduan dalam aplikasi. |
| public/SOMA-PROJECTION-MANUAL.md, SOMA-PROJECTION-ENGINE.md | Dokumen unduhan. |
| README.md, public/soma-source.zip | Titik masuk dan paket sumber rilis. |

## Hasil pengujian aktual — 29 Oktober 2026

- Baseline: 95 tes kode lulus.
- Suite Sprint 3: 115 tes lulus, termasuk 20 tes Organic. Tes mencakup timestamp tidak seragam, history tidak cukup, bounds memori pada jam logis panjang, Stretch/Shrink, anchor lokal, alpha blend, Delay/Echo, Freeze/Release, Hold/Blackout, Merge, residue, transisi dan validasi cue.
- Browser Organic: 27 pemeriksaan lulus, mencakup perubahan piksel bentuk, kontrol gerak, delay timestamp, echo posisi berbeda, freeze/release, kehilangan tracking, blackout, Hold, merge/konvergensi, residue screen/body-clipped, clear, cue, duplikat/nama, pemeliharaan kalibrasi, shortcut, reset, satu kamera dan kelangsungan rekaman audio.
- Sinkronisasi Organic: delapan pemeriksaan lulus dengan jendela output aktual. Piksel preview/output cocok; Freeze bertahan, draf tidak masuk output sebelum Apply, Blackout bekerja, deformasi live serta crop kamera tersinkron.
- Regresi Projection Sprint 1–2: 40 pemeriksaan lulus, termasuk geometri, registrasi, mirror, outline, Follow/Fixed, crop, smoothing, confidence, Fade, perangkat/preset v2, heartbeat, output dan rekaman.
- Ekspor pustaka cue melalui UI menghasilkan berkas JSON; impor kembali menampilkan enam cue yang sama, termasuk hasil Duplicate/Rename, tanpa mengganti mode Melar yang sedang dimainkan. Impor tidak otomatis memainkan cue.
- Regresi output Sprint 2: tujuh pemeriksaan lulus; draft/Apply, outline, skala, crop, Blackout dan registrasi kamera–proyektor tetap cocok antarjendela.
- Kamera gestural: 16 pemeriksaan lulus. Aktivasi suara oleh operator, perintah kamera/batal, resize dua telapak, satu pukulan/satu foto, JPEG crop aktual, empat slot dan penggantian slot, Clean, rekaman, tracking hilang, satu stream, serta fallback izin mikrofon.
- Total 98 pemeriksaan browser lulus pada batas hardware sintetis, ditambah ekspor/impor cue manual melalui UI.
- TypeScript `npx tsc --noEmit` lulus. Build produksi TypeScript/Vite lulus. Peringatan chunk di atas 500 KB serta impor MediaPipe campuran tetap ada; tidak ada error kompilasi.

## Batas verifikasi perangkat

Browser QA tidak menyediakan WebGL. E2E memakai App, renderer CPU, audio, storage dan komunikasi antartab aktual; hanya kamera, suara perintah dan landmark pada batas hardware diganti dengan input sintetis. Hasil tersebut tidak memverifikasi GPU, MediaPipe fisik, akurasi segmentasi atau performa panggung. RAF browser cloud dapat dibatasi sekitar satu frame per detik; angka tersebut tidak dipakai sebagai hasil ukur laptop pertunjukan.

| Target | Status |
| --- | --- |
| Shader GPU / akselerasi WebGL pada Mac | Belum diuji pada perangkat fisik |
| 30 FPS proyektor; rata-rata FPS dan P95 frame time | Perlu pengukuran Mac + webcam + HDMI |
| Motion-to-photon memakai kamera eksternal | Belum diukur |
| Galat titik proyeksi pada kain / tubuh | Belum diukur |
| Sesi 20 menit dengan aktor dan perangkat panggung | Belum dijalankan |
| Pemetaan kulit 3D | Di luar klaim kalibrasi bidang datar |

Tidak ada angka performa panggung simulasi. Manual memuat prosedur pengujian fisik dan rangkaian artistik 60 detik.

## Persiapan Sprint 4

`OrganicSurface` mengekspos tekstur alpha monokrom, alphaMask, timestamp render dan geometri (mode, anchor, factor, separation, timestamp sumber). `OrganicArchiveFusion` menerima surface dan material; `OrganicDataMapping` menghasilkan patch konfigurasi artistik. Kontrak ini menyiapkan foto/video/teks dan data tanpa kamera kedua. Pengisian material warna/video serta hubungan semantik belum diimplementasikan pada Projection Sprint 3. Fitur teks/foto SOMA lama tetap berjalan di workspace asalnya.
