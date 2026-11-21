# SOMA Direct — audit output hitam (21 November 2026)

## Bukti dari layar operator
- Sumber terpilih: **Kamera HP**, status **Belum terhubung**, **2 performer**.
- Status output: **Terkunci · build**. Monitor Perform kosong dan berstatus menunggu pose.
- Kondisi tersebut belum memasok frame dan belum memenuhi syarat LIVE. Hitam saat Blackout merupakan perilaku aman, bukan bukti bahwa renderer gagal.

## Jalur kode
1. `FootprintsStageWorkspace` menilai sumber, identitas, dan kecocokan kalibrasi.
2. `SurfaceComposer` menggambar FLOOR/BODY dan melaporkan `StageRouteInput`.
3. `DualSurfaceSessionStore` membuka jendela output dalam Blackout; LIVE perlu frame segar, sumber aman, bukti QA fisik lima titik, dan persetujuan operator.
4. `ProjectionLink` mengirim ImageBitmap ke `ProjectionOutput` dan menerima `frame-ack`.
5. GitHub Pages membuat bundle dengan `VITE_SOMA_STAGE_OUTPUTS=enabled`. Rilis lain tanpa opt-in tetap mengunci output fisik.

## Temuan & perbaikan
- **Prioritas status salah.** Kunci build sebelumnya menutupi kamera yang belum tersambung. Sekarang kondisi kamera/pose/kalibrasi diperiksa lebih dulu, dan tombol **Perbaiki setup** mengantar operator kembali ke Track.
- **Status LIVE terlalu dini.** Output Direct dapat dilaporkan LIVE meskipun belum menerima frame. Sekarang Direct dan Clean Feed menunggu ACK frame terbaru; ACK lama dibatalkan saat Blackout, pembukaan, atau handshake ulang.
- **Sulit mengenali bundle lama.** Panel Pengaturan menampilkan izin output dan 8 karakter awal SHA build; Pages build menyisipkan `VITE_SOMA_BUILD_ID`.

## Uji penerimaan
1. Buka SOMA melalui URL GitHub Pages, lalu Perform → SOMA Direct. Saat HP belum terhubung, status **Perlu setup** harus menjelaskan kamera HP, dan **Perbaiki setup** kembali ke Track.
2. Hubungkan kamera/HP di Track sampai gambar 16:9 serta landmark dua performer stabil; cek Compose FLOOR/BODY terlihat.
3. Di Map selesaikan empat sudut dan QA fisik lima titik yang dilakukan operator. Buka jendela output (berawal Blackout).
4. Setelah seluruh gate lulus, operator mengaktifkan LIVE. Status LIVE hanya muncul setelah frame terkirim ke popup; periksa gambar nyata pada proyektor.
5. Putuskan sumber atau tekan Blackout: output padam, status tidak boleh tetap mengklaim LIVE. Uji lagi dengan kamera, MP4, dan simulasi sebagai jalur input berbeda.

**Batas verifikasi:** browser/CI dapat menguji logika dan penerimaan frame software. Cahaya fisik, sudut mapping, dan keselamatan optik tetap memerlukan pengujian pada proyektor dan kamera di lokasi.
