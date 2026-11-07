# SOMA Studio 12 · Motion / Sound / Image

SOMA / ARCHIVE menambahkan instrumen teks dan pembacaan arsip untuk latihan UNPACKING. Lihat [panduan operator](docs/archive/operator.md), [audit dan rancangan](docs/archive/architecture.md), serta [hasil verifikasi](docs/archive/verification.md). Archive tetap terintegrasi dalam rilis SOMA terbaru.

SOMA mengubah gerak tangan, tubuh, dan wajah menjadi suara serta gambar generatif di browser. React, TypeScript, MediaPipe Tasks Vision, Web Audio, dan Canvas 2D. Kamera diproses di perangkat; video tidak diunggah. Perintah suara kamera meminta izin mikrofon saat diaktifkan.

Rancangan layar, perilaku kontrol, pemetaan, serta urutan pengembangan tersedia di [docs/SOMA-v2-plan.md](docs/SOMA-v2-plan.md).

## Jalankan di komputer

Gunakan Node.js 22 atau lebih baru.

```sh
npm ci
npm run setup:assets
npm run dev
```

Buka `http://localhost:4173`. Kamera memerlukan HTTPS atau localhost. Pelacak memerlukan WebGL, termasuk saat model memakai CPU. `setup:assets` mengambil tiga model versi tetap dari penyimpanan resmi MediaPipe, memeriksa SHA-256, lalu menyalin WASM dari dependensi yang dikunci. ZIP kode memerlukan internet saat pemasangan pertama. Jalankan `npm run setup:assets` setelah mengunduh repositori untuk menyiapkan model/WASM lokal; saat bermain tidak memakai CDN model. Google Fonts opsional, dengan font sistem sebagai cadangan.

```sh
npm test
npm run build
```

Sajikan seluruh `dist/` melalui hosting HTTPS. Jangan membuka `index.html` melalui `file://`. Halaman `tests/` hanya untuk pengembangan dan tidak masuk build produksi.

## Mulai bermain

1. Pilih **Hands**, **Body**, **Face**, atau **Mouse**. Satu jenis pelacak aktif pada satu waktu. Sumber gerak terpisah dari mode instrumen.
2. Klik **Mulai kamera** dan izinkan kamera. Klik **Aktifkan audio** untuk membuka audio browser. Mouse bisa dicoba dengan menahan dan menggeser pada kanvas, atau tombol panah saat kanvas terfokus.
3. Pilih keluaran **Suara**, **Visual**, atau **Keduanya**. Pilihan Visual memudarkan audio; mute juga tetap membiarkan gambar bergerak.
4. Tab **Suara** memuat Clean, Raw, Metal, Metallic, dan Dark Drone. Makro Kekasaran, Berat, Ketajaman, dan Ruang terpisah dari master volume. Badge “Pemetaan gerak aktif” menunjukkan parameter yang sedang dikendalikan gerak.
5. Tab **Visual** memuat Jejak, Serat, Butiran, dan Bidang. Pilih warna, kepadatan, ukuran dasar, serta umur jejak/partikel. Pemetaan aktif mengambil alih nilai dasar target yang sama.
6. Tab **Lapisan** mengatur gambar kamera, garis tracking, latar, serta mirror. Menyembunyikan gambar webcam atau garis tetap mempertahankan pembacaan gerak.

| Sumber | Gerak dan respons awal |
| --- | --- |
| Hands | Tangan naik menaikkan pitch; ke kanan menaikkan volume. Telapak terbuka membuka nada; genggaman melepasnya. Jepitan meredam filter dan mengerutkan bentuk; jarak tangan membentangkan Serat. |
| Body | Tinggi lengan mengatur pitch, kemiringan mengatur stereo, dan tubuh diam mempertahankan nada. Bahu serta pinggul perlu terlihat. Tekukan memakai perkiraan model. |
| Face · baru | Mulut terbuka membuka nada dan volume; kemiringan kepala menggeser stereo serta putaran visual; kedipan meredam filter. |
| Mouse | Input simulasi berlabel jelas, dengan penunjuk di kanvas. Shift mensimulasikan genggaman, P mensimulasikan jepitan. Tidak membuat rangka tangan/wajah rekaan. |

Mode **Theremin**, **Body Drone**, **Gesture Percussion**, dan **Performance Lab** tetap tersedia. Mode memilih cara synth/gate dan pemetaan awal; pilih sumber Body secara terpisah untuk memakai tubuh. Pemetaan suara maupun visual dapat diedit: sumber gerak, target, rentang, kurva, inversi, threshold, sensitivitas, smoothing, dan sakelar aktif. Baris terbawah mengambil alih target yang sama. Fitur yang tidak didukung sumber dilewati.

## Studio, Clean, dan lapisan

**Studio** menampilkan kanvas, panel kanan, monitor, dan rekaman. **Clean** memenuhi ruang aplikasi dengan kanvas yang sama. Bilah kontrol muncul saat pointer bergerak, layar disentuh, atau Tab ditekan; memudar setelah tiga detik. Bilah tetap terlihat selama panel terbuka atau fokus keyboard berada di kontrol. Pengaturan membuka panel di atas kanvas dan tetap bisa ditutup selama sesi berjalan.

| Tombol | Aksi |
| --- | --- |
| C | Studio / Clean |
| F | Fullscreen browser, terpisah dari Clean |
| T | Tampilkan / sembunyikan garis tracking |
| Space | Mute audio; visual tetap berjalan |
| Esc | Tutup panel mengambang atau dialog |
| Shift / P | Genggam / jepit dalam simulasi Mouse |

Lapisan dapat digabung: kamera tersembunyi + garis putih + latar hitam, atau webcam + rangka + gambar generatif. Garis memakai titik terdeteksi dan memudar saat tracking hilang. Mode garis **Pemicu** menyimpan status tampil/sembunyi; opsi tahan telapak 1,2 detik memicu sekali hingga telapak dilepas. Gesture ini terpisah dari daftar pemetaan suara.

Indikator Clean membuka detail kamera, tracking, audio, dan laju gambar. Fullscreen tidak wajib untuk Clean. Audio dimute saat tab kehilangan fokus; lanjutkan melalui tombol audio. Kamera tidak dimulai otomatis oleh preset ketika belum aktif.

## Preset, rekaman, kalibrasi

- Preset v2 menyimpan sumber, mode, karakter, makro, visual, lapisan, pemetaan, serta kalibrasi. Impor preset v1 tetap didukung. Status izin kamera, mute, fullscreen, serta rekaman mengikuti sesi dan tidak dipulihkan sebagai pengaturan preset.
- Enam preset awal mencakup Air/Jejak, Raw/Serat, Metal/Butiran, Metallic/Bidang, Dark/Tubuh, dan Pulse/Kit. Preset pribadi tersimpan di localStorage, maksimum 40, dengan impor/ekspor JSON tervalidasi.
- Rekam audio menangkap keluaran synth setelah master. Format mengikuti dukungan browser: WebM/Opus, MP4, atau Ogg. Buka **Sesi** untuk memutar dan mengunduh. Unduh sebelum menutup tab. Batas satu take 30 menit.
- Pindah Studio/Clean atau buka panel tidak membuat ulang video, audio engine, atau stream rekaman. Pergantian karakter memakai crossfade pendek. Limiter dan mute tetap aktif.
- Log gerak terpisah dari rekaman audio. Ekspor JSON/CSV memuat waktu, sumber, gestur, tracking, dan fitur gerak. Batas 18.000 sampel.
- Kalibrasi mengambil jangkauan gerak selama enam detik. Rentang yang terlalu kecil ditolak. Mengganti sumber atau mirror menghapus kalibrasi lama.

## Mesin dan kinerja

| Modul | Tugas |
| --- | --- |
| `src/engine/tracking.ts` | Satu pelacak aktif, model lokal, izin/perangkat kamera, serta pengaturan laju inferensi |
| `src/engine/motion.ts` | Fitur tangan, tubuh, Face, normalisasi, gestur, dan kecepatan berdasar waktu |
| `src/engine/mapping.ts` | Dua mesin pemetaan, migrasi/validasi preset, serta pemicu tahan |
| `src/engine/audio.ts` | Lima karakter, synth/noise, perkusi, envelope, efek, limiter, dan watchdog |
| `src/VisualStage.tsx` | Empat keluarga visual, garis anatomis, batas elemen, dan fade saat gerak hilang |
| `src/StudioControls.tsx` | Tab Suara, Visual, dan Lapisan |
| `src/MappingEditor.tsx` | Editor pemetaan suara dan visual |
| `src/engine/recording.ts` | Rekaman audio, log gerak, unduhan |
| `src/App.tsx` | Studio/Clean, preset, sumber, status, dan sesi |

Hand Landmarker membaca 21 titik per tangan; Pose menyediakan 33 titik hingga dua pemain; instrumen lama tetap memakai pose pertama, sementara Archive menjaga kontinuitas Aktor A/B. Face memakai kontur dan blendshape. Model memuat saat sumber pertama kali digunakan. Inferensi mulai sekitar 33 ms per pembacaan dan mengurangi laju saat waktu proses meningkat. Kecepatan nyata bergantung pada perangkat dan pencahayaan.

Visual menggunakan Canvas 2D, DPR maksimum 1,75, batas 700 partikel dan 190 sampel per jejak. Umur serta kecepatan partikel memakai selang waktu frame. Suara mengambil data gerak yang sama melalui pemetaan sendiri. Lima bank oscillator dibuat sekali dan memakai gain untuk crossfade. Watchdog jam audio memudarkan output setelah 450 ms tanpa pembaruan. Tracking hilang melepas gate dan memudarkan garis selama sekitar 500 ms.

## Pengujian dan batas verifikasi

- Suite awal instrumen/Archive memuat 26 tes; suite Studio 12 kini memuat 115 tes. Cakupan Archive meliputi teks sumber, validasi proyek, aturan, cue dan kontinuitas dua aktor dengan input sintetis.
- `http://localhost:4173/tests/browser.html` menjalankan audio graph nyata, pembacaan spektrum, decoding rekaman, lima karakter, keluaran Visual, release, watchdog, dan mute. Gerak simulasi diberi label jelas.
- `http://localhost:4173/tests/visual.html` memeriksa empat renderer Canvas 2D bersama audio dan rekaman: gambar saat mute, pergantian keluaran Suara/Visual, serta decoding hasil rekaman. Delapan pemeriksaan lulus dengan input mouse sintetis. Laju frame browser QA tidak mewakili perangkat pemain.
- `http://localhost:4173/tests/responsive.html` memeriksa lebar 390 dan 768 px.
- Browser QA tidak menyediakan WebGL. Inferensi kamera Hands/Body/Face diberi status **belum terverifikasi**. Logika Face sudah diuji dengan data landmark/blendshape sintetis; kualitas deteksi kamera fisik tetap perlu diuji di laptop pemakai.
- Rekaman menyimpan audio. Rekaman video/grafik, ekspor WAV, serta granular yang mempertahankan pitch belum tersedia. Archive mendukung playback sampel, loop kata, dan scrub cuplikan 160 ms.

Hasil Archive dan batas pengujian perangkat tercatat di [docs/archive/verification.md](docs/archive/verification.md). Laporan instrumen v2 sebelumnya tetap tersedia di [docs/verification.md](docs/verification.md).

## Referensi

- [MediaPipe Hand Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js)
- [MediaPipe Pose Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js)
- [MediaPipe Face Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js)
- [MediaPipe source](https://github.com/google-ai-edge/mediapipe), Apache 2.0. Paket dan WASM dikunci dalam package-lock.
- URL model serta SHA-256 tercatat di `scripts/setup-assets.mjs`.
- Fixture resmi: `https://storage.googleapis.com/mediapipe-assets/right_hands.jpg` dan `https://storage.googleapis.com/mediapipe-assets/pose.jpg`.


## SOMA / Projection · Studio 10

Open **Projection** in the main Studio header. Sprint 0–1 adds the shared Body mask, white silhouette, a separate clean projector window, Live/Hold/Blackout, four-corner calibration and portable calibration presets. The main camera, gesture photos, text and audio remain in SOMA.

- [Operator manual, Mac and HDMI](docs/PROJECTION-MANUAL.md) · published at `/projection-manual.html`
- [Architecture, file changes, validation and limitations](docs/PROJECTION-ENGINE.md)
- [Existing gesture-camera manual](docs/USER-MANUAL.md)

Body Mapping is a flat-plane prototype. Physical projector accuracy and latency are not yet measured. See the manual for the rehearsal checklist.

## Projection Sprint 2 / Studio 11

Calibration Studio memisahkan bidang layar dan pasangan titik kamera–proyektor. Gerak siluet memakai Follow/Fixed, outline, crop dan smoothing. Preset v2 mencatat perangkat serta matriks; draf menunggu Apply sebelum masuk output.

Panduan: `docs/PROJECTION-MANUAL.md` atau `/projection-manual.html`. Daftar perubahan, regression test dan batas fisik: `docs/PROJECTION-ENGINE.md`. Jalankan `npm ci`, `npm run setup:assets`, lalu `npm run dev`. Build/dev menyiapkan bundle worker secara otomatis.


## Projection Sprint 3 / Studio 12

Buka **Projection → Organic** untuk Stretch, Shrink, Split, Merge, Delay, Echo, Freeze dan Residue. Cue artistik terpisah dari kalibrasi fisik; satu kamera dan MotionFrame tetap dipakai seluruh SOMA. Tombol Blackout selalu tersedia.

115 tes kode lulus. Lihat [laporan terbaru](docs/PROJECTION-ENGINE.md) untuk hasil browser dan batas verifikasi GPU/perangkat. [Panduan operator](docs/PROJECTION-MANUAL.md) juga tersedia melalui menu Panduan Projection. Riwayat memakai ring buffer terbatas; reset melepaskan resource tanpa mengubah kalibrasi.


## Salinan GitHub · Studio 12

Kode ini berasal dari paket sumber rilis Studio 12, termasuk Projection Sprint 1–3 dan Organic Body Engine. Lihat [laporan Projection](docs/PROJECTION-ENGINE.md) dan [panduan proyektor](docs/PROJECTION-MANUAL.md).

Pada ekspor GitHub, 115 tes kode dijalankan ulang dan lulus. Uji browser historis tercatat pada laporan rilis; ekspor ini tidak mengulang uji webcam, GPU, atau proyektor fisik. Situs pertunjukan tetap tersedia di https://soma-motion-studio.gulangsp.chatgpt.site.
