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
- **Swing / Step (perkiraan):** kenaikan kaki terhadap baseline posisi tumpuan disertai perpindahan kaki yang terlihat pada gambar kamera. Perpindahan cepat diperiksa terhadap posisi pinggul dan gambar mentah agar gerakan badan di atas telapak diam tidak otomatis dihitung sebagai langkah.
- **Stance / Hold (perkiraan):** kaki kembali rendah dan gerak relatif melambat selama sekurangnya 110 ms. Baseline pijakan disesuaikan perlahan saat kaki stabil.
- **Pivot (perkiraan):** orientasi telapak berubah sekitar titik tumpuan dengan perpindahan pusat kaki kecil. Tidak membuat jejak kontak kedua.
- **Slide (perkiraan):** posisi telapak perlahan bergeser pada tinggi rendah; tetap fase stance. Di Live Floor, pergeseran kumulatif yang melewati ambang 0,12 meter dapat menghasilkan event `move`, bukan `contact`.
- **Contact stamp:** satu cetakan setelah ayun diikuti pijakan stabil, dengan cooldown minimum 320 ms.
- Klasifikasi `motionKind` (`hold`, `step`, `pivot`, `slide`) tersimpan sebagai metadata sampel visual dan tampil dalam Live Floor; belum label hasil pengukuran biomekanik.
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

## S5.6.2 — Pengujian gerak adaptif

- `tests/footprints-adaptive-gait.test.ts` menguji kontak awal, pijakan tetap saat tubuh membungkuk/bergeser, putaran telapak, geseran pelan, angkatan kaki kecil, kehilangan landmark, dan event `move` kumulatif.
- Ketika Live Floor dibuka, analisis gait tetap berjalan walau tombol analisis gait untuk pola Footprints V2 sebelumnya dimatikan. Ini menjaga kontak lantai hasil kalibrasi dari mode spacing ilustratif.
- Kriteria lulus otomatis hanya berlaku untuk pose sintetis terkontrol. Kamera frontal yang rendah, pakaian longgar, kaki tertutup, shadow proyektor, dan pivot dengan gerak lateral cepat dapat menghasilkan label keliru.
- Dua jenis gerak sering sulit dipisahkan dengan kamera tunggal: **telapak yang menyeret lantai** dan **langkah mendatar sangat rendah**. Koreksi selanjutnya membutuhkan rekaman video nyata, anotasi telapak mendarat/terangkat, dan perbandingan false/missed contact.
- Landmark MediaPipe yang dipakai: `https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker`. Koordinat yang dipakai tetap estimasi kamera dan belum otomatis mengukur kontak fisik.
