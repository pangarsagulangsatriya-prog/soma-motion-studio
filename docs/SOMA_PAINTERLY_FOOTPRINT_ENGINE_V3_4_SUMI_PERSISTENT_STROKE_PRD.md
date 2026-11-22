# SOMA — Painterly Footprint Engine V3.4
## Sumi Brush / Persistent Stroke

**Jenis dokumen:** Product Requirements Document (PRD) + Technical Architecture + Visual Acceptance Criteria  
**Tanggal:** 23 November 2026  
**Status:** PROPOSED — siap dipecah menjadi issue engineering; **belum diimplementasikan**  
**Repository:** `pangarsagulangsatriya-prog/soma-motion-studio`  
**Basis:** V3.3, `main` pasca PR #178 (commit rilis `8cfc3f9`); tangkapan layar SOMA yang masih memperlihatkan jejak kecil dan garis tipis, serta referensi kuas tinta Jepang/Cina dari pengguna.  
**Target:** Compose → Garis BETA / Painterly → Stage Monitor dan fullscreen, seluruh sumber input.  
**Deployment sesudah QA:** **GitHub Pages saja**. Jangan deploy Vercel.

---

## 1. Ringkasan produk

**Janji artistik:** Setiap gerakan kaki yang valid menulis sapuan tinta yang tebal, bertekstur, dan menetap di kanvas putih. Bekas telapak muncul sementara, kemudian memudar. Sapuan yang sudah tercipta tetap berada di sana hingga operator menekan **Bersihkan Lukisan** atau **Mulai Lukisan Baru**. Setelah beberapa menit, dua aktor membentuk komposisi merah–hitam yang bisa dibaca sebagai karya lukis dari jarak penonton.

**Sasaran utama V3.4:**

1. **Sumi Brush** menjadi material default: badan sapuan kuat, tebal–tipis jelas, tepi tidak steril, serat kering/penyerapan halus, penumpukan tinta di belokan dan jeda.
2. **Ink stroke = persistent**, default **Tetap**. Tidak ada decay atau opacity turun terhadap umur stroke.
3. **Footprint = ephemeral**, default hilang **6 detik** (kontrol 1–30 detik atau Tetap sebagai opsi).
4. **Stroke dan footprint dua rezim render terpisah** dengan aturan waktu, geometri, dan penyimpanan berbeda.
5. **Semua input** — webcam, kamera HP, MP4/video, simulator 3D, dan DEMO — memakai satu kontrak pose → motion → ink → composite. Dua aktor dan kaki kiri/kanan tetap terpisah.
6. **Ukuran stroke terasa tebal dari awal**, bisa diatur. Default sebanding dengan lebar visual telapak, bukan garis tracking satu–dua piksel.
7. **Gerak dan warna tidak direka**. Ambil bobot kuas dari kecepatan, kurvatur, dwell, dan kualitas pose; sebut sebagai **bobot visual / kepekatan**. Kamera monocular tidak mengukur tekanan kaki fisik.

**Batas gaya:** Referensi kuas kaligrafi dipakai untuk karakter material dan struktur sapuan. Renderer **tidak membuat karakter hiragana/kanji secara otomatis**, tidak menyusun gerak aktor menjadi huruf, dan tidak menambahkan ornamen jauh dari jalur kaki.

---

## 2. Temuan V3.3 yang perlu diperbaiki

Pemeriksaan terhadap modul di repository memperlihatkan:

| Modul V3.3 | Temuan kode | Perubahan V3.4 |
| --- | --- | --- |
| `FootBrushGeometryBuilder.ts` | Menghasilkan `BrushDab` berupa posisi dan heading telapak yang diinterpolasikan | Tambah *continuous ink body* berbasis swept envelope / ribbon dengan tebal–tipis dan terminal bentuk kuas |
| `FootBrushStrokeRenderer.ts` | Menggambar `paintAuthenticFootprint()` untuk **setiap dab** | Pisahkan renderer stroke bidang tinta dari renderer stempel telapak; tekstur terkurung pada bidang stroke |
| `FootBrushDepositStore` | Menyimpan maksimal 10.000 dab dalam array; membaca ulang saat repaint | Store tinta permanen dengan incremental bake ke offscreen canvas/tile, plus metadata compact dan kebijakan memori |
| `PainterlyCanvasRenderer.ts` | V3.3 dirender sebagai cabang opt-in; hidup tapak dan trail dibedakan melalui `lifetimeOpacity` | Gambar `persistentInkLayer` + `ephemeralFootprintLayer`; trail default `keep=true` |
| `LineTrailsV3.tsx` | `clearBrush()` menghapus store saat `sourceKey` berubah, mode berubah, atau video di-seek | Pisahkan `cutMotionSegment()` dari `clearPainting()`. Source switch/seek/putus koneksi hanya memotong sapuan aktif; lukisan lama tetap |
| `FootContactGestureEngine.ts` | `drag` untuk video/kamera konservatif; gesture bergerak biasa bisa tidak menghasilkan stroke tebal | Tambah *observed-motion ink* untuk gerak teramati yang valid; `contact smear` tetap memerlukan bukti kontak lebih kuat |
| Panel `LineTrailsV3.tsx` | Judul masih `V3.2 BETA`; opsi V3.3 tersembunyi; kontrol stroke disebut garis lintasan | UI menyebut `Sapuan tinta`, `Bobot kuas`, `Sumi`, dan pemisahan `Tapak kaki` vs `Lukisan` |

**Akar utama:** Menambah `sizePx` atau opasitas saja tidak cukup. V3.3 masih sering tampak sebagai rangkaian bentuk telapak kecil yang mengikuti jalur. V3.4 harus menghasilkan **bidang tinta bersambung dengan taper dan karakter kuas**, lalu menyimpannya secara persisten.

---

## 3. Kontrak visual

### 3.1 Kekuatan bentuk

- Tampak depan panggung: sapuan merah dan hitam langsung terbaca di kanvas putih hangat `#F5F5F2`.
- Badan stroke memiliki bidang hitam/merah jelas, dengan variasi tebal–tipis. Bagian yang tumpang tindih semakin pekat secara wajar.
- Tapak kaki tetap anatomis ketika baru muncul; setelah memudar, komposisi utama berupa goresan tinta.
- Ada ruang kosong. Renderer tidak mengisi setiap area dengan dekorasi atau noise.
- Gerak cepat, putaran, jeda, dan geseran menghasilkan karakter visual berbeda, semuanya mengikuti segmen gerak yang diterima engine.
- `Actor A` default `#E44F32`, `Actor B` default `#242424`. Kedua kaki tiap aktor memiliki warna sama; override per kaki tetap berlaku.

### 3.2 Referensi material sumi

- **Badan kuas:** padat, berbentuk bidang, tidak memiliki *thin centerline* yang kelihatan.
- **Taper:** pangkal / akhir bisa mengerucut atau melebar sesuai transisi gerak, tanpa ujung palsu di tengah perjalanan.
- **Dry brush:** celah serat kecil di **dalam** badan stroke yang sudah ada.
- **Ink pooling:** daerah berhenti dan berbelok sedikit lebih pekat, dibatasi sehingga tidak menjadi noda besar yang tidak terkait kaki.
- **Soft bleed:** penyerapan tipis di tepi; tidak merambat jauh dari selubung stroke.
- **Deterministik:** bentuk dan tekstur untuk event/seed yang sama menghasilkan output sama pada lingkungan pengujian yang sama.

### 3.3 Tiga preset material

| Preset | Karakter | Default |
| --- | --- | --- |
| **Sumi** | Tinta pekat; tepi agak menyerap, badan sapuan tebal, serat halus, variasi bobot jelas | **Aktif** |
| **Kuas Kering** | Sapuan terputus mikro, grain kasar dalam envelope, pinggir kering | Opsional |
| **Pigmen Pekat** | Lebih opaque, penumpukan kuat, tepi lebih padat | Opsional |

`Sumi` tetap memakai warna merah/arang sesuai aktor. Nama preset mengacu pada **perilaku material**, bukan warna hitam wajib.

---

## 4. Konfigurasi default V3.4

| Parameter | Nilai awal | Rentang / aturan |
| --- | --- | --- |
| Renderer | `sumi-v34` | Default **setelah QA**, dengan fallback `foot-brush-v33` dan `legacy-v32` |
| Material | `sumi` | `sumi`, `dry-brush`, `dense-pigment` |
| Mode sapuan | `Bold` | `Natural`, `Bold` |
| Bobot kuas | **36 px** pada kanvas referensi **1600×900** | Slider **8–96 px**; skala saat resize; tidak mengubah koordinat Map |
| Variasi lebar | ±35% dari lebar terpilih | Maksimum dibatasi saat confidence lemah |
| Tinta inti | Alpha efektif **0,78–0,93** untuk core | Model alpha source-over, tidak dikalikan ulang saat repaint |
| Bleed tepi | 3–7% dari lebar kuas | Mask lokal dan bounded |
| Dry-grain Sumi | Rendah–sedang | Seed stabil, clipped ke stroke |
| Pooling berhenti | Maksimum **1,25×** kepekatan lokal | Bukan radius noda yang bergerak lepas |
| Tapak kaki | ON; hilang **6 detik** | 1–30 detik, atau Tetap |
| Sapuan tinta | ON; **Tetap** | Default persistent; opsi Fade 1–30 detik di pengaturan lanjutan |
| Warna Aktor A / B | Merah `#E44F32` / arang `#242424` | Warna aktor dan override kaki tetap bisa diubah |
| Latar | `#F5F5F2` | Fullscreen putih hangat, tanpa HUD |
| Perpindahan input | Lukisan tetap; sapuan aktif terputus | Tidak menyambungkan dua sumber |
| Tombol Bersihkan | Bersihkan seluruh lukisan dan tapak | Perlu aksinya eksplisit dari operator |

**Angka-angka di tabel merupakan titik awal tuning, bukan hasil benchmark final.** Penyetelan akhir perlu membandingkan lima fixture dan rekaman panggung. Lebar 36 px memberi arah visual lebih kuat daripada garis tipis sekarang, namun harus tetap berhubungan dengan ukuran kaki yang terekam.

---

## 5. Dua rezim visual dan waktu

### 5.1 Rezim A — Footprint sementara

`imprint` diterbitkan saat observasi kontak / pijakan cukup baik. Ia menggunakan siluet kaki kiri/kanan dari `authenticFootGeometry.ts`, orientasi yang benar-benar terbaca, dan opasitas yang bisa memudar.

**Lifecycle:** `capture → hold singkat → fade → remove`. Default **6 detik**. MP4 pause membekukan waktu fade jika memakai clock media; kamera langsung memakai clock monotonic sesi.

### 5.2 Rezim B — Ink stroke persisten

`ink stroke` memakai selubung gerak kaki valid. Setiap segmen diterapkan **sekali** ke persistent layer. Setelah selesai, segmen tetap terlihat.

**Lifecycle:** `begin → append → finish → bake → keep`. Tidak ada timer yang mengurangi alpha stroke jika mode `Tetap` aktif. `Bersihkan Lukisan` membersihkan kanvas permanen; `Mulai Lukisan Baru` memulai painting session baru. **Blackout hanya menyembunyikan output, tidak menghapus buffer lukisan.**

**Ruang lingkup ketetapan:** Tetap selama sesi browser/Stage Monitor yang sedang berjalan. Menutup tab atau refresh **tidak dijanjikan menyimpan lukisan** pada P0; ekspor PNG dan penyimpanan/replay sesi masuk tahap P1.

### 5.3 Kebijakan clock & timeline

| Peristiwa | Footprint sementara | Tinta permanen |
| --- | --- | --- |
| MP4 pause | Freeze lifetime | Tidak menambah deposit |
| MP4 resume | Melanjutkan lifetime | Meneruskan hanya dari segmen valid baru |
| MP4 seek/loop | Potong epoch; head/footprint sementara ditangani sesuai epoch | **Pertahankan lukisan yang sudah dibuat**; putus stroke aktif, jangan sambung lintasan sebelum/sesudah seek |
| Replay frame video yang sama | Tidak stempel ulang | Dedup berdasarkan clip/session/actor/foot/frame interval dan stroke ID, meski epoch berubah |
| Ganti webcam↔HP↔MP4↔simulator | Hapus head lama, putus segment | **Pertahankan lukisan** dalam satu painting session; cat baru tidak menyambung antar-source |
| Camera disconnect / ID ambigu | Hentikan event baru | Tinta yang sudah tercipta tidak berubah |
| Blackout | Tampilan hitam | Buffer tinta tetap, tidak menggambar sewaktu off |
| Bersihkan Lukisan | Hapus footprint | Hapus seluruh tinta & cached layer |
| Ganti preset/warna/bobot | Memengaruhi event berikutnya | **Stroke lama tetap seperti yang sudah dicetak**, jangan recolor otomatis |

**Pilihan produk yang perlu dijaga:** Sesi lukisan dapat memuat beberapa sumber, tetapi timeline sumber dan identitas dipisah. Replay yang disengaja tidak menebalkan frame lama akibat duplikasi. Mode kreatif menumpuk ulang hasil replay bisa ditambahkan di P1 secara eksplisit.

---

## 6. Satu pipeline untuk semua sumber

```text
WEB CAM ─┐
HP CAM ──┤
MP4 ─────┤
3D SIM ──┤──> SourceFrameNormalizer (existing)
DEMO ────┘                  |
                              v
                   FootBrushPoseAdapter (existing)
                   actor A/B, left/right, heading,
                   sourceKey, epoch, confidence
                              |
                              v
                    MotionInkEventRouter (NEW)
                    ├── FootContactGestureEngine (existing)
                    │   └── Footprint event (ephemeral)
                    └── ObservedMotionInkEngine (NEW)
                        ├── valid motion segment
                        ├── width/ink-profile
                        └── source & identity gates
                              |
                              v
                    SumiStrokeGeometryBuilder (NEW)
                    continuous envelope / taper / pivot sweep
                              |
                              v
                    SumiMaterialRenderer (NEW)
                    core pigment + edge bleed + dry grain
                              |
                     ┌────────┴───────────┐
                     v                    v
             PersistentInkStore     EphemeralFootprintStore
             baked cached paint     age-based fade
                     └────────┬───────────┘
                              v
                       PainterlyCanvasRenderer
                              |
                     Stage Monitor / Fullscreen
```

- Semua sumber memakai satu geometry/material renderer. **Tidak ada renderer Sumi khusus MP4.**
- Simulator dan DEMO mengirim event sintetis yang ditandai sumbernya.
- Pada webcam/HP/MP4, gerak kaki 2D cukup untuk membuat **interpretasi sapuan gerak teramati** selama confidence valid. **Pijakan nyata** dan **smear akibat kontak** tetap butuh bukti lebih kuat. Panel sumber dapat menampilkan `Gerak 2D · pijakan terestimasi`.
- Ketika kaki terangkat dan status lift cukup jelas, potong stroke. Gerak teramati yang status kontaknya belum pasti boleh diterjemahkan menjadi *gestural ink* selama mode seni aktif, tetapi tidak boleh diklaim sebagai gesekan fisik pada lantai.
- Sumber tidak memengaruhi gaya: semua menggunakan nilai `brushWeight`, `material`, `palette`, `lifetimePolicy` yang sama.

---

## 7. Algoritme render V3.4

### 7.1 Tahap 1 — Terima sampel dan validasi

1. Terima `FootV3Sample` dari normalizer yang sudah ada.
2. Pisahkan actorId dan foot; verifikasi sumber, identitas, confidence, timestamp.
3. Hitung heading dari heel→toe jika tersedia; jika tidak tersedia, pertahankan heading segmen valid terakhir secara terbatas. Setelah gap, heading unknown.
4. Potong segmen pada seek, identity switch, gap temporal, lompatan jauh, atau source change.
5. Simpan data posisi pada canonical basis; transform kanvas hanya saat render.

### 7.2 Tahap 2 — Pisahkan keputusan footprint dan tinta

**Footprint:** kontak estimasi cukup kuat + pijakan terdeduplikasi → `FootprintEvent`.

**Ink stroke:** dua sampel berturutan dengan identitas/sumber/epoch sama, displacement atau rotasi teramati, confidence valid, dan interval wajar → `InkSegmentEvent`. Status `lift` yang dipercaya menutup stroke; status tidak diketahui dapat menurunkan intensitas atau memotongnya sesuai konservatisme mode. Keduanya tidak menggunakan kamera ganda/detector tambahan.

Pemisahan ini menyelesaikan masalah V3.3: gerak berjalan yang jelas terlihat tetap dapat menulis komposisi, sementara cap pijakan tidak dicetak asal-asalan.

### 7.3 Tahap 3 — Bangun selubung badan kuas (*ink ribbon*)

Untuk posisi pusat kaki `p(t)` dan heading `θ(t)`, hitung vektor arah lokal `T` dan normal `N`. Bentuk sisi kiri/kanan dari pusat lintasan:

\[
L(t)=p(t)+N(t)\frac{w(t)}{2},\qquad R(t)=p(t)-N(t)\frac{w(t)}{2}
\]

Di ujung, gunakan mask telapak/heel–toe untuk mengatur bentuk terminal. Saat pivot berporos heel/toe, bentuknya berasal dari **swept footprint envelope** terhadap sudut yang valid, bukan garis dari tengah sepatu. `L/R` dipakai untuk mendefinisikan pita, lalu diisi sebagai bidang; hindari centerline tipis terpisah.

Parameter lebar awal:

\[
w(t)=\operatorname{clamp}(w_0\cdot f_{motion}(v,\omega,\kappa,dwell)\cdot f_{quality}(q),\ 0.65w_0,\ 1.35w_0)
\]

`w₀=36 px` pada 1600×900, sebelum *preset scaling*. `f_motion` boleh menyesuaikan bobot dari gerak yang valid; `f_quality` tidak memperbesar noise. Jangan menyimpulkan tekanan kaki fisik dari rumus ini.

### 7.4 Tahap 4 — Bentuk profil tebal–tipis

- Awal stroke: masuk bertahap, bentuk kuas tidak tiba-tiba menjadi blok persegi.
- Perjalanan stabil: badan dominan dan pekat.
- Perubahan kecepatan/arah: pembesaran atau penyempitan terkendali, tanpa menambah lintasan imajiner.
- Jeda/pivot: pooling lokal dan sapuan busur yang mengikuti sisi telapak.
- Lift: taper/ujung kuas; stop tidak harus selalu meruncing bila posisi memang berhenti menapak.

Resampling pakai jarak maksimal **≤20% lebar lokal** dan adaptif menurut perubahan arah (angka awal tuning). Batas substep per frame + guard anti-jump wajib aktif.

### 7.5 Tahap 5 — Deposit material sekali per segmen

Lapisi `SumiStrokeGeometry` dengan:

1. **Core pigment:** alpha tinggi dan konsisten, bentuk solid yang terbaca dari jauh.
2. **Wet edge:** blur/bleed lokal di pinggir envelope (bounded, clipped).
3. **Dry fibers:** celah serat seeded di dalam envelope, lebih tampak saat kecepatan tinggi.
4. **Pooling:** deposit sedikit lebih gelap pada dwell/pivot sesuai batas.
5. **Overlap:** alpha source-over/premultiplied alpha pada **stroke baru**, tanpa penggelapan ulang karena tiap repaint.

Jangan meletakkan grain putih di luar batas mask; hindari bintik-bintik berserakan seperti noise layar.

### 7.6 Tahap 6 — Simpan tinta secara incremental

`PersistentInkStore` menerima `InkDeposit` dengan stable ID. ID yang sama tidak boleh dicetak dua kali. Deposit baru dirender sekali ke `OffscreenCanvas` atau canvas internal, lalu layer tersebut hanya di-*blit* saat frame berikutnya. Simpan metadata terbatas untuk debug/replay pendek, dengan opsi baked/tiled layer untuk sesi 30 menit.

**Jangan menyimpan semua 10.000+ dabs lalu mengecat semuanya ulang setiap frame.** Ini penyebab risiko FPS dan tidak cocok untuk seni yang menetap.

### 7.7 Tahap 7 — Render footprint sementara

Gunakan `PainterlyImpressionEngine` / geometri autentik yang sudah ada. Hitung alpha dari usia setiap stempel dengan default 6 detik. Render dalam `EphemeralFootprintLayer` terpisah. Layer tersebut dapat hilang seluruhnya sementara kanvas tinta tetap penuh.

### 7.8 Tahap 8 — Compose satu raster

Urutan:

```text
Fill warm white (#F5F5F2)
    ↓
Persistent ink (all accepted actor strokes)
    ↓
Ephemeral footprints (visible only while alive)
    ↓
Optional editor-only diagnostic overlay
    ↓
Stage Monitor / clean fullscreen
```

Blackout tetap mengambil alih output sebelum proses presentasi; preview fullscreen tidak boleh menampilkan HUD default. Transform artistik tidak boleh diam-diam mengubah koordinat Map atau jalur projector output.

---

## 8. Kontrak data usulan

```ts
export type SumiMaterial = 'sumi' | 'dry-brush' | 'dense-pigment';
export type StrokeLifetime =
  | { mode: 'keep' }
  | { mode: 'fade'; lifeMs: number };

export interface SumiSettings {
  renderer: 'sumi-v34' | 'foot-brush-v33' | 'legacy-v32';
  material: SumiMaterial;
  brushWeightPx: number;           // default 36 @ 1600x900
  brushExpression: 'natural' | 'bold';
  footprint: { visible: boolean; mode: 'fade' | 'keep'; lifeMs: number };
  ink: { visible: boolean; lifetime: StrokeLifetime };
  palette: { actorA: string; actorB: string; footOverrides?: Record<string, string> };
}

export interface InkSegmentEvent {
  id: string;                     // deterministic source/actor/foot/frames
  paintingSessionId: string;
  sourceKey: string;
  sourceEpoch: number;
  actorId: string;
  foot: 'left' | 'right';
  fromMs: number;
  toMs: number;
  basis: 'image-2d' | 'calibrated-estimate' | 'simulated';
  motionKind: 'observed-motion' | 'contact-drag' | 'pivot';
  provenance: 'detected-estimate' | 'video-estimate' | 'simulated';
  samples: readonly { x: number; y: number; headingRad?: number; quality: number }[];
  materialSeed: number;
}

export interface InkDeposit {
  id: string;
  paintingSessionId: string;
  actorId: string;
  geometry: SumiStrokeGeometry;    // bounded polygon/mesh + masks
  styleSnapshot: SumiSettings;     // stored at deposit time: old marks don't recolor
  sourceRange: { key: string; fromMs: number; toMs: number };
}
```

**Aturan:** `paintingSessionId` berbeda dari `sourceKey/sourceEpoch`. Perubahan sumber memotong event gerak aktif, tetapi **tidak** mereset painting session. `clearPainting()` membuang permanent cache dan ephemeral state secara eksplisit.

---

## 9. UI/UX Stage Monitor

### 9.1 Tampilan utama (ringkas)

```text
Garis · Painterly                                 SUMI V3.4
● MP4 · 4 kaki terbaca · gerak 2D / kontak terestimasi

KARAKTER TINTA       [ Sumi ● ] [ Kuas Kering ] [ Pigmen ]
BOBOT KUAS            [────────●────]  36 px
EKSPRESI             [ Natural ] [ Bold ● ]

TAPAK KAKI           [ ON ● ]   Hilang [ 6 dtk ]
SAPUAN TINTA         [ ON ● ]   [ Tetap ● ] [ Hilang ]

Aktor A              [ ■ Merah ]
Aktor B              [ ■ Arang ]

[ Bersihkan Lukisan ]                         [ Coba Demo ]

▸ Detail karakter kuas
▸ Detail kaki dan warna
▸ Periksa sumber
▸ Lanjutan: V3.3 / V3.2 (fallback)
```

- Jangan memenuhi panel dengan istilah teknis atau beberapa slider material di layar utama.
- Label **Sapuan tinta**, **Bobot kuas**, **Tetap**, dan **Bersihkan Lukisan** harus mudah terlihat.
- `Kuas V3.4` menjadi default hanya setelah semua acceptance P0 lulus; sebelum itu diaktifkan melalui flag eksperimental.
- Saat `Tetap` aktif, slider durasi stroke dinonaktifkan/disembunyikan. Footprint tetap punya slider hilang sendiri.
- Tombol **Bersihkan Lukisan** menghapus tinta + footprint. Tombol **Coba Demo** hanya menyalakan/mematikan sumber demo serta memotong stroke aktif, **tidak otomatis menghapus lukisan**. Untuk memulai gambar kosong gunakan Bersihkan / Mulai Lukisan Baru.
- Status input menyebut `sumber`, `jumlah kaki terbaca`, dan `perkiraan kontak`; detail confidence ada di `Periksa sumber`.
- Preferensi operator boleh disimpan pada sesi lokal, tetapi persistensi hasil lukisan setelah browser ditutup belum didukung pada P0.

### 9.2 Komposisi dan keluaran

- Utamakan raster 1600×900 dan responsif terhadap DPI tanpa mengubah proporsi footprint.
- Pastikan tampilan preview cukup terbaca; bila footage memenuhi area kecil, boleh beri **Preview Fit (P1)** yang secara eksplisit diberi label `Komposisi preview`.
- Jangan mengubah mapping fisik, kalibrasi 4 titik, blackout gate, atau routing Resolume/TouchDesigner.
- Jangan menggambar huruf Jepang literal, watermark referensi gambar, atau calligraphy template.

---

## 10. Modul engineering dan file target

| Prioritas | Modul | Implementasi |
| --- | --- | --- |
| P0-01 | `ObservedMotionInkEngine.ts` (NEW) | Terbitkan segmen ink untuk semua sumber berdasarkan gerak teramati dan gate kualitas; tetap konservatif untuk `contact-drag` |
| P0-02 | `SumiStrokeGeometryBuilder.ts` (NEW) | Bidang kuas/ribbon, responsive width, taper, pivot swept-envelope, stabil pada heading/curvature |
| P0-03 | `SumiMaterialRenderer.ts` (NEW) | Core pigment, dry grain, bounded bleed, pooling, overlap seeded |
| P0-04 | `PersistentInkStore.ts` (NEW) | Incremental raster cache/bake, dedup, source-independent painting session, memory budget |
| P0-05 | `FootBrushStrokeRenderer.ts` (MODIFY/REUSE) | Tetap mendukung V3.3, tetapi hentikan pemakaian repeated foot stamp sebagai badan tinta V3.4 |
| P0-06 | `PainterlyCanvasRenderer.ts` (MODIFY) | Compositor layer permanen + footprint sementara; blackout prioritas tertinggi; fallback |
| P0-07 | `LineTrailsV3.tsx` (MODIFY) | Integrasi semua source, clear vs cut semantics, seek, pause, DEMO; stage/fullscreen |
| P0-08 | `SurfaceComposer.tsx` (MODIFY) | Kontrol default Sumi, reset eksplisit, warna aktor, UI ringkas |
| P0-09 | `tests/painterly-sumi-v34*.test.ts` & browser QA | Test deterministic geometry, persistent stroke, source parity, clock, visual diff |
| P1-01 | `PainterlyPreviewTransform.ts` | Preview Fit untuk area gerak kecil tanpa mengubah Map |
| P1-02 | PNG/replay/session export | Simpan komposisi dan metadata yang bisa ditampilkan ulang |

**Modul lama yang dipertahankan:** `SourceFrameNormalizer.ts`, `FootBrushPoseAdapter.ts`, `FootContactGestureEngine.ts`, `FootBrushGeometryBuilder.ts`, `PainterlyImpressionEngine.ts`, `authenticFootGeometry.ts`, `ActorPaletteResolver.ts`, `DualFootTrajectoryEngine.ts`.

**Fallback:** pilihan `sumi-v34` / `foot-brush-v33` / `legacy-v32` harus berfungsi, termasuk ketika preview fullscreen. Tidak ada perubahan default sebelum smoke test dan visual signoff.

---

## 11. Acceptance criteria — hasil visual

- **AC-V01 — Tebal default.** Pada fixture yang sama, sapuan V3.4 tampak sebagai **bidang tinta** dengan tebal–tipis kontras, bukan garis pusat 1–2 px atau deretan telapak berulang. Ukur snapshot 1600×900; nilai awal lebar utama sekitar 36 px pada segmen biasa (toleransi ditetapkan reviewer dari hasil visual).
- **AC-V02 — Footprint sementara.** Setelah 6 detik waktu sumber yang aktif, telapak yang dicetak sudah memudar, sementara sapuan terkait masih terlihat dengan alpha sama.
- **AC-V03 — Stroke tetap.** Snapshot lukisan pada T+10, T+60, dan T+600 detik tidak kehilangan cat lama ketika tidak ada event baru. Repaint tidak menebalkan tinta.
- **AC-V04 — Gestur kuas.** Walk, turn, hesitation, stop/start, drag, dan pivot memiliki karakter tebal–tipis berbeda yang selalu bersandar pada gerak valid.
- **AC-V05 — Overlap.** Persilangan sapuan aktor menghasilkan penumpukan tinta yang wajar; warna aktor tidak bertukar dan tidak menjadi sama.
- **AC-V06 — Material.** Sumi, Kuas Kering, Pigmen Pekat menghasilkan tiga siluet/tekstur yang dapat dibedakan pada frame dari lintasan identik.
- **AC-V07 — Dilihat dari panggung.** Dua reviewer (artistik & operator) menilai referensi hasil 10 detik, 1 menit, 5 menit, dari simulasi tampilan proyektor/monitor. Fokus: kejelasan bidang, ruang kosong, keterbacaan merah–hitam, rasa kuas, keterkaitan dengan kaki. Target penilaian awal ≥4/5 setiap kategori; penilaian bersifat subjektif dan tetap dicatat.
- **AC-V08 — Non-imitasi.** Engine tidak menggambar hiragana/kanji literal atau jalur dekoratif di luar sampel gerak.

## 12. Acceptance criteria — perilaku dan keselamatan

- **AC-T01 — Sumber tunggal engine.** Webcam, HP, MP4, simulator dan DEMO masuk ke adapter serta Sumi renderer yang sama; tes parity memakai fixture yang disetarakan.
- **AC-T02 — Dua aktor.** Empat channel `A:left/right`, `B:left/right` terpisah; identity ambiguity memotong deposit baru.
- **AC-T03 — Clear benar.** `Bersihkan Lukisan` benar-benar mengosongkan cached ink, dedup index, dan tapak. Penggantian sumber/seek/blackout **tidak** menghapus lukisan.
- **AC-T04 — MP4 deterministic.** Pause membekukan input; seek memotong continuity tanpa jembatan palsu; replay timestamp identik tidak mencetak ulang ink, kecuali operator memilih mode penumpukan ulang terpisah (P1).
- **AC-T05 — No phantom ink.** Tidak ada sapuan pada titik yang tidak pernah diobservasi atau dari stale frame, low confidence, dan sumber lain. Tinta interpretasi gerak dibedakan dari estimasi kontak.
- **AC-T06 — Keep stability.** 30 menit sesi `Tetap` dapat berjalan tanpa buffer tumbuh tak terkendali. Tidak ada full-scene redraw semua dabs di setiap `requestAnimationFrame`.
- **AC-T07 — Render budget.** Target desktop benchmark ≥30 FPS, P95 pekerjaan painterly ≤12 ms, resolusi 1600×900, 2 aktor × 2 kaki; catat perangkat/browser, peak heap, dropped frames, dan jumlah deposit baked.
- **AC-T08 — Output aman.** Stage Monitor dan fullscreen memiliki komposisi sama, fullscreen bersih; blackout menutup layar tanpa menghapus lukisan, Gate LIVE/Map/F3/Resolume/TouchDesigner tidak diregresikan.
- **AC-T09 — Rollback.** Pindah ke V3.3/V3.2 tidak menulis ulang gaya lama atau merusak session. Migrasi preferensi `material=ink` dipetakan ke `sumi` hanya saat memilih renderer baru.
- **AC-T10 — CI & browser.** Unit, TypeScript build, Painterly browser QA, source switching, fullscreen, dan projector WYSIWYG lulus; kegagalan workflow yang sudah ada dipisahkan dan ditangani sebelum mengklaim kesiapan panggung.

---

## 13. Matriks QA lintas sumber

| Skenario | Hasil wajib |
| --- | --- |
| Webcam 1 aktor berjalan lurus | Stroke Sumi lebar dari sampel valid, footprint memudar |
| HP kamera via browser/QR | Renderer dan palet sama; reconnect memotong segmen, tinta lama tetap |
| HP kabel / webcam virtual jika dikenali Track | Masuk jalur kamera generik; tidak perlu engine tersendiri |
| MP4 2 aktor crossing | 4 channel, identity gate, tidak menukar merah/arang |
| MP4 pause | Tinta tetap; tidak menambah dab saat pause |
| MP4 seek maju/mundur/loop | Lukisan lama tetap, tidak ada jembatan/duplikasi |
| Simulator 3D | Observed/simulated motion menulis tinta lewat Sumi renderer sama |
| DEMO | Output tebal dan jelas; toggle DEMO tidak menghapus lukisan |
| Slide/drag kontak | Smear bersambung, tebal dan bertekstur; tidak jadi stempel berulang |
| Heel/toe pivot | Sweep melengkung berporos pada anchor valid |
| Stop/hesitation | Pigmen berkumpul terbatas, tanpa noise baru saat diam |
| Missing-foot / kamera putus | Tidak ada cat baru, tinta lama tetap |
| Ganti sumber input | Potong stroke aktif; layer permanen tetap tampil |
| Tekan Bersihkan | Canvas kosong total dan deterministik |
| Blackout / preview off | Layar padam, cache lukisan tetap; resume aman |
| Fullscreen & resize DPR 1/2 | Stroke tidak berubah proporsi, HUD hilang |

---

## 14. Performance dan batas memori

- **P0:** persistent raster layer dipaint incremental saat event baru diterima; repaint frame berikutnya cukup `drawImage` cached layer + footprint sementara.
- Cache RGBA canvas 1600×900 memakan kira-kira **5,8 MB per layer** mentah; jumlah layer dan backing store harus dicatat nyata pada browser/perangkat.
- Hindari menyimpan `ImageData` penuh per event. Metadata stroke boleh disimpan ring-buffer terbatas; ink permanen tersimpan pada cached raster/tile sampai clear.
- Dedup `eventId` tidak boleh tumbuh tak terbatas pada MP4 loop: gunakan indeks compact per clip + frame span dan aturan eviction yang tidak mengizinkan duplikasi setelah event dibake selama sesi yang sama.
- Pemisahan actor layers harus tetap mempertahankan cat asli, warna, dan keterurutan deposit yang dapat diterima secara visual. Jika show/hide A/B diperlukan, sediakan tile cache yang bisa dibangun ulang dari data sesi atau dokumentasikan mode raster per aktor.
- DPI/resize jangan menghapus lukisan; tentukan kebijakan rerender/copy cached raster saat ukuran canvas berubah. Untuk P0 pakai **canonical 1600×900 raster** dan fit compositing, supaya hasil terjaga saat fullscreen.
- Uji smoke: 2, 10, dan 30 menit `Tetap`, 1P/2P, 45 FPS target render loop, kualitas adaptif hanya pada grain density tanpa menggeser atau menghilangkan lokasi stroke.

---

## 15. Rencana pengerjaan dan urutan rilis

**Tahap P0-A — Perubahan yang langsung terlihat**

1. Buka `Sumi` dan `Bold` default **di branch eksperimen**.
2. Buat `PersistentInkStore`: `keep=true`, `clear` terpisah dari `cutMotionSegment`.
3. Buat real `SumiStrokeGeometryBuilder`: continuous ribbon dan taper, tidak memakai stempel telapak sebagai pengisi stroke.
4. Renderer tinta hitam/merah dengan bounded grain dan opacity overlap.

**Tahap P0-B — Integrasi**

5. Route semua sumber ke `ObservedMotionInkEngine`; warna/identitas tetap.
6. Footprint sementara 6 detik, tinta tetap; MP4 pause/seek, HP reconnect, Demo toggle.
7. UI ringkas Bobot Kuas, Sumi, Tetap, Bersihkan Lukisan; fallback V3.3/V3.2.

**Tahap P0-C — QA & release**

8. Unit + pixel/snapshot E2E, negative-flow 1P/2P, 30 menit cached-raster soak.
9. Periksa target screenshot pada resolusi Stage Monitor dan simulasi proyeksi fisik. Review artistik harus melihat sapuan benar-benar tebal dan membentuk bidang.
10. Merge ke `main` hanya setelah QA P0 dan review visual selesai, lalu deploy GitHub Pages dan verifikasi URL publik. Vercel tetap tidak disentuh.

**P1:** Preview Fit eksplisit, ekspor PNG, session archive/replay, preset custom bobot, optional *creative repaint* saat loop video, Undo last stroke jika metadata mencukupi.

---

## 16. Definition of Done

V3.4 dianggap selesai ketika aktor berjalan atau memutar kaki; dari setiap sampel gerak yang valid muncul sapuan tinta merah/arang yang tebal, hidup, dan bertumpuk di kanvas. Stempel kaki terlihat beberapa detik lalu hilang. Setelah gerakan berhenti, lukisan tetap utuh walaupun sudah lewat satu menit atau operator mengganti input. Keseluruhan hasil terbaca sebagai karya kuas dari jarak penonton. `Bersihkan Lukisan` mengosongkannya, dan blackout tetap menutup output. Seluruh input memanfaatkan satu pipeline, QA utama lulus, serta build dan deployment Pages telah diverifikasi.

**Catatan teknis:** Sumi V3.4 meminjam karakter sapuan dari referensi tinta Jepang/Cina, dengan geometri yang berasal dari jejak tubuh. Ketebalan dan kepekatan dihasilkan dari pemetaan gerak visual. Input video/kamera RGB tetap tidak dapat membuktikan tekanan kaki atau fleksi jari yang tak terukur.