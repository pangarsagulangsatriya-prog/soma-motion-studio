# SOMA — Path Continuity V2.3
## C. GitHub Issues P0–P2 — Implementation Register

**Tanggal:** 23 November 2026  
**Status:** 15 issue implementasi + 1 epic sudah dibuat. Semua issue baru masih backlog; tidak menandakan kode V2.3 sudah selesai.  
**Epic:** [#240 — Path Continuity V2.3](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/240)  
**Produk:** [A. PRD](SOMA_PATH_CONTINUITY_V23_PRD.md) · [B. Technical Architecture](SOMA_PATH_CONTINUITY_V23_TECHNICAL_ARCHITECTURE.md)

## 1. Indeks lengkap

| Issue | Prioritas | Hasil yang harus dibuat | Dependensi ID |
|---|---|---|---|
| [PC23-01](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/241) | P0 | Baseline MP4, plot XY dan metrik jalur jujur | — |
| [PC23-02](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/242) | P0 | Satu pemilik state OBSERVED/SOFT_GAP/RECOVERING/HARD_CUT | 01 |
| [PC23-03](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/243) | P0 | Validasi bridge waktu, posisi, arah dan identitas | 02 |
| [PC23-04](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/244) | P0 | Tracker accepted batch, STOP/resume, CUT dan replay idempotent | 02,03 |
| [PC23-05](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/245) | P0 | Joined ribbon, seam piksel, taper dan counter tinta | 04 |
| [PC23-06](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/246) | P0 | Footprint overprint, Upper modulation, satu raster output | 04,05 |
| [PC23-07](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/247) | P0 | Real-MP4 golden/browser QA dan release safety gate | 01–06 |
| [PC23-08](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/248) | P1 | Motion-driven Sumi, bobot dan tekstur terkontrol | 05,06 |
| [PC23-09](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/249) | P1 | Cap-foot corridor dan pengukuran kedekatan ke Path | 06,07 |
| [PC23-10](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/250) | P1 | Diagnostik operator dan status per aktor | 01,03,04 |
| [PC23-11](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/251) | P1 | Replay/seek/save-load dan kompatibilitas rollback | 04,05 |
| [PC23-12](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/252) | P1 | 30 menit soak, memory, FPS dan recovery | 05,07 |
| [PC23-13](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/253) | P2 | Preset artistik berbasis confidence | 08,10 |
| [PC23-14](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/254) | P2 | Stress lintas kamera/HP/MP4/simulator | 07,12 |
| [PC23-15](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/255) | P2 | Motion truth inspector XY, candidate overlay, export QA | 01,07,10 |

**Total:** 7 P0 + 5 P1 + 3 P2 = **15 issue**. Nomor issue berasal dari GitHub repo utama; judul diawali ID unik PC23 agar mudah dicari.

## 2. Urutan pengerjaan yang direkomendasikan

### P0 — jalur harus benar sebelum seni dipoles
1. **PC23-01** baseline nyata MP4 15,04 detik, log observasi, plot XY, frame/screenshot 0–14 detik. Catat current CUT count dan longest stroke.
2. **PC23-02** pindahkan provisional ownership ke satu coordinator per actor. OBSERVED → SOFT_GAP → RECOVERING → HARD_CUT. Jangan buffer di dua modul sekaligus.
3. **PC23-03** safe bridge validator: actor/identity, source, timestamp, transform, velocity/tangent, recovery foot dan gap duration. Reject jika ada syarat gagal.
4. **PC23-04** perbaiki handshake PathTracker, STOP vs CUT, strokeId stabil, dedup, no double commit.
5. **PC23-05** benahi persistent ribbon, seam committed/active, taper logical stroke, dan statistik deposit jujur.
6. **PC23-06** pastikan Footprints menimpa garis, upper mengubah sapuan yang sama, dan Map/Perform menerima raster gabungan.
7. **PC23-07** jalankan benchmark MP4 asli dan safety tests; P0 tidak lulus bila hanya unit/build hijau.

P0-03 harus selesai sebelum P0-04 mengaktifkan auto-bridge. P0-05 dibangun setelah kontrak STOP/CUT jelas. P0-06 bisa dimulai paralel untuk pemeriksaan Map/Perform, tetapi tidak dianggap lulus sebelum renderer final stabil.

### P1 — setelah P0 mempunyai baseline visual
- PC23-08 painterly dynamics, diukur tanpa mengubah path coordinates.
- PC23-09 footprint-to-path corridor measurement.
- PC23-10 status operator supaya line break bisa dilacak.
- PC23-11 replay/seek/save/load dan format session versi V2.3.
- PC23-12 soak 30 menit dan hardware profiling.

### P2 — penyempurnaan dan ekspansi
- PC23-13 preset Sumi/Dry/Dense.
- PC23-14 sumber kamera dan device ekstrem.
- PC23-15 motion truth inspection/plot dan export QA.

## 3. Negative case gate utama

| Skenario | Issue primer | Bukti yang wajib tersedia |
|---|---|---|
| A berjalan saat satu kaki hilang | 02,03,04 | Stroke tetap satu ketika recovery valid |
| Dua kaki hilang <250 ms | 02,03 | Candidate provisional dan ACCEPT sekali |
| Gap lebih panjang / hip hilang | 03,04 | Reject/CUT tanpa bridge |
| Aktor A/B crossing | 03,07 | Identitas dan tinta tidak tertukar |
| Recovered foot teleport | 03,07 | Rejected bridge, reason tercatat |
| Aktor diam lalu berjalan lagi | 04,05 | STOP tidak membuat tinta menumpuk, lanjut jika sah |
| 760 deposit tapi garis putus | 01,05,10 | Path length dan seam QA menggantikan ukuran deposit |
| Potongan ribbon memperlihatkan putih | 05,07 | Pixel centerline test |
| Cap menimpa Path namun fade | 06,09 | Raster diff path vs footprint |
| Kepala/bahu mengubah sapuan | 06,08 | A/B modulation bounded dan tidak membuat garis fiktif |
| MP4 seek/loop/source switch | 04,07,11 | Tidak ada history ganda atau bridge lintas epoch |
| Compose berfungsi, Map hitam | 06,07 | One clean raster / pre-warp equality |
| Blackout/recovery | 06,07,12 | Output fisik aman |
| HP cable/Wi-Fi disconnect | 14 | Epoch baru, no teleport / stale draw |

## 4. Evidence contract untuk menutup issue

Setiap P0 harus menyertakan:
- Commit/PR kode yang mengubah behavior, bukan hanya dokumen.
- Unit tests sesuai kontrak, plus minimal satu browser/pixel test.
- Sebelum dan sesudah pada video sumber yang sama, dengan output pada timestamp yang dicatat.
- Plot XY per aktor, event START/ADD/TURN/STOP/CUT, accepted/rejected bridge dan alasan reject.
- Konfirmasi bahwa keluaran Map/Perform tidak terpengaruh oleh diagnostic overlay.
- Jika memerlukan hardware, catatan perangkat, FPS, frame drops, dan status Blackout.
- Pernyataan apa yang belum dapat diverifikasi. Jangan menutup sebagai completed ketika bukti MP4 nyata masih kosong.

## 5. Release gates

**Gate 0:** baseline real MP4 dan *negative case ledger* dibuat.  
**Gate 1:** candidate/recovery tidak menghasilkan unsafe bridge; STOP/CUT terdefinisi dan teruji.  
**Gate 2:** joined ribbon tidak pecah serta cap/gesture tetap menyatu pada satu raster.  
**Gate 3:** browser E2E, pixel QA dan real-MP4 review lulus; physical 30-minute test dicatat.  
**Gate 4:** rollback V2.2 tersedia; rilis ke GitHub Pages setelah QA. Vercel tetap tidak disentuh tanpa arahan.

## 6. Hubungan dengan issue lama

- [#196 — PathTracker continuity gate](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/196): modul pendahulu untuk event lifecycle. PC23-04 memperluasnya dengan candidate handshake dan idempotency.
- [#198 — Sumi ribbon mesh](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/198): modul pendahulu geometri; PC23-05 fokus seam committed/active dan taper setelah recovery.
- [#202 — Visual benchmark](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/202): PC23-01/07 mewajibkan bukti real MP4 dan metrik per actor.
- [#222 — Browser/real-MP4 QA](https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/issues/222): PC23-07 melengkapi gate smoke dengan golden-path/per-frame QA.

Issue baru tidak otomatis menutup issue terdahulu. Pertahankan histori dan tandai superseded hanya sesudah fungsi serta bukti baru cocok.

## 7. Checklist epic

- [ ] P0-01 Baseline
- [ ] P0-02 Single-owner continuity
- [ ] P0-03 Bridge validator
- [ ] P0-04 Tracker lifecycle
- [ ] P0-05 Joined ribbon / counters
- [ ] P0-06 Compositor
- [ ] P0-07 Real-MP4 QA gate
- [ ] P1-08 s.d. P1-12 setelah P0 valid
- [ ] P2-13 s.d. P2-15 setelah baseline stabil

**Catatan:** dokumen, issue dan epic sudah dibuat. Tidak ada klaim V2.3 sudah diimplementasikan atau diuji pada MP4 nyata dalam tahap dokumentasi ini.
