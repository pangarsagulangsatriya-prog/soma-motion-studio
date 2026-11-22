# SOMA — F3 Capture PRD V3
## Input → Motion → Perform

**Status:** Siap diimplementasikan (PRD; kode V3 belum dikerjakan)  
**Tanggal:** 22 November 2026  
**Target:** branch feat/f3-capture-v2-fullscreen-stage  
**Acuan UI:** Stage 1 SOMA (Track)  
**Acuan fitur:** F3 Capture V2, empat foto kaki + live Kamera B dalam Stage View 2:1

> **Baca ini dulu:** Cukup tiga langkah. Sambungkan dua kamera → periksa gerakan aktor → tampilkan pertunjukan. Semua pengaturan teknis muncul saat dibutuhkan. Video sumber tetap hidup saat pindah langkah. Jangan mengubah Stage 1/2 atau membuka jalur proyektor fisik sebelum QA perangkat.

---

## 1. Hasil akhir yang harus terlihat

Satu aktor menghadap Kamera A. Kamera A membaca tubuh dan tangan aktor untuk mengendalikan crop video Kamera B. Kamera B mengarah ke kaki penonton. Aktor merentangkan / merapatkan tangan untuk memperbesar / memperkecil tampilan kaki penonton, lalu melakukan pukulan Straight atau Uppercut untuk mengambil foto. Maksimal empat foto tersimpan dalam satu sesi. Foto tampil pada empat slot di sebelah kiri layar; live video kaki penonton tetap berada di kanan.

Operator bisa menguji seluruh sistem memakai dua kamera sungguhan atau dua MP4 berbeda. Untuk pertunjukan, operator menyambungkan kamera, memeriksa gestur, meminta persetujuan penonton, kemudian membuka Stage View fullscreen. Tampilan fullscreen hanya memuat karya visual: empat foto kiri, video B kanan. Tidak ada panel Studio, skeleton, tombol teknis, atau frame kamera A.

**Ukuran tetap dari V2:** kanvas 1600×800, rasio 2:1; empat foto 2×2 di 30% kiri, jarak antarkawasan 2%, video B di 68% kanan. Crop dan foto harus mengambil piksel B yang sama persis.

**Batas rilis saat ini:** fullscreen lokal bisa diuji di browser. F3OutputAdapter masih mengunci keluaran proyektor khusus F3. Jangan mengganti gate ready menjadi true atau mengklaim output BODY siap sebelum integrasi, binding, kalibrasi, dan uji fisik selesai.

### Tolok ukur sederhana

1. Operator melihat tiga tab saja: **01 Input · 02 Motion · 03 Perform**.
2. Tiap tab menampilkan satu pekerjaan utama. Tidak ada informasi atau tombol yang diulang di dua panel.
3. Saat kamera A/B sudah tersambung, operator dapat pindah tab tanpa kehilangan stream atau identitas kamera.
4. Motion menunjukkan apakah tubuh aktor terbaca dan gestur apa yang sedang dilakukan.
5. Perform dapat langsung membuka fullscreen 2:1 setelah kedua kamera siap; pengambilan foto dengan pukulan tetap butuh latihan, persetujuan, dan Arm.
6. Perubahan sumber, frame beku, atau persetujuan dicabut langsung mengunci rana gestur.
7. Stage 1, Stage 2, Map, jalur FLOOR, dan Vercel tetap seperti sekarang.

---

## 2. Audit UI sekarang: hapus, gabungkan, pindahkan

| Yang tampak pada screenshot V2 | Keputusan V3 | Lokasi baru |
|---|---|---|
| Dropdown induk “Pilih sumber kamera A dan B” dengan dropdown A/B di dalamnya | **Hapus induk**; A dan B langsung terlihat sebagai dua kartu singkat | Input |
| Panel “Periksa input” mengulang status A/B | **Hapus panel**; tampilkan status kecil di kartu A dan B | Input |
| “Cari kamera” dan petunjuk panjang selalu tampil | Simpan refresh kecil dekat judul; petunjuk lewat tombol bantuan | Input |
| “Lihat gambar kamera” memanjang sampai jauh ke bawah | Hapus panel panjang; pakai dua monitor singkat dengan skala wajar | Input |
| Stage View selalu dominan bahkan ketika belum ada kamera | Tampilkan pratinjau A/B di Input, skeleton A di Motion, Stage View di Perform | Masing-masing tab |
| Tab “Stage View” dan tab “Foto” memisahkan kegiatan pertunjukan | **Gabungkan** ke satu tab **Perform** | Perform |
| Pengaturan Straight / Uppercut tersembunyi di bawah Foto | Pindahkan pemilihan gestur dan latihan ke Motion | Motion |
| Empat foto muncul di Stage View lalu diulang dalam panel bawah | **Hapus galeri duplikat**; hasil utama tampil sekali dalam Stage View | Perform |
| Undo, Ganti, Hapus, Ekspor ZIP | Tampilkan ringkas pada panel operator; jangan masuk output fullscreen | Perform |
| Label “Foto tersimpan” bertabrakan dengan hitungan | Pisah judul dan angka, rapikan jarak | Perform |
| “Info teknis & proyektor” memanjang di akhir halaman | Pindah ke Pengaturan Lanjutan; gate tetap terkunci | Perform |

**Aturan UI:** satu status per sumber, satu aksi utama per langkah, satu monitor utama sesuai pekerjaan, satu tempat untuk empat foto.

---

## 3. Struktur layar V3

SOMA tetap memakai GlobalNav, sidebar, tema hijau gelap, border, tipografi, serta tombol dari Stage 1. Isi F3 mengikuti pola panel kiri sekitar 316 px + workspace besar di kanan pada desktop.

### Tab 01 — Input

**Tujuan:** pilih sumber dan lihat bahwa A/B benar-benar mengirim frame.

~~~text
SOMA / F3 CAPTURE
[01 Input]  [02 Motion]  [03 Perform]                [Lanjut Motion]

┌──── Panel kiri ──────┐  ┌──────── Monitor input ────────────────┐
│ Kamera A · Aktor    │  │ Kamera A · gerak aktor                 │
│ [Pilih sumber ▾]    │  │ [video asli A]                         │
│ LIVE / Pilih kamera │  │                                        │
│                    │  ├────────────────────────────────────────┤
│ Kamera B · Penonton │  │ Kamera B · kaki penonton               │
│ [Pilih sumber ▾]    │  │ [video asli B]                         │
│ LIVE / Pilih kamera │  │                                        │
└──────────────────────┘  └────────────────────────────────────────┘
~~~

- Pilihan sumber A/B mengikuti Track: **Kamera lain**, **Kamera HP**, **Video MP4**. Simulasi 3D tidak masuk F3 karena kamera B perlu piksel video untuk foto.
- Kamera lain: daftar webcam, capture HDMI, OBS, kamera virtual, dan perangkat lain yang tersedia di OS. Kamera HP: kabel/Continuity/Android Webcam atau nirkabel melalui komponen PhoneCameraReceiver dari Track. GitHub Pages masih membutuhkan pertukaran kode untuk WebRTC nirkabel.
- Source A dan B dipilih sendiri-sendiri. Satu device ID fisik tidak boleh digunakan bersamaan pada dua role.
- Status per kartu: **Belum dipilih**, **Menghubungkan**, **LIVE**, **SIMULASI**, **Terputus**, atau **Perlu izin**. Tampilkan pesan penyebab di kartu yang bermasalah.
- Monitor memakai video asli, tanpa skeleton atau crop; kedua monitor dapat memakai rasio 16:9 dan tetap terbaca pada laptop 1366×768.
- **Lanjut Motion** menyala setelah A mengirim frame segar. B yang belum siap tetap ditunjukkan; operator bisa menguji Motion A tanpa B. Kunci Perform live sampai A dan B segar.

**Dihapus:** dropdown induk, panel Periksa input, dua video panjang di bawah sumber, instruksi panjang yang selalu terbuka.

### Tab 02 — Motion

**Tujuan:** lihat tubuh aktor, coba zoom, uji Straight/Uppercut, lalu verifikasi.

~~~text
[01 Input]  [02 Motion]  [03 Perform]               [Lanjut Perform]

┌──── Kontrol gerak ─────────┐  ┌──── Kamera A · Aktor ──────────────┐
│ Tubuh       [Terdeteksi]  │  │ [LIVE VIDEO + SKELETON 33 TITIK]  │
│ Tangan      [2 terbaca]   │  │ [Skeleton On/Off]                  │
│ Zoom B      [65%]         │  │ Indikator: ZOOM / STRAIGHT / ...  │
│                            │  └────────────────────────────────────┘
│ Gestur foto                │  ┌──── Kamera B · crop ───────────────┐
│ [Straight] [Uppercut]      │  │ [LIVE B sesuai zoom dari A]       │
│ [Mulai latihan]            │  └────────────────────────────────────┘
│ Terbaca: 3 · Negatif: OK   │
│ [Verifikasi]               │
└────────────────────────────┘
~~~

- Monitor A menampilkan **video asli + skeleton 33 landmark**. Toggle Skeleton hidup secara default di Motion; boleh dimatikan. Pakai renderer/geometry yang sudah ada di **src/stage/fullBodySkeleton.ts**; jangan membuat renderer skeleton kedua.
- Status yang terlihat: **Tubuh terbaca**, **Tangan terbaca**, **Tracking goyah**, **Gerak terlalu jauh**, **Zoom aktif**, **Straight terbaca**, **Uppercut terbaca**. Status singkat, maksimal satu pesan tindakan.
- Tampilkan garis atau penanda pergelangan dan bahu saat menguji zoom. Skeletal debug tidak masuk Perform.
- Preview B menampilkan crop yang berubah saat gerakan aktor A terbaca. Saat latihan, semua pukulan hanya mengisi penghitung uji; **belum menyimpan foto**.
- Pilihan Straight / Uppercut, tombol Mulai latihan, hasil uji gerak yang sesuai, uji gerak yang keliru, dan Verifikasi berada di sini.
- Cek gerakan mendekat/menjauh dari kamera. Gunakan posisi pergelangan relatif terhadap bahu; pergeseran seluruh tubuh di frame tidak boleh memperbesar video secara tidak sengaja.
- Jika Pose + Hands gagal memuat, tampilkan **Coba lagi deteksi** hanya di Motion, sambil menjaga sambungan kamera. Tidak perlu memutus A/B.
- Setelah berhasil, tampilkan **Gerak siap**. Operator boleh lanjut Perform dengan gestur yang sudah diverifikasi. Mengubah preset, kamera A, atau engine membatalkan verifikasi sebelumnya.

### Tab 03 — Perform

**Tujuan:** jalankan keluaran pertunjukan setelah dua kamera siap.

~~~text
[01 Input]  [02 Motion]  [03 Perform]

┌──── Operator ───────────┐  ┌──────── STAGE VIEW 2:1 ──────────────┐
│ Kamera A   LIVE        │  │  ┌───────┐┌───────┐┌─────────────────┐ │
│ Kamera B   LIVE        │  │  │ Foto 1││ Foto 2││ LIVE VIDEO B    │ │
│ Gerak      Siap        │  │  ├───────┤├───────┤│                 │ │
│                         │  │  │ Foto 3││ Foto 4││                 │ │
│ [ ] Penonton setuju    │  │  └───────┘└───────┘└─────────────────┘ │
│ [Aktifkan Gestur]      │  └────────────────────────────────────────┘
│ [Buka Fullscreen]      │  Foto 0/4 · [Undo] [Ganti] [Hapus] [ZIP]
│ [Jepret manual]        │
│ [Blackout]             │
└─────────────────────────┘
~~~

- Stage View 2:1 tetap satu renderer kanonik: **F3StageRenderer**. Jangan menggambar ulang empat foto dengan DOM yang berbeda.
- Status LIVE/SIMULASI tampak jelas pada panel operator. Mode MP4 perlu label SIMULASI; jangan menampilkan mode latihan seolah kamera fisik aktif.
- **Buka Fullscreen** menjalankan Stage View bersih melalui klik langsung; Esc kembali ke operator tanpa merestart kamera, model, atau menghapus foto.
- **Aktifkan Gestur** hanya tersedia ketika A/B segar, latihan gerak diverifikasi, dan persetujuan penonton dicentang. UI menyebut **Gestur Aktif** sesudah session machine mengizinkan Arm.
- **Jepret manual** tetap tersedia sebagai cadangan setelah persetujuan dan B segar, mengikuti aturan sumber/foto F3 saat ini.
- Empat foto tampil di dalam Stage View. Kontrol Ganti/Hapus/Undo/ZIP berada di panel operator kecil; **jangan menggandakan empat foto sebagai galeri kedua**.
- Ketika 4/4 terisi, rana terkunci. Ganti foto hanya lewat pemilihan slot yang jelas. Jangan menimpa foto otomatis.
- Blackout selalu dapat diakses. Fullscreen lokal perlu dibedakan dari **output proyektor khusus F3** yang masih dikunci sampai QA fisik.
- Operator dapat menguji fullscreen lebih awal dengan A/B siap, walau gestur belum Arm. Tombol fullscreen tidak boleh otomatis mengaktifkan rana.

---

## 4. Kontrak gerak dan gestur panggung

### 4.1 Satu tubuh aktor A, dua jenis pengamatan

**Pose tubuh:** MediaPipe Pose 33 titik untuk bahu, siku, pergelangan, kepala, pinggul, dan posisi tubuh.  
**Tangan:** MediaPipe Hands untuk konfirmasi bentuk tangan ketika terlihat jelas.  
**Kamera B:** hanya sumber video foto/crop; jangan jalankan pose inference pada B dalam F3.

F3 sekarang memakai F3MotionFusion (Pose + Hands dari snapshot video A yang sama). Stage 1 punya renderer skeleton serta tracking/gait yang lebih luas. Pertahankan satu jalur inferensi A yang bisa diuji; gunakan kembali geometry dan komponen visual Stage 1. Evaluasi sebelum mengganti model F3 dengan CameraTracker Stage 1. Jangan menjalankan dua inferensi Pose untuk frame A yang sama.

**Perlu diperbaiki:** nilai confidence pada F3MotionFusion saat ini terlalu kasar (praktis 0 atau 1). Kembangkan kualitas per joint dan umur frame; status UI harus menunjukkan kapan landmark bahu/pergelangan benar-benar dipercaya.

### 4.2 Zoom: gerakan tangan terbuka dari jarak jauh

**Gerakan yang diinginkan**
- Kedua tangan bergerak menjauh: **Zoom In** video B (crop mengecil, kaki terlihat lebih besar).
- Kedua tangan bergerak mendekat: **Zoom Out** video B (crop membesar).
- Tangan berhenti: crop bertahan; gambar tidak terus bergetar.
- Pukulan atau gerak biasa: jangan sampai berubah menjadi zoom.

**Cara membaca gerak**
1. Pakai pergelangan kiri/kanan dari Pose (15/16) serta kedua bahu (11/12); jangan mewajibkan pinching ujung jari untuk zoom jarak jauh.
2. Hitung jarak antardua pergelangan dibagi lebar bahu yang terlihat pada frame yang sama. Ini mengurangi perubahan palsu saat aktor mendekati kamera.
3. Mulai zoom setelah pose awal dua tangan cukup jelas, ditahan sebentar, dan kedua pergelangan terdeteksi stabil. Catat jarak awal dan zoom awal.
4. Perubahan jarak menggerakkan crop secara halus. Gunakan deadband dan smoothing; clamp zoom ke rentang aman yang sudah dipakai F3 (crop fraction 20–100%).
5. Ketika bahu/pergelangan hilang atau satu tubuh terpotong, **tahan crop terakhir** dan keluar dari mode resize. Jangan melompat ke zoom awal.
6. Ketika resize aktif dan sesaat setelah selesai, abaikan trigger pukulan. Setelah pose netral kembali, rana boleh siap lagi.

**Catatan desain:** status zoom sebaiknya **Siap → Mengubah → Tahan**, dengan indikator pada Motion. Nilai hold, deadband, dan smoothing perlu dituning melalui tes panggung; jangan menetapkan angka seolah sudah terbukti.

### 4.3 Foto: Straight dan Uppercut

**Straight:** satu tangan dari posisi persiapan bergerak cepat ke samping/depan bidang kamera dengan lintasan cukup tegas.  
**Uppercut:** pergelangan dari posisi rendah bergerak naik cepat dengan lintasan vertikal.

Urutan wajib: **Netral → Persiapan → Pukulan terbaca → Satu foto → Cooldown → Kembali netral**.

- Pakai pergerakan pergelangan dan siku relatif terhadap bahu. Deteksi sisi kiri/kanan memakai kedekatan hand landmark terhadap pergelangan Pose; **jangan memakai koordinat x < 0,5** untuk menentukan tangan aktor.
- Jarak gerak dan kecepatan dinormalisasi terhadap ukuran tubuh pada gambar. Gerak tetap bisa terbaca saat aktor lebih dekat/jauh.
- Hand landmarks memberi konfirmasi tambahan bila resolusi cukup. Pada jarak jauh, jangan diam-diam menganggap setiap gerakan lengan sebagai kepalan. Mode pose-only untuk shutter hanya boleh dibuka setelah uji negatif spesifik lulus.
- Tetap perlu persiapan, satu impact, cooldown, neutral rearm, dan deduplikasi event. Penonton yang bergerak di kamera B tidak memicu foto.
- **Resize menang atas punch**: ketika sistem sedang memperbesar/memperkecil gambar, tidak boleh ada foto.
- Dalam latihan, pukulan menambah penghitung tes saja. Saat Perform, pukulan hanya memotret bila session machine sudah Arm.

### 4.4 Ketika tracking sulit

| Kejadian | Respons |
|---|---|
| Aktor bergerak maju/mundur | Normalisasi ukuran terhadap bahu; jangan ubah zoom karena skala tubuh saja |
| Satu tangan tidak terlihat | Tahan crop; tampilkan “Tangan belum terbaca” di Motion |
| Pose hilang atau frame A basi | Freeze crop terakhir, batalkan persiapan pukulan, Disarm |
| Kamera B hilang/beku | Jangan ambil foto; kanan Stage View kosong/aman, foto lama tetap |
| Aktor melambaikan tangan | Jangan memotret |
| Kedua tangan bergerak bersamaan | Dibaca sebagai zoom hanya saat pose resize valid; jangan memotret |
| Pukulan cepat dua kali | Satu impact per persiapan; perlu cooldown dan netral sebelum pukulan berikut |
| Operator mengganti sumber/preset | Reset kalibrasi gerak dan verifikasi; Disarm |
| Persetujuan dicabut | Disarm langsung dan batalkan penyimpanan foto yang masih diproses |
| Pindah tab atau keluar fullscreen | Kamera, frame, dan foto tetap hidup; izin Arm tidak berubah otomatis |

---

## 5. Perubahan engine dan komponen yang perlu dikerjakan

| Lokasi | Pekerjaan |
|---|---|
| src/f3/F3CaptureWorkspace.tsx | Ubah tiga tab jadi Input/Motion/Perform. Hapus panel dan galeri berulang. Hubungkan status gerak dan kontrol Arm ke tab sesuai tugas. |
| src/f3/f3.css | Singkirkan aturan yang tak terpakai; pakai ukuran, panel, dropdown, hover, fokus keyboard, serta jarak yang konsisten dengan Stage 1. |
| src/f3/F3CameraRegistry.ts | Pertahankan A/B terpisah, liveness, generasi source, cleanup HP, dan cegah satu perangkat terpilih dua kali. |
| src/f3/F3MotionFusion.ts | Sediakan satu snapshot Pose + Hands untuk UI Motion dan engine gestur. Tambahkan kualitas landmark, diagnostic error, dan penanganan model yang gagal. |
| src/stage/fullBodySkeleton.ts | Gunakan fungsi gambar skeleton yang sudah ada, dengan toggle hanya pada monitor operator F3. Jangan ubah perilaku Stage 1. |
| src/f3/F3FramingController.ts | Tambahkan zoom berbasis posisi pergelangan/bahu, baseline dan smoothing, deadband, hold saat tracking hilang. |
| src/f3/F3PunchEngine.ts | Hilangkan asumsi x tengah layar untuk sisi tangan. Normalisasi gerakan berdasarkan tubuh dan perjelas pemisahan zoom/pukulan. |
| src/f3/F3SessionMachine.ts | Tetap jadi sumber aturan consent, verified, Arm, cooldown, 4/4, dan blocked. Hindari status UI yang mengaku siap sebelum machine siap. |
| src/f3/F3StageView.tsx | Pertahankan fullscreen lokal 2:1, Escape, dan kontrol operator yang tersembunyi saat penonton melihat tampilan utama. |
| src/f3/F3StageRenderer.ts | Pertahankan painter kanonik dan ROI video B, tanpa skeleton di output. |
| src/f3/F3OutputAdapter.ts | Pertahankan fail-closed. Integrasi output fisik sebagai pekerjaan terpisah setelah QA. |
| src/stage/PhoneCameraReceiver.tsx | Reuse seperti Track. Perbaikan boleh berupa komponen bersama; jangan menduplikasi pairing untuk F3. |
| e2e/f3-capture-v2.spec.mjs | Perbarui selector tiga tab dan tambahkan pengujian status Motion, fullscreen, serta perlindungan foto. |
| tests/f3-capture-v2.test.ts | Tambahkan unit tes zoom relatif, asosiasi tangan-pergelangan, false punch, source stale, dan event tunggal. |

**Risiko teknis yang perlu diperiksa sebelum refactor:** video A/B sekarang berada di dalam panel detail yang bisa tertutup. Pastikan elemen media tetap terpasang dan terus decode ketika pengguna berpindah tab. Lebih aman menaruh video sumber pada host permanen di root F3, lalu monitor Input/Motion menampilkan hasil melalui elemen/canvas pratinjau. Jangan mematikan atau mengganti srcObject hanya karena panel disembunyikan.

**Pengaturan yang dipertahankan:** foto di memori sesi, ekspor ZIP ketika diminta, empat slot, crop B dan foto memakai ROI yang sama, two-camera generation guard, persetujuan penonton, serta urutan tombol fullscreen yang tetap berasal dari klik langsung pengguna.

---

## 6. Aturan sederhana untuk operator

### Skenario normal

1. Buka F3 → Input. Pilih sumber A dan B seperti di Track.
2. Lihat dua video. Status A dan B berubah menjadi LIVE atau SIMULASI. Klik **Lanjut Motion**.
3. Aktor berdiri pada posisi panggung. Skeleton tampil. Aktor coba merentangkan dan merapatkan kedua tangan; operator melihat crop B berubah.
4. Aktor memilih Straight atau Uppercut, lalu mencoba pukulan. Operator melihat gestur terbaca dan menguji gerakan negatif. Klik **Verifikasi**.
5. Klik **Lanjut Perform**. Operator meminta persetujuan penonton, lalu klik **Aktifkan Gestur**.
6. Klik **Buka Fullscreen**. Aktor memperbesar/memperkecil video B, lalu memukul untuk memotret. Hasil foto masuk ke empat slot di kiri.
7. Setelah 4/4, shutter berhenti. Operator dapat Undo/Ganti/Hapus, mengunduh ZIP, atau mengakhiri sesi. Saat penonton berganti, minta persetujuan baru dan reset sesi sesuai keputusan operator.

### Skenario gagal

- A belum LIVE → Motion menampilkan “Sambungkan Kamera A”, tombol verifikasi nonaktif.
- B belum LIVE → Motion A tetap bisa diuji, tapi Perform live/foto otomatis tertahan.
- Hands tidak terlihat tetapi Pose terbaca → skeleton dan status Pose tetap tampil; jangan menyatakan pukulan pasti aman.
- Model gagal → **Coba lagi deteksi** tanpa memutus kamera.
- Pukulan saat latihan → tidak ada foto tersimpan.
- Kamera A/B berhenti saat fullscreen → rana Disarm; jangan membuat foto dari frame basi.
- Keluar fullscreen → panel operator kembali, A/B tetap hidup.
- Browser menolak fullscreen → tampilkan alasan dan fallback inline yang benar-benar bersih jika didukung.
- HP lewat QR di GitHub Pages → arahkan ke kode manual; jangan menjanjikan auto-pairing di static hosting.

---

## 7. Urutan implementasi — kecil, bisa diuji, mudah direview

| PR | Prioritas | Isi pekerjaan | Bukti selesai |
|---|---|---|---|
| **F3-V3-01** | P0 | Hapus UI berulang; tiga tab Input/Motion/Perform; pisahkan video host dari panel tersembunyi | Screenshot 1366×768, 1440×900; A/B tidak putus saat pindah tab |
| **F3-V3-02** | P0 | Monitor Motion, skeleton Stage 1, status pose/tangan, preview crop B | Skeleton bergerak bersama A; tombol On/Off; B tetap sumber video/foto |
| **F3-V3-03** | P0 | Normalisasi zoom pergelangan/bahu + gesture mode + freeze/recovery | Zoom dekat/menengah/jauh; tak berubah saat aktor bergeser/maju |
| **F3-V3-04** | P0 | Straight/Uppercut robust, verified training, false-trigger gate, regresi foto | 0/4→4/4, satu pukulan satu foto, consent/stale/cooldown lulus |
| **F3-V3-05** | P0 | Perform satu panel, fullscreen 2:1, empat foto tunggal, kontrol sesi ringkas | 0/4, 2/4, 4/4, Esc, Undo/Replace/ZIP, output bersih |
| **F3-V3-06** | P1 | QA perangkat, dua kamera fisik, HP, Safari, tes panggung dan audit output | Laporan temuan, video/screenshot uji, keputusan kesiapan perangkat |
| **F3-V3-07** | Terpisah | Binding proyektor BODY ke F3 dan uji lapangan | QA fisik tertulis; baru setelah itu pertimbangkan membuka gate |

Jangan menggabungkan ketujuh pekerjaan menjadi satu PR besar. Gabungkan langkah per langkah sesudah tes masing-masing berhasil.

### Definisi selesai sebelum rilis UI F3 V3

- [ ] Halaman hanya menampilkan tiga tab Input/Motion/Perform; tidak ada panel berulang.
- [ ] Pada laptop 1366×768, pekerjaan utama dan CTA terlihat jelas tanpa scroll panjang.
- [ ] A/B dapat memakai Kamera lain, Kamera HP, atau MP4 independen; tidak saling merebut satu perangkat.
- [ ] Stream tetap aktif saat berpindah langkah, membuka fullscreen, dan menekan Esc.
- [ ] Motion memperlihatkan skeleton A, status Pose/Hands, aksi zoom, serta latihan Straight/Uppercut.
- [ ] Zoom sesuai arah rentangan tangan; perubahan jarak aktor tidak menimbulkan lonjakan crop.
- [ ] Foto diambil hanya dari B, dengan crop yang sama seperti preview; tidak pernah dari A.
- [ ] Satu pukulan valid menghasilkan tepat satu foto; latihan dan zoom menghasilkan nol foto.
- [ ] Consent, kehilangan frame, perubahan sumber/preset, cooldown, dan slot penuh memblokir shutter otomatis.
- [ ] Stage View fullscreen bersih, hanya 4 slot kiri + live B kanan; tidak ada skeleton/UI operator.
- [ ] Empat slot, Ganti/Hapus/Undo/ZIP tidak berubah fungsinya.
- [ ] Unit test, build, dan Chromium E2E lulus di branch fitur.
- [ ] Uji perangkat fisik dan Safari dicatat jujur sebagai lulus/belum diuji/gagal.
- [ ] Stage 1/2 dan output FLOOR tetap lulus regresi.
- [ ] Output proyektor fisik F3 tetap terkunci sampai uji khusus F3 disetujui.

### Matriks tes gerak panggung

| Uji | Dekat | Tengah | Jauh | Hasil yang dituntut |
|---|:---:|:---:|:---:|---|
| Tubuh utuh dalam bingkai | ✓ | ✓ | ✓ | Landmark utama stabil atau status minta koreksi posisi |
| Dua tangan merentang/merapat | ✓ | ✓ | ✓ | Crop bergerak dan berhenti halus |
| Aktor maju/mundur tanpa gestur | ✓ | ✓ | ✓ | Crop tidak meloncat |
| Straight & Uppercut | ✓ | ✓ | ✓ | Event benar atau status tidak yakin; tidak boleh menebak |
| Lambaian, jalan biasa, putar tubuh | ✓ | ✓ | ✓ | Tidak ada foto palsu |
| Hilang satu lengan / frame beku | ✓ | ✓ | ✓ | Zoom hold, shutter Disarm |

**Target uji, belum terukur:** nol foto palsu dalam 15 menit gerakan negatif; pukulan sah tetap konsisten di jarak yang dipakai aktor; tidak terjadi pergantian sumber saat operator menekan tab. Ukur latensi dari gerak ke perubahan crop dan dari pukulan ke foto. Catat P50/P95 hasil uji, jangan memalsukan angka.

---

## 8. Yang sengaja tidak masuk V3

- Tracking gait/footstep dan floor mapping dari Stage 1.
- Kalibrasi lantai, BODY/FLOOR dual-projector dan alat Resolume/TouchDesigner.
- Satu mode baru untuk mengedit efek visual atau body projection.
- Simulasi 3D sebagai sumber foto.
- Kamera tambahan di luar A/B.
- Penyimpanan cloud otomatis, unggah foto penonton, atau ekspor otomatis.
- Dashboard FPS, koordinat mentah, dan panel debugging yang selalu terbuka.
- Mengaktifkan hardware projector gate sebelum review dan QA.

---

## 9. Cara mengerjakan PRD ini

1. **Audit awal:** cocokkan branch fitur dengan daftar file di atas. Catat hal yang sudah berjalan; jangan menulis ulang engine foto/registrasi kamera yang sudah berfungsi.
2. **Kerjakan PR bertahap:** F3-V3-01 sampai 05 dulu. Pastikan UX sesuai screenshot Stage 1, lalu uji Motion dengan skeleton dan video B nyata.
3. **Bukti tiap PR:** sertakan screenshot 1366/1440, hasil build/test, skenario positif/negatif, dan bug yang belum selesai.
4. **Release:** branch F3 boleh dipreview lewat GitHub Pages setelah CI lulus. Jangan deploy Vercel atau merge ke main tanpa instruksi berikutnya.
5. **Jujur soal hardware:** uji fisik HP, Safari dan proyektor dicatat terpisah dari tes browser otomatis.

## 10. Rujukan di repository

- **SOMA_F3_CAPTURE_V2_BRANCH_IMPLEMENTATION.md** — kontrak Stage View, empat foto, source B, consent, dan gate output.
- **F3_SOURCE_TRACK_CAMERA_ADAPTER_2026-11-22.md** — koneksi HP/USB/WebRTC dari Track ke A/B F3.
- **src/f3/F3CaptureWorkspace.tsx** — UI dan state machine operator saat ini.
- **src/f3/F3MotionFusion.ts**, **F3FramingController.ts**, **F3PunchEngine.ts** — engine yang perlu diaudit sebelum perubahan gestur.
- **src/stage/fullBodySkeleton.ts** — renderer skeleton 33 titik yang bisa digunakan di Motion.
- **src/f3/F3StageRenderer.ts**, **F3StageView.tsx** — painter kanonik dan fullscreen.
- **src/f3/F3SessionMachine.ts**, **F3OutputAdapter.ts** — consent/Arm dan keamanan output.
- **tests/f3-capture-v2.test.ts**, **e2e/f3-capture-v2.spec.mjs** — tes yang harus tetap lulus, lalu diperluas untuk V3.

**Aturan bila dokumen bertabrakan:** PRD V3 memimpin alur UI dan kebutuhan Motion/Perform. Kontrak pixel Stage View, aturan foto/consent, source B, dan penguncian hardware dari V2 tetap berlaku sampai ada keputusan teknis teruji yang tertulis.
