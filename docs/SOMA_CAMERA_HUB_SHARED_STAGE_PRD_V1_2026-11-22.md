# SOMA — Camera Hub untuk Stage 1, Stage 2, dan F3 Capture
**PRD V1 · 22 November 2026**  
**Status:** Siap diimplementasikan bertahap; belum ada kode Camera Hub atau deploy  
**Scope:** Registry kamera global, koneksi, monitoring, routing dan keselamatan antarmodul  
**Target pengujian:** 3 perangkat terhubung → 2 feed aktif → naik bertahap menuju 10 perangkat terdaftar  
**Repository / branch rencana:** `pangarsagulangsatriya-prog/soma-motion-studio` / `feat/stage1-compose-line-trails-beta`  
**Aturan rilis:** implementasi dimulai di GitHub Pages preview; jangan mengubah Vercel production sebelum pengujian dan persetujuan terpisah.

---

## 1. Masalah yang harus diselesaikan

Operator harus dapat menghubungkan beberapa kamera dari USB/webcam/HDMI capture/HP WebRTC, melihat seluruh statusnya, dan memilih kamera yang dipakai oleh Stage 1, Stage 2, serta F3 Capture, **tanpa melakukan pairing ulang saat berpindah menu**.

Saat ini SOMA memiliki tiga tujuan utama dalam GlobalNav:

- **Stage 1** — Motion & Projection. `FootprintsStageWorkspace` memakai kamera pilihan Track, lalu Track → Compose → Map → Perform. `App.tsx` mempunyai satu `CameraTracker`, satu video utama, dan `phoneLandscapeRef`. Pergantian sumber mematikan sumber sebelumnya dan meminta QA lagi.
- **Stage 2** — Teks, visual & suara. `StageTwoApp.tsx` menjalankan `App stageTwo` pada URL terpisah, sementara `App.tsx` berpindah menggunakan `window.location.assign(?stage=2)`. Navigasi ini **membongkar seluruh runtime** serta koneksi kamera milik halaman sebelumnya.
- **F3 Capture** — dua kamera untuk empat foto. `F3CameraRegistry` mengelola A dan B sendiri, memantau frame segar, melarang dua role mengambil `deviceId` yang sama, dan mengunci rana ketika sumber tidak valid. Belum memakai registry bersama Stage 1.

Keamanan signaling QR V2 sudah mendukung room terisolasi, credential per perangkat, epoch pemulihan, pembatas permintaan, dan pembersihan SDP setelah ACK. **Kemampuan signaling untuk sepuluh room tidak sama dengan kemampuan browser menerima sepuluh feed video atau menjalankan sepuluh inferensi AI**. GitHub Pages statis belum menjalankan `/api/phone-pair`; QR otomatis perlu backend signaling/Redis pada lingkungan preview terpisah.

### Sasaran pengguna

Satu operator panggung yang harus menyambungkan dan mengecek kamera dengan cepat sebelum pertunjukan, kemudian mengganti sumber tanpa memutus kamera lain atau menyalakan output yang belum diuji.

### Janji produk

> Sambungkan kamera sekali, lihat kondisinya di satu tempat, tugaskan ke Stage yang diperlukan, lalu ganti sumber dengan aman. Kamera yang tidak ditugaskan tidak mengambil jatah inferensi AI.

## 2. Keputusan IA dan UI

**Pertahankan tepat tiga tujuan utama:** Stage 1, Stage 2, F3 Capture. Camera Hub tampil sebagai **kontrol utilitas global pada header SOMA**, bukan Stage keempat, bukan tab tambahan di dalam Track.

- Tombol header: ikon kamera + jumlah terkoneksi (contoh: `Kamera · 3`), indikator peringatan hanya bila ada perangkat bermasalah.
- Tekan tombol → panel `Camera Hub` (*drawer* desktop, halaman overlay pada mobile). Isi utama: **Sambungkan**, daftar kamera, **Ditugaskan ke**, status singkat. Semua detail ICE/codec/bitrate/FPS tingkat lanjut disembunyikan pada `Diagnostik`.
- Tiga tindakan inti: **Hubungkan** → **Periksa** → **Gunakan di Stage**. Satu tombol utama per perangkat; status tidak disamarkan dengan animasi atau label LIVE palsu.
- Di Stage 1/2/F3, pemilih sumber membaca katalog Camera Hub. Tampilkan nama dan status yang sama; jangan mengulang wizard pairing dalam masing-masing Stage.
- UI mengizinkan penggantian nama kamera (`HP Aktor`, `HP Penonton`, `Webcam Tengah`) tanpa menampilkan token, SDP, IP, atau deviceId penuh.
- Konfirmasi hanya untuk aksi berisiko: **Putuskan** perangkat yang digunakan, **Ganti kamera saat Perform LIVE**, atau **Hentikan sesi bersama**. Perubahan assignment saat Blackout dapat dilakukan langsung.

### Wireframe perilaku tekstual

```text
SOMA                              [Kamera · 3] [BLACKOUT]
├── Stage 1
├── Stage 2
└── F3 Capture

CAMERA HUB
[+ Sambungkan kamera]      3 tersambung · 2 dipakai
┌ Webcam Tengah  USB      ● Siap    Stage 1 / Track  ┐
├ HP Aktor       Wi-Fi    ● Siap    F3 / Kamera A   ┤
└ HP Penonton    Wi-Fi    ◌ Standby Belum ditugaskan┘
[Periksa gambar] [Gunakan di...]  [Diagnostik ▾]
```

Contoh hanya menunjukkan bentuk UI; tidak menandakan fitur tersebut sudah tersedia.

## 3. Model kapasitas dan definisi status

Jangan menyamakan istilah berikut:

| Istilah | Arti | Target V1 |
|---|---|---|
| **Terdaftar** | Kamera memiliki identitas lokal atau sesi pairing yang dikenali, termasuk yang tidak sedang streaming | Maksimal 10 entri |
| **Tersambung** | Jalur USB/getUserMedia/WebRTC telah memiliki koneksi atau stream yang masih live | 3 perangkat diuji fisik pada fase awal |
| **Dipakai / routed** | Feed dipilih oleh salah satu slot Stage, dengan lease konsumen aktif | Maksimal 2 feed aktif pada fase awal |
| **Tracking AI** | Frame dikirim ke engine deteksi tubuh/kaki/gestur | 1 engine aktif utama; F3 motion ditambah hanya setelah benchmark |
| **Standby** | Dikenali dan siap diaktifkan, tetapi decoding/render/inference dibatasi atau dihentikan sesuai kemampuan sumber | Idle / low activity, bukan klaim bahwa kamera HP pasti terus aktif di background |
| **LIVE output** | Proyektor diizinkan menampilkan feed berdasarkan QA terbaru | Tidak pernah otomatis setelah pergantian, kehilangan frame, atau reconnect |

**V1 tidak mendukung 10 decoder live sekaligus, 10 model pose, atau 10 keluaran proyektor.** Penambahan kemampuan harus melewati benchmark perangkat dan resource governor.

### State setiap kamera

`discovered → pairing → connecting → verifying → ready → routed`  
Cabang: `standby`, `recovering`, `stale`, `error`, `disconnected`.

- `ready` harus dibuktikan dengan frame baru yang bergerak dan identitas stream valid; sekadar WebRTC `connected` tidak cukup.
- `stale` berarti frame berhenti, timestamp mundur, decoder beku, atau sumber terlepas.
- `recovering` mempertahankan sesi bila memungkinkan, mengunci semua consumer LIVE, menolak replay frame lama.
- `disconnected` hanya terjadi setelah pelepasan atau pemulihan gagal; kamera lain tetap dipertahankan.

## 4. Arsitektur teknis

### 4.1 Lapisan global yang tetap hidup

```text
Webcam / USB / HDMI / OBS      HP QR / WebRTC       MP4 (lokal)
            \                       |                 /
                 Camera Hub Ingest Adapters
                            |
                 CameraHubRuntime + Registry
                 + Lease + Health + Governor
                            |
                       Frame Router
                 /             |            \
       Stage 1 Track       Stage 2       F3 Camera A/B
            |                |                |
     Compose / Map       Visual/Audio    Capture / Photo
            \                |                /
                  Independent QA & Blackout
```

Membuat `CameraHubProvider` di atas semua workspace dan **tidak ikut unmount saat mengganti Stage**. Perbaiki navigasi Stage 2 dari `window.location.assign` ke transisi in-app dengan runtime yang sama. `StageTwoApp` dapat dipertahankan sebagai entry kompatibilitas yang mengalihkan pengguna ke root bersama, tanpa menduplikasi kepemilikan kamera.

Jangan menggunakan `BroadcastChannel` sebagai jalan pintas untuk berbagi `MediaStream` antarhalaman yang tidak punya pemilik runtime yang sama. Untuk beberapa tab/jendela, hanya satu tab boleh menjadi pemilik capture perangkat; tab lain membaca status, atau menampilkan permintaan ambil alih yang eksplisit. Handoff antartab yang membawa media memerlukan desain terpisah.

### 4.2 Batas tanggung jawab modul

| Modul baru/yang disesuaikan | Tanggung jawab |
|---|---|
| `CameraHubRegistry` | Source ID stabil per sesi, nama operator, tipe, status, lastFrame, generation, lease dan diagnostik |
| `CameraHubProvider` | Pemilik instance kamera saat perpindahan Stage; subscribe/unsubscribe React tanpa menutup kamera secara otomatis |
| `CameraIngestAdapter` | `UsbCaptureAdapter`, `PhoneWebRTCAdapter`, `LocalVideoAdapter` untuk lifecycle dan liveness |
| `CameraRouter` | Atur assignment `cameraId → consumerSlot`, hindari duplikasi perangkat yang tidak didukung, lakukan switch atomik |
| `CameraResourceGovernor` | Profil 1/2 feed, pembatas decoder dan inferensi; mengurangi beban standby, menolak alokasi melebihi batas |
| `CameraHealthMonitor` | Frame age, bitrate/FPS bila tersedia, mute/ended, reconnect, log ringkas tanpa rahasia |
| `Stage 1 adapter` | Consumer `stage1.track`: satu feed masuk ke `CameraTracker`, source generation menjaga footprint/Map |
| `Stage 2 adapter` | Consumer `stage2.visual`: feed untuk instrumen terpilih, dengan fallback terkontrol |
| `F3 adapter` | Consumer `f3.cameraA` dan `f3.cameraB`: masih memakai mekanisme crop, consent, dan liveness F3 |
| `CameraHubPanel` | Satu UI universal untuk menghubungkan, memantau, menugaskan, memberi nama, menghentikan |

Pertahankan `F3CameraRegistry` sebagai compatibility adapter selama migrasi; jangan menghapusnya sebelum seluruh negative-flow F3 lulus.

### 4.3 Kontrak data awal

```ts
type CameraSourceKind =
  'usb' | 'webcam' | 'hdmi-capture' | 'phone-webrtc' | 'virtual' | 'local-video';

type CameraState =
  'discovered' | 'pairing' | 'connecting' | 'verifying' |
  'ready' | 'routed' | 'standby' | 'recovering' |
  'stale' | 'error' | 'disconnected';

type ConsumerSlot =
  'stage1.track' | 'stage2.visual' |
  'f3.cameraA' | 'f3.cameraB';

type CameraRecord = {
  cameraId: string; // internal, non-credential UUID
  displayName: string;
  kind: CameraSourceKind;
  state: CameraState;
  generation: number;
  lastFrameAt: number | null;
  lastErrorCode?: string;
  connectedAt: number | null;
  assignments: ConsumerSlot[];
};

type RouteRequest = {
  cameraId: string;
  slot: ConsumerSlot;
  expectedGeneration: number;
};

type RouteResult = {
  accepted: boolean;
  routeGeneration: number;
  requiresStageQa: boolean;
  reason?: 'STALE'|'BUSY'|'CONFLICT'|'OVER_CAPACITY'|'PERMISSION';
};
```

Frame/consumer harus membawa `cameraId`, `generation`, `frameId`, `timestamp`, resolusi, basis koordinat, dan status fresh. **Jangan menyimpan `MediaStream`, SDP, bearer token atau frame di localStorage.** Media tetap pada runtime; token pemulihan QR hanya di penyimpanan sesi sesuai protokol yang sudah ada.

### 4.4 Lease dan routing

- Setiap adapter mempunyai **satu pemilik source** dan boleh punya beberapa consumer read-only bila perangkat serta governor mengizinkan. `getUserMedia` jangan dipanggil berkali-kali untuk `deviceId` yang sama demi setiap Stage.
- Memilih kamera pada slot berarti mengajukan `RouteRequest`, memeriksa generasi/freshness/kapasitas, memasang consumer baru, menunggu frame baru, kemudian melepas lease lama. Pada error, sumber lama tetap tercatat, output berada pada Blackout.
- F3 A dan B wajib memiliki dua sumber fisik yang berbeda, kecuali mode fixture QA secara eksplisit menyatakan hal lain; **jangan memalsukan dua sudut dari satu kamera**.
- Source sharing ke Stage 1 dan Stage 2 dapat dilakukan saat sumber memiliki satu capture owner; metadata konsumen harus berbeda. Satu kamera yang ditugaskan bersamaan ke F3 A/B tetap ditolak.
- Perpindahan Stage **tidak otomatis memindahkan kamera yang di-route ke slot lain**. Assignment tersimpan pada hub, consumer Stage aktif sesuai modul.
- Jika kuota penuh: tawarkan `Hentikan sumber X` atau `Pilih kamera standby`, jangan diam-diam menutup kamera yang sedang dipakai.
- Ganti sumber saat Perform LIVE harus mengirim Blackout dulu, invalidate Map dan pose/actor identity, lalu menunggu frame baru dan QA ulang. UI tidak boleh menampilkan LIVE sebelum seluruh gate lolos.

### 4.5 Mode standby

Standby tidak berarti WebRTC/iOS tetap dapat memotret di background. Implementasi bertingkat:
1. USB/virtual: simpan metadata dan permission, hentikan decode ketika tidak dibutuhkan; pembukaan ulang bisa memerlukan izin.
2. WebRTC HP: ruang signaling bertahan selama masa sesi, stream boleh turun kualitas atau berhenti sesuai dukungan browser; reconnect dengan epoch baru dan konfirmasi keamanan.
3. MP4: file/URL dipertahankan dalam session memory tanpa menjalankan analisis kontinu.
4. Kunci layar HP / pindah tab: beri pesan `Perangkat tertahan`, bukan seolah kamera tetap live.

## 5. Skenario operator yang wajib berjalan

### A. Mulai pertunjukan dengan 3 kamera

1. Buka Camera Hub dari header.
2. Hubungkan Webcam Tengah melalui USB, HP Aktor via QR, HP Penonton via QR.
3. Daftar menampilkan 3 kartu dengan nama, status, thumbnail, connection method, dan last seen.
4. Routing: Webcam Tengah → `stage1.track`; HP Aktor → `f3.cameraA`; HP Penonton → `f3.cameraB`.
5. Operator membuka Stage 1, lalu F3, lalu Stage 2 tanpa melakukan pairing ulang. Perpindahan workspace tidak menutup sesi yang masih punya lease.
6. Ketika F3 dibuka, kedua kamera A/B harus fresh; capture hanya boleh setelah consent dan armed gates F3 terpenuhi.

### B. Lepas satu dari tiga kamera

1. HP Penonton terputus. Hanya slot `f3.cameraB` berubah `recovering/stale`.
2. F3 otomatis menutup rana, menolak foto baru, dan memperlihatkan status B.
3. Stage 1 dan `f3.cameraA` tetap hidup, tanpa refresh paksa.
4. Setelah HP B pulih, F3 memeriksa ulang frame baru. Foto lama tetap ada, status consent dan armed diperiksa kembali sesuai aturan F3.

### C. Pindah kamera pada Stage 1

1. Operator mengganti Webcam Tengah → HP Aktor ketika Map telah disetujui.
2. Blackout aktif; foot trail/identity/kalibrasi lama tidak terbawa sebagai bukti frame baru.
3. Tracker membuka feed yang dialokasikan dan menunjukkan raw camera + skeleton/feet sesuai toggle.
4. Map wajib dikonfirmasi lagi sebelum Perform LIVE.

### D. Stage 2 tidak menghapus pairing

1. Hubungkan HP melalui Stage 1, lalu buka Stage 2.
2. Runtime Camera Hub tetap terpasang karena perpindahan in-app.
3. Stage 2 menggunakan feed yang dipilih; menutup instrumen tidak menghentikan capture selama lease Stage lain ada.
4. Kembali ke Stage 1; video tidak memerlukan QR baru. Saat browser di-refresh penuh, pemulihan mengikuti kemampuan QR Recovery V2 dan kembali dari kondisi Blackout.

### E. Sepuluh perangkat terdaftar

1. Semua tampil dalam daftar, bisa diganti nama dan diperiksa status.
2. Hanya jumlah feed sesuai kapasitas governor yang boleh streaming/decode aktif.
3. Permintaan feed ketiga saat batas 2 aktif menghasilkan peringatan dan pilihan memindahkan lease; tidak menyebabkan freeze/crash maupun menghentikan feed lain.
4. Tidak ada klaim 10 video real-time sebelum hasil stress test perangkat fisik mendukungnya.

## 6. Ketentuan keamanan, privasi, dan keselamatan

**Wajib / P0:**

- Gunakan satu room signaling per HP; token HP/desktop terisolasi. Pengguna yang memiliki token dari room lain tidak boleh mengakses offer/answer atau mengubah assignment kamera.
- Batasi peran caller: hanya owner hub lokal yang memutus lease dan mengganti slot; penerima HP hanya mengirim stream, tidak boleh mengubah rute Stage atau menyalakan proyektor.
- WebRTC tetap melalui DTLS-SRTP; endpoint HTTPS dan origin policy. Jangan melog SDP/ICE, token pairing, foto penonton, atau URL undangan QR.
- Pertahankan hardening pairing terakhir: QR tiket sekali pakai, token per perangkat, epoch anti-replay, scoped rate limit, ACK untuk penghapusan SDP setelah handshake.
- Refresh, connection loss, device `ended/muted`, stale frame, duplicate ID, route konflik, source changed, serta reconnect menyebabkan gate Stage terkait menjadi tidak valid.
- Blackout *fail closed*: output fisik tidak pernah LIVE otomatis setelah berpindah source, reconnect, atau unmount modul. Kontrol Blackout global tetap dapat diakses setiap saat.
- F3 tetap meminta persetujuan penonton sebelum foto. Tidak memigrasikan gambar penonton ke Stage lain, cache bersama, atau telemetry.
- Pencabutan permission, pelepasan USB, dan refresh harus membersihkan tracks, object URLs, timer, worker, dan lease yang benar; jangan melakukan `stop()` pada track yang masih dibutuhkan consumer lain.
- Uji isolasi antartab: dua tab tidak diam-diam membuka kamera yang sama atau mengambil alih sesi tanpa persetujuan.

**P1 / lingkungan preview:**

- Evaluasi TURN relay dengan credential pendek usia untuk kasus NAT/Wi-Fi tertentu; perhatikan ongkos dan privasi.
- Kebijakan Content Security Policy, sanitasi nama kamera, review dependensi, dan mitigasi XSS terhadap token sessionStorage.
- Telemetry yang aman: hanya status, kode error, frame age/FPS/agregat; hapus data sesi sesuai kebijakan retensi.

## 7. Resource governor

Profil awal yang **harus dibuktikan dengan benchmark**, bukan dianggap kapasitas final:

| Profil | Registered | Connected / streaming | AI inference | Tujuan |
|---|---:|---:|---:|---|
| Basic | 3 | 1 | 1 | Stage 1 rehearsal |
| Capture | 3 | 2 | 1 motion path F3 + capture feed | F3 A/B |
| Extended | hingga 10 | 2 (default, dapat dikonfigurasi setelah benchmark) | 1–2 sesuai kemampuan | Perangkat cadangan |
| Experimental | hingga 10 | >2 hanya setelah QA fisik | Adaptive / budgeted | Multi-camera lab, tidak untuk LIVE awal |

Governor mengevaluasi decode FPS, inference FPS, latency P50/P95, frame drop, RAM, overheating, baterai, latensi WebRTC, dan USB bus yang tersedia. Penurunan performa harus mengurangi kualitas preview/stream nonprioritas **sebelum** memengaruhi output pertunjukan.

**Jangan menjalankan 10 loop AI independen hanya karena 10 kamera dikenali.**

## 8. Tahap pengerjaan / urutan issue

### P0 — Fondasi Camera Hub (prioritas pertama)
- [ ] CH-001: `CameraHubRegistry`, typed state, generation dan lease; unit test konsistensi.
- [ ] CH-002: `CameraHubProvider` di aplikasi root dengan owner tunggal dan cleanup aman.
- [ ] CH-003: Integrasi webcam/USB dan receiver QR dari Track tanpa mengubah hasil deteksi kaki.
- [ ] CH-004: Drawer Camera Hub global di header; nama kamera, status, thumbnail dan connect/disconnect.
- [ ] CH-005: Selaraskan navigasi Stage 1 ↔ Stage 2 ↔ F3 tanpa full reload; jaga blackout saat perpindahan.
- [ ] CH-006: Routing satu feed ke Stage 1 dengan QA ulang pada setiap pergantian.

### P1 — F3 dan dua feed aktif
- [ ] CH-007: Adapter F3 A/B ke Hub; registry F3 tetap sebagai gate frame/crop/consent.
- [ ] CH-008: Lease dua feed independen, identitas kamera tak tertukar, mengatasi satu perangkat hilang.
- [ ] CH-009: Governor 2 aktif, 3 registered/connected; fallback jika sumber ditolak.
- [ ] CH-010: Uji nyata Mac/USB Webcam + HP QR + USB Capture/HP lain.

### P2 — Stage 2 dan pergantian lintas modul
- [ ] CH-011: Adapter source `stage2.visual` ke instrumen Stage 2 yang memang memakai video/gerak.
- [ ] CH-012: Navigasi in-app dan handoff aliran video; source tetap terhubung saat workspace tak aktif.
- [ ] CH-013: Reconnect QR Recovery V2 dari hub; jika signaling backend tidak ada, tampilkan kode manual yang jelas.

### P3 — Kapasitas dan hardening 10 perangkat
- [ ] CH-014: Registry hingga 10, penamaan, filter/sort status, kuota dan standby.
- [ ] CH-015: Stress test signaling 3/10 dengan Redis nyata pada preview terpisah.
- [ ] CH-016: Stress test fisik 3 kamera, lalu 10 perangkat registrasi, fault injection 1+N.
- [ ] CH-017: Security review, per-tab owner, SDP cleanup, token expiry, penanganan duplicate/hostile client.
- [ ] CH-018: Profil resource governor berdasarkan data CPU/GPU, USB/Wi-Fi, dan browser nyata.

**Titik hentikan sebelum production:** P0/P1 gagal bila F3 kehilangan frame A/B, ada salah atribusi cameraId, Stage 1 menampilkan pijakan lama, atau output menyala kembali otomatis setelah sambungan pulih.

## 9. Acceptance criteria terukur

| ID | Kondisi | Lulus bila |
|---|---|---|
| AC-01 | Hub 3 kamera | 3 entri berbeda terdaftar; minimal dua feed dapat dipakai sesuai profil; tidak ada QR ganda di satu room |
| AC-02 | F3 A/B | Dua frame sourceId berbeda dan fresh; kehilangan B menutup rana B tanpa memutus A |
| AC-03 | Stage switch | Stage 1 → 2 → F3 → 1 tidak membongkar CameraHubRuntime atau membuka pairing baru bila koneksi tetap valid |
| AC-04 | Swap Track | Source generation baru, identity reset, Map approval invalid, projector Blackout sampai QA baru |
| AC-05 | Refresh desktop | QR V2 memulihkan video di lingkungan preview backend, lalu kembali ke Blackout dan QA; fallback manual pada GitHub Pages |
| AC-06 | Isolasi | Stop/putus kamera X tidak mengakhiri track kamera Y yang masih punya consumer |
| AC-07 | Overcapacity | Alokasi feed > batas ditolak dengan alasan eksplisit, tidak menutup atau membekukan feed lain |
| AC-08 | Sepuluh entri | Registry mengelola 10 metadata/perangkat tanpa mengklaim 10 decode/inference aktif |
| AC-09 | Security | Role-token salah/room lain, QR replay, stale epoch, dan cross-slot unauthorized route ditolak |
| AC-10 | Memory & cleanup | Setelah lease terakhir dilepas, tracks/timer/worker/URLs terkait berhenti; pengulangan connect/disconnect tidak menambah listener yang bocor |
| AC-11 | Perform safety | Perangkat menghilang, pindah Stage, atau reconnect tidak pernah menyalakan output fisik sendiri |
| AC-12 | QA fisik | Uji Chrome Android, Safari iOS, webcam Mac/USB, capture card; hasil dicatat dengan benchmark latency/FPS/tekanan CPU dan kegagalan yang terlihat |

### Tes negatif wajib

- Salah satu dari 3 kamera terputus saat dua lainnya live.
- Dua konsumen mencoba memakai perangkat eksklusif yang sama.
- F3 A dan B diarahkan ke satu `deviceId`.
- Kamera HP datang sesudah source berganti; callback lama tidak boleh menimpa route baru.
- Stale video diteruskan oleh decoder ketika jaringan mati; frame tidak boleh diberi status fresh.
- HP keluar-masuk tab, refresh laptop, refresh HP, kehilangan Wi-Fi <12 detik dan >12 detik.
- Sepuluh koneksi menekan CPU/memori/bandwidth; governor harus menahan sumber tambahan dan tidak menjatuhkan operator UI.
- Dua tab desktop dibuka: tidak terjadi pengambilalihan kamera secara diam-diam.
- Stage 2 berpindah ke F3 lalu kembali: lease dan foto F3 tidak terhapus akibat navigasi.
- Operator menekan Blackout saat proses re-route: tidak ada callback tertunda yang menyalakan output.

## 10. Non-goals V1

- Streaming 10 kamera sekaligus dengan 10 model pose.
- Multiview switching sinematik, audio mixer, atau video recorder 10 channel.
- Sinkronisasi genlock/timecode profesional antarsemua kamera.
- Pencampuran multi-view pose reconstruction atau koreksi 3D dari banyak sudut.
- Handoff kamera lintas perangkat laptop berbeda.
- Membuat backend signaling otomatis bekerja langsung di GitHub Pages statis.
- Mengubah desain F3 fullscreen, algoritme gesture capture, atau engine footprint artistik dalam tahap fondasi.

## 11. Pengiriman dan rollback

1. PRD disimpan di `docs/` pada branch pengembangan. **Tidak ada implementasi kode dalam commit PRD.**
2. Implementasi per issue CH-001...CH-018; uji lint dan TypeScript, unit, Playwright Chromium, lint format, lalu QA perangkat sebelum merge.
3. Gunakan feature flag `cameraHubEnabled` default off selama migrasi. Stage 1 dan F3 yang lama tetap menjadi jalur aman jika ada regresi.
4. Semua perubahan dikirim ke GitHub Pages preview terlebih dahulu; jangan deploy Vercel production tanpa keputusan eksplisit.
5. Setiap rilis menyertakan catatan: jumlah perangkat yang diuji, jumlah feed live terukur, FPS/latency nyata, insiden dropout, dan langkah rollback.

## 12. File sumber repository yang menjadi dasar PRD

- `src/studio/v3/GlobalNav.tsx` — tiga tujuan utama: Stage 1, Stage 2, F3 Capture.
- `src/App.tsx` — sumber Track, CameraTracker, source switch, dan navigasi Stage 2 memakai full reload.
- `src/studio/v3/StageTwoApp.tsx` — root Stage 2 terpisah.
- `src/f3/F3CameraRegistry.ts` — dua role F3, liveness, sumber USB/HP dan error isolation.
- `src/studio/v3/FootprintsStageWorkspace.tsx` — proses Stage 1 serta pilihan sumber.
- `src/studio/v3/sourceSwitchModel.ts` — empat jenis sumber Stage 1.
- `src/stage/PhoneCameraReceiver.tsx`, `PhonePairProtocol.ts` — USB/QR/manual, masa pairing dan rejoin.
- `docs/SOMA_MULTI_CAMERA_SECURITY_STRESS_2026-11-22.md` — audit multi-room security & simulasi signaling (bukan benchmark media fisik).

---
**Keputusan final untuk implementasi V1:** satu Camera Hub global pada header; tiga Stage tetap ada; mulai dari 3 perangkat / 2 feed aktif / 1 jalur AI prioritas; dukungan registrasi hingga 10 tidak membuka 10 video atau 10 AI serentak.