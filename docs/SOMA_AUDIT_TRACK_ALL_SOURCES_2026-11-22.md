# SOMA — Audit Lintas Sumber Tracking (22 November 2026)
**Scope rilis: GitHub Pages saja. Vercel production tidak disentuh.**

## Tujuan
Periksa jalur Input → Pose → A/B → Kaki → Compose FLOOR untuk empat sumber: webcam laptop/USB, kamera HP melalui WebRTC/USB virtual camera, rekaman MP4/WebM, dan simulator 3D. Hasil Track hanya boleh berasal dari landmark yang terukur atau rig sintetis yang diberi label jelas; tidak boleh ada A/B yang mengambil koordinat satu sama lain.

## Temuan dan perubahan terpasang

| ID | Sumber | Temuan terkonfirmasi di kode | Perbaikan |
|---|---|---|---|
| AQ-01 | Kamera laptop/HP | Response PoseWorker live tidak memiliki request ID. Setelah timeout, respons terlambat berisiko disamakan dengan respons berikutnya | Request ID meningkat per frame; worker mengembalikan ID pada success/error; client menolak ID yang tidak cocok |
| AQ-02 | Webcam/HP 2P | Legacy MotionProcessor bisa menyatakan tracked=false saat tubuh pertama parsial; Track mengikuti flag itu meski raw poses berisi tubuh valid | Track 2P menerima minimal tiga anchor torso yang tampak dari raw landmark, setidaknya satu pinggul; identitas A/B tetap lewat router pada frame yang sama |
| AQ-03 | Semua sumber pose nyata | MotionProcessor memilih pose 2D yang paling utuh, tetapi mengambil worldLandmarks[0] secara tetap | Indeks landmark 3D mengikuti pose 2D terpilih; world pose yang tidak lengkap diabaikan dan tidak menyebabkan crash |
| AQ-04 | MP4 | Dock pemutar selalu memanggil setPerformers(2), termasuk ketika operator memilih 1P | Dock menerima performerCount dari Track; pergantian jumlah aktor mereset QA/identitas/gait melalui engine |
| AQ-05 | MP4 / simulator → Compose | Adapter jejak memilih pose pertama sebagai pengganti A yang hilang | Hapus substitusi. Jejak A/B hanya memakai ID yang diminta. Snapshot terlambat, decoder seeking, dan kehilangan pose tidak menggambar telapak palsu |
| AQ-06 | Simulator | Preview tetap menampilkan dua puppet dan event saat operator memilih 1P | Rigs dan events di filter ke A pada 1P, tetap B pada 2P. Status sumber tetap simulasi, tidak disamakan dengan deteksi manusia |
| AQ-07 | UI | Track/Perform/MP4 menulis sebagian rasio /2 secara tetap | Rasio mengikuti pilihan 1P/2P. Raw pose diagnostic tetap boleh menyebut banyaknya pose AI terukur terpisah |

## Arsitektur aktual — jangan diseragamkan secara palsu
- Webcam, USB capture/virtual camera, dan HP yang sudah tersambung lewat WebRTC masuk ke **CameraTracker** yang sama. Jalur utama MediaPipe Pose Lite 33 landmark. Mode 2P menjalankan pencarian crop cadangan hanya ketika pose kedua belum ditemukan.
- MP4/WebM memakai **VideoPoseGaitEngine** + replay inference worker, asosiasi identitas D2, QA per aktor, serta pengaman hasil inferensi terlambat. FPS dan deteksi bisa berbeda dari jalur live, namun kontrak ID/observasi/kaki harus konsisten.
- Simulator memakai **DirectPuppetSession**, data kaki dan kontak sintetis. Posisinya diketahui dari rig; tidak boleh diklaim sebagai keberhasilan deteksi kamera.
- Hasil masing-masing sumber masuk ke adapter kaki yang memelihara source, session, generation, actor ID, confidence, timestamp, dan coordinateBasis.

## Pengaman yang tidak diubah
- Track 2P boleh menampilkan A/B sebelum Map; **event kontak fisik** tetap menunggu kalibrasi valid dan binding kamera.
- Crossing dengan identitas ambigu tetap menghentikan atribusi A/B dan event yang tidak aman, bukan meneruskan label secara spekulatif.
- Skeleton diagnostik dapat tampil netral saat ID belum aman. Tidak ada tambahan kamera, model biometrik, ataupun tekanan telapak yang diukur.
- Source switch/seek/frame terlambat harus mengosongkan atau menahan data lama. Replay/virtual tidak otomatis membuka output fisik.
- Blackout dan QA Map/Perform tidak dilonggarkan.

## Rencana QA otomatis
1. **Unit/regresi:** dua performer sebelum Map, satu performer datang/keluar, crop parsial, identitas berubah urutan, crossing, request ID worker, 3D world kosong, A/B hilang pada MP4, MP4 seeking/stale, dan simulasi tersaring 1P/2P.
2. **Build:** `npm test`, `tsc -b && vite build`, dan build base path GitHub Pages.
3. **Chromium:** navigasi Track, 1P/2P → MP4, Compose fullscreen, Map dan mode output terkunci.
4. **Deploy:** push branch `feat/stage1-compose-line-trails-beta`; tunggu workflow **Preview SOMA on GitHub Pages** selesai.

## QA perangkat yang masih terbuka
Pengujian CI memakai kerangka dan gambar sintetis, sehingga **belum mengukur akurasi lapangan**. Uji terpisah diperlukan pada webcam Mac, webcam USB/virtual, HP WebRTC landscape, serta MP4 1P/2P: sedikitnya 10 klip, 2 performer; kedua kaki tampak, tubuh terpotong, pergantian cahaya, persilangan, hilang 0,5–2 detik dan muncul kembali. Catat raw pose recall, precision ID, identity switches, P50/P95 inference latency, recover delay, false contact, serta perbedaan jam video–AI. Bandingkan dengan anotasi manual per frame untuk menetapkan tingkat akurasi.

## Rilis
Tidak ada perubahan ke Vercel pada task ini. Hanya GitHub branch dan GitHub Pages, dengan status tes yang dilaporkan apa adanya.
