# SOMA — Garis BETA V3: Technical Architecture
**Dual-Foot Trajectory / Tracking, Timing, Rendering, QA**

- Status: PROPOSED — belum ada implementasi atau penggantian engine aktif.
- Tanggal: 23 November 2026.
- Kode sumber yang diaudit: main, commit 3003b9a4865517cec1282222abd64bd8bab72c6f.
- PRD: [SOMA_GARIS_BETA_V3_DUAL_FOOT_TRAJECTORY_PRD.md](./SOMA_GARIS_BETA_V3_DUAL_FOOT_TRAJECTORY_PRD.md).
- Kompatibilitas: Line Trails V2, Track, Camera Hub, F3, Map, Perform, blackout fisik.

## 1. Prinsip arsitektur

1. **Source frame authoritative.** Data dari detector milik Track/MP4 tetap satu sumber. V3 tidak membuka kamera atau model AI kedua.
2. **Satu track per aktor per kaki.** Identitas key menggunakan sourceSession, generation, actorId dan foot. Bukan satu brush aktif per performer.
3. **Dua domain waktu dipisahkan.** Media video time menentukan urutan frame; performance clock menentukan usia frame live dan scheduling UI. Seluruh fade dan replay harus memakai clock yang didefinisikan jelas.
4. **Geometri observasi didahulukan.** Simpan raw point, kualitas, dan provenance. Filter tidak menimpa data mentah.
5. **Jalur selalu diputus pada ketidakpastian.** Kaki hilang, frame mundur, seek, ambiguity, lompatan atau basis koordinat berubah → segmen terpisah.
6. **Proyeksi fisik tidak berubah.** Seluruh garis V3 tetap software Compose preview sampai sistem Map/Perform yang ada menyatakan output valid. Event terestimasi tidak membuka gate fisik.
7. **Satu jalur render untuk preview/fullscreen.** Perbedaannya hanya viewport, density dan opsi debug overlay.

## 2. Diagram alur data

~~~mermaid
flowchart TD
  C[Track camera / USB / HP via Track] --> S[Source Frame Adapter]
  M[MP4 VideoPoseGaitEngine snapshots] --> S
  D[DEMO synthetic fixtures] --> S
  S --> N[Normalized Foot Observation]
  N --> I[Identity & Frame Quality Gate]
  I --> R[Foot Position Resolver]
  R --> T[Dual-Foot Trajectory Engine]
  T --> V[Trajectory View Model]
  V --> P[Compose Preview Renderer]
  V --> F[Clean Fullscreen Renderer]
  V --> Q[Raw / Filtered QA Panel]
  E[FootMotionEventV2 eligible contacts] --> K[Optional Pijakan Renderer]
  K --> P
  K --> F
  Q -. read only .-> R
  X[Existing Map / Perform / blackout gates] -. separate, unchanged .-> F
~~~

**Tidak ada jalur baru dari V3 menuju proyektor.** Node F adalah fullscreen software lokal saja.

## 3. Modul yang ada dan tindakan yang diperlukan

| Modul sekarang | Tindakan V3 |
| --- | --- |
| src/studio/v3/SurfaceComposer.tsx | Pertahankan tombol Garis BETA, pasang V3 melalui feature flag. UI default ringkas; expose Periksa jalur. |
| src/studio/v3/LineTrailsBeta.tsx | Pisahkan source polling, trajectory state, editor controls, dan canvas presentasi. Kompatibilitas V2 tetap. |
| src/footprints/lines/FootLineSampleAdapter.ts | Pecah adapter live dan MP4; tambahkan frameId, clipId, generation, basis, marker provenance, timestamps. |
| src/footprints/lines/ActiveFootSelector.ts | **Jangan** panggil dari mode Lintasan V3. Tetap digunakan hanya untuk sapuan V2 bila diperlukan. |
| src/footprints/lines/FootLineTrailEngine.ts | Ekstrak algoritme V2 sebagai legacy; buat V3 dual-foot track store dengan raw + filtered history. |
| src/footprints/lines/LineTrailCanvasRenderer.ts | Default garis V3 menjadi polyline presisi; empat gaya V2 bekerja di atas trajectory yang sama sebagai opsi advanced. |
| src/footprints/lines/FootprintBrushEngine.ts | Pisahkan brush/pijakan dari trajectory truth; tidak membuat jejak fisik dari confidence rendah. |
| src/stage/VideoPoseGaitEngine.ts | Gunakan segment/snapshot time dan status seeking/stale; jangan memicu model pose lain. |
| src/footprints/live/MultiPoseGaitRouter.ts | Gunakan status identity per frame (A/B), gate ambiguity dan recovery. |
| src/footprints/spatial/coordinates.ts | Gunakan transform stage/raw/floor existing sesuai basis dan hanya ketika kalibrasi valid. |
| src/footprints/scenes/FootMotionEventV2.ts | Sumber opsional event Pijakan; validation dan provenance tetap. |
| src/studio/v3/ComposeFloorPosePreview.ts | Pertahankan fallback visual 2D; hindari double-render saat Garis BETA aktif. |

### Modul baru yang diusulkan

- src/footprints/lines/v3/FootObservation.ts
- src/footprints/lines/v3/SourceFrameNormalizer.ts
- src/footprints/lines/v3/FootPositionResolver.ts
- src/footprints/lines/v3/TrajectoryClock.ts
- src/footprints/lines/v3/TrajectoryQualityGate.ts
- src/footprints/lines/v3/DualFootTrajectoryEngine.ts
- src/footprints/lines/v3/TrajectoryRenderer.ts
- src/footprints/lines/v3/TrajectoryDiagnostics.ts
- src/studio/v3/LineTrailsV3Panel.tsx
- tests/line-trails-v3/*.test.ts
- e2e/line-trails-v3.spec.mjs

Nama direktori dan fungsi usulan, bukan file yang sudah tersedia.

## 4. Kontrak data v3

### 4.1. Foot Observation

~~~ts
type SourceKind = 'camera' | 'phone' | 'video' | 'demo';
type Basis = 'image-2d' | 'calibrated-estimate' | 'simulated';
type Side = 'left' | 'right';
type ActorId = 'A' | 'B' | 'performer-1' | string;

interface FootObservationV3 {
  schema: 'soma.foot-observation';
  version: 3;
  source: SourceKind;
  clipId?: string;                 // file identity; MP4 only
  sourceSessionId: string;         // changes when camera/clip/session replaced
  generation: number;              // seek, replay reset, identity reset
  segment: number;                 // MP4 engine segment or derived source segment
  frameId: string;                 // unique within sourceSession + generation
  sourceFrameMs: number;           // monotonic only inside this source segment
  observedAtPerfMs: number;        // when received by app; freshness, never media time
  actorId: ActorId;
  foot: Side;
  basis: Basis;
  rawUV: {x: number; y: number};
  landmarks: {
    heel?: {x: number; y: number; visibility: number};
    toe?: {x: number; y: number; visibility: number};
    ankle?: {x: number; y: number; visibility: number};
  };
  anchor: 'heel-toe-center' | 'heel' | 'ankle-fallback';
  headingRad?: number;
  confidence: number;
  tracking: 'observed' | 'occluded' | 'ambiguous';
  transformId: string;            // crop/rotation/mirror/aspect-fit/calibration revision
}
~~~

- FootObservationV3 menyimpan data mentah. Renderer **tidak** boleh mengubah rawUV di objek ini.
- image-2d mempunyai origin top-left pada **frame sumber yang sudah didefinisikan**. Konversi image→view dilakukan sekali oleh adapter viewport. Jangan pakai transform mirror ganda.
- calibrated-estimate hanya diberikan lewat proses pemetaan yang valid untuk observasi lantai; posisi swing camera 2D tetap image-2d.
- generation harus berubah ketika seek, source replacement, reset/replay, atau identity-reinitialization.
- FrameId dapat berupa clipId + generation + snapshot frame time + actor; perbedaan actor/foot disimpan pada track key.

### 4.2. Key, segment, dan hasil keputusan

~~~ts
type TrackKey = string; // composite: session:generation:actor:foot:basis:transformId

type CutReason =
  | 'source-change' | 'seek-or-rewind' | 'identity-ambiguous'
  | 'foot-missing' | 'low-confidence' | 'stale-frame'
  | 'time-gap' | 'distance-jump' | 'transform-changed'
  | 'user-clear' | 'blackout';

interface AcceptedTrajectoryPoint {
  rawUV: {x:number;y:number};
  displayUV: {x:number;y:number}; // filtered, never extrapolated
  sourceFrameMs:number;
  observedAtPerfMs:number;
  confidence:number;
  frameId:string;
  anchor:string;
  headingRad?:number;
}
interface TrajectorySegment {
  id:string;
  trackKey:TrackKey;
  basis:Basis;
  points:readonly AcceptedTrajectoryPoint[];
  openedAtMs:number;
  closedAtMs?:number;
  cutReason?:CutReason;
}
interface TrajectoryFrameDecision {
  trackKey:TrackKey;
  frameId:string;
  accepted:boolean;
  reason?:CutReason | 'duplicate-frame' | 'out-of-range';
  raw?:{x:number;y:number};
  filtered?:{x:number;y:number};
  gapMs?:number;
}
~~~

**Stabilitas kunci:** data yang berubah secara sah (seek, clip, identity reset, transform revision) membuat track baru. Hindari hanya memakai actorId: A dari klip sebelumnya tidak boleh tersambung ke A dari klip baru.

## 5. Source adapter dan identity

### 5.1. Kamera/HP melalui Track

- Baca MotionFrame yang sudah dihasilkan engine Track; V3 tidak memanggil getUserMedia atau pose detector sendiri.
- Gunakan frame.time sebagai source time **hanya setelah** kontrak satuannya diperiksa; observedAtPerfMs diisi saat UI menerima frame.
- Sumber phone tetap dikenali sebagai phone dalam metadata meskipun MotionFrame.source masih camera.
- Untuk 1P, pakai satu pose valid dan hasil kedua kaki.
- Untuk 2P, baca posisi A/B dari MultiPoseGaitRouter pada frame yang sama. Jika observedFrameTime tidak cocok, identity ambiguous, atau index tidak ada, potong hanya track yang terdampak.
- Tidak ada substitusi B→A saat pelaku B tertutup; jangan menyatukan dua aktor pada jalur yang sama.

### 5.2. Video MP4

- Baca ExperimentalFrame.kind=video dan ReplayAnalysisSnapshot; cek file/clip identity, ready, seeking, current video time vs snapshot.atMs, snapshot.segment, dan pose confidence.
- Hasil inference datang asinkron. Simpan pasangan sourceFrameMs + observedAtPerfMs; jangan menggambar frame yang diproduksi dari klip/epoch berbeda.
- Pause: jangan ingest ulang snapshot yang sama, jangan memajukan durasi fade berbasis media kecuali kebijakan UI mengaktifkan fade wall-time secara eksplisit.
- Seek maju/mundur/loop dan perubahan clipId mengubah generation, memutus segmen, serta membuang pending inference dari epoch lama.
- Perubahan playbackRate tidak mengubah kecepatan geometris foot samples; hanya cadence penerimaan frame berubah. Delay diagnosis tetap ditunjukkan.
- Jika frame dengan timestamp yang sama datang dua kali, abaikan duplikat; jangan membuat titik baru.

### 5.3. Demo

- Demo selalu diberi source=demo, basis=simulated dan label DEMO yang jelas.
- Saat berpindah demo↔live, hapus atau arsipkan riwayat sesuai pilihan operator; jangan menyambungkan riwayat dua sumber.
- Demo tidak boleh menaikkan status output fisik.

## 6. Foot Position Resolver

**Tujuan:** pusat lintasan mengikuti perpindahan kaki yang teramati; heading dari heel-toe dipisahkan dari pusat lintasan.

Strategi P0 (dapat diuji dan dipilih melalui fixture):

1. Periksa validitas heel/toe/ankle masing-masing beserta visibility.
2. Bila heel dan toe valid, hitung midpoint sebagai **candidate**, catat raw heel/toe dan jarak antar keduanya.
3. Buat confidence penstabil untuk rotasi telapak: perubahan midpoint yang berlawanan dengan gerak ankle, sementara heel-toe orientation berubah besar, harus dievaluasi sebagai kemungkinan pivot; tidak otomatis menjadi displacement tubuh.
4. Tentukan anchor sementara yang konsisten selama satu segmen. Pergantian anchor (midpoint→ankle) tidak langsung menghubungkan dua geometri berbeda; lakukan cut atau offset alignment hanya setelah validator fixture membuktikannya aman.
5. Heading dilaporkan terpisah, tidak digunakan untuk menciptakan titik posisi baru.
6. Kaki hilang, visibility rendah, atau semua kandidat invalid → reject dan cut track kaki itu.

**Penting:** resolver tidak mengetahui posisi kontak fisik pasti dari RGB monokular. Untuk image-2d, pusat telapak hanya representasi geometris pada frame gambar. Label “pijakan lantai” harus berasal dari gate kontak dan kalibrasi lain.

Fitur debug wajib: tampilkan heel/toe/ankle, kandidat midpoint, anchor terpilih, raw UV, filtered UV dan perubahan orientasi. Pilihan anchor awal perlu ditentukan oleh uji pivot, walking, dan occlusion, bukan asumsi kode semata.

## 7. Quality gate dan state machine

### 7.1. Track states

- **WAITING:** belum ada frame/observasi.
- **TRACKING:** observasi baru valid, track aktif.
- **STATIONARY:** observasi baru valid, perpindahan di bawah noise floor; tidak tambahkan panjang lintasan.
- **LOST:** kaki tidak terlihat atau confidence rendah; segmen saat ini ditutup.
- **AMBIGUOUS:** identitas 2P tidak tegas; segmen terdampak ditutup.
- **STALE:** inferensi terlalu tertinggal dibanding sumber; jangan mengarang sambungan.
- **SEEKING:** sumber MP4 berpindah posisi; generation baru.
- **PAUSED:** MP4 berhenti; simpan gambar tanpa menambah sampel.

Transisi LOST/AMBIGUOUS/STALE/SEEKING ke TRACKING selalu membuka segmen baru, walau posisi terakhir terlihat dekat. Segmen lama boleh tetap tampak sesuai kebijakan durasi.

### 7.2. Validasi titik baru

Semua gate berjalan dalam urutan:

1. Validasi schema, timestamp finite, confidence 0..1, koordinat finite 0..1.
2. Periksa frameId/generation/clip/session/transformId dan actorId.
3. Periksa identity status per actor; reject ambiguous.
4. Periksa source frame order: duplicate/older frame ditolak; rewind/seek memicu new segment.
5. Periksa batas usia frame terhadap media currentTime/live performance clock.
6. Periksa gap waktu, discontinuitas posisi, perbedaan anchor, dan quality.
7. Filter visual hanya untuk accepted point.
8. Tambahkan titik jika perpindahan melebihi noise floor adaptif; jika diam, update health tanpa menambah segmen panjang.

**Ambang contoh untuk implementasi awal (harus di-tune QA):**
- Minimum confidence 0.55; uncertainty untuk ankle fallback lebih tinggi.
- Max gap 250–400 ms tergantung cadence sumber, tapi gap besar selalu putus.
- Perpindahan terlalu besar per dt ditandai jump; periksa juga spatial threshold agar kamera pose salah tidak lolos hanya karena video slow.
- Noise floor diukur dari periode diam tiap kaki, tidak satu deadband tetap untuk semua zoom/resolusi.
- Tidak ada interpolasi melintasi rejected frame atau cut reason.

## 8. Dua clock: aturan implementasi

**Source time** (tSource): frame.time live atau snapshot.atMs MP4, dipakai deduplikasi, urutan, gap, dan segmentasi. Jika sumber rewind atau seek, generation berganti.

**Wall/performance time** (tPerf): performance.now() saat data diterima, dipakai scheduling paint, freshness UI, metrik inference, dan deteksi timeout realtime.

**Presentation time**:
- Live = performance.now() dengan mapping yang diketahui ke clock sumber bila perlu.
- MP4 = video.currentTime × 1000 saat playback; pause membekukan media-retention; seek membuat epoch baru.
- Demo = demo clock tersendiri.

Tidak boleh membandingkan sourceFrameMs dari MP4 dengan performance.now() secara langsung. V2 menyimpan atMs titik render dengan now dan memakai cutoff 55 ms; V3 harus menyimpan kedua waktu terpisah agar data dan gambar bisa dievaluasi ulang.

~~~ts
interface TrajectoryClockSnapshot {
  mode:'live'|'mp4'|'demo';
  sourceFrameMs:number;
  observedAtPerfMs:number;
  presentationMs:number;
  paused:boolean;
  generation:number;
  playbackRate:number;
}
~~~

**Uji wajib:** seek forward/back, loop 0→awal, pause 2 detik, playbackRate 0.5/1/2, dan inference hasil epoch lama yang tiba belakangan.

## 9. Penyimpanan trajectory, filter, dan renderer

### 9.1. DualFootTrajectoryEngine

- Map tracks: TrackKey → state, active segment, raw history, display history.
- Satu panggilan ingest menerima seluruh observasi valid pada frame yang sama, bukan cuma kaki pilihan.
- Per-track filter state; filter kiri tidak dapat mengubah kanan.
- Pada cut, close active segment dan reset filter untuk kaki tersebut. Jangan mengubah segmen historis.
- Simpan bounded ring/deque (contoh baseline: max 6000 titik dan 240 segmen total, konfigurabel). Pecah segment lama dari depan; jumlah terukur selama soak test.
- Clear dan reset session harus eksplisit. Pergantian gaya/warna tidak menghapus titik sumber.

### 9.2. Filtering

- Default **Precise/Raw validated**: line vertices mengikuti titik hasil validasi; jitter stationary dikendalikan deadband adaptif.
- Optional **Light smoothing**: One Euro per track; simpan raw dan filtered; filter tidak extrapolate, dan tidak boleh keluar rentang segmen observasi valid untuk sampling yang diuji.
- Optional advanced **Smooth**: hanya lapisan display dan tidak boleh meratakan belokan melampaui toleransi QA.
- Interpolasi render hanya boleh di antara accepted points pada segmen yang sama dan clock konsisten. Tidak ada prediksi ke frame berikutnya.

### 9.3. Renderer

- Default memakai polyline eksplisit: moveTo titik pertama segmen, lineTo titik observasi berurutan. Jangan memakai quadraticCurveTo untuk default presisi.
- LineCap/Join boleh round, namun tidak memberi blur atau width bloom.
- Layer visibility per actor/foot; warna dan width presentasional saja.
- Preview dan fullscreen menggunakan TrajectoryRenderer yang sama, dengan viewport transform dari source image UV ke canvas pixel. Terapkan mirror/aspect-fit satu kali; sertakan transformId di trace.
- Fade memakai presentation clock per source; **paused MP4 tidak memajukan retention**.
- Brush sweep/step dan empat gaya V2 menggunakan geometry V3 setelah P0 lolos, bukan memanggil ActiveFootSelector untuk mempersempit dua kaki menjadi satu.
- Blackout: gambar hitam langsung; tidak menggambar video, titik, garis, atau diagnostic overlay di atas output blackout.

## 10. Pijakan dan hubungan dengan event system

- Pakai FootMotionEventV2 yang lolos footMotionCanStamp().
- Estimasi video diberi label "video-estimate"; simulated diberi label "simulasi"; status unverified tidak dijadikan cap kontak.
- Mode Pijakan memisahkan event-contact markers dari geometric trajectory.
- Jangan mengubah fungsi footMotionAuthorizesPhysicalOutput(), allowPhysicalOutputFromExperiment(), atau gating Map/Perform.
- Homography cameraGroundToFloor() hanya berlaku untuk titik yang diasumsikan pada bidang lantai dan memiliki phase contact/stance serta confidence layak; tidak boleh digunakan langsung untuk kaki swing.

## 11. Hook/UI integrasi Stage 1

Tahap migrasi yang aman:

1. Tambahkan feature flag internal **lineTrailsEngineVersion = v2 | v3** (default v2 selama pengerjaan; calon rilis v3 setelah QA).
2. SurfaceComposer menjaga satu tombol Garis BETA, satu panel dan fullscreen API. Pilihan engine dimuat di belakang adaptor dan tidak mengubah shortcut Compose lainnya.
3. Sumber data berasal dari frameRef/experimentFrameRef/router yang sudah diberikan FootprintsStageWorkspace. Tidak membuka sumber kedua.
4. Editor panel default hanya mode, warna kaki, width, duration, clear, fullscreen. Diagnostik di popover/drawer, gaya lama di Advanced.
5. Saat operator berpindah ke Track/Map/Perform, hapus subscription UI, tetapi tidak mengubah ownership Camera Hub atau stream F3.
6. Jika flag v3 gagal, rollback ke v2 tanpa menghapus layout, calibration, atau session input.

## 12. Pseudocode pipeline (kontrak implementasi)

~~~ts
function consumeFrame(sourceFrame: SourceFrame, nowPerfMs: number) {
  const normalized = normalizeSourceFrame(sourceFrame, nowPerfMs);
  if (normalized.epochChanged) {
    trajectory.closeAffectedTracks('seek-or-rewind');
  }

  const observations = resolveAllFeet(normalized); // 1P = 2, 2P = up to 4
  const decisions = qualityGate.evaluate(observations, normalized.status);

  for (const decision of decisions) {
    diagnostics.append(decision); // accepted AND rejected
    if (!decision.accepted) {
      trajectory.cut(decision.trackKey, decision.reason);
      continue;
    }
    trajectory.ingest(decision.observation); // preserves raw + filtered
  }
  trajectory.markMissingFeet(decisions, normalized.sourceFrameMs);
}

function renderFrame(clock: TrajectoryClockSnapshot) {
  renderer.paint(previewCtx, trajectory.getVisible(clock), viewTransform);
  if (fullscreenActive) {
    renderer.paint(fullscreenCtx, trajectory.getVisible(clock), fullscreenTransform);
  }
}
~~~

Nilai dalam pseudocode menunjukkan urutan logis; nama API belum tersedia di repository.

## 13. Instrumentasi dan metrik

### Debug trace ringkas, lokal per frame

~~~json
{
  "schema": "soma.trajectory-debug",
  "version": 3,
  "source": "video",
  "sourceSessionId": "clip-001",
  "generation": 2,
  "sourceFrameMs": 10333.3,
  "observedAtPerfMs": 41120.1,
  "actorId": "A",
  "foot": "left",
  "confidence": 0.91,
  "basis": "image-2d",
  "rawUV": {"x":0.41,"y":0.78},
  "displayUV": {"x":0.409,"y":0.779},
  "accepted": true,
  "cutReason": null
}
~~~

Data contoh tersebut sintetis. Event rejected mencatat reason enum (low-confidence, stale-frame, foot-missing, dsb). Ring buffer diagnostics dibatasi, tidak otomatis mengunggah video.

**Performa yang harus dicatat:** source FPS, inference FPS dan P95 ms, rendered FPS/P95 render ms, source-to-display age P50/P95, missed/stale frames, cut count per reason/foot, actor swap count, canvas draw cost, memory dan jumlah point/segment.

## 14. Test strategy

| Area | Unit / golden / E2E |
| --- | --- |
| Resolusi posisi | heel-toe midpoint, rotation/pivot, ankle fallback, missing landmark |
| Independensi | left moves/right still, right moves/left still, simultaneous 2P |
| Quality | low confidence, duplicate, NaN, out-of-bound, jump, missing foot |
| Cut semantics | loss/reacquire, source switch, transform revision, identity ambiguity |
| MP4 clock | playbackRate 0.5/1/2, pause, seek, clip replacement, stale result |
| Visual | golden raw-vs-displayed polyline, 90° turns, no overshoot, 16:9/4:3 |
| Consistency | preview vs fullscreen same geometry, color, point count |
| Safety | blackout, output physically locked, Map/Perform gate unchanged |
| Performance | 1P/2P, 10/30-minute soak, bounded memory |
| Regression | V2 styles/presets, Camera Hub, F3 Capture, Track |

Fixture harus punya **reference time + actor + side + pixel coordinates**; gunakan video beranotasi untuk memeriksa inferensi nyata. Golden tests tidak boleh semata menghitung jumlah strokes.

### Proposed thresholds (belum diukur)

- Fixture ideal 1600×900: median error ≤ 6px, P95 ≤ 16px, corner deviation ≤ 12px.
- 0 sambungan teleport lintas cut/seek/switch/ambiguity.
- 0 extra accepted points pada 2 detik pause.
- Render P95 ≤ 16 ms pada profil QA desktop yang didokumentasikan.
- 30 menit 2P tanpa memory growth tidak terkendali.

Ukur terlebih dahulu noise sumber, latency model, dan resolusi; bila target tidak masuk akal untuk perangkat nyata, dokumentasikan perubahan threshold, bukan menyembunyikan kegagalan.

## 15. Implementasi dan rollback bertahap

| Paket | Perubahan kode | Exit criteria |
| --- | --- | --- |
| A — Observability | Clock + QA trace + raw overlay + fixture | Per titik accepted/rejected dapat dijelaskan |
| B — Dual-track | Resolver + source adapter + identity gate + engine baru | Dua/four tracks independen; AT-01–07 |
| C — MP4 correctness | Epoch generation + seek detection + stale rejection | AT-08–10 |
| D — Renderer/UX | Polyline + UI ringkas + fullscreen parity | Golden screenshot + AT-12 |
| E — Hardening | 2P crossing, soak, regression safety | AT-11, 13–15; no output gate change |
| P1 — Additional | Pijakan, export, gaya artistik | QA terpisah |

**Rollback:** flag v3→v2, tidak mengubah data sumber, memori registrasi kamera atau format mapping panggung. Karena V3 punya history/provenance baru, jangan mengonversi segmen yang sedang aktif ke engine lain saat sesi perform; lakukan reset segmen dan beri label perubahan mode.

## 16. Hal yang belum ditentukan

1. Anchor terbaik (midpoint heel-toe vs ankle-relative vs anchor hybrid) perlu dipilih melalui klip pivot, lateral, stop–start, dan gerak cepat.
2. Ambang confidence, speed jump, gap dan stationary harus diukur untuk webcam, HP dan MP4.
3. Desain label 2P dan warna 4 channel perlu diuji pada proyektor latihan dalam kondisi warna rendah.
4. Strategi fade saat paused MP4 selain freeze (jika diminta operator) sebaiknya menjadi opsi lanjutan.
5. Sesi HP nirkabel yang dipairing Camera Hub belum otomatis dirutekan ke Track; V3 hanya menerima stream yang memang sudah menjadi input Track.
6. Hasil pada deployment Vercel belum dianggap sama dengan GitHub Pages hingga commit SHA kedua platform dikonfirmasi.

**Kesimpulan teknis:** kebenaran jalur ditetapkan oleh source frame, resolver dan quality gate. Filter dan style hanyalah pilihan presentasi. Setiap kaki menyimpan trajektorinya sendiri, disertai bukti timestamp dan identitas yang bisa diperiksa operator.
