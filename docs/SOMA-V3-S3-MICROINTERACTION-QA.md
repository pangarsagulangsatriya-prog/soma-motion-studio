# SOMA V3 — S3 Microinteraction & Usability Refinement

**Scope:** penghalusan UI pada kandidat S2 yang belum masuk production. PR draft tetap menjadi gerbang rilis. Camera, MotionFrame, Audio Engine, Footprints/Gait Analyzer, Archive, dan Projection tidak dibuat ulang.

## Implementasi S3

| Kode | Kondisi awal S2 | Perubahan S3 | Uji manual wajib |
| --- | --- | --- | --- |
| S3-01 | Menu Transport dapat tetap terbuka ketika berpindah kontrol | Satu popover terbuka pada satu waktu; klik di luar menutup; Escape menutup dan mengembalikan fokus ke summary | Mouse/keyboard pada dropdown Input, Suara, Rekam, Output |
| S3-02 | Kamera hanya melaporkan status generik | Status terpisah untuk mouse, loading, error, off, tracking, lost, dan searching. Error menyediakan tombol Coba lagi | Cabut kamera, tolak izin, keluar dari bingkai, ulangi |
| S3-03 | Footprints saat sumber Mouse/Hands sering tidak menghasilkan visual | Akses kamera Body eksplisit, tombol tunggu/sambung ulang tetap tampak. Memilih Footprints dari keluaran Suara menghidupkan visual melalui Keduanya | Beralih Mouse → Footprints, klik Nanti, sambung lagi |
| S3-04 | Capture dapat menampilkan sampel lama dan tombol ekspor aktif saat kosong | Sampel Footprints diperbarui berkala ketika tab Pola dibuka; PNG/SVG/JSON aktif setelah pola tersedia. Impor JSON memilih scene Footprints | Rekam 10+ langkah, buka Capture → Pola, cek jumlah dan ekspor |
| S3-05 | Rekaman kurang jelas; perpindahan saat video direkam mengejutkan | REC menampilkan durasi; pindah scene/source, mematikan kamera, atau memilih Suara saja saat rekaman video memerlukan konfirmasi | Rekam Footprints, ganti scene dan pilih Batal, ulangi lalu Lanjut |
| S3-06 | Scene Inspector dan Capture tab kurang ramah keyboard | ArrowLeft/ArrowRight/Home/End memindahkan tab beserta fokus; tab diberi ID dan aria-controls | Navigasi penuh dari keyboard, uji screen reader |
| S3-07 | Tampilan Perform kadang memberi kontrol Visual/Rekam yang berbeda dari scene | Dock Perform memilih visual Footprints dan rekam video saat Footprints aktif; scene suara memakai fungsi audio yang sama | Masuk Perform dari Footprints dan teks; rekam dan keluar |
| S3-08 | Dropdown terpotong oleh kontainer kanvas, status kurang terlihat | Parent overflow dibuka untuk menu, state warna dibedakan, tombol disabilitas/tekan/fokus jelas; reduced motion dihormati | 390×844, 768×1024, 1280×720, 1440×900 |

## Invarian teknis
- Satu kamera dan satu `MotionFrame` tetap dipakai lintas scene.
- Gestur foto tetap mengandalkan pose tubuh serta capture manual sebagai cadangan.
- Footprints memakai engine `src/footprints/`, termasuk analisis gait.
- Keluaran Projector Live/Hold/Blackout tetap lewat Projection SOMA yang sudah ada.
- Archive serta preset existing tetap menggunakan penyimpanan sebelumnya.
- Status warna *searching/lost* hanya penjelasan antarmuka; tidak mengubah algoritma pendeteksi.
- "Tahan gambar" menjaga komposisi kanvas; "Tahan output" membekukan keluaran proyektor.
- Pengalihan video saat merekam menggunakan persetujuan pengguna dan jalur MediaRecorder lama.

## Lima uji operator sebelum merge
1. **Memulai gerak** — buka preview, pilih Tangan atau Tubuh, izinkan kamera, pastikan status berubah dari Menghubungkan → Mencari → Gerak terbaca.
2. **Siklus Footprints** — pilih Footprints dari Mouse, baca permintaan kamera Body, klik Nanti, sambung ulang, ubah warna, hasilkan jejak, Capture → Pola PNG/SVG/JSON, impor JSON dan periksa hasil.
3. **Kamera foto** — Capture → Foto, buka bingkai; pembesaran tangan, pukul kiri/kanan/atas/bawah, manual Jepret; verifikasi empat slot dan pemulihan foto.
4. **Audio & video** — rekam suara, pindah ke Footprints dan rekam video, coba pindah scene (Batal harus tetap merekam; Lanjut harus mengakhiri dan mengunduh), lalu buka Capture → Rekaman.
5. **Proyektor & Perform** — buka output, pilih Live/Hold/Blackout, periksa kalibrasi tidak berubah; masuk Perform dan operasikan tombol visual/record melalui dock.

## Kriteria penerimaan
- `npm test` dan `npm run build` lulus pada commit PR.
- Tidak ada perubahan pada `main` sebelum pengujian nyata selesai.
- Perubahan scene tidak menghapus sampel Footprints atau foto tanpa perintah eksplisit.
- Tombol Export Pola tidak menampilkan unduhan kosong.
- Browser keyboard dapat membuka/menutup semua menu dan menavigasi tab.
- Video dengan kamera yang dihentikan tidak boleh terus berjalan diam-diam.
- Blackout proyektor tidak menghentikan kamera atau audio.
- Tidak muncul dua menu popover yang terbuka bersamaan.

## Keterbatasan verifikasi
- GitHub Actions menguji logika murni, TypeScript dan bundling. Pengujian gestur fisik, respons kamera nyata, koneksi projector, validitas unduhan di browser, dan screenshot responsif masih perlu operator.
- Tampilan dan preferensi kontrol pengguna belum dinilai melalui sesi usability sungguhan.
- Jangan menandai S3 sebagai production sampai checklist fisik diselesaikan.

## Rilis
Branch implementasi: `feat/soma-v3-s2-ui-20261115`, PR draft #5.
Branch Preview S3 disiapkan terpisah dengan prefix `preview/**`; Vercel akan membuat deployment non-production.
