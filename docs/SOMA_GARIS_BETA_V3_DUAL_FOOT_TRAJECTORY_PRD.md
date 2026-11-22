# SOMA — Garis BETA V3: Dual-Foot Trajectory
**Product Requirements Document (PRD)**

- Status: PROPOSED — spesifikasi, belum diimplementasikan.
- Tanggal: 23 November 2026.
- Lokasi produk: Stage 1 → Compose → Garis BETA.
- Basis audit: main, commit 3003b9a4865517cec1282222abd64bd8bab72c6f.
- Arsitektur: [SOMA_GARIS_BETA_V3_TECHNICAL_ARCHITECTURE.md](./SOMA_GARIS_BETA_V3_TECHNICAL_ARCHITECTURE.md).
- Referensi versi lama: [SOMA_LINE_TRAILS_V2_IMPLEMENTATION.md](./SOMA_LINE_TRAILS_V2_IMPLEMENTATION.md).
- Tidak ada perubahan kode atau deployment dalam pekerjaan penyusunan dokumen ini.

## 1. Masalah dan bukti dari source code

Preview Garis BETA menampilkan satu garis pendek dan terlalu lembut, sementara status MP4 dapat bertahan pada “Menunggu frame kaki berikutnya”. Tampilan belum menjelaskan kaki bergerak ke arah mana atau kapan gerak berhenti.

Temuan kode pada commit yang diaudit:

1. **Pemilih satu kaki:** LineTrailsBetaStage → ActiveFootSelector.select() → FootLineTrailEngine.ingest() hanya mengirim kaki aktif per performer. Kontrak pengujian V2 memang meminta satu jalur per performer. V3 perlu dua jalur per performer.
2. **Titik pusat kurang stabil:** FootLineSampleAdapter.makePoint() merata-ratakan heel dan toe; ketika telapak berotasi, midpoint dapat berubah walaupun perpindahan pusat pijakan kecil. Saat heel/toe hilang, sistem berpindah ke ankle yang punya sifat geometris lain.
3. **Waktu MP4 perlu kontrak yang tegas:** snapshot analisis mempunyai waktu media, sedangkan draw loop dan fade memakai performance.now(). Pause, seek, loop, dan hasil inference yang terlambat harus memakai logika waktu berbeda.
4. **Garis didesain sebagai efek:** renderer memakai filter One Euro, delay render 55 ms, kurva kuadratik, dan opsi goresan lebar. Jejak tampak membulat atau kabur dan sulit diaudit terhadap titik mentah.
5. **Observabilitas kurang:** status “Menunggu frame kaki berikutnya” belum cukup untuk membedakan pose tidak ada, actor tidak valid, stale inference, confidence rendah, frame duplikat, atau pemotongan gap.
6. **Mode dua performer:** jalur editor V2 memilih A atau B; target V3 harus sanggup memperlihatkan A dan B simultan saat identitasnya valid.

Catatan: screenshot tunggal belum membuktikan penyebab spesifik garis pendek. V3 wajib menunjukkan data mentah, titik hasil filter, timeline, dan alasan suatu frame diterima/ditolak.

## 2. Tujuan

**Janji perilaku:** pergerakan setiap kaki yang teramati menghasilkan lintasan mengikuti posisi kaki itu sendiri. Kaki diam tidak menambah panjang garis. Kaki hilang atau identitas berubah menyebabkan garis terputus. Tidak ada sambungan melompati bagian gerak yang tidak terlihat.

Hasil utama:

- **Lintasan (default):** garis tipis untuk kaki kiri dan kanan. Setiap kaki punya warna, status, dan riwayat mandiri. Mode 2P menghasilkan sampai empat jalur A-Kiri, A-Kanan, B-Kiri, B-Kanan.
- **Pijakan (sekunder):** bentuk telapak muncul hanya pada event kontak yang memenuhi gate FootMotionEventV2; labelnya membedakan estimasi video, simulasi, atau data lain. Video RGB 2D tidak diklaim mengukur tekanan kaki.
- **Eksperimen gaya (lanjutan):** Tinta, Kontur, Pita, Serat dan brush lama tetap tersedia, membaca riwayat lintasan V3 yang sama dan tidak mengubah geometri sumber.

## 3. Sasaran dan batas

| Domain | Wajib V3 | Tidak termasuk |
| --- | --- | --- |
| Sumber | Kamera Track, HP yang sudah masuk Track, MP4; sumber simulator boleh sebagai fixture demo terpisah | Membangun ulang sistem pairing HP/Camera Hub |
| Identitas | 1P: kiri/kanan. 2P: A/B × kiri/kanan, dengan recovery aman | Menebak identitas di tengah occlusion ambigu |
| Koordinat | Membedakan image-2d, calibrated-estimate, simulated; transform dengan metadata | Menganggap image-space sebagai floor-space fisik |
| Rendering | Titik observasi dan polyline presisi, color per foot, cut saat tracking putus | Glow/blur sebagai default |
| Pengaturan | Warna, tampil/sembunyi, lebar, durasi, hapus, fullscreen | Mengganti workflow Map/Perform |
| Keamanan | Software preview, blackout dan interlock fisik tidak berubah | Mengaktifkan output proyektor dari Garis BETA |

## 4. User flows

### A. Satu performer

1. Operator memilih input di Track lalu Compose → Garis BETA.
2. Kanvas memperlihatkan garis merah kiri dan warna kontras kanan, atau alasan tidak ada observasi.
3. Ketika hanya kiri bergerak, hanya garis kiri memanjang. Saat kanan menyusul, garis kanan tumbuh sendiri.
4. Operator mengatur warna, lebar 2–12 px, durasi, dan Bersihkan tanpa berpindah layar.
5. Tekan Periksa Jalur untuk membandingkan raw point, filtered point, dan status tiap kaki.

### B. Dua performer

1. Track memilih 2P.
2. Kedua aktor bisa tampil bersamaan dengan label A/B dan Kiri/Kanan.
3. Saat perpotongan menyebabkan identitas ambigu, potong segmen yang terpengaruh; lanjut sebagai segmen baru setelah identity recovery.
4. Filter di inspector dapat menyembunyikan A atau B untuk inspeksi tanpa membuang data mentahnya.

### C. MP4

1. Operator memilih MP4, melihat status decode, analisis pose, dan frame terakhir yang valid.
2. Pause mempertahankan gambar tetapi tidak menambah titik.
3. Seek, rewind, loop, perubahan klip, atau pergantian actor/generation memutus segmen sesuai sesi baru.
4. Jika inference lebih lambat dari playback, tampilkan status lag dan menolak frame stale; jangan menyambung lintasan ke posisi perkiraan.

## 5. UI yang disarankan

Tombol Garis BETA tetap di toolbar Compose dan tetap tersedia ketika berpindah FLOOR, LEG A/B, SPLIT, serta SKELETON.

### Panel ringkas

    Garis BETA                     [Periksa jalur]
    Mode              [Lintasan] [Pijakan]
    Sumber            MP4           ● Analisis aktif
    Kiri              [● merah]     [Tampil]
    Kanan             [● hijau]     [Tampil]
    Ketebalan         ━━━●━━━━      3 px
    Durasi            [Tetap] [8 dtk] [20 dtk]
    [Bersihkan]                   [Layar penuh]
    -------------------------------------------------
    Pengaturan lanjutan
    A/B · Gaya V2 · Filter · Brush · Overlay V/K

### Kanvas

- Mode Lintasan memakai dua polyline tipis; tidak ada glow, gradient, blur, atau brush anatomis pada default.
- Penanda titik ujung kecil boleh tampil ketika observasi masih segar.
- Legend menyebut kaki kiri/kanan dan, untuk 2P, aktor A/B.
- Label basis wajib: “Preview posisi 2D” atau “Lantai terkalibrasi”; jangan menyembunyikan jenis koordinat.
- Status kesalahan tidak menutupi kanvas dan menjelaskan penyebab spesifik: menunggu pose, kaki hilang, confidence rendah, actor ambigu, inference tertunda, pause, seek.
- Fullscreen memakai renderer identik dengan preview; keyboard Escape kembali, overlay video/skeleton default OFF.

### Debug “Periksa jalur”

- Toggle titik mentah, titik hasil filter, skeleton, video input, dan batas segmen.
- Data per kaki: source/session/generation, actor, foot, source frame time, wall clock age, confidence, landmark origin, gap, status accepted/rejected dan alasan.
- Mode replay fixture untuk membandingkan output dengan anotasi referensi.
- Export diagnostik lokal JSON/CSV; tidak mengunggah rekaman secara otomatis.

## 6. P0, P1 dan kompatibilitas

### P0 — wajib untuk rilis V3

1. Membangun dual-foot sampler; ActiveFootSelector tidak dipakai pada mode Lintasan.
2. Menambahkan resolver pusat telapak dengan provenance heel, toe, ankle dan pilihan fallback eksplisit.
3. Menambahkan kontrak waktu video/live yang tidak mencampur media time dengan performance clock.
4. Menambahkan quality gate: confidence, missing foot, gap, seek, identitas ambigu, lompatan posisi, dan perbedaan koordinat.
5. Mengganti default renderer menjadi polylines berdasarkan titik terobservasi yang sudah lolos gate; filter ringan opsional.
6. Menyederhanakan UI dan menambah debug raw vs filtered.
7. Menguji 1P/2P, live/MP4, pause/seek/crossing, fullscreen/blackout.
8. Menjaga V2 melalui feature flag selama validasi.

### P1 — setelah P0 stabil

- Mode Pijakan dari event kontak eligible dengan provenance.
- Ekspor lintasan mentah dan gambar preview (metadata timestamp serta basis koordinat wajib).
- Profil filter dan kualitas berdasarkan input dan kondisi panggung.
- Preset gaya visual V2 sebagai lapisan di atas jalur V3.

### Prinsip kompatibilitas

- Data observasi tidak boleh dimodifikasi oleh gaya visual.
- Existing Map/Perform, F3, Camera Hub, TouchDesigner/Resolume tidak diubah.
- Preset V2 dibaca melalui migrasi opsi eksplisit; opsi brush/glow tidak otomatis aktif.
- Deploy ke Vercel tidak disimpulkan sama dengan GitHub Pages; QA mencatat commit SHA kedua lingkungan.

## 7. Acceptance criteria (kontrak tes)

| ID | Skenario | Hasil wajib |
| --- | --- | --- |
| AT-01 | Kiri bergerak, kanan diam | Hanya jalur kiri menerima titik baru |
| AT-02 | Kanan mulai bergerak | Jalur kanan terpisah, tidak tersambung ke kiri |
| AT-03 | Pivot tumit–ujung kaki, perpindahan pusat kecil | Heading berubah, pusat lintasan tetap stabil |
| AT-04 | Belok tajam 90° dan balik arah | Geometri belokan dapat dibandingkan dengan titik mentah, tanpa overshoot |
| AT-05 | Diam + jitter | Tidak menambah lintasan panjang yang tidak sesuai perpindahan |
| AT-06 | Satu kaki hilang | Hanya jalur kaki tersebut berhenti dan terputus |
| AT-07 | Kaki muncul kembali di posisi jauh | Membuka segmen baru, tidak membuat teleport line |
| AT-08 | MP4 pause/resume | Nol titik tambahan saat pause; resume memakai frame baru |
| AT-09 | MP4 seek maju/mundur, loop, klip baru | Segmen baru dan frame sesi lama tidak dipakai |
| AT-10 | MP4 0.5×/1×/2× + inference lag | Clock konsisten; stale inference tidak membentuk garis palsu |
| AT-11 | 2P crossing/occlusion | A/B tidak tertukar; ambigu memotong segmen |
| AT-12 | Preview ↔ fullscreen | Bentuk, warna dan jumlah segmen sama pada viewport setara |
| AT-13 | Kamera ↔ HP ↔ MP4 | Source switch memutus/bersihkan sesuai kebijakan |
| AT-14 | Blackout, Map/Perform, F3 | Gate proyektor tetap tertutup; fitur lain tidak regresi |
| AT-15 | Sesi 30 menit, banyak segmen | Memory dan jumlah titik bounded, tidak freeze |
| AT-16 | Pijakan tanpa event eligible | Tidak mencetak kontak fiktif |

### Target QA yang diusulkan, belum terukur

- Median deviasi simpul terhadap golden coordinate ≤ 6 px; P95 ≤ 16 px pada output 1600×900 untuk fixture sintetis.
- Deviasi titik belok 90° terhadap referensi ≤ 12 px pada fixture yang sama.
- Tambahan sampel saat MP4 pause selama 2 dtk: 0.
- Garis teleport melintasi seek, source switch atau kehilangan identitas: 0.
- Render Compose 2P P95 ≤ 16 ms/frame pada profil desktop yang dicatat; pose inference FPS diukur terpisah dan tidak dianggap 60 FPS.
- Soak test ≥ 30 menit dengan pemakaian memori terpantau.

Angka di atas ialah target awal, **bukan hasil benchmark**. QA wajib menyertakan fixture, metode pengukuran dan data asli; hasil lapangan dapat mengubah target melalui keputusan terdokumentasi.

## 8. Prioritas implementasi

| Sprint teknis | Keluaran | Gerbang lulus |
| --- | --- | --- |
| P0-A | Instrumentasi frame dan fixture raw-vs-filtered | Mampu menjelaskan setiap sample rejected |
| P0-B | Resolver posisi + 2/4 independent tracks | AT-01 s.d. AT-07 |
| P0-C | MP4 clock + epoch/seek + stale-frame gate | AT-08, 09, 10, 13 |
| P0-D | Renderer polyline presisi dan UI ringkas | AT-04, 12, QA visual |
| P0-E | Recovery 2P + regression performa/blackout | AT-11, 14, 15 |
| P1 | Pijakan dan gaya advanced | AT-16 + QA tambahan |

## 9. Definition of Done

- [ ] TypeScript build, npm test, lint jika tersedia, serta browser QA lulus.
- [ ] Golden fixtures 1P/2P dan klip MP4 bersumber jelas; hasil tercatat.
- [ ] Camera, HP, MP4 diuji dengan status gagal yang dapat dibaca operator.
- [ ] Preview/fullscreen parity dan MP4 pause/seek diverifikasi.
- [ ] Tidak ada regresi Camera Hub, F3, Stage 1 Track/Map/Perform atau blackout.
- [ ] Output fisik tetap fail-closed, kecuali melalui gate Map/Perform lama yang sudah lolos QA tersendiri.
- [ ] PR implementasi melampirkan video rekam hasil, before/after, metrik, serta commit SHA.
- [ ] Rollback ke V2 dapat dilakukan selama migrasi.
- [ ] Status dokumen baru berubah menjadi IMPLEMENTED setelah kode dan QA nyata selesai.

## 10. Risiko yang harus dijelaskan kepada operator

- Kamera monocular tidak dapat membuktikan pijakan fisik hanya dari warna dan pose.
- Berputarnya telapak dapat menggeser midpoint heel–toe; perlu smoothing pusat dengan ketidakpastian eksplisit.
- Occlusion, frame di luar batas, dan pose low-confidence menghasilkan *gap*, bukan garis buatan.
- Kamera mirror/crop/aspect-fit harus dipetakan sekali secara konsisten.
- Preview MP4 image-2d tidak otomatis menjadi koordinat lantai untuk proyektor fisik.

**Keputusan produk:** Garis BETA V3 memprioritaskan ketepatan dan keterbacaan perjalanan kaki. Karakter visual artistik V2 tetap dapat dipakai setelah jalur kaki terbukti benar.
