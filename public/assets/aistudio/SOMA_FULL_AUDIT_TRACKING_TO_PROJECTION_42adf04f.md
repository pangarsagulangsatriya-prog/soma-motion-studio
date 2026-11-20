# SOMA — FULL PRODUCT AUDIT
## Tracking → Compose → Map → Perform → Projector

**Tipe pekerjaan:** inspeksi produk, audit fungsi end-to-end, audit UI/UX, benchmark, dan rencana pemulihan.  
**Tahap pertama:** AUDIT ONLY. Jangan mengubah kode, desain, rute, atau preset sebelum laporan selesai.  
**Repositori:** https://github.com/pangarsagulangsatriya-prog/soma-motion-studio  
**Aplikasi:** https://pangarsagulangsatriya-prog.github.io/soma-motion-studio/  
**Rujukan dokumen:** cari PRD terbaru di `docs/`, termasuk `SOMA_RECOVERY_PRD_V2_COMPOSE_MAP_PERFORM.md` bila tersedia; periksa branch dan commit yang benar, jangan menganggap isi README sesuai produk terkini.

---

## PROMPT UTAMA — jalankan seluruh instruksi ini

Bertindak sebagai **senior product designer, creative-coding engineer, real-time computer-vision engineer, projection-mapping engineer, dan QA lead**. Pelajari SOMA sebagai alat panggung sungguhan. Lakukan inspeksi repository dan aplikasi yang berjalan, telusuri aliran data, jalankan tes, amati setiap layar, lalu hasilkan **audit yang dapat ditindaklanjuti**.

Fokus utama: seorang operator harus bisa menghubungkan kamera, melacak dua performer, mengatur bentuk visual, mengkalibrasi panggung, lalu menampilkan hasil bersih di proyektor dengan langkah sesedikit mungkin. Target **setup pertama ≤10 menit**, pemakaian ulang Stage Profile **≤2 menit**; keduanya target pengujian, jangan klaim sudah tercapai sebelum diukur.

**Jangan langsung mendesain ulang. Jangan langsung mengimplementasikan. Jangan membuat klaim PASS dari pembacaan kode saja.** Pisahkan fakta dari hipotesis dan kondisi yang belum dapat diuji.

### Prinsip produk yang harus dijaga

- Navigasi utama yang dituju: **Compose → Map → Perform**. **Tracking** harus hadir jelas sebagai sistem input di Compose; jangan otomatis membuat tab utama keempat. Evaluasi susunan yang paling singkat dari hasil audit.
- Satu **stage workspace** yang konsisten, tanpa preview panggung ganda atau panel berulang. Preview FLOOR dan BODY boleh ditampilkan berdampingan sesuai konteks.
- **Footprints** sebagai modul utama pertunjukan. Efek artistik, media, dan audio mengikuti kebutuhan adegan; jangan memaksa katalog lama kembali.
- Aktor **A/B**, orientasi kaki, penumpuan, langkah, stop/slide/pivot, crossing, kehilangan tracking, dan pemulihan identitas harus diperiksa.
- Pisahkan tampilan **operator** dari **output panggung**. Proyektor hanya menampilkan konten visual yang disiapkan, tanpa tombol, outline editor, modal, atau indikator debug.
- Konfigurasi harus bisa disimpan dan dipanggil kembali: sumber, output, kalibrasi, surface, scene, pengaturan visual, dan cue. Izin perangkat tetap mengikuti kebijakan browser.
- UI singkat, tenang, presisi. Satu aksi utama yang jelas per tahap. Parameter lanjutan muncul ketika dibutuhkan.

## 1. Inventaris kondisi yang benar-benar ada

1. Periksa branch aktif, SHA commit, deployment URL, build target, versi dependensi, issue/PR relevan, dokumen PRD, aset, dan status release. Catat bila `main`, GitHub Pages, dan Vercel tidak sama.
2. Baca `package.json`, struktur `src/`, `public/`, `api/`, `e2e/`, `tests/`, `scripts/`, dan `docs/`. Kenali entry point, router, komponen, hooks, state store, worker, model AI, shader/effects, renderer, penyimpanan, dan output.
3. Buat **peta fitur aktual**: aktif dan berfungsi / ada tetapi parsial / mati atau tidak terhubung / duplikat / legacy / belum terverifikasi.
4. Bedakan kontrol UI yang benar-benar menembakkan aksi dengan kontrol visual tanpa handler efektif. Telusuri handler → state → engine → frame → keluaran.
5. Catat semua teks dan istilah produk yang bertabrakan: Track/Tracking, Compose/Composer, Map/Mapping, Perform/Projection, Preview/Output, Scene/Preset/Effect/Instrument.
6. **Jangan menghapus fungsi dari label “legacy” saja**. Pastikan tidak dipanggil oleh jalur aktif, tidak dibutuhkan pengguna, dan ada tes yang melindungi penghapusan.

**Output:** diagram arsitektur ringkas, dependency graph, daftar fitur dengan lokasi file dan status bukti.

## 2. Audit fungsi end-to-end (buktikan rantai lengkap)

Telusuri alur nyata ini:

`INPUT → FRAME → INFERENCE → ACTOR ID → FOOT CONTACT/EVENT → VISUAL ENGINE → COMPOSITION → CALIBRATION/WARP → OUTPUT WINDOW → DISPLAY/PROJECTOR`

Untuk **setiap sambungan**, temukan fungsi/modul sumber, tipe payload, timestamp/frame ID, state owner, latensi, jalur error, dan bukti UI. Tandai sambungan yang hilang, dipalsukan oleh simulasi, atau memakai data berbeda dari preview.

| Modul | Verifikasi wajib |
|---|---|
| Input | Webcam, kamera USB, video lokal/MP4, simulasi, dan sumber HP **hanya bila didukung**. Permission, koneksi, retry, ganti sumber, stop/release stream, loading, orientasi dan mirror. |
| Tracking | Model betul-betul berjalan; keypoint kaki kiri/kanan; A/B stabil; confidence; deteksi dua orang; crossing dan occlusion; kehilangan dan pemulihan; tracking tidak macet. |
| Event langkah | Heel/toe atau proxy yang benar-benar tersedia; kontak kaki vs hovering; satu pijakan satu event; langkah berulang tetap muncul; berhenti tidak menciptakan jejak baru; slide dan pivot sesuai data. |
| Visual | Footprint menyerupai bentuk kaki, ukuran terukur, efek/decay, komposisi layer, warna/opacity, kontrol berdampak pada frame; tidak ada preset lama yang muncul tanpa alasan. |
| Mapping | Surface FLOOR/BODY/SCREEN; koordinat kamera → panggung → output; transformasi 4 titik, simpan/muat profil, batas area, mirror, proporsi dan resolusi. |
| Perform | Scene/cue, play/pause bila relevan, output bersih, blackout langsung, unblackout aman, recover stream/renderer, hotkeys, persistensi sesi. |
| Projection | Deteksi layar kedua bila API mendukung; pilihan output; window terpisah; full screen; render berkelanjutan; proyektor tercabut/tersambung; resolusi dan skala; keluaran 2 proyektor bila memang didukung. |

**Kasus khusus yang tidak boleh dilewati:**

- UI menunjukkan **Tracking**, tetapi pose/event tidak berubah.
- Footprint muncul di preview, sementara window proyektor kosong, stale, terpotong, atau menampilkan UI.
- Dua aktor berpapasan, lalu A/B tertukar; setelah kembali terlihat, ID tidak pulih.
- Pergantian scene mereset kamera, mapping, output window, atau menimbulkan layar hitam.
- Preset mengembalikan kontrol palsu atau kondisi izin kamera yang tidak sah.
- Kalibrasi berbeda antara preview dengan keluaran aktual.
- Fullscreen gagal karena popup diblokir / tidak ada user gesture / izin display ditolak.
- Kamera dicabut, browser kehilangan fokus, WebGL context lost, model lambat, CPU tinggi, tab refresh, network putus.
- Mode uji/simulasi mengaku sebagai data kamera nyata. Semua demo/mock harus berlabel.

Jika perangkat fisik tidak tersedia, uji software dengan layar virtual atau display kedua bila bisa. Tandai **PHYSICAL QA PENDING** untuk hasil yang memerlukan proyektor, kamera overhead, atau dua performer sungguhan.

## 3. Audit UI/UX secara visual dan interaksi

Inspeksi **seluruh state**, bukan hanya screenshot awal: kosong, inisialisasi, izin, loading, berhasil, tracking hilang, error, disabled, edit, kalibrasi, siap perform, proyeksi aktif, recovery. Lakukan pada desktop dan ukuran layar kecil sesuai perangkat yang didukung.

Periksa:

- **Information hierarchy:** satu judul singkat, satu aksi utama, satu status utama; hindari tiga panel memberi informasi yang sama.
- **Information density:** hitung teks, label, instruksi, indikator, toggle, dan kontrol yang terlihat pada tiap tahap; hilangkan teks yang menjelaskan hal yang sudah tampak dari perilaku UI.
- **Consistency:** istilah, komponen, warna fungsi, ukuran tombol, jarak, alignment, ikon, tooltip, keyboard, sidebar, inspector, modal, dan transisi.
- **Contextual controls:** parameter muncul sesuai scene/layer/surface/aktor aktif; pengaturan mendalam berada di inspector, tidak menguasai layar.
- **Micro-interaction:** hover, focus, loading singkat, pending, action feedback, retry, undo/redo, perubahan preview langsung, indikator status yang tidak berkedip berlebihan.
- **Operator ergonomics:** alur satu tangan/mouse, akses keyboard, blackout mudah dijangkau, panel tidak menutupi panggung, output tak tersentuh ketika panel operator dibuka.
- **Accessibility:** kontras, ukuran target klik, urutan tab, focus visible, nama kontrol, dan operasi tanpa mouse untuk tindakan kritis.

Untuk setiap elemen, putuskan **KEEP / MERGE / MOVE / COLLAPSE / RENAME / REMOVE** dan sertakan alasannya. Jangan menambah tombol hanya untuk menutup masalah yang bisa diatasi dengan penggabungan alur.

### Batas rancangan yang dituju

1. Maksimal tiga **workspace utama**: Compose, Map, Perform — kecuali audit membuktikan kebutuhan lain yang kuat.
2. Maksimal satu **primary CTA** pada satu konteks; status kamera/tracking/output masing-masing punya satu sumber yang otoritatif.
3. Preview utama tetap dominan. Tidak ada instruksi panjang permanen di sekitar kanvas.
4. Tombol berlabel pendek dan konsisten: `Sumber`, `Kalibrasi`, `Proyeksikan`, `Blackout`, `Pulihkan` (sesuaikan hasil evaluasi terminologi).
5. Pengaturan teknis lanjutan memakai progressive disclosure; jangan menyembunyikan aksi darurat panggung.
6. Ikon hanya dipakai bila maknanya cukup jelas atau mendapat label/tooltip.
7. Semua state memiliki perilaku jelas — tidak boleh ada tombol terlihat aktif tetapi tidak melakukan apa-apa.

## 4. Benchmark produk matang — ambil pola, jangan meniru semuanya

Pelajari dokumen resmi dan, bila tersedia, demo/video UI berikut. Verifikasi fitur terhadap versi terbaru yang tersedia ketika audit dilakukan.

| Produk | Yang harus dipelajari | Penerapan yang dievaluasi |
|---|---|---|
| **Resolume Arena** | Advanced Output, Screen/Slice, pemetaan output, hotkeys, pemisahan editor-output | Satu alur output jelas, pilihan display dan penyesuaian permukaan |
| **TouchDesigner** | Perform Mode, Window COMP, output window, lifecycle sesi live | Pemisahan edit vs perform; sesi stabil; recovery |
| **MadMapper** | Surface, quad warping, scene/cue, keluaran proyektor, visual mapping workspace | Kalibrasi visual langsung; surface dan preset dapat disimpan |
| **LUMOplay** | Interactive floor setup, kamera, kalibrasi dan langkah cepat | Setup singkat, validasi input, verifikasi area interaktif |

**Sumber awal resmi:**

- Resolume: https://resolume.com/support/en/advanced-output
- TouchDesigner: https://derivative.ca/UserGuide/Perform_Mode
- MadMapper: https://docs.madmapper.com/
- LUMOplay: https://help.lumoplay.com/hc/en-us/articles/4409179688723-How-to-install-an-interactive-floor
- Browser Window Management: https://developer.mozilla.org/en-US/docs/Web/API/Window_Management_API
- Browser Fullscreen: https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API

Untuk setiap pola, tulis: **adopsi / adaptasi / tolak**, alasan, dampak UI/UX, biaya/kompleksitas implementasi, kompatibilitas browser, dan risiko lisensi. Jangan memasukkan dependensi, aset, atau kode pihak ketiga sebelum memeriksa lisensinya.

**Batas browser yang wajib dihormati:** pilihan display dan fullscreen dapat memerlukan izin, tindakan klik pengguna, dan dukungan API/browser tertentu. Siapkan fallback **buka output window → pindahkan ke layar proyektor → fullscreen manual**, beserta instruksi singkat hanya ketika diperlukan. Jangan menjanjikan kendali semua proyektor secara otomatis.

## 5. Pengujian wajib (dengan bukti)

Jalankan perintah yang tersedia di versi repo aktif, termasuk `npm ci`, `npm run setup:assets`, `npm test`, `npm run build`, serta `npm run qa:release` **jika aman dan sesuai skrip aktual**. Periksa dahulu setiap skrip yang punya efek eksternal. Gunakan browser automation/playwright bila sudah ada; jangan memalsukan hasil dari lingkungan yang tak mendukung hardware.

| ID | Skenario | Kriteria lulus |
|---|---|---|
| E01 | Buka aplikasi baru, pilih sumber, izinkan kamera | Preview aktif; izin jelas; loading selesai; tanpa freeze |
| E02 | Gunakan video dua performer | A/B dan landmark tampil dari frame nyata; label sumber benar |
| E03 | Dua performer saling silang dan menutupi | ID tertahan saat ambigu; pulih saat terlihat; tidak tertukar diam-diam |
| E04 | Berjalan, berhenti, slide, pivot, berjalan lagi | Event masuk ke visual; satu pijakan tidak berlipat; berhenti tidak mencetak jejak |
| E05 | Ubah scene/layer/parameter | Preview utama dan final output berubah konsisten; input tidak restart |
| E06 | Kalibrasi empat titik FLOOR, simpan, muat ulang | Posisi jejak sesuai area; profil kembali secara akurat |
| E07 | Pindah BODY/FLOOR, uji dua surface | Surface yang dipilih benar; mask & rasio masuk akal |
| E08 | Kirim tampilan ke display kedua | Output window bersih; proyeksi live; kontrol operator tetap di laptop |
| E09 | Putuskan dan sambungkan display/proyektor | Ada status yang akurat, fallback, recovery; tidak diam-diam freeze |
| E10 | Blackout saat frame sedang berjalan | Output menghitam cepat; operator tetap bisa mengendalikan sesi |
| E11 | Reload, ganti kamera, tutup popup, izin ditolak | Error dan recovery tepat; tidak ada stream/worker ganda |
| E12 | Jalankan sesi panjang, ubah scene berulang | Tidak ada peningkatan memori tak terkendali; renderer/output tetap hidup |
| E13 | Audit keyboard dan aksesibilitas | Semua aksi penting dapat ditemukan dan dioperasikan |
| E14 | Dua output fisik (bila dibutuhkan) | Floor dan body/screen dapat dikirim sesuai kemampuan hardware yang teruji |

**Catat:** perangkat, OS, browser/versi, resolusi, commit, durasi, langkah reproduksi, screenshot/video bila tersedia, log, hasil PASS/FAIL/BLOCKED/NOT TESTED, dan bukti. Jangan menulis PASS untuk kasus yang hanya dinilai dari struktur kode.

**Metrik ukur, bukan angka rekaan:** durasi setup pertama dan berikutnya, FPS video vs inference vs output, p50/p95 latency event-ke-visual, drop frame, jumlah klik, jumlah kontrol aktif di viewport, kesalahan identity A/B, keberhasilan kalibrasi, dan waktu recovery. Tetapkan ambang rilis berdasarkan perangkat uji dan kemampuan mesin, lalu tampilkan hasil terukur berdampingan.

## 6. Tentukan prioritas pemulihan

Skala masalah:

- **P0 — Show-stopper:** tidak bisa masuk panggung, tidak ada tracking nyata, output kosong/salah display, blackout tidak aman.
- **P1 — Workflow rusak:** kamera macet, A/B tidak stabil, kalibrasi tidak tersimpan, preview-output tidak sinkron, tombol penting menipu.
- **P2 — Beban UX:** duplikasi panel, tulisan berlebihan, kontrol terpecah, istilah tidak seragam, state membingungkan.
- **P3 — Polish:** transisi, visual hierarchy tambahan, shortcut nonkritis, detail estetika.

Urutkan penyelesaian berdasarkan **fungsi nyata dan kegagalan panggung**, bukan keindahan screenshot. Jangan menyentuh fitur di luar ruang lingkup apabila tidak menyebabkan regresi atau menghambat operator.

## 7. Berkas audit yang harus dihasilkan

Simpan hasil pemeriksaan ke `docs/audits/` (jika akses tulis tersedia), menggunakan nama:

1. `SOMA_AUDIT_E2E_FUNCTIONAL.md` — arsitektur dan jalur data, peta fitur, tabel E01–E14, bukti, bug dengan path/line dan langkah reproduksi.
2. `SOMA_AUDIT_UIUX.md` — screen inventory, audit kepadatan dan hierarki, keputusan KEEP/MERGE/MOVE/COLLAPSE/RENAME/REMOVE, wireframe ringkas Compose/Map/Perform, perilaku setiap state, konsistensi istilah.
3. `SOMA_BENCHMARK_AND_RECOVERY_PLAN.md` — benchmark produk, gap matrix, backlog P0–P3, dependensi, estimasi relatif S/M/L, risiko, dan urutan implementasi.

**Pembuka tiap laporan maksimal satu halaman, lalu detail berbasis tabel dan bukti.** Utamakan gambar beranotasi dan tabel keputusan ketimbang paragraf panjang. Setiap temuan harus menyebut *di mana*, *apa yang terjadi*, *dampaknya*, *buktinya*, *perbaikannya*, dan *cara memverifikasi*.

### Format ringkasan pertama yang wajib tampil

```text
SOMA AUDIT SNAPSHOT
Branch / commit / deployment:
E2E status: PASS / PARTIAL / FAIL / NOT TESTED
Tracking nyata: ...
Actor A/B: ...
Visual → mapping: ...
Output monitor/proyektor: ...
Blackout / recovery: ...
P0: [jumlah] | P1: [jumlah] | P2: [jumlah] | P3: [jumlah]
3 masalah terbesar:
1. ...
2. ...
3. ...
Keputusan UX utama:
- Hapus: ...
- Gabung: ...
- Pertahankan: ...
Implementasi pertama yang direkomendasikan: ...
Yang belum bisa diuji: ...
```

### Format setiap temuan

`ID | Severity | Area | Actual | Expected | Evidence (file:line + screenshot/log) | Root cause / hypothesis | Recommendation | Verification`

Jika root cause belum terbukti, tulis **hipotesis**. Jangan merekayasa screenshot, angka FPS, hasil uji lapangan, atau status fitur.

## 8. Aturan penghentian dan serah terima

- Tahap ini **berakhir pada audit, keputusan UX, dan rencana pemulihan**. Tidak ada perubahan besar pada aplikasi sebelum daftar masalah jelas.
- Perubahan kode yang diperlukan untuk instrumentasi tes harus dipisahkan dan dijelaskan; hindari menyentuh production behavior saat audit.
- Tunjukkan desain usulan sebagai **wireframe informasi** dan matriks perubahan, belum sebagai implementasi visual final.
- Catat area yang tidak bisa diuji di lingkungan agent; usulkan tes manusia paling singkat untuk menutup celah.
- Sesudah laporan tersedia, susun batch eksekusi kecil: **P0 E2E → P1 Tracking/Projection → P2 Simplifikasi UI/UX → P3 Polish**. Setiap batch memiliki acceptance test serta rollback plan.

**Syarat selesai:** saya dapat membaca satu ringkasan, melihat bukti kegagalan yang nyata, mengetahui kontrol mana yang dihapus/digabung/dipindahkan, dan mengikuti jalur yang terbukti dari kamera sampai output proyektor. Jangan menutup audit dengan komentar umum seperti “UI masih ramai” atau “tracking perlu dioptimasi” tanpa file, skenario, dan rekomendasi spesifik.
