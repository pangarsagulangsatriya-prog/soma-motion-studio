# SOMA / ARCHIVE — audit, rancangan, dan cakupan

## Titik awal

Checkout SOMA v2 berbasis React 19, TypeScript, Vite, MediaPipe Tasks Vision, Web Audio, dan Canvas 2D. Audit memakai baseline commit `8cbeb1f0fe3d2189c389ccec5769ac727ac36a99`. Tidak ada dependensi baru. Build Archive ditahan dari publikasi sesuai paket instruksi pengguna.

| Bagian SOMA | Kondisi awal | Perubahan Archive |
| --- | --- | --- |
| Kamera / pelacak | Satu stream, satu jenis pelacak aktif; Hands/Body/Face/Mouse | Body meminta maksimum dua pose. `MotionFrame.poses` opsional; `pose` pertama tetap tersedia bagi instrumen lama. |
| Audio | Satu AudioContext, synth, efek, limiter, master, tujuan rekaman | Tambah bus Archive sebelum limiter. Synth dapat dimatikan sebagai lapisan terpisah. |
| Preset | Versi 1/2 instrumen dan migrasi | Proyek Archive memakai skema/key terpisah, tanpa menimpa preset instrumen. |
| Studio / Clean | Video/canvas dipertahankan saat panel disembunyikan | Workspace Archive tambahan; komposisi Clean tanpa UI; instrumen tetap terpasang untuk menjaga sesi. |
| Proyeksi | Satu jendela aplikasi | Route `?projection=...` hanya memasang renderer dan kanal komunikasi. |
| Rekaman | MediaRecorder dari master | Audio Archive ikut dalam take yang sama; tidak membuat recorder tambahan. |

## Tata layar dan interaksi

Studio Archive menggunakan kanvas lebar di kiri dan panel 350–370 px di kanan. Empat tab mengelompokkan pekerjaan operator: sumber, input, hubungan gerak, dan cue panggung. Transport, cue, pemicu manual dan rekaman selalu berada bersama kanvas. Pada lebar ≤850 px, panel turun ke bawah.

Clean Archive menghapus header, transport, panel, status, notifikasi dan cursor. Fullscreen tetap merupakan aksi terpisah. Proyektor memakai letterbox sesuai rasio, tepi aman, teks serif dan latar hitam. Warna arang dan hijau pucat dipertahankan di Studio. Rasio tersedia 16:9, 4:3, 1:1 dan 9:16; konfigurasi JSON menerima rasio 0,56–2,4.

Urutan operator: pilih sumber → siapkan pembacaan/segmen → pilih input dan kalibrasi → pilih aturan dalam cue → siapkan cue → GO. Setiap rule memiliki pemicu manual. Setiap cue menampilkan kutipan utuh terlebih dahulu selama 1,4 detik. Penanda “KOMPOSISI PANGGUNG” tampil ketika transformasi bekerja, bila diaktifkan.

## Modul dan kontrak

| Modul | Tanggung jawab |
| --- | --- |
| `types.ts`, `fixture.ts` | ID stabil; tujuh entri Tillema; sumber asli terpisah dari terjemahan; empat aturan dan tujuh cue awal. |
| `store.ts` | Validasi skema versi 1, rentang, ID, timecode dan hubungan; localStorage proyek; IndexedDB Blob media. |
| `motion.ts` | Tinggi pinggul, horizontalitas torso, diam, sapuan pergelangan, jarak A/B, kontinuitas dan ketidakpastian identitas. |
| `rules.ts` | Smoothing, ambang, hysteresis, dwell, cooldown, inversi, pelepasan, durasi dan pemicu operator. |
| `render.ts`, `ArchiveCanvas.tsx` | Token teks tanpa mengubah sumber; komposisi, media, skeleton valid, pergantian media, video diam dan letterbox. |
| `voice.ts` | Buffer dekode sekali, playback utuh/seek/mundur, grain 160 ms, loop, crossfade, filter/tekstur, cap enam suara dan pelepasan node. |
| `cues.ts` | SIAP/BERJALAN/DITAHAN, waktu cue, deduplikasi GO, perpindahan manual/otomatis. |
| `projection.ts`, `ProjectionScreen.tsx` | Kanal same-origin, session/sequence, heartbeat, reconnect, blank ketika data berhenti. |
| `useArchive.ts` | Snapshot 33 ms, integrasi ke engine lama, siklus proyek/media, operator override, tangkapan satu foto, diagnostik terbatas. |
| `ArchiveWorkspace.tsx`, `archive.css` | Antarmuka berbahasa Indonesia, editor sumber/segmen/aturan/cue, kontrol perangkat dan tata layar adaptif. |

Satu snapshot gerak bertimestamp memasok rule engine. Efek yang sama memberi data ke visual dan suara. React menerima pembaruan status sekitar lima kali per detik; inferensi kamera tetap pada alur pelacak lama. Canvas menggambar melalui requestAnimationFrame. Jendela proyeksi menerima keadaan serializable dan membaca media dari IndexedDB origin yang sama, membuat object URL sendiri.

## Hubungan gerak yang bisa diulang

| Aturan | Kondisi | Akibat visual | Akibat suara |
| --- | --- | --- | --- |
| TIDUR | Pinggul rendah + torso horizontal + durasi diam, lalu dwell | Jarak baris mengecil; token sasaran bertambah dengan batas 20 salinan | Segmen terpilih berulang, interval minimum 220 ms. |
| NYAMUK | Kecepatan sapuan pergelangan | Token sasaran berpencar menurut arah; kembali dengan durasi terpilih | Grain 160 ms; posisi horizontal memilih cuplikan, arah memilih maju/mundur. |
| PENILAIAN | GO dan fitur rendah/diam yang dipilih | Kalimat utuh, lalu jarak token berubah | Bacaan NL sekali lalu ID; gerak tidak memotong kalimat. |
| DUA TUBUH | Kedua aktor valid, jarak relatif tersedia | Dua kolom bergeser | Kedua track bersamaan, crossfade equal-power dari jarak. |
| FOTO HIDUP | Operator atau diam 2,5 s yang telah disiagakan | Satu frame menjadi media, pemicu otomatis mati kembali | Tanpa bunyi baru secara bawaan. |

Ambang awal hanya titik berangkat latihan. Label TIDUR tidak mengukur tidur, lelah, napas, atau kondisi medis. Kalibrasi bergantung pada framing dan jarak kamera. Kedua tubuh tetap perlu diuji langsung.

## Keadaan aman dan data

- Tidak ada landmark rekaan ketika kamera hilang. Diam dihitung ulang setelah kehilangan pose; kecepatan pertama setelah muncul kembali nol.
- Identitas ambigu mengunci pemetaan hingga swap/reassign. Hilangnya salah satu pasangan menghilangkan fitur jarak, bukan mengubahnya menjadi nol.
- Rule yang kehilangan data tidak membuat trigger audio baru. Visual dapat ditahan sebentar lalu memudar. Pilihan “tunggu pemicu operator” tetap terkunci sampai operator atau input manual memulihkannya.
- Cap enam node sampel mencakup suara yang menunggu event akhir. Envelope masuk/keluar sekitar 12 ms, pelepasan sekitar 35 ms, watchdog audio mulai meredam setelah 650 ms tanpa heartbeat.
- Batas dekode audio 240 MiB, rekaman 30 menit/40 MiB, media tunggal 100 MiB. Diagnostik dibatasi 1.800 sampel dan 400 event; tidak merekam gambar kamera otomatis.
- Sumber asli tidak diedit. Revisi mendapat ID baru. Transformasi dihitung pada token salinan dan dapat dipulihkan.
- Ekspor JSON tidak mengangkut Blob. Slot hilang harus ditautkan ulang secara eksplisit. Tidak ada unggah kamera/audio ke layanan eksternal.
- Audio aktif, izin kamera, fullscreen, dan status rekaman tidak dipulihkan oleh impor proyek.

## Urutan implementasi dan hasil

| Tahap | Cakupan kode | Bukti utama |
| --- | --- | --- |
| 0 | Audit, folder Archive, fixture dan entry workspace | Aplikasi lama tetap dapat dibuka; typecheck. |
| 1 | Sumber, revisi, renderer, aturan inti dan simulasi | Unit test integritas teks, dwell/hysteresis, manual dan lost; uji Turun melalui UI. |
| 2 | Voice, segmen, seek/filter/tekstur, bus rekaman bersama | 22 pemeriksaan browser; rekaman keluaran UI 7,44 detik berisi sinyal audio. |
| 3 | Dua pose, identitas, cue, shortcut dan proyeksi | Unit test pergantian urutan/occlusion/persilangan; jendela proyeksi tanpa kontrol. |
| 4 | Impor gambar/video, reveal/pan/overlay, foto satu kali | Implementasi lokal; hasil pemeriksaan media dijabarkan dalam verifikasi. |
| 5 | Regresi, uji panjang, build dan manual | Lihat `verification.md` untuk hasil aktual dan batas perangkat. |

## Batas yang tetap berlaku

Pelacakan kamera fisik, deteksi dua orang berbaring/menyilang, keluaran HDMI, kualitas pengeras suara dan latensi ujung-ke-ujung belum terverifikasi di perangkat panggung. Ukuran inputAgeMs hanya umur snapshot di browser; jadwal audio tidak mengukur waktu bunyi keluar dari speaker. Tidak ada janji FPS perangkat target dari angka cloud.

Video diam; sumber suara harus berupa rekaman terpisah. Belum ada word alignment otomatis, rekaman video proyeksi, granular pitch-preserving, mikrofon langsung, atau unggah media lintas perangkat. Setelah model dan aset lokal tersedia, pemutaran dapat memakai berkas lokal; cache offline untuk membuka ulang situs tanpa server belum dibuat.

Konten Tillema berasal dari paket pengguna. Ejaan `Tandjong Priok` dan frasa Belanda dipertahankan. Paragraf konteks Indonesia ditandai sebagai transkripsi/terjemahan kerja dengan `[...]`. Sumber primer belum diperiksa secara independen dalam pekerjaan kode ini.
