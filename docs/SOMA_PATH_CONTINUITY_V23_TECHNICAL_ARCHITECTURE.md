# SOMA — Path Continuity Engine V2.3
## B. Technical Architecture & Step-by-step Algorithm

**Tanggal:** 23 November 2026  
**Status:** Desain implementasi, kode aplikasi belum diubah oleh dokumen ini  
**Rujukan produk:** [PRD V2.3](SOMA_PATH_CONTINUITY_V23_PRD.md) · [Issue Register](SOMA_PATH_CONTINUITY_V23_ISSUES.md)  
**Baseline:** V2.2 Foot+Hip Fusion pada main, commit audit awal 784ba6d4

## 0. Temuan kode yang memengaruhi rancangan

1. **ActorPathTracker:** gap video normal 900 ms; CUT dapat muncul lebih awal untuk uncertain-gap ketika dt >390 ms dan perpindahan >5 px. CUT memfinalisasi stroke yang aktif; START sesudahnya memiliki strokeId lain.
2. **ActorGroundTrajectoryEstimator V2.2:** frame hip-only disimpan sebagai pending maksimal 250 ms/enam frame. Saat foot recovery valid, pending observations dipancarkan sekaligus; saat mismatch, pending dibuang dan CUT terjadi.
3. **GroundTrajectoryEngineV2:** mengambil foot observations dari PathObservationRouter, menggabungkan estimator hip, mengecek replay coverage, lalu mengirim events ke ActorPathTracker. Belum ada audit eksplisit per *bridge candidate* dan keputusan commit.
4. **PersistentPathStore:** gambar dibuat per PathSample/spline span; committed atlas dan active tail disatukan ke composite. STOP saat ini tidak memfinalisasi (baik untuk kelanjutan jalur). CUT memfinalisasi. Repaint active tail memanggil paintSegment sehingga depositCount naik walau bukan stroke unik.
5. **PathSplineFitter:** centripetal sampling dengan koridor ±7 px pada segmen terdekat, membatasi overshoot.
6. **SumiRibbonMeshBuilder:** head taper memakai absolute arc length, tail taper dipakai ketika finalTail true; lebar yang dibatasi 6–42 px.
7. **DirectionalInkPainter:** mesh polygon dengan round joins dan serat deterministik berdasarkan seed/arc bins; material dapat tampak retak pada batas segmen bila seam diuji hanya secara visual.
8. **LineTrailsV3:** frame loop membangun pose dan events, memutus pada seek/stale/source/preview changes, lalu merender V2 dan meneruskan finalRaster ke Map. Proses inference pose harus tetap tunggal.

### Implikasi

V2.3 tidak memerlukan renderer kuas baru dari nol. Perubahan pertama: **pemilik continuity state tunggal, kontrak commit/reject, lifecycle CUT, dan tes sambungan piksel**. Baru setelah itu memoles material tinta.

## 1. Arsitektur

~~~mermaid
flowchart TD
 S[MP4 / Webcam / HP / Simulator] --> A[Approved Pose Snapshot A/B + timestamp]
 A --> F[Foot & Hip / ActorMotionFrame V2.2]
 F --> G[ActorGroundTrajectoryEstimator]
 G --> C[ContinuityCoordinator V2.3 per actor]
 C -->|accepted observations + validated bridge| P[ActorPathTracker START/ADD/TURN/STOP/CUT]
 C -->|candidate only| Q[Studio diagnostic overlay only]
 C -->|reject/CUT| P
 P --> I[PersistentPathStore with joined ribbon]
 F --> T[Foot contact stamps + Upper brush modulation]
 T --> X[DualTraceLayerCompositor]
 I --> X
 X --> R[One clean 1600x900 FLOOR raster]
 R --> O[Compose / PNG / Map / Perform]
~~~

**Satu otoritas kandidat:** estimator V2.2 dan coordinator V2.3 tidak boleh masing-masing menyimpan hip-only buffer sendiri. Refactor V2.2 agar candidate, recovery evidence dan decision ada pada satu *ActorContinuityState* milik coordinator, atau pindahkan kepemilikan buffer V2.2 ke coordinator melalui satu API. Jangan menambahkan lapisan prediksi kedua setelah estimator yang akan menggandakan commit.

Satu actorId hanya punya satu state aktif. Video seek, source/profile change, atau identity ambiguity menutup state tersebut. Output Map tidak boleh mengubah koordinat tracking; projector warp diterapkan satu kali setelah compositor.

## 2. Kontrak tipe usulan

~~~ts
type Actor = 'A'|'B';
type ContinuityPhase = 'OBSERVED'|'SOFT_GAP'|'RECOVERING'|'HARD_CUT';
type Evidence = 'dual-foot'|'one-foot+hip'|'hip-only'|'invalid';
type CutReason =
 'identity-ambiguous'|'source-switch'|'seek'|'calibration-change'|
 'clock-reversal'|'stale'|'gap-expired'|'teleport'|
 'recovery-too-far'|'direction-mismatch'|'invalid-coordinate'|
 'preview-off'|'operator-reset';

type Point2 = {x:number;y:number};

type ContinuityInput = {
  actor:Actor;
  sourceKey:string;
  clipStableId:string;
  sourceEpoch:number;
  transformVersion:string;           // camera-to-floor version, never projector warp
  frameMs:number;                    // approved observation presentation timestamp
  identityConfidence:number;
  observation?:{point:Point2;confidence:number;basis:Evidence};
  hipMotion?:{delta:Point2;confidence:number};
  motionScalePx:number;              // reference torso/foot support scale
  supportFoot?:'left'|'right';
  crossingAmbiguous:boolean;
  seeking:boolean;
};

type BridgeCandidate = {
  actor:Actor;
  id:string;
  strokeId:string;
  sourceKey:string;
  clipStableId:string;
  sourceEpoch:number;
  transformVersion:string;
  startedAtMs:number;
  lastAtMs:number;
  predicted:ReadonlyArray<{atMs:number;point:Point2;confidence:number}>;
  lastConfirmed:Point2;
  lastTangent?:Point2;
};

type BridgeVerdict =
 | {kind:'ACCEPT';candidateId:string;confirmedPoints:ReadonlyArray<{atMs:number;point:Point2}>}
 | {kind:'HOLD';candidateId:string}
 | {kind:'REJECT';candidateId:string;reason:CutReason};

type PathMetrics={
  pathLengthPx:number;
  longestContinuousPx:number;
  strokeCount:number;
  acceptedBridges:number;
  rejectedBridges:number;
  cutCounts:Partial<Record<CutReason,number>>;
  currentPhase:ContinuityPhase;
  lastAcceptedFrameMs?:number;
};
~~~

Kontrak baru tetap kompatibel dengan PathEvent yang sekarang. Candidate bukan PathEvent dan **tidak boleh masuk PersistentPathStore** sampai ACCEPT. Bentuk event final tetap START/ADD/TURN/STOP/CUT; branch fallback V2.2 tersedia di setting studio.

## 3. State machine continuity

| Dari | Peristiwa | Ke | Tindakan |
|---|---|---|---|
| OBSERVED | Observasi valid berikut | OBSERVED | Emit ADD/TURN bila perpindahan kumulatif cukup |
| OBSERVED | Data kaki hilang tetapi hip + identity stabil | SOFT_GAP | Buat candidate milik actor, tanpa tinta permanen |
| SOFT_GAP | Hip valid dan dalam budget | SOFT_GAP | Tambah predicted point, tanpa tinta permanen |
| SOFT_GAP | Kaki kembali | RECOVERING | Uji jarak, arah, waktu, identity, transform |
| RECOVERING | Semua gate lolos | OBSERVED | Commit candidate sekali, pertahankan strokeId |
| RECOVERING | Salah satu gate gagal | HARD_CUT | Discard candidate, emit CUT(reason) |
| SOFT_GAP | Budget habis, hip/identity ambigu | HARD_CUT | Discard; actor-scoped CUT |
| OBSERVED | Aktor diam, pose tetap valid | OBSERVED | STOP satu kali; simpan endpoint; tidak reset strokeId |
| OBSERVED / SOFT_GAP | Seek, calibration/source/epoch change | HARD_CUT | Discard candidate; CUT; reset tracking & temporal state |
| HARD_CUT | Bukti baru berkualitas cukup | OBSERVED | START baru, tidak menggambar jembatan ke jalur lama |

**STOP bukan CUT.** Dalam kondisi berhenti normal, tidak ada tinta tambahan. Saat aktor mulai lagi, lanjutkan strokeId bila continuity masih sah. Kalau gerakan kembali setelah gap panjang dengan posisi baru yang tak didukung, lakukan HARD_CUT.

## 4. Algoritme A — Frame normalization & quality gate

1. Ambil approved snapshot dari SourceFrameNormalizer dan dualTracePoseFrames, **tanpa deteksi kedua**.
2. Bangun ActorMotionFrame dari keypoint hip 23/24, head/shoulder dan FootBrushPose saat tersedia.
3. Untuk setiap A/B, jaga satu clock monoton. Reject duplikasi frameAtMs, seek/sourceKey tak cocok, lag pose melebihi ambang sumber (MP4 saat ini memakai gate sekitar 320 ms).
4. Konversi semua posisi ke satu stageSpace canonical 1600×900; camera-to-floor hanya di Track/Spatial Engine.
5. Catat body/hip/feet confidence dan track identity. Tidak ada nilai zero untuk koordinat invalid.
6. Jika frame yang sama sudah tercakup replay ledger, jangan memperbarui state yang akan menghubungkan time span lama ke frame baru.
7. Kirim setiap actor frame yang valid ke coordinator bersama source/epoch/transform version.

## 5. Algoritme B — Motion integration dan gap candidate

Pada OBSERVED, pakai V2.2 foot+hip fusion sebagai displacement utama; terbitkan observasi sah. Ketika telapak tidak tersedia, coordinator menahan kandidat berdasarkan perpindahan hip lokal yang dibatasi, bukan koordinat absolut hip sebagai ground point.

~~~ts
function ingestActor(s:ActorState,input:ContinuityInput):Decisions {
 if (sourceOrTransformChanged(s,input) || input.seeking ||
     input.crossingAmbiguous || input.identityConfidence < MIN_IDENTITY)
   return rejectCut(s,'identity-ambiguous'); // reason specialized per condition

 if (input.observation && reliable(input.observation)) {
   if (s.phase === 'SOFT_GAP') return recover(s,input);
   return acceptObserved(s,input);
 }

 if (hasStableHip(input) && s.phase==='OBSERVED')
   return beginCandidate(s,input);       // NO painter calls

 if (s.phase==='SOFT_GAP' && candidateStillWithinBudget(s,input))
   return extendCandidate(s,input);      // NO painter calls

 return rejectCut(s,'gap-expired');
}
~~~

**Parameter awal untuk uji, tidak diklaim optimal:**
- Micro-gap 1–3 frame; hip-only candidate maksimal 250 ms **atau** enam frame pada 24 FPS, pilih batas yang lebih cepat.
- Track identity confidence awal ≥0,65; hip confidence awal ≥0,55; recovery foot confidence awal ≥0,55.
- Integrasi hip mengikuti perbedaan posisi di image-space, diproyeksikan secara lokal dari last ground-foot anchor bila camera-floor calibration valid. Jangan proyeksikan hip sebagai titik lantai.
- Kecepatan maksimal dan perpindahan dinormalisasi menggunakan torso/foot scale serta dt, bukan satu angka piksel untuk seluruh kamera.
- Jumlah predicted points maksimal enam per actor. Buffer diperbarui hanya pada frame baru.

## 6. Algoritme C — Safe bridge verdict

Pada recovery, cek berurutan:

1. actorId dan stable tracker identity sama.
2. sourceKey, clipStableId, sourceEpoch, transformVersion dan mode koordinat persis cocok.
3. Gap duration di bawah batas dan timeMs monoton.
4. Tidak ada unresolved crossing atau occlusion.
5. Hip/foot confidence pemulihan memadai.
6. Endpoint displacement berada dalam reachable envelope berdasarkan dt dan skala tubuh.
7. Tangent sebelum gap serta garis menuju recovered point berada dalam toleransi arah. Awal toleransi ±45° untuk straight/curved walk; pivot yang dibuktikan pose boleh berbeda. Uji secara khusus agar belokan 90° yang nyata tidak salah diputus.
8. Reconciliation error dari last predicted ke recovered support anchor lebih kecil daripada corridor threshold; awal maksimal sekitar 0,6 torsoScale (disesuaikan kalibrasi).
9. Kandidat belum pernah diterima atau di-reject.

Hanya setelah semua lolos, kirim buffered points **dalam urutan waktu** ke path tracker dengan strokeId lama. Idempotency key: actor + source/epoch + candidateId + recovery frameMs. Setelah ACK, hapus candidate dari memori.

Gagal → discard buffer; CUT actor yang bersangkutan, lalu START baru hanya pada observasi sah. Jangan membuat cubic connector melintasi celah besar; STOP atau CUT dengan ujung tinta yang terlihat wajar tetap boleh.

~~~ts
function recover(s,input) {
 const result = validateBridge(s.candidate,input);
 if (!result.ok) return {cut:result.reason,accepted:[]};
 const events = convertCandidateToOrderedObservations(result.points);
 return {accepted:events,bridgeAccepted:true,strokeId:s.strokeId};
}
~~~

**Catatan implementasi:** Estimator V2.2 sekarang menghasilkan buffered observations setelah foot recovery. Refactor agar accepted candidate keluar **tepat satu kali** dan tidak dibuffer ulang pada engine lapisan berikutnya.

## 7. Algoritme D — Path event lifecycle

- **START:** buat strokeId setelah evidence pertama sah.
- **ADD/TURN:** keluarkan berdasarkan *cumulative traveled distance* dan direction hysteresis; threshold sekarang ≥4 px dapat dipertahankan sebagai min knot spacing bila residual selalu diakumulasi.
- **STOP:** satu event saat benar-benar berhenti; jangan terus memberi STOP per frame.
- **SOFT_GAP:** track ditandai suspended, bukan CUT; tidak ada ADD provisional pada committed store.
- **RECOVERING:** emit buffered ADD/TURN memakai strokeId dan waktu yang sama, tanpa START baru, dengan idempotency.
- **CUT:** hanya saat source/identity/transform berubah, gap gagal pulih atau safety gate lain gagal.
- **Clock/replay:** seek/backwards langsung CUT. Jangan meneruskan trajectory dari epoch sebelumnya.

**Penting:** kontrak ActorPathTracker saat ini sudah memiliki uncertain-gap saat dt>390 ms. Setelah continuity validasi recovery mengirim sampel buffered secara berurutan, tracker tidak boleh mengeluarkan CUT kedua untuk span yang baru diputuskan ACCEPT. Tambahkan API acceptValidatedBatch / ingestAcceptedRange dan tes no-double-cut; jangan menonaktifkan seluruh safety gates tracker.

## 8. Algoritme E — Joined ribbon renderer

Sumber spline saat ini berupa Catmull–Rom centripetal per interval knot. Pertahankan metode tersebut, tetapi benahi lifecycle raster:

1. Simpan satu retained StrokeRecord per actor/strokeId yang berlaku sepanjang perjalanan.
2. Satu arc length kumulatif dari awal stroke. Jangan reset pada STOP, commitStable, atau bridge tervalidasi.
3. Bentuk mesh dengan posisi/tangent/width identik pada batas dua span. Ambil sampel overlap tetangga untuk join di area unstable tail.
4. **Taper head** hanya pada awal logical stroke dan **tail** hanya ketika CUT/finalize, atau saat output secara artistik memang diminta menutup stroke.
5. Commit bagian stabil **sekali** ke committed atlas. Tail yang belum stabil digambar ulang pada active atlas dari geometri, bukan ditimpa berulang pada committed.
6. Gunakan deterministic grain dengan seed strokeId + global arc bin, sehingga pola tinta tidak berubah setiap render.
7. Fill joined ribbon + round join dengan clipping pada batas mesh; uji di pusat centerline pada tiap seam untuk mendeteksi putih yang mengintip.
8. Saat candidate diterima, jangan langsung melukis satu spline panjang melintasi luar koridor support; interpolasi hanya untuk gap pendek yang tervalidasi.
9. Jika color/palette/layer berubah, recolor atlas yang sudah ada, tanpa reset path.
10. Di mode Tapak depan, gambar Footprints setelah Path; waktu fade footprint mengikuti presentation clock.

### Pitfall spesifik kode saat ini

Di PersistentPathStore, paintSegment menambah counter commits pada setiap penggambaran segment, termasuk penggambaran ulang active tail saat refreshTail. Pindahkan statistik ke event/commit yang **unik**, misalnya committedSpanKey = strokeId + startArcBin + endArcBin. Pengukuran panjang Path dihitung dari pusat lintasan yang diterima, bukan dari jumlah brush draw.

Gunakan pixel golden tests untuk:
- committed-to-active seam;
- dua segmen bertemu di TURN;
- taper di awal/akhir stroke;
- bridge diterima tanpa taper baru;
- CUT yang benar menghasilkan dua stroke terpisah;
- repaint tail/palette tidak menggelapkan tinta atau menambah deposit unik.

## 9. Algoritme F — Layer compositor dan output

1. Layer Path A/B menerima ribbon final.
2. Layer Footprint menerima contact-only caps A/B dengan decay; **tidak pernah membuat cap dari hip-only**.
3. Head/shoulder memodulasi width/grain dengan faktor bounded; aksen terpisah opsional dimatikan default bila mengganggu.
4. Composite memberi background putih sekali, urutan layer dari pilihan operator; warna tiap channel terpisah.
5. Publish satu finalRaster per presentation frame ke Compose, clean fullscreen, PNG, SurfaceComposer FLOOR, Map pre-warp dan Perform.
6. Blackout mengendalikan jalur keluaran fisik, bukan menghapus atlas historis.
7. Debug overlay provisional / velocity arrows / confidence / CUT labels tidak pernah masuk clean finalRaster.

## 10. Telemetry / diagnostic contract

Per actor/source/frame simpan:
- acceptedFrameCount, rejectedFrameCount, sourcePoseLagMs;
- observedFrames, hipAssistedFrames, softGapFrames;
- acceptedBridgeCount, rejectedBridgeCount, rejectReason;
- cutCounts by reason;
- pathLengthPx, longestContinuousPx, activeStrokeId, phase;
- candidateLengthPx, candidateDurationMs, recoveryResidualPx;
- render revision, committed span count, active tail repaint count (terpisah);
- last frame source version/coordinate mode.

**Rumus pengukuran:**
- pathLengthPx = penjumlahan jarak antar accepted consecutive knots dalam stroke yang sama; tidak menghitung CUT/teleport.
- longestContinuousPx = maksimum path length tiap logical strokeId.
- continuityRatio = accepted moving-path distance / manually annotated moving-path distance pada benchmark, setelah normalisasi koordinat (metrik QA, tidak boleh dipakai tanpa anotasi).
- acceptedBridgeRatio = accepted / (accepted + rejected), dengan total dan alasan tetap ditampilkan. Rasio tinggi saja tidak berarti lebih baik: bridge yang salah lebih berbahaya.

## 11. Test matrix

**Unit:** accepted micro-gap, rejected long-gap, endpoint jauh, tangent reverse, pivot valid 90°, actor crossing, hip unavailable, no foot stamp, STOP restart, clock reversal, source/epoch/calibration switch, duplicate replay candidate, accepted batch event timestamps.

**Pixel:** no white seam, single head taper and single final tail, stable grain across active/committed spans, A/B recolor, independent footprint fade, no ghost after Clear.

**Browser E2E:** 
- real MP4 15,04 detik: snapshots t0/1/2/3/4/5/6/7/8/10/14 plus source and XY plot;
- synthetic A/B arc + three-frame gap, 180° reversal, stop/restart, occlusion/crossing;
- pause, seek, loop, source change, V2.2 fallback, fullscreen, Map raster and Blackout.

**Physical QA:** 30 min stage soak, webcam/HP wired and wireless, source disconnect/reconnect, projector recovery under Blackout.

Real MP4 must be supplied as reproducible CI fixture with permission to store it, or run in controlled QA outside the public repository and attach redacted artifacts. Do not claim E2E real-video coverage while the test only synthesizes actor coordinates.

### Acceptance gates

- 100% of hard-cut/identity safety fixtures produce **no unsafe bridge**.
- 100% of accepted short-gap fixtures yield **one logical stroke** and a single committed candidate.
- No white-hole pixels on validated centerline ribbon joins at native 1600×900.
- STOP/paused frame never increases accepted path length or unique committed spans.
- Actual MP4 0–7 s shows visual A/B travel; 8–14 s remains visually stable, judged against annotated video.
- No divergence between Compose final raster, pre-warp Map and clean fullscreen on same timestamp.
- Build, unit, browser, pixel and live performance QA pass before release; failing P0 blocks V2.3 default.

## 12. Migration plan

**M0 — Instrumentation / fixture:** add frame/bridge metrics without changing path behavior. Save source and outputs of current V2.2 as baseline. Establish golden MP4 annotations.

**M1 — Actor continuity contract:** refactor existing V2.2 pending buffer to one owner and expose candidate/recovery decision; add actor-scoped state transitions and deterministic rejection reasons.

**M2 — Tracker handshake:** implement validated batch ACK, STOP/resume semantics, idempotent replay coverage, per actor CUT; V2.2 still selectable.

**M3 — Ribbon seam:** alter PersistentPathStore stable/active boundary and centerline join tests; fix deposit metric count; no new renderer technology.

**M4 — Output & QA:** wire diagnostics, layer overprint, clean raster; run offline MP4, browser, all sources, physical projector and 30-min soak.

Flag suggestion: pathContinuityMode='v2.2'|'v2.3', default V2.2 until P0 signoff. Avoid auto-promoting Vercel.

## 13. Interface/module change list

| Existing/new file | Responsibility |
|---|---|
| src/footprints/lines/v3/ActorContinuityCoordinator.ts (new) | Actor state, candidate, veto, recovery verdict |
| src/footprints/lines/v3/ContinuityBridgeValidator.ts (new) | Bounded distance/tangent/time/identity gates |
| src/footprints/lines/v3/ActorGroundTrajectoryEstimator.ts | Yield one candidate owner and approved hip/foot evidence |
| src/footprints/lines/v3/GroundTrajectoryEngineV2.ts | Coordinator integration, candidate ACK, one event flow |
| src/footprints/lines/v3/ActorPathTracker.ts | Validated batch, STOP/resume, actor-scoped CUT, cut reason |
| src/footprints/lines/v3/PersistentPathStore.ts | Logical stroke, stable/active joined spans and truthful counters |
| src/footprints/lines/v3/PathSplineFitter.ts | Shared tangent samples at span boundaries |
| src/footprints/lines/v3/SumiRibbonMeshBuilder.ts | Consistent width/taper/overlap |
| src/footprints/lines/v3/DirectionalInkPainter.ts | Seam-safe clipping, stable material grain |
| src/footprints/dual-trace/DualTraceV2Renderer.ts | Coherent actor layers / overprint |
| src/studio/v3/LineTrailsV3.tsx | Source/preview orchestration, debug, output |
| src/studio/v3/DualTraceControlsV2.tsx | Operator state and diagnostics |
| tests/ground-trajectory-v23.test.ts (new) | Transition/gap/crossing/idempotency |
| tests/path-ribbon-seams-v23.test.ts (new) | Segment continuity and taper |
| e2e/path-continuity-v23.spec.mjs (new) | Real-video and browser screenshots |
| .github/workflows/path-continuity-v23-qa.yml (new) | CI gate on source changes |

## 14. Rollback and failure policy

- Jika candidate dianggap salah, discard, CUT, log reason; jangan memaksa bridge supaya garis tampak bagus.
- Jika engine V2.3 tidak sehat, operator bisa kembali ke V2.2 dalam Compose tanpa kehilangan sumber atau kalibrasi. Jangan mencampur ink history dari dua metode tanpa session version.
- Jika preview/current pose hilang, retained ink dapat tetap terlihat; status pose harus menyampaikan gangguan.
- Jika Map/output gagal, physical Blackout mengunci proyektor. Data pose tidak disimpan sebagai cap tambahan selama output error.
- Tidak ada jaminan fisik panggung sebelum live hardware QA selesai.

**Kesimpulan teknis:** kontinuitas dibuktikan oleh identitas, waktu, lintasan, dan render boundary bersama. Jumlah deposit tidak cukup. Jangan mengubah tebal kuas lagi sebelum coordinator dan ribbon QA lulus.
