# SOMA / ARCHIVE — hasil pemeriksaan

Pemeriksaan 18–20 Oktober 2026 (WIB). Build lokal untuk latihan; belum dipublikasikan. Baseline SOMA v2: `8cbeb1f0fe3d2189c389ccec5769ac727ac36a99`.

## Hasil yang tercatat

| Pemeriksaan | Hasil | Bukti dan batas |
| --- | --- | --- |
| Unit test | **26/26 lulus** | 15 Archive, 11 instrumen lama. `evidence/unit-tests.txt`. |
| TypeScript dan build Vite | **Lulus** | `evidence/build.txt`. Bundle JS sekitar 572 kB sebelum gzip; Vite memberi peringatan ukuran chunk dan campuran impor MediaPipe. Build selesai. |
| Audio dan renderer Archive | **22/22 lulus** | `evidence/browser-audio.json`; AudioContext, Canvas dan MediaRecorder nyata, input gerak/nada sintetis. |
| Regresi audio SOMA | **15 lulus; inferensi kamera belum terverifikasi** | Lima karakter, spektrum, release, watchdog, mute, dan hasil rekaman. `evidence/legacy-regression.json`. |
| Visual generatif SOMA | **8/8 lulus** | Empat kanvas menggambar bersama audio dan recorder. Visual terus berjalan saat mute. Laju gambar pada browser cloud sekitar 1 FPS dalam pemeriksaan ini; hasil ini tidak membuktikan target 30 FPS. |
| Tata layar | **Lulus pemeriksaan lebar** | Frame 390/768 px, area isi 375/753 px setelah scrollbar. Lebar isi sama dengan viewport; tidak ditemukan kontrol meluber ke kiri/kanan. `evidence/responsive.jpg`. |
| Uji 30 menit | **Belum terverifikasi** | Dua percobaan terputus oleh berakhirnya sesi browser. Tidak ada laporan akhir yang dapat dipulihkan. Durasi yang sempat diamati tidak dihitung sebagai sesi lengkap. |
| Kamera, dua pemain dan proyektor fisik | **Belum diuji pada perangkat** | Browser QA tidak menyediakan WebGL. HDMI, pencahayaan, sound card dan latensi speaker tidak tersedia. |

Tidak ada konfigurasi atau script lint dalam proyek ini. Typecheck dan build berjalan; lint tidak diklaim lulus.

## Interaksi yang diperiksa melalui UI

| Alur | Hasil yang terlihat |
| --- | --- |
| Turun → Manual / uji → Coba pose rendah → GO | Kutipan muncul utuh, kemudian merapat dan menambah kata `tidur`. Teks asli memulihkan susunan. |
| Studio → Clean → Escape | Panel dan transport menghilang; kembali ke Studio memakai sesi yang sama. Take audio tetap berjalan. |
| Rekam keluaran | Take 7,44 detik tersimpan sebagai WebM dan dapat didekode. Pengukuran ffmpeg: mean −38,9 dB, peak −31,9 dB. `evidence/DEBUG-recorded-output.webm`. |
| Impor audio → tandai segmen → ekspor proyek | Debug WAV 4 detik; segmen 0,10–0,45 detik masuk JSON. `evidence/DEBUG-ui-project.json`. |
| Impor JSON pada browser yang belum memiliki audio | Muncul status berkas hilang. Menautkan WAV yang sama mempertahankan timecode dan hubungan pemetaan. |
| Impor TXT → buat revisi | Sumber awal tetap ada dan teksnya utuh. Revisi mendapat entri baru. Menekan Enter dalam editor tidak menjalankan GO. |
| Impor gambar → gunakan pada cue → buka proyeksi | Gambar lokal tampil di kedua jendela. Jendela proyeksi membaca media dari penyimpanan origin yang sama. |
| Impor video → GO → buka area sekitar tubuh | Video diagnostik tampil, kemudian terpotong mengikuti area aktor manual. Tidak ada audio video tambahan. `evidence/projection-video-mask.jpg`. |
| Foto saat kamera belum aktif | Pesan: “Foto belum diambil. Aktifkan kamera dan tunggu gambar tersedia.” Tidak membuat sumber foto baru. |
| Tutup jendela proyeksi | Studio menampilkan status “terputus”. Tombol Buka proyeksi membuka jendela kembali. |
| Muat ulang jendela proyeksi | Route tetap hanya memuat kanvas, tanpa kontrol atau mesin audio. |

Gambar, video, teks dan nada berlabel DEBUG dipakai untuk pemeriksaan. Berkas tersebut tidak menjadi arsip sejarah dalam template aplikasi. Screenshot dengan input manual tidak menunjukkan hasil deteksi kamera.

## Cakupan unit dan audio

Unit test menjaga kutipan Belanda dan status terjemahan kerja; menolak versi/ID/rujukan/timecode yang tidak valid; memulihkan teks setelah 100 siklus transformasi; memeriksa ambang, dwell, hysteresis, pemicu operator dan tracking hilang. Identitas A/B diuji dengan landmark sintetis: urutan model tertukar, tubuh bertumpang tindih, salah satu pemain hilang, kemunculan kembali, dan penetapan ulang. Jarak pasangan yang hilang tidak dianggap nol.

Pemeriksaan audio memakai jalur master dan recorder SOMA: playback segmen, seek, mundur, grain 160 ms, filter, tekstur, crossfade bahasa, cue spam, batas enam suara, pelepasan node, mute dan watchdog. Buffer lama dibersihkan ketika proyek diganti. Angka RMS menunjukkan sinyal hasil sintesis/nada uji; tidak menilai kualitas pembacaan manusia atau bunyi speaker.

## Menjalankan uji panjang di laptop latihan

1. Jalankan kode sumber melalui `npm run dev`. Buka `/tests/archive-browser.html` pada localhost.
2. Klik **Mulai uji 30 menit**. Pertahankan tab terlihat dan cegah laptop tidur. Biarkan uji selesai tanpa memuat ulang halaman.
3. Laporan mensyaratkan 30 menit nyata, lebih dari 25.000 tick, tidak ada jeda proses di atas 5 detik, maksimum enam suara, sumber utuh dan semua suara dilepas pada akhir uji.
4. Klik **Ekspor hasil uji**. Setelah pemuatan ulang, **Muat hasil tersimpan** membuka laporan akhir yang berhasil disimpan pada browser yang sama.
5. Lakukan sesi terpisah pada Studio dengan kamera, dua pemain, media pembacaan asli, rekaman keluaran dan proyektor. Ekspor diagnostik dari tab Panggung.

Uji harness mengukur engine, aturan dan renderer dengan input sintetis. Sesi Studio di perangkat panggung tetap dibutuhkan. Catat FPS tracker dan visual, jeda input, drop frame, penggunaan memori, tracking hilang, serta perubahan bunyi. `inputAgeMs` mengukur umur snapshot; angka ini tidak mengukur latensi kamera-ke-speaker atau kamera-ke-HDMI.

## Syarat sebelum pertunjukan

Uji berdiri, jongkok, duduk, berbaring, keluar frame dan tubuh saling menutupi pada framing sebenarnya. Periksa swap/reassign A/B. Cabut izin kamera dan uji fallback manual. Periksa fullscreen pada monitor tujuan, putus/sambung proyektor, speaker, level master, mute mendadak dan rekaman panjang.

Build ini siap dicoba sebagai bahan latihan lokal. Pernyataan siap produksi atau siap panggung memerlukan hasil pemeriksaan perangkat di atas.

## Paket dan publikasi

`SOMA-Archive-rehearsal-build.zip` memuat hasil build beserta model/WASM lokal dan panduan. `SOMA-Archive-source.zip` memuat sumber, pengujian dan dokumentasi; model/WASM dapat disiapkan melalui `npm run setup:assets`.

Untuk publikasi setelah ada instruksi: jalankan kembali check/build pada kode final, tinjau hasil uji perangkat, gunakan identitas Site yang sudah ada, pertahankan audiensnya, lalu unggah build yang sama. Pekerjaan ini tidak menjalankan deployment atau mengubah Site yang sedang tayang.
