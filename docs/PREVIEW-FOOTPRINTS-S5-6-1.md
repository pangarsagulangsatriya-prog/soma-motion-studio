# SOMA Footprints S5.6.1 — Real-Time Floor Preview

Preview branch khusus fitur PR #13, berdasarkan commit `6e732ab567e21ed7ebd4f616a55fd687c05a92b6`, terpisah dari Production.

**Jalur pengujian:** Studio → Footprints → Live Floor Tracking · Kamera → hubungkan kamera Body → kalibrasikan empat sudut kamera dan proyektor → buka **03 / Validasi fisik & performa**.

Jejak kontak sekarang memicu repaint pada animation frame berikutnya, bukan menunggu polling 170 ms. Tiga metrik browser ditambahkan: waktu event kaki ke raster, frame kamera diserahkan ke pelacak sampai raster, dan transfer bitmap ke ACK jendela output. Ini bukan pengukuran kamera-ke-cahaya fisik.

Lihat `docs/FOOTPRINTS-S5-6-1-REALTIME-PIPELINE.md` untuk perbandingan browser, tes lampu proyektor, dan batasan. Pengujian webcam langsung dan perangkat panggung belum dilakukan; jangan gunakan Preview sebagai bukti siap pertunjukan.
