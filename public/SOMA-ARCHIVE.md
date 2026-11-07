# SOMA / ARCHIVE — panduan latihan

Build lokal untuk UNPACKING. Pilih **Archive** pada baris atas SOMA. Halaman instrumen lama tetap tersedia melalui **Instrumen**. Versi Archive ini belum dipublikasikan.

## Mulai dalam lima langkah

1. Buka SOMA melalui `http://localhost:4173` atau HTTPS, lalu klik **Archive**.
2. Pilih cue **Turun**. Di tab **Gerak**, pilih **Manual / uji**, lalu **Coba pose rendah**.
3. Tekan **GO**. Kutipan tampil utuh 1,4 detik; sesudah itu baris merapat dan kata `tidur` bertambah. **Teks asli** memulihkan susunan.
4. Di tab **Arsip**, pilih sumber, aktifkan audio, lalu impor rekaman pembacaan sendiri. Tandai awal dan akhir kata dalam detik. Di **Pemetaan**, hubungkan segmen itu ke aturan yang dipakai cue.
5. Tekan **Buka proyeksi**. Geser jendela baru ke proyektor, tekan **F**, dan pertahankan Studio terlihat pada layar laptop.

Tanpa rekaman, teks tetap dapat dimainkan. Slot pembacaan menampilkan `Rekaman pembacaan belum tersedia`. Template tidak menyertakan suara sejarah, TTS, atau foto sejarah rekaan.

## Tata layar

Kanvas panggung berada di kiri; panel Arsip/Gerak/Pemetaan/Panggung di kanan. Transport berada tepat di bawah kanvas, disusul daftar cue dan pemicu manual. Status kamera, gerak, audio, media, dan proyeksi berada di bawah. Pada layar kecil, panel pengaturan pindah ke bawah kanvas.

**Clean Archive** memenuhi jendela dengan komposisi saja. Tekan **Escape** atau **C** untuk kembali. Jendela proyeksi juga hanya menampilkan komposisi, tanpa kontrol, pesan operator, kamera, atau mesin audio tambahan. Clean Archive memakai perilaku panggung ini; Clean pada instrumen SOMA tetap memiliki bilah otomatis dan pengaturan mengambang.

## Kontrol operator

| Kontrol | Pintasan awal | Akibat |
| --- | --- | --- |
| Pilih kartu cue | — | Siapkan cue; waktu kembali nol dan suara cue lama dilepas. Belum memainkan cue baru. |
| GO | Enter | Mulai atau lanjutkan cue. Tekanan berulang saat cue berjalan tidak memutar bacaan lagi. |
| Berikutnya / sebelumnya | `]` / `[` | Siapkan cue berikutnya/sebelumnya, lalu tunggu GO. |
| Tahan | H | Tahan waktu cue dan komposisi; lepaskan suara dan pemicu foto yang disiagakan. |
| Teks asli | R | Pulihkan teks sumber, lepaskan suara. GO membuka kembali pemetaan. |
| Bekukan | Z | Tahan gambar dan pemicu pemetaan baru; potongan yang sudah dijadwalkan dapat selesai. Klik lagi untuk melepas. |
| MUTE | Space | Redam seluruh keluaran, termasuk synth. Klik Aktifkan audio untuk melanjutkan. |
| Layar hitam | B | Hitamkan komposisi. Audio mengikuti cue; gunakan MUTE bila suara juga perlu berhenti. |
| Garis cue | T | Ubah visibilitas garis pada cue dengan pilihan “Saat tombol garis cue aktif”. Pembacaan kamera tetap berjalan. |
| Clean | C | Ganti tampilan operator / komposisi pada jendela utama. |
| Fullscreen | F | Masuk/keluar fullscreen pada jendela yang menerima tombol. Terpisah dari Clean. |

Pintasan panggung bisa diganti di **Panggung → Pintasan operator**. Pintasan nonaktif saat fokus berada di input, editor, pilihan, atau dialog. Klik kanvas dahulu sebelum memakai pintasan panggung. Menutup atau menyembunyikan tab Studio dapat menahan cue dan meredam audio; jangan menjalankan Studio di tab latar saat pertunjukan.

## Tujuh cue awal

| Cue | Tindakan | Gambar | Suara dan persiapan |
| --- | --- | --- | --- |
| Baca | GO | Kutipan dan terjemahan dalam dua kolom | Rekaman utuh NL, lalu ID bila keduanya tersedia pada sumber cue. |
| Turun | Pinggul rendah, torso mendatar, diam; atau Coba pose rendah | Baris merapat; kata target berulang | Loop segmen `tidur`; tandai dan pilih segmen dahulu. |
| Tepis | Sapuan pergelangan; atau slider sapuan manual | Kata sasaran bergeser/terpencar lalu pulih | Cuplikan 160 ms; arah negatif memutar mundur. |
| Dua suara | Dua aktor terlihat; ubah jaraknya | Dua kolom bergerak | Kedua rekaman mulai bersama; jarak mengatur crossfade. |
| Penilaian | GO, lalu pose sesuai pemetaan | `Je reinste zelfmoord` muncul utuh sebelum perubahan jarak kata | NL sekali, lalu ID. Gerak tangan tidak menghentikan bacaan; HOLD/MUTE tetap berkuasa. |
| Foto hidup | GO atau tombol Ambil satu foto | Satu frame kamera tersimpan sebagai sumber lokal | Diam secara bawaan. Tidak menambahkan bunyi snapshot. |
| Kembali | GO | Susunan sumber pulih | Potongan audio dilepas. |

Durasi cue otomatis hanya berjalan bila diaktifkan dan durasinya lebih dari nol. Urutan bawaan memakai GO manual. Cue dapat diberi nama, ditambah, dihapus, dan digeser.

## Menyiapkan sumber dan rekaman

Teks sumber dikunci. Edit **Terjemahan kerja** secara terpisah atau buat **Revisi teks sumber** untuk menghasilkan entri baru dengan rujukan ke sumber sebelumnya. Impor TXT/Markdown atau tulis teks baru. Metadata mencatat penulis, tahun, bahasa, rujukan, hak pakai, status pemeriksaan, dan catatan.

Pilih kata pada teks untuk mengisi nama segmen baru. Impor rekaman NL/ID, lalu klik **Tambah segmen**. Isi awal/akhir dalam detik; **Coba** dan **Mundur** memeriksa potongan. **Posisi, filter & tekstur** menyediakan seek, cuplikan pendek, batas frekuensi dan saturasi. Filter/tekstur berlaku pada potongan berikutnya. Ini belum mencakup penyelarasan kata otomatis atau granular yang mempertahankan pitch.

Volume tiap pembacaan terpisah dari master. Batas enam potongan berlaku untuk seluruh Archive. Setiap potongan memiliki fade pendek. Limiter, master, mute, dan jalur rekaman memakai mesin SOMA yang sama. **Lapisan synth SOMA** dapat diaktifkan terpisah.

**Rekam keluaran** menangkap audio master. Pergantian tab dan Studio/Clean tidak memulai ulang take. Buka **Rekaman sesi**, lalu unduh sebelum menutup atau memuat ulang tab. Video proyeksi tidak ikut direkam.

## Gerak dan pemulihan A/B

Pilih **Kamera / mouse**, lalu Hands, Body, Face, atau Mouse. Hanya satu jenis pelacak aktif. Body mendukung hingga dua pose; gerak tangan/wajah memakai fitur posisi dan sapuan yang tersedia. Mouse dimainkan dengan menahan dan menggeser pada pratinjau. Manual menyediakan nilai eksplisit untuk pose rendah, durasi diam, posisi, serta dua aktor tanpa mengarang landmark.

Untuk Body, tempatkan kamera agar kepala, pinggul, kaki, dan lantai terlihat. Atur garis lantai Y dan tinggi pinggul berdiri; Y=0 berada di atas, Y=1 di bawah. Sesuaikan batas kiri/kanan/atas/bawah, keyakinan minimum, ambang diam, dan waktu tahan tracking hilang. Tidak ada klasifikasi tidur fisiologis atau pengukuran napas.

A awalnya mengikuti tubuh di kiri gambar, B di kanan. Kontinuitas posisi menjaga identitas bila urutan hasil model berubah. Saat persilangan meragukan, aturan ditahan dan status meminta penetapan ulang. Pisahkan tubuh; pilih **Tetapkan A kiri** atau **Tukar A ↔ B**. Setelah salah satu tubuh hilang, durasi diam dan kecepatan dihitung ulang agar kemunculan kembali tidak dianggap sapuan.

Urutan pemulihan: **Tahan → Manual / uji → pilih cue → GO**. Bila kamera sudah pulih, pilih input langsung, tetapkan A/B, periksa status, lalu GO. Garis hanya memakai landmark yang tersedia dan memudar ketika hilang.

## Foto, video, dan penyimpanan

Impor gambar/video dari **Arsip → Foto / video**. Isi rujukan dan hak pakai, lalu **Gunakan pada cue ini**. Di Panggung pilih tampilan utuh, buka area sekitar tubuh, lapisan teks/skeleton, atau geser bingkai. Video selalu diam; pembacaan arsip lewat jalur audio terpisah. Awal video dapat diatur dalam detik. Berkas sumber tidak disunting.

Foto kamera diambil hanya melalui tindakan operator atau pemicu diam yang sudah disiagakan. Setelah satu foto, pemicu mati. Pilih siagakan ulang untuk foto selanjutnya. Ekspor/hapus media melalui Arsip. Menghapus berkas mempertahankan metadata dan menandai berkas hilang; tautkan ulang bila diperlukan.

Proyek versi 1 tersimpan di browser ini. **Ekspor** menghasilkan JSON berisi sumber, metadata rekaman, segmen, aturan, cue, keluaran, kalibrasi, dan pintasan. Berkas audio/gambar/video tidak dimasukkan ke JSON. Simpan berkas asli bersama ekspor. Saat impor pada browser lain, slot media hilang muncul; tautkan ulang berkas yang sama agar segmen dan hubungan cue tetap berlaku. Bila rekaman pengganti lebih pendek, segmen di luar durasinya dilepas dan ditandai melalui pesan.

Impor proyek tidak meminta izin kamera, mengaktifkan audio, atau memulai rekaman baru. Preset instrumen SOMA tetap memakai menu preset lamanya.

## Pemeriksaan sebelum latihan

- Uji kamera pada laptop, pencahayaan, sudut dan jarak yang akan dipakai, termasuk berdiri, jongkok, duduk, berbaring, keluar frame dan tumpang tindih.
- Pastikan rekaman yang dimainkan merupakan berkas pembacaan yang benar. Periksa label NL/ID dan penanda kata.
- Uji master pada level rendah, lalu MUTE, HOLD, layar hitam, dan Teks asli.
- Buka proyeksi, pindahkan ke monitor tujuan, tekan F, periksa tepi aman dan keterbacaan dari kursi penonton.
- Tutup/buka ulang jendela proyeksi. Ketika komunikasi hilang, proyeksi menjadi hitam setelah sekitar 3,5 detik. Jendela yang dimuat ulang menerima keadaan terbaru.
- Jalankan latihan 30 menit pada perangkat panggung sambil merekam, lalu ekspor diagnostik. Uji browser cloud belum menggantikan uji kamera/HDMI/speaker fisik.

Catat perangkat, browser, framing, cahaya, cue, gerak pemicu, tracking hilang, reaksi gambar/bunyi, serta tindakan operator. Gunakan laporan itu untuk menyesuaikan ambang dan durasi, bukan menebak dari hasil laboratorium.
