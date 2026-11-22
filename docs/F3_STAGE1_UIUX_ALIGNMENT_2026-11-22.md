# F3 UI/UX — Stage 1 visual alignment (22 November 2026)

## Temuan
- F3 sebelumnya menumpuk beberapa override di f3.css. Ukuran, warna, border, serta navigasi tidak konsisten dengan Stage 1.
- Kamera dan Stage View dibentangkan vertikal. Periksa input, rana, hasil foto, dan output teknis sulit dipindai.
- Stage 1 telah memiliki vocabulary navigasi, layout 316px + preview, surface header, input, dan status yang dapat dipakai ulang sebagai pola.

## Implementasi
- GlobalNav SOMA yang sudah ada tetap menjadi header/sidebar F3.
- Navigasi 01 Kamera → 02 Stage View → 03 Foto menggunakan tab Stage 1-style yang benar-benar mengganti panel kerja; satu tombol Lanjut untuk langkah berikutnya.
- Panel kiri 316px memuat tugas langkah aktif. Monitor Stage View di kanan selalu terpasang.
- Kamera A/B, dropdown, sambungan, putus, MP4, dan monitor input hanya terlihat pada langkah Kamera, tetapi elemen <video> selalu mounted untuk menjaga stream.
- Langkah Foto memuat persetujuan, Jepret manual, rana gestur progresif. Empat foto, ganti/hapus, Undo dan ZIP muncul di bawah Stage View.
- Fullscreen Stage View mempertahankan renderer 2:1 murni tanpa UI studio; proyektor fisik tetap fail-closed.
- f3.css diganti dengan stylesheet terisolasi mengikuti stage-navigation dan track-compact. Responsif pada laptop 1366/1440 dan mobile; keyboard focus dan reduced motion ditangani.
- E2E membuka langkah Foto untuk melakukan shutter test; alur 0/4, 2/4, 4/4, Esc, stale-frame, dan status sumber tetap harus lulus.

## Batas
Hanya F3 feature branch. Tidak menyentuh Stage 1/2, engine deteksi, shutter gating, proyektor, Vercel, atau main. Validasi dua kamera fisik, mobile Safari, dan projector rig masih diperlukan.
