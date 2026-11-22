# SOMA Painterly Footprint V3.4 — Algoritme Render Step-by-Step

**Spesifikasi implementasi** · 23 November 2026  
**Rujukan:** `SOMA_PAINTERLY_FOOTPRINT_ENGINE_V3_4_SUMI_PERSISTENT_STROKE_PRD.md`  
**Repo:** `pangarsagulangsatriya-prog/soma-motion-studio`  
**Status:** Algoritme rancangan; belum diimplementasikan, belum di-commit, belum di-deploy.

## 0. Kontrak hasil

- **Sapuan Sumi:** bidang tinta bersambung dan tebal, mengikuti gerak kaki yang teramati. Default `Bold`, **36 px** pada raster kanonik **1600×900**; slider 8–96 px. Hasil tinta **menetap sepanjang sesi lukisan**.
- **Tapak:** siluet anatomis kaki kiri/kanan dengan heading valid. Default memudar dalam **6 detik**.
- **Warna:** Aktor A `#E44F32`; Aktor B `#242424`; override per kaki tetap tersedia. Kanvas `#F5F5F2`.
- **Batas gerak:** tinta mengikuti observasi. Kecepatan/kurvatur hanya menghasilkan **bobot visual**, bukan estimasi tekanan fisik. Hindari dekorasi atau bentuk huruf Jepang otomatis.
- **Sumber:** webcam, kamera HP (termasuk webcam virtual USB), MP4, simulator 3D, dan DEMO menuju **renderer yang sama**.
- **Keselamatan:** Map/kalibrasi proyektor, blackout, F3, TouchDesigner, dan Resolume tidak diubah oleh pipeline seni.

```text
SOURCE (Webcam / HP / MP4 / 3D / DEMO)
  -> SourceFrameNormalizer
  -> FootBrushPoseAdapter
  -> SegmentGate (actor, foot, source, epoch, confidence, time)
  -> MotionInkEventRouter
       +-> ObservedMotionInkEngine -> InkSegmentEvent -> SumiStrokeGeometryBuilder
       |                                        -> SumiMaterialRenderer -> PersistentInkStore
       +-> FootContactGestureEngine -> FootprintEvent -> EphemeralFootprintStore
  -> PainterlyCanvasRenderer: warm-white + persistent ink + fading footprints
  -> Stage Monitor / clean fullscreen
```

## 1. Baca frame input, jangan buat detektor baru

Panggil `normalizeTrajectoryInput()` lalu `adaptFootBrushFrame()` seperti V3.3. Satu observasi per aktor/kaki membawa `actorId`, `foot`, `sourceKey`, `sourceEpoch`, `atMs`, `center`, `heel`, `toe`, `headingRad`, `confidence`, dan `provenance`.

- Webcam/HP: gunakan time monotonic dari frame live; jangan render ulang frame duplikat.
- MP4: gunakan `video.currentTime` / waktu snapshot analisis yang cocok. `paused` membekukan input; `seeking` memotong segmen aktif. `sourceKey` boleh mengandung epoch seek, tetapi **identitas klip untuk dedup harus stabil di seluruh seek/loop**.
- Simulator/DEMO: sampel berlabel `simulated`. Boleh membuat gestural ink dari perpindahan sintetis; tidak disamakan dengan kontak sensor lantai.
- Dua aktor: empat channel mandiri `A:left`, `A:right`, `B:left`, `B:right`. Status identity-ambiguous menahan semua deposit baru yang identitasnya tidak aman.

**Output:** kumpulan `FootBrushPose[]` per frame beserta status clock/sumber. Tidak ada proses material di tahap ini.

## 2. Jaga kontinuitas tiap kaki melalui SegmentGate

Satu state per `(sourceKey, actorId, foot)`, berisi observasi terakhir yang diterima, timestamp, anchor, dan `strokeId` aktif.

Tolak atau **cut** segmen saat:

- frame lama/duplikat; `dt <= 0` atau jeda melebihi ambang awal V3.3 (390 ms);
- confidence di bawah gate (awal 0,55), landmark tidak finite atau koordinat keluar ruang input;
- identity switch/ambiguity, perubahan `coordinateBasis`, pergantian anchor yang tidak sebanding;
- lompatan posisi yang melampaui batas anti-teleport; source switch/seek/loop;
- lift yang cukup dipercaya, blackout/preview-off sebagai batas pengamatan, atau track hilang.

**`cutMotionSegment(reason)` hanya menutup sapuan aktif.** Ia tidak menghapus lukisan yang sudah dibake. Jangan menghubungkan pusat kaki sebelum dan sesudah cut.

## 3. Pisahkan keputusan tinta dan stempel

`MotionInkEventRouter` memproduksi dua jenis keluaran:

**A. `InkSegmentEvent`**: dua observasi valid berurutan menunjukkan perpindahan atau rotasi yang nyata. Untuk webcam/HP/MP4 yang belum dapat memastikan kontak, tandai `motionKind: 'observed-motion'` dan `provenance`. Ini mengizinkan lukisan gestural dari aktivitas berjalan tanpa mengklaim gesekan nyata.

**B. `FootprintEvent`**: keluaran `FootContactGestureEngine` yang memenuhi bukti pijakan atau estimasi stabil, cooldown, dan dedup. Gerak biasa **tidak** mencetak stempel baru di setiap frame.

`contact-drag` dan `pivot` hanya dipakai bila anchor/kontak cukup mendukung. Jika hanya pusat kaki teramati, lakukan ribbon berdasarkan gerak pusat; jangan mengarang pivot.

## 4. Bangun fitur motion untuk lebar kuas

Di ruang raster kanonik 1600×900, hitung jarak (px), arah gerak `T`, normal `N`, kecepatan lokal, belokan/kurvatur, kecepatan angular, dan dwell. Smoothing hanya di dalam satu segmen yang diterima.

Pemetaan bobot visual awal (perlu tuning fixture):

```ts
const BASE_WEIGHT_PX = 36; // default Bold, raster 1600 x 900
const speedFactor = clamp(speedProfile(velocity), 0.80, 1.18);
const turnFactor = clamp(1 + 0.12 * normalizedTurn, 1, 1.12);
const qualityFactor = clamp(0.85 + 0.15 * confidence, 0.85, 1);
const widthPx = clamp(
  BASE_WEIGHT_PX * speedFactor * turnFactor * qualityFactor,
  BASE_WEIGHT_PX * 0.65,
  BASE_WEIGHT_PX * 1.35,
);
```

`speedProfile` memakai kurva halus dari data kalibrasi; jangan menaikkan bobot karena noise pose. Saat slider berubah dari 36 ke 60 px, **deposit berikutnya** memakai nilai baru; tinta lama tetap seperti tercetak. Opsi Natural/Bold mengubah profil lebar, tidak mengubah data gerak.

## 5. Resampling lintasan menjadi badan kuas

Baca pasangan pose `(p0, p1)`. Resample dengan:

- jarak maksimum antarsampel sekitar **20% dari lebar lokal** (36 px → langkah ~7,2 px);
- tambahan substep saat perubahan heading besar atau belokan cepat;
- batas jumlah substep per segmen untuk menjaga frame budget;
- tanpa overshoot ke luar jalur observasi: mulai dengan interpolasi linear dan pembulatan tangent lokal; spline hanya bila overshoot dibatasi di selubung lokasi valid.

Di setiap posisi `p(t)`, bentuk vektor tangent `T(t)` dari perpindahan aktual, normal `N(t) = (-T.y, T.x)`, lalu batas bidang:

\[
L(t)=p(t)+N(t)\frac{w(t)}{2}, \qquad R(t)=p(t)-N(t)\frac{w(t)}{2}
\]

Susun poligon terisi `L0 -> L1 -> ... -> Ln -> Rn -> ... -> R0`. Gunakan join yang menyatu; hindari celah saat kurva tajam, self-intersection liar, dan centerline 1–2 px yang tetap kelihatan. Ini **ink ribbon**, bukan rangkaian footprint yang digambar di setiap titik.

Pangkal/ujung stroke diberi terminal mirip sentuhan kuas: taper pendek pada perpindahan yang baru dimulai atau lift teramati; pada stop stabil, bentuk boleh berakhir penuh dan menumpuk sedikit tinta. Terminal tidak menambah jalur melebihi observasi.

## 6. Pivot memakai swept footprint, bukan ribbon midpoint

Jika tumit atau ujung kaki dipercaya sebagai poros yang stabil, ambil siluet dari `authenticFootGeometry.ts`. Putar mask kaki bertahap mengelilingi titik poros yang teramati:

\[
q'(t)=c(t)+R(\theta(t)-\theta_0)(q_0-c_0)
\]

Ambil union/sweep mask selama rotasi, dengan batas ink yang mengikuti sisi kaki. Tambahkan sampel angular awal tiap ~5° atau saat tepi mask bergeser >20% bobot kuas. Jika poros tidak tepercaya, kembalikan ke observed-motion ribbon yang valid atau cut; **jangan membuat busur dekoratif dari pusat kaki yang diam**.

## 7. Raster material Sumi: core, tepi, serat, pooling

Untuk setiap **geometri selesai per segmen baru**, render ke canvas sementara yang dibatasi oleh bounding box stroke + margin bleed:

1. **Core**: isi bidang dengan warna aktor dan alpha efektif awal 0,78–0,93 (Sumi); badan stroke harus jelas dari jarak penonton.
2. **Soft bleed**: halo lokal tipis maksimal 3–7% bobot kuas, clipped/terbatas dekat tepi. Jangan blur seluruh layar.
3. **Dry grain**: serat seeded kecil di dalam envelope, lebih terlihat pada gerak cepat; gunakan seed stabil `(paintingSessionId, sourceIdentity, actor, foot, eventId)`.
4. **Pooling**: pada stop/pivot yang valid, maksimum 1,25× kepekatan lokal; dilarang menambah noda di posisi yang tidak diobservasi.
5. **Overlap**: gambar deposit baru memakai `source-over` terhadap raster permanen. Tinta yang sudah dibake tidak menerima tambahan alpha hanya karena canvas direpaint.

Preset **Sumi**, **Kuas Kering**, **Pigmen Pekat** menjalankan geometri yang sama dan berbeda pada parameter material. Pilihan warna tetap menurut aktor/kaki.

## 8. Bake sekali ke PersistentInkStore

Gunakan raster kanonik 1600×900 pada canvas internal/offscreen (`persistentInkCanvas`). Setiap event baru diberi **ID stabil** dan `styleSnapshot` pada waktu deposit. `append()` perlu atomik: cek dedup → render mask material → bake ke cache → catat event-ID/interval.

```ts
class PersistentInkStore {
  // fixed-size canonical raster; no 10,000-dab rerender per frame
  appendOnce(event: InkSegmentEvent, geometry: SumiStrokeGeometry,
             style: ResolvedInkStyle): boolean;
  getCanvas(): CanvasImageSource;
  cutMotionSegment(reason: string): void; // preserves cached pixels
  clearPainting(): void;                  // erases cache + dedup + ephemeral
}
```

**Dedup MP4/loop:** `sourceIdentity` harus menunjuk klip tetap, bukan token seek. Simpan covered frame intervals per `(clip, actor, foot)` dalam painting session. Interval yang sudah dicetak tidak dicetak ulang setelah seek/loop. Untuk live camera dengan timestamp unik, dedup terbatas pada frame berulang dan event serial terbaru. Hindari `Set<string>` tak terbatas yang tumbuh 30 menit; gunakan rentang/bitset per klip dan metadata ring-buffer.

**Ketika preset diubah**, bake sebelumnya tidak diubah. Cache raster bertahan sampai `clearPainting()` / `newPainting()`, bukan hilang ketika `sourceKey`, status preview, atau demo berubah. `paintingSessionId` terpisah dari source/session tracking.

## 9. Tambahkan FootprintStore dengan lifetime 6 detik

Gunakan siluet kaki kanan/kiri V3.3 untuk event pijakan. Footprint terpisah dari cache tinta permanen. Default `lifeMs = 6000`, `mode = fade`; tetapkan `sourceClock` per stempel supaya pause MP4 menghentikan umur, sementara kamera langsung memakai waktu monotonic.

Pada seek/source change, hapus/batasi head dan stempel sementara sesuai epoch; **jangan sentuh persistent ink**. Pada frame duplikat tidak ada imprint baru. Opsi `Tetap` untuk footprint tersedia, namun bukan default.

## 10. Komposisi satu frame

```ts
function paintStage(ctx: CanvasRenderingContext2D, frame: RenderFrame) {
  if (frame.blackout || !frame.previewLive) {
    paintBlack(ctx);          // JANGAN clear cache tinta
    return;
  }
  paintWarmWhite(ctx, '#F5F5F2');
  ctx.drawImage(frame.persistentInkCanvas, 0, 0,
                ctx.canvas.width, ctx.canvas.height);
  paintVisibleFootprints(ctx, frame.footprints, frame.clock);
  if (frame.editor && frame.diagnosticsEnabled) paintDiagnostics(ctx);
}
```

Render scene setiap frame hanya `fillRect + drawImage + footprint yang aktif`. Perubahan cache dipicu event, **tidak** oleh `requestAnimationFrame` sendiri. Fullscreen memakai raster komposisi sama; tanpa HUD kecuali debug secara eksplisit diaktifkan. Resize/DPR memakai canonical raster dan fit render; kalibrasi Map tetap di jalur terpisah.

## 11. Kendali state: putus gerak vs hapus lukisan

| Peristiwa | State gerak | Raster tinta | Footprint |
| --- | --- | --- | --- |
| Webcam/HP disconnected | Cut; tunggu pose baru | **Tetap** | Boleh memudar |
| Ganti webcam → MP4 → simulator | Cut; source identity baru | **Tetap** | Reset head lama |
| MP4 pause | Tidak ada event baru | **Tetap** | Waktu media membeku |
| MP4 seek/loop | Cut dan epoch baru; dedup replay | **Tetap** | Head/stempel epoch lama ditangani |
| Aktor A/B ambigu | Jangan deposit baru | **Tetap** | Tidak mengarang cap |
| Blackout/preview-off | Cut input aktif | **Tetap di cache** | Tidak muncul saat padam |
| Coba Demo ON/OFF | Cut; demo pakai engine sama | **Tetap** | Sesuai event baru |
| Ganti material/warna/bobot | Style untuk event berikutnya | **Cat lama tak berubah** | Sesuai style baru |
| Bersihkan Lukisan | Reset state & dedup | **Kosong** | **Kosong** |
| Refresh/tutup tab | Session berakhir | Tidak dijamin tersimpan pada P0 | Tidak dijamin tersimpan |

`clearPainting()` hanya dipanggil dari tombol operator **Bersihkan Lukisan** atau **Mulai Lukisan Baru**. Jangan panggil di `ensureSource`, `seek`, toggling mode, ataupun `onDemo`.

## 12. Wiring TypeScript: satu jalur untuk seluruh sumber

```ts
function ingestSourceFrame(input: V3Input, state: InkRuntime) {
  if (!input.ready || input.seeking || input.paused) {
    if (input.seeking) state.cutMotionSegment('seek');
    return;
  }
  const batch = adaptFootBrushFrame(input.samples, input.sourceKey,
                                     input.frameMs, state.adapter);
  state.adapter = batch.state;
  if (batch.cut) state.cutMotionSegment('source-or-epoch');

  const motion = state.observedInk.ingest(batch.poses); // actor/foot/source gated
  for (const event of motion.inkSegments) {
    if (state.ink.wasSeen(event)) continue;
    const shape = state.geometry.build(event, state.settings.brushWeightPx);
    const style = resolveMaterialSnapshot(state.settings, event);
    state.ink.appendOnce(event, shape, style);
  }
  for (const contact of motion.footprints) {
    state.footprints.appendOnce(contact);
  }
}
```

`MotionInkEventRouter` menangani dua stream tersebut dan menjaga footstep estimasi tidak dipakai sebagai bukti kontak nyata. Cuplikan ini hanya kerangka integrasi; tipe, clock transition, dedup, dan layer lifecycle perlu dibuat konkret di modul masing-masing.

## 13. Batas performa dan test wajib

- **Frame budget:** target ≥30 FPS, P95 painterly ≤12 ms, 1600×900, 2 aktor × 2 kaki. Render loop eksisting bisa tetap 45 FPS jika perangkat sanggup.
- **Memori:** satu RGBA 1600×900 sekitar 5,8 MB mentah; cache per-session, event index compact, bounding-box render; ukur heap, cache allocations, dan dropped frames selama **2, 10, 30 menit**.
- **Tes visual wajib:** 36px default harus jelas lebih tebal daripada V3.3; snapshot 10 detik/1 menit/5 menit pada simulasi proyektor. Target penilaian artistik awal ≥4/5 per kategori.
- **Tes pixel:** `stroke at T+10/T+60/T+600` identik saat tak ada input baru; footprint alpha menuju 0 setelah 6s; repaint berulang tidak menggelapkan core; overlap event baru memang menambah pigment.
- **Tes sumber:** webcam, HP, MP4, simulator, DEMO memakai material renderer sama; 4 channel dua aktor aman; kamera putus, seek/loop, pause, beda DPI, fullscreen, blackout, dan tombol Bersihkan.
- **Tes bentuk:** walk/turn, drag, heel/toe pivot, hesitation, stop–start, lift; tidak ada thin centerline atau huruf kaligrafi yang dihasilkan otomatis.
- **Regression:** V3.3 dan V3.2 fallback, Map, F3, output projector, Resolume/TouchDesigner, browser E2E. Perubahan default `sumi-v34` hanya setelah QA P0 dan review visual lulus.

## 14. File engineering yang disentuh

| Tahap | File | Peran |
| --- | --- | --- |
| P0-01 | `src/footprints/lines/v3/ObservedMotionInkEngine.ts` **baru** | SegmentInk events dari gerak valid untuk semua sumber |
| P0-02 | `src/footprints/lines/v3/SumiStrokeGeometryBuilder.ts` **baru** | Ribbon, taper, pivot-sweep |
| P0-03 | `src/footprints/lines/v3/SumiMaterialRenderer.ts` **baru** | Core/bleed/grain/pooling |
| P0-04 | `src/footprints/lines/v3/PersistentInkStore.ts` **baru** | Bake incremental; dedup; cut ≠ clear |
| P0-05 | `src/footprints/lines/v3/FootBrushStrokeRenderer.ts` | V3.3 fallback; jangan dipakai membangun badan kuas V3.4 |
| P0-06 | `src/footprints/lines/v3/PainterlyCanvasRenderer.ts` | Persistent + ephemeral compositor + blackout |
| P0-07 | `src/studio/v3/LineTrailsV3.tsx` | Clock, source cut, fullscreen, runtime lifecycle |
| P0-08 | `src/studio/v3/SurfaceComposer.tsx` | Kontrol Sumi/Bold/bobot/6s/Tetap/Bersihkan |
| P0-09 | `tests/painterly-sumi-v34*.test.ts`, browser QA | Gate acceptance dan regression |

**Rilis:** branch pengembangan → QA visual, unit, browser, 30-min soak → merge ke `main` → verifikasi GitHub Pages. Vercel tidak disentuh. **Dokumen ini belum memodifikasi repository.**