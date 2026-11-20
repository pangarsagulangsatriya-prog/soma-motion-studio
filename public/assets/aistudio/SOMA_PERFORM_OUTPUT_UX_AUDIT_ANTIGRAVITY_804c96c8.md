# SOMA — PERFORM & PROJECTION OUTPUT RECOVERY
## Prompt audit → redesign → implement → verify untuk Antigravity
**Tanggal:** 20 November 2026  
**Repository:** `https://github.com/pangarsagulangsatriya-prog/soma-motion-studio`  
**Lingkup:** workspace **PERFORM**, handoff dari MAP, output window, operator console, cue, dual projector, dan keamanan panggung. **Jangan refactor Track/Compose/Map di luar kontrak integrasi yang terbukti perlu.**

> **PERINTAH UNTUK AGENT:** Anda harus membuka repo pada commit terbaru, jalankan aplikasi dan inspect DOM/UI, baca implementasi yang benar-benar aktif. Catatan audit awal di bawah adalah hipotesis berbasis pembacaan kode; perbarui bila commit berubah. Jangan menyatakan proyektor fisik lolos hanya karena browser preview bekerja. Audit dahulu, lalu implementasikan perbaikan yang aman dan uji. Jangan deploy Vercel atau merge ke `main`.

## 0. Target pengalaman operator (keputusan produk)
SOMA harus memberi satu perjalanan yang bisa dijalankan operator panggung:

**Track → Compose → Map → Perform → Buka Output → Uji → LIVE → Cue → Blackout → Selesai.**

- **Laptop / layar utama = Perform Console:** control room ringkas yang tetap terbuka sepanjang pertunjukan.
- **Monitor/proyektor tambahan = Output Window:** hanya visual terkalibrasi, tanpa seluruh UI, overlay diagnostik, cursor kontrol, panel, atau debug text.
- Klik **Buka Output** dari PERFORM membuka/mengaktifkan jendela output yang **selalu dimulai Blackout**, memakai pipeline output yang sudah ada. Operator memindahkan ke extended display dan menggunakan Fullscreen. Jika browser mendukung screen selection dan diizinkan, boleh menawarkan pemilihan layar sebagai *progressive enhancement*, bukan prasyarat.
- **LIVE hanya melalui gate izin fisik**: sumber live valid, identitas A/B aman, kalibrasi terikat kamera yang sama, jendela terkoneksi, QA fisik valid, operator mengonfirmasi, output tidak diblokir build, serta safety transport mengizinkan. Buka window ≠ LIVE.
- **Cue GO** mengendalikan komposisi yang benar-benar dikirim ke output sesuai data Compose/Map. Jangan tampilkan “GO berhasil” bila hanya mengganti layout console; bila belum bisa, label harus jujur: `Ganti tampilan operator` dan tampilkan fitur cue-output sebagai *not implemented*.
- Untuk **2 proyektor**, dukung `FLOOR` dan `BODY` sebagai dua output terpisah dengan status masing-masing. Sistem yang hanya punya satu proyektor tetap bisa latihan dengan satu output.
- Untuk **1 monitor**, sediakan `Preview Output` (simulasi di browser) dan petunjuk sambung proyektor; jangan memaksa fisik LIVE.

**Mental model sederhana:** MAP menempatkan visual pada ruang; PERFORM menjalankan visual yang sudah disetujui. Operator tidak perlu mencari tombol LIVE yang tersembunyi di MAP setelah memasuki PERFORM.

## 1. Temuan awal kode — harus diverifikasi ulang
File yang relevan di `main` saat pembacaan:

| Lokasi | Indikasi teknis | Perintah audit |
|---|---|---|
| `src/studio/v3/OperatorStageConsole.tsx` | Cue 8 slot, Prev/GO, Hold Preview, Rekam, Blackout, recovery; **belum terlihat tombol utama `Buka Output Proyektor`** | Audit interaksi utama dan bedakan operasi output dari perubahan layout operator |
| `src/studio/v3/performCueModel.ts` | Slot menyimpan `scene: footprints` dan `view: overview/body/floor/split`; komentar menyatakan cue hanya data/layout | Telusuri `applyPerformSlot`: apakah mengubah frame projector atau sekadar monitor UI? Jangan klaim scene switching fisik bila belum terjadi |
| `src/studio/v3/FootprintsStageWorkspace.tsx` | Mode Perform, status kamera/dual output, readiness, blackout serta navigation sudah tersambung | Temukan source of truth, mount/unmount, fallback ketika source/camera terputus |
| `src/studio/v3/safeProjectionPreflight.ts` | Memisahkan source, tracking, floor, output, ready/software-only | Tampilkan satu readiness summary dengan langkah perbaikan spesifik |
| `src/footprints/stage-optics/DualSurfaceRoutingPanel.tsx` | `Buka output`, mode TEST/LIVE, QA lima titik, dua surface, petunjuk pindah window dan tombol F | Pindahkan **akses utama** ke Perform melalui state/action bersama; konfigurasi detail tetap di Map |
| `src/footprints/stage-optics/DualSurfaceSessionStore.ts` | Satu store dual surface, `ProjectionLink`, blackout, heartbeat, requested/armed | Reuse store/ports; **jangan buat output/pump/channel paralel** |
| `src/projection/ProjectionOutput.tsx`, `src/projection/channel.ts` | Browser output rendering, session handshake, heartbeat, fullscreen F | Uji reconnect, popup blocked, frame stale, close/reopen, src orientation, duplicate windows |
| `src/footprints/stage-optics/StageHardwareGate.ts` | Output fisik dev/opt-in, Production dapat terkunci | UI harus mengatakan `Output fisik dinonaktifkan pada build ini`, jangan menawarkan LIVE palsu |
| `src/studio/v3/StageModuleNav.tsx` | Track/Compose/Map/Perform satu navigasi | Jangan buat tab produk kelima bernama Output |

**Catatan ketidaksesuaian kritis:** operator bisa mengira cue `GO` memutar adegan ke proyektor, padahal data/komentar menunjukkan GO mengatur *layout monitor*. Periksa jalur aktual dari klik → state → composition → output canvas → channel → window; perbaiki kontraknya atau perjelas label.

## 2. Benchmark best practice (ambil polanya, jangan menyalin UI)

1. **Resolume Arena — Output Setup / Advanced Output**  
   https://www.resolume.com/support/en/output-setup  
   https://resolume.com/support/screens  
   **Pola:** layar control terpisah dari display output; pilih target fisik; konfigurasi mapping disiapkan sebelumnya. SOMA: beri tombol output dari Perform dan identitas projector yang jelas.
2. **TouchDesigner — Window COMP / Perform Mode**  
   https://docs.derivative.ca/Window_COMP  
   https://derivative.ca/UserGuide/Perform_Mode  
   **Pola:** jendela pertunjukan berdiri sendiri; interface authoring tidak tampil di proyektor. SOMA: operator console tetap di laptop, output canvas bersih di monitor kedua.
3. **MadMapper — Output Destination / Fullscreen**  
   https://madmapper.com/madmapper/faq  
   https://lab.arts.ac.uk/books/projection-mapping/page/projection-mapping-in-madmapper  
   **Pola:** tujuan output eksplisit, mode Extend Display, fullscreen; mapping dan playback tidak bercampur. SOMA: panduan satu kalimat untuk menempatkan window dan status target.

**Penilaian benchmark yang harus dibuat:** perbandingan SOMA vs ketiganya dalam 5 aspek — waktu menemukan tombol output, kejelasan status output, pemisahan control/output, recovery, dan keamanan LIVE. Sertakan bukti screenshot dan referensi tautan. Jangan mengejar semua fitur VJ profesional.

## 3. Arsitektur pengalaman PERFORM (wireflow operasional)

```
MAP lulus simulasi + kalibrasi
       ↓
PERFORM CONSOLE [Ready?]
       ├─ Belum siap → tampilkan satu blocker utama + "Perbaiki di Track/Map"
       └─ Siap software → "Buka Output Proyektor"
                 ↓
      Pilih FLOOR / BODY / Keduanya (sesuai port dan setup)
                 ↓
      Output window(s) terbuka BLACKOUT
                 ↓
      Sambungkan display eksternal → pindahkan jendela → fullscreen
                 ↓
      TEST GRID → ukur 5 titik → operator confirm di MAP/mini QA
                 ↓
      LIVE (hanya ketika seluruh safety gate lulus)
                 ↓
      GO 01 / GO 02 / ... → HOLD / BLACKOUT
                 ↓
      Selesai → BLACKOUT → Tutup output (opsional)
```

- **Buka Output** tidak otomatis menyalakan cahaya.
- Jika sistem mendeteksi sudah ada output aktif, tombol menjadi `Lihat Output`, tanpa membuat popup ganda.
- Jika popup diblokir, tampilkan aksi `Izinkan pop-up lalu coba lagi` pada klik pengguna berikutnya; browser tidak boleh diam-diam membuka window lain.
- Jangan memanggil `requestFullscreen()` tanpa aksi pengguna; pada window output tampilkan instruksi ringkas `Pindahkan ke proyektor · tekan F`.
- Masing-masing window BODY/FLOOR memiliki transport dan status; tombol **BLACKOUT SEMUA** selalu terlihat dari Perform.

## 4. Desain visual PERFORM yang harus diimplementasikan

**Default desktop:** stage monitor besar (±70% perhatian), panel cue dan transport ringkas. Informasi sekunder di `Detail` yang tertutup secara default. Hilangkan tumpukan instruksi dan paragraf permanen.

### Header (satu baris)
`Perform` · `Kamera siap` · `FLOOR [Offline/Test/Live]` · `BODY [Offline/Test/Live]` · `BLACKOUT`.
Status validasi bisa `Belum siap`, `Preview siap`, `Output siap`, atau `LIVE`. Jangan pakai status `Ready` ketika hardware masih terkunci.

### Main Stage Monitor (pusat UI)
- Pratinjau panggung dengan **2 siluet/performer A/B** dan jejak kaki seperti data Track/Compose/Map terakhir, termasuk floor plane dan area body. Pilih view `Stage | Floor | Body | Input`, bukan 4 panel terlihat bersamaan.
- Identitas orang dan output yang terlihat harus konsisten; jangan ubah data A/B untuk sekadar dekorasi.
- Mode `Simulasi` diberi tag jelas, tidak pernah menampilkan indikator `Hardware LIVE`.
- Sediakan demo yang bergerak ketika kamera tak tersedia agar operator bisa mencoba cue, tapi demo **tidak mengaktifkan output fisik**.
- Preview operator tidak boleh memakai input video yang berpotensi menghasilkan pixel di output sebelum guard lulus.

### Primary action (satu tombol dinamis)
1. Belum siap → `Perbaiki Setup` + penyebab utama.
2. Siap software dan hardware output tersedia → `Buka Output Proyektor`.
3. Window terkoneksi namun belum diuji → `Uji Proyektor` (test pattern di bawah izin/operator).
4. QA fisik lulus dan semua gate siap → `Aktifkan LIVE` (konfirmasi eksplisit).
5. LIVE → `Pantau Output`.

Jangan tampilkan lima tombol utama sekaligus. Tetap tampilkan **BLACKOUT SEMUA** yang menonjol dan dapat diakses dengan mouse/keyboard.

### Transport dan cue
`◀ Prev` · `GO / Next` · `Hold` · `Blackout`.
- Tampilkan maksimal 4 cue yang dekat dengan posisi aktif; 8-slot grid hanya saat panel `Cue List` dibuka.
- Perbesar teks cue aktif, tampilkan cue berikutnya. Edit nama/preset dalam panel lipat; jangan saat pertunjukan.
- Tentukan secara tegas apakah Hold menghentikan *preview*, *output frame*, atau keduanya. Hindari label `Hold` generik ketika hanya salah satunya yang terpengaruh. Safety blackout selalu menang.
- Rekam dipindahkan ke menu sekunder bila tidak terkait operasi cue inti.

### Detail tersembunyi
`Output Details`, `Cue Editor`, `Advanced`, `Diagnostics` tertutup secara default; hanya expand saat operator memerlukan tindakan. Koordinat, resolusi, session epoch, debug FPS, token izin, dan log bukan materi default Perform.

## 5. Kontrak teknis yang tidak boleh rusak

**Satu sumber gerak:** SOMA StageSession / CameraTracker / FootMotionEvent mengalir ke Compose, lalu Map, kemudian Perform. Jangan membuka kamera baru di Perform.

**Satu sumber gambar:** renderer/compositing yang sama dipakai preview dan transport output; gunakan adapter canvas/map yang sudah ada. Jangan membuat sistem footprints kedua untuk layar output.

**Satu pemilik output:** `DualSurfaceSessionStore` + `ProjectionLink` (sesuai real implementation). Kontrol Perform memanggil action yang sama dengan Map dan membaca status yang sama. Map editor/QA dan Perform monitor harus sinkron dua arah.

**Dua channel:** BODY dan FLOOR terpisah. Validasi route, source, quad/calibration, preview correspondence, heartbeat, transport, dan lampu nyata masing-masing.

**Safety latch**:
- Pindah kamera atau resolusi → revalidate calibration/QA → blackout.
- Kamera hilang, frame stale, actor A/B ambiguous, mask tidak aman, output disconnect, permission revoked, source switch → output yang terdampak blackout. Jangan auto-resume.
- Ubah quad atau output viewport → invalidate QA dan blackout.
- Restart/reload → jangan restore LIVE dari localStorage. Hanya cue dan profil draft yang boleh dipulihkan.
- Escape/shortcut tidak boleh memadamkan UI editor secara tak sengaja saat mengetik; tombol hardware safety tetap punya prioritas.
- Software status `LIVE` bukan bukti cahaya proyektor menyala atau akurat; uji fisik wajib.

**Build guard:** `VITE_SOMA_STAGE_OUTPUTS=enabled` mungkin diperlukan untuk output fisik pada Production. Audit konfigurasi sesuai deployment saat ini; tampilkan status akurat. Jangan melemahkan guard untuk sekadar membuat tombol LIVE menyala.

## 6. Audit interaksi: periksa di browser nyata

Audit secara lengkap:
- Handoff Map → Perform: apakah output konfigurasi, quad, mask, scene, dan source tersimpan di state yang sama?
- Tombol `Buka Output`: di halaman mana saat ini, berapa klik dari Perform, apakah dapat diakses dan diberi label intuitif?
- Output window: apa yang terjadi saat popup blocked, jendela tertutup, di-reload, focus blur, pindah monitor, fullscreen toggled, laptop sleep/reconnect?
- Status: perbedaan window opened / connected / test / QA ready / armed / LIVE / blackout; jangan campur semuanya menjadi `connected`.
- Cue: apakah event GO mengganti visual proyektor? Jika hanya mengubah monitor, tandai BUG UX `misleading action`.
- Hold: apakah output tetap bergerak walau label Hold terpasang?
- Tombol BLACKOUT: dari jalur mana pun (Perform, Map, keyboard, error) benar-benar memadamkan request output?
- Sumber simulasi: preview bisa dimainkan, output fisik tetap terkunci dan jelas bagi operator.
- Kebocoran UI: proyektor bebas HTML controls, mouse cursor, debug overlay, toolbar, picture-in-picture.
- Aksesibilitas: fokus keyboard, shortcut tidak bentrok dengan input, kontras, active/disabled/loading, inline error recovery.

## 7. Skenario E2E minimal (otomatis + uji fisik terpisah)

| ID | Situasi | Expected |
|---|---|---|
| PF-01 | Buka Perform setelah Map lengkap | Satu readiness indicator, preview sesuai map, BLACKOUT terlihat |
| PF-02 | Output belum terhubung | Tombol buka/panduan muncul, tidak mengaku LIVE |
| PF-03 | Klik buka output | Jendela bersih baru dalam BLACKOUT; tidak muncul duplikasi |
| PF-04 | Popup blocked | Pesan recovery dengan retry melalui user gesture |
| PF-05 | Satu monitor | Local preview tersedia, tidak klaim proyektor eksternal |
| PF-06 | Extended display | Operator tetap di laptop; output window fullscreen di proyektor |
| PF-07 | FLOOR dan BODY dua monitor/proyektor | Channel terpisah, warna/layout/quad sesuai masing-masing output |
| PF-08 | QA lima titik belum lengkap | LIVE disabled, alasan dan tombol kembali ke Map QA jelas |
| PF-09 | QA dan source lulus | LIVE dapat diaktifkan melalui konfirmasi; tidak otomatis |
| PF-10 | GO 01 → GO 02 | Perubahan pada **actual output canvas** sesuai cue, bukan layout UI saja |
| PF-11 | Hold lalu Resume | Perilaku output dan status sesuai label, tidak ada loncatan frame atau artefak lama |
| PF-12 | Blackout software | Semua output segera diperintah gelap, termasuk setelah mode switching |
| PF-13 | Kamera disconnect / stale frame | Output terkait padam terkunci; recovery memerlukan validasi lagi |
| PF-14 | Crossing actor A/B ambigu | Visual tidak tertukar diam-diam atau membuat contact salah |
| PF-15 | Tutup output window | Status Offline akurat; reconnect tidak auto-LIVE |
| PF-16 | Ubah Map quad / source / viewport | QA invalidated dan LIVE revoked |
| PF-17 | Reload browser / restore profil | Cue boleh pulih; izin fisik dan mode LIVE tidak dipulihkan |
| PF-18 | Simulasi 3D / MP4 | Preview dan cue rehearsal dapat diuji, output fisik tetap terkunci |
| PF-19 | Build Production tanpa hardware opt-in | CTA memberi tahu kondisi build; tidak menawarkan perform fisik palsu |
| PF-20 | 30 menit stress/rehearsal | Tidak ada kebocoran listener, duplikasi popup/renderer, progres latency/FPS terukur |

**Automation acceptance:** screenshot desktop, screenshot 1366×768, popup flow via Playwright, DOM snapshot, browser errors, store assertions, test `build`/`test`. **Physical acceptance:** output windows terlihat pada perangkat asli, QA lima titik, frame-to-light video, blackout manual, uji dua aktor dan dua proyektor; hasil hardware `NOT TESTED` sampai ada bukti lapangan.

## 8. Urutan implementasi — jangan mengerjakan semuanya sembarangan

1. **PF-R0 / Trace & Evidence:** inspeksi file, routes, states dan click path; tangkap screenshot perform sekarang, source/output status, baseline test. Buat tabel `current → target` dan severity. Hindari sweeping refactor.
2. **PF-R1 / Perform Console Focus:** header singkat, stage monitor tunggal, output readiness, satu CTA dinamis, BLACKOUT, cue aktif & next. Pindahkan teks panjang ke drawer.
3. **PF-R2 / Output Handoff:** operasikan existing `DualSurfaceSessionStore` dari Perform, deteksi output window yang sudah terbuka, popup blocked recovery, fallback extended display manual, explicit blacked-out open.
4. **PF-R3 / Cue Truth:** sambungkan cue pada gambar/output yang benar-benar berubah, atau beri label jujur bila cakupannya hanya layout. Uji actual canvas pixels + channel events.
5. **PF-R4 / Simulation in Perform:** re-use Track/Compose stage view + floor/body mapping; preview A/B bergerak; label simulasi; tidak memberi izin hardware.
6. **PF-R5 / End-to-end Safety & QA:** browser suite, stress/reconnect, dual channel tests, acceptance; dokumentasikan test hardware tertunda.

Hanya update kode yang mempunyai dampak pada flow di atas. Setiap commit bermakna, test gate jalan, jangan re-enable visual legacy yang telah dihapus.

## 9. Format laporan Antigravity (wajib)

Hasilkan tiga dokumen singkat di `docs/`:

- `SOMA_PERFORM_AUDIT.md`: tabel **issue, current code/file:line, screenshot, operator impact, severity, reproduction, proposed fix**.
- `SOMA_PERFORM_UX_SPEC.md`: final 1-page wireflow + desktop layout + kebijakan status dan label CTA.
- `SOMA_PERFORM_E2E_QA.md`: matriks 20 pengujian dengan `PASS / FAIL / NOT TESTED`, bukti dan catatan hardware.

Tuliskan ringkasan akhir: temuan P0/P1, file yang diubah, tes yang dijalankan, batasan browser/hardware, hal yang belum terbukti, satu PR draft jika dapat dibuat. Jangan menyebut "ready to stage" sebelum uji proyektor sungguhan.

## 10. Kriteria selesai
- Dari Perform, operator bisa menemukan aksi output utama **langsung**, tanpa kembali mencari di panel Map; QA lanjutan tetap tersedia di Map.
- Output window menampilkan **gambar bersih saja**; kontrol tetap di laptop.
- Satu sumber kebenaran untuk kamera, preview, mapping, cue, output transport, dan status.
- Operasi dua proyektor dan fallback satu proyektor jelas.
- GO/Hold/Blackout mempunyai fungsi dan label yang sesuai efek nyata pada renderer/output.
- Tidak ada LIVE otomatis. Mode blackout dapat dipulihkan secara aman dan statusnya jujur.
- UI Perform secara visual lebih sepi daripada Compose dan Map; panel detail tetap bisa dibuka jika diperlukan.
- Tidak melakukan deployment otomatis atau membuka build guard tanpa bukti QA.

**Mulai sekarang: inspeksi aplikasi, jalankan baseline, buat audit, implementasikan langkah PF-R1 → PF-R5 bertahap. Laporkan file dan hasil tes.**
