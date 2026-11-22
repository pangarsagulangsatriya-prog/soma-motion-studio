# SOMA · Footprint Brush V3
Tanggal: 22 November 2026
Scope: Stage 1 → Compose → Garis BETA
Target: GitHub Pages feature-branch preview and Vercel production after automated QA.

## Interaksi
- Jejak Kaki ON/OFF (default OFF agar bentuk Line Trails V2 awal tidak berubah).
- Sapuan: cap telapak anatomis kiri/kanan berulang sepanjang lintasan kaki yang **sudah teramati**. Kerapatan berdasarkan jarak (0,30–1,30 × panjang telapak), bukan FPS. Ketika kaki diam, cap baru tidak muncul.
- Pijakan: cap hanya dari event `contact` terverifikasi milik `FloorInteractionEngine`, diproses oleh `footMotionCanStamp`. Event `movement`, `presence`, `slide`, dan identitas tak terpilih tidak menghasilkan cap pijakan.
- Demo: mode khusus simulasi; Pijakan menggambar cap simulasi setiap beberapa sampel Sapuan. Status DEMO tetap jelas.
- Ukuran telapak 20–100 px, default 52 px. Pilihan Sapuan/Pijakan terpisah dari Tampilkan garis.
- Kaki kiri/kanan mewarisi warna, visibility dan Tetap/Memudar yang sama seperti Line Trails.
- Bersihkan menghapus kedua layer dan history; ON/OFF hanya mengubah visibilitas, tidak memutus kamera atau menghapus sesi.

## Arsitektur
Track/MP4/Simulasi → FootLineSampleAdapter (+orientasi heel→toe bila terbaca)
→ FootLineTrailEngine (smoothing yang sudah ada)
→ FootprintBrushEngine (cap Sapuan, cap Pijakan, history maksimal 1200)
→ LineTrailCanvasRenderer + paintAuthenticFootprint
→ kanvas Compose yang SAMA untuk editor dan fullscreen.

Dalam Sapuan, fallback orientasi mengikuti arah lintasan dari dua sampel kaki teramati. Untuk Pijakan, heading dari event kontak ditransformasikan menjadi orientasi kanvas. Bentuk telapak SOMA yang sudah ada digunakan untuk semua sumber.

## Keamanan dan batas
- Tidak menambahkan kamera, inferensi model, atau koneksi hardware baru.
- Preview 2D belum menjamin kesesuaian spasial dengan floor mapping fisik. Event pijakan yang terkalibrasi dapat berbeda koordinat dari lintasan citra 2D sebelum Map.
- Semua karya masih software preview: tidak mengubah gate Map/Perform/Blackout, tidak membuka proyektor otomatis.
- Tidak mengklaim estimasi gaya/tekanan pijakan.
- Hydra.js tidak ditambah ke jalur utama V3; eksperimen shader tetap P1 sesudah uji performa.

## QA
- Unit: deduplikasi frame/sampel, tanpa cap ketika diam, ukuran memori terbatas, kontak valid/deduplikasi/identitas/sesi, toggle dan blackout.
- Browser: ON/OFF, mode Sapuan/Pijakan, ukuran, pilihan garis, DEMO, fullscreen native/Escape dan Bersihkan.
- Regression: Test Line Trails V2, Liquid Imprint, dan input MP4/Track dipertahankan.
- QA fisik terpisah: kamera HP/webcam, MP4, crossing dua performer, kehilangan dan pemulihan tracking, stop–start, arah pijakan, serta 10 menit penggunaan.
