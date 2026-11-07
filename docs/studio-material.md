# SOMA Studio 04 — teks dan foto

Panel Visual > Bahan: teks maksimal 220 kata, atau foto JPEG/PNG/WebP hingga 12 MB dan 24 megapiksel. Foto disimpan di IndexedDB lokal; preset menyimpan ID, bukan berkas. Unggah kembali jika berganti perangkat. Pengaturan sesi disimpan lokal tanpa mengaktifkan kamera, audio atau rekaman otomatis.

Teks: tarik dengan jepitan; lepaskan jepitan untuk momentum. Mouse: tahan tombol mouse untuk memainkan, gunakan P sebagai jepitan. Sapuan memberi impuls, hujan memberi gravitasi, bentangan mengikuti fitur jarak. Body memakai tinggi lengan untuk pegangan; Face memakai bukaan mulut. Pulihkan susunan mengatur ulang posisi tanpa mengubah teks.

Foto: buka lingkaran di sekitar titik gerak, sapuan dengan durasi jejak, lenturkan kisi foto, pecahan kisi, atau foto utuh. Reveal memakai titik gerak; Buka lewat siluet dan Kikis dengan tubuh memakai masker segmentasi Body. Masker disalin ke kisi 96 × 96 sebelum hasil model ditutup. Kamera tersembunyi tetap membaca tubuh. Deformasi memakai kisi Canvas2D, belum shader kontinu.

Garis tracking mengikuti landmark nyata yang lolos confidence dan memudar saat hilang. Suara tetap memakai engine bersama dengan limiter, karakter Raw/Metal, pemetaan, mute dan perekam yang ada. Clean memakai kanvas dan engine yang sama; fullscreen terpisah. Archive tetap terpisah untuk cue/operator/proyeksi; bahan Studio baru belum dikirim ke proyeksi Archive.

Validasi: 34 unit tests; 15 pemeriksaan piksel di tests/material-browser.html. Studio, Clean dan panel mengambang diperiksa dalam browser. Kamera fisik, kalibrasi ruang, latensi dan sesi panggung panjang perlu diuji pada perangkat pertunjukan. Inference masih main thread. Integrasi protokol eksternal RCP belum tersedia; input bahan melalui teks dan unggahan lokal.


## Studi gerak — tahap pertama

1. Tampung kata: pilih Visual > 01 · Tampung kata, lalu Body dan mulai kamera. Kata jatuh, tertahan pada tepi atas masker tubuh, lalu lepas ketika permukaan bergeser jauh atau hilang. Pada Hands, permukaan mengikuti ruas telapak yang terdeteksi. Pada Mouse, tahan dan geser bidang penahan yang terlihat. Ini uji interaksi; belum simulasi tumpukan huruf saling bertabrakan.
2. Buka siluet: unggah foto, pilih 02 · Buka siluet, lalu Body. Atur Lama bekas siluet untuk mempertahankan bekas tubuh setelah berpindah. Kontur dapat dimatikan terpisah dari rangka tracking.
3. Kikis dengan tubuh: pilih respons ini pada foto. Bagian yang tersapu tetap hilang sampai Pulihkan susunan ditekan. Pergantian sumber atau bahan mengawali susunan baru.
4. Gerak tertunda: pilih 03 · Gerak tertunda. Bahan mengikuti riwayat gerak 2,5 detik sebelumnya; slider mendukung 0–5 detik. Masa awal menunggu riwayat terisi. Rangka tracking dan suara tetap mengikuti gerak saat ini. Riwayat dibatasi 190 sampel / enam detik; latensi tambahan dari model tidak termasuk angka tunda.
5. Berat memperlambat tarikan dan mempercepat jatuh. Daya lekat meredam gerakan mendatar. Waktu kembali mengubah gaya yang menarik kata menuju susunan awal pada mode selain hujan/tampung. Angka ini kontrol respons, bukan pengukuran massa fisik.

Batas rilis ini: granular audio dari rekaman, pemetaan aksi dua performer, serta pengiriman bahan Studio ke proyeksi/cue Archive masih masuk tahap berikutnya. Segmentasi hanya tersedia dalam Body. Masker kamera fisik dan kecepatan inferensi wajib dicoba pada laptop panggung; browser QA memakai data masker sintetis yang ditandai di halaman tes.
