# SOMA · Compose FLOOR black-screen fallback
Tanggal: 22 November 2026

## Bug yang ditemukan
Track 1P menampilkan kaki kiri/kanan dan skeleton valid, sedangkan Compose → FLOOR → Liquid Imprint tampil hitam. Timeline dapat memuat puluhan `movement`/`presence` tanpa satu pun `contact` terverifikasi. `composerLiquidTrackEvents` dan `collectLiquidImprints` hanya melukis dari kontak terverifikasi sehingga jumlah event timeline tidak menjamin ada pigmen di FLOOR.

## Perbaikan
- Saat Stage Monitor FLOOR aktif dalam mode `Track (Aktif)`, dan compositor tidak memiliki imprint terverifikasi, tampilkan telapak software berbasis posisi tumit/ujung jari dari pose input yang sudah ada.
- Sumber: webcam/HP melalui `footSamplesFromLive`; MP4/simulasi melalui `footSamplesFromExperiment`. Detektor, kamera, event-bus, dan session baru tidak dibuat.
- Cetak telapak kiri dan kanan berwarna terang di atas latar gelap; cap pertama muncul segera, selanjutnya cap ditambah berdasarkan jarak perpindahan, dengan kaki terkini selalu terlihat; jejak memudar dalam 9 detik.
- Label `JEJAK 2D · PREVIEW` muncul di atas Stage Monitor dan status `Jejak 2D aktif · Kalibrasi Map diperlukan untuk proyektor` muncul di bawahnya.
- Saat verified Pixi imprint tersedia, visual resmi tetap diprioritaskan; demo/replay/Blackout tidak menampilkan fallback.
- **Tidak menyuntikkan contact verified, tidak mengubah status floorReady, tidak menggambar ke `floorOutput` fisik, tidak mengubah Map/Perform gate.**
- 2P tetap memakai router identitas; A/B ambigu tetap berhenti hingga stabil.

## QA
- Unit: tanpa kontak terverifikasi tetapi 2 kaki terlihat, cap awal terlihat, tanpa cap berulang saat diam, memudar, pindah kamera/MP4, blackout, replay, demo, dan kontak terverifikasi menonaktifkan fallback.
- Build TypeScript/Vite dan Chromium E2E baseline untuk Compose/Garis tetap wajib.
- QA fisik tersisa: kamera HP landscape, 1P bergerak dekat-jauh, putar/mirror, dua kaki bersilangan; Map calibration untuk keluaran proyektor fisik.
