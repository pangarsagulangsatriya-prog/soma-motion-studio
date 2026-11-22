# SOMA Motion Studio — PRD V3.5
## Path-first Sumi Engine: Jalan yang Ditulis oleh Kaki

**Tanggal:** 23 November 2026  
**Status:** PROPOSED / spesifikasi desain; belum diimplementasikan  
**Produk:** SOMA → Compose → Garis BETA → Stage Monitor / Fullscreen  
**Basis teknis:** Painterly V3.4 Sumi Persistent Ink, setelah rilis `f249041`  
**Masukan visual:** screenshot V3.4 dengan massa tinta merah–hitam yang terpotong-potong di bagian bawah kanvas.  
**Fokus pertunjukan:** *Unpacking: In Passing (Melintas)* — jalan terbentuk dari pergerakan dan pertemuan dua aktor.  
**Lingkup rilis:** GitHub Pages setelah pengujian; tidak mengubah Vercel, Map, F3 Capture, atau kontrak output Resolume/TouchDesigner.

---

## 1. Masalah yang hendak diselesaikan

V3.4 sudah mempertahankan tinta dan memperbesar bobot kuas, tetapi bentuk yang keluar masih berupa **potongan polygon dan cap tumpang-tindih**. Warna merah dan hitam membentuk gumpalan; penonton sulit mengikuti dari mana aktor berangkat, ke mana ia berbelok, dan bagaimana jalannya bertemu aktor lain. Ujung kuas tidak meruncing, tekstur tidak mengikuti arah gerak, dan ruang kosong tertutup bidang padat.

**Temuan pada implementasi V3.4 yang perlu diganti:**
- `ObservedMotionInkEngine.ts` menghasilkan event per perpindahan pose kaki.
- `SumiStrokeGeometryBuilder.ts` membangun ribbon **per pasangan pose/event**, bukan satu garis berkelanjutan di sepanjang urutan gerak.
- `SumiMaterialRenderer.ts` mencetak setiap bidang sendiri; ujung/joint segmen terlihat kotak, penumpukan alpha membuat noda menggelap.
- `PersistentInkStore.ts` melakukan bake setiap event ke raster permanen. Kesalahan bentuk segera terkunci dan ikut menumpuk.
- Default Bold 56 px membuat kelemahan sambungan makin terlihat. Sekadar menurunkan slider belum menyelesaikan kontinuitas.
- Empat lintasan kaki yang diberi bobot sama berpotensi menumpuk menjadi massa, sehingga logika **satu jalan per aktor** tidak terbaca.

**Masalah produk:** SOMA menampilkan pigmen yang ditinggalkan tracking, sedangkan pertunjukan membutuhkan **jalan yang tumbuh sepanjang aksi berjalan**.

## 2. Janji artistik

> Dua aktor bergerak. Setiap langkah yang terbaca memperpanjang sebuah jalan tinta. Jalur berbelok, berhenti, terputus, lalu dimulai kembali mengikuti kaki. Footprint muncul sesaat dan menghilang; jalan yang sudah terbentuk tinggal di kanvas.

Urutan visual yang harus terbaca penonton: **gerak kaki → jejak sementara → path yang terus bertambah → pertemuan dua path → komposisi akhir**.

V3.5 mengambil **perilaku fisik kuas sumi**: ujung meruncing, badan sapuan berisi, serat searah, tepi tak rata, dan sedikit cipratan pada peristiwa tertentu. Sistem **tidak membentuk huruf Jepang secara otomatis** dan tidak menggunakan splatter sebagai dekorasi acak.

## 3. Kontrak visual (keputusan desain)

| Elemen | Default V3.5 | Alasan |
|---|---|---|
| Mesin | **Path-first Sumi** | Jalan tetap terbaca sebelum detail tinta |
| Mode pembentukan | **Actor Path**: 1 jalur utama per aktor | Menghindari 4 pita yang bertumpuk |
| Mode alternatif | **Foot Path**: L/R terpisah | Studi telapak dan eksperimen koreografi |
| Bobot kuas utama | **26 px** pada raster 1600 × 900 | Lebih ringan dari 56 px dan mudah diikuti |
| Rentang bobot UI | 8–64 px | Operator dapat mengubah bobot dengan cepat |
| Bobot adaptif | 0,75–1,30 × bobot utama, batas 8–42 px pada preset Path | Tebal-tipis terasa tanpa menggumpal |
| Kepala kuas | Taper pendek, 1–2 × lebar lokal | Sapuan mulai secara halus |
| Ekor kuas | Taper 2–4 × lebar lokal saat stroke berakhir | Ujung tidak berhenti sebagai balok |
| Opasitas inti | 0,72–0,85 | Pigmen tegas, ruang kosong terjaga |
| Tekstur | Serat searah path, medium-low | Rasa kuas dari gestur yang sama |
| Dry-brush | Area tipis/serat kosong terkontrol | Menghindari solid vector ribbon |
| Cipratan | Off untuk gerak normal; aksen rendah pada pemicu valid | Menjaga path dominan |
| Footprint | ON, fade **6 detik** | Bukti pijakan sementara |
| Path | **Persistent**, tidak memudar dalam sesi | Jalan mengendap sebagai lukisan |
| Latar | Putih hangat `#F5F5F2` | Kontras untuk proyeksi dan ruang kosong |
| Aktor A/B | Merah `#E44F32` / arang `#242424` | Satu warna utama per aktor |
| Preview Fit | Opsi terpisah untuk tampilan Compose | Tidak mengubah koordinat Map/proyektor |

**Kriteria paling penting:** hasil 20–60 detik harus masih terlihat sebagai **dua path dengan arah dan belokan**, ketika ditampilkan kecil atau dari jarak penonton. Detail serat, noda, dan cipratan tidak boleh menutupi jalur.

## 4. Contoh tampilan target

**Saat aktor mulai berjalan:** satu kepala kuas meruncing muncul di dekat pijakan pertama, kemudian berkembang menjadi ribbon yang menyambung. Dua atau tiga footprint sesaat berada di atas path. Tidak ada segi empat terpisah.

**Saat aktor berbelok / menghindar:** path melengkung dengan radius sesuai perubahan arah yang terbaca. Sisi luar lengkung sedikit lebih penuh; sisi dalam lebih kering. Jalur A merah dan jalur B hitam tetap bisa diikuti walau berpapasan.

**Saat aktor ragu / berhenti:** path berhenti memanjang; pigmen menebal sedikit pada ujungnya. Tidak muncul cipratan dari jitter tracking. Saat gerak lanjut dalam keadaan masih terhubung, sambungan tetap mulus.

**Saat kaki terangkat / tracking hilang:** stroke berakhir dengan ekor terkontrol. Sistem tidak menarik garis menuju titik deteksi berikutnya. Path lama tidak dihapus.

**Di akhir sesi:** footprint memudar; bidang putih masih luas; dua garis jalan merah–hitam tertinggal sebagai komposisi, bukan gumpalan cap.

## 5. Konsep data: dari empat kaki menjadi dua jalan

### 5.1 Actor Path — default

SOMA menggunakan pose kaki kiri dan kanan sebagai **input gerak**, lalu membangun **satu centerline untuk setiap aktor**. Peran tiap kanal:

- **Aktor A / Aktor B:** dua path utama dengan warna berbeda.
- **Kaki kiri/kanan:** bukti peristiwa pijakan, pergantian tumpuan, detour, pivot; mengubah kurva atau tekanan visual lokal.
- **Footprint:** tetap mengikuti kaki yang teramati, menumpang sementara di atas path.
- **Peristiwa langkah:** memajukan ujung path dan memberi struktur ritmis. Kaki yang terangkat tidak menghasilkan goresan panjang tak terkendali.

Estimator titik aktor pada saat `t`:

1. Kumpulkan estimasi kaki A-L / A-R, confidence, sumber, dan penanda tumpuan bila tersedia.
2. Jika dua kaki valid dan gerak tumpuan plausible, hitung pusat support yang dibobot; jika satu kaki valid, pertahankan estimasi centre lewat track temporal dengan batas pergeseran.
3. Jika tumpuan tidak teramati, gunakan **estimated ground-projection path** hanya setelah melewati confidence/continuity gate; beri tag `estimated`, bukan klaim kontak fisik.
4. Hindari perpindahan pusat path mendadak dari satu kaki ke kaki lain. Gunakan transisi yang di-smooth dan bounded.
5. Saat identitas aktor tidak pasti atau teleport melewati ambang, **cut segment**. Jangan menarik garis antar posisi yang tidak terbukti tersambung.

### 5.2 Foot Path — alternatif

Operator dapat memilih jalur per kaki untuk keperluan analisis koreografi. Dua ribbon A-L/A-R tetap memakai warna aktor yang sama, dengan perbedaan intensitas/karakter bila diatur. Mode ini **bukan** default artistik Unpacking karena empat path mudah menumpuk.

## 6. Arsitektur alur baru

```text
Webcam / HP / MP4 / 3D / Demo
            ↓
SourceFrameNormalizer (reuse V3.4)
            ↓
FootBrushPoseAdapter + actor identity gates (reuse)
            ↓
PathObservationRouter             [NEW]
            ↓
ActorPathTracker (A, B)           [NEW]
  ├─ support/ground estimate
  ├─ source + timestamp continuity
  ├─ smooth + de-jitter
  └─ segment events: START / ADD / TURN / STOP / CUT
            ↓
PathSplineFitter                 [NEW]
            ↓
SumiRibbonMeshBuilder            [NEW]
            ↓
DirectionalInkPainter            [NEW]
  ├─ solid core + irregular edge
  ├─ tangent-aligned bristles
  ├─ tapered head/tail
  └─ conditional splatter
            ↓
PersistentPathStore              [NEW/REFINE V3.4]
  ├─ committed ink atlas
  └─ editable active tail
            ↓
Stage Canvas Compositor
  ├─ warm-white background
  ├─ persistent path
  ├─ ephemeral footprint (fade 6s)
  └─ diagnostics (editor only)
            ↓
Stage Monitor / fullscreen / validated output
```

## 7. Pipeline rendering step-by-step

### STEP 0 — Normalisasi sumber

Semua sumber melewati jalur pose yang sama. Setiap sample memuat `sourceIdentity`, `sourceEpoch`, `actorId`, `foot`, `sourceTimeMs`, posisi 2D, confidence, heading (jika valid), dan provenance. `MP4 pause/seek`, perubahan sumber, kamera hilang, serta dedup replay tidak boleh mengarang sambungan path.

### STEP 1 — Validasi dan stabilisasi pengamatan

- Gunakan confidence gate, ambang teleport relatif terhadap `dt`, serta recovery untuk `A/B` crossing.
- Potong apabila confidence rendah terus-menerus, identitas aktor ambigu, waktu mundur, atau sumber berubah.
- Jitter kecil (mis. di bawah 2 px kanonik) tidak membentuk knot baru.
- Penapisan **adaptif**, bukan rata-rata besar yang membuat tubuh tertinggal dari gerakan.
- Simpan titik mentah dan titik stabil pada diagnostics, tanpa memproyeksikan debugging ke layar penuh.

### STEP 2 — Bangun pusat jalur aktor

Hasilkan `ActorPathObservation` per aktor yang sudah stabil. Knots terbit bila gerak melewati ambang jarak **atau** ada belokan yang relevan. Pijakan kiri/kanan berfungsi sebagai cue perubahan tumpuan; tidak otomatis menggambar dua bidang besar.

Contoh kontrak data:

```ts
interface ActorPathObservation {
  actorId: 'A' | 'B';
  sourceKey: string;
  epoch: number;
  sourceTimeMs: number;
  point: {x: number; y: number}; // basis 1600 x 900
  directionRad?: number;
  confidence: number;
  evidence: 'supported-step' | 'estimated-ground-projection';
  footEvent?: 'left-contact' | 'right-contact' | 'pivot' | 'none';
}
```

### STEP 3 — Segmentasi yang tepat

Satu stroke menyimpan `strokeId`, `actorId`, `startMs`, daftar knots, `sourceIdentity`, dan status `active | cut | finalized`.

- **START:** pengamatan pertama valid setelah cut.
- **ADD:** titik berikutnya meneruskan stroke jika timestamp, posisi, arah, dan identitas terhubung.
- **TURN:** kurva berbelok; stroke tetap satu.
- **STOP:** ujung ditahan dan hanya pooling kecil (berbatas); tidak menambah path berulang ketika diam.
- **CUT:** tracking hilang/seek/switch/lift tepercaya/teleport; finalize ekor. Cat lama tetap.
- **CLEAR:** hanya tombol Bersihkan Lukisan / sesi baru yang menghapus cat permanen.

Jangan memotong stroke pada **setiap frame**. Kontinuitas harus hidup pada actor track, terlepas dari event telapak yang datang silih berganti.

### STEP 4 — Spline dan arah goresan

- Resample titik sepanjang arc length; gunakan **centripetal Catmull–Rom** atau quadratic smoothing lokal dengan batas overshoot.
- Evaluasi tangent dari hasil spline untuk mengarahkan badan kuas dan seratnya.
- Batasi deviasi spline dari pengamatan asli. Sudut belokan tajam mengikuti tindakan kaki, bukan dipoles menjadi lengkung dekoratif.
- Segment gaps yang sah tetap kosong; spline tidak boleh menghubungkan dua sumber/aktor/seek.

### STEP 5 — Lebar lokal, taper, dan tekanan visual

Bobot kuas di setiap titik `s` mengikuti profil bounded:

```text
W(s) = clamp(W0 × Fspeed(s) × Fcurve(s) × Fconfidence(s), Wmin, Wmax)
W0 = 26 px; preset Path: Wmax = 42 px
```

- `Fspeed`: perubahan kecil untuk ritme gerak; tidak menganggap kecepatan sebagai tekanan fisik sebenarnya.
- `Fcurve`: sisi luar belokan sedikit lebih penuh; pembesaran maksimum 20–25%.
- `Fconfidence`: menahan noise; confidence rendah memotong stroke daripada membuat noda besar.
- `head envelope`: ramp 0.25 → 1 pada 1–2 lebar lokal.
- `tail envelope`: ramp 1 → 0 pada 2–4 lebar lokal ketika stroke **benar-benar** finalize, bukan setiap frame.
- Cap/ujung `round/tapered`, tidak berakhir menjadi bentuk persegi.

### STEP 6 — Bangun mesh ribbon kontinu

Offset normal di kiri/kanan centerline membentuk satu **bidang ribbon**. Join memakai geometri berkesinambungan, tangent/normal yang stabil, serta pembatas miter pada belokan. Hindari polygon tersendiri yang menumpuk alpha pada tiap `ADD`.

**Kaidah seam:** selama stroke aktif, ekor yang belum pasti tetap berada pada `active-tail layer`. Hanya wilayah yang geometri dan sambungannya sudah stabil masuk `committed ink atlas`. Layer aktif digambar ulang di atas atlas; bagian yang sama **tidak** dipigmen ulang per RAF. Ketika cut, render taper terakhir dan commit **sekali**.

### STEP 7 — Material tinta terarah

Untuk tiap stroke: inti beropasitas sedang, tepi bertekstur halus, serta beberapa serat panjang yang mengikuti tangent lokal. Noise deterministik memakai `(paintingSessionId, strokeId, arcLengthBin)` agar saat frame diulang tekstur tidak berubah.

**Tiga karakter material:**

- `Path Sumi` (default): alur bersih, serat halus, sedikit dry edge.
- `Dry Ink`: lebih banyak jalur serat kosong dan tepian putus.
- `Pigment Mass`: bidang lebih padat, pilihan sekunder untuk studi visual.

Batas keras: serat dan ragged edge tetap melekat ke geometri ribbon, tidak menjadi splash baru yang melayang ke mana-mana.

### STEP 8 — Cipratan tinta berbasis peristiwa

Cipratan baru muncul ketika **peristiwa gerak yang layak** terdeteksi: akselerasi perubahan arah tajam, heel/toe pivot tepercaya, atau landing dengan perubahan kecepatan cukup besar. Sinyal dari video 2D tidak otomatis mengukur gaya hentakan.

- Default intensitas `Subtle`: 0–3 mikropercikan per event yang lolos gate; rentang radius kecil, mis. 1–3 px.
- Sebaran mengikuti arah tangent/percepatan dan berada dekat path, bukan acak di seluruh kanvas.
- Seed stabil berbasis `strokeId/eventId`, ada cooldown per aktor agar tidak terus-menerus menyembur.
- Jika provenance hanya estimated dan event kurang meyakinkan, **tidak ada percikan**.
- Kontrol `Off / Subtle / Expressive`, default `Subtle` tetapi hasil pada walking biasa dapat nihil.

### STEP 9 — Komposisi berlapis

Urutan:

1. Latar putih hangat.
2. `committed ink atlas` (persistent).
3. `active-tail layer` (sementara, terhubung secara visual dengan path).
4. Footprints sementara dengan fade 6 detik.
5. Debug overlays bila operator aktifkan pada editor; **tidak tampak pada fullscreen default**.

Dua aktor menyimpan lane warna masing-masing. Perpotongan path dapat gelap secara wajar, tetapi satu stroke tidak menggelap hanya karena canvas di-redraw.

### STEP 10 — Path memory, clear, export

- Pergantian sumber, kamera HP reconnect, seek, pause, perubahan preset, dan blackout **tidak menghapus** lukisan yang sudah disimpan.
- `cutMotionSegment(reason)` menutup gerakan aktif dan mem-finalisasi ekor hanya pada kondisi yang tepat.
- `clearPainting()` mengosongkan committed ink, active tail, footprints, serta indeks replay/dedup.
- `exportPNG()` menyimpan komposisi putih+tinta (opsi tapak tanpa HUD).
- Ekspor sesi JSON mempertahankan raster/lapisan dan indeks replay; tidak boleh mengikutsertakan video mentah atau wajah penonton.
- Refresh tab tidak dijanjikan memulihkan sesi sebelum penyimpanan persisten tersendiri dibuat dan diuji.

## 8. Aturan khusus gerak panggung

| Gestur / event | Respons path | Footprint | Aksen |
|---|---|---|---|
| Jalan stabil | Ribbon panjang mengikuti pusat aktor | Tapak muncul lalu hilang | Serat searah |
| Avoidance / menghindar | Lengkung berbelok, tetap kontinu | Jejak mengikuti posisi sebenarnya | Sedikit penekanan di belokan |
| Hesitation / ragu | Ujung memendek/diam, tidak dipanjangkan jitter | Tapak terakhir memudar | Pooling ringan |
| Detour | Belok → jalan baru → kembali | Tapak sementara | Tidak membuat huruf dekoratif |
| Stop–start | Tahan ujung lalu lanjut jika track masih valid | Tapak sesuai kontak | Kepala/ekor hanya jika benar-benar cut |
| Pivot | Kurva pendek sesuai pusat tumpuan yang valid | Rotasi telapak | 0–3 mikropercikan jika gate lolos |
| Foot lift | Cut segment jika teramati secara tepercaya | Tapak terakhir memudar | Ekor meruncing |
| Aktor berpapasan | Dua path tetap terpisah warna/ID | Jejak tidak tertukar | Overlap menambah kepekatan wajar |
| Seek MP4 / kamera putus | Cut, tidak menyambung lokasi jauh | Jam fade mengikuti kebijakan media | Tinta lama menetap |

## 9. UI/UX: sedikit kontrol, visual langsung terbaca

Saat membuka **Garis BETA**, pilihan utama tampil ringkas:

```text
[ Path Sumi ] [ Foot Path ] [ Legacy V3.4 ]

Bobot kuas       26 px  ───●────────
Karakter         [ Sumi ] [ Kering ] [ Pekat ]
Aksen tinta      [ Off ] [ Subtle ] [ Ekspresif ]
Tapak kaki       [✓] Hilang 6 dtk
Path             [✓] Tetap

[ Coba Demo ] [ Bersihkan Lukisan ] [ Layar penuh ]

▸ Detail gerak & diagnostik
▸ Arsip lukisan / ekspor PNG
```

- `Path Sumi` default; tidak memaksa operator masuk ke pengaturan lanjutan.
- Slider bobot memberi perubahan **pada sapuan berikutnya**, tidak mengubah pigmen lama secara diam-diam.
- Preview harus mencantumkan `Path A/B aktif`, `Gerak teramati / estimasi`, serta indikator `tinta tersimpan`; status diagnostik panjang disembunyikan.
- **Komposisi preview** dapat dipakai untuk menampilkan path yang terbentuk di area kecil; status harus jelas: *preview visual only*. Koordinat fisik pada Map/proyektor tidak berubah.
- `Legacy V3.4` tetap bisa dipilih untuk membandingkan hasil; mode V3.2/V3.3 tidak dihapus dari internal fallback.
- Tidak ada pilihan estetika yang mengubah kontrak koneksi Track/Map/Perform.

## 10. Kontrak modul kode

| Modul | Aksi | Tanggung jawab |
|---|---|---|
| `SourceFrameNormalizer.ts` | REUSE | Semua sumber menuju format yang sama |
| `FootBrushPoseAdapter.ts` | REUSE | Pose kaki dan provenance |
| `PathObservationRouter.ts` | NEW | Pengamatan per aktor + estimasi support |
| `ActorPathTracker.ts` | NEW | Identitas A/B, continuity, START/ADD/STOP/CUT |
| `PathSplineFitter.ts` | NEW | Smoothing, resampling, tangent, anti-overshoot |
| `SumiRibbonMeshBuilder.ts` | NEW | Bidang kuas kontinu, tapered head/body/tail |
| `DirectionalInkPainter.ts` | NEW | Serat/tepi/bleed/cipratan berbasis tangent |
| `PersistentPathStore.ts` | NEW/REFINE | Committed ink, editable tail, dedup, clear, export |
| `PainterlyCanvasRenderer.ts` | MODIFY | Compositor path+tanda kaki+blackout, same fullscreen |
| `LineTrailsV3.tsx` | MODIFY | Wiring path-first dan mode legacy |
| `SurfaceComposer.tsx` | MODIFY | Preset dan kontrol operator ringkas |
| `tests/path-first-sumi-v35.test.ts` | NEW | Unit/geometry/persistence/source parity |
| `e2e/path-first-sumi-v35.spec.mjs` | NEW | Browser E2E dan screenshot visual |

**Batas migrasi:** jangan mengandalkan `SumiStrokeGeometryBuilder.ts` V3.4 sebagai perancang ribbon V3.5. Simpan V3.4 sebagai mode pembanding sampai visual V3.5 disetujui; ganti rutinitas bake event-by-event hanya pada path-first runtime.

## 11. Acceptance criteria dan bukti wajib

### A. Keterbacaan artistik — release blocker

- [ ] Pada fixture berjalan lurus ±20 detik, path tampak sebagai **satu lintasan berkelanjutan per aktor**. Tidak terlihat potongan polygon atau cap kotak pada join.
- [ ] Pada fixture belok, path mengikuti sudut dan radius gerak, tidak mengisi ruang menjadi blob.
- [ ] Pada 10 detik / 1 menit / 5 menit, screenshot tetap memperlihatkan arah path dan ruang kosong yang memadai.
- [ ] Saat gambar dikecilkan hingga lebar 320 px, peninjau masih dapat mengikuti awal–akhir jalur merah dan hitam.
- [ ] Ujung kepala/ekor terlihat meruncing ketika sebuah stroke benar-benar dimulai/berakhir.
- [ ] Serat kuas mengikuti tangent, bukan serat acak horizontal yang mengiris badan stroke.
- [ ] Cipratan terkontrol di sekitar peristiwa; tidak muncul dari tracking jitter/low confidence.
- [ ] Sedikitnya dua peninjau (artistik dan operator) memberi ≥4/5 untuk `path readability`, `stroke continuity`, `ink quality`, dan `connection to walking`.

### B. Kebenaran gerak — release blocker

- [ ] Dua aktor / empat kaki tetap terdeteksi; path warna A/B tidak tertukar ketika crossing.
- [ ] Bila satu kaki tertutup, path aktor tidak teleport ke kaki lainnya.
- [ ] Saat sourceKey/epoch berubah, penambahan path berikutnya tidak disambung ke titik lama.
- [ ] Pause/seek/replay MP4 tidak menggandakan tinta pada interval yang sama.
- [ ] Path dari input simulasi berlabel simulasi; pengamatan 2D tidak dipasarkan sebagai bukti tekanan lantai.
- [ ] Hasil engine sama pada webcam, kamera HP, MP4, simulator 3D dan demo untuk bentuk event yang setara.

### C. Persistensi & performa — release blocker

- [ ] Footprint fade = 6 detik; path tetap identik pada T+10/T+60/T+600 tanpa pengamatan baru.
- [ ] Menggambar ulang 100 kali tanpa event baru tidak menambah opacity.
- [ ] `cutMotionSegment()` tidak menghapus path; `clearPainting()` menghapus semuanya.
- [ ] Perubahan material/ketebalan tidak mengganti warna tinta lama.
- [ ] 30 menit simulasi dua aktor: memori terkontrol, tidak menggambar ulang seluruh sejarah per frame.
- [ ] Target performa perangkat benchmark: ≥30 FPS dan waktu painterly P95 ≤12 ms; laporkan CPU/GPU/DPR/input yang dipakai. Angka ini target uji, belum terbukti.
- [ ] Stage Monitor dan fullscreen memakai komposisi yang sama; blackout mempertahankan lukisan.
- [ ] QA kamera HP fisik dan proyektor fisik dibedakan dari simulasi browser.

## 12. Benchmark yang harus direkam

Rekam fixture deterministik: `straight-walk`, `avoidance-S`, `hesitation-stop`, `sharp-turn`, `pivot`, `two-actor-crossing`, `occlusion-return`, `mp4-seek-loop`, `phone-disconnect`, `long-soak`.

Untuk masing-masing fixture simpan:
- Screenshot **V3.4 vs V3.5** pada frame yang sama dan 2 viewport (Stage Monitor 1600×900 dan thumbnail 320 px).
- Count stroke per aktor, kontinuitas, rejected jumps, jumlah cipratan, deposit/commit, dan waktu frame P95.
- Path overlay debug (hanya bukti QA), PNG final (tanpa HUD), dan hasil scorecard artistik.

**Kondisi gagal otomatis:** pixel yang tampak seperti kotak terpisah pada join; path tersambung melewati teleport; pigment blackout menghapus lukisan; double-bake pada seek; RAM bertumbuh terus tanpa batas; default menjadi massa hitam-merah setelah 20 detik berjalan normal.

## 13. Prioritas implementasi

### P0 — Jalur harus terbaca

1. `PathObservationRouter` + `ActorPathTracker` dengan **1 path per aktor** default.
2. Segment continuity, clean cut dan anti-jump.
3. Spline path, tangent, stabilisasi knot.
4. Ribbon mesh kontinu, alpha seam-safe, taper kepala/ekor.
5. Bobot default 26 px, preset `Path Sumi` dan legacy fallback.
6. `PersistentPathStore` dengan committed ink + active tail; footprint fade tetap 6 detik.
7. Source parity, visual regression, unit QA, fullscreen.

### P1 — Kualitas tinta

8. Tangent-aligned dry fibers dan edge bleed.
9. Splatter kecil berbasis pemicu pivot/impact valid.
10. Opacity/overlap tonal yang tidak merusak koneksi path.
11. Kontrol preset sederhana, ekspor still, perbandingan V3.4/V3.5.

### P2 — Pendalaman artistik

12. Perilaku wet/dry mengikuti durasi stroke.
13. Variasi brush nib dan foot-path optional.
14. Analisis komposisi akhir dan tool review panggung 30 menit.

## 14. Non-goals / larangan

- Jangan kembali memperbesar kuas dari 26 → 56 px sebagai solusi tunggal.
- Jangan membuat stroke satu polygon per event dengan tepi kotak yang saling menimpa.
- Jangan mengubah semua footstep menjadi splatter atau blob.
- Jangan mensintesis huruf hiragana atau bentuk yang tidak berhubungan dengan pergerakan.
- Jangan menghubungkan lintasan melintasi teleport, seek, actor swap, blackout atau source loss.
- Jangan menggunakan fallback V3.4 sebagai default baru bila gagal tampil, tanpa memberi peringatan operator.
- Jangan mengubah kalibrasi Map atau output proyektor demi menyesuaikan zoom pratinjau.
- Jangan menyatakan kontak/tekanan fisik akurat dari video 2D biasa.
- Jangan melakukan deployment Vercel dalam lingkup PRD ini.

## 15. Definition of Done

V3.5 dapat disebut selesai ketika operator membuka Garis BETA, menekan **Coba Demo** atau memakai MP4 dua aktor, lalu melihat **dua jalan tinta yang bertambah secara kontinu**, dengan kepala–ekor kuas terbaca, ruang kosong tetap ada, footprint menghilang, dan tinta permanen. Hasil tersebut harus lolos screenshot perbandingan dan QA source parity, termasuk saat berbelok, berpapasan, berhenti, dan kehilangan tracking.

**Catatan status:** Dokumen ini menetapkan target dan acceptance criteria. Belum ada kode V3.5, commit, atau deployment baru sebagai bagian dari penyusunan PRD ini.