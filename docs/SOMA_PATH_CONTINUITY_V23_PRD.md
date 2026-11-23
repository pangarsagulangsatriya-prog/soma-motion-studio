# SOMA — Path Continuity Engine V2.3
## A. Product Requirements Document (PRD)

**Tanggal:** 23 November 2026  
**Status:** Draft implementasi; dokumen ini tidak mengubah engine  
**Target:** Compose (Path Sumi + Dual Trace) → Map → Perform  
**Pasangan:** [B. Technical Architecture](SOMA_PATH_CONTINUITY_V23_TECHNICAL_ARCHITECTURE.md) · [C. Issue Register](SOMA_PATH_CONTINUITY_V23_ISSUES.md)

## 1. Masalah yang diamati

Screenshot terbaru memperlihatkan **760 segmen deposit**, **2 aktor**, dan **3 dari 4 kaki terdeteksi**. Garis sudah tebal tetapi terpisah menjadi beberapa potongan. Perjalanan aktor belum terbaca sebagai dua sapuan kontinu.

Audit kode branch main:
- ActorPathTracker menerbitkan CUT pada source/epoch berubah, clock reversal, teleport, gap, dan uncertain-gap. PersistentPathStore memfinalisasi stroke tersebut; START berikutnya menghasilkan ujung sapuan baru.
- Estimator V2.2 sudah menahan provisional hip-only maksimal 250 ms/enam frame, tetapi belum ada satu kontrak eksplisit yang mengelola continuity, pemulihan, dan veto bridging dari ujung ke ujung.
- Penghitungan deposit bertambah saat pemanggilan paintSegment, termasuk ketika active tail digambar ulang. **Deposit count tidak setara panjang lintasan atau jumlah stroke unik.**
- Renderer menggunakan spline/ribbon per segmen. Perpindahan committed ink ke active tail dan penyambungan setelah recovery membutuhkan pengujian piksel, bukan semata tes unit.
- Footprints dan Upper memakai atlas masing-masing. Bobot garis sudah dipengaruhi kepala/bahu, tetapi geometri dan continuity tetap harus dikendalikan oleh perjalanan kaki/aktor.

## 2. Janji keluaran

Dua aktor menulis lintasan merah dan arang yang memanjang sesuai perpindahan tubuh. Ketika tapak valid terdeteksi, cap menimpa tinta di tempat kaki itu berada, lalu memudar. Kepala/bahu mengubah karakter sapuan utama; tetap terikat pada aktor yang sama. Tinta jalur bertahan hingga operator memilih Clear.

**Sambung hanya gerak yang dapat dibuktikan masuk akal.** Crossing yang ambigu, source berganti, atau teleport harus diputus dengan aman meskipun garis akan terlihat terhenti.

## 3. Tujuan V2.3

1. Gerak lateral, diagonal, maju/mundur dan belokan menjadi stroke panjang yang mengikuti perjalanan aktor.
2. Hilangnya telapak 1–3 frame tidak langsung memecahkan stroke apabila identitas, hip, arah dan recovery konsisten.
3. Prediksi jalur tetap provisional; **tidak ada committed ink** sampai validasi pemulihan.
4. Tidak ada bridge melintasi identity swap, source/epoch/calibration switch, seek, teleport atau gap tak tervalidasi.
5. Pengecatan ribbon menjaga seam, tangent, grain dan taper konsisten dari awal hingga akhir satu stroke.
6. Footprints tetap independen, memudar (default 6 s) dan dapat menimpa garis.
7. Operator melihat status kontinuitas A/B dan panjang lintasan yang benar.
8. MP4 asli dua aktor 15,04 detik dipakai sebagai golden test bersama fixtures sintetis.
9. Compose, fullscreen bersih, PNG, Map pre-warp dan Perform menerima satu raster.
10. Mode lama V2.2 tetap bisa dipilih untuk rollback.

## 4. Di luar cakupan

Model pose baru, detektor kedua, rekonstruksi 3D monocular, deteksi tekanan kaki fisik, garis dekoratif yang tidak didukung gerak, pemindaian cap berwarna yang sudah ada pada video, perombakan menu Track/Map, atau deployment Vercel otomatis.

## 5. Perilaku kontinuitas

| Keadaan | Masukan | Hasil |
|---|---|---|
| OBSERVED | Dua kaki valid atau satu kaki + hip/identity stabil | ADD/TURN valid diterima; garis tumbuh |
| SOFT_GAP | Kaki hilang singkat, hip/identity memadai | Buffer prediksi; jangan permanenkan |
| RECOVERING | Kaki pulih dan kesesuaian waktu/posisi/arah lolos | Commit kandidat tepat sekali, lanjut strokeId yang sama |
| HARD_CUT | Identity ambigu, teleport, kalibrasi/source berubah, gap berlebihan | Buang kandidat, CUT dengan reason code, mulai stroke baru hanya setelah bukti baru |

**STOP tidak otomatis CUT.** Saat aktor diam, tinta tidak bertambah. Ketika bergerak lagi dengan identitas dan posisi konsisten, stroke yang sama boleh berlanjut.

### Bridge acceptance gate

Semua syarat harus terpenuhi: actorId dan identity track stabil; sourceKey, clipStableId, epoch, calibration version cocok; frame time monoton; gap singkat (awal hip-only maksimum 250 ms/enam frame); displacement masuk batas kecepatan/skala tubuh; arah/tangent masih masuk akal; recovery memakai observasi kaki yang sah; tidak ada crossing ambigu. Gagal satu syarat → discard + HARD_CUT. Prediksi tidak boleh menjadi penghubung hiasan.

## 6. UX operator

Compose tetap satu kanvas putih. Default Tapak depan; warna A merah dan B arang; warna Path, Footprint, Gesture dapat dikustomisasi.

Panel kanan ringkas:
- **Jalur:** A/B Teramati, Gap singkat, Pulih, atau Terputus.
- **Lapisan:** Garis/Tapak/Gesture; tampilan Gabung dan Pisah Debug.
- **Tinta:** Sumi, Kering, Pigmen; bobot dan serat.
- **Diagnostik** (collapsed): accepted/missing frame, committed path length per actor, longest continuous stroke, bridge accepted/rejected, CUT by reason, gap durations, current motion basis.

Tanda provisional hanya terlihat di studio debug, tidak masuk raster panggung. Status pose saat ini dan lukisan historis dipisah. Label deposit tidak dipakai sebagai ukuran keberhasilan.

## 7. Acceptance criteria (wajib dibuktikan)

**AC-01 — Real MP4:** benchmark dua aktor 15,04 detik menunjukkan garis yang memanjang selama gerak dan tetap stabil ketika berhenti. Bandingkan sumber dan output pada detik 0,1,2,3,4,5,6,7,8,10,14.

**AC-02 — Soft gap:** gap pendek dengan hip dan identity stabil bisa pulih tanpa membuat taper baru di tengah stroke; sebelum pemulihan, committed ink tidak berubah.

**AC-03 — Hard cut:** identitas, epoch, source/kalibrasi, seek, teleport, crossing ambigu dan recovery jauh tidak menghasilkan bridge; reason code tercatat.

**AC-04 — STOP:** tidak ada deposisi terus-menerus pada frame berulang atau aktor berhenti. STOP tidak memaksa START baru saat aktor melangkah kembali dengan bukti yang konsisten.

**AC-05 — Ribbon seam:** pixel mask yang diuji di centerline tidak memperlihatkan piksel putih di join committed/active atau join antar-spans yang sah.

**AC-06 — Stroke taper:** hanya ada taper pada awal/akhir stroke logis; bukan taper baru di setiap subsegmen/bridge valid.

**AC-07 — Metrik jujur:** panjang jalur, stroke terpanjang, CUT dan bridge diukur dari trajectory/event, tidak dari jumlah draw call.

**AC-08 — Footprints:** cap menimpa garis saat geometri beririsan, fade default enam detik, garis menetap; tidak ada cap dari hip-only.

**AC-09 — Dua aktor:** tidak ada perubahan identitas A/B atau jembatan antara A dan B saat crossing.

**AC-10 — Playback:** pause, replay, seek, loop, source switch, refresh dan reconnect tidak menggandakan deposit atau menyambung lintasan lama.

**AC-11 — Output:** Compose, fullscreen, PNG dan Map pre-warp konsisten; Blackout dan gate proyektor aman.

**AC-12 — Soak:** 30 menit uji dua aktor, log FPS dan memori, tidak ada pertumbuhan buffer tak terbatas. Target awal ≥24 fps komposit pada MP4 acuan (perlu pengukuran).

**AC-13 — Regression:** Path Sumi, Dual Trace, fallback V2.2, webcam/HP/MP4/simulator tidak regress.

## 8. Negative cases P0

- Dua aktor terlihat tetapi dua atau tiga kaki saja yang valid.
- Satu kaki hilang 100 ms; pulih dekat prediksi.
- Dua kaki hilang 200 ms; hip tetap valid.
- Dua kaki pulih jauh dari prediksi.
- Crossing dan occlusion pada saat gap.
- Kamera bergeser atau kalibrasi berubah ketika ada kandidat bridge.
- MP4 seek mundur pada kandidat bridge yang belum diputuskan.
- STOP lama lalu berjalan lagi; jangan tambah cap/garis saat diam.
- Out-of-bounds, speed spike, dan teleport.
- Join committed-to-active ribon dan tail taper pada pemotongan.
- Cap menimpa path dan alpha/fade tidak menghapus path.
- Blackout atau Map preview putus tidak menulis tinta baru.
- Fullscreen studio tidak membawa diagnostic overlay ke keluaran fisik.

## 9. Prioritas

**P0:** baseline MP4, state machine kontinuitas, kandidat bridge, hard cut gate, STOP/CUT event lifecycle, joined ribbon, pixel/E2E QA.

**P1:** painterly flow, cap-path alignment, inspector, replay/save/load, 30-min soak.

**P2:** preset confidence-aware, stress lintas device, visual motion-inspection tooling.

Detail dan urutan kerja di [C. GitHub Issue Register](SOMA_PATH_CONTINUITY_V23_ISSUES.md).

## 10. Definition of Done

- Seluruh P0 lulus dengan bukti per-frame MP4 asli dan negative cases.
- Tidak ada P1 yang berpotensi menghentikan pertunjukan.
- Laporan mencatat path plot XY A/B, bridge acceptance/rejection, alasan CUT, video sumber dan screenshot output.
- Browser E2E + pixel comparisons menjadi gerbang rilis, di samping TypeScript/unit/build.
- Proyektor fisik dan Blackout diuji tersendiri oleh operator.
- Fallback V2.2 terbukti bekerja; perubahan V2.3 tidak otomatis dipromosikan ke Vercel.

**Status:** PRD siap dikerjakan. Belum menyatakan kualitas pada MP4 asli sudah lulus.
