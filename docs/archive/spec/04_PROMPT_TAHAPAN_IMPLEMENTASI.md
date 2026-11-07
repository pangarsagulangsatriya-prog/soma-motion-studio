# Perintah Lanjutan untuk Astra — Jalankan Berurutan

Dokumen ini menyediakan prompt tahap demi tahap. Kirim prompt nomor berikut **setelah** Astra menyelesaikan tahap sebelumnya. Masing-masing tahap meminta pekerjaan nyata di repository yang sama. Jika satu sesi Astra terputus, tempel kembali master prompt beserta status commit / perubahan terakhir.

## TAHAP 0 — Audit dan pondasi implementasi

```text
Audit proyek SOMA yang sudah terbuka. Identifikasi existing camera/tracker pipelines, AudioContext, preset serialization, UI Studio/Clean, canvas rendering, routing, testing, dan deployment scripts. Jangan membuat proyek baru. Buat daftar file yang akan diubah, kontrak data minimal, risiko terhadap fitur lama, serta urutan implementasi. Lalu implementasikan folder/modul dasar SOMA / ARCHIVE, route/tab entry dan fixture data Tillema 1919. Pastikan aplikasi masih bisa build dan semua fitur eksisting tetap tampak. Laporkan file changed, hasil tes, dan fitur yang belum bekerja.
```

## TAHAP 1 — Teks hidup yang dapat dikendalikan tubuh

```text
Di repository SOMA yang sama, implementasikan Archive Library (impor/templat teks + provenance), text token renderer, dan Rule Editor minimal. Sambungkan body pose tracker yang sudah ada ke fitur motion: hip height, torso angle, wrist swipe, stillness time dengan kalibrasi/threshold. Terapkan preset SLEEP (compress/accumulate), MOSQUITO (scatter/sweep), dan JUDGMENT (text appearance). Semua efek HARUS bisa diuji lewat slider manual tanpa kamera. Pertahankan originalText immutable dan sediakan Restore Original. Tampilkan pratinjau Studio dan Clean, plus status tracking. Jalankan tes unit untuk transform yang tak merusak sumber dan smoke test kamera/manual.
```

## TAHAP 2 — Pembacaan arsip dan suara yang responsif

```text
Bangun Archive Voice Engine di atas audio architecture SOMA sekarang, bukan AudioContext kedua yang liar. Dukung file pembacaan NL/ID, editor segment start/end time, playback utuh, loop kata, scrub, crossfade, voice layering, master limiter, emergency mute, audio-unlock, dan lost-tracking fade. Sambungkan snapshot gerak bertimestamp ke visual text serta audio action dalam satu mapping rule. Jangan memakai TTS online sebagai syarat perform. Uji bahwa gerak tangan menggeser teks+posisi playback; pose diam menambah kata+voice repetition; cue berpindah tanpa audio menggantung. Jika tidak ada rekaman, tampilkan slot upload/empty state, bukan placeholder yang menyesatkan.
```

## TAHAP 3 — Dua aktor dan operator panggung

```text
Perluas Body tracker existing agar mendukung hingga dua tubuh jika API/model memungkinkan. Pertahankan identity A/B dengan heuristik continuity, beri manual swap/reassign. Buat Stage Cue Controller dengan Ready, Go, Next, Back, Hold, Reset Text, Freeze dan Mute; shortcut remappable dan operator override per rule. Jadikan Studio monitor operator dan Clean output proyeksi melalui jendela kedua same-origin. Satu camera source dan satu audio engine saja. Jendela output menampilkan hanya komposisi, tidak menampilkan UI. Tambahkan heartbeat/reconnect, manual projector fullscreen instructions, calibration floor/ROI, dan test aktor berbaring, keluar frame, menyilang, serta kembali terdeteksi.
```

## TAHAP 4 — Foto/video arsip dan living photograph

```text
Tambahkan archive image/video sources, original view, mask-reveal oleh posisi tubuh, overlay skeleton opsional, serta still-photo capture berbasis cue. Foto panggung hanya diambil dan disimpan setelah tindakan operator atau rule yang sudah di-arm jelas; sediakan delete/export dan metadata. Buat preset yang menyandingkan foto historis dengan satu pose tubuh kontemporer. Jangan membuat AI-generated archival photograph sebagai pengganti sumber dokumen. Pastikan input teks+audio fase sebelumnya tetap stabil.
```

## TAHAP 5 — Hardening / rehearsal build

```text
Lakukan pengujian 30 menit dengan fixtures dan tes yang tersedia. Jalankan lint, typecheck, tests, build, dan cek regresi Hands/Body/Face/Mouse, Studio/Clean, synth, presets, record. Uji error paths: izin kamera ditolak, user muted, audio missing, tracker lost, projection disconnected, identity swap, cue spam, restart dan refresh. Ukur FPS, audio polyphony, memory trend, dan movement-to-visual/audio delay jika dapat benar-benar diukur. Berikan rehearsal checklist, daftar known limitations, manual operator singkat, dan build artifact. Jangan menyatakan tes kamera fisik berhasil jika belum menggunakannya; tandai jelas unverified on physical stage.
```

## Prompt perbaikan setelah meninjau hasil latihan

```text
Saya sedang menguji SOMA / ARCHIVE di ruang latihan. Gunakan laporan gerak→teks→suara berikut sebagai data nyata. Ubah hanya mapping/threshold/fade/layout yang relevan; pertahankan fitur sebelumnya. Sediakan before/after behavior, preset configuration, changed files, test results, dan fallback. Prioritaskan tubuh aktor bisa mengulang cue secara konsisten, keterbacaan arsip, dan operator dapat memulihkan adegan dengan satu aksi.

[LAPORAN LATIHAN]
- Perangkat/browser:
- Sudut/posisi kamera:
- Jarak aktor dari kamera:
- Cues yang diuji:
- Gerak yang tidak terdeteksi:
- Visual yang terlambat/terlalu dekoratif:
- Audio yang terlambat/terlalu keras:
- Kejadian saat berbaring/dua aktor saling menutup:
- Video/log/diagnostics:
```
