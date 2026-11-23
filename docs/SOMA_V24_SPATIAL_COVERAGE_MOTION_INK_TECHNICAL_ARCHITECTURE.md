# SOMA V2.4 — Spatial Coverage, Motion Smoothing & Rough Sumi
## Technical Architecture, Contracts, Algorithms & Verification Plan

**Tanggal:** 23 November 2026  
**Status:** Engineering proposal / belum diimplementasikan  
**PRD:** [SOMA V2.4 PRD](SOMA_V24_SPATIAL_COVERAGE_MOTION_INK_PRD.md)  
**Basis audit:** branch main pada commit f264a92980a78181daf60bc76cea7b095d482684, Continuity V2.3 dengan fallback V2.2  
**Benchmark:** MP4 640×360, 24 fps, 360 frame, 15,04 s, SHA-256 c0c1437adad33492b8b811bd1da131c33a357d858d3b394689b167e8a9adb079  
**Output:** Compose FLOOR 1600×900 → satu clean raster → Map → Perform.

> Spesifikasi ini memakai kode dan video yang benar-benar diperiksa. Proporsi kesalahan dari masing-masing modul masih perlu dibuktikan melalui trace runtime. Nilai threshold dan sasaran kinerja di bawah masih parameter awal pengujian.

---

## 1. Engineering decisions

**ADR-01 — Koordinat sebelum material.** Perbaiki source geometry, ground anchor, spatial transform dan coverage. Smoothing dan Rough Sumi baru dievaluasi setelah lintasan dasar terukur.

**ADR-02 — Satu approved pose stream.** Gunakan snapshot 33 landmark yang sekarang dipakai SourceFrameNormalizer dan DualTracePoseFrameBus; jangan menjalankan detektor tambahan hanya untuk kuas.

**ADR-03 — Ruang eksplisit.** imageRawPx, stageImagePx, floorM, floorUV dan projectorUV punya tag sendiri. Camera-to-floor hanya di tracking; floor-to-projector hanya di Map.

**ADR-04 — Hip delta, foot anchor.** Pinggul digunakan untuk perpindahan relatif. Titik hip airborne tidak pernah langsung dianggap ground point.

**ADR-05 — Filter di sepanjang waktu.** Hilangkan jitter pada accepted actor trajectory, bukan dengan menggeser outline tinta atau melengkungkan seluruh perjalanan tanpa batas.

**ADR-06 — Roughness di pinggir tinta.** Kasarkan silhouette, dry fibers dan pigment density. Jangan menambahkan noise pada centerline, actorId atau jejak kontak.

**ADR-07 — Default aman.** V2.4 opt-in, V2.3 masih rollback. Scene state dan stroke history diberi version/transform marker.

## 2. Pipeline baru dan batas modul

~~~mermaid
flowchart TD
 S[MP4 / Webcam / Phone / Simulator] --> N[Approved Pose Snapshot + Source Geometry]
 N --> E[ActorMotionEvidenceBuilder A and B]
 E --> G[GroundSpaceResolver]
 G --> F[Adaptive Foot-Hip Fusion]
 F --> C[ContinuityCoordinator V2.3: Validate and Commit]
 C --> T[AdaptiveMotionSmoother on committed trajectory]
 T --> K[ActorPathTracker and PathEvents]
 K --> R[PersistentPathStore: Arc-length Spline Ribbon]
 E --> U[Upper Gesture Motion]
 U --> M[Bounded Brush Dynamics]
 M --> R
 R --> I[Rough Sumi Material and Stable Atlas]
 E --> P[Footprint Contact Events]
 P --> H[Footprint Atlas + Decay]
 I --> O[Single FLOOR Compositor]
 H --> O
 O --> V[Compose / PNG / Fullscreen Clean]
 O --> Q[Map Projector Warp]
 Q --> X[Perform + Blackout]
~~~

**Invariant pipeline:** ContinuityCoordinator tetap satu pemilik provisional hip-only gap. Smoothing hanya menerima observasi yang sudah diterima atau kandidat diagnostik yang belum masuk tinta. Stage output menerima committed observations saja. Satu update geometri per source frame, bukan per requestAnimationFrame.

### As-is → to-be

| As-is pada V2.3 | To-be V2.4 |
|---|---|
| Kaki normalized langsung dikalikan 1600×900 | Metadata raw dimensions, orientation, mirror, crop dan content-fit rectangle |
| Router meredam gerak kaki satu sisi menjadi 0.12×; estimator kembali menimbang kaki/hip | Satu estimator translasi tubuh, bobot berdasar bukti dan confidence |
| Penyesuaian drift menuju foot point dengan koreksi fixed 3/7 px | Innovation gate dan confidence-aware re-anchor, CUT saat mismatch |
| Floor profile opsional dan transform tersebar di beberapa modul | GroundSpaceResolver tunggal; setiap titik punya coordinate-space tag |
| Spline centripetal antarknot tanpa filter temporal khusus | One Euro live / optional short fixed-lag MP4 smoothing |
| Solid polygon dengan beberapa gurat penghapus kecil | Edge fray berkorelasi, dense ink core dan dry-bristle detail |
| Deposit count pernah dipakai menilai path | Coverage, endpoint error, path length, STOP drift, bridge/CUT dan pixel seam |

## 3. Kontrak data yang bisa langsung diimplementasi

~~~ts
type ActorId = 'A'|'B';
type CoordinateSpace = 'imageRawPx'|'stageImagePx'|'floorM'|'floorUV'|'projectorUV';

type SourceFrameRef = {
  sourceKey:string;clipStableId:string;sourceEpoch:number;
  frameAtMs:number;presentationAtMs:number;frameSequence:number;
};

type SourceGeometry = {
  rawWidth:number;rawHeight:number;
  orientation:0|90|180|270;mirrored:boolean;
  contentRect:{x:number;y:number;width:number;height:number};
  geometryVersion:string;  // invalidated by crop, zoom, orientation, mirror
};

type Coordinate = {
  x:number;y:number;space:CoordinateSpace;
  calibrationId?:string;geometryVersion:string;
};

type GroundEvidence = {
  actorId:ActorId;frame:SourceFrameRef;
  identityConfidence:number;sourceGeometry:SourceGeometry;
  left?:{imagePoint:Coordinate;confidence:number;phase:'stance'|'swing'|'unknown'};
  right?:{imagePoint:Coordinate;confidence:number;phase:'stance'|'swing'|'unknown'};
  hipImagePoint?:Coordinate;hipConfidence:number;
  shoulderVector?:{x:number;y:number};
  state:'DUAL_SUPPORT'|'SINGLE_SUPPORT'|'STANCE_SWITCH'|
        'SWING'|'PIVOT'|'HIP_GAP'|'AMBIGUOUS';
};

type GroundTrajectorySample = {
  actorId:ActorId;frame:SourceFrameRef;point:Coordinate;
  evidence:'observed-support'|'dual-foot'|'support-hip'|'hip-provisional';
  translationConfidence:number;identityConfidence:number;
  residualPx:number;motionState:'WALK'|'HESITATE'|'PIVOT'|'STOP'|'UNKNOWN';
};

type SumiMaterial = {
  preset:'natural-sumi'|'rough-sumi'|'dry-brush'|'dense-ink';
  roughness:number;dryFiber:number;edgeBleed:number;
  pigmentDensity:number;weightPx:number;
  seed:number;version:2;
};
~~~

**Typed-space rule:** API harus menolak pencampuran stageImagePx dengan floorM. Transform yang gagal mengembalikan alasan eksplisit dan menahan jalur, bukan mengisi nilai nol, clamp tepi, atau mengubah skala diam-diam.

## 4. Perbaikan sumber koordinat

### 4.1 Raw video ke stage-image
1. Baca width, height, orientation, mirror dan crop aktual dari frame yang disetujui.
2. Ubah MediaPipe landmark normalized ke raw image pixels.
3. Terapkan mirror/rotation satu kali menurut source geometry, sebelum stage-fit.
4. Gunakan contentRect untuk mempertahankan aspect ratio; konversi imageRawPx ke stageImagePx 1600×900.
5. Simpan matrix raw→stage dan inverse stage→raw. Roundtrip test mencakup 16:9, portrait, crop, letterbox, mirrored dan rotation.
6. Ketika framing berubah, tingkatkan geometryVersion, tutup candidate bridge dan validasi ulang calibration.

Kode sekarang memakai stageUVToRawCamera(stage,videoAspect). V2.4 sebaiknya mengembalikan source-fit transform yang benar-benar dipakai preview, sebab videoAspect saja tidak menjelaskan crop, mirror atau orientasi. Ukuran preview browser boleh berubah tanpa mengubah koordinat raw yang sama.

### 4.2 Kamera ke floor plane
1. Operator menandai empat sudut bidang lantai dengan urutan UL, UR, DR, DL pada frame beku.
2. Validasi winding, area polygon, distorsi dan sudut yang nyaris segaris.
3. Hitung H_cameraToFloor dengan correspondences, serta inverse transform.
4. Gunakan H hanya untuk titik kaki yang didukung stance/contact evidence. Posisi kaki ayun tidak otomatis dianggap menyentuh lantai.
5. Simpan FloorSpace widthM/depthM dari Stage Profile, bukan angka panggung yang dipaksakan ke semua sumber.
6. Gunakan floorUV=(xM/widthM,1-yM/depthM), lalu FLOOR canvas=(u×1600,v×900).
7. Saat titik di luar polygon / transform degenerasi, berikan status out-of-floor dan HOLD/CUT sesuai identity state.
8. Floor-to-projector hanya dijalankan di Map setelah final raster tersedia.

**Image-2D fallback:** boleh tetap menampilkan perjalanan untuk diagnostic/preview, tetapi status harus terbaca sebagai Ruang perkiraan 2D. Jangan menilai meter lantai ketika belum dikalibrasi.

### 4.3 Hip displacement untuk kalibrasi
Posisi hip berada di atas bidang lantai; memproyeksikan H(hip) menghasilkan titik keliru. Perkirakan perpindahan lewat Jacobian homography di sekitar last valid foot image anchor:

\[
\Delta p_{\text{floor}}\approx J_H(p_{\text{support-image}})\,\Delta p_{\text{hip-image}}
\]

Batasnya:
- Perubahan perspektif dan hip sway menyebabkan error; confidence harus diturunkan.
- Jacobian dekat area singular/extreme quadrilateral wajib ditolak.
- Ketika kaki kembali sah, re-anchor secara bertahap bila residual kecil.
- Jika residual melampaui gate, keluarkan CUT; jangan tarik stroke ke kaki yang jauh.
- Untuk kalibrasi yang tidak tersedia, hip delta tetap berada di image2D space dan tidak pernah diberi label meter.

## 5. Motion evidence classifier

### Klasifikasi tiap frame aktor
- DUAL_SUPPORT: kedua kaki memiliki evidence yang cukup, displacement koheren dengan hip.
- SINGLE_SUPPORT: satu kaki mendukung, satu kaki kurang valid/ayun; hip delta dapat memperkirakan perpindahan pusat.
- STANCE_SWITCH: support berpindah kiri→kanan atau sebaliknya; titik pusat badan harus tetap stabil.
- SWING: kaki yang terangkat bergerak besar, sedangkan support/stable body hanya sedikit.
- PIVOT: foot heading/shoulder berubah tetapi ground translation kecil.
- HIP_GAP: kaki hilang singkat; hip+identity masih sah → provisional sesuai V2.3.
- AMBIGUOUS: sumber/identity/time/coordinate confidence tidak cukup → HOLD/CUT.

Untuk kaki samping yang hilang pada MP4, classifier wajib menjaga koordinat center berdasarkan actor yang benar, bukan memperkecil jalur terus-menerus.

### Penyebab undercoverage yang perlu diuji
PathObservationRouter saat ini sudah melakukan penyusutan saat single-foot: bounded delta maksimum 8 px kemudian dikali 0.12. ActorGroundTrajectoryEstimator selanjutnya membaurkan foot delta dengan hip delta menggunakan bobot 0.55 untuk dua kaki atau 0.15 untuk satu kaki dan memperbaiki posisi menuju foot.point dengan batas 7/3 px. Dua tahap berurutan ini **berpotensi** memperpendek perjalanan dan menimbulkan drift. Belum dapat dipastikan tanpa trace data.

### Fusion algorithm V2.4

~~~text
For each approved actor frame:
  validate source, actorId, timestamp, transformVersion
  classify motion evidence (support, swing, pivot, gap)
  establish initial anchor from observed ground foot support
  if DUAL_SUPPORT:
      d = robustBlend(deltaSupport, localHipDelta, qFoot, qHip)
  if SINGLE_SUPPORT:
      d = robustBlend(boundedStanceDelta, localHipDelta, evidenceConfidence)
      ignore independent swinging-foot excursion
  if STANCE_SWITCH:
      d = continuityCheckedHipDelta()
      validate observed new support without jumping to its absolute image x/y
  if PIVOT:
      d = boundedNearZeroTranslation()
      preserve angular motion as an independent brush feature
  if HIP_GAP:
      send bounded candidate to existing ContinuityCoordinator
      do NOT commit path and do NOT emit footprint
  if AMBIGUOUS:
      HOLD or actor-scoped CUT

  predictedPoint = previousAcceptedPoint + d
  innovation = observedSupportPoint - predictedPoint
  if stance is valid AND innovation within gate:
      acceptedPoint = predictedPoint + K(confidence, dt) * innovation
  else if innovation too large:
      cut stroke; restart at fresh observed support point
  else:
      acceptedPoint = predictedPoint

  pass acceptedPoint to V2.3 continuity decision
  pass committed accepted points to temporal smoother
  pass smoothed points to ActorPathTracker
~~~

**Jangan memakai dua faktor damping tetap di dua modul.** Satu fusion owner mengonsumsi raw foot displacements dan hipDelta; PathObservationRouter menjadi evidence adapter. Confidence rendah mengurangi kepercayaan/speed envelope, tidak otomatis melenyapkan seluruh displacement lintasan.

Secara matematis:
- Prediksi: x̂_t = x_(t−1) + w_f d_foot + w_h d_hip, w_f+w_h=1.
- Initial adaptive weights: w_f=q_foot/(q_foot+q_hip+epsilon), disesuaikan oleh motion class.
- Residual: r_t = x_support,t − x̂_t.
- Correction: x_t = x̂_t + K_t clip(r_t,r_gate), saat support benar-benar valid.
- Jika |r_t| berlebihan atau actor identity ambigu: CUT, hindari konvergensi pelan yang terus meleset.
- Event dedup berdasarkan sourceEpoch, actorId, frameAtMs; satu frame tidak boleh dihitung dua kali.

Batas awal untuk uji: confidence landmark 0.55 dan identity 0.65, hip-only buffer ≤250 ms/enam frame, max step adaptif terhadap torsoScale, dt dan calibration. Angka final harus lahir dari benchmark; belum dinyatakan akurat.

## 6. Adaptive Temporal Smoothing

### 6.1 Live mode: One Euro Filter
Gunakan satu filter untuk setiap actorId, stroke segment dan coordinateVersion:
- dt=(frameAtMs−prevFrameAtMs)/1000, bukan rAF.
- Estimasi v=(x_t−x_(t−1))/dt; low-pass derivative.
- cutoff=minCutoff+beta×|v_filtered|.
- alpha=1/[1+1/(2π×cutoff×dt)].
- filtered=alpha×observed + (1−alpha)×previousFiltered.
- Ketika lambat/diam, cutoff rendah menekan jitter; saat cepat/turn, cutoff lebih tinggi mempertahankan respons.
- Normalize velocity menurut torso size/floor dimensions untuk tuning lintas kamera.

Parameter sweep awal: minCutoff 0.7–1.7 Hz; beta 0.003–0.04 dengan velocity normalized; derivativeCutoff 0.8–1.5 Hz. **Parameter evaluasi, bukan final production constants.**

### 6.2 MP4 mode
- Default kausal sesuai presentation clock; optional lookahead 0–2 frame (hingga ~83 ms pada 24 fps) hanya jika approved future pose sudah tersedia dan urutan klip konsisten.
- Buffer future pose tidak boleh menjadi committed ink saat browser belum menerima frame yang valid.
- Setelah seek/loop/change speed, filter reset pada epoch baru. Replay dari awal deterministik.
- No smoothing across CUT, identity change, calibration change, actor out-of-floor.
- Ketika berhenti 8–14 detik, motionState berubah STOP dan residual < deadband tidak menambah PathEvent.

### 6.3 STOP, hesitation dan pivot
- WALK: speed > movingThreshold selama jendela minimum.
- HESITATE: speed kecil tetapi displacement kumulatif masih konsisten.
- PIVOT: rotational features beralih sementara pusat support tetap di area yang sama.
- STOP: speed di bawah stopThreshold selama 300–450 ms awal.
- Gunakan hysteresis movingThreshold > stopThreshold agar sensor jitter tidak bolak-balik STOP/WALK.
- Pertahankan tangent dan turning corner; jangan oversmooth menjadi garis lurus.

### 6.4 Spline pasca-smoothing
Pertahankan centripetal Catmull-Rom dengan corridor bounds yang sudah ada di PathSplineFitter; sebar sampel menurut arc-length yang sebenarnya. Saat TURN tajam, gunakan conservative tangent/linear fallback jika cubic overshoot melewati support corridor. Start/end path tidak boleh digeser semata untuk melembutkan ujung.

## 7. Continuity V2.3 tetap menjadi pengaman

ActorContinuityCoordinator mengelola satu hip-only provisional buffer per actor. AdaptiveMotionSmoother menerima committed observations setelah bridge ACCEPT, tidak menciptakan candidate kedua. Bila gap ditolak, filter direset untuk segmen baru dan actor-scoped CUT diteruskan.

Aturan:
1. Soft gap singkat memakai hip estimate sebagai provisional (belum tinta).
2. Saat recovered foot support kembali, validator memeriksa actorId, clip, epoch, transform, tangent, waktu dan residual.
3. ACCEPT mengirim titik berurutan tepat sekali, kemudian smoothing pada segment accepted.
4. REJECT membuang titik, CUT dan memulai jalur baru pada bukti yang sah.
5. Hard CUT tidak boleh dicabut hanya karena visual terlihat lebih halus.

## 8. Rough Sumi Material Engine

### 8.1 Diagnosis baseline
DirectionalInkPainter saat ini mengisi polygon ribbon solid lalu memakai destination-out untuk beberapa garis serat pendek: path-sumi rata-rata dua fiber per arc bin, dengan erasure opacity kecil. SumiRibbonMeshBuilder membentuk batas halus mengikuti tangent normal. Karena itu, tinta masih terbaca sebagai pita tebal relatif rapi.

### 8.2 Rendering process

~~~mermaid
flowchart LR
 A[Accepted smoothed centerline] --> B[Global arc-length samples + tangent]
 B --> C[Base opaque ribbon]
 C --> D[Spatially correlated edge fray]
 D --> E[Stable dense ink core]
 E --> F[Clipped dry-bristle cuts + pigment islands]
 F --> G[Actor-specific alpha atlas + compositor]
~~~

**Stage A — Base ribbon:** pakai width yang berasal dari gesture/velocity dengan batas w_min/w_max. Centerline **tidak dimodifikasi**.

**Stage B — Correlated edge fray:** untuk p(s) dengan tangent t(s), normal n(s)=(-ty,tx), hitung left/right edge:
- Left(s)=p(s)+n(s)[w(s)/2+a(s)N_L(s)]
- Right(s)=p(s)−n(s)[w(s)/2+a(s)N_R(s)]
- a(s)=roughness×min(0.18w(s),edgeCapPx)
- N(s) berasal dari noise berkorelasi multi-skala berdasar hash(strokeId,actorId,materialVersion,globalArcS).
- Frequency rendah mengubah siluet tepi; frequency tinggi membuat serat halus.
- Core ink minimum 60% lebar nominal agar centerline tidak berongga.
- Roughness=0 memulihkan baseline smooth ribbon.

**Stage C — Dry bristle:** garis tipis erasure memanjang mengikuti tangent, bergantung pada s global/seed, bukan jumlah render. Contoh sweep awal panjang 2–16 px, jumlah serat/arc band ditentukan roughness dan dryFiber.

**Stage D — Pigment variation:** pecahan tekstur kecil dibatasi di area stroke; opacity/mask tidak boleh menghasilkan blob akibat setiap frame repaint. Pigment islands tidak diklaim sebagai benturan atau tapak kaki.

**Stage E — Wet/dry response:** saat HESITATE boleh menambah pigmen sekali per accepted event; saat STOP tidak memanggil penambahan setiap animation frame. Shoulder/head memakai bounded modulation yang sudah tersedia (sekitar 1.00–1.22), bukan mengubah posisi path.

### 8.3 Seam-safe retained raster
- Stroke seed tetap: hash(strokeId + materialVersion + actorId). Sampler menggunakan global arcLength s, bukan local segIndex yang reset tiap span.
- Di pertemuan committed atlas dan active tail, posisi/tangent/width/noise phase sama.
- Commit stable area sekali; active tail dibangun ulang dengan clear, bukan alpha stacking.
- Pixel test pada centerline mendeteksi white holes di TURN, accepted bridge, dan final tail.
- Recolor palette A/B mengubah alpha-mask tint saja tanpa rerun detector atau pindah koordinat.
- Untuk browser/ponsel lemah, kurangi detail serat (LOD) sebelum mengurangi kualitas garis atau mematikan output keseluruhan.

### 8.4 Preset awal
| Preset | Roughness | Dry Fiber | Pigment Core | Catatan |
|---|---|---|---|---|
| Natural Sumi | rendah | rendah | stabil | fallback aman |
| Rough Sumi | sedang–tinggi | sedang | pusat tetap padat | target artistik V2.4 |
| Dry Brush | tinggi | tinggi | lebih berpori | jangan robek centerline |
| Dense Ink | rendah | minimal | padat | kontras kuat |

Nilai UI dan mapping ke shader/painter harus berbasis rentang normalisasi 0–1; tabel di atas menggambarkan karakter, belum parameter tuning final.

## 9. Footprints, head/shoulder dan kompositor

**Footprints:** dibuat dari contact/pivot evidence kaki yang diterima, disimpan menurut actorId, side, source time dan stage/floor coordinate. Head/hip estimate tidak boleh membuat cap. Fade default 6000 ms, Path retained, overprint hanya pada perpotongan geometri asli. Cap tidak dipaksa snap ke centerline.

**Head/shoulder:** same approved snapshot dan actorId. Motion dapat memodulasi width/grain bounded, dengan opsi layer Upper ringan. Ketika upper pose hilang, modulation kembali ke base perlahan tanpa memutus foot path.

**Compositor:** urutan default Upper optional → Path → Footprint; satu FLOOR raster putih 1600×900. Compose fullscreen/PNG/Map pre-warp harus memakai buffer dengan timestamp dan settings yang sama. Blackout mengunci output fisik, tidak menghapus atlas.

## 10. Operator UI dan hierarchy

| Tempat | Komponen | Perilaku |
|---|---|---|
| Track | Bidang kamera | preview 4 corner, simpan/reset, status source geometry |
| Compose header | A/B motion status | Terlacak / Estimasi / Terputus dan hitungan kaki terpisah |
| Compose | Gerak | pilihan V2.3/V2.4 beta, smoothing preset Rendah/Sedang/Tinggi |
| Compose | Tinta | Natural Sumi, Rough Sumi, Dry Brush, Dense Ink; Roughness satu slider utama |
| Compose | Tapak | opacity/fade, Tapak depan |
| Detail diagnostik | Tracking XY | raw feet, hip, fused, filtered, rendered + confidence + cutReason |
| Map/Perform | Clean output | finalRaster saja, bebas marker, Blackout selalu jelas |

Jangan memindahkan koordinat karena user memperbesar preview. Kontrol engineering lengkap (OneEuro beta, gain, threshold) disembunyikan di advanced/debug.

## 11. Telemetry dan audit coverage

~~~ts
type CoverageDiagnosticFrame = {
 actorId:'A'|'B';sourceKey:string;sourceEpoch:number;
 frameAtMs:number;presentationMs:number;geometryVersion:string;
 space:'image-2d'|'floor-calibrated';calibrationId?:string;
 validFeet:0|1|2;identityConfidence:number;hipConfidence:number;
 rawFootImage?:{x:number;y:number}[];
 supportGround?:{x:number;y:number};
 fusedGround?:{x:number;y:number};
 smoothedGround?:{x:number;y:number};
 renderedCenter?:{x:number;y:number};
 motionClass:string;fusionBasis:string;accepted:boolean;
 observedDelta?:number;fusedDelta?:number;innovation?:number;
 motionState:string;strokeId?:string;cutReason?:string;
};
~~~

Per actor keluarkan:
- Min/max X/Y raw support, fused, smoothed, rendered. Range harus dibandingkan pada ruang **yang sama**.
- CoverageX dan CoverageY terhadap anotasi manual, termasuk pose di kiri/kanan dan belakang/depan.
- Endpoint error, median/P95 center error, path length per stroke.
- STOP drift, turn overshoot, crossing swap, unsafe bridge count.
- Pose lag, accepted frames, missing feet, confidence distribution, CUT reasons.
- Renderer revision, roughness seed, unique committed spans, rasterDraws terpisah.
- Jangan memublikasikan MP4 berisi orang ke GitHub publik hanya untuk membuat benchmark.

## 12. Test plan yang menutup risiko

| ID | Test / negative case | Expected |
|---|---|---|
| V24-T01 | 16:9 → stage → raw roundtrip | error transform < epsilon |
| V24-T02 | portrait/crop/mirror/rotation | tidak ada double transform |
| V24-T03 | empat titik kalibrasi sah | ground point sesuai floor profile |
| V24-T04 | sudut salah / out-of-polygon | reject/invalid calibration, no clamp |
| V24-T05 | hip airborne | tidak pernah di-project sebagai support |
| V24-T06 | dual foot & hip coherent | translasi dipertahankan |
| V24-T07 | satu kaki valid + hip | tidak double damp; track bergerak wajar |
| V24-T08 | kaki swing vs stance | centerline tidak mengejar swing |
| V24-T09 | stance switch | zero foot-switch teleport |
| V24-T10 | pivot in place | rotasi terbaca, travel kecil |
| V24-T11 | hip-only 2–3 frame | provisional until validated recovery |
| V24-T12 | crossing dengan identity ambigu | CUT/HOLD, no A/B bridge |
| V24-T13 | STOP & hesitation | no endless deposit, small move retained |
| V24-T14 | smoothing TURN 90° | no unacceptable overshoot/straightening |
| V24-T15 | roughness 0→1 | centerline identical, fray bounded |
| V24-T16 | committed/active edge seam | no white core holes |
| V24-T17 | recolor/repaint/replay | deterministic rough mask |
| V24-T18 | footprint fade 6s | Path retained, no hip-only cap |
| V24-T19 | MP4 seek / loop / 3× replay | no ghost/double ink |
| V24-T20 | Map/Perform/Blackout | single clean raster and safe output |

### Real MP4 QA
1. Jalankan source MP4 15,04 s dengan detector SOMA yang sebenarnya. Fixture lokal/privat disetujui pemilik materi; cocokkan SHA.
2. Rekam paired source/output pada t=0,1,2,3,4,5,6,7,8,10,12,14 s.
3. Anotasi manual support-foot/ground-center dan identity A/B, memakai frame asli. Jejak tercetak di video tidak dihitung detector output.
4. Buat plot raw-support vs fused vs smoothed vs rendered untuk tiap aktor.
5. Bandingkan jangkauan kiri/kanan dan kedalaman, endpoint serta TURN; pastikan tidak ada bridge palsu.
6. Nilai Rough Sumi dengan centerline fixture **sama** untuk membedakan masalah material dari tracking.
7. Review manusia pada monitor dan proyektor setelah unit/browser/pixel test lulus.

### Acceptance gates
- **M0:** trace asli dan anotasi tersedia; akar undercoverage terlihat pada modul/timestamp tertentu.
- **M1:** target awal coverageX >=90% dari rentang annotated travel per actor, endpoint error ≤1 panjang tapak; coverageY dilaporkan terpisah.
- **M2:** zero unsafe identity bridge dan source/coordinate double-transform; STOP sekitar t8–14 tidak menambah travel akibat jitter.
- **M3:** Rough Sumi tampak lebih berserat pada 1600×900, bounded width, centerline tidak bergeser, seam bebas lubang.
- **M4:** Compile/unit/browser real MP4/PNG/Map/Perform/Blackout lulus serta soak 30 menit dicatat. Semua angka target menunggu validasi, belum hasil.

## 13. Implementation backlog / dependency map

| ID | P | File/modul | Outcome |
|---|---|---|---|
| SP24-01 | P0 | New CoverageTraceRecorder.ts + report | raw→fused→rendered trace A/B per frame |
| SP24-02 | P0 | SourceFrameNormalizer, ActorMotionFrameBuilder | SourceGeometry & coordinate provenance |
| SP24-03 | P0 | New GroundSpaceResolver, coordinates.ts | transform camera-floor sekali, invalidation |
| SP24-04 | P0 | PathObservationRouter, ActorGroundTrajectoryEstimator | single-owner foot+hip fusion, no double damping |
| SP24-05 | P0 | TrajectoryFusion, ContinuityBridgeValidator | stance/swing/pivot gates and crossing safety |
| SP24-06 | P0 | LineTrailsV3, DualTraceV2Renderer | source/start/end coordinate, one clean raster |
| SP24-07 | P0 | Browser real-MP4 fixture + golden report | coverage, endpoint, crossing, STOP proof |
| MS24-08 | P1 | New AdaptiveMotionSmoother | One Euro/live, fixed-lag optional MP4 |
| MS24-09 | P1 | ActorPathTracker, PathSplineFitter | turning/STOP hysteresis, no overshoot |
| IN24-10 | P1 | New RoughSumiMaterial, SumiRibbonMeshBuilder | coherent bounded edge fray |
| IN24-11 | P1 | DirectionalInkPainter, PersistentPathStore | dry fibers, stable seed, seam |
| UX24-12 | P1 | DualTraceControlsV2, Track calibration UI | compact motion/roughness + debug |
| QA24-13 | P1 | CI + browser + pixel tests | no regression V2.3/Map/1P/2P |
| QA24-14 | P2 | hardware source and 30-min soak | latency/FPS/memory/Blackout report |

**Order:** SP24-01/02/03 → SP24-04/05 → SP24-06/07 → MS24-08/09 → IN24-10/11 → UX24-12/QA24-13 → QA24-14. Rough shader dapat dibuat paralel memakai fixed centerline fixture, tetapi tidak dipakai sebagai bukti coverage.

## 14. Migration and rollback

1. Simpan benchmark V2.3 MP4 asli, screenshot dan report sebelum mengubah renderer.
2. Tambahkan debug provenance/trace terlebih dahulu, tanpa mengubah stage output.
3. Aktifkan FloorResolver baru di belakang feature flag.
4. Pindah ke fusion V2.4 dan bandingkan range di coordinate space sama.
5. Pasang smoother per aktor; jangan mengganti continuity V2.3 safety rules.
6. Tambahkan Rough Sumi preset, roughness default konservatif dan seeded deterministic.
7. Jalankan regression: synthetic adversarial + real MP4 browser + screenshot pixel.
8. Jalankan webcam/HP dan stage physical projector/Blackout, 30-minute soak.
9. Promote ke default hanya setelah P0 lulus; Vercel tidak diubah tanpa arahan baru.
10. Rollback ke V2.3 memulai stroke baru dengan transformVersion yang benar; retained ink tetap ada sampai Clear operator.

## 15. Failure modes and recovery

| Failure | Tindakan |
|---|---|
| Camera polygon invalid | Tolak calibration, tampilkan alasan, jangan menggunakan profil salah |
| Source crop/mirror berubah | Invalidate transformVersion dan candidate, minta rekalibrasi |
| Dua aktor crossing ambigu | Per-actor CUT/HOLD; dilarang menghubungkan A ke B |
| Hip-only berlarut-larut | Discard candidate + CUT, no cap |
| Support recovery jauh | CUT, start baru pada support valid |
| Coverage menyusut | Debug raw/fused/range; hindari auto stretch lukisan |
| Smoothing terlalu berat | Preset lebih responsif untuk TURN; uji overshoot |
| Rough fray memutus centerline | Fallback ke smooth ribbon dan blokir preset bermasalah |
| MP4 seek/lag/stale | Reset temporal epoch; no outdated frame deposit |
| Perf FPS drop | Turunkan LOD serat dahulu; jangan mengubah path accuracy |
| Map preview hilang | Isolasi renderer-subscription, pertahankan Blackout fisik |

## 16. Definition of Done

- [ ] Trace nyata memperlihatkan source support, fusion, smoothing dan path A/B dengan timestamp cocok.
- [ ] Dua lintasan menjangkau posisi ujung kiri/kanan yang sesuai dengan MP4 dan kembali mendekat saat koreografi menghendaki.
- [ ] Tidak ada A/B swap dan unsafe gap bridge.
- [ ] Temporal movement halus serta menjaga hesitation, STOP, pivot dan turning.
- [ ] Rough Sumi terasa kasar pada serat/tepi; centerline tetap luwes dan utuh.
- [ ] Footprint tetap contact-only, menimpa garis ketika bersinggungan dan memudar.
- [ ] Compose/Map/Perform/fullscreen/PNG konsisten, output fisik Blackout aman.
- [ ] Browser real-MP4, unit/pixel, source stress dan 30-minute soak terdokumentasi.
- [ ] Fallback V2.3 dapat dipakai kembali tanpa mengganti kamera atau merusak kalibrasi.

**Status:** technical architecture siap untuk implementasi. Upload dokumen ini tidak berarti aplikasi V2.4 sudah diperbarui atau dideploy.
