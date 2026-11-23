# SOMA — Map Calibration Assist V1
Status: planned / implementasi belum dimulai. Tanggal: 23 November 2026.
Ruang lingkup: Stage 1 > Map > Lantai. Rilis hanya melalui GitHub Pages; Vercel tidak disentuh.

## Masalah
Panel Map saat ini sudah mempunyai sumber kamera, editor empat sudut, output raster FLOOR, homography, dan tapak simulator. Pada kalibrasi kamera live, kaki terdeteksi belum tampil sebagai bantuan yang konsisten pada kedua panel. Overlay kaki yang ada saat menggeser titik kamera masih terbatas pada beberapa landmark dan belum menyediakan Tes tapak, rekam/replay, atau status keabsahan pengukuran.

## Tujuan
Operator dapat melihat satu posisi telapak pada gambar sumber dan posisi hasil proyeksinya secara sinkron, memindahkan sudut kalibrasi, dan langsung memahami arah, skala, serta posisi lantai. Operator tetap bisa menguji ruang ketika tidak ada aktor melalui cap simulasi yang diberi tanda berbeda.

## UX P0
- Tambahkan kontrol ringkas **Tes tapak** pada Map > Bidang lantai, dengan tombol kecil **Auto** (default aktif), **Bersihkan**, dan status.
- Auto menampilkan dua aktor, kaki kiri/kanan dari data yang valid. A merah (#E84B32); B arang (#202226); kiri/kanan dibedakan dengan bentuk/orientasi, bukan warna.
- Tes tapak menampilkan satu atau lebih titik kaki terdeteksi terbaru yang masih segar. Jika tidak tersedia, buat contoh simulasi front/center/back/left/right dan tandai **SIMULASI**, jangan tampilkan seolah deteksi nyata.
- Panel kiri: tapak/marker pada koordinat gambar sumber. Panel kanan: jejak yang sama setelah koreksi camera-to-floor dan floor-to-projector, mengikuti quad draft secara langsung.
- Overlay hanya pada Map (termasuk Map fullscreen); tidak masuk clean FLOOR raster, output syphon/spout, atau StageRoute. Blackout/QA fisik tetap aman.
- Saat kalibrasi belum disimpan: label **Draf kalibrasi / estimasi 2D**. Setelah confirmed + source binding valid: **Lantai terkalibrasi / kontak perkiraan**. Simulator: **Virtual**.
- Tapak tidak muncul baru jika sumber stale, actor ID ambiguous, atau kaki masih swing. Saat sumber berpindah, hapus/putuskan jejak lama.

## Perilaku P1
- Replay 5 detik memakai ring buffer dari sumber yang sama; pause/freeze dan clear.
- Semua sumber lewat satu kontrak adapter: camera, phone, MP4, simulator; demo hanya mode contoh.
- MP4 memakai profil per-file/per-resolusi tersendiri, tanpa mewarisi kamera HP. Seek memutus segmen jejak.
- Opsi arah langkah (panah kecil), nomor urut, transparansi, dan durasi hilang di menu lanjutan.
- Error source terputus, tidak ada deteksi, tahap kalibrasi, dan ukuran/frame tidak valid punya status terpisah.

## Kontrak event
FootAssistEvent:
- id, sourceKey, sessionEpoch, atMs
- actorId: A | B; foot: left | right
- rawCameraUV?: {x,y}; floorM?: {xM,yM}; floorUV?: {x,y}
- phase: stance | contact | swing | unknown
- confidence: 0..1
- headingRad?: number
- origin: detected-estimate | simulator | synthetic-test
- basis: calibrated-estimate | image-2d-estimate | virtual-floor | synthetic
- calibrationId?: string; validUntilMs
Satu sumber waktu dan satu identitas sumber per buffer; jangan menyatukan dua sumber pada satu stroke.

## Algoritme
1. Ambil pose dari source normalizer yang sudah ada. Untuk live 2P, tunggu identity tracker stabil; untuk MP4, verifikasi clip, resolusi, timestamp snapshot, dan tidak seeking.
2. Ekstrak landmark telapak/heel/toe, contact/stance estimate, confidence, timestamp. Dedup (aktor, kaki, frame). Jangan cap kaki swing.
3. Hitung koordinat raw camera dari stage 16:9 dengan stageUVToRawCamera; tangani letterbox, mirroring visual, dan rotasi HP dengan basis piksel tracking yang sebenarnya.
4. Pilih cameraQuad draft (jika sedang edit), lalu calibration saved jika valid; kalau profil tidak cocok, tampilkan status estimasi dan larang klaim metrik.
5. Proyeksikan kamera ke floor normalized UV dengan correspondence(cameraQuad,identityQuad). Tolak posisi di luar quad atau matriks degenerat; untuk simulator, pakai floorUV langsung.
6. Map floorUV menggunakan outputDraft, menghormati sourceQuad jika renderer memakai crop quad. Gunakan satu homography per tahap; jangan double warp.
7. Render source panel marker di rawCameraUV dan output panel paintAuthenticFootprint di koordinat projected UV, sesudah paintMapWarp. Tandai origin/basis pada legend saja, tidak menutupi gambar.
8. Pada Test Tap, gunakan kaki valid terkini terlebih dahulu. Jika kosong, keluarkan 5 titik sintetis yang jelas diberi label SIMULASI. Jangan masukkan sintetis ke engine tracking maupun layer Compose.
9. Ring buffer menyimpan event maksimum 5 detik; replay memakai waktu virtual. Freeze menghentikan waktu tampilan. Clear membuang hanya buffer overlay.
10. Reset buffer dan status saat sourceKey/epoch berubah, MP4 seek, perangkat ended, timestamp tidak segar, atau profile berubah. Tetap jaga kontrol proyektor dan Blackout.

## Penerimaan dan QA
- Satu tapak yang sama muncul di lokasi yang berkorespondensi pada panel input dan output.
- Menggeser empat sudut mengubah lokasi preview secara langsung tanpa mengubah event rekaman atau output fisik.
- Gerak depan-belakang, kiri-kanan, pivot, stop-start, dan crossing A/B terpantau; tidak ada teleport saat identitas ambigu.
- MP4 16:9/4:3, kamera HP landscape/rotasi, live camera disconnect/reconnect, dan simulator lulus regression E2E.
- Label "SIMULASI" tidak pernah berubah jadi status "DETEKSI" tanpa observasi kaki sebenarnya.
- Tidak ada perubahan pada output fisik, perangkat proyektor, atau izin LIVE.
- Unit tests untuk transformasi quad, out-of-bounds, no contact, stale source, 2P, seek; browser tests untuk UI.
- Target preview: pembaruan visual <=100 ms setelah data pose baru pada perangkat uji, tanpa menghambat feed kamera. Validasi pengukuran lapangan dilakukan terpisah.

## Area kode yang telah diaudit
- src/studio/v3/MapWysiwygWorkspace.tsx — panel sumber dan output, draft quad, overlay simulator
- src/studio/v3/mapWysiwygModel.ts — containedImageRect / paintMapWarp
- src/footprints/spatial/coordinates.ts — koordinat floor / homography
- src/footprints/lines/v3/SourceFrameNormalizer.ts — normalisasi webcam/phone/video/simulator
- src/footprints/live/LiveFloorTrackingEngine.ts — status kalibrasi, event kontak
- src/studio/v3/VideoSpatialCalibration.tsx — profil lantai MP4
- src/footprints/scenes/authenticFootGeometry.ts — geometri footprint
- src/studio/v3/SurfaceComposer.tsx — raster FLOOR Compose untuk Map

## Prioritas
P0: kontrak + adapter event, transform dua panel, Tes tapak/Auto, pengaman physical output.
P1: integrasi semua sumber, replay/freeze/clear, reset dan status akurat.
P2: kontrol lanjutan/diagnostik dan stress/regresi panggung.
