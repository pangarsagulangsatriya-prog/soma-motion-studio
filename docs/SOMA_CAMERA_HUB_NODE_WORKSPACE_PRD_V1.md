# SOMA — Camera Hub Node Workspace (PRD V1)
Tanggal: 22 November 2026
Status: Specification, belum implementasi atau QA perangkat

## Keputusan produk
Camera Hub berpindah dari right-side drawer ke destinasi primer ketiga di sidebar SOMA, sejajar **Stage 1** dan **Stage 2**. Hub menjadi workspace layar penuh untuk melihat kamera dan rute pengiriman visual. Jangan membuat modal bertingkat atau menambah menu konfigurasi teknis pada alur utama.

## Tujuan pengguna
- Sekilas tahu kamera fisik/HP/USB/network yang tersedia, mana yang benar-benar streaming, dan jalur tiap kamera.
- Hubungkan Kamera A → Stage 1 Footprints; Kamera B → Stage 2 atau F3 Capture; kamera lain → tujuan lain yang tersedia.
- Ubah penempatan sumber tanpa merestart stream yang tetap digunakan.
- Tangani kamera terputus, izin browser gagal, pergantian tab, dan multi-kamera.
- Stage 1/Stage 2/F3 tetap mempunyai kontrak input yang sama ketika Hub diperkenalkan, dengan adapter/migrasi bertahap.

## IA dan tata letak
Sidebar: [Stage 1] [Stage 2] [Camera Hub].
Halaman Camera Hub:
1. Header: **Camera Hub**, agregat "X terdeteksi · Y streaming · Z dipakai", tombol **Tambah kamera**, **Perbarui**.
2. Area utama: node canvas dengan sumber di kiri, tujuan di kanan, hubungan berwarna dan berlabel. Interaksi drag/pan, zoom, Fit view, tambah/hapus rute via tombol sambung; tidak bergantung semata-mata pada drag gesture.
3. Kartu node CAMERA menampilkan: nama, jenis Webcam / USB / HP kabel / HP Wi-Fi, preview thumbnail LIVE saat ada frame, FPS bila terukur, indicator connected/degraded/disconnected.
4. Kartu node TARGET: Stage 1 (Track), Stage 2, F3 Capture, FLOOR output, BODY output hanya jika menerima feed yang dimaksud. Hindari memberi kesan semua target mendukung semua input.
5. Inspector sisi kanan muncul saat node/edge dipilih: Preview besar, status nyata, daftar target compatible, resolusi efektif dan tombol Lepas / Coba sambungkan. Detail jaringan berada di 'Lanjutan'.
6. Peta kosong tetap informatif: "Belum ada kamera streaming" + "Hubungkan kamera"; perangkat detected tampil terpisah dan belum memiliki garis LIVE.

## Contoh routing
Webcam laptop ──video LIVE──> Stage 1 / Tracking
HP penonton ──video LIVE──> F3 / Capture
USB capture ──video LIVE──> Stage 2 (jika Stage 2 mengonsumsi video)
Target tidak kompatibel wajib nonaktif + penjelasan singkat. Satu kamera dapat fan-out ke beberapa penerima sepanjang satu stream yang sama; tidak menyalakan getUserMedia berulang.

## Status dan aturan edge
- DETECTED: deviceId terenumerasi; belum terhubung, garis putus abu-abu hanya jika route rencana disimpan.
- CONNECTING: izin, handshake atau negosiasi; garis animasi, tidak dihitung streaming.
- LIVE: track.readyState=live DAN frame segar dalam batas watchdog, garis terang solid; jangan mengandalkan label navigator.enumerateDevices saja.
- DEGRADED: frame terlambat, latency naik atau FPS turun; garis amber dan pesan pemulihan.
- DISCONNECTED: track ended, heartbeat hilang, izin ditolak, atau sumber tutup; garis merah putus, safe recovery.
- ROUTED: hubungan aktif ke konsumen terkonfirmasi. "Dipakai" hanya dihitung saat consumer subscribe aktif; jangan menyamakan dipilih dan dipakai.
- Edge mengandung metadata tipe feed, contoh: video / foot landmarks / trigger; tidak pernah melabeli koordinat sebagai video.
- Transport belum tersedia harus tampil 'Belum didukung' dengan CTA yang tepat, bukan membuat koneksi palsu.

## Arsitektur minimum
Registry perangkat -> Session manager (satu producer setiap device/source) -> Typed stream router -> consumers Stage 1, Stage 2, F3.
Stable source ID berbasis session alias; jangan simpan deviceId mentah sebagai kunci permanen lintas browser.
Reference counting untuk consumer; tidak menutup producer saat berpindah halaman; tutup hanya saat user disconnect atau semua consumer sudah dilepas sesuai policy.
Kamera HP via jaringan memerlukan sesi terpisah dengan heartbeat, token pairing sekali pakai, TTL, revoke, backoff reconnect dan rejoin. QR tidak boleh mengikat sesi ke komponen halaman React yang unmount.
Gunakan transfer feed lintas halaman sesuai batasan browser: jangan mengklaim bisa mempertahankan MediaStream lintas full refresh tanpa koneksi ulang; tawarkan rejoin otomatis melalui sesi/identitas pairing yang tersimpan aman.
Tangani maksimum koneksi berdasarkan kapasitas aktual; 3 dan 10 kamera adalah skenario stress test, bukan janji kemampuan.
Persist mapping route/alias (tanpa izin atau status LIVE palsu). Restore = revalidate perangkat, permission dan stream; fail closed untuk output proyektor.

## Alur interaksi
1. Klik Camera Hub pada sidebar -> node graph menampilkan keadaan sesungguhnya.
2. Klik Tambah kamera -> pilih Webcam/USB, HP Wi-Fi, HP USB/kabel, Network/Capture jika tersedia.
3. Streaming berhasil -> node LIVE muncul, thumbnail mengalir.
4. Klik port dari kamera ke port tujuan yang compatible, atau pilih "Gunakan di..." via inspector.
5. Stage menerima feed yang sama; hub mencerminkan ROUTED dan konsumen sesungguhnya.
6. Putus sumber -> consumer memperlihatkan LOST, stage blackout/recovery sesuai kontraknya, rute tetap sebagai draft untuk reconnect.
7. Kembali ke halaman Camera Hub -> state registry tetap, tidak menyalakan ulang seluruh kamera.

## Aksesibilitas & UX
Node selection keyboard; akses routing lewat menu list/combobox selain drag-line.
Kontras status, tidak mengandalkan warna saja; reduced-motion menghentikan animasi garis.
Kanvas responsif, auto-layout saat dibuka, Fit to screen. Di mobile gunakan daftar sumber -> tujuan dengan ringkasan rute; jangan paksa graph sempit.
Hindari overlay informasi panjang. Gunakan microcopy "1 kamera streaming", "Dipakai Stage 1", "Sinyal terputus".
Node tidak merekam stream otomatis. Preview hanya lokal, permission eksplisit.

## Acceptance criteria
- Menu Camera Hub muncul sebagai destinasi ketiga, bukan drawer.
- Perangkat DETECTED tidak pernah dihitung sebagai LIVE.
- A→Stage1 dan B→F3 dapat aktif bersamaan; pindah tab internal tidak menghentikan keduanya.
- Hapus satu edge tidak menghentikan kamera dengan edge lain.
- Denied permission, unplug USB, refresh, sleep/wake, kamera HP disconnect/rejoin memiliki UI pemulihan.
- Perbedaan source, edge, consumer dan output proyektor bisa dipahami dengan inspeksi singkat.
- QA dengan 1/2/3/10 sumber simulasi dan uji perangkat nyata pada Mac/Windows; catat CPU, FPS, dropped frame, memory, latency; nyatakan batas hardware.
- Feature flag migrasi menjaga jalur Stage 1 dan F3 lama sampai parity diuji.

## Prioritas
P0: halaman sidebar + graph read-only yang bersumber dari state nyata, status semantik, preview.
P1: routing interaktif ke Stage 1 dan F3, source session persistence selama SPA navigation, device loss/recovery.
P2: multiple targets, Stage 2 adapter, persist route drafts, hub pairing HP, stress test.
P3: dynamic graph layout, latency diagnostics, export profile stage.

## Batas
Dokumen ini mencatat desain dan kriteria implementasi. Belum ada bukti routing antarmodul berjalan atau pengujian kamera fisik.
