# SOMA — Ground Trajectory Engine V2.2
## Technical Specification: Actor-Centered Foot + Hip Fusion

**Tanggal:** 23 November 2026  
**Status:** Proposed / planning, belum diimplementasikan  
**Cakupan:** Track → Compose (Path Sumi dan Dual Trace) → Map → Perform  
**Repo acuan:** pangarsagulangsatriya-prog/soma-motion-studio, main (audit 23 November 2026)  
**Input benchmark:** Two_performers_navigating_rehear…_d7f04e2d(1).mp4  
**Dokumen terkait:** SOMA_DUAL_TRACE_V21_PATH_CONTINUITY_PRD.md; SOMA_DUAL_TRACE_V21_TECHNICAL_ARCHITECTURE.md.

> **Keputusan:** gunakan satu aliran pose yang telah disetujui untuk menghasilkan lintasan aktor, jejak telapak, dan pengaruh gestur atas tubuh. Garis perjalanan dapat memanfaatkan perubahan posisi pinggul saat satu telapak hilang. Cap telapak tetap mensyaratkan bukti kaki/kontak yang layak. Tidak ada pose detector kedua, klaim 3D palsu, atau garis penghubung melintasi identity ambiguity.

---

## 1. Kriteria benchmark dan fakta sumber

### 1.1 MP4 yang diperiksa
- Resolusi 640 × 360; 24 FPS; 360 frame; durasi 15,04 detik (ffprobe).
- Dua aktor bergerak saling mendekat sekitar detik 0–3, berpapasan sekitar detik 3–4, kemudian membelok/bergerak memutar sekitar detik 4–7.
- Keduanya relatif diam sekitar detik 8–15. Path yang sudah dibuat harus tetap terlihat; jangan menghasilkan noda baru hanya karena render loop.
- Di dalam gambar video sudah terlihat cap kaki warna-warni. Itu piksel dari input MP4, **bukan** ground truth koordinat yang ditangkap SOMA; jangan menggunakan pencocokan warna/pola cap dalam video sebagai bukti tracking.
- Pada screenshot UI, SOMA melaporkan “MP4 · 2 kaki terbaca” ketika dua tubuh terlihat. Angka tersebut menghitung sampel kaki terfilter pada frame, bukan jumlah tubuh atau jaminan satu kaki per aktor.
- Kamera tinggi, pencahayaan putih, tubuh mendekat dan berpapasan; tumit, ujung kaki dan pergelangan dapat memiliki confidence rendah. Ini tantangan video, tetapi lintasan pusat tubuh masih terlihat secara visual.

### 1.2 Hasil karya yang ditargetkan
- Dua garis A/B meluas mengikuti perjalanan aktor pada detik 0–7, termasuk belokan.
- Garis menetap di sekitar detik 8–15 walaupun kedua aktor berhenti.
- Cap kaki mengikuti posisi kaki yang valid, boleh menimpa garis dan memudar sesuai parameter (awal 6 s).
- Kepala/bahu memodulasi sapuan utama, dengan aksen terpisah opsional yang tetap terikat ke aktor.
- Tidak ada garis panjang yang mendadak melompat atau tertukar ketika crossing.

### 1.3 Pembatasan data
Benchmark MP4 dapat mengungkap geometri gerak; video tersebut tidak menyediakan ground truth 3D, tekanan kontak fisik, maupun rekaman keypoint per frame dari SOMA. Nilai threshold pada spesifikasi ini adalah **nilai awal untuk diuji**, bukan angka akurasi yang telah terbukti.

## 2. Diagnosis implementasi terkini

| Modul | Kondisi terverifikasi di kode | Konsekuensi |
|---|---|---|
| SourceFrameNormalizer.ts | MP4 memfilter snap.people menjadi array sampel kaki melalui resolvePoseFeet; hasil penuh pose tubuh tidak menjadi input GroundTrajectoryEngine | Pose dua tubuh bisa tersedia, tetapi satu atau dua aktor tidak mempunyai titik jalur ketika kaki hilang |
| FootPositionResolver.ts | Heel + toe perlu visibility ≥0,55; fallback ankle ≥0,72 sebelum dikurangi kepercayaan | Sebagian kaki tampak di video namun tidak masuk input renderer |
| PathObservationRouter.ts | Memerlukan paling sedikit satu sampel kaki per aktor; cabang single-foot memakai perpindahan kaki terbatas ×0,12 | Gerak 1 kaki mudah menjadi gumpalan pendek; 0 kaki tidak punya observasi sama sekali |
| ActorPathTracker.ts | ADD/TURN butuh perubahan ≥4 px dari knot terakhir; CUT pada gap/source/teleport | Koreksi di tracker saja tidak mengatasi data pusat gerak yang hilang |
| DualTracePoseFrameBus.ts | Sudah mempunyai frame pose lengkap 33 landmark dari snapshot/video dan Track/live, saat identity stabil | Data pinggul tersedia untuk dipakai ulang, tanpa model baru |
| UpperStageAnchorMapper.ts | Upper memerlukan observasi jalur di frame yang sama | Bila kaki tidak menghasilkan observasi, Upper juga bisa kehilangan anchor |
| PainterlyImpressionEngine.ts | Cap dari contact event atau estimasi langkah dengan pemeriksaan excursion/dwell | Harus tetap terpisah dari fallback pinggul |
| DualTraceV2Renderer.ts | Atlas Path/Upper/Footprint terpisah dan ditumpuk dalam final raster | Pertahankan; perbaikan utama berada sebelum proses gambar |
| SourceFrameNormalizer.ts | Pose MP4 dengan media/pose lag absolut >320 ms tidak diterima; seek ditangani terpisah | Jangan menggunakan snapshot pose lama untuk menyambung path |

**Masalah inti:** GroundTrajectoryEngine sekarang menerima FootBrushPose[]; pinggul tidak ikut masuk meski snapshot pose tubuh tersedia. Memperbesar brush menjadi 36–42 px tidak dapat menumbuhkan perjalanan yang belum pernah dikirim sebagai event.

## 3. Ruang lingkup dan non-goals

### In scope
1. Satu kontrak data per aktor/frame mencakup kaki, pinggul, confidence, identity, source, frame dan kalibrasi.
2. Adaptive ground trajectory estimator: dua kaki, satu kaki + pinggul, kehilangan kaki singkat + pinggul.
3. Pembedaan observasi sah, estimasi provisional, dan status unavailable.
4. Pemisahan motion path dari footprint/stamp.
5. Status per aktor dan telemetry yang bisa dipakai membuktikan apakah garis benar-benar tumbuh.
6. Regresi bersama Path Sumi V3.5 dan Dual Trace V2; output tetap satu komposit FLOOR.

### Out of scope
- Melatih ulang/mengganti model deteksi pose; menambahkan detector atau kamera kedua.
- Menganggap posisi pinggul di gambar sebagai koordinat lantai fisik.
- Menghasilkan cap kaki dari posisi pinggul ketika tidak ada data telapak.
- Menyelesaikan identity tracking yang ambigu dengan tebakan lintas aktor.
- Mengubah Map, mode QA fisik, Blackout, atau melakukan deploy Vercel.
- Menarik jalur dari gambar tapak yang sudah tercetak di video.

## 4. Pipeline target

~~~mermaid
flowchart TD
 S[MP4 / Webcam / HP / Simulator] --> N[Existing approved pose snapshot]
 N --> F[ActorMotionFrameBuilder]
 F --> A[Actor identity A/B and confidence]
 A --> T[ActorGroundTrajectoryEstimator V2.2]
 T --> E[PathEvents START ADD TURN STOP CUT]
 F --> C[Foot contact / sole events]
 F --> U[Upper motion features]
 U --> M[BrushDynamics on the same actor path]
 E --> M
 M --> R[Actor path atlas A/B]
 C --> P[Footprint atlas A/B with fade]
 R --> X[Layer Compositor]
 P --> X
 X --> O[One clean 1600x900 raster]
 O --> D[Compose / PNG / Map / Perform]
~~~

- Tidak ada inference ulang untuk kepentingan Path. Sumber pose yang sudah approved dipakai oleh semua konsumen.
- Perubahan source, klip, resolusi, media seek, camera-floor profile atau identity epoch menutup segmen yang tidak kompatibel.
- **Camera → floor** hanya di satu Spatial Engine pada Track. **Floor → projector** tetap hanya di Map.

## 5. Kontrak data V2.2

Semua koordinat gambar diolah ke stage-image yang sama (1600 × 900) lewat adapter yang **sama**; jangan mencampur landmark mentah 640 × 360, image UV, letterboxed stage UV, atau floor meters.

~~~ts
type ActorId = 'A' | 'B';
type EvidenceLevel = 'observed' | 'estimated' | 'provisional' | 'unavailable';
type MotionBasis =
  | 'dual-foot-and-hip'
  | 'one-foot-hip-assisted'
  | 'hip-short-gap'
  | 'foot-only-low-confidence'
  | 'unavailable';

type Point = { x: number; y: number };
type ObservedFoot = {
  side: 'left' | 'right';
  heelPx?: Point;
  toePx?: Point;
  anklePx?: Point;
  centerPx: Point;
  confidence: number;
  contactHint: 'contact' | 'swing' | 'pivot' | 'unknown';
  contactConfidence: number;
};

type ActorMotionFrame = {
  actorId: ActorId;
  sourceKey: string;
  sourceEpoch: number;
  clipStableId: string;
  frameAtMs: number;            // pose timestamp (one accepted snapshot)
  presentationMs: number;       // media/source presentation clock
  identityConfidence: number;
  poseConfidence: number;
  hipsImagePx?: Point;          // midpoint indices 23 and 24 if reliable
  torsoScalePx?: number;        // e.g. shoulder-hip span for adaptive limits
  shoulderVector?: Point;
  headImagePx?: Point;
  feet: Partial<Record<'left'|'right', ObservedFoot>>;
  calibratedFloorId?: string;
};

type ActorGroundState = {
  actorId: ActorId;
  lastConfirmedGroundPx?: Point;
  lastValidHipPx?: Point;
  lastGroundImageAnchorPx?: Point;
  lastAcceptedFrameMs?: number;
  basis: MotionBasis;
  confidence: number;
  missingFootSinceMs?: number;
  provisional: Array<{ atMs: number; pointPx: Point; confidence: number }>;
  displacementResidualPx: Point;
  pathEpoch: number;
};

type ActorTrajectoryOutput = {
  actorId: ActorId;
  pointPx?: Point;              // canonical stage/floor-view point
  basis: MotionBasis;
  confidence: number;
  commit: boolean;              // only confirmed/validated points persist
  cutReason?: string;
  footContacts: Array<{ side:'left'|'right'; pointPx:Point; confidence:number }>;
};
~~~

### Compatibility
- V3Input boleh diberi field optional actorFrames: ActorMotionFrame[] dengan default [].
- FootV3Sample, PathEvent, PainterlyImpression, DualTraceV2Renderer dan render contract lama tetap bisa dipakai.
- ActorMotionFrame dibangun dari frame yang sama yang kini dipakai dualTracePoseFrames; jangan memanggil model sekali lagi atau mengganti identity A/B di adapter kedua.
- Bila actorFrames tidak tersedia, fallback ke V2.1 (flag), dengan label kualitas terbatas.

## 6. State machine estimator

| Kondisi | Sumber jalur | Perilaku | Tingkat bukti |
|---|---|---|---|
| 2 kaki valid + hip valid | Foot pair/support + perpindahan pinggul | Fusi stabil dan re-anchor perlahan | observed/estimated 2D |
| 2 kaki valid, hip hilang | Foot pair/support only | Perilaku V2.1 dengan confidence diturunkan | estimated |
| 1 kaki valid + hip valid | Hip displacement utama, foot displacement terbatas | Lanjut lintasan actor-centered, tanpa mengejar kaki ayun | estimated |
| 1 kaki valid, hip hilang | Kaki tunggal + hint kontak bila ada | Batasi perkembangan; potong bila data terus ambigu | low confidence |
| 0 kaki, hip valid dan identity stabil | Hip displacement lokal, waktu sangat singkat | Buffer provisional, belum langsung menjadi tinta permanen | provisional |
| 0 kaki, hip hilang / identity ambigu | Tidak ada | STOP/CUT sesuai waktu; tidak menebak jalur | unavailable |
| source/epoch berganti atau seek | Tidak boleh digabung | CUT dan reset state/temporary buffer | reset |

**Aturan batas awal (tunable):**
- Hip harus valid dari keypoint 23/24 pada frame yang sama, visibility tiap titik awal ≥0,55 dan identityConfidence awal ≥0,65.
- Ketika satu kaki tersedia, berat awal gerak pinggul 0,70 dan kaki 0,30, hanya jika perubahan kaki tidak didominasi swing/pivot. Bobot disesuaikan oleh confidence, kualitas support, dan konsistensi gerak.
- Ketika kedua kaki tersedia, foot/support movement menjadi rujukan utama; hip bertugas memeriksa drift/direction dan menjaga kontinuitas.
- Ketika 0 kaki, buffer hip-only maksimal **250 ms atau enam frame pada 24 FPS**, mana yang lebih dulu. Tidak ada cap telapak. Tidak ada committed ink selama buffer belum tervalidasi.
- Saat identitas A/B ambigu, buffer hip-only dibuang; penutupan jalur mengikuti aturan CUT lama.
- Lompatan posisi diukur terhadap **skala torso dan durasi frame**, bukan ambang piksel tunggal yang sama untuk semua jarak kamera.

Semua nilai di atas memerlukan tuning memakai hasil uji. Jangan menyimpan angka tersebut sebagai konstanta UI yang tidak bisa diubah.

## 7. Algoritme estimator langkah demi langkah

### 7.1 Validasi input
1. Terima satu approved pose snapshot per frameAtMs, sourceKey, clipStableId dan actorId.
2. Pastikan timestamp monoton untuk sesi normal; pause tidak menghasilkan deposit baru; seek/CUT memulai epoch baru.
3. Pasangkan 33 landmark, kaki hasil FootPositionResolver, dan contact hints dari snapshot yang sama.
4. Validasi hip (keypoint 23 dan 24), torso scale dan identity; jangan mengisi koordinat yang hilang dengan nol.
5. Klasifikasikan frame menjadi DUAL_FOOT, SINGLE_FOOT, HIP_GAP, atau UNAVAILABLE, plus level confidence.

### 7.2 Estimasi perpindahan 2D dari pinggul

~~~text
deltaHipPx = hipNowImagePx - hipPrevImagePx
deltaSupportPx = stableFootOrPairNow - stableFootOrPairPrev

DUAL_FOOT:
  displacement = adaptiveBlend(deltaSupportPx, deltaHipPx, footTrust, hipTrust)
  correctionToObservedSupport = boundedSlowReanchor(...)
SINGLE_FOOT with reliable hip:
  displacement = 0.70 * deltaHipPx + 0.30 * bounded(deltaFootPx)
  if foot is likely swinging: lower foot weight toward 0
HIP_GAP:
  displacement = bounded(deltaHipPx), marked provisional
  commit only after a valid reliable observation reconciles the short gap
UNAVAILABLE:
  no displacement; terminate pending provisional ink
~~~

**Jangan memakai koordinat absolut pinggul sebagai ground point.** Pinggul bergerak jauh di atas bidang lantai di gambar miring. Gunakan perubahannya untuk menggerakkan *ground anchor aktor yang sebelumnya sudah valid*.

### 7.3 Sistem koordinat dan floor homography

**Mode image-2D tanpa kalibrasi:**
- Semua delta gambar dinormalisasi ke stage-imagePx (1600 × 900) dengan satu adapter letterbox/unmirror.
- Ground anchor awal diambil dari posisi support/foot pair ketika valid.
- Hip delta menggerakkan anchor pada stage-imagePx. Status harus menunjukkan “Jalur diperkirakan · 2D”.

**Mode calibrated-floor:**
- Awal anchor harus berasal dari titik kaki pada bidang lantai yang masuk kalibrasi Track.
- Jangan memproyeksikan titik pinggul langsung melalui cameraGroundToFloor(); fungsi itu menerima titik yang diasumsikan berada di plane lantai.
- Untuk hilangnya kaki sesaat, perkirakan perpindahan **lokal** lewat Jacobian homography pada *ground image anchor* yang terakhir sah, diterapkan pada delta hip kamera; batasi jarak/waktu. Hasil diberi label projection-estimate.
- Saat kaki kembali valid, re-anchor bertahap ke titik lantai yang benar. Kalau selisih besar, CUT alih-alih membuat jembatan panjang.
- Bila actor keluar bidang lantai terkalibrasi, hentikan output metric; jangan clamp ke pinggir kanvas.
- Seluruh kanal path/footprint/gesture memakai transform yang sama; floor-to-projector diterapkan satu kali di Map.

### 7.4 Koreksi drift dan keterikatan cap kaki
- Footprints menggambarkan posisi **masing-masing** kaki; Path mengikuti pusat perjalanan tubuh. Selisih lateral kiri/kanan ketika berjalan wajar.
- Saat kaki terkonfirmasi kembali, koreksi pusat Path secara bertahap. Jangan snap posisi Path tiba-tiba ke satu tapak.
- Tentukan koridor visual Path dari lebar kuas dan panjang telapak; overprint hanya terjadi di perpotongan yang nyata.
- Jangan menggambar sambungan dekoratif menuju cap yang terlalu jauh. Catat sebagai path-to-stamp error.
- Cap baru hanya dari FootMotionEvent contact yang valid atau estimasi langkah dengan excursion+dwell yang telah lolos engine saat ini. Status dibedakan “kontak estimasi” dari “kontak terukur”.
- Dua atlas tetap terpisah: Path menetap sampai Clear; Footprints memudar menurut presentation clock (awal 6 s).

### 7.5 Crossing dan identitas
- Gunakan actorId stable hasil approved multi-person router. Jangan memasangkan aktor hanya karena jarak antar titik kecil.
- Saat A/B overlap, turunkan bobot observasi yang teroklusi dan pertahankan state per actor dengan tanda confidence.
- Jika router mengatakan ambiguous, jangan menukar A/B ataupun melakukan interpolasi antar posisi dua aktor; tahan/CUT sesuai gate.
- Setelah identity pulih, mulai START baru jika gap atau jarak melebihi ambang; tanpa jembatan garis antarpersona.

### 7.6 Provisional segment dan aturan commit
- HIP_GAP menghasilkan temporary points pada buffer per actor (maksimal 250 ms/6 frame).
- Renderer preview boleh menampilkan segmen provisional dengan visual berbeda **di mode debug saja**. Raster Perform yang bersih tidak boleh menganggapnya tinta historis final.
- Setelah foot evidence kembali, hitung jarak residual ke anchor yang diobservasi. Jika dalam gate, commit segmen tervalidasi lalu lanjut ADD/TURN; jika melompat, buang buffer dan CUT.
- Buffer provisional wajib hilang pada seek, source switch, pause, identity ambiguity, lost confidence dan user Clear.
- Jangan memakai interpolasi halus untuk melintasi kehilangan identitas.

### 7.7 Deteksi STOP dan stabilitas tinta
- Akumulasi perpindahan kecil harus diperhitungkan untuk kondisi berjalan lambat.
- STOP terjadi setelah pusat perjalanan benar-benar diam selama jendela waktu (awal 300 ms), tanpa menambah deposit tinta setiap frame.
- Saat frame baru tidak datang, jangan memanggil ADD dari requestAnimationFrame; render ulang raster lama saja.
- Setelah aktor diam sejak ~detik 8 pada benchmark, jumlah START/ADD/TURN dan panjang Path seharusnya stabil.

## 8. Pseudocode referensi

~~~ts
function onApprovedPoseSnapshot(snapshot: ApprovedSnapshot) {
  if (snapshot.seeking || snapshot.sourceChanged) {
    cutAndResetAllSegments('source-or-seek');
    return;
  }
  for (const actor of ['A', 'B'] as const) {
    const frame = buildActorMotionFrame(snapshot, actor); // ONE pose source
    if (!frame || !identityStable(frame)) {
      estimator.closeOrHold(actor, 'identity-ambiguous');
      continue;
    }
    const prior = estimator.getState(actor);
    const state = classifyEvidence(frame);
    const delta = state === 'DUAL_FOOT'
      ? fuseFeetAndHip(prior, frame)
      : state === 'SINGLE_FOOT'
      ? integrateHipAssistedFoot(prior, frame)
      : state === 'HIP_GAP'
      ? integrateProvisionalHip(prior, frame)
      : null;

    const candidate = estimator.integrate(actor, delta, frame);
    const outcome = estimator.validateAndReconcile(candidate, frame);

    if (outcome.cutReason) pathTracker.cutActor(actor, outcome.cutReason);
    for (const event of outcome.committedPathEvents) pathAtlas.ingest(event);

    for (const contact of acceptedFootContacts(frame))
      footprintAtlas.ingest(contact); // NEVER from hips
    brushDynamics.update(actor, upperMotionFeatures(frame));
  }
  compositor.publishOneCleanRaster();
}
~~~

Pseudocode menggambarkan kontrak akhir; beberapa API baru perlu ditambahkan dan disesuaikan dengan API PathEvent/PersistentPathStore yang sudah ada.

## 9. Perubahan modul yang direncanakan

| ID | File/modul | Perubahan | Risiko |
|---|---|---|---|
| GT22-01 | SourceFrameNormalizer.ts | Teruskan actorFrames/approved full pose bersama foot samples; status per actor | Risiko clock/source mismatch |
| GT22-02 | ActorMotionFrameBuilder.ts (baru) | Satukan kaki, hip 23/24, torso scale, confidence, source/epoch | Risiko transform berbeda antar sumber |
| GT22-03 | ActorGroundTrajectoryEstimator.ts (baru) | State machine DUAL/SINGLE/HIP_GAP/UNAVAILABLE, bounded hip delta | Risiko path drift/false bridge |
| GT22-04 | SpatialHipDeltaProjector.ts (baru) | Image-2D dan local floor homography displacement; no hip-as-ground | Risiko perspective |
| GT22-05 | GroundTrajectoryEngineV2.ts | Terima ActorMotionFrame dan compatibility fallback V2.1 | Risiko regresi Path Sumi |
| GT22-06 | PathObservationRouter.ts / ActorPathTracker.ts | Hilangkan hardcoded ×0,12 sebagai jalur tunggal; hysteresis/commit buffering | Risiko jitter |
| GT22-07 | UpperStageAnchorMapper.ts | Gunakan common actor ground track, bukan bergantung pada foot event frame identik | Risiko upper drift |
| GT22-08 | PainterlyImpressionEngine.ts | Pertahankan contact-only stamps; gabungkan quality labels tanpa membuat cap dari hip | Risiko cap palsu |
| GT22-09 | DualTraceV2Renderer.ts / LineTrailsV3.tsx | Sinkronisasi committed path/upper, clean output; tidak memutus tinta saat leg drop singkat | Risiko sinkron render |
| GT22-10 | TrajectoryTelemetry.ts / DualTraceControlsV2.tsx | Status A/B per kaki + tingkat bukti/line length/gap/drop | Risiko UI terlalu ramai |
| GT22-11 | tests + e2e | Fixtures, deterministic pixel snapshots, MP4 benchmark, crossing, projector | Risiko tes hanya source string |
| GT22-12 | Feature flag | 'v2.1' atau 'hip-fusion-v2.2', rollback dan profiling | Risiko default berubah dini |

Urutan mulai: GT22-01/02 → 03/04 → 05/06 → 07/08/09 → 10/11 → 12/rilis.

## 10. Information hierarchy UI operator

**Track:** tampilkan “2 aktor terdeteksi” terpisah dari “2 dari 4 kaki terbaca”; per actor A: kiri/kanan, B: kiri/kanan. Jangan mengartikan dua kaki sebagai dua aktor atau bukti bahwa keduanya mempunyai kaki valid.

**Compose:** satu baris sederhana:
- “A: jalur dari 2 kaki” / “A: jalur dibantu pinggul” / “A: menunggu pose”
- “B: ...”
- “Garis A 245 px · B 210 px” di Detail Diagnostik, sebagai nilai nyata saat runtime; jangan tampilkan contoh angka ini sebagai nilai produksi.
- “108 deposit” dipindah menjadi diagnostik, bukan indikator keberhasilan lintasan.
- Status pose terkini dan “tinta historis tersimpan” tetap berbeda.

**Map/Perform:** memakai satu raster bersih. Tidak boleh memperlihatkan skeleton, proxy hip, text telemetry, maupun provisional debug line pada output fisik.

## 11. Telemetry dan audit akar masalah

Ekspor log per source frame/actor untuk benchmark lokal (JSON/CSV opt-in):
- sourceKey, frameAtMs, presentationMs, sourceEpoch, actorId, identityConfidence.
- validFeetCount dan L/R validity; hipConfidence; poseConfidence; motionBasis.
- foot displacement, hip displacement, output displacement, cumulative pathLengthPx.
- estimate/observed/provisional counts, ADD/TURN/STOP/CUT counts dan cutReason.
- renderRevision, pathAtlasRevisions, footprint count, outputRaster timestamp.
- driftToFootCorridorPx dan gapDurationMs.
- source sync lag; stopped vs moving.
- Debug log tidak disimpan otomatis sebagai file yang memuat video, wajah atau identitas; ekspor hanya pada tindakan operator.

Tambahkan reproducer otomatis yang mengeluarkan plot XY A/B dan frame-by-frame status di test report. Plot lintasan lebih penting untuk QA gerak daripada menghitung jumlah deposit brush.

## 12. Matriks pengujian

### Unit dan property tests
1. Dua kaki + hip valid: pusat bergerak lateral, maju/mundur, turning, tanpa zigzag dari swing.
2. Satu kaki + hip valid: output bergerak secara bounded, arah sesuai hip, tidak mengejar kaki ayun.
3. 0 kaki + hip valid 100–250 ms: provisional, tidak ada footprint; saat recovered commit jika selaras.
4. 0 kaki lebih lama atau identity ambiguous: buffered estimates discard, CUT; tidak bridge.
5. Hip hilang sementara dua kaki valid: gunakan jalur foot-only V2.1 secara aman.
6. Pinggul dan kaki tidak valid: no ADD, no stamped footprint.
7. Kaki kiri/kanan menyilang: jangan mengubah actorId A/B.
8. Footprint dan Path: pewarnaan, waktu, opacity, Clear independen.
9. Calibrated camera: kalibrasi dipakai pada ground contact; tidak pernah memproyeksikan pixel hip absolut sebagai ground.
10. Source switch, seek mundur, pause, phone reconnect, metadata profile changed: CUT/restart, no stale connection.
11. 1P / 2P / MP4 / webcam / HP / simulator: jalur kompatibel.
12. Color/palette change: historical ink recolor tanpa regenerasi pose.

### Golden MP4 15,04 detik — anotasi dan screenshot
Gunakan timestamp 0, 1, 2, 3, 4, 5, 6, 7, 8, 10 dan 14 detik. Tambahkan titik referensi **pusat perjalanan aktor secara manual** pada video sumber di interval 0,5–1 detik sebagai pembanding kasar. Cap yang tercetak dalam video boleh digunakan sebagai referensi artistik, tetapi tidak sebagai hasil deteksi pose.

**Harus terlihat:**
- Sekitar detik 0–3: dua stroke berjalan menuju titik temu.
- Detik 3–4: tidak ada loncatan identitas atau satu stroke menyambung A ke B.
- Detik 4–7: kedua stroke membentuk belokan/kurva sesuai perjalanan aktor.
- Detik 8–14: panjang Path historis tetap stabil, tanpa penambahan noda saat diam.
- Cap telapak di output dibentuk oleh contact engine, bukan diambil dari piksel tapak pada MP4.
- Warna A dan B tetap terpisah; PNG dan Map preview membaca raster final yang sama.

### Acceptance gate yang diusulkan (perlu baseline manual)
- Pada frame dengan hip valid dan identity stabil, estimator menghasilkan observasi actor-centered pada ≥85% frame; yang tidak valid diberi label jelas.
- Median deviasi jalur terhadap titik referensi tubuh yang dianotasi ≤0,6 lebar torso di video yang sama (berbasis image-2D, bukan meter fisik).
- Tidak ada garis yang menghubungkan dua actorId berbeda, meskipun crossing.
- Tidak ada cap baru selama 0 kaki valid tanpa contact event.
- Setelah aktor berhenti, pertambahan jarak Path dari jitter < satu panjang telapak selama sisa adegan.
- Untuk cap dari langkah yang valid, ≥85% berada dalam koridor maksimal satu panjang telapak dari jalur actor yang benar pada jendela waktu terkait. Jarak kiri/kanan wajar; jangan memaksa semua tapak jatuh tepat di tengah garis.
- MP4 scrub/seek ulang menghasilkan output deterministik tanpa deposit berganda.
- Preview Compose, saved PNG dan pre-warp Map memakai pixel-equivalent finalRaster, memperhitungkan kesesuaian waktu.
- Build TypeScript, unit, browser E2E dan pixel golden test lulus sebelum GitHub Pages/Vercel promotion.
- Sasaran runtime awal ≥24 frame visual per detik pada benchmark 24 FPS / 1600 × 900; audit FPS sumber pose dan kompositor terpisah sebelum mengklaim tercapai.

## 13. Release dan rollback

1. GT22-01/02 terlebih dahulu, instrument source counts dan actor frames; jangan langsung mengubah default visual.
2. Implement hip fusion di balik internal feature flag; jalankan A/B comparison dengan V2.1 menggunakan MP4 identik.
3. Nilai kualitas geometrinya pada plot Path A/B, baru lanjut material kuas.
4. Periksa Save/Load V2; jangan mengirim penyimpanan lama yang tidak kompatibel sebagai berhasil.
5. CI wajib menjalankan unit, E2E browser dan pixel comparison. Deployment berhasil tidak cukup tanpa visual QA.
6. Setelah lulus, staging/GitHub Pages lebih dulu. Vercel production hanya bila diperintahkan.
7. Rollback: ganti feature flag ke 'v2.1', jangan menghapus arsip lukisan atau kalibrasi yang sudah ada.
8. Physical projector QA dilakukan terpisah, dengan Blackout aktif sampai operator memeriksa cahaya fisik.

## 14. Definisi selesai

- Video benchmark menghasilkan dua lintasan perjalanan yang dapat dibaca dan tetap tersimpan.
- Saat satu kaki hilang, garis masih mengikuti gerak tubuh pada data yang cukup stabil.
- Saat dua kaki hilang singkat, jalur provisional tidak berubah menjadi tinta permanen tanpa validasi.
- Crossing A/B tidak tertukar; pause/seek tidak menambah garis palsu.
- Posisi Footprint tetap berasal dari observasi/contact kaki dan boleh menimpa Path.
- Upper gesture termanifestasi sebagai modulation yang terukur terhadap sapuan utama, tanpa menggambar dua lukisan terpisah.
- Telemetry menampilkan status sumber dan perkembangan Path secara jujur.
- Unit, browser, pixel fixtures, Map–Perform clean raster dan Blackout lulus, serta benchmark dicatat.

## 15. Referensi kode yang diperiksa

- src/footprints/lines/v3/SourceFrameNormalizer.ts
- src/footprints/lines/v3/FootPositionResolver.ts
- src/footprints/lines/v3/FootBrushPoseAdapter.ts
- src/footprints/lines/v3/PathObservationRouter.ts
- src/footprints/lines/v3/ActorPathTracker.ts
- src/footprints/lines/v3/GroundTrajectoryEngineV2.ts
- src/footprints/lines/v3/TrajectoryFusion.ts
- src/footprints/lines/v3/TrajectoryTelemetry.ts
- src/footprints/spatial/coordinates.ts
- src/footprints/dual-trace/DualTracePoseFrameBus.ts
- src/footprints/dual-trace/UpperStageAnchorMapper.ts
- src/footprints/dual-trace/DualTraceV2Renderer.ts
- src/footprints/lines/v3/PainterlyImpressionEngine.ts
- src/studio/v3/LineTrailsV3.tsx
- src/studio/v3/VideoSpatialCalibration.tsx

**Catatan status:** Tech Spec V2.2 disimpan sebagai dokumen perencanaan. Penyimpanan dokumen tidak mengubah aplikasi, implementasi tracking, atau deployment.
