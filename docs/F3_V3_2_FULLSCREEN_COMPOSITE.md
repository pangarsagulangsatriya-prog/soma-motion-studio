# SOMA F3 V3.2 — Composite fullscreen

FullScreen sekarang menggambar dua video hidup di satu kanvas 1600 × 800 (rasio 2:1).

**Urutan layer**
1. Kamera A (aktor) diperluas memenuhi seluruh kanvas (cover), kemudian diberi lapisan gelap transparan agar aktor tetap terlihat di latar.
2. Empat foto 2×2 mendekati persegi di kiri. Slot yang kosong semi-transparan sehingga gerak aktor di belakangnya masih tampak.
3. Kamera B (kaki penonton) di panel kanan 68% dengan sedikit transparansi; pergerakan aktor tetap terasa di belakang video B.
4. Garis sudut dan status live tetap dipertahankan.

**Kontrak teknis**
- `F3StageRenderer` memakai dua referensi video: A untuk background, B untuk foreground.
- `F3StageView` memakai renderer yang sama untuk preview dan fullscreen. Video A benar-benar masuk ke kanvas fullscreen.
- Foto yang tersimpan **selalu bersumber dari B**, memakai ROI yang sama dengan tampilan B.
- Blackout harus mengosongkan kanvas; ketika sumber belum segar, jangan menampilkan video basi sebagai LIVE.
- Proyektor fisik F3 tetap fail-closed; perubahan ini hanya menjangkau Stage View lokal.
- Default visual awal: lapisan gelap A sekitar 43%; opasitas B sekitar 94%. Perlu uji cahaya dengan aktor dan kamera asli sebelum kalibrasi estetika akhir.

**QA**
- Draw order A lebih dahulu dari B.
- Output komposit menampilkan kedua video pada canvas yang sama.
- Foto hanya mengambil dari B.
- Blackout menyembunyikan kedua video.
- Fullscreen, Escape, kamera A/B, 0/4–4/4, dan persetujuan tetap melewati E2E.
- Build/tes otomatis lulus dan Pages berhasil terbit sebelum dirilis.
