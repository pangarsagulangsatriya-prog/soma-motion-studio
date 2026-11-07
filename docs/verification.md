# SOMA v2 — verifikasi 18 Oktober 2026

## Hasil

| Pemeriksaan | Hasil |
| --- | --- |
| Unit test mesin | 11 lulus: pemetaan, migrasi/pemulihan preset, Face sintetis, pemicu tahan, kecepatan, dan tracking hilang |
| TypeScript | Lulus sebelum pengemasan; build produksi mengulang pemeriksaan tipe |
| Audio di browser | 15 pemeriksaan lulus: lima karakter, pitch, perbedaan spektrum, limiter keluaran, release, watchdog, mute, serta decoding rekaman |
| Visual bersama audio dan rekaman | 8 pemeriksaan lulus menggunakan input mouse sintetis dan renderer produk yang sama |
| Studio → Clean → pengaturan mengambang | Timer rekaman terus berjalan, tanpa kembali ke nol |
| Clean | Bilah otomatis tersembunyi; panel bisa dibuka dan ditutup; indikator tersedia |
| Layout | Desktop, 768 px, dan 390 px diperiksa; tidak ada overflow horizontal pada 390 px |
| Kamera belum tersedia | Pesan status dan detail kegagalan tampil |

## Bukti uji visual gabungan

Uji `tests/visual.html` menjalankan data gerak mouse sintetis yang diberi label, Canvas 2D, audio graph, dan MediaRecorder. Pembacaan piksel membuktikan Jejak (1.472 piksel), Serat (6.111), Butiran (1.074), dan Bidang (6.222) menghasilkan gambar ketika audio serta rekaman aktif. Keempat gambar tetap ada saat audio mute. Keluaran Suara membersihkan semuanya menjadi nol piksel; keluaran Visual memulihkan gambar. Rekaman berhasil didekode: 9,00 detik, 110.285 byte.

Uji awal membaca frame sebelum data terbaru tersedia pada browser QA yang membatasi frame. Sumber input uji dipisahkan dari jadwal render; pemeriksaan menunggu frame yang benar-benar digambar. Renderer produk tidak diganti untuk meloloskan pemeriksaan. Ukuran piksel hanya menguji adanya gambar, bukan tolok ukur kualitas estetika atau frame rate.

## Batas

- Browser QA tidak menyediakan WebGL; inferensi kamera Hands, Body, dan Face belum terverifikasi dengan kamera fisik. Logika Face diuji melalui landmark/blendshape sintetis.
- Kecepatan render browser QA bukan benchmark perangkat pemain. Uji kamera, pencahayaan, latensi, dan beban rekaman pada laptop yang akan dipakai sebelum sesi panggung.
- Rekaman hanya audio. Ekspor video/grafik belum tersedia.

## Uji lanjutan dengan perangkat pemain

1. Izinkan kamera pada web HTTPS. Pilih Hands, lalu Body dan Face; pastikan hanya satu pelacak aktif.
2. Sembunyikan gambar webcam dan mainkan di Clean. Periksa kesesuaian garis terhadap ruas jari/sendi/kontur wajah.
3. Keluar dari bingkai. Garis harus memudar dan suara melepas gate tanpa nada tertahan.
4. Rekam sambil mengganti Studio/Clean, visual, dan karakter. Putar serta unduh hasilnya.
5. Simpan preset, muat ulang, lalu pulihkan. Kamera dan rekaman tidak boleh dimulai otomatis.
