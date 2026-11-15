# SOMA / Footprints — Gait Analysis

Direktori ini menyimpan **heuristik artistik berbasis gait** untuk mengubah Body Pose kamera menjadi jejak kaki. Berjalan, mengayun, dan memperkirakan saat tapak kembali menyentuh bidang visual.

## Input dan pemetaan

Input tetap memakai satu `MotionFrame` dari `CameraTracker` SOMA. Tidak membuka kamera kedua, tidak menambah dependency AI, dan tidak membuat jalur proyeksi baru.

| Landmark MediaPipe | Kiri | Kanan |
| --- | --- | --- |
| Pinggul | 23 | 24 |
| Pergelangan kaki | 27 | 28 |
| Tumit | 29 | 30 |
| Ujung kaki | 31 | 32 |

Referensi landmark resmi: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker

## Pembacaan

- Normalisasi gerak kaki terhadap pusat pinggul membantu meredam perpindahan seluruh tubuh.
- Smoothing adaptif mengikuti perubahan kecepatan: gerak cepat memakai respons lebih pendek; gerak lambat lebih halus.
- **Swing (perkiraan):** posisi kaki terangkat relatif terhadap baseline atau kecepatan relatif cukup tinggi.
- **Stance (perkiraan):** gerak relatif melambat dan posisi kembali dekat baseline selama sekurangnya 110 ms.
- **Contact stamp:** satu cetakan saat beralih menuju fase tumpu, dengan cooldown minimum 320 ms.
- Landmark hilang, kepercayaan rendah, atau jarak frame terlalu panjang mereset riwayat kaki agar tidak menghubungkan dua posisi yang berjauhan.
- Informasi `phase`, `confidence`, dan `relativeSpeed` ikut ke JSON sesi sebagai metadata visual.

## Pilihan pada UI

`Studio → MODE → Footprints / Kaki → Visual → Analisis gait`

Aktif (default): perkiraan contact stamp dari fase ayun/tumpu.

Nonaktif: mode lama berdasarkan jarak perpindahan pada `src/footprints/spacing.ts`.

PNG/SVG dan warna tetap menggunakan renderer Footprints yang sama. Projection tetap memakai kalibrasi SOMA.

## Batas teknis yang harus dijaga

Ini **interpretasi gerak kamera tunggal**, belum gait analysis klinis. Kamera 2D tidak mengukur gaya reaksi tanah, tekanan telapak, atau toe-off sesungguhnya. Perspektif frontal, kaki tertutup, pergantian arah, lantai tidak rata, serta cahaya dapat mengubah hasil.

Untuk pengujian panggung: tampilkan seluruh tubuh, letakkan kamera stabil, berjalan pelan dan cepat, uji langkah di tempat serta kaki berputar. Bandingkan jumlah jejak dengan video rekaman sebelum mengganti nilai ambang.

Jangan memakai nilai `contact` atau `stance` sebagai diagnosis medis ataupun pengukuran biomekanik presisi.
