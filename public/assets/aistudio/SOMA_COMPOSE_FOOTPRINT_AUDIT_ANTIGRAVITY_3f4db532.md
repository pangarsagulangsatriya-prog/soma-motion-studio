# SOMA — COMPOSE FOOTPRINT AUDIT & RECOVERY
## Prompt untuk Antigravity · 20 November 2026

**Scope ketat:** hanya tab **Compose**, terutama footprint yang harus mengikuti kaki hasil deteksi secara akurat. Periksa integrasi Track → Compose dan batas output ke Map/Perform sebatas memastikan kontrak data; jangan redesain tab lain atau memodifikasi otorisasi proyektor.

**Repository:** https://github.com/pangarsagulangsatriya-prog/soma-motion-studio  
**Aplikasi:** https://pangarsagulangsatriya-prog.github.io/soma-motion-studio/  
**Benchmark:** https://www.lumoplay.com/  
**Tujuan:** Compose bersih, intuitif, artistik, dan menggunakan **satu sumber event kaki yang dapat ditelusuri**. Footprint harus mengikuti telapak kaki yang terdeteksi; tidak boleh muncul sebagai posisi/arah rekaan atau animasi acak dengan label live.

## 0 — Aturan kerja
1. **Inspect dahulu, ukur, lalu rencanakan dan implementasikan perbaikan terkecil yang berdampak.** Jangan mengaku akurat dari screenshot atau unit test saja.
2. Jalankan aplikasi lokal; periksa desktop dan mobile, state kamera hidup/mati, video, simulasi, offline, error, dua performer. Rekam screenshot sebelum/sesudah.
3. Pertahankan arsitektur Track | Compose | Map | Perform. Satu tracker, satu sumber kamera, satu kontrak event; jangan buka kamera atau inferensi kedua dari Compose.
4. Bedakan **LIVE DETECTED**, **VIDEO ESTIMATE**, **SIMULATION**. Preview sintetik tetap berlabel *Demo* dan tidak diperlakukan sebagai data ukur atau izin output proyektor.
5. Jangan mengimpor aplikasi utuh, menyalin kode tanpa pemeriksaan lisensi, menambah dependency tanpa bukti kebutuhan, atau menghapus modul yang masih dipakai. Fitur legacy yang mau ditinggalkan harus diaudit referensinya dulu.
6. Jangan mengubah Track/Map/Perform secara luas. Jika menemukan bug interface lintas tab, catat sebagai dependency dan perbaiki hanya adapter aman yang dibutuhkan Compose.
7. Audit legal/security, izin library, build, dan runtime sebelum memilih repo GitHub apa pun. Utamakan memanfaatkan yang sudah ada.

## 1 — Temuan awal dari pembacaan kode main (VERIFIKASI ULANG)
- `src/studio/v3/SurfaceComposer.tsx` cukup besar (~54 KB), memiliki preview canvas, kontrol material, dan output internal: audit duplikasi state, mode, serta urutan gambar.
- `src/studio/v3/FootprintsStageWorkspace.tsx` (~79 KB): audit kepemilikan state antara workspace, kamera, eksperimen, dan Compose.
- `src/footprints/scenes/authenticFootGeometry.ts`: geometri kiri/kanan + lima jari; panjang nominal **0,26 m**, lebar **0,095 m**. Ini **template artistik**, bukan pengukuran telapak individu.
- `src/studio/v3/MappingStudioFootprintControls.tsx`: `size` masih **px**; cek konsistensi dengan kalibrasi FLOOR, aspect ratio, dan ukuran fisik.
- `SurfaceComposer.tsx` pada salah satu jalur pratinjau memakai `ellipse(...)` untuk mark. Lacak kapan dipanggil; pastikan bukan pengganti diam-diam untuk geometri telapak yang akurat.
- `src/studio/v3/composerLiquidAdapter.ts`: beberapa `headingRad` diisi nilai demonstrasi/fallback visual (mis. pivot). Nilai tersebut **jangan disajikan sebagai arah anatomis**.
- `src/footprints/gait-analysis/index.ts`: inferensi fase stance/swing dan heel/toe dari MediaPipe; **bukan sensor tekanan tanah**. Cek transformasi koordinat dan false contact.
- `src/footprints/materials/PixiLiquidImprintCompositor.ts` memakai PixiJS untuk Liquid Imprint. `package.json` sudah memuat `@mediapipe/tasks-vision`, `hydra-synth`, `pixi.js`. Hindari renderer/instance rangkap.
- `scripts/cpux-compose-browser-qa.mjs`: uji browser Compose tersedia; komentar secara eksplisit menyebut **tidak menguji kamera/proyektor**. Jangan menyamakan tes pixel preview dengan uji output fisik.
- `docs/FOOTPRINTS-S5-5-PHYSICAL-VALIDATION.md`: instrumen pengukuran fisik tersedia dalam dokumentasi, tetapi hardware measurements tercatat pending. Cari status implementasi saat ini.

**Temuan awal berasal dari pembacaan file, belum pengujian aplikasi live.** Validasi ulang terhadap commit terbaru sebelum membuat keputusan.

## 2 — Benchmark tepat sasaran
Pelajari secara langsung halaman/dokumentasi resmi **LUMOplay** terkait Footprints, depth camera, kalibrasi, gesture/trigger, area lantai dan instalasi. Ambil prinsip interaksi yang relevan: respons langsung, setup singkat, dan status sumber yang jelas. Jangan mengklaim LUMOplay memakai algoritma yang tidak terdokumentasi.

Repo pembanding yang perlu diperiksa kegunaan, maintenance, dan lisensinya:
- https://github.com/google-ai-edge/mediapipe-samples — landmark kaki / Pose.
- https://github.com/tensorflow/tfjs-models/tree/master/pose-detection — MoveNet sebagai *benchmark alternatif*, bukan otomatis mengganti tracker.
- https://github.com/Eric-Canas/Homography.js — referensi camera-to-floor transform; cek apakah utilitas SOMA sudah memadai.
- https://github.com/hydra-synth/hydra-synth — sudah terpasang; hanya untuk tekstur/efek, bukan inferensi kontak.
- https://github.com/pixijs/pixijs — renderer yang sudah dipakai; periksa lifecycle, sumber canvas, dan GPU cost.

Tulis matriks: kemampuan, manfaat, lisensi, kesiapan browser, risiko, **ADOPT / ADAPT / REFERENCE / REJECT**, dan alasan. **Jangan import repo hanya karena populer.**

## 3 — Audit akurasi footprint: pipeline nyata
Trace satu langkah dari input ke pixel canvas:
`Camera/Video → MotionFrame → A/B identity → heel/toe/ankle landmarks → ground-contact estimate → calibrated floor X/Y → heading/scale → FootMotionEvent → imprint geometry → material/effects → Compose monitor`.

Verifikasi per tahap:
- **Provenance**: frame id, source, performer A/B, left/right, timestamp, confidence, confidence kontak, status verified/estimated/simulated.
- **Posisi**: pusat telapak berdasarkan tumit–ujung, bukan ankle saja; cek mirror kamera, orientasi sumbu, crop/letterbox, rotasi, aspect ratio, perspective, dan homografi.
- **Arah**: heel → toe; jangan gunakan gerak pinggul atau nilai animasi sebagai arah telapak. Bila landmark tidak layak, tahan orientasi terakhir yang valid dalam batas waktu singkat atau sembunyikan jejak—tandai uncertain.
- **Skala**: bedakan ukuran artistik default dengan ukuran fisik setelah kalibrasi. Ukuran 0,26 × 0,095 m hanya default yang bisa disetel, bukan hasil ukur kaki performer.
- **Kontak**: tepat satu contact stamp per pendaratan; diam = tidak menambah jejak; pivot dan slide memiliki state sendiri; swing tidak mencetak contact. Jika contact ambigu, jangan menggambar stamp terverifikasi palsu.
- **Identitas**: A/B konsisten saat berpapasan, occlusion, keluar/masuk frame; jangan mengalihkan jejak orang A ke B. Kedua kaki tetap dibedakan.
- **Visual**: render telapak kiri/kanan yang benar, lima jari, arch, contact/slide/pivot/release; efek cair tetap mengikuti mask telapak. Jangan gunakan ellipse sederhana sebagai visual final saat mode Footprints.
- **Sinkron**: no extra input pipeline, no duplicate renderer, no stale frame, no zombie loop; cek jitter, FPS, paint timing, late event, recovery.
- **Transfer**: yang terlihat di Compose harus berasal dari kontrak artwork yang dapat dipakai Map/Perform, tetapi jangan bypass safety gate proyektor.

## 4 — Uji acceptance: rekaman dan panggung
Buat 12 skenario berulang untuk 1 dan 2 performer:
1. Kaki diam 10 detik → **0 stamp tambahan** setelah kontak awal.
2. Berjalan maju 6 langkah → 6 landing valid, kaki kiri/kanan sesuai.
3. Berjalan mundur → heading telapak tidak tertukar dengan heading badan.
4. Langkah lateral → posisi jatuh di lokasi sebenarnya.
5. Belok 90°/180° → arah heel-to-toe sesuai.
6. Pivot pada tumpuan → **tidak ada stamp baru**.
7. Slide/drag → material memanjang dengan tetap menjaga provenance, tidak ada kontak palsu.
8. Stop–start cepat → tidak menggandakan event.
9. Dua performer crossing → identity switch dihitung, jejak tidak berpindah identitas.
10. Kaki terhalang 0,5–2 detik → grace/fallback jelas, tidak mengarang jejak.
11. Kamera putus/reconnect / ganti resolusi → kalibrasi invalid yang relevan, output aman.
12. Mode Demo → Live → Video → Demo → tidak ada event lama bocor antar sumber.

Tambahkan test geometris synthetic ground truth: titik pusat, panjang/lebar, heading, L/R, scale, foot contact. Hitung precision/recall contact, false stamps, duplicate stamps, mean/P95 spatial error **dalam cm hanya bila ada ground truth fisik**, heading median/P95, identity swaps, end-to-end latency measured via high-speed footage ketika tersedia, dropped frames. **Jangan memalsukan hasil atau ambang yang terukur.** Usulkan target awal untuk latihan: median spatial <= 5 cm, P95 <= 10 cm pada area yang dikalibrasi; 0 duplicate saat diam/pivot; identitas tidak tertukar pada skenario crossing referensi; target tunduk pada data hardware dan ruang.

## 5 — Audit UI/UX Compose, ringkas dan konsisten
Satu stage monitor sebagai pusat. Layout default:
- **Header ringkas:** `Compose · Source status · Preview status · Blackout`.
- **Kiri:** Scene / Layers / Media, secondary collapse.
- **Tengah:** satu monitor utama dengan switch `FLOOR | BODY A | BODY B | CAMERA` (split hanya jika benar-benar dibutuhkan).
- **Kanan:** inspector sesuai objek terpilih. Untuk Footprints, cukup `Shape · Size · Lifetime · Color · Response`; parameter lanjutan dibuka seperlunya.
- **Bawah (opsional):** timeline dengan label singkat; tertutup default.

Periksa semua tombol yang tampak, perubahan state aktual, disable saat tak siap, keyboard, tooltip, popover, modal, responsive 1440px dan mobile, loading/error/recovery, kontrol duplikat, panel teks panjang. Pisahkan aksi `Test Contact` dari `Live Contact`. Hapus jargon internal seperti `MAT-03`, `CP-UX`, `GPU-02` dari UI operator (boleh tetap dalam log/debug).

Gunakan aturan: satu aksi → satu kontrol utama; status hanya di satu tempat; detail tersembunyi sampai dibutuhkan. Jangan hapus warning keselamatan atau kondisi validasi. Berikan screenshot before/after dan tabel `KEEP / MERGE / MOVE / REMOVE` disertai alasan.

## 6 — Urutan eksekusi
**Phase A — Inspect:** cek commit, file, diagram event ownership, dependency; jalankan build/tests; reproduksi masalah nyata di Compose. Catat evidence berupa path:line, screenshot, log, measurement.

**Phase B — Audit:** keluarkan `COMPOSE_AUDIT_FINDINGS.md` (P0/P1/P2; proven/suspected/unverified) dan `COMPOSE_BENCHMARK.md`; pilih perbaikan yang paling berpengaruh terhadap presisi dan UX.

**Phase C — Implement:** perbaiki P0 lebih dulu: event origin, left/right, heading real, calibration coordinates, suppression false/duplicate stamps, true-foot renderer, demo/live separation. Berikutnya sederhanakan UI sesuai audit. Modul lain tidak direstrukturisasi.

**Phase D — Verify:** jalankan build, unit/integration tests, Playwright, rekaman video pengujian, layout desktop/mobile; jangan mengklaim uji hardware jika belum dijalankan. Pastikan perubahan tidak merusak Track/Map/Perform, blackout, atau safety.

**Phase E — Report:** hasil akhir singkat dalam `COMPOSE_RECOVERY_REPORT.md`:
- status `READY / CONDITIONAL / NOT READY` beserta kriteria;
- daftar perubahan & tautan commit/PR;
- hasil uji 12 skenario dengan PASS/FAIL/BLOCKED, data ukur dan bukti;
- masalah tersisa dan urutan implementasi;
- checklist uji proyektor fisik yang masih diperlukan.

## 7 — Definition of Done
- Tiap **live** footprint dapat ditelusuri ke landmark dan event yang valid.
- Bentuk telapak serta kiri/kanan dan arah heel-to-toe tepat pada dataset uji.
- Tidak ada jejak tambahan saat diam/pivot; tidak ada visual demo menyamar sebagai live.
- Satu monitor utama, inspector kontekstual, jargon internal tersembunyi, UI tidak berulang.
- Build & automated tests lulus, bukti screenshot tersedia, metrik uji dilaporkan dengan jujur.
- Koneksi Compose → Map/Perform tetap aman; hardware claim hanya ketika diuji fisik.

**Mulai dengan audit kode aktual. Jangan langsung redesign atau mengganti engine. Setelah bukti terkumpul, lakukan perbaikan bertahap dan verifikasi setiap perubahan.**
