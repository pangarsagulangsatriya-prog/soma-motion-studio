# SOMA v2 — rancangan pengembangan

## Tata layar

Studio mempertahankan warna arang dan aksen hijau pucat. Baris atas memuat pilihan Studio/Clean, fullscreen, preset, dan panduan. Kanvas memenuhi kolom kiri; panel selebar 320 px di kanan membuka tab Suara, Visual, dan Lapisan. Pemilih Hands/Body/Face/Mouse berada di atas kanvas. Bilah bawah memuat rekaman audio, sesi, dan mute. Pada layar sempit panel turun ke bawah kanvas.

Clean mempertahankan elemen video dan kanvas yang sama. Seluruh panel, metrik, dan navigasi utama disembunyikan melalui tata letak. Bilah melayang di bawah muncul ketika pointer bergerak, layar disentuh, atau pengguna menekan Tab. Bilah memudar setelah 3 detik; fokus keyboard, pointer di atas bilah, atau panel terbuka menahannya. Tombol pengaturan membuka panel mengambang di kanan, atau lembar bawah pada ponsel. Indikator kecil kamera, tracking, dan rekaman tetap terlihat dan dapat dibuka. Fullscreen memakai tombol dan state tersendiri.

## Lima layar

| Layar | Isi utama | Kontrol |
| --- | --- | --- |
| Studio | Kanvas kiri, pengaturan kanan, monitor di bawah | Input, mode instrumen, keluaran, tab panel, sesi |
| Clean / Tracking | Garis landmark di atas latar hitam | Bilah otomatis, status kecil |
| Clean / Visual | Jejak, Serat, Butiran, atau Bidang dari gerak | Bilah otomatis, label gaya |
| Clean / Pengaturan | Kanvas tetap berjalan di belakang panel | Tab Suara/Visual/Lapisan, tutup |
| Menunggu / gangguan | Pesan sesuai sumber dan penyebab | Mulai kamera, coba mouse, detail status |

## State dan tombol

- Studio/Clean hanya mengatur tampilan; C menggantinya. F meminta/keluar fullscreen. Esc menutup panel terlebih dahulu; browser menangani keluar fullscreen.
- Izin kamera dan audio hanya diminta setelah tindakan pengguna. Video tetap berjalan ketika lapisan gambar kamera disembunyikan.
- T mengganti visibilitas garis. Pilihan pelacakan: mati, selama terdeteksi, atau pemicu. Mode pemicu dapat menahan telapak terbuka 1,2 detik; dilepas dahulu sebelum dapat dipicu lagi. Pemicu tidak mengubah pemetaan suara.
- Space mematikan audio. Visual terus membaca gerak. Tidak ada pintasan global yang mengambil tombol saat pengguna mengetik pada field.
- Ganti sumber merilis suara, mengganti satu pelacak, lalu melanjutkan kamera yang sudah aktif. Memuat preset tidak meminta izin baru atau memulai kamera/rekaman yang sebelumnya berhenti.
- Pergantian tampilan, tab panel, latar, dan lapisan tidak mereset engine maupun stream rekaman.
- Status kamera, status tracking, dan status audio disimpan terpisah. Pesan izin ditolak, model dimuat, menunggu, kehilangan tracking, dan mute dapat dibaca melalui indikator.

## Hubungan gerak dan keluaran

| Fitur | Suara awal | Visual awal |
| --- | --- | --- |
| Tangan naik | Pitch naik | Titik mengikuti ketinggian |
| Gerak cepat | Kekasaran naik | Tebal jejak atau sebaran partikel naik |
| Jepit jari | Filter meredam nada | Bentuk mengerut |
| Dua tangan menjauh | Reverb melebar | Serat membentang |
| Kepala miring | Pan stereo | Bidang berputar |
| Mulut terbuka | Membuka gate dan volume | Bentuk mengembang |

Mapping suara dan visual memakai daftar target berbeda, dengan rentang, inversi, sensitivitas, threshold, serta smoothing. Fitur yang tidak tersedia pada sumber diberi label. Mouse menggunakan koordinat serta kontrol simulasi yang jelas; tidak membuat landmark tangan/wajah palsu.

## Suara dan visual

Karakter Clean mempertahankan synth yang sudah ada. Raw menambahkan noise dan saturasi; Metal memakai nada rendah berlapis serta drive; Metallic memakai partial tidak harmonis yang berdering; Dark Drone memakai lapisan rendah dengan serangan panjang. Makro Kekasaran, Berat, Ketajaman, dan Ruang mengendalikan parameter mesin. Volume master tetap terpisah. Crossfade karakter dan limiter menjaga perpindahan keluaran.

Jejak menyimpan titik ujung jari dengan umur terbatas. Serat memakai beberapa garis lengkung antara titik terdeteksi. Butiran memakai pool berukuran tetap dan kecepatan berbasis waktu. Bidang mengubah geometri dari posisi/rotasi. Gaya mempunyai kepadatan, ukuran, durasi jejak, dan warna. Canvas 2D membatasi DPR dan jumlah elemen agar grafis tidak mendominasi beban tracking.

## Preset dan kompatibilitas

Preset versi 2 menyimpan sumber, mode, suara, makro, visual, lapisan, serta kedua jenis pemetaan. Izin, stream, status mute, dan rekaman tidak disimpan sebagai konfigurasi. Preset versi 1 dimigrasikan. Kalibrasi hanya dipakai untuk jenis input yang sama. Perubahan sumber dapat mengganti mapping bawaan; mapping tersimpan dipulihkan saat memuat preset.

## Urutan

1. Clean, panel melayang, lapisan, status, dan fullscreen terpisah.
2. Karakter suara, makro, Jejak/Serat, dan pemetaan visual.
3. Face, Butiran/Bidang, serta pemicu tahan telapak.
4. Uji perpindahan sesi, migrasi preset, pelacakan hilang, audio, rekaman, dan layout. Perbarui paket kode dan terbitkan pada Site yang sama.

## Kriteria selesai

- Clean/Studio dapat diganti saat input dan rekaman berjalan; waktu rekaman tidak kembali nol.
- Menyembunyikan kamera atau garis tidak menghentikan deteksi.
- Mute serta pilihan keluaran Visual menghasilkan audio diam sementara gambar tetap merespons.
- Garis memudar setelah tracking hilang; audio dilepas melalui watchdog. Tidak ada landmark rekaan.
- Preset baru pulih persis; preset lama tetap valid.
- Perubahan kecepatan frame tidak mempercepat umur jejak atau gerak partikel.
- Tidak ada elemen terpotong pada lebar 390, 768, dan desktop.
- Semua karakter menghasilkan audio nyata, rekaman dapat didekode, dan output tetap terbatas.
- Inferensi tangan, tubuh, dan wajah harus diuji dengan kamera fisik sebelum dipakai latihan panggung. Browser QA tanpa WebGL diberi status belum terverifikasi.

Referensi API wajah: https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js
