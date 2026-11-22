# SOMA V3.5 — Path-first Sumi Engine
## Algoritme / Render Pipeline Step-by-Step

**23 November 2026 · Spesifikasi implementasi (belum kode produksi)**  
**Basis:** `SOMA_PAINTERLY_V3_5_PATH_FIRST_SUMI_ENGINE_PRD.md` dan audit `main` SOMA V3.4 setelah PR #193.  
**Lokasi:** `src/footprints/lines/v3/`, `src/studio/v3/LineTrailsV3.tsx`, `SurfaceComposer.tsx`.  
**Tujuan:** **dua jalan kontinu yang ditulis dua aktor**, dengan footprint sementara dan path tinta menetap. **Tidak menyentuh Vercel.**

---

## 0. Invariant yang tidak boleh dilanggar

1. **Satu `ActorPathTrack` per aktor A/B pada mode default.** Empat kaki tetap menjadi observasi, tetapi hanya dua jalur utama dilukis. Mode `foot-path` tetap opsional, terpisah dari default.
2. Selama stroke aktif, **satu `ADD` tidak menjadi polygon transparan mandiri**. Raster hanya berubah pada span yang final; ujung terbaru tetap bisa digambar ulang di `activeTailCanvas`.
3. `STOP` yang dideteksi **tidak otomatis menjadi `CUT`**. Pada STOP, pusat stabil dan pigmen akhir boleh bertambah **sekali per dwell event**, bukan per frame.
4. `CUT`/source switch/seek/blackout/timestamp reversal **mengakhiri segmen** dan menggambar ujung meruncing. **Tidak** menghapus tinta yang sudah dibuat.
5. Hanya `CLEAR` / sesi lukisan baru menghapus committed canvas, active tail, footprint sementara, index dedup, dan bounds.
6. Perubahan bobot, material, atau warna berlaku **mulai stroke berikutnya** atau segmen baru yang terkonfirmasi. Raster lama tidak dicat ulang.
7. Canonical raster = **1600 × 900**; di luar Map, semua koordinat diubah ke basis tersebut **sekali**. Preview fit tidak pernah ditulis kembali ke world coordinates/Map.
8. Aktor A `#E44F32`, B `#242424`; latar `#F5F5F2`.
9. Default `Path Sumi`, `Actor Path`, bobot **26px** (slider 8–64px, preset Path final width cap 42px), footprint fade **6000ms**, tinta **persistent**.
10. V3.4 tetap dapat dipilih untuk pembandingan; tidak memaksa perubahan `SourceFrameNormalizer`, pose detector, Map, F3 Capture, atau kontrak output Perform.

## 1. Rute data tunggal

```text
Webcam / kamera HP / MP4 / 3D / demo
     ↓ SourceFrameNormalizer.ts (REUSE)
FootV3Sample[] + V3Input {sourceKey, frameMs, ready, paused, seeking}
     ↓ FootBrushPoseAdapter.ts (REUSE)
FootBrushPose[]  [A-L, A-R, B-L, B-R; provenance]
     ↓ PathObservationRouter.ts (NEW)
ActorPathObservation[] [1 per actor, confidence + evidence]
     ↓ ActorPathTracker.ts (NEW)
PathEvent START | ADD | TURN | STOP | CUT (actor-bound strokeId)
     ↓ PathSplineFitter.ts (NEW)
PathSpline[] [stable part + last N knots as editable tail]
     ↓ SumiRibbonMeshBuilder.ts (NEW)
Fill geometry [joined strip, round join, taper only at true START/CUT]
     ↓ DirectionalInkPainter.ts (NEW)
Material Sumi + tangent-aligned fibers + event-gated micro-splatter
     ↓ PersistentPathStore.ts (NEW)
Committed canvas + replaceable active tail + source-aware media dedup
     ↓ PainterlyCanvasRenderer.ts (MODIFY)
Warm white | committed ink | active tail | footprint 6s | optional debug
     ↓ Stage Monitor / clean fullscreen
```

## 2. STEP 0 — Normalisasi + time domain

`SourceFrameNormalizer.ts` yang sudah ada menghasilkan `V3Input`. Gunakan `frameMs` sebagai **timestamp sumber** untuk ink events; `presentationMs` hanya mengendalikan footprint fade dan visual playback. `sourceKey` milik video mengandung `clip identity : segment : performer count`; `clipStableId` harus memisahkan identitas clip stabil dari segment/epoch untuk dedup.

- `ready === false` → jangan tambah knot. Setelah grace window dan bukti pelacakan tidak valid, emit `CUT` sekali.
- `paused === true` → jangan ingest pose baru, jangan tambah tinta; umur tapak pada MP4 mengikuti waktu media yang dijeda.
- `seeking === true`, waktu mundur, `sourceKey` berubah, actor count/identity berubah → `CUT` semua active tracks dan reset stabilizer; **committed canvas tetap**.
- Video replay pada interval yang sama → dedup di *committed media arc intervals*, bukan sekadar cache 3000 event terakhir.

```ts
const frame = normalizeTrajectoryInput(sourceOptions);
if (frame.seeking || changedSource(frame.sourceKey)) {
  pathTracker.cutAll('seek-or-source-switch');
  pathStore.finalizeActiveTails();
  observationRouter.reset();
}
if (!frame.ready || frame.paused) return renderOnly();
const batch = adaptFootBrushFrame(frame.samples, frame.sourceKey,
                                    frame.frameMs, adapterState);
```

**Jebakan V3.4:** `p.engine.reset('seek')` dan `p.impressions.reset()` boleh membersihkan data sementara, tetapi **tidak** pernah memanggil `pathStore.clearPainting()`.

## 3. STEP 1 — `PathObservationRouter`: empat kaki menjadi dua pusat jalur

Buat satu entry untuk `actorId` A dan satu untuk B. Per actor, pilih observasi kaki yang confidence-nya **≥0.55**, normalisasi `(x ×1600, y ×900)`, kelompokkan frame/epoch yang sama; jangan campur A/B.

**Pilihan support point (dari yang paling dapat dipercaya):**
1. Bila satu kaki punya indikasi tumpuan tepercaya: gunakan kaki penopang sebagai anchor gerak, dibaur dengan proyeksi pusat aktor sebelumnya (crossfade terbatas).
2. Bila dua kaki valid dan kontak tidak pasti: pusat berbobot confidence, `p=(wL·pL + wR·pR)/(wL+wR)`; tandai `estimated-ground-projection`.
3. Bila hanya satu kaki valid: prediksi pusat dari `prevCenter + boundedVelocity × dt`, koreksi kecil ke observasi kaki; **jangan langsung snap** ke kaki yang baru terlihat.
4. Tanpa kaki valid, A/B ambigu, sumber berubah atau ground basis tidak sama: jangan emitir observasi, `CUT` bila gap melewati ambang.

```ts
interface ActorPathObservation {
  actorId: 'A' | 'B';
  sourceKey: string; clipStableId: string;
  epoch: number; timeMs: number;
  point: {x:number; y:number}; // canonical pixels
  confidence: number;
  evidence: 'supported-step' | 'estimated-ground-projection';
  provenance: 'video-estimate' | 'detected-estimate' | 'simulated';
  supportFoot?: 'left' | 'right';
  footEvent?: 'left-contact'|'right-contact'|'pivot'|'none';
}
```

Estimasi kontak dari video 2D tetap berlabel **estimasi**; tidak menyatakan berat badan atau gaya hantaman sebenarnya. `ActorPathTracker` menghormati actor identity dari pose router; bila aktor tertukar sementara crossing, suppress observasi ambigu daripada melukis crossover palsu.

## 4. STEP 2 — Stabilizer + continuity gates

Setiap aktor menyimpan `lastAcceptedAt`, `lastCenter`, `velocity`, `lastDirection`, `stablePoint`, `lastSupportFoot`, `source/epoch`, `activeStrokeId`.

Usulan parameter **awal untuk diuji terhadap fixture** (bukan angka ilmiah final):

| Parameter | Nilai awal | Fungsi |
|---|---:|---|
| confidence gate | 0.55 | Menolak pose rapuh |
| jitter deadband | 2 px | Diam tidak membuat knot |
| minimum knot spacing | 4 px | Menahan dot terlalu rapat |
| maximum interval for continuity | 390 ms | Gap lebih lama harus `CUT` |
| bounded jump | `min(180, 25 + 1.2×dt)` px | Anti teleport dari V3.4, evaluasi ulang per fixture |
| turn event threshold | 12° antara tangent yang valid | Belok terukur |
| stop velocity | < 3 px per 200 ms | Dwell, tidak menambah panjang path |
| heading-only wobble | suppress jika posisi belum maju | Hindari cipratan palsu |

Filter **one-euro / adaptive EMA** bisa dipakai pada pusat aktor dengan `dt` yang valid. Jangan memaksa spline melewati titik kosong atau aktor lain. Pada `CUT`, release active stroke dan reset state pengamatan; cat yang sudah disimpan tetap utuh.

## 5. STEP 3 — Event state machine per aktor

```text
IDLE --valid stable observation--> START
ACTIVE --movement >= minSpacing--> ADD
ACTIVE --valid curvature threshold--> TURN (also ADD)
ACTIVE --valid dwell--> STOP (once per dwell)
STOPPED --new valid movement--> ADD (same stroke)
ACTIVE/STOPPED --gap/seek/switch/lift/ID ambiguity--> CUT → IDLE
ANY --explicit user Clear--> CLEAR painting session → IDLE
```

```ts
type PathEvent =
  | {kind:'START'; actorId:'A'|'B'; strokeId:string; point:Pt; timeMs:number}
  | {kind:'ADD'|'TURN'; actorId:'A'|'B'; strokeId:string; point:Pt;
     timeMs:number; lengthDeltaPx:number; turnRad?:number}
  | {kind:'STOP'; actorId:'A'|'B'; strokeId:string; timeMs:number}
  | {kind:'CUT'; actorId:'A'|'B'; strokeId:string; timeMs:number;
     reason:'seek'|'gap'|'lift'|'source-switch'|'ambiguous-id'|'blackout'|'teleport'};
```

`strokeId = paintingSessionId/actorId/sourceEpoch/segmentCounter` sehingga `A` tidak pernah menulis pada track `B`. Satu `ADD` memperpanjang **centerline yang sama**. Tidak boleh membuat `strokeId` baru setiap frame.

## 6. STEP 4 — `PathSplineFitter`: path yang mengikuti gerak

Input minimal empat knot berurutan untuk cubic centripetal Catmull–Rom (alpha=0.5). Pada dua–tiga knot pertama, pakai linear/quadratic yang konservatif. Setiap kali knot baru datang:

1. Pegang 2–4 knot terakhir sebagai **active tail** yang masih boleh berubah.
2. Hitung spline lokal, bukan spline ulang atas seluruh sesi.
3. Resample berdasarkan arc length dengan jarak **≤ 0.2 × lebar lokal** (sekitar 5.2 px pada 26 px).
4. Keluarkan tangent `T = normalize(P(s+ε) - P(s−ε))` dan normal `N=(-Ty,Tx)`.
5. Cegah overshoot > 6–8 px terhadap polyline pengamatan dan batasi belokan mendadak. Bila batas gagal, fallback ke quadratic / linear lokal agar path setia pada gerak.
6. Tandai sample mana yang **stable**, mana yang **editable**.

**Uji:** `straight-walk` lurus dan tanpa seam; `avoidance-S` tetap S; `sharp-turn` tidak melingkar berlebihan; `occlusion-return` tidak membuat jembatan palsu.

## 7. STEP 5 — Lebar kuas, taper dan join

Default `W0=26` px. Faktor visual dibatasi:

```ts
const wRaw = W0 * fSpeed * fCurve * fConfidence;
const bodyWidth = clamp(wRaw, 8, 42);  // Path preset cap
// fSpeed ~ [0.85, 1.15], fCurve ~ [0.90, 1.20],
// fConfidence ~ [0.90, 1.00] ONLY after observation gate.

const headEnvelope = smoothstep(0, 1, s / (1.5 * W0));
const tailEnvelope = isFinalized
  ? smoothstep(0, 1, (strokeLength - s) / (3.0 * W0))
  : 1; // DO NOT taper on each ADD
const width = bodyWidth * Math.min(headEnvelope, tailEnvelope);
```

Offset ribbon:

```ts
left(s)  = P(s) + N(s) * width(s)/2;
right(s) = P(s) - N(s) * width(s)/2;
```

Gunakan **rounded joins** dan width interpolation di titik belok; untuk miter yang terlalu panjang, cap ke round join. Setiap mesh harus **menyambung antar sampel dalam satu path**, bukan polygon event-by-event seperti V3.4. Taper ekor hanya muncul saat `CUT`. Pada STOP singkat, ujung tetap netral agar bisa lanjut tanpa kepala/ekor palsu.

## 8. STEP 6 — Rendering seam-safe (bagian kritis)

Masalah V3.4: setiap langkah adalah polygon baru → alpha ditumpuk pada batas polygon → bentuk persegi dan blob. V3.5 memakai **committed atlas + active-tail render**.

```text
committedInkCanvas (permanent; portion whose geometry can no longer change)
activeTailCanvas   (cleared and replaced on each valid geometry update)
footprintCanvas    (transient 6s)
outputCanvas       (composite only)
```

```ts
function onNewPathKnot(actor, knot) {
  const tail = fitter.append(actor, knot); // returns stableSpan + editableSpan
  if (tail.stableSpan.length) {
    const deposit = buildAndPaintStableSpan(tail.stableSpan);
    pathStore.commitOnce(deposit.stableArcIntervalKey, deposit);
  }
  pathStore.replaceActiveTail(actor, paintEditableSpan(tail.editableSpan));
}
function onCut(actor, reason) {
  const finalGeometry = fitter.finalize(actor, {taperTail: true});
  pathStore.commitFinalTailOnce(actor, finalGeometry);
  pathStore.removeActiveTail(actor);
  tracker.cut(actor, reason);
}
function paintOutput(ctx) {
  fillWarmWhite(ctx);
  draw(pathStore.committedInkCanvas);
  draw(pathStore.activeTailCanvas); // active image, not cumulative ink deposit
  draw(fadingFootprints);
  if (!fullscreen && diagnosticsEnabled) drawDebugOverlays();
}
```

**Aturan seam:** batas stable/tail berbagi satu sample/tangent; hanya rentang stable yang belum pernah disimpan dicetak (`lastCommittedArcLength` monotonik per stroke). Gunakan join/overlap buffer secara **opaque masked compositing pada satu stroke**, bukan alpha berkali-kali pada event sama. Lebar tepi berubah perlahan dalam batas yang ditetapkan.

**Alternatif implementasi lebih aman pada P0:** gunakan canvas **stroke-local** per aktor dan gambar ulang *hanya active stroke* pada layer terpisah; commit penuh saat CUT. Ini menjamin seam benar tetapi memerlukan batas panjang stroke dan snapshot berkala. Pilih setelah benchmark, jangan menggabungkan dua strategi tanpa uji dedup.

## 9. STEP 7 — `DirectionalInkPainter`: membuat kuas benar-benar terasa

Material diturunkan dari path geometry, tetap memperlihatkan garis jalan.

- **Core:** Sumi merah/arang opacity 0.72–0.85 pada satu stroke, tidak meningkat hanya karena `requestAnimationFrame` dipanggil.
- **Edge:** ragged irregularity kecil, seeded dan clipped di envelope; bleed sekitar 3–6% dari lebar lokal.
- **Fibers:** 2–5 gores serat tipis memanjang mengikuti `T(s)` (direction tangent). Dry fibers boleh mengosongkan sebagian inti lokal, tetapi tidak memutus path utama.
- **Pooling:** maksimum 1.2× tebal lokal pada STOP yang stabil; diterapkan sekali per STOP event setelah dwell gate.
- **Splatter:** `off | subtle | expressive`; default **subtle**. Pada pivot/turn yang divalidasi, 0–3 titik radius 1–3px yang mengikuti tangent dan berada dekat path. Cooldown per aktor mis. 800ms; jangan membuat splash dari estimated/low confidence/jitter.
- **Seed:** hash `paintingSessionId + strokeId + floor(arcLength/4) + materialVersion` → texture stabil pada seek/replay.
- **Material:** `path-sumi` default, `dry-ink`, `pigment-mass` opsional. Preset sekunder tidak diam-diam menulis ulang tinta yang sudah ada.

## 10. STEP 8 — `PersistentPathStore`: lifecycle dan source-safe replay

Struktur internal minimal:

```ts
interface StrokeRecord {
  id: string;
  actorId: 'A'|'B';
  clipStableId: string;
  sourceEpoch: number;
  sourceIntervalMs: [number,number];
  styleSnapshot: {color:string; weightPx:number; material:string; seed:number};
  lastCommittedArcLength: number;
  pathBounds: Rect;
}
interface PersistentPathStore {
  commitOnce(key: string, raster: ImageBitmap|HTMLCanvasElement, box: Rect):boolean;
  replaceActiveTail(actorId:'A'|'B', raster: HTMLCanvasElement|null):void;
  cutMotionSegment(actorId:'A'|'B', reason:string):void;
  clearPainting():void;
  exportPNG():string|null;
}
```

Dedup MP4 memakai kombinasi **stable clip identity + actor + covered timeline intervals**, dengan batas memori dan merge interval. Replay source yang sama tidak menambah tinta lagi, kecuali operator memilih sesi lukisan baru / replay lapisan baru secara eksplisit. Blackout menggambar hitam pada output saja; source switch, loss, pause, seek memotong aktif tetapi menyimpan committed.

Penyimpanan raster 1600×900 RGBA sekitar 5.76MB per layer. Hindari menambah full-size layer tanpa batas untuk setiap segmen atau actor-frame. `requestAnimationFrame` cukup compositing; pixel deposit terjadi hanya bila event valid. `clearPainting()` harus membersihkan buffer, indeks, bounds, dan ephemeral footprints secara konsisten.

## 11. STEP 9 — Footprint 6 detik dan compositor

Tetap gunakan `PainterlyImpressionEngine` dan `paintAuthenticFootprint`. Footprint per kaki berasal dari observasi, warna mengikuti aktor, `alpha = lifetimeOpacity(stamp.atSourceMs, presentationMs, 6000, false)`; MP4 pause membekukan waktu media. `Path` menetap. Render order tetap:

1. `#F5F5F2` background.
2. committed ink.
3. active tail.
4. footprint dengan fade.
5. diagnostics opsional di Compose, **tidak** di fullscreen clean.

Map/projector coordinates tidak bergantung pada pilihan zoom Compose. Fullscreen harus menampilkan komposisi dan aspek rasio yang identik (dengan devicePixelRatio yang aman).

## 12. STEP 10 — Integrasi pilihan engine dan UI

Di `PainterlyCanvasRenderer.ts` tambah mode terpisah `path-first-v35`, pertahankan `sumi-v34`, `foot-brush-v33`, dan `legacy-v32`. Buka Garis BETA dengan **Path Sumi** sebagai default setelah gate visual lulus. Di masa implementasi, aktifkan mode V3.5 opt-in supaya tidak mengubah versi publik sebelum di-review.

Panel ringkas:

```text
[Path Sumi] [Foot Path] [Legacy V3.4]
Bobot kuas       26 px  (8–64)
Material         Sumi | Kering | Pekat
Aksen tinta      Off | Subtle | Expressive
Tapak kaki       ✓  Hilang 6 dtk
Path             ✓  Tetap
[Coba Demo] [Bersihkan Lukisan] [Layar penuh]
▸ Detail diagnostik  ▸ Ekspor/arsip
```

Mode `Foot Path` harus memiliki kanal kiri/kanan terpisah, namun sama-sama mengambil warna aktor dan tetap menegakkan confidence/anti-jump. Ketika mode baru dipilih, cut continuity, **jangan otomatis clear lukisan lama**; tampilkan bahwa mode berubah dan style selanjutnya berlaku pada stroke berikutnya.

## 13. STEP 11 — QA fixture yang wajib

| Fixture | Peristiwa | Klaim yang harus dibuktikan |
|---|---|---|
| `straight-walk` 20s | A/B berjalan | Tepat dua path kontinu, head-tail jelas, tidak ada kotak |
| `avoidance-S` | Menghindar | Belokan S tidak overshoot dan tidak membentuk gumpalan |
| `hesitation-stop` | Berhenti lalu lanjut | STOP tidak menambah tinta per frame; path tetap satu jika track utuh |
| `sharp-turn` | Belok tajam | Join round, taper hanya pada CUT, tidak ada miter spike |
| `pivot` | Heel/toe pivot valid | Busur pendek, splatter 0–3 dan berdekatan jika gate lolos |
| `two-actor-crossing` | A/B berpapasan | Dua warna tidak tertukar, tidak jembatan lintas actor |
| `occlusion-return` | Kaki hilang/kembali | Pusat tidak snap; cut saat continuity tidak valid |
| `mp4-seek-loop` | Seek/loop/pause | Tinta lama tetap, tidak double-bake interval yang sama |
| `phone-disconnect` | HP putus/reconnect | Cut tanpa clear, tidak teleport antarsesi |
| `long-soak` 30m | 2 aktor | ≥30 FPS, painterly P95 ≤12ms target pada perangkat terukur; memory bounded |

**Bukti visual:** stage 1600×900, thumbnail 320px, setiap 10 detik/1 menit/5 menit; before/after V3.4 vs V3.5 untuk input identik; nilai reviewer artistik dan operator masing-masing ≥4/5 untuk keterbacaan path, kontinuitas, material kuas, dan hubungan dengan jalan kaki.

**Fail-release:** satu frame dengan bentuk polygon terputus di join; jembatan source/actor/seek; path mendadak menjadi blob setelah 20 detik; splatter dari low-confidence; repaint 100× menggelapkan tinta; clear/pause/blackout merusak invariant; unit/build/browser regressions pada sumber kritis.

## 14. Urutan penerapan per modul

1. `PathObservationRouter` + `ActorPathTracker` → event aktor stabil (P0).
2. `PathSplineFitter` → smooth spline dan arc-length samples (P0).
3. `SumiRibbonMeshBuilder` → connected geometry + true taper/joins (P0).
4. `PersistentPathStore` → seam-safe commit + active tail (P0).
5. Integrasi `LineTrailsV3` + `PainterlyCanvasRenderer` + source parity/QA (P0).
6. Default preset `Path Sumi 26px`, rollback, panel kontrol ringkas, visual signoff (P0).
7. `DirectionalInkPainter` advanced fibers, pooling dan splatter event-gated (P1).
8. Material presets, export/replay, evidence review tooling (P1–P2).

## 15. Release gate

P0 dapat di-merge hanya setelah tes unit/build dan QA source parity, screenshot visual per fixture, review artistik/operator, dan rollback V3.4 berjalan. GitHub Pages dipublikasikan **setelah** QA; tidak deploy Vercel. Angka performa dan kesesuaian visual di atas **target**, belum hasil benchmark.