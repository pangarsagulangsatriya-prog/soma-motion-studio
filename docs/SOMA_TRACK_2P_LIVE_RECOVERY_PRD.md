# SOMA · Track 2P Live Recovery V1
Tanggal: 22 November 2026
Cakupan: Track → Kamera HP / webcam → 2P.

## Bukti dan diagnosis
- Referensi screenshot lapangan: mode 2P, satu skeleton di kanan, performer kiri terpotong di kepala, label "1 tubuh · ID menunggu" dan A/B belum stabil.
- Temuan kode: MultiPoseGaitRouter.observe dahulu menghentikan pemrosesan identitas saat floor.isConfirmed=false. A/B akibatnya tak dapat terverifikasi sebelum Map, padahal Track menuntut dua identitas.
- Live CAMERA memakai public/workers/soma-pose.js (PoseLandmarker 2P) sementara MP4 sudah punya pencarian crop 2P khusus. Saat detector live mengeluarkan satu pose, tidak ada pencarian calon kedua.
- TwoPersonIdentityTracker menolak semua tubuh dengan satu landmark bahu/pinggul kurang terlihat, meski dua pinggul dan salah satu bahu masih teramati.

## Kontrak perbaikan
1. Identitas Track A/B berjalan segera dari MotionFrame.poses tanpa menunggu kalibrasi Map. **Semua contact, GhostFootstep, dan floor physical output tetap memakai syarat floor.isConfirmed & camera binding**. Partial A atau B boleh terlihat sebagai partial UI tetapi dilarang membuat contact.
2. Worker kamera live: ketika operator memilih 2P dan primary detector hanya mendapat kurang dari dua manusia, jalankan pencarian IMAGE crop di sisi lain gambar dengan model yang sama. Maksimal dua crop setiap 390ms; model crop dibuat ketika diperlukan, tidak membuat kamera kedua. Tetap tolak kandidat dengan torso tak lengkap, keyakinan rendah, ataupun kemiripan dengan tubuh pertama.
3. Cropped shoulders: identity locator menerima tiga dari empat anchor tubuh, dengan paling sedikit satu hip terlihat. Pusat didasarkan pada hip yang masih ada. Tidak menerima kaki saja sebagai satu manusia.
4. Saat satu orang terdeteksi, Track menampilkan jumlah 1/2, kaki performer yang valid, serta petunjuk framing "Aktor B belum terbaca". Sisa karakter tak dilabeli atau dicat A/B tanpa pemetaan pose segar.
5. Perubahan pilihan 1P/2P diteruskan ke worker melalui CameraTracker. Mode 1P tidak melakukan crop tambahan.
6. Crossing tetap fail-closed: saat dua tubuh terlalu dekat atau assignment ambigu, A/B dianggap belum pasti; event floor dan klaim QA berhenti. Reset manual tetap tersedia untuk crossing tanpa bukti gerak yang cukup.

## Skenario QA
- Dua orang di bingkai sebelum Map dikalibrasi: dua ID dapat terbaca, floor event=0.
- Satu orang, kemudian orang kedua masuk: satu ID lalu dua ID valid, tak ada duplikasi satu orang.
- Satu bahu terpotong: dapat terdeteksi jika tiga torso anchor + hips masih jelas.
- Urutan array pose dibalik pada frame selanjutnya: identitas A/B konsisten.
- Crop rescue: 1 manusia primary + 1 manusia independen pada crop jadi 2, tidak menggandakan primary.
- Mode 1P tak memuat crop rescue.
- Crossing terlalu dekat → ambiguous dan menahan pijakan; kehilangan satu orang → tidak mengarang skeleton.
- Build TypeScript dan E2E Track/Compose/Map/Perform tidak mengalami regresi.

## QA fisik yang tetap diperlukan
- Kamera HP horizontal, kedua tubuh beserta kepala dan kaki dalam frame; 720p dengan cahaya memadai.
- 2 performer diam, berjalan saling berpapasan, berhenti, lalu keluar-masuk area kamera.
- Catat raw pose count, verified A/B, FPS inference P50/P95, dropout/recovery, dan identity swap manual.
- Model tidak dapat menjamin recall ketika tubuh terlalu tertutup atau sebagian besar keluar frame; jangan menyatakan 2P valid dari 1 skeleton.
