# SOMA / FOOTPRINTS — Rencana Pengembangan

Status: rancangan · 15 November 2026

## Tujuan

Performer berjalan, berhenti, menyeret, atau mengubah arah. SOMA membaca gerak kaki, menggambar jejak dan rangka, lalu menerjemahkan gerak itu menjadi suara. Operator dapat memproyeksikan hasilnya, merekam video, dan memutar rekaman kembali.

## Audit versi sekarang

- Kanvas hitam tampil tanpa contoh awal. Pengguna sulit membayangkan hasil sebelum kamera aktif.
- Panel mencampur kamera, bentuk, waktu, output, dan ekspor dalam satu kolom. Tombol Hold dan Blackout tidak menjelaskan dampaknya.
- Slider kurang terbaca pada tangkapan layar. Nilai dan perubahan visual perlu terlihat jelas.
- Tapak sekarang berupa oval yang mengikuti titik kaki terus-menerus, termasuk saat kaki terangkat. Belum ada orientasi tapak atau perkiraan sentuhan lantai.
- Tidak ada preview kamera atau rangka untuk memeriksa framing. Status belum membedakan kamera gagal dan kaki di luar bingkai secara memadai.
- Output memakai jendela canvas terpisah, belum memakai kalibrasi Projection. Belum ada heartbeat untuk memberi tahu operator ketika output terputus.
- Ekspor saat ini berisi JSON titik jejak; belum menghasilkan video atau pemutar rekaman. Audio Footprints juga belum tersedia.

## Pengalaman yang dirancang

Alur utama: **pilih sumber → cek kaki → pilih tampilan → buka output → rekam**. Saat pertama masuk, tampilkan preview contoh dan tombol utama “Mulai kamera”. Mode mouse tersedia sebagai tautan “Coba tanpa kamera”.

Susunan desktop:

1. Header: kembali ke Studio, nama Footprints, status kamera dan output, tombol Buka output.
2. Area tengah: kanvas besar dengan tab **Komposisi** dan **Kamera & rangka**. Kanvas menunjukkan keadaan kosong, loading, atau tracking hilang dengan instruksi singkat.
3. Panel kanan: empat tab **Gerak**, **Visual**, **Suara**, **Rekaman**. Setiap tab menampilkan pilihan utama; parameter rinci berada di “Pengaturan lanjutan”.
4. Bar bawah: Live / Tahan / Blackout, Bersihkan, Rekam / Stop, dan durasi. Blackout selalu terlihat dan memiliki status aktif yang tegas.
5. Di layar sempit, panel berpindah ke bawah kanvas. Target sentuh minimal 44 px, label selalu terlihat, seluruh kontrol bisa diakses keyboard.

### Keadaan dan micro-interaction

| Keadaan | Tampilan dan tindakan |
|---|---|
| Belum aktif | Contoh jejak halus, tombol Mulai kamera, opsi uji mouse |
| Meminta izin / memuat | Indikator proses dan teks spesifik; cegah klik ganda |
| Kamera aktif, kaki belum terlihat | Preview kamera dan petunjuk untuk memasukkan kaki ke bingkai |
| Satu / dua kaki | Indikator kiri dan kanan; titik pada rangka menyala sesuai confidence |
| Tracking hilang | Garis terputus; status berubah, tidak menggambar garis ke posisi perkiraan |
| Output terhubung / terputus | Label terlihat; tawarkan buka ulang. Output gagal aman menjadi hitam |
| Rekam | Titik merah, waktu berjalan, tombol Stop; setelah berhenti tampilkan preview dan Simpan |

Animasi tombol 120–200 ms untuk hover, tekan, dan perubahan status; label tidak mengandalkan warna. Hormati `prefers-reduced-motion`. Slider punya track kontras, nilai aktual, satuan, dan reset.

## Rangka dan gerak kaki

- Pilihan overlay: **Mati**, **Kaki**, **Tubuh**, **Titik**. Rangka kaki memakai pinggul, lutut, pergelangan, tumit, dan ujung kaki; hubungan hanya digambar ketika kedua titik cukup yakin.
- Atur warna, ketebalan, opacity, dan jejak rangka. Preview operator dapat menampilkan kamera; output proyektor memiliki toggle tersendiri agar video kamera tidak muncul tanpa dipilih.
- Haluskan koordinat dengan mempertimbangkan waktu frame. Putuskan garis saat titik hilang, timestamp usang, atau lompatan melampaui ambang. Saat titik kembali, mulai segmen baru.
- Tampilan skeleton merupakan estimasi model, bukan pengukuran tulang. Uji kamera sudut tinggi dan frontal: pose seluruh tubuh sering gagal saat kamera tepat di atas atau badan terpotong. Catat hasil nyata sebelum menentukan posisi kamera standar.
- Pemetaan ke lantai memakai pasangan titik sumber kamera dan tujuan output serta homografi yang sudah tersedia di `projection/geometry.ts`. Simpan preset kalibrasi, validasi titik, orientasi cermin, perubahan kamera dan rasio video.

## Bahasa visual

| Preset | Gerak visual | Kontrol utama |
|---|---|---|
| Tapak | Bentuk kaki abstrak mengikuti arah tumit → ujung; cetak saat estimasi kontak | ukuran, umur, opacity |
| Lintasan | Garis halus terputus ketika kaki hilang | ketebalan, warna, fade |
| Seret | Pita dari perpindahan kaki dekat lantai | lebar, sensitivitas |
| Jeda | Lingkaran tumbuh selama kaki relatif diam | ukuran, waktu tumbuh |
| Rangka | Tulang kaki / tubuh dan titik sendi | warna, ketebalan, lapisan |
| Echo | Jejak lama muncul dengan jeda | delay, jumlah lapisan, fade |

Operator boleh menggabungkan rangka dan jejak. Beri palet panggung terang/gelap, pemisahan kiri–kanan, ukuran dalam satuan relatif layar, dan preview pada latar hitam. Batasi jumlah titik dan durasi agar sesi panjang tetap stabil.

Kontak lantai memakai estimasi dari tinggi relatif, perubahan kecepatan, dan dwell; kamera tunggal tidak mengukur tekanan atau gaya. Parameter disetel saat uji fisik. Jika confidence rendah, tampilkan titik berjalan tanpa mengeluarkan event tapak.

## Suara dari gerak

Tombol **Aktifkan suara** harus diklik terlebih dahulu. Default volume rendah dan mute jelas. Operator dapat memilih preset **Hening**, **Dengung**, **Butiran**, atau **Langkah**.

| Data | Respons awal | Pengaman |
|---|---|---|
| Posisi horizontal | pan kiri ↔ kanan; opsi ubah pitch | smoothing; mono tetap terdengar |
| Kecepatan | volume atau kepadatan butiran | batas volume dan laju perubahan |
| Estimasi kontak | bunyi pendek per langkah | debounce dan batas polyphony |
| Diam | nada menahan atau memudar | release halus |
| Tracking hilang | suara memudar | tidak membuat event palsu |

Kiri/kanan kamera dan output mengikuti pilihan cermin. Gunakan AudioContext SOMA bila memungkinkan; pastikan perpindahan mode, mute, dan blackout punya perilaku yang dijelaskan. Blackout mengendalikan cahaya; mute mengendalikan suara secara terpisah.

## Rekam, simpan, putar

Sediakan dua hasil yang jelas:

1. **Video komposisi**: rekam canvas output dan suara Footprints ke file video. Pilih MIME melalui `MediaRecorder.isTypeSupported`, gabungkan canvas `captureStream()` dengan `MediaStreamDestination` audio, lalu gunakan ekstensi sesuai format browser. Jangan menjanjikan MP4 di semua browser.
2. **Data sesi**: simpan timestamp, koordinat, event, preset, dan kalibrasi sebagai JSON versi tertentu. Ini memungkinkan render ulang dan pengaturan visual berbeda; JSON tidak berisi video kamera.

Rekaman video menampilkan komposisi yang dipilih, termasuk rangka jika toggle output aktif. Video kamera mentah hanya masuk bila pengguna memilih lapisan kamera. Tombol Rekam memulai satu jam sesi bersama audio; Stop menyelesaikan blob; tampilkan preview video dengan play/pause, scrub, durasi, nama, unduh, dan hapus. Simpan lokal melalui IndexedDB bila kapasitas tersedia; tampilkan progres, batas penyimpanan, dan kesalahan. Unduhan menjadi salinan yang bisa diputar di luar SOMA. Jangan menjanjikan file tetap tersimpan setelah data browser dihapus.

State: `idle → recording → finalizing → ready → playing/paused`; sertakan `error`. Saat gagal, pertahankan potongan yang sudah tersedia jika browser memungkinkan. Uji format, sinkronisasi audio-video, tab tersembunyi, batas memori, penghentian kamera, dan sesi panjang. Target awal 720p/30 fps, durasi uji 10 menit; ukur kinerja perangkat sebelum menaikkan target.

## Sprint dan prioritas

### P0 — Studio yang bisa dipahami dan diuji

- Tata ulang halaman dan status; preview kamera/rangka kaki; pilihan kamera dan uji mouse.
- Perbaiki titik kaki, confidence, outlier, lost/reacquisition; pisahkan output dan status koneksi.
- Kalibrasi empat pasangan titik ke bidang proyeksi; uji orientation dan mirror.
- Beri visual Lintasan dan Tapak abstrak yang terbaca. Jelaskan estimasi kontak.
- Kriteria: alur mulai hingga output dapat diselesaikan tanpa membaca manual; kehilangan kaki tidak menggambar garis silang; reset dan blackout bekerja.

### P1 — Suara dan video sesi

- Preset visual, rangka tubuh, kontrol warna dan ketebalan, delay dan fade.
- Pan, pitch, dinamika gerak, event kontak, tombol mute dan aktivasi audio.
- Rekam komposisi dengan audio, preview, playback, unduh dan simpan lokal; ekspor data sesi.
- Kriteria: rekaman berisi visual serta audio yang dipilih, durasi dan playback benar, file dapat dibuka ulang, tracking hilang memudarkan suara.

### P2 — Permainan panggung

- Echo, replay data, seret, jeda, dan cue untuk berpindah visual/suara.
- Uji dua performer dan pemisahan identitas; tandai eksperimental sampai crossing dan occlusion lolos pengujian.
- Eksplorasi jejak lama sebagai jalur yang bisa diikuti, dihindari, atau ditinggalkan.

## Pengujian dan penerimaan

- Unit: homografi, batas nilai audio, contact debounce, reset setelah lost, buffer jejak, state recorder, validasi impor.
- Browser: izin kamera ditolak/diterima, popup diblokir, fullscreen, kontrol keyboard, reduced motion, resize, codec dan penyimpanan penuh.
- Fisik: satu performer berjalan lurus, menyilang, berhenti, menyeret, melangkah mundur; coba sepatu dan kaki telanjang dengan kamera tinggi dan frontal. Bandingkan output laptop dan proyektor pada bidang datar.
- Ukur median/P95 waktu deteksi dan jeda gerak-ke-cahaya dengan pengukuran fisik; jangan menyebut target latensi sebagai hasil sebelum diukur.
- Uji dengan operator baru: nyalakan kamera, lihat rangka, buka output, rekam, lalu putar dan unduh. Catat bagian yang membuatnya berhenti atau salah memilih.

## Berkas dan integrasi

Pecah `src/Footprints.tsx` menjadi workspace, tracking, renderer, audio, recording, playback, dan stylesheet. Pakai `MotionFrame.pose` untuk landmark awal; gunakan utilitas geometri Projection dan jalur komunikasi output yang punya heartbeat. Audit lifecycle kamera dan audio ketika berpindah Studio/Footprints. Jangan merekam ulang sumber kamera tanpa pilihan pengguna. Pertahankan kompatibilitas Studio, Archive, Projection dan preset yang sudah ada.

## Keputusan kerja awal

Satu performer, output layar terpisah, rangka kaki sebagai overlay opsional, jejak putih lembut, audio default mati, rekaman komposisi + audio saat dipilih. Kalibrasi dan hasil uji kamera fisik menentukan konfigurasi panggung akhir.
