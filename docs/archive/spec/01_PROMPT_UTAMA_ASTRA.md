# PROMPT UTAMA UNTUK ASTRA — ENHANCE SOMA WITH ARCHIVE PERFORMANCE ENGINE

> **Peranmu:** bertindak sebagai technical lead, creative coder, perancang interaksi, dan engineer audio web. Kerjakan kode nyata di project SOMA yang kini terbuka. Tujuan: membuat modul **SOMA / ARCHIVE** yang dapat dipakai saat latihan dan pertunjukan *UNPACKING* dengan **dua aktor secara langsung**. Jangan mengganti aplikasi SOMA dari nol.

## 0. Instruksi kerja pertama — wajib

1. **Audit codebase** terlebih dahulu: framework, struktur komponen, rute, penyimpanan state, tracker Hands/Body/Face/Mouse, pengolahan landmark, audio engine, preset, rekaman, Canvas/WebGL, pengaturan Studio/Clean, build/test scripts, dan kendala browser.
2. Beri ringkasan audit singkat dengan daftar bagian yang bisa dipakai ulang serta risiko. **Lanjutkan implementasi**, jangan hanya mengirim rencana. Jika kamu belum memiliki akses ke source code SOMA, katakan secara spesifik bahwa akses belum tersedia dan minta repository/arsip proyek; jangan mengklaim telah mengubah kode.
3. Lakukan perubahan **bertahap dan backward compatible**. Jangan merusak fitur SOMA lama atau mengubah identitas visualnya: hitam arang, aksen hijau pucat, kontrol padat dan jelas, tipografi fungsional.
4. Hindari dummy yang tampak bekerja. Jika microphone, 2-body tracking, window projection, audio, atau rekaman membutuhkan izin/perangkat dan belum bisa diuji, tampilkan status **Belum diuji pada perangkat** secara jujur.
5. Jangan melakukan deploy/publish ke lingkungan produksi tanpa instruksi eksplisit. Siapkan build dan prosedur deploy setelah QA.
6. Semua label UI dan bantuan operator menggunakan **bahasa Indonesia**. Istilah teknis internal boleh berbahasa Inggris.

## 1. Tujuan artistik & penggunaan

Ini **instrumen panggung**, bukan situs presentasi arsip atau pemutar slide. Dua aktor bergerak di ruang kosong. Kamera menangkap bentuk tubuh; garis kerangka dapat muncul di layar. Kutipan arsip kolonial tentang Tanjung Priok 1919 ditampilkan dan dibacakan. Ketika aktor menunduk, berbaring, menyapu tangan, bergeser, berdiam, atau mendekati aktor lain, huruf, citra dan suara arsip berubah.

Perubahan visual dan suara harus berhubungan langsung dengan **gerak yang dapat diulang di ruang latihan**. Hindari visual dekoratif, partikel mewah, animasi sinematik, dan estetika dashboard yang bocor ke layar penonton.

Empat keluaran inti:
- **TEKS:** kata berpindah, memampat, tercerai, berulang, hilang sementara, dan kembali ke posisi sumber.
- **SUARA:** pemutaran sampel suara manusia maju/mundur, terpotong per kata, pengulangan, penumpukan, filter/tekstur, dan crossfade Belanda–Indonesia.
- **FOTO/VIDEO:** bagian arsip muncul sesuai posisi tubuh; skeleton opsional; tangkapan frame foto baru dari kamera atas perintah.
- **PERTUNJUKAN:** operator memanggil cue, memulihkan tracking, meredam output, memilih fallback manual, dan memproyeksikan Clean tanpa panel UI.

## 2. Scope UI/UX — tambah ke SOMA sekarang

Tambahkan sebuah **workspace Archive** (navigasi utama atau mode proyek), dengan empat tab:

1. **Arsip**: impor teks, foto, video, audio; editor transkrip/terjemahan; judul/tahun/penulis/sumber/catatan; pratinjau asli; penanda segmen kata + timecode audio; status hak pakai dan verifikasi.
2. **Gerak**: input Hands/Body/Face/Mouse yang sudah ada, dukungan maksimum dua orang jika tracker memungkinkan; garis skeleton hidup; kalibrasi lantai/kamera; memilih Aktor A/B; status confident/occluded/lost; penyesuaian ambang sensitivitas.
3. **Pemetaan**: builder `INPUT → CONDITION → VISUAL ACTION + AUDIO ACTION`; gabungan aktor; slider smoothing, threshold, hysteresis, cooldown, duration, reset, mapping invert; preview manual tanpa kamera.
4. **Panggung**: daftar adegan/cue, tombol READY/GO/RESET/NEXT, pratinjau proyeksi, indikator audio/camera/pose/output, emergency mute, safe freeze, operator override.

Tampilan **Studio** menyimpan UI operator. **Clean / Projector** hanya memuat komposisi panggung; UI kontrol, debug metrics, toolbar dan toast tidak boleh bocor ke proyektor. Garis kerangka tubuh opsional `Off / On detected / Cue only`, terpisah dari izin/deteksi kamera. Kamera tetap memproses gerak ketika lapisan video disembunyikan.

Dukung proyeksi jendela kedua apabila lingkungan browser mengizinkan: Studio pada layar laptop, Clean pada layar proyektor. Berikan **fallback manual** untuk memindahkan jendela dan masuk fullscreen; jangan mengasumsikan browser dapat otomatis memilih monitor. Satu mesin kamera/tracker dan **satu mesin audio**; jangan menginisialisasi audio ganda dalam jendela proyeksi. Pertahankan aliran keluaran saat tab pengaturan berpindah.

## 3. Pemetaan inti yang HARUS bekerja pada MVP

| Aturan | Data pelacakan | Dampak teks | Dampak suara |
|---|---|---|---|
| SLEEP / ACCUMULATION | Tubuh rendah + horizontal + diam selama X detik (perkiraan pose; kalibrasi) | Kata `tidur` bertambah/memampat | Ucapan `tidur` berulang; interval memendek dalam batas aman |
| MOSQUITO / SWEEP | Arah dan kecepatan sapuan pergelangan tangan | Kata `nyamuk`/fragmen kalimat tersapu; lalu kembali | Rekaman di-scrub/terpotong berdasarkan arah/kecepatan |
| JUDGMENT / VOICE RESISTANCE | Aktor berbaring atau dua aktor diam | `Je reinste zelfmoord` muncul dengan jarak/posisi terukur | Ucapan Belanda terpicu satu kali lalu bertahan menurut cue; tidak selalu tunduk pada tangan |
| TWO BODY / DISTANCE | Jarak relatif pusat tubuh A/B | Dua kolom/fragmen mendekat atau menjauh | Volume Belanda–Indonesia crossfade |
| LIVING PHOTO | Cue manual atau pose diam berkelanjutan dengan arm/rearm | Kamera membekukan satu gambar, aktor bergerak melewatinya | Snapshot sound opsional, **default silent** |

MVP pertama cukup satu orang + tiga aturan awal. Pemetaan untuk dua orang, foto/video, dan penyusunan scene mengikuti fase berikutnya. Tombol manual harus bisa memicu setiap efek, sehingga latihan tetap berlangsung bila kamera gagal.

**Jangan menyebut klasifikasi pose `tidur` sebagai pengukuran tidur sungguhan.** Gunakan fitur gerak seperti tinggi pinggul relatif, orientasi torso terhadap horizon, bounding box, dan durasi stabil; izinkan operator menyesuaikan ambang sesuai framing kamera. Pelacakan napas tidak boleh diklaim dari skeleton; perlu input mikrofon/sensor tambahan.

## 4. Audio: rekaman manusia tersegmentasi

Kembangkan **Archive Voice Engine** terpisah tetapi terintegrasi ke sound engine SOMA yang sudah ada. Masukkan rekaman pembacaan Belanda dan Indonesia (file lokal MP3/WAV/OGG sesuai dukungan browser) dan representasi segmen dengan `{id, text, startMs, endMs, language, sourceId}`. Awalnya operator dapat menandai timecode sendiri; jangan mengandalkan word alignment yang belum tersedia.

Fitur wajib:
- Playback utuh, loop kata/fragmen, scrub, seek, repeat density, dua track bahasa, volume per track, smoothing, fade pendek antarpotongan, master gain + limiter, mute sesaat.
- Hindari klik/pops, runaway gain, ratusan node WebAudio tersisa, dan tabrakan kelebihan polyphony. Tetapkan batas suara simultan yang eksplisit.
- Audio unlocked **hanya setelah gesture pengguna**; status muted/locked/playing/errored terpisah dari status kamera dan tracker.
- Perubahan visual dan audio berasal dari **satu snapshot data gerak bertimestamp** sehingga respon koheren. Saat pose hilang: jangan tiba-tiba memutar sampel baru; tahan sebentar lalu fade/release sesuai preset.
- Jika file suara belum diunggah, aplikasi harus menampilkan `Rekaman pembacaan belum tersedia`. Boleh menguji dengan text preview atau audio debug jelas berlabel; **jangan meniru rekaman sejarah**.
- Synth SOMA lama tetap dapat aktif sebagai lapisan terpisah, dengan master output yang aman.

## 5. Archive fidelity / kutipan historis

Buat fixture arsip Tillema (1919) berdasarkan `03_ARSIP_TILLEMA_1919.md`:
- simpan `originalText` utuh dan `workingTranslation` terpisah;
- simpan anotasi segmen tanpa mengubah sumber asli;
- saat efek menata ulang atau menyalin kata, tandai hasilnya sebagai **komposisi panggung**;
- satu tombol `Kembalikan teks asli` yang dapat dipakai kapan saja;
- sumber bibliografis tampil di Studio dan opsional sebagai cue di proyektor;
- jangan menyamakan teks Belanda terkutip dengan paragraf Indonesia yang transkripsinya berasal dari gambar/terjemahan sekunder;
- data contoh harus bisa diganti menggunakan editor arsip, bukan di-hardcode ke komponen visual.

**Contoh frasa Belanda yang wajib tersedia sebagai konten awal:**

- `een paar kinine-tabletten ingenomen`
- `slapende menschen, liggend op de steenkool, blootgesteld aan de steken der beruchte muskieten van Tandjong Priok`
- `Je reinste zelfmoord`

## 6. Kontrol panggung dan keandalan

- **Cue manager** dengan urutan, durasi opsional, mode manual/auto, pengaturan ulang, tombol `GO`, `NEXT`, `BACK`, `HOLD`, `RESET TEXT`, `FREEZE`, `MUTE`; shortcut remappable, tidak bentrok dengan pintasan eksisting dan nonaktif saat fokus berada di input/editor.
- **Operator override:** memaksa Aktor A/B, mengubah nilai gerak secara manual, trigger snapshot, fallback ke cue statis; semua tetap berjalan walau pelacakan berhenti.
- **Status bar** terpisah untuk camera permission, tracker ready/confidence, audio unlocked/output, file arsip dimuat, jendela proyektor tersambung, cue aktif, dan rekaman.
- **Lost tracking:** smoothing/hysteresis, TTL/hold pendek, lalu fade dan keadaan aman. Jika A/B bertukar posisi, jangan diam-diam mempertukarkan identitas. Beri tombol swap/reassign.
- **Ruang panggung:** pastikan deteksi tubuh dalam posisi berdiri, jongkok, duduk, dan berbaring. Sediakan panduan framing kamera dan kalibrasi lantai.
- **Offline/local-first:** setelah dependensi/asset dimuat, latihan idealnya dapat berjalan tanpa koneksi internet. Jangan mengunggah video atau audio ke server eksternal secara diam-diam.
- **Data:** preset scenes dan maps disimpan secara lokal dengan export/import JSON berversi; file media disimpan/diacu secara eksplisit dan status file hilang ditampilkan. Pertahankan kompatibilitas preset SOMA sebelumnya.
- **Performa:** ukur FPS tracker, FPS visual, latensi gerak→proyeksi, latensi gerak→bunyi, drop frame, penggunaan memori, dan perilaku setelah setidaknya 30 menit. Target awal 30 FPS visual dan respons yang dapat dimainkan; klaim hasil hanya jika benar-benar terukur di perangkat target.
- **Keamanan:** emergency mute seketika, batas master volume/limiter, layar `HOLD`/blank yang tidak mengganggu, dan fallback manual ketika camera permission dicabut.

## 7. Arsitektur — sesuaikan dengan stack yang telah ada

Usulkan modul berdasarkan pembagian berikut, lalu implementasikan dengan konvensi codebase SOMA:

`ArchiveStore`, `Source/ProvenanceModel`, `MotionFeatureExtractor`, `ActorIdentityTracker`, `MappingRuleEngine`, `ArchiveTextRenderer`, `ArchiveImageRenderer`, `ArchiveVoiceEngine`, `StageCueController`, `ProjectionChannel`, `PerformanceDiagnostics`.

- Jangan memasukkan inference kamera ke React render loop. Jangan memasang banyak stream kamera/AudioContext karena pergantian tab.
- Gunakan satu sumber waktu dan snapshot data gerak bertimestamp, batasi event rate; renderer & audio membaca feature-state yang sudah ditapis.
- Jendela proyeksi hanya menerima state untuk render melalui mekanisme komunikasi same-origin yang cocok, misalnya BroadcastChannel, dengan reconnect dan indikator heartbeat. Studio tetap aktif untuk menghindari throttling tab latar.
- Gunakan stable IDs untuk sumber arsip, segmen, mapping dan cue; dukung persistensi versi.
- Biarkan implementasi canvas/audio mengadopsi pustaka yang sudah digunakan bila memadai. Hindari dependensi besar yang tidak diperlukan.

## 8. Definition of Done — tes yang harus kamu demonstrasikan

**Fungsional:** unggah teks; pilih bagian kata; impor rekaman; sinkron satu pemetaan tubuh→teks+audio; jalankan 3 preset Tillema; kembali ke teks asli; mode manual; dua tubuh (fase lanjut); jendela Clean tanpa toolbar; cue manager; preset export/import; screenshot/snapshot sesuai izin.

**Reliabilitas:** kamera gagal / ditolak; model gagal muat; satu dari dua orang keluar frame; orang saling menutupi; aktor tidur di lantai; file audio hilang; audio belum di-unlock; proyektor terputus; kembali dari fullscreen; refresh; resize; sesi 30 menit; mute mendadak. Perilaku dan status harus eksplisit, tanpa crash dan tanpa phantom landmarks.

**Regresi:** Hands, Body, Face, Mouse, suara karakter lama, visual generatif lama, Studio/Clean, preset lama, mute, dan rekaman SOMA tetap bekerja.

**Keterbacaan:** black stage, proyektor 16:9, teks tetap utuh sebelum transformasi, kontras cukup, dan tidak ada panel operator pada layar Clean. Tidak ada elemen terpotong pada layout 390/768/desktop.

## 9. Urutan kerja dan laporan akhir

Laksanakan fase berikut dari `04_PROMPT_TAHAPAN_IMPLEMENTASI.md`: audit → Archive Library + Studio UI → text/motion + manual simulation → segmented voice + sound synchronization → dual-body + cues + projection → image/live-photo → stage QA/regression.

Setiap fase, kirim:
1. file yang diubah;
2. fitur yang nyata bekerja dan cara memakainya;
3. perintah build/test serta hasil aktual;
4. kendala perangkat dan bagian yang **belum** diverifikasi;
5. apa yang dikerjakan berikutnya.

**Jangan berhenti setelah menyusun spesifikasi. Mulai audit, lalu implementasikan fase pertama di kode SOMA yang ada.**
