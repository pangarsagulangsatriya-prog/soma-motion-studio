# SOMA — Dual Trace Engine V1
## Algoritme dan render pipeline, step-by-step

**Status:** rancangan teknis; belum ada perubahan kode/deployment. **Default UI:** dua layar berdampingan (Foot Path | Head & Shoulder).

## A. Alur utama (satu proses deteksi)

```text
MP4 / Webcam / HP → existing pose inference / tracked replay
                           ↓  MediaPipe 33 landmarks, A/B, time, epoch
                      PoseFrameBus
                        ↙       ↘
            Foot adapter       UpperGestureAdapter
                  ↓                    ↓
        PathObservationRouter   Head/Shoulder anchors
                  ↓                    ↓
          ActorPathTracker       GestureStrokeTracker
                  ↓                    ↓
          PathSplineFitter       GestureSplineFitter
                  ↓                    ↓
          SumiRibbonMesh       DirectionalGestureBrush
                  ↓                    ↓
           FootInkStore          GestureInkStore
                  ↘                    ↙
           Split view / independent fullscreen
```

Gunakan `ReplayAnalysisSnapshot.people[].landmarks` dari `src/stage/VideoPoseGaitEngine.ts` untuk MP4 dan `MotionFrame.pose/poses` dari `src/engine/types.ts` untuk live. Identitas live A/B tetap melalui `MultiPoseGaitRouter`. Pertahankan sumber pose **satu kali**, kemudian fan-out datanya.

## B. Kontrak TypeScript yang disarankan

```ts
type ActorId = 'A' | 'B';
type Source = 'video' | 'webcam' | 'phone' | 'simulator' | 'demo';
type BodyPoint = { x: number; y: number; visibility: number }; // normalized 0..1

type PoseFrame = {
  actorId: ActorId;
  source: Source;
  sourceKey: string; // stable camera session or media clip
  epoch: number;     // resets on seek/reconnect/source switch
  timeMs: number;
  identityConfidence: number;
  landmarks: readonly BodyPoint[]; // 33 landmarks where available
  coordinateBasis: 'image-2d' | 'simulated';
};

type GestureChannel = 'head' | 'shoulder';
type GesturePoint = {
  actorId: ActorId;
  channel: GestureChannel;
  sourceKey: string;
  epoch: number;
  timeMs: number;
  pointPx: { x: number; y: number };
  confidence: number;
  basis: 'observed-2d' | 'estimated-head';
};
```

## C. Langkah-langkah setiap frame

### 1. Ambil frame pose yang sama untuk dua kanvas
- MP4: cocokkan `snapshot.atMs` dengan posisi video; tolak snapshot terlalu jauh dari frame yang sedang ditampilkan.
- Webcam/HP: gunakan pose dan timestamp dari live tracking, sesuai izin identitas A/B.
- Jangan menjalankan ulang MediaPipe untuk kanvas kedua. Jangan memakai `rawPoses[0] = A` tanpa persetujuan identity tracker.

### 2. Validasi data dan identitas
- Saring `landmarks.length === 33`, koordinat valid, keypoint visibility.
- Jika dua aktor bertukar/ambiguous, `CUT(A/B, reason='identity-uncertain')` untuk channel yang terdampak. Tinta permanen tetap ada.
- Simpan `sourceKey + epoch + actorId + channel` sebagai identitas stroke aktif.

### 3. Kirim kaki ke pipeline lama
- Adaptasi pose ke kaki L/R dengan jalur `FootPositionResolver → PathObservationRouter → ActorPathTracker` V3.5.1.
- Pakai hint contact/swing/pivot **estimasi 2D** jika tersedia; jangan menyebutnya tekanan kaki terukur.
- Rute dan tinta kaki tetap pada kanvas A, footprint fade 6000ms.

### 4. Ambil anchor kepala dan bahu
- Shoulder center: jika landmark 11 dan 12 lolos visibility, gunakan midpoint `(L+R)/2`.
- Head center: jika telinga 7 dan 8 lolos, midpoint keduanya. Jika tidak, landmark 0 (nose) boleh menjadi fallback dengan status `estimated-head`; jangan merekonstruksi telinga yang hilang.
- Torso reference: midpoint pinggul 23/24 jika valid; pakai untuk memisahkan translasi seluruh badan dari artikulasi kepala. Hindari pembagian dengan skala tubuh yang mendekati nol.
- Head/shoulder berada dalam koordinat **gambar 2D**. Projection Map tidak otomatis diberlakukan pada tubuh atas.

### 5. Pisahkan translasi tubuh dan gerak relatif
Untuk kanal bahu, gunakan shoulder center teramati dalam koordinat kanvas gambar. Untuk kanal kepala, gunakan kepala relatif pada shoulder center supaya menoleh tidak tenggelam dalam perpindahan seluruh badan:

```ts
const shoulder = midpoint(leftShoulder, rightShoulder);
const head = midpoint(leftEar, rightEar) ?? noseFallback;
const relative = subtract(head, shoulder);
const gestureHead = add(shoulder, multiply(relative, gain)); // gain=1.35
```

Ini **amplifikasi visual terkontrol**, bukan perubahan pada data mentah/kalibrasi. Simpan point asli di diagnostics. Beri cap `gain <= 2.5` dan movement cap; tidak boleh membuat lingkaran otomatis ketika performer diam. Mode lanjutan dapat mengukur `head - torso` dan shoulder rotation terhadap frame awal, tetapi hindari mengubah pusat gambar ketika user mengganti preset.

### 6. Gating per channel
Default parameter awal untuk pengujian (wajib tuning dari footage):

| Kanal | Visibility minimum | Deadband displacement | Width | Opacity |
|---|---:|---:|---:|---:|
| Head | 0.55 | 3–5 px | 8 px | 0.75 |
| Shoulder | 0.60 pada kedua bahu | 4–6 px | 16 px | 0.90 |

- Jika dua titik stabil dan displacement kurang dari deadband, tidak ada `ADD` baru.
- Jika keypoint hilang kurang dari batas grace, tahan gambar; setelah timeout, `CUT`, bukan jembatan lurus.
- Channel head dan shoulder punya stroke aktif **terpisah**, sedangkan actor A/B tetap memakai satu sistem identitas bersama.
- `CUT` saat pause/seek, loncatan tak masuk akal, identity swap, atau source change. `STOP` saat tubuh diam tidak menambah tinta.

### 7. Smoothing waktu dan jarak
- Terapkan One-Euro filter atau smoothing adaptif ke `pointPx` per `actorId+channel`, menggunakan delta waktu aktual.
- Sampling titik baru berdasarkan jarak tempuh (misal setiap 3–5 px); jangan membuat titik baru karena ada frame baru saja.
- Kecepatan rendah → smoothing lebih kuat. Gerak valid yang cepat → smoothing berkurang agar belokan tetap terbaca.
- Setelah jeda frame video cukup besar, putus/sambung berdasarkan bukti kontinuitas; jangan merangkai dua frame tak terkait.

### 8. Bangun spline kontinu
- Gunakan strategi `PathSplineFitter.ts`: centripetal Catmull–Rom, tangent, bounded overshoot, resample by arc length.
- Simpan 2–4 knot terakhir sebagai active tail yang masih dapat diperbaiki.
- Head taper hanya saat stroke START, tail taper saat CUT, **jangan memberi ekor tiap frame**.

### 9. Bangun dua karakter brush
- Bahu: ribbon Sumi utama, width awal 16 px dengan variasi maksimum sekitar ±25% berdasarkan gerak yang dipercaya.
- Kepala: nib lebih ringan 8 px, alpha berbeda; ujung tetap berkarakter kuas.
- Serat mengikuti tangent, bukan garis acak di luar lintasan.
- Core opacity dikomposisi sekali; hindari penggelapan karena redraw active tail.
- Aksen tetesan/percikan default mati pada MVP; bila diaktifkan gunakan event gerak yang valid dan cooldown.

### 10. Simpan dua lukisan independen
- `FootInkStore`: persistent strokes foot + transient footprint timeline.
- `GestureInkStore`: persistent strokes head/shoulder dengan track A/B masing-masing.
- Sumber berganti: `CUT`, committed tinta tetap. `Clear Foot` dan `Clear Gesture` mempengaruhi store terkait saja; `Clear Both` mempengaruhi keduanya.
- MP4 seek/replay memakai interval dedup supaya tidak menimpa raster yang sudah dicetak.
- Gunakan atlas Canvas terbatas; jangan simpan gambar penuh per frame selama sesi 30 menit.

### 11. Komposisi dua view

```text
COMPOSE / DUAL TRACE
┌───────────────────────┬───────────────────────┐
│ FOOT PATH             │ HEAD & SHOULDER       │
│ A merah | B arang     │ A merah | B arang     │
│ Footprints + route    │ Head thin + shoulder  │
│ [Fullscreen] [Clear]  │ [Fullscreen] [Clear]  │
└───────────────────────┴───────────────────────┘
 [Pause] [Clear Both] [Gain] [Confidence diagnostics]
```

Kedua kanvas 1600×900 dalam koordinat internal, hanya pratinjau yang diskalakan mengikuti lebar layar. Dua fullscreen independen; sinkron frame dan lifecycle source sama. Gabungan *Combined* baru dibuat setelah Split terbukti stabil.

### 12. Warna dan kontras
- Color ownership: A `#E84B32`; B `#202226`. Berlaku di Foot dan Gesture.
- Surface warm-white `#F7F6F2`; hindari grid titik sebagai bagian output proyektor.
- Perbedaan head/bahu melalui width, alpha, dan karakter kuas. Warna tetap per aktor.
- Uji pada 1600×900 dan thumbnail 320px supaya garis aktor tetap terbaca ketika bersilangan.

### 13. Uji negatif yang wajib
- Head hilang, bahu sebelah hilang, aktor hanya separuh badan tampak → jangan buat koordinat palsu.
- Aktor saling melintas → identitas tidak tertukar dan garis tidak tersambung silang.
- Kamera diam, performer diam 10 detik → nol stroke baru walau landmark bergetar.
- Satu aktor berjalan sambil menoleh → Foot dan Gesture memberikan gambar berbeda yang dapat dicocokkan dengan video.
- Pause/seek MP4, disconnect HP dan pergantian sumber → potong stroke aktif, preserve lukisan lama, dedup replay.
- Foot-only demo → kanan bertuliskan “Pose kepala/bahu belum tersedia”, bukan mengarang gerakan.
- Fullscreen dan feed proyektor → tidak ada panel kontrol atau overlay diagnostik.

### 14. Uji kinerja
- Hanya satu inference pipeline. Dua renderer memproses hasil yang sama tanpa inferensi tambahan.
- Target awal 30 FPS output (diukur pada perangkat nyata), render P95 dipantau terpisah tiap kanvas; jangan klaim lulus sebelum benchmark.
- Soak sintetis 30 menit plus uji MP4 nyata 1–5 menit; ukur jumlah CUT, drift, dropout, pixel overdraw, dan memori.

### 15. Urutan implementasi yang disarankan

1. `DualTracePoseFrameBus.ts` — fan-out pose A/B dengan timestamp stabil dari MP4/live.
2. `UpperGestureAnchorAdapter.ts` — landmark 0/7/8/11/12/23/24, confidence & fallback.
3. `UpperGestureStrokeTracker.ts` — 4 channel (A/B × head/shoulder), deadband, smoothing, CUT.
4. `UpperGestureInkRenderer.ts` — spline + nib/opacity + active-tail raster.
5. `DualTraceCanvasHost.tsx` — dua view terpisah, fullscreen masing-masing, clear independen.
6. `DualTraceControls.tsx` — gain, toggles head/shoulder, ukuran/opacity, warna per aktor.
7. `tests/dual-trace-*.test.ts` dan `e2e/dual-trace.spec.mjs` — real MP4/fixture, negative flow, output parity.

**Pemisahan P0:** semua modul memakai identity tracker dan sumber data yang sudah tersedia. Dilarang memecah webcam menjadi dua inference loop. **P1:** opsi Combined, gesture gain yang responsif, ekspor dua PNG. **P2:** dua output proyektor fisik, cue panggung, export sesi.