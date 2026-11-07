# SOMA / ARCHIVE — Spesifikasi Teknis dan Kontrak Interaksi

## Prinsip sistem

**Satu data gerak, banyak akibat.** `MotionFeatureSnapshot` mengalir ke rule engine; setiap rule dapat mengeluarkan aksi visual, audio, dan cue. Data historis disimpan terpisah dari salinan transformasi panggung. Arsitektur harus mengikuti stack yang sudah ada.

```text
CAMERA / MANUAL INPUT
        ↓
EXISTING TRACKERS (pose/hands/face/mouse)
        ↓
MOTION FEATURE EXTRACTOR + CONFIDENCE + ACTOR ID A/B
        ↓
TIMESTAMPED SNAPSHOT + SMOOTHING + GESTURE STATE
        ↓
RULE ENGINE ← SCENE CUES ← OPERATOR OVERRIDES
      ↙     ↘             ↘
TEXT/IMAGE   VOICE ENGINE    PERFORMANCE OUTPUT
RENDERER     (single audio)  Studio + Clean Window
      ↘       ↙
    DIAGNOSTICS / LOG
```

## Contoh bentuk data (sesuaikan kode)

```ts
type SourceStatus = 'transcribed-from-user-image' | 'secondary-quote' | 'primary-verified';
type ArchiveKind = 'text' | 'image' | 'video' | 'audio';
interface ArchiveSource {
  id: string;
  kind: ArchiveKind;
  title: string;
  author?: string;
  year?: number;
  citation?: string;
  language?: 'nl' | 'id' | 'other';
  originalText?: string;
  workingTranslation?: string;
  provenanceStatus: SourceStatus;
  notes?: string;
  mediaAssetId?: string;
}
interface VoiceSegment {
  id: string;
  archiveId: string;
  trackId: string;
  text: string;
  startMs: number;
  endMs: number;
  language: 'nl' | 'id';
}
interface MotionFeatureSnapshot {
  timestampMs: number;
  actorId: 'A' | 'B';
  confidence: number;
  visible: boolean;
  torsoAngleToHorizon?: number;
  hipHeightNormalized?: number;
  wristVelocityX?: number;
  wristVelocityY?: number;
  stillnessDurationMs?: number;
  actorDistanceNormalized?: number;
  skeletonLandmarks?: ReadonlyArray<{x:number;y:number;z?:number;visibility?:number}>;
}
interface ArchiveMappingRule {
  id: string;
  feature: string;
  actor: 'A'|'B'|'both'|'manual';
  threshold: number;
  smoothingMs: number;
  hysteresis: number;
  dwellMs: number;
  cooldownMs: number;
  textAction?: {type: string; targetIds: string[]; intensity: number};
  audioAction?: {type: string; segmentIds: string[]; intensity: number};
  lostTracking: 'hold-then-fade'|'release'|'manual-only';
}
interface StageCue {
  id: string;
  label: string;
  archiveIds: string[];
  mappingIds: string[];
  outputLayout: 'archive-only'|'split'|'combined'|'live-photo';
  trigger: 'manual'|'event'|'timed';
  resetOnEnter: boolean;
}
```

Aktor A/B dipetakan ke identitas panggung melalui kalibrasi, bukan mengasumsikan indeks keluaran model akan tetap stabil. Implementasikan pemadanan kontinuitas posisi, confidence, dan reassignment manual.

## Fitur gerak dan cara menggunakannya

| Fitur | Pengukuran praktis | Kehati-hatian |
|---|---|---|
| Tinggi pinggul | Titik pinggul terhadap batas lantai/ROI terkalibrasi | Posisi kamera miring mengubah hasil |
| Badan horizontal | Sudut garis bahu–pinggul terhadap bidang gambar | Tidak cukup untuk mengukur tidur |
| Diam | RMS perpindahan landmark valid selama jendela waktu | Jangan hitung saat pose hilang |
| Sapuan tangan | Velocity vektor pergelangan dengan smoothing | Hilangkan spike saat occlusion |
| Jarak A/B | Jarak relatif pusat torso, dinormalisasi framing | Bisa hilang saat tubuh tumpang tindih |
| Potret pose | Trigger manual atau dwell time + rearm | Jangan otomatis menyimpan data mentah |

**Aturan hysteresis**: onset dan release memakai batas berbeda, cooldown untuk menghindari trigger berulang, waktu tahan yang dibatasi saat landmark hilang. Jangan menggunakan landmark nol atau prediksi tersembunyi seolah-olah deteksi valid.

## Enam aksi tipografi

| Aksi | Perilaku | Kontrol |
|---|---|---|
| Displace | Menggeser kata berdasarkan gerak, dengan batas area | jarak, inertia, arah |
| Compress | Mengurangi jarak antarbaris/kata tanpa merusak teks sumber | compression %, ease |
| Scatter | Menyebar token; kembali mengikuti aturan return | radius, duration, return |
| Swarm | Kata target mendekat ke area skeleton lalu menjauh akibat sapuan | density, attract, repel |
| Erase/Reveal | Menyembunyikan atau membuka visual potongan kata | reveal radius, fade |
| Restore | Reset semua transform ke susunan kutipan asli | instant/fade |

Gunakan layout stabil; pada mode projector tetap pertahankan safe area. Hindari CSS reflow setiap frame; posisi transform/Canvas mungkin lebih cocok. Aksesibilitas kontrol tetap DOM biasa.

## Empat aksi foto/video

`mask-reveal` berdasarkan area tubuh, `archival-overlay` foto dan skeleton, `fragment-pan` gerak torso membuka bagian frame, `live-freeze` mengambil snapshot kamera satu kali dengan cue. Sediakan `Original View` untuk menampilkan foto historis utuh. Video sumber memiliki atribusi dan timecode asli, dan pengolahan visual tidak menyunting berkas sumber.

## Mesin suara: satu output, rekaman manusia

- Gunakan Web Audio API existing yang paling sesuai. Voice buffer didekode sekali. Jadwalkan fragmen dengan fade in/out singkat pada envelope dan batas polyphony. Track NL/ID terpisah, master limiter.
- `scrub` berbeda dari mengubah pitch; jika granular/pitch-preserving belum diimplementasi, nyatakan keterbatasan. Jangan memberi label pitch-preserving pada playbackRate biasa.
- Audio context harus di-unlock setelah klik operator. Kamera tidak otomatis meng-unlock audio.
- Status source: `missing`, `loading`, `ready`, `playing`, `error`; pesan UI jelas. Tidak boleh diam-diam memakai sample placeholder sebagai suara arsip.
- Saat cue berubah, release/fade semua fragmen milik cue sebelumnya; operasi idempotent dan safe untuk rapid cue firing.

## State dan jendela proyeksi

- Editor dan operator pada jendela utama. Proyektor sebagai jendela Clean read-only; kamera dan AudioContext tetap di jendela utama.
- Sinkronkan minimal: `sessionId`, `cueId`, `featureSnapshot`, `renderState`, `archiveMediaRefs`, `heartbeat`, `blackout`, `freeze`, `scale`. Komunikasi antarjendela harus menangani kehilangan koneksi, refresh, dan izin pop-up.
- Bila aset lokal tidak bisa diakses dari projection window, sediakan strategi URL/blob/IndexedDB yang sah pada origin sama; **jangan menganggap object URL dari jendela lain selalu valid** tanpa pengujian.
- Proyektor menggunakan ukuran adaptif/letterbox untuk 16:9, 4:3, dan custom; safe area dan black background. Debug dan kontrol hanya di Studio.
- Jangan otomatis mengarahkan/memilih monitor melalui API browser yang tidak tersedia. Sediakan instruksi drag-to-projector + fullscreen.

## Simpanan dan ekspor

Gunakan skema berversi, misalnya `archiveProjectVersion: 1`. Simpan preset sumber, maps, scenes, cue dan pengaturan UI; jangan simpan izin browser, active camera streams, atau audio unlocked state. Informasikan dengan jelas saat mengimpor preset tetapi berkas audio/foto sumber tidak tersedia. Bila fitur SOMA lama memiliki format preset lain, buat migrasi tanpa overwrite sembarangan.

## Telemetri lokal untuk uji

Timestamp gerak masuk, feature processed, render frame, suara terjadwal dan output status; average/P95 latency secara lokal; FPS; count lost-tracking; event cue; audio clips active; projection heartbeat. Tombol export diagnostic JSON (tanpa mengunggah rekaman atau metadata sensitif). Hindari pencatatan isi kamera secara default.

## Artefak implementasi yang diharapkan

`Archive Workspace`, `Archive Source Editor`, `Rule Editor`, `Audio Segment Editor`, `Stage Cue List`, `Projection Screen`, `diagnostic panel`, `3 presets Tillema` dan unit/integration tests. Penamaan file/module bebas mengikuti struktur proyek sekarang.
