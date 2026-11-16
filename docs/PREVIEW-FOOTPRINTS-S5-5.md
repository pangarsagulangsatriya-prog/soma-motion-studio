# SOMA Footprints S5.5 — Physical Validation Preview

Branch Preview terpisah dari Production, dengan implementasi PR #11 pada commit `a6f14ae7bcfd7f8dd6941dd43b15a18bdf4588e9`.

Studio → Footprints → Live Floor Tracking · Kamera → buka panel **03 / Validasi fisik & performa**. Pilih contact kaki dari kamera, masukkan posisi pijakan fisik yang sudah diukur dengan pita ukur untuk menghitung galat dalam cm. Rekam selisih frame dari video high-speed eksternal untuk mengukur latensi gerak-ke-cahaya. Isi temuan langkah palsu/hilang dan pertukaran identitas, lalu ekspor JSON/CSV.

Software dioptimalkan dengan cache sesi, raster painting berdasarkan revisi jejak, dan pengiriman bitmap hanya saat ada perubahan plus heartbeat. Hold/Blackout tetap bekerja. Jangan menganggap telemetri browser sebagai pengukuran fisik.

Panduan lengkap: `docs/FOOTPRINTS-S5-5-PHYSICAL-VALIDATION.md`. **Belum show-ready; pengukuran panggung fisik belum dilakukan.**
