# SOMA V2.4 — Spatial Coverage, Motion Smoothing & Rough Sumi
## Product Requirements Document (PRD)

**Tanggal:** 23 November 2026  
**Status:** Proposed / siap dipecah untuk implementasi; fitur V2.4 belum diimplementasikan lewat dokumen ini  
**Pemilik alur:** Track → Compose → Map → Perform  
**Target keluaran:** FLOOR, Dual Trace V2 + Path Sumi, dua aktor A/B  
**Dokumen teknis:** [Technical Architecture V2.4](SOMA_V24_SPATIAL_COVERAGE_MOTION_INK_TECHNICAL_ARCHITECTURE.md)  
**Baseline kode yang diaudit:** branch \`main\`, commit \`f264a92980a78181daf60bc76cea7b095d482684\`  
**Baseline sebelumnya:** [PRD Path Continuity V2.3](SOMA_PATH_CONTINUITY_V23_PRD.md), [Tech Spec V2.3](SOMA_PATH_CONTINUITY_V23_TECHNICAL_ARCHITECTURE.md)

> **Keputusan produk:** Benahi jangkauan ruang dan akurasi centerline lebih dahulu. Haluskan gerak sepanjang waktu tanpa menghapus hesitation, turning, dan STOP. Setelah geometri terbukti, buat tinta Sumi dengan serat dan tepi kasar yang tetap mengikuti satu stroke kontinu. Footprints tetap berasal dari bukti kaki/kontak, kepala-bahu hanya memodulasi karakter stroke.

---

## 1. Masalah pada hasil nyata

Hasil Compose terakhir memperlihatkan pita merah dan arang di tengah kanvas, dengan sebagian noda/fragmen terpisah. Stroke sudah lebih menyambung dibanding V2.1/V2.2, tetapi perjalanan aktor dari tepi kiri/kanan video menuju tengah lalu kembali ke tepi belum tercakup secara meyakinkan. Material ribbon terlihat relatif solid, serat kering kurang terasa. Sebagian belokan masih tampak berombak atau terlalu bulat.

### 1.1 Bukti video uji

Sumber yang diperiksa langsung: \`Two_performers_navigating_rehear…_d7f04e2d(2).mp4\`.

| Atribut | Nilai terukur |
|---|---|
| Ukuran gambar | 640 × 360 px |
| Frame rate | 24 fps |
| Jumlah frame | 360 |
| Durasi | 15,04 detik |
| SHA-256 lokal (identitas fixture) | \`c0c1437adad33492b8b811bd1da131c33a357d858d3b394689b167e8a9adb079\` |

**Urutan yang tampak dari contoh frame:** detik 0 dua aktor berada di ujung kiri/kanan bidang putih; sekitar detik 2 mendekat; detik 4 berpapasan dan berbelok; detik 6 bergerak kembali ke luar; detik 8–14 sudah dekat ujung kiri/kanan dan relatif diam. Gambar tapak warna abu-abu/oranye tampak di bidang putih **sebagai bagian dari piksel video**, sehingga tidak boleh dipakai sebagai keluaran detector atau ground truth jejak kaki.

Catatan verifikasi: pemetaan aktor A/B sepanjang klip belum diberi anotasi identitas independen, dan belum ada ekspor koordinat tracker per frame dari runtime SOMA. Screenshot akhir hanya menguatkan *gejala cakupan ruang*, belum membuktikan satu baris kode tertentu menjadi penyebab tunggal.

### 1.2 Kode yang sudah diperiksa

- \`PathObservationRouter.ts\`: mengambil 1–2 kaki per aktor; logika stance/swing mengurangi perpindahan ketika evidence lemah. Cabang satu kaki memakai \`limit(delta,8) * .12\`; jalur dua kaki memiliki bobot support dan midpoint berbeda.
- \`ActorGroundTrajectoryEstimator.ts\`: memakai bobot awal foot \`.55\` bila dua kaki, \`.15\` bila satu; sisanya dari delta pinggul. Ada koreksi menuju \`foot.point\` tiap frame (\`7px\`/ \`3px\` per langkah estimasi), serta hip-only buffer/bridge V2.3.
- \`SourceFrameNormalizer.ts\`: pose MP4 yang tertinggal lebih dari 320 ms dari playback tidak diterima; jumlah kaki yang dilaporkan tidak sama dengan keberhasilan lintasan.
- \`ActorMotionFrameBuilder.ts\`: hip/head/shoulder diambil dari 33 keypoint dan dikonversi ke koordinat gambar kanonik 1600×900; belum membawa anchor support terverifikasi untuk semua waktu.
- \`PathSplineFitter.ts\`: spline centripetal antarknot dengan koridor ±7 px; belum ada filter temporal adaptif khusus untuk geometri actor center.
- \`SumiRibbonMeshBuilder.ts\`: bobot ribbon dijepit 6–42 px; tepi dibuat geometri polygon halus dengan taper.
- \`DirectionalInkPainter.ts\`: polygon ribbon diisi tinta solid, lalu hanya sebagian serat tipis dihapus di dalam mesh.
- \`PersistentPathStore.ts\`: committed canvas + active tail; penambahan ulang active tail tidak boleh diartikan panjang jalur.
- \`LineTrailsV3.tsx\`: mempertahankan Compose → Map → Perform dan sakelar beta V2.3 dengan fallback V2.2. Kalibrasi FLOOR memakai transform bila profil video tersedia.

**Tiga kelompok masalah terpisah:** (1) sumber titik dan transformasi ruang, (2) stabilisasi urutan titik, (3) material tinta. Pengujian harus bisa mematikan masing-masing kelompok agar penyebabnya terukur.

## 2. Janji hasil dan ruang artistik

Selama klip, penonton melihat **dua tubuh menulis dua jalur perjalanan**. Stroke mengikuti perpindahan pusat gerak aktor pada lantai yang sama, termasuk mendekat, berpapasan, berbelok, mundur, dan berhenti. Semakin tubuh ragu atau berpindah bobot, karakter tepi/bobot tinta dapat berubah. Saat kaki benar-benar terdeteksi menapak, cap muncul di posisi kaki, menimpa garis bila bertemu, lalu memudar menurut durasi. **Pusat jalur tetap tenang; tekstur kuas boleh kasar.**

Jangan menambahkan pita/jembatan dekoratif ke sisi panggung hanya untuk memenuhi gambar. Jangan menggerakkan cap mengikuti jalur yang salah demi mempercantik komposisi. Gap identitas yang ambigu tetap harus diputus.

## 3. Sasaran (outcomes) dan prioritas

| ID | Prioritas | Hasil pengguna |
|---|---|---|
| V24-G01 | P0 | Jangkauan garis A/B sesuai lintasan visual di ujung kiri/kanan dan tengah pada MP4 benchmark |
| V24-G02 | P0 | Titik kaki, hip, anchor lintasan, floor coordinates dan hasil render bisa dibandingkan pada timestamp yang sama |
| V24-G03 | P0 | Camera-to-floor calibration valid dipakai tepat satu kali; mode image-2D diberi label estimasi |
| V24-G04 | P0 | Identity A/B bertahan saat crossing dan pemulihan; tidak ada teleport atau jembatan antaraktor |
| V24-G05 | P0 | Fusi foot/hip tidak menyusutkan jarak perjalanan secara progresif atau drift jauh ke pusat |
| V24-G06 | P0 | Compose, fullscreen, PNG, Map pre-warp dan Perform menerima satu raster hasil pada timestamp yang sama |
| V24-G07 | P1 | Perjalanan halus secara temporal, dengan pivot/STOP/hestitation tetap terbaca |
| V24-G08 | P1 | Rough Sumi: tepi berserat, dry bristle, pigmen bervariasi; centerline tetap sama |
| V24-G09 | P1 | Footprints menimpa jalur saat koordinat beririsan; memudar tanpa menghapus path |
| V24-G10 | P1 | Status operator singkat, Detail Diagnostik menyebut sumber kesalahan dan tingkat kepercayaan |
| V24-G11 | P1 | Replay/seek/source switch menghasilkan gambar deterministik dan tidak menumpuk tinta palsu |
| V24-G12 | P2 | Profil performa 30 menit, perangkat HP/kamera nyata, penyempurnaan preset material |

## 4. Batasan dan hal yang sengaja ditunda

- Tidak mengganti model pose sebagai langkah pertama; tidak mengandalkan model ketiga hanya untuk membuat garis panjang.
- Tidak mengubah urutan **Track → Compose → Map → Perform**.
- Tidak menyimpulkan kontak fisik, tekanan kaki, kedalaman 3D atau posisi pinggul di lantai dari satu kamera monokular.
- Tidak menggambar garis dari gambar cetakan tapak yang sudah berada dalam MP4.
- Tidak memakai smoothing untuk menutup perpindahan actorId yang tertukar.
- Tidak menggunakan Hydra.js sebagai solusi awal; Canvas 2D + ribbon shader yang ada cukup untuk menguji hipotesis.
- Tidak mengubah kebutuhan proyektor, blackout, stage dimensions, atau deploy Vercel.
- Tidak membuat V2.4 default sebelum uji MP4 asli, browser, dan rollback berhasil.

## 5. User stories dan pengalaman operator

### 5.1 Track — mengenali bidang gerak
- Operator membuka MP4 atau kamera, memilih 1P/2P.
- SOMA menampilkan jumlah tubuh dan kaki **secara terpisah**: misalnya A kiri ada/kanan hilang, B kiri ada/kanan ada.
- Bila bidang lantai belum ditentukan, Compose bisa dibuka untuk diagnosis, tetapi status **“Ruang perkiraan 2D”** tetap terlihat.
- Pilihan **“Sesuaikan bidang kamera”** membuka kalibrasi empat titik yang dapat dibekukan pada frame video. Uji marker lantai dan validasi winding/corner order sebelum Simpan.
- Perubahan crop/zoom/mirror/aspect/rotasi sumber membatalkan kecocokan profil lama; penyesuaian ukuran preview UI saja tidak.

### 5.2 Compose — satu lukisan
- Stage Monitor putih, warna A merah dan B arang, hasil tetap satu kanvas.
- Panel pendek: **Jalur**, **Tinta**, **Tapak**, **Lanjutan**. Tombol Debug memperlihatkan raw foot, hip, observed center, corrected center dan stroke centerline sebagai overlay **di studio saja**.
- Pada MP4, jalur dapat ditampilkan sebagai **“Perjalanan teramati / Jalur terestimasi / Pelacakan terputus”** per aktor.
- Preset Sumi dan slider Roughness bekerja setelah koordinat jalur benar. Switch OFF Roughness tidak mengubah panjang/posisi lintasan.
- Tombol **Bersihkan semua** mereset tinta historis; pause tidak menghapus arsip; seek memulai epoch yang aman.
- Ketika aktor berhenti, kualitas tinta yang sudah terbentuk tetap terlihat, jumlah panjang accepted tidak bertambah.

### 5.3 Map dan Perform — keluaran konsisten
- Map mengubah koordinat kanvas FLOOR menjadi posisi proyektor; geometri tracking tidak dihitung ulang di Map.
- Fullscreen bersih, PNG dan output proyektor menggunakan final raster yang sama; tidak ada skeleton, label Debug, garis provisional, atau overlay QA.
- Saat output hilang: tampilan status menyebut kesalahan; **Blackout** mengunci proyektor sampai operator membuka kembali setelah QA.
- Sistem menyimpan label **image-2D estimate** atau **calibrated floor** pada sesi dan ekspor diagnosa.

## 6. Alur peristiwa yang wajib terlihat

| Peristiwa tubuh | Output geometri | Respons tinta |
|---|---|---|
| Dua aktor berangkat dari tepi | Dua centerline muncul dekat anchor kaki awal masing-masing | Tinta merah/arang mulai dari posisi yang sesuai |
| Mendekat dan crossing | Dua jalur bergerak mengikuti identitas masing-masing | Boleh beririsan secara visual, tidak tertukar |
| Berbelok menuju sisi luar | Garis melengkung mengikuti support center dan kecepatan | Tepi serat mengikuti tangent perubahan arah |
| Satu kaki hilang 1–3 frame | Hip-assisted untuk jalur, provisional bila kedua kaki hilang | Tidak membuat cap baru dari pinggul |
| Actor melakukan pivot di tempat | Perubahan orientasi diamati, translasi kecil | Boleh menambah tekanan visual terbatas, tanpa cincin/spaghetti |
| Hesitation / berhenti | Kecepatan turun ke nol dengan hysteresis | Ujung tidak menggelap terus-menerus |
| Aktor mencapai ujung jauh | Endpoint stroke berada dekat lokasi akhir aktor di floor coordinates | Tinta terlihat sampai dekat lokasi tubuh; tidak harus menyentuh tepi kanvas fisik |
| Playback berhenti/loop/seek | Epoch/clock reset konsisten | No ghost trail, no double deposit |

## 7. Prinsip pengukuran

### 7.1 Spatial coverage
Ukur titik referensi manual **foot-ground support atau mid-stance** per aktor pada timestamp sampel, lalu bandingkan dengan pusat jalur yang dihasilkan. Kamera tinggi tidak otomatis memberi referensi lantai yang benar untuk hip airborne. Saat kalibrasi aktif, lakukan penilaian di *floorSpace*; saat tidak, hanya penilaian image-2D.

- \`coverageX = trackedXRange / annotatedXRange\` setelah memastikan kedua rentang memakai actorId dan koordinat sama.
- \`coverageY\` dan *area* perlu diperiksa untuk melindungi gerak depan–belakang.
- \`endpointError\` dihitung dari lokasi akhir ground anchor dibanding anotasi, per aktor.
- \`trackCenterError\` menggunakan median dan P95 pada pasangan waktu yang cocok.
- Jarak path yang terlalu panjang akibat jitter **tidak dihitung sebagai cakupan yang lebih baik**.

### 7.2 Motion quality
- \`stopDriftPx\`: perubahan jalur dari frame 8–14, dibanding annotation dan noise floor.
- \`curvatureOvershootPx\`: deviasi spline terhadap corridor around annotated points saat belok.
- \`identitySwapCount\`, \`unsafeBridgeCount\`, \`CUT reason\`, \`reacquisitionLatencyMs\`.
- \`poseLagMs\`, \`acceptedFrames\`, \`lowConfidenceFrames\`, \`pathLengthPx\` A/B.

### 7.3 Material quality
- \`silhouetteStability\`: kasarkan material dengan centerline persis sama dan perbedaan maksimum lebar yang dibatasi.
- \`edgeVariation\`: energi variasi tepi pada skala lokal, diuji di strip yang benar-benar ada tintanya.
- \`strokeGapCount\`: lubang putih pada centerline yang sah, sesudah clear/seek/resize.
- \`repeatability\`: fixture sama + seed sama menghasilkan raster ekuivalen, termasuk sesudah refresh.
- Persepsi artistik tetap perlu review manusia pada 1600×900 dan proyektor, tidak ditentukan angka saja.

## 8. Acceptance criteria V2.4

**AC-01 — Baseline nyata:** MP4 SHA di atas diproses lewat detector + engine browser yang benar-benar berjalan. Video boleh disimpan sebagai fixture QA privat, **jangan otomatis menaruh file berisi manusia pada repo publik**. Rekam video source/output dan trace koordinat t=0,1,2,3,4,5,6,7,8,10,12,14 detik.

**AC-02 — Coverage tepi:** target awal \`coverageX ≥0.90\` untuk kedua aktor pada anotasi yang disetujui, di koordinat yang sama; toleransi sisi depan-belakang diuji terpisah. Hasil dibatalkan bila jangkauan besar tercapai melalui jitter atau garis penghubung palsu.

**AC-03 — Endpoint:** median endpoint error untuk lokasi akhir tiap aktor maksimal **satu panjang telapak terukur pada video yang sama**; kalibrasi dan timestamp harus cocok. Angka ini target awal, belum hasil yang telah dicapai.

**AC-04 — Identitas:** 0 koneksi A-ke-B pada crossing 0–8 detik dan seluruh hard-negative fixtures. Tidak ada forced bridge untuk identity ambiguous.

**AC-05 — Motion:** STOP 8–14 detik tidak terus mengubah panjang accepted path. Smoothing membuat jitter turun terhadap baseline tanpa meningkatkan overshoot saat turning/pivot melewati ambang QA.

**AC-06 — Cap:** tidak ada cap dari hip-only/no-foot gap. Footprint dapat menimpa garis bila posisi aktual bersinggungan. Default fade 6 detik; Path retained.

**AC-07 — Material:** preset Rough Sumi menunjukkan serat tepi lebih kuat daripada V2.3 pada panel uji sejenis, sementara mask centerline tetap kontinu dan jitter tambahan pada centerline = 0.

**AC-08 — Sinkronisasi:** Compose, PNG, clean fullscreen dan Map pre-warp ekuivalen pada timestamp, palette, order dan opacity yang sama.

**AC-09 — Playback:** seek, replay tiga kali, pause, loop, source switch, 1P/2P dan kamera reconnect tidak menggandakan deposit atau menyambung epoch berbeda.

**AC-10 — QA:** unit, property, synthetic adversarial, pixel, real-MP4 browser QA, serta 30-minute soak dan QA hardware proyektor tercatat. Semua P0 harus lulus untuk perubahan default.

**AC-11 — Rollback:** V2.3 tetap tersedia; perubahan V2.4 tidak diam-diam mengubah atau mencampur history sesi sebelumnya.

## 9. Negative case ledger yang wajib disiapkan

| Kasus | Trigger | Respons yang benar |
|---|---|---|
| NC-01 | Dua tubuh terdeteksi, hanya 3/4 kaki | Garis kedua aktor tetap mengikuti sumber valid; status jujur |
| NC-02 | Kaki B hilang saat aktor di ujung kanan | B tidak ditarik ke pusat kanvas |
| NC-03 | Foot-ground points stabil, hip berayun ke samping | Centerline tidak mengejar hip airborne secara absolut |
| NC-04 | Satu kaki ayun menjauh, satu kaki stance | Support center tidak mengikuti kaki ayun |
| NC-05 | Kamera 16:9 vs portrait/letterbox | Transform cocok dengan frame mentah, tidak stretch |
| NC-06 | Mirror/rotate/crop/zoom setelah kalibrasi | Profil invalid dan dipilih ulang; no line teleport |
| NC-07 | Empat sudut kalibrasi ditukar | Ditolak dengan alasan geometri |
| NC-08 | Actor keluar polygon lantai | Tidak diclamp ke pinggir kanvas |
| NC-09 | Crossing menukar A/B sementara | HOLD/CUT, tidak membuat bridge antaraktor |
| NC-10 | Hip-only gap 100–250 ms | Buffer provisional, commit hanya setelah recovered foot valid |
| NC-11 | Hip-only lebih lama atau foot kembali jauh | Reject/CUT, tidak menggambar garis dekoratif |
| NC-12 | Pose media tertinggal >320 ms | Jangan sambung frame lawas menjadi line baru |
| NC-13 | Gerak lambat / hesitation | Perpindahan kecil diakumulasi, bukan dibuang permanen |
| NC-14 | Pivot di tempat | Translasi kecil, turning tetap terlihat |
| NC-15 | STOP 6 detik | Panjang jalur tidak bertambah karena noise |
| NC-16 | Restart dari detik awal | Tidak ada ghost trail atau A/B swapped |
| NC-17 | Roughness maksimum | Tepi kasar, stroke masih utuh, tidak melebar liar |
| NC-18 | Material diganti saat preview | Geometry tetap identik, historical color deterministic |
| NC-19 | Footprint alpha fade | Tidak membuat lubang putih di Path |
| NC-20 | Proyektor putus/recover | Blackout aman, raster dan epoch tidak stale |

## 10. Implementasi bertahap

### Gate 0 — ukur sebelum mengubah
- Snapshot keluaran V2.3 pada MP4 yang sama.
- Trace **raw feet → hip → route center → fused center → final stroke** untuk A/B per timestamp.
- Anotasi manual dukungan kaki dan rentang lantai. Hasil harus menjawab: penyusutan terutama berasal dari input pose, fusi, transformasi, atau renderer?

### P0-A — geometri dan space
- Satu \`CoordinateSpaceContract\` untuk imageRawPx, stagePx, floorM dan projectorUV.
- \`SpatialCoverageAnalyzer\` menghitung coverage, drift, range, endpoint, out-of-floor dan source lag.
- Perbaiki pembentukan anchor awal serta koreksi drift dari support yang diamati; jangan memakai hip sebagai ground point.
- Fusi lintasan baru memakai displacement evidence terklasifikasi: translation, stance-switch, swing, pivot, occluded.
- Tambah regression fixtures yang memeriksa jalur mencapai kedua tepi tanpa teleport.

### P0-B — golden MP4/identity/raster
- Rekam pose source yang sama, timestamp sama, floor profile sama.
- Uji crossing A/B, tiga kaki terlihat, balik ke sisi luar dan STOP.
- Sinkronisasi output Compose, Map dan fullscreen.
- Gate P0 baru selesai setelah hasil perbandingan source/output tervalidasi.

### P1-A — temporal smoothing
- Filter adaptif per actor berlandaskan timestamp sumber, bukan frame render.
- Pisahkan observed endpoint dari filtered centerline dan visual-only spline.
- Saat seek/source/calibration/identity berubah, reset filter yang relevan tanpa menghapus tinta historis.

### P1-B — rough Sumi material
- Grain dipatok ke strokeId + global arc-length, bukan random tiap render.
- Tepi feather/bristle, eroded fibers, pigment islands dalam batas lebar yang ditetapkan.
- Bedakan preset Natural Sumi vs Dry Brush vs Dense Ink; parameter tetap bisa diatur dan ekspor konsisten.

### P2 — profil panggung
- Soak 30 menit, camera/HP via kabel dan Wi-Fi, crossing berulang, source restart, projection mapping & Blackout hardware.
- Catat CPU/GPU load, compositor FPS, pose FPS, dropped frames, atlas memory.

## 11. Definition of Done

1. Dua lintasan pada MP4 nyata mencapai posisi tepi yang sesuai, dengan anotasi yang bisa ditinjau.
2. Belokan/hesitation terlihat pada centerline yang halus; tidak ada drift STOP.
3. Rough Sumi tampak berserat dan dapat diulang, tanpa geometri palsu.
4. Footprints/gesture memengaruhi satu lukisan di area actor yang sesuai.
5. Output Map/Perform bersih, Blackout aman, rollback tersedia.
6. Semua P0 serta regresi V2.3 lulus. P1 yang dapat mengganggu pertunjukan juga harus ditutup sebelum stage-ready.
7. Tidak ada klaim “sudah akurat” berdasarkan fixture sintetis atau sekadar build hijau.

## 12. Modul audit dan tautan

- \`src/footprints/lines/v3/SourceFrameNormalizer.ts\`
- \`src/footprints/lines/v3/FootPositionResolver.ts\`
- \`src/footprints/lines/v3/PathObservationRouter.ts\`
- \`src/footprints/lines/v3/ActorMotionFrameBuilder.ts\`
- \`src/footprints/lines/v3/ActorGroundTrajectoryEstimator.ts\`
- \`src/footprints/lines/v3/ContinuityBridgeValidator.ts\`
- \`src/footprints/lines/v3/TrajectoryFusion.ts\`
- \`src/footprints/lines/v3/PathSplineFitter.ts\`
- \`src/footprints/lines/v3/SumiRibbonMeshBuilder.ts\`
- \`src/footprints/lines/v3/DirectionalInkPainter.ts\`
- \`src/footprints/lines/v3/PersistentPathStore.ts\`
- \`src/footprints/dual-trace/DualTraceV2Renderer.ts\`
- \`src/studio/v3/LineTrailsV3.tsx\`
- \`src/footprints/spatial/coordinates.ts\`

**Release:** V2.4 tetap proposal sampai kode, tes, dan QA nyata tersedia. Penyimpanan PRD di GitHub tidak otomatis mengubah aplikasi atau deploy.
