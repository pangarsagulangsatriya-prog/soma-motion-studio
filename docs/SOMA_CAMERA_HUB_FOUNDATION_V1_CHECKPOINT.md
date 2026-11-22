# SOMA Camera Hub · Foundation V1 checkpoint
Tanggal: 22 November 2026 · Branch `feat/stage1-compose-line-trails-beta`

## Implementasi pada checkpoint ini

- `CameraHubRegistry`: katalog hingga 10 perangkat terdeteksi, source ID, generation, stream observation, per-slot lease, stale/recovery status, preview stream read-only dan penjagaan dua kamera F3 berbeda.
- `CameraHubProvider`: instance global pada root Stage 1/Stage 2/F3, refresh enumerasi `videoinput` dan event `devicechange`; Hub tidak membuka `getUserMedia` kedua.
- `CameraHubControl`: tombol Camera Hub di header SOMA dengan drawer, jumlah **benar-benar aktif**, daftar kamera, status penggunaan, preview untuk stream yang sudah tersedia, tombol gunakan kamera USB di Stage 1, dan petunjuk keterbatasan pairing HP.
- `App.tsx`: Stage 1 mendaftarkan stream webcam/HP yang sudah dimiliki tracker. Route ke webcam pilihan tetap melalui alur Stage 1 yang memicu Blackout dan QA Map.
- `F3CaptureWorkspace.tsx`: dua stream F3 teramati di Hub saat role masing-masing `live`. F3 tetap memiliki source, verifikasi frame, persetujuan, dan rana sendiri; Hub tidak menyalin frame penonton.
- Unit/E2E: batas katalog, lease ownership, stale frame, dua F3 role berbeda, overcapacity validation, header UI, dan tiga Stage tetap tampil.

## Keputusan keselamatan
- Hub **belum menjadi pemilik stream**. Stage yang telah membuka kamera tetap melakukan capture dan close; Hub mengamati status serta merekam lease. Melepas lease Hub **tidak memanggil stop pada MediaStream**.
- Stage 2 saat ini masih memakai `window.location.assign` dan re-inisialisasi halaman. Memindahkan Stage 2 ke runtime yang sama menjadi **pekerjaan CH-005 lanjutan**; jangan menyatakan sesi kamera bertahan pada perpindahan ke Stage 2 dalam checkpoint ini.
- `F3CameraRegistry` masih independen, belum membaca route assignments dari Hub. Tombol routing langsung untuk F3 A/B serta pengaturan dua feed secara global baru pada CH-007/008.
- Maks. 10 metadata perangkat terdaftar, bukan 10 stream hidup. `canAssign` menguji kapasitas dua feed, sementara registry V1 belum resource governor pembuka kamera yang menyeluruh.
- QR otomatis tidak tersedia pada GitHub Pages statis; backend Redis/phone-pair dibutuhkan pada preview terpisah. HP tetap dihubungkan dari panel Track/F3.
- Perubahan kamera melalui Stage 1 memicu Blackout dan pembatalan kalibrasi. F3 tetap menutup rana pada frame tidak fresh. Jangan mengaktifkan proyektor sendiri setelah sambungan pulih.

## Acceptance subset
- [x] CH-001 typed registry, generation dan monitoring sumber, tes negatif.
- [x] CH-002 provider pada root aplikasi dan event devicechange.
- [x] CH-004 drawer global, status dan preview stream yang sudah aktif.
- [x] CH-003 sebagian: observasi webcam/HP Stage 1 + F3, sumber masih dimiliki Stage.
- [x] CH-006 sebagian: rute USB pilihan ke Stage 1 memakai QA existing.
- [ ] CH-005: routing Stage 1 ↔ Stage 2 ↔ F3 dalam satu runtime (tanpa page reload).
- [ ] CH-007/008: F3 A/B request lease Hub, route secara atomik, satu pemilik media.
- [ ] CH-009: governor global untuk dua feed sungguhan, prioritas AI.
- [ ] CH-010: uji fisik Mac/USB, HP/WebRTC, F3 A/B simultan, jalur proyektor dan kamera antar-Stage.

## Kriteria rilis tahap ini
- `npm test`, build TypeScript/Vite, Playwright E2E, GitHub Pages deploy sukses.
- Tidak ada perubahan ke Vercel production.
- Pengujian 3/10 perangkat fisik dan handoff Stage 2 masih dinyatakan **belum terverifikasi**.
