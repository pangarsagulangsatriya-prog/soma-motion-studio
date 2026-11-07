# SOMA / ARCHIVE — mulai latihan

Paket lokal ini menambahkan workspace Archive pada SOMA. Belum dipublikasikan. Siapkan rekaman pembacaan sendiri; template hanya memuat teks dan aturan awal.

## Memakai paket build

1. Ekstrak `SOMA-Archive-rehearsal-build.zip`.
2. Buka Terminal di folder hasil ekstrak, lalu jalankan:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Pada Windows dengan Python terpasang, gunakan `py -m http.server 4173 --bind 127.0.0.1 --directory dist`.

3. Buka **http://localhost:4173** di browser. Pertahankan Terminal terbuka. Tekan Ctrl+C di Terminal untuk menghentikan server setelah latihan.
4. Klik **Archive**. Pilih **Turun → Gerak → Manual / uji → Coba pose rendah**, lalu **GO**.
5. Buka **Arsip** untuk memasukkan pembacaan. Buka **Pemetaan** untuk memilih segmen suara. **Buka proyeksi** menampilkan komposisi pada jendela kedua.

Model dan WASM sudah ikut dalam paket build. Jangan membuka `dist/index.html` langsung melalui file manager: kamera dan komunikasi antarjendela memerlukan localhost atau HTTPS. Font jarak jauh bersifat opsional; font sistem tersedia sebagai cadangan.

## Memakai kode sumber

Ekstrak `SOMA-Archive-source.zip`. Gunakan Node.js 22 atau lebih baru dan internet untuk pemasangan awal:

```sh
npm ci
npm run setup:assets
npm run dev
```

Buka **http://localhost:4173**. Jalankan pemeriksaan dengan `npm test` dan buat build dengan `npm run build`. Folder `tests/` tersedia pada server pengembangan; halaman pengujian tidak ikut build produksi.

## Berkas panduan

- `docs/archive/operator.md`: tombol, cue, pemulihan kamera, impor audio/media dan proyeksi.
- `docs/archive/architecture.md`: modul, hubungan gerak dan batas implementasi.
- `docs/archive/verification.md`: hasil nyata, bukti pengujian dan bagian yang belum terverifikasi.

Dalam paket build, ketiga panduan juga tersedia di folder `panduan/`.

## Simpan sesi sebelum menutup

Ekspor JSON proyek. Simpan berkas audio/gambar/video aslinya bersama JSON karena ekspor tidak membawa media. Unduh take audio dari Rekaman sesi. Penyimpanan browser terikat pada alamat dan profil: `localhost:4173`, port lain, dan Site publik memiliki data terpisah.

Uji kamera dua pemain, posisi berbaring, proyektor, speaker dan sesi 30 menit di laptop tujuan sebelum pertunjukan. Hasil uji panjang cloud belum terverifikasi; rincian tersedia pada laporan pemeriksaan.
