# SOMA · Map V6 — Perspectival Footprint Preview
Tanggal: 22 November 2026
Scope: Map → Lantai → Kamera langsung + Hasil visual lantai. Preview software saja.

## Pengalaman operator
- Saat kamera terhubung, bidang kiri menampilkan telapak yang sama di posisi kamera dan bidang kanan menampilkan versi hasil proyeksi; bentuk, ukuran, dan orientasi telapak mengikuti distorsi empat sudut.
- Jejak kaki terdeteksi memakai titik tumit + ujung jari dari frame Track yang masih segar (maksimum 450ms), diproyeksikan dari kamera → UV lantai → bidang output.
- Ketika telapak belum terlacak atau berada di luar bidang, lima tapak **CONTOH LANGKAH · PERSPEKTIF** tampil dalam ukuran/posisi bergantian, agar perubahan kedalaman bidang dapat dinilai. Contoh dipisahkan secara jelas dari `JEJAK TERDETEKSI · 2D`.
- Tombol kecil **Jejak kaki ON/OFF** pada bidang hasil, default ON. Saat OFF penanda hilang. Simulasi juga memakai geometri sole warped yang sama.
- Menggeser sudut output mengubah proyeksi semua titik telapak secara langsung; menggeser sudut kamera mengubah perkiraan lokasi kaki nyata di UV lantai. Tidak diperlukan data kontak terverifikasi untuk preview gambar.
- Tidak menambah panel kompleks atau perangkat kamera baru.

## Perhitungan
- Menggunakan homography kamera (draft empat titik) dan invers untuk mengubah heel/toe dari image UV ke floor UV.
- Arah tumit → jari dihitung ulang pada satuan meter lantai, sehingga rotasi tidak disalin mentah dari gambar kamera yang miring.
- Kontur kaki kiri/kanan dan setiap jari memakai geometri anatomi SOMA, tiap vertex dikirim melalui homography output; skala visual proporsional dengan meter panggung (visual-only ukuran sedikit diperjelas).
- Hasil kiri memakai homography kamera pada sumber asli dan contained-image rectangle untuk menangani letterboxing.
- Hasil kanan dirender langsung pada kanvas Map, di atas raster Compose; tidak mengubah canvas output fisik.

## Batas keselamatan dan QA
- Preview contoh bukan deteksi; gambar kaki dipakai untuk melihat korespondensi proyeksi, bukan validasi langkah/tekanan aktual.
- Tidak mengubah `floorReady`, `isConfirmed`, `contact.verified`, cue, output proyektor, atau Blackout.
- Quad invalid, landmark tak valid/di luar bidang, dan frame terlambat tidak dapat dipresentasikan sebagai kaki terlacak.
- QA: perspective deformation when corners move, five illustrative marks, toe/heel heading, no weak/outside landmarks, six anatomical fills per sole, toggle ON/OFF and fullscreen.
- Uji perangkat fisik tetap diperlukan untuk mengecek orientasi/mirror/rotasi kamera HP dan proyektor sungguhan.
