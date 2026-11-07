# SOMA / ARCHIVE — Uji Panggung, Operator, dan Pemulihan

## Persiapan panggung

Perangkat minimal yang harus disiapkan untuk uji: laptop/browser yang dipakai di venue, satu kamera yang dapat menangkap lantai serta dua aktor, kabel/adapter proyektor layar kedua, pengeras suara dari jalur audio laptop/interface, rekaman pembacaan NL/ID, berkas sumber Tillema, dan satu operator. Uji cahaya rendah sesuai kondisi pertunjukan, karena keberhasilan deteksi di ruang terang tidak menjamin hasil di panggung gelap.

1. Buka SOMA Studio dan pilih proyek Archive.
2. Verifikasi semua berkas dimuat. Status `Camera`, `Tracker`, `Audio`, `Output`, `Scene` hijau/ready sesuai pemeriksaan nyata.
3. Klik untuk mengaktifkan audio browser; set master volume rendah dahulu. Tes mute dan limiter.
4. Tempatkan jendela Clean pada monitor proyektor dan aktifkan fullscreen. Pastikan tidak ada toolbar, panel, atau cursor mengganggu tampilan.
5. Kalibrasi area lantai serta zona berdiri, jongkok, dan berbaring. Tandai ruang yang masih terbaca kamera.
6. Aktor A dan B mencoba gerak memutar, menyilang, rendah-horizontal, dan diam. Operator menguji swap/reassign.
7. Latih pemulihan: `HOLD` → `MANUAL` → `GO` → `RESUME`.

## Cue contoh 4 menit (durasi dramaturgis, dapat disesuaikan)

| Cue | Instruksi aktor | Kondisi trigger | Reaksi visual | Reaksi suara | Cadangan operator |
|---|---|---|---|---|---|
| Q0 READ | A membaca, B berdiri | GO manual | Kutipan TIL-02 utuh | NL/ID sesuai pilihan | Play full sentence |
| Q1 LOWER | B turun lalu berbaring | Hip low + torso horizontal, stabil | Baris memampat | Loop `tidur` bertambah | Trigger Q1 manual |
| Q2 SWEEP | B menepis dekat tubuh | Sapuan wrist melewati threshold | Kata nyamuk terpencar lalu kembali | Potongan `nyamuk` mengikuti sapuan | Trigger swipe lewat slider |
| Q3 TWO VOICES | A mendekati B | Aktor berjarak dekat | Dua kolom mendekat | NL/ID crossfade | Manual distance control |
| Q4 JUDGMENT | Dua aktor berhenti | GO manual (diutamakan) | `Je reinste zelfmoord` utuh | Frasa Belanda satu kali | Trigger one shot |
| Q5 PHOTO | Kedua aktor tahan pose | Armed + manual capture | Foto live muncul dan ditahan | Tidak ada suara baru | Freeze last good frame |
| Q6 RESTORE | Aktor bangun/keluar | GO manual | Teks sumber kembali utuh | Semua fragmen fade out | Reset all |

## Aturan pemulihan / fail-safe

| Gangguan | Apa yang dilihat operator | Sistem melakukan | Tindakan operator |
|---|---|---|---|
| Izin kamera ditolak | Camera denied | Tidak membuat skeleton palsu; efek diam | Ganti manual simulation / aktifkan izin |
| Tubuh hilang < TTL | Tracker briefly lost | Tahan pose valid terakhir **sebentar**, tanpa trigger baru | Awasi status |
| Tubuh hilang > TTL | Tracker lost | Stop triggers, audio release/fade, gambar safe | HOLD atau manual cue |
| Aktor A/B bertukar ID | ID uncertain | Warning, tidak menukar cue diam-diam | SWAP/ASSIGN A/B |
| Proyektor putus | Output disconnected | Studio dan audio tetap aman; operator tahu | Buka ulang output; pilih cue terakhir |
| Audio terkunci | Audio locked | Silent mode dengan indikator jelas | Klik `Aktifkan Audio` |
| File audio hilang | Missing asset | Tidak memutar file lain sebagai pengganti | Pilih audio/skip cue |
| Audio terlalu keras | Peak/limiter warning | Gain limiter & emergency mute | MUTE, koreksi gain |
| Cue spam/tombol berulang | Repeated event | Dedupe, cooldown dan release node lama | HOLD lalu Reset |
| Jendela output refresh | Projection reconnect | Restore latest scene state dari Studio | Verifikasi output sebelum GO |

## Tes penerimaan minimum

- [ ] SOMA versi lama tetap bisa menjalankan mode Hands/Body/Face/Mouse (bila tersedia dalam build yang sama).
- [ ] Pilihan Studio ↔ Clean tidak menghentikan input/audio.
- [ ] Video kamera dapat disembunyikan tanpa mematikan tracking.
- [ ] Efek teks dan suara respons terhadap satu snapshot fitur gerak yang sama.
- [ ] OriginalText tidak berubah setelah 100 kali aksi scatter/erase/restore.
- [ ] Pemetaan bisa disimulasikan manual tanpa kamera.
- [ ] Saat satu aktor berbaring, deteksi diuji/ditandai bila kamera venue gagal.
- [ ] Dua aktor menyilang; operator dapat memulihkan identitas A/B.
- [ ] Setelah tracker hilang, tidak ada loop suara tidak terkendali.
- [ ] Emergency mute langsung mematikan output tanpa menghentikan visual.
- [ ] Studio terlihat di laptop, Clean saja yang tampil pada proyektor.
- [ ] Preset proyek dapat diekspor/impor; missing media terdeteksi.
- [ ] Sesi 30 menit diuji, dicatat FPS, error, penggunaan memori, dan kebocoran audio node.
- [ ] Sistem tetap dapat memainkan cue manual ketika kamera tidak tersedia.

## Laporan latihan yang perlu dicatat

`tanggal`, `tempat`, `laptop/browser`, `camera framing`, `cahaya`, `cue`, `trigger type`, `reaksi tubuh aktor`, `delay audio`, `delay visual`, `false trigger`, `lost tracking`, `perbaikan mapping`, `operator override`, `catatan artistik`.

## Larangan mengklaim kualitas yang belum diuji

Tidak ada angka FPS, latensi milidetik, kamera stage-ready, kompatibilitas dua tubuh, atau dukungan offline yang boleh diklaim berhasil hanya berdasarkan test browser/headless. Pengujian camera physical, output HDMI, audio venue dan gerak berbaring perlu dicatat terpisah.
