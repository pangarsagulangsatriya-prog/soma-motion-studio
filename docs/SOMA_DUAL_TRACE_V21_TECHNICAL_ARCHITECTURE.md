# SOMA Dual Trace V2.1 — Arsitektur Teknis & Algoritme
## Ground Trajectory Continuity, Independent Ink Layers, Stage Compositor

**Tanggal:** 23 November 2026  
**Status:** Rancangan teknis — belum diimplementasikan  
**Dokumen produk:** `SOMA_DUAL_TRACE_V21_PATH_CONTINUITY_PRD.md`  
**Sasaran utama:** Dua lintasan A/B yang konsisten, tapak temporer, gesture terpisah, satu raster untuk Compose → Map → Perform

## 1. Temuan arsitektur yang perlu diselesaikan

SOMA sudah mempunyai sebagian besar komponen dasar: normalisasi sumber, estimator posisi tubuh, tracker jalur, penyimpan tinta, impression engine, dan kompositor per aktor. Persoalan terkonsentrasi pada kontrak antar-komponen dan diagnosa hasil.

| Modul sekarang | Perilaku yang terverifikasi | Kebutuhan V2.1 |
|---|---|---|
| `PathObservationRouter` | Beberapa cabang memakai 8% / 12% perpindahan dan mode `held` | Fusi titik dukungan kaki + pusat tubuh dengan confidence dan akumulasi gerak |
| `ActorPathTracker` | Perubahan <4 px tidak menghasilkan ADD; jeda dan teleport dapat menghasilkan CUT | Hysteresis serta movement accumulator yang tetap mempertahankan STOP dan CUT |
| `PersistentPathStore` | Tinta ditahan sebagai knot, raster committed/active, serta cache revision | Tetap dipakai, pastikan pemutusan tidak menyambungkan dua sesi |
| `PainterlyImpressionEngine` | Cap estimasi dan live sole memiliki clock berbeda dari Path; fade default 6 s | Pertahankan pemisahan, samakan `sourceKey`, epoch, serta presentation time |
| `DualTraceV2Renderer` | Atlas Path, Footprints, Head/Shoulder; `drawPath` opacity default 0,8 dan `drawUpper` 0,52 | Jalur lebih terbaca, test z-order dan jangan menghapus atlas Path saat cap berkurang |
| `LineTrailsV3` | Satu `outputRaster` untuk Map; pesan input digabung dengan diagnostik | Satu pipeline telemetry, status sumber dan status lukisan dipisah |
| `UpperStageAnchorMapper` | Gesture diproyeksikan relatif terhadap floor anchor; estimasi 2D | Jaga basis/identitas waktu konsisten; gagal aman saat anchor tidak ada |

**Catatan evidensi:** angka dan nama modul berasal dari kode branch `main` saat audit. Belum ada tracing untuk file MP4 mentah yang menghasilkan screenshot; penyebab aktual harus diverifikasi dengan telemetry, bukan diasumsikan dari screenshot saja.

## 2. Pipeline target

```text
SOURCE   MP4 | Webcam | Kamera HP | Simulator
   |
   v
SourceFrameNormalizer / Pose Adapter
   | snapshot {sourceKey, sessionEpoch, frameMs, actorId, confidence}
   v
A/B Identity + Foot Support Estimator
   |
   +--> Per-actor ground trajectory observation --> Movement Accumulator
   |                                            --> ActorPathTracker
   |                                            --> Retained Path ink A/B
   |
   +--> Foot contact / step-estimate --> Impression Engine --> Footprint mask A/B
   |
   +--> Upper pose --> Stage Anchor Mapper --> Head/Shoulder ink A/B
   |
   v
Layer Compositor (Path, Footprints, Upper; colors; alpha; z-order)
   |
   +--> Compose Stage Monitor / PNG
   +--> shared clean FLOOR raster --> Map warp --> Perform / Blackout
```

Semua cabang memakai **source identity dan presentation clock yang sama**. Branch Path menghitung garis dari perpindahan aktor. Branch Footprints menempatkan cap kaki individual. Branch Upper mengolah kepala/bahu dengan representasi posisi yang tetap jujur terhadap keterbatasan kamera.

## 3. Kontrak data yang diusulkan

```ts
type ActorId = 'A' | 'B';
type SpaceBasis = 'calibrated-floor' | 'image-2d-estimate' | 'virtual-floor';
type TrajectoryPhase = 'moving' | 'hesitating' | 'stopped' | 'uncertain';

type TrajectoryObservationV2 = {
  sourceKey: string;
  sessionEpoch: number;
  sourceFrameMs: number;        // clock pose hasil detector
  presentationMs: number;       // clock media/preview untuk fade
  actorId: ActorId;
  pointStagePx: { x: number; y: number };   // canonical 1600x900
  pointBasis: SpaceBasis;
  confidence: number;           // 0..1
  footSupport?: 'left' | 'right' | 'both' | 'unknown';
  motionBasis: 'support-foot' | 'dual-foot' | 'torso-fused' | 'single-foot-estimate';
  continuity: 'valid' | 'held-short' | 'cut';
  measurementRevision: string;  // sumber + kalibrasi + dimensi + epoch
};

type TrajectoryEventV2 = {
  actorId: ActorId;
  strokeId: string;
  sourceKey: string;
  sessionEpoch: number;
  atMs: number;
  kind: 'START'|'ADD'|'TURN'|'STOP'|'CUT';
  pointStagePx: {x:number;y:number};
  confidence: number;
  reason?: 'source-switch'|'frame-gap'|'identity-uncertain'|
           'teleport'|'calibration-change'|'seek'|'recovery';
};

type PathTelemetry = {
  sourceKey: string;
  inputFrames: number;
  validPoseFrames: number;
  groundObservations: number;
  emitted: Record<'START'|'ADD'|'TURN'|'STOP'|'CUT',number>;
  rejected: Record<string,number>;
  accumulatedMovementPx: Record<ActorId,number>;
  cutReasons: Record<string,number>;
  pathLengthStagePx: Record<ActorId,number>;
};
```

Kontrak tersebut disarankan untuk adapter dan telemetry V2.1. Jangan mengganti tipe V1 di seluruh kode sekaligus; sediakan fungsi mapping menuju `ActorPathObservation` dan `PathEvent` yang sudah ada.

## 4. Ground Trajectory Engine V2 — algoritme

### 4.1 Input dan validasi frame

1. Ambil **satu** snapshot pose dari source normalizer. Jangan membuat detector kedua di Compose.
2. Verifikasi `sourceKey`, epoch, dimensi sumber dan profil kalibrasi. Jika berubah, keluarkan CUT untuk segmen lama.
3. Untuk dua aktor, periksa confidence identitas; ketika A/B ambigu, hentikan penambahan stroke sampai identitas pulih.
4. Abaikan frame yang timestamp-nya tidak naik dalam live; saat MP4 pause, pertahankan raster tanpa menghasilkan event baru.
5. Posisikan kaki pada `cameraUV`, lalu terapkan camera-to-floor **sekali** ketika profil Track valid. Bila belum ada profil, label `image-2d-estimate` dan gunakan satu ruang 2D konsisten.

### 4.2 Kandidat posisi aktor

Gunakan urutan pemilihan kualitas:

- **Foot support tepercaya:** kaki yang diperkirakan menapak dari stance/pivot hint valid.
- **Dual foot coherent:** pusat kedua kaki saat kedua posisi stabil.
- **Torso-assisted:** pusat pinggul yang bergerak konsisten sebagai bantuan terhadap pergeseran pusat tubuh, terutama ketika dua kaki sulit dipisahkan.
- **Single foot estimate:** satu kaki saja, confidence turun dan radius interpolasi dibatasi.

Jangan menggunakan satu kaki yang sedang swing sebagai titik kontak fisik. Fusi torso dipakai untuk memperkirakan perjalanan aktor dalam gambar, tetap disebut **estimasi 2D**.

### 4.3 Fusi gerak dan smoothing adaptif

Poin terpenting: hindari mengalikan semua perpindahan dengan 0,08 secara terus-menerus. Ketika hanya satu pose lemah, gerak boleh ditahan pendek; simpan perpindahan yang masuk akal dalam buffer agar tidak lenyap selamanya.

```text
per actor A/B:
  candidate = chooseSupportOrTorsoEstimate(pose, hints)
  if candidate invalid:
      mark UNCERTAIN; keep last accepted position briefly; no ADD
      CUT if gap exceeds temporal safety window

  delta = candidate - previousCandidate
  if abs(delta) indicates a teleport:
      emit CUT(reason='teleport'); do not connect to previous point

  quality = function(confidence, supportEvidence, actorIdentity)
  smoothed = adaptiveSmooth(previousFiltered, candidate,
                            speed, turnAngle, quality)
  displacementSinceLastEmission += (smoothed - previousFiltered)

  if total displacement >= emissionDistance and continuity valid:
      emit ADD or TURN at smoothed
      reset emitted displacement accumulator
  else if dwelling beyond stopWindow:
      emit STOP once on moving->stopped transition
```

**Saran ambang awal untuk fixture, belum ukuran universal perangkat:**

- dead-zone jitter: sekitar 1–2 piksel stage;
- emission distance: sekitar 3–5 piksel **kumulatif**, bukan kecepatan per-frame;
- STOP window: sekitar 240–350 ms ketika posisi stabil;
- maximum short hold: disesuaikan frame cadence dan kualitas pose;
- gap CUT: pertahankan aturan berbeda untuk MP4 dan live hingga benchmark memverifikasi perubahan.

Untuk STOP, gunakan hysteresis dua ambang (misalnya `movingEnter > stoppedExit`) supaya kondisi diam dan bergerak tidak berganti setiap frame. Simpan `lastRaw`, `lastFiltered`, `lastEmitted`, `accumulatedMovement`, `lastAcceptedAt`, `motionPhase`, `strokeId` per aktor.

### 4.4 Aturan kejadian

| Kondisi | Kejadian | Hasil |
|---|---|---|
| Gerak pertama valid | START | Mulai satu stroke baru |
| Gerak kumulatif melewati ambang | ADD | Memanjangkan stroke sesuai pusat perjalanan |
| Arah berubah tajam dengan confidence valid | TURN | Kurva berubah arah, memberi aksen kuas secukupnya |
| Stabilisasi setelah bergerak | STOP | Menutup ujung tinta satu kali; tidak menambah noda setiap frame |
| Seek, identity swap, source/profil berubah, teleport | CUT | Putuskan jalur; mulai lagi saat data valid, jangan gambar jembatan palsu |
| Pose hilang sebentar | Hold short | Tahan tanpa menulis titik baru; kemudian lanjut atau CUT menurut limit |

### 4.5 Sinkronisasi dua aktor

Identitas dan stroke tidak boleh dipilih berdasarkan urutan kiri–kanan gambar, sebab dua aktor dapat saling menyalip. Kunci stroke memakai `{sourceKey, sessionEpoch, actorId, strokeSequence}`. Kualitas tracking dan out-of-bounds diperiksa per aktor. Crossing yang berhasil mempertahankan identitas dapat menghasilkan dua garis yang bertumpuk tanpa saling menyambung.

## 5. Pemisahan Path, Footprints, dan Upper

### 5.1 Path atlas

- Penyimpanan Path A dan B tetap independen melalui `PersistentPathStore`.
- Retain knot `START/ADD/TURN/CUT` dan atlas committed/active, supaya sapuan bisa diwarnai ulang.
- `STOP` menghentikan pembentukan titik; `CUT` memisahkan segmen historis.
- `Clear Path` hanya menghapus jalur, tidak menghapus cap atau gesture.
- MotionBrushDynamics menerima trajectory event, bukan frame mentah, agar noda stop tidak bertambah ketika pose diam.

### 5.2 Footprints atlas

- Cap hanya diterima dari contact event valid atau *estimated step* yang eksplisit.
- Setiap mark memuat `actorId`, `foot`, `sourceFrameMs`, koordinat dan provenance.
- Durasi default enam detik mengikuti presentation clock MP4. Saat MP4 pause, fade ikut berhenti.
- Pembersihan footprint tidak boleh memanggil reset Path atau Upper.
- Atur origin, warna, orientasi dan alpha di kompositor; atlas Path tetap tak berubah saat cap memudar.

### 5.3 Upper atlas

- Head dan Shoulder mengikuti source frame/identity yang sama.
- Saat profil lantai tersedia, gunakan `UpperStageAnchorMapper` untuk displacement relatif terhadap floor anchor aktor.
- Bila floor anchor/torso tidak valid, jangan menghubungkan posisi Upper ke aktor lain.
- Default opacity lebih rendah; kontrol `Upper On/Off` dipakai untuk mengisolasi sebab garis pucat.

## 6. Kompositor dan prioritas warna

Gunakan `DualTraceV2Renderer` sebagai titik komposisi. Pertahankan mask per aktor dan tint cache by revision. **Latar putih digambar satu kali**, setelah itu atlas transparan digambar menurut urutan.

```ts
// Pseudocode: semua canvas berada dalam koordinat 1600x900.
const order = settings.upperOnTop
  ? ['footprint', 'path', 'upper']
  : ['upper', 'path', 'footprint'];

fillBackground(finalCanvas, '#F7F6F2');
for (const layer of order) {
  for (const actorId of ['A', 'B']) {
    const tint = tintCached(maskFor(actorId, layer), color[actorId][layer]);
    draw(finalCanvas, tint, opacity[layer]);
  }
}
publishCleanRaster(finalCanvas);    // satu publisher
```

**Usulan default awal:** Path opacity 0,95; Footprints 0,85; Upper 0,35. Pastikan Path tetap dominan di kedua preset urutan. Ganti warna/opacity hanya di kompositor; trajectory tidak ikut dihitung ulang.

Perhatikan tint alpha dari `PersistentPathStore`: uji warna putih pada mask transparan, kesesuaian `source-in`, dan apakah `getCanvas()` mengembalikan committed + active ink yang benar. Jangan memperbaiki kehilangan Path dengan menggambar footprint sebagai garis semu.

## 7. Telemetry P0 — sebelum tuning artistik

Tambahkan ring buffer metrik yang **tidak masuk** clean canvas. Saat membuka panel Diagnostik, tampilkan ringkasan singkat per aktor:

```text
MP4 00:07.400 | source key OK | pose age 80 ms
A: observed 104 | accepted 92 | START 1 ADD 78 TURN 9 STOP 2 CUT 0
B: observed 103 | accepted 87 | START 1 ADD 71 TURN 11 STOP 1 CUT 1
    CUT reason: identity-uncertain
A path length: 1240 px | B path length: 1180 px
Footprints: 9 active / 27 retained | Upper: last valid 00:07.330
```

Angka di atas **contoh format UI, bukan hasil pengukuran SOMA**. Laporan test seharusnya memuat alasan `rejected`, gap antarfame, displacement mentah vs filtered, dan jumlah cap. Telemetry perlu mampu menjawab satu pertanyaan: **apakah garis hilang sebelum tracker, dalam tracker, atau saat kompositor melukis?**

## 8. Kontrak UI dan status

Jangan memasang status “kaki belum terdeteksi” sebagai kesimpulan bahwa kanvas kosong. Pisahkan:

- `SourceStatus`: **aktif, pose tertunda, dijeda, source terputus, actor confidence rendah**;
- `PaintingStatus`: **Path A/B aktif, jumlah segmen historis, footprint aktif, Upper available**;
- `OutputStatus`: **Compose preview, Map output saved, QA projector, Blackout/LIVE**.

Saat mode Fullscreen, semua status/bantuan tetap berada di DOM studio tetapi tidak dirender ke finalRaster. Posisi toolbar dan tombol Bersihkan/PNG berada di luar bidang putih. Mode Split Debug memperlihatkan layer yang digunakan oleh final compositor, bukan engine rendering lain.

## 9. Integrasi kode: berkas yang diubah

| Lokasi | Perubahan utama |
|---|---|
| `src/footprints/lines/v3/PathObservationRouter.ts` | Tambahkan dukungan candidate estimator dan akumulasi displacement; hindari kehilangan gerak terus-menerus |
| `src/footprints/lines/v3/ActorPathTracker.ts` | Ubah threshold menjadi kumulatif/hysteresis; telemetry CUT dan event reason |
| `src/footprints/lines/v3/PathSplineFitter.ts` | Tetap spline centripetal; hindari overshoot saat belokan pendek |
| `src/footprints/lines/v3/PersistentPathStore.ts` | Pertahankan stores dan revision; pastikan STOP/CUT tidak menghapus tinta historis |
| `src/footprints/dual-trace/DualTraceV2Renderer.ts` | Defaults opacity, z-order, independent masks, pixel tests dan biaya cache |
| `src/footprints/lines/v3/PainterlyImpressionEngine.ts` | Clock dan provenance cap; tidak mereset Path |
| `src/studio/v3/LineTrailsV3.tsx` | Wiring trajectory engine bersama, status dan telemetry, raster final yang sama |
| `src/studio/v3/DualTraceCanvasHostV2.tsx` | Toolbar dipindahkan keluar kanvas; fullscreen clean |
| `src/studio/v3/DualTraceControlsV2.tsx` | Panel warna/lapisan ringkas dan diagnostics drawer |

**Modul baru yang disarankan:**

- `src/footprints/lines/v3/GroundTrajectoryEngineV2.ts` — state machine posisi per aktor.
- `src/footprints/lines/v3/TrajectoryFusion.ts` — pemilihan support/dual-foot/torso.
- `src/footprints/lines/v3/TrajectoryTelemetry.ts` — counters dan replay traces.
- `tests/ground-trajectory-v2.test.ts` — fixture analitis.
- `e2e/dual-trace-v21-path-continuity.spec.mjs` — pixel dan kontrol.

## 10. Test plan yang bisa dieksekusi

### 10.1 Unit tests

1. 40 frame perpindahan aktor masing-masing 1–2 px: ADD muncul setelah akumulasi cukup, bukan 40 kali STOP.
2. 60 frame aktor diam: tidak ada tinta tambahan setelah STOP.
3. Pivot 90° yang bertahap: satu kurva dengan TURN; tidak membuat teleport.
4. Identity swap/occlusion: keluarkan CUT, jangan sambung posisi A ke B.
5. MP4 timestamp reverse/seek: segmen lama terpotong, tidak ada cap ganda.
6. Tiga basis koordinat: image 2D, calibrated floor, virtual floor; tidak ada double homography.
7. Layer independence: hilangnya seluruh Footprint mask tidak mengubah Path mask.
8. Recolor historis: warna berubah, geometri dan jumlah knot sama.

### 10.2 Browser/pixel tests

- Jalankan fixture dua garis dengan 20 cap di atasnya. Bandingkan pixel Path sebelum dan setelah cap fade.
- Nyalakan/matikan Upper; pixel Path tetap pada geometri yang sama.
- Tukar `foot-on-top` ↔ `upper-on-top`; area perpotongan berubah tanpa posisi titik bergeser.
- Bandingkan `ComposeFinalRaster` dengan sumber Map sebelum projector warp.
- Periksa fullscreen tanpa tombol/operator text pada output pixel.
- Verifikasi Blackout output fisik tetap mengikuti gate lama.

### 10.3 QA panggung/video

MP4 lateral dan crossing dari kamera statis 16:9 dipakai sebagai benchmark; anotasi lokasi aktor minimal pada titik awal, beberapa belokan, dan akhir. Bandingkan panjang, arah, dan jumlah CUT. Kamera HP landscape dan kamera overhead diuji terpisah. **Perangkat dan raw MP4 belum diuji dalam penulisan rancangan ini.**

## 11. Urutan pengerjaan dan rollback

| Tahap | Pekerjaan | Gate |
|---|---|---|
| M0 / P0 | Rekam telemetry pada renderer lama, siapkan fixture MP4 dan sintetis | Ada baseline yang bisa dibandingkan |
| M1 / P0 | GroundTrajectoryEngineV2 + accumulator + dua aktor | Unit tests movement/STOP/CUT lulus |
| M2 / P0 | Sambungkan ke Path Sumi dan Dual Trace | Fixture yang sama menghasilkan trajectory setara |
| M3 / P0 | Verifikasi atlas Path/Footprints/Upper, opacity dan output final | Pixel tests + Blackout lulus |
| M4 / P1 | Pisahkan UI source versus painting state, bersihkan kanvas | E2E fullscreen dan status lulus |
| M5 / P1–P2 | Sesuaikan sapuan Sumi, uji MP4/kamera dan perf | QA visual dan profiling dicatat |

Gunakan feature flag `trajectoryEngine: 'legacy' | 'ground-v2'` pada masa migrasi. **Jangan mengganti gate fisik, koordinat Track, atau transform Map ketika memperbaiki Path.** Jika tes regresi gagal, kembalikan trajectory ke legacy, bukan menghapus jejak pengguna.

## 12. Definition of Done

- P0 telemetry menunjukkan dengan jelas posisi hilangnya setiap segmen.
- Lintasan kedua aktor mengikuti perpindahan yang diamati dan tetap terlihat ketika cap kaki memudar.
- STOP dan CUT tidak menghasilkan noda berulang atau garis silang palsu.
- Upper bersifat tambahan, dengan spatial anchor dan opacity yang dapat diuji.
- Satu raster final masuk Compose/Map/Perform, dan Blackout tetap aman.
- Tes unit/build/browser lulus. Hasil QA perangkat fisik dicatat terpisah.

**Status dokumen:** arsitektur untuk perubahan berikutnya. Tidak mengandung klaim implementasi ataupun deployment.