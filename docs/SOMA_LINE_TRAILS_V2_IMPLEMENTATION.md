# SOMA · Line Trails V2 — Smooth Motion & Styles
Tanggal: 22 November 2026  
Status: Diimplementasikan pada feature branch Stage 1 (sebelum QA perangkat fisik)

## Hasil
- Empat tampilan atas lintasan kaki yang **sama**: Tinta, Kontur, Pita, dan Serat.
- Warna kaki kiri/kanan, visibilitas, ketebalan, Tetap/Memudar, Coba Demo, Bersihkan, dan fullscreen bersih tetap dipertahankan.
- Kontrol Kehalusan: Responsif, Halus (default), Sangat halus. Pergantian tingkat memengaruhi sampel berikutnya; riwayat coretan tidak dihapus.
- Identitas performer, koordinat kaki, dan sumber tetap melalui Track/MP4/Simulasi yang sudah tersedia. Tidak ada kamera atau model AI kedua.
- Engine memakai filter adaptif per kaki berbasis cutoff dan kecepatan. Sampel berulang, jitter kecil, lompatan besar, dan kaki hilang tetap ditangani.
- Renderer menargetkan 60Hz saat bergerak, memakai interpolasi dengan jeda visual 55ms **hanya di antara posisi kaki yang sudah teramati**. Tidak memprediksi pijakan. Pada keadaan diam, kanvas berhenti menggambar ulang kecuali Fade atau opsi berubah.
- Fullscreen tetap hanya satu kanvas. Blackout menghasilkan kanvas hitam.

## Batas dan pengukuran
- Kamera/MP4 belum tentu memasok 60 sampel gerak per detik. Interpolasi menghaluskan gambar di antara sampel yang valid, tidak menambah ketelitian tracking.
- Preview MP4 pada mode ini masih berbasis image-2d saat Map belum terkalibrasi. Status tersebut tidak membuka izin output proyektor fisik.
- Mode Serat dapat lebih berat daripada Kontur karena menggambar lima helai per segmen.
- Gate fisik FLOOR/BODY/Blackout pada Perform tidak diubah.

## QA otomatis
- Unit: kedua kaki, identitas 2P, jalur terputus pada kehilangan tracking, memori terbatas, gaya empat macam, parameter smoothing, interpolasi, dan blackout.
- E2E: pilihan gaya, tiga tingkat kehalusan, warna, demo, reset, fullscreen native + Escape, dan kembali ke Liquid.
- GitHub Pages workflow menjalankan unit + Chromium E2E 1366×768 dan 1440×900 sebelum deploy.

## QA perangkat yang masih wajib
1. Kamera webcam, HP horizontal, dan MP4 dengan kaki lambat/cepat, stop–start, belok mendadak, crossing.
2. Bandingkan responsif/halus/sangat halus terhadap latensi nyata di laptop panggung.
3. Uji kamera A/B, blackout, pemulihan Track, screenshot output fullscreen, serta 10 menit sesi.
4. Catat FPS P50/P95, waktu render, putus jalur, identitas A/B, dan memori.
5. Uji proyektor fisik **hanya** melalui Map/Perform dan QA resmi.
