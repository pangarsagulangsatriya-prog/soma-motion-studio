# SOMA V3 — S4 Usability Audit & Visual Polish

**Tahap:** S4 · kandidat review; belum production
**Basis:** S0 functional inventory → S1 IA reset → S2 Stage-first Studio → S3 microinteraction
**Jenis audit:** inspeksi statis komponen React/CSS dan CI otomatis. **Belum ada sesi uji pengguna, screenshot per perangkat, tes webcam fisik, atau proyektor** dalam tahap ini.

## 1. Temuan S4 dan tindakan

| ID | Tingkat | Temuan dari kode S3 | Perbaikan S4 |
| --- | --- | --- | --- |
| UX-41 | P0 | Shortcut global menganggap elemen `<summary>` sebagai panggung; Space dapat membisukan audio dan menghalangi dropdown terbuka | Batasi shortcut ke area noninteraktif. Button/link/summary/input/custom tab menggunakan perilaku keyboard normal; mouse-stage tetap bisa memakai shortcut |
| UX-42 | P0 | Inspector di layar <= 1359px menjadi overlay tetapi tidak memiliki kontrol tutup di dalam panel; pengguna harus mencari tombol Transport di belakangnya | Tambahkan tombol X di judul Inspector dan backdrop yang bisa diketuk di luar panel |
| UX-43 | P1 | Saat layar 390px, header dan panel dapat terasa rapat; tap target serta urutan perhatian kurang jelas | Perkecil logo tanpa menghilangkan Global Nav, perjelas jarak antar-scene, pertahankan kontrol utama >= 40–44px, perbaiki scroll-snap Scene Picker |
| UX-44 | P1 | Status tracking hilang membutuhkan pembeda yang jelas saat operator memandang panggung | Pertegas warna teks dan indikator status Lost, jaga dukungan reduced-motion |
| UX-45 | P1 | Capture Hub dan Inspector memiliki teks penjelasan berukuran kecil dibanding kontrol lain | Normalisasi font dan line-height, jarak elemen dan indikator fokus |
| UX-46 | P1 | Tidak ada kriteria kuantitatif untuk membedakan build berhasil dari usability berhasil | Tambah fungsi perhitungan tingkat keberhasilan dan lembar uji operator. **Tidak ada angka hasil pengguna yang diklaim** |

## 2. Peta alur 5 tugas utama

| Tugas | Langkah yang harus dapat dijalankan | Ukur |
| --- | --- | --- |
| T1 — Mulai Body | Buka Studio → Pilih sumber Tubuh → Mulai Kamera → Lihat indikator Tracking | Waktu sampai status aktif, jumlah kegagalan izin, jumlah klik tidak terduga |
| T2 — Mainkan Footprints | Pilih Footprints → Hubungkan Body → Berjalan → Ubah Gaya dan warna kaki | Apakah jejak bergerak, respons perubahan gaya, kebutuhan bantuan |
| T3 — Simpan pola | Capture → Pola → Ekspor PNG/SVG/JSON → Buka JSON dan ganti warna | Keberhasilan file, jumlah langkah, waktu menemukan tombol, kualitas hasil |
| T4 — Potret | Capture → Foto → Buka bingkai → Gerakkan dua pergelangan → Pukul atau Jepret manual | Frame berhasil, foto disimpan, kontrol fallback ditemukan |
| T5 — Projection | Output → Buka Output → Live/Hold/Blackout → Kalibrasi | Kejelasan status sambungan, jeda respons, blackout hanya pada proyektor |

### Skrip uji
Tunjukkan UI Preview kepada operator tanpa mendemonstrasikan tombol. Bacakan tugas secara singkat. Catat apakah selesai mandiri, selesai setelah satu petunjuk, atau tidak selesai. Catat hambatan spesifik, klik yang keliru, kontrol yang dicari, dan kejadian visual yang tidak muncul. Ulangi lima tugas pada setidaknya satu performer dan satu operator teknis agar dua perspektif terwakili; sampel kecil ini untuk menemukan masalah utama, bukan estimasi statistik populasi.

### Ambang penerimaan S4 yang diusulkan (target, belum hasil)
- Seluruh tugas T1–T5 **harus tersedia dan dapat dijalankan** pada desktop.
- Sedikitnya 4 dari 5 tugas selesai mandiri untuk setiap peserta; T5 Blackout harus lulus penuh sebelum pertunjukan.
- Tidak ada shortcut panggung yang memotong interaksi keyboard dengan menu dan form.
- Semua perubahan scene, ekspor, dan fungsi audio tetap bekerja setelah perangkat sempat kehilangan tracking.
- UI 390×844, 768×1024, 1280×720, dan 1440×900 tidak memiliki kontrol yang tertutup tanpa jalur buka/tutup.
- Keluaran proyektor mengikuti Live/Hold/Blackout SOMA, tanpa membuka engine Footprints kedua.

## 3. Matriks verifikasi

| Lapisan | Cara validasi | Status |
| --- | --- | --- |
| Pure UI rules | Node unit tests: keyboard guard, state kamera, tab, ekspor, completion rate | Mengikuti CI |
| Kompilasi | `npm run build`, TypeScript + Vite | Mengikuti CI |
| UI browser nyata | Screenshot + inspeksi klik/scroll/fokus pada empat viewport | **Belum diuji** |
| Webcam/gestur foto | Gerakan fisik, pencahayaan, izin browser, simpan empat foto | **Belum diuji** |
| Body Footprints | Langkah kiri-kanan, perubahan gaya, ekspor, impor, rekam | **Belum diuji** |
| Proyektor fisik | Kalibrasi, jendela output, transport & blackout | **Belum diuji** |
| Usability performer | Waktu tugas T1–T5 + catatan hambatan | **Belum diuji** |

## 4. Catatan perubahan
- Komponen UI diperbarui: `App.tsx`, `SceneInspector.tsx`, `studio-v3.css`, `interaction.ts`.
- Unit tests diperluas di `tests/v3-microinteractions.test.ts`.
- Tidak ada perubahan pada engine audio, Body Pose tracker, storage, Footprints renderer, dan Projection calibration.
- Pada desktop inspector bisa ditutup melalui X ataupun tombol Atur Visual; pada mobile ada backdrop yang menutupnya.
- Gestur keyboard panggung tetap tersedia saat fokus pada kanvas atau body, dan dilepas ketika fokus pada kontrol interaktif.

## 5. Keputusan rilis
S4 mencakup **heuristic review dan perbaikan kode**. CI yang hijau memvalidasi kompilasi dan aturan teruji; belum memvalidasi kemudahan pakai secara empiris. **PR tetap draft**, dan rilis ke `main` hanya dilakukan setelah pengecekan browser, kamera, dan proyektor dipenuhi.

Lanjutkan ke S5 Regression & Release hanya sesudah daftar tugas lapangan sudah dijalankan. 
