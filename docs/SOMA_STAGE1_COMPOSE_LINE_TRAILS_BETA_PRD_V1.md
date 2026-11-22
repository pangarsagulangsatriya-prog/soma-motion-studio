# SOMA — Line Trails (BETA)
## PRD V1: Stage 1 → Compose → Garis dari Gerak Kaki

**Tanggal:** 22 November 2026  
**Status:** PRD untuk implementasi berikutnya; belum ada perubahan aplikasi  
**Lokasi:** Stage 1 → Compose → FLOOR  
**Referensi visual:** gambar pengguna: coretan merah-oranye dan hitam yang saling menyilang di bidang putih bertitik; screenshot Compose dengan Stage Monitor dan Material Mineral Ink.  
**Tujuan:** satu mode Beta yang menggambar garis kontinu mengikuti dua kaki, punya warna independen dan fullscreen bersih.  
**Batas:** dokumen saja. Tidak mengubah UI aktif, tidak deploy GitHub Pages/Vercel, tidak membuka gate proyektor.

---

## 1. Hasil akhir

Saat performer berjalan atau memindahkan kaki, Kaki 1 meninggalkan garis merah-oranye, Kaki 2 meninggalkan garis hitam. Garis panjang mengikuti perjalanan kaki, berbelok ketika kaki berbelok, saling menumpuk, dan berhenti saat kaki diam. Bentuknya terasa seperti coretan tangan pada referensi, dengan variasi halus dari gerakan nyata.

Tidak cukup menggambar garis yang hanya menghubungkan beberapa cetakan tapak. **Engine harus menerima posisi kaki secara kontinu dari Track.** Garis acak yang tidak terkait gerakan tidak diterima.

Operator dapat:
1. Masuk Stage 1 → Compose dan menekan tombol merah **Garis · BETA**.
2. Melihat jalur Kaki 1 dan Kaki 2 pada monitor FLOOR dengan warna berbeda.
3. Mengubah warna masing-masing kaki, ketebalan, dan apakah garis tetap atau memudar.
4. Menekan Bersihkan tanpa memutus tracking.
5. Membuka fullscreen yang hanya memuat kanvas visual, tanpa tombol dan panel.
6. Menekan Esc dan kembali ke Compose tanpa mereset kamera maupun gambar.
7. Menjalankan Demo berlabel jelas ketika belum ada input Track, untuk menguji bentuk garis.

---

## 2. Letak tombol Beta dan UI

**Tempat:** toolbar Stage Monitor, di kanan pilihan FLOOR / LEG A / LEG B / SPLIT / SKELETON dan sebelum tombol Layar penuh. Jangan menambahkan item ke sidebar SOMA atau tab kerja baru.

~~~text
Stage 1 / Compose

Stage Monitor
[FLOOR] [LEG A] [LEG B] [SPLIT] [SKELETON]  [Garis · BETA]  [Layar penuh]

┌──────────────────────────────────────────────────────────┐
│                                                          │
│             AREA GARIS KAKI 1 DAN 2                      │
│                                                          │
└──────────────────────────────────────────────────────────┘

Panel kanan saat mode Garis aktif
Garis · Beta
Kaki 1 · kiri     [■ merah-oranye]    [ON]
Kaki 2 · kanan    [■ hitam]           [ON]
Ketebalan         ────●──────
Jejak              [Tetap] [Memudar]
[ Bersihkan ]      [Coba Demo]
~~~

### Aturan navigasi

- Tombol **Garis · BETA** memakai merah bata terang sebagai satu aksen menonjol, dengan hover/focus yang terlihat.
- Klik membuka mode Line Trails, otomatis memilih monitor FLOOR dan mengganti panel kanan dengan kontrol khusus garis.
- Klik kembali memulihkan mode visual sebelumnya (misalnya Mineral Ink). Pengaturan garis sesi tidak hilang.
- Jangan memasukkan Garis sebagai kartu ketujuh Style Library Mineral Ink. Mode Beta mempunyai renderer sendiri.
- Sembunyikan Flow/Turbulence, material shader, dan inspector Layer/Objek selama pengaturan Garis sederhana tampil.
- Status singkat: Menunggu kaki / Kaki terbaca / Tracking hilang / Demo aktif. Hindari paragraf instruksi panjang.
- Kamera dan pemilihan sumber tetap hanya dikelola oleh Track, tanpa menu kamera kedua.
- Pada layar 1366×768, tombol Beta, pilihan warna, monitor, dan fullscreen harus mudah dijangkau.
- Mobile: panel warna bisa bertumpuk secara vertikal. Keyboard focus dan prefers-reduced-motion harus ditangani.

---

## 3. Karakter gambar yang diinginkan

- **Visual inti:** dua jejak garis organik yang saling melintasi, seperti coretan tebal dan cepat pada contoh.
- Garis dibangun dari sampel posisi kaki, kemudian dilembutkan dengan kurva agar tidak patah-patah.
- Tidak membentuk bunga, spiral, kilat, atau partikel secara otomatis.
- Saat kaki diam, garis berhenti memanjang. Saat kaki keluar bingkai, stroke terputus. Ketika masuk lagi, mulai stroke baru dari titik valid; jangan menghubungkan dua lokasi jauh.
- Tumpang tindih tetap terlihat. Tiap stroke mempertahankan identitas kaki.
- Tebal boleh sedikit berubah menurut kecepatan perpindahan kaki pada citra. Jangan menyebutnya ukuran tekanan/berat injakan.
- Tidak ada pola dotted grid, UI, teks, kotak kontrol, atau skeleton pada hasil fullscreen.

### Default awal, belum diuji di panggung

| Pilihan | Default | Alasan |
|---|---|---|
| Kaki 1 | #F34725 | merah-oranye seperti contoh |
| Kaki 2 | #1D1D1D | hitam seperti contoh |
| Latar | #F5F5F2 | putih hangat, kontras dengan keduanya |
| Ketebalan | sekitar 10 px pada kanvas 1600×900 | sapuan terlihat jelas |
| Ujung garis | bulat | coretan lebih mengalir |
| Jejak | Tetap | gambar menumpuk sepanjang sesi |
| Memudar | 8 detik | opsi saat pengguna mengaktifkannya |
| Bentuk | Coretan | satu gaya utama, tanpa preset tambahan |

**Catatan penting:** pola titik abu-abu pada referensi pengguna hanyalah latar sketsa. Tidak perlu ikut masuk gambar keluaran. Sediakan opsi latar Terang/Gelap dalam pengaturan lanjutan. Apabila hitam dipakai di atas latar gelap, beri peringatan kontras dan sarankan ganti warna. Jangan mengubah warna yang dipilih diam-diam.

---

## 4. Audit engine yang sudah ada

File yang sudah diperiksa:
- src/studio/v3/SurfaceComposer.tsx: Stage Monitor, render loop, Liquid Imprint, Material, dan fullscreen.
- src/studio/v3/FootprintsStageWorkspace.tsx: satu frame tracking, router identitas performer, engine interaksi, dan sumber motion events Compose.
- src/footprints/scenes/FootMotionEventV2.ts: event dengan actorId, foot, x/y, kind, confidence, dan generation.
- src/footprints/scenes/FloorInteractionEngine.ts: movement dan presence, kontak/slide, serta umur/sesi event.
- src/footprints/scenes/interactionAdapters.ts: adapter kamera, MP4, dan simulasi.
- src/studio/v3/composerEventTimelineModel.ts: rekam/replay event dalam memori.
- src/footprints/live/LiveFloorTrackingEngine.ts: estimasi kontak dan kalibrasi lantai.

### Temuan penting

Event movement yang sekarang dipakai FloorInteractionEngine sering berupa **titik kehadiran tubuh** dengan foot unknown. Event contact/slide punya identitas kaki, tetapi jaraknya bisa terlalu renggang untuk membentuk garis lancar.

Karena itu, **jangan langsung menyambungkan event kontak menjadi coretan panjang** dan jangan menganggap movement tubuh sebagai kaki kiri/kanan.

Tambahkan adapter sampel gerak kaki dari Pose yang sudah dihasilkan Track. Tidak boleh membuka webcam lain, menjalankan MediaPipe kedua, atau memindahkan kepemilikan stream kamera dari Track.

---

## 5. Kontrak sampel kaki

Adapter baru mengeluarkan satu sampel per kaki saat ada titik valid:

~~~ts
type FootLineSample = {
  sessionId: string;
  generation: number;
  source: 'camera' | 'phone' | 'video' | 'simulator';
  actorId: string;
  foot: 'left' | 'right';
  x: number;
  y: number;               // koordinat UV 0..1
  atMs: number;            // timestamp frame sumber
  confidence: number;
  coordinateBasis: 'calibrated-estimate' | 'image-2d' | 'simulated';
};
~~~

### Membaca titik kaki

- Pakai pose kaki dari Track: ankle kiri/kanan 27/28, heel 29/30, foot-index 31/32.
- Prioritaskan jangkar heel/foot-index yang keduanya terlihat, dengan fallback ankle yang jujur dan lebih konservatif.
- Verifikasi rentang koordinat dan confidence. Jika kaki tidak terlihat, jangan menebak posisi.
- Jika ada kalibrasi lantai yang aman dan binding kamera cocok, transformasi ke koordinat FLOOR menggunakan utilitas SOMA yang sudah ada.
- Sebelum Map siap, izinkan **Preview 2D belum dikalibrasi** sebagai output software saja. Jangan memakai preview 2D untuk otorisasi proyektor fisik.
- Track MP4 memakai frame Pose yang sudah tersedia; bila tidak ada pose valid, tampilkan Menunggu kaki atau tawarkan Demo. Jangan menggambar gerakan palsu.
- Simulasi 3D boleh memasok posisi kaki yang nyata dari simulator dan dilabel SIMULASI.

### Identitas Kaki 1 dan Kaki 2

**Mode 1P:** Kaki 1 = kaki kiri performer-1, Kaki 2 = kaki kanan performer-1.

**Mode 2P:** pertahankan identitas A/B dari MultiPoseGaitRouter. Pada tahap pertama, pilih performer A atau B lalu tampilkan dua kanal kaki miliknya. Empat kanal simultan hanya bila sudah lulus uji tambahan. Jangan menyambung jalur A ke B ketika keduanya bersilangan.

Saat identitas ambigu, hentikan stroke tersebut dan tunggu titik valid berikutnya.

---

## 6. Arsitektur Line Trails

~~~text
Track (kamera / HP / MP4 / simulasi)
       ↓
Pose dan data kaki yang sudah ada
       ↓
FootLineSampleAdapter
  validasi titik, aktor, kiri/kanan, koordinat
       ↓
FootLineTrailEngine
  riwayat per kaki, smoothing, jeda, umur
       ↓
LineTrailCanvasRenderer
  latar + stroke Kaki 1 + stroke Kaki 2
       ↓
Stage Monitor Compose → Fullscreen Bersih
~~~

### Aturan stroke

1. Kaki kiri dan kanan mempunyai dua jalur terpisah. Jangan menyimpan satu array garis campur.
2. Terima sampel dengan timestamp meningkat, confidence cukup, identitas stabil, dan x/y valid.
3. Abaikan jitter di bawah deadband. Titik yang diam tidak terus mencetak tinta.
4. Saat kaki bergerak, tambahkan titik ke jalur tersebut dan buat lengkung menggunakan quadratic Bezier atau Catmull-Rom yang stabil.
5. Jika jarak antarsampel sangat besar atau selang waktu panjang, putus jalur; jangan tarik garis teleport.
6. Ketika satu kaki hilang, hentikan hanya jalur kaki itu. Jalur kaki lain tetap bekerja.
7. Bila input/source/kalibrasi/session generation berubah, reset jangkar aktif agar tidak menghubungkan sesi lama dan baru.
8. Tetap: simpan stroke dalam riwayat terbatas (bounded), tanpa membuat memori terus membesar.
9. Memudar: redupkan setiap segmen menurut umur; jangan hapus mendadak hingga berkedip.
10. Warna Kaki 1/2 bisa diganti kapan saja dan langsung mewarnai ulang jalur kanal tersebut; perlu disimpan sebagai properti kanal, bukan warna permanen pada setiap event.
11. Bersihkan menghapus riwayat gambar tetapi mempertahankan stream Track.
12. Jangan menambahkan posisi acak untuk mempercantik gerakan. Kelengkungan, tebal, dan waktu boleh diolah dari sampel yang sama.

### Kinerja awal

- Ambil sampel posisi kaki dari frame Track segar, sekitar 15–30 sampel/detik bila tersedia.
- Renderer kanvas boleh berjalan 30–60 fps tanpa membuat inferensi baru.
- Gunakan segment cap/ring buffer dan repaint seperlunya saat tab tidak terlihat.
- Target preview minimal 24 FPS pada laptop 1366×768, diuji pada kamera/MP4 dan dua kanal garis. Ini target awal, belum hasil benchmark.
- Catat FPS, waktu render P50/P95, memori setelah 10 menit, serta jumlah stroke putus akibat tracking.

---

## 7. Integrasi Compose, tanpa merusak yang sudah ada

- Tambahkan pilihan visualMode: Mineral Ink atau Line Trails dalam state Compose; mode default tetap mengikuti perilaku sekarang.
- Renderer garis memakai kanvas khusus, namun **host Stage Monitor yang sama**.
- Saat Line Trails aktif, jangan menjalankan PixiLiquidImprintCompositor penuh bersamaan jika tidak diperlukan.
- Jangan menghapus enam style Mineral Ink, timeline, Map, atau LEG A/LEG B/SPLIT.
- Saat mode ditutup, kembalikan pengaturan Compose yang sebelumnya aktif.
- Beta pertama hanya **software preview dan fullscreen lokal**. Jalur output fisik FLOOR/BODY tetap melalui Map/Perform dan gate QA yang sekarang.
- Blackout harus menghapus tampilan, tidak membiarkan garis lama bocor ke output.
- Status Demo tidak boleh ditampilkan sebagai LIVE.

---

## 8. Fullscreen yang benar-benar bersih

**Masalah saat ini:** SurfaceComposer memakai fullscreen ref pada section soma-compose-monitor. Section tersebut memuat heading, toolbar, dan kontrol monitor. Bila section itu dipakai apa adanya, fullscreen berpotensi menampilkan UI Studio.

**Perbaikan Beta:**
- Sediakan elemen fullscreen **khusus kanvas Line Trails**. requestFullscreen dipanggil dari klik Layar penuh langsung.
- Di fullscreen tampil **hanya warna latar dan dua garis**. Tidak ada tombol Beta, label LIVE, titik grid, timeline, panel, skeleton, atau instruksi.
- Gambar pada fullscreen menggunakan model riwayat stroke yang sama dengan preview editor. Tidak boleh restart ketika fullscreen dibuka.
- Pertahankan rasio output 16:9 awal; pada monitor lain gunakan contain dan letterbox sesuai warna latar, bukan memotong coretan.
- Esc mengembalikan panel Compose, fokus keyboard, serta kondisi Track yang masih aktif.
- Bila requestFullscreen ditolak browser, tampilkan alasan singkat di editor dan pertahankan preview.
- Layar kedua/proyektor yang menampilkan fullscreen lokal masih memerlukan interaksi pemilihan monitor sesuai dukungan browser. Fitur ini tidak otomatis membuka output hardware SOMA.

---

## 9. Micro-interaction

- Klik Garis · BETA: tombol merah tetap menunjukkan state aktif; transisi panel 150–200 ms.
- Ubah warna: garis di kanvas mengikuti pilihan terbaru tanpa jeda terasa.
- Ubah ketebalan: stroke berubah halus, tanpa flash.
- Pilih Tetap/Memudar: segment yang masih valid berganti perilaku berdasarkan timestamp.
- Saat tracking hidup, indikator kecil muncul **di panel editor saja**, tidak di fullscreen.
- Saat tracking hilang, garis berhenti bersih dan status berubah. Tidak ada garis palsu.
- Bersihkan: hanya membersihkan hasil gambar, tanpa reload atau menutup sumber.
- Keyboard dan prefers-reduced-motion didukung.

---

## 10. Perubahan file yang direncanakan

| File | Tugas |
|---|---|
| src/studio/v3/SurfaceComposer.tsx | tombol merah Beta, mode, panel, kanvas garis, fullscreen hanya kanvas |
| src/studio/v3/cp04-compose-microinteraction.css / CSS Beta baru | visual tombol merah, kontrol dua warna, responsif |
| src/studio/v3/FootprintsStageWorkspace.tsx | meneruskan akses sampel Pose yang sudah dimiliki |
| src/footprints/scenes/interactionAdapters.ts | helper koordinat dan titik kaki yang sudah didukung |
| src/footprints/lines/FootLineSampleAdapter.ts (baru) | validasi/mapping posisi kaki per aktor |
| src/footprints/lines/FootLineTrailEngine.ts (baru) | stroke, smoothing, decay, bounded storage |
| src/footprints/lines/LineTrailCanvasRenderer.ts (baru) | render kurva, warna, latar dan fullscreen |
| src/studio/v3/LineTrailsBetaPanel.tsx (baru) | panel ringkas warna, ketebalan, jejak dan Clear |
| tests/foot-line-trails-beta.test.ts (baru) | tes unit per kaki, identitas, jitter, blackout |
| e2e/compose-line-trails-beta.spec.mjs (baru) | uji UI, Demo, warna, fullscreen/ESC dan regresi |

Nama file baru masih bisa mengikuti konvensi repository setelah implementor memeriksa dependency dan struktur terakhir.

---

## 11. Urutan implementasi

| Paket | Prioritas | Yang dikerjakan | Bukti selesai |
|---|---|---|---|
| LT-01 · Beta UI dan Demo | P0 | tombol merah, panel singkat, dua warna, demo 2 jalur, fullscreen hanya kanvas | dua garis dari Demo terlihat seperti referensi; warna & Esc bekerja |
| LT-02 · Posisi kaki | P0 | baca per-foot Pose Track, status sumber, identitas dan koordinat | dua kanal kaki independen; tidak memakai presence tubuh |
| LT-03 · Kurva stabil | P0 | smoothing, deadband, segment cap, hilang frame, Tetap/Memudar | jalan cepat/pelan, stop, belok, crossing tidak mengacaukan gambar |
| LT-04 · Integrasi Compose | P0 | ganti mode tanpa mengganggu Mineral Ink, Layer, Timeline | toggle Beta ↔ Mineral Ink aman |
| LT-05 · QA UI/fullscreen | P0 | 1366×768, 1440×900, Chrome/Safari, aksesibilitas, E2E | fullscreen bersih, Esc aman, build/regresi lulus |
| LT-06 · QA panggung | P1 | kamera HP, dua performer, proyektor via jalur resmi | laporan pengujian, tanpa pembukaan gate otomatis |

**Jangan menggabungkan semua tahap dalam satu perubahan besar.** Tahap Beta visual/Demo perlu dinilai sebelum tracking dihubungkan secara permanen.

---

## 12. Kondisi gagal yang wajib diatasi

| Kejadian | Respons |
|---|---|
| Belum ada input Track | satu pesan Pilih sumber di Track + Coba Demo |
| Model melihat tubuh tetapi kaki hilang | status Kaki belum terbaca, hentikan jalur terkait |
| Movement event hanya titik tubuh | tidak membuat garis per kaki dari event itu |
| Kaki hampir diam | tidak terjadi penumpukan coretan tanpa gerak |
| Satu kaki hilang | hanya kanal itu terputus; kanal lain tetap jalan |
| Frame stale / seek MP4 | stroke terputus, tidak teleport |
| Dua performer crossing | jaga identitas A/B; saat ambigu jangan membuat sambungan |
| Warna gelap di latar gelap | peringatan kontras dan pilihan manual |
| Pindah mode visual | tidak mencampur renderer, sesi Track tetap utuh |
| Fullscreen tidak didukung | pesan singkat; tidak membuat popup tak jelas |
| Esc dari fullscreen | kembali ke Compose, tidak restart sumber/garis |
| Blackout | seluruh kanvas kosong, tidak ada kebocoran frame lama |

---

## 13. Checklist penerimaan

- [ ] Hanya satu tombol **Garis · BETA** merah di Compose; tidak ada halaman navigasi baru.
- [ ] Kaki 1 dan Kaki 2 mempunyai warna dan ON/OFF masing-masing.
- [ ] Coretan benar-benar mengikuti posisi tiap kaki yang terbaca, bukan lokasi tubuh.
- [ ] Gerak lurus, belok, berhenti, cepat, dan crossing menghasilkan stroke masuk akal.
- [ ] Garis tidak teleport saat tracking hilang, seek, atau pergantian source.
- [ ] Warna, tebal, Tetap/Memudar, dan Bersihkan bekerja.
- [ ] Demo mudah dicoba dan diberi label yang jujur.
- [ ] Fullscreen menampilkan **visual saja**; tidak ada sidebar, toolbar, grid, ataupun indikator debug.
- [ ] ESC mengembalikan editor tanpa menghapus data aktif.
- [ ] Liquid Imprint, Compose lain, Track/Map/Perform, Stage 2 dan F3 tidak rusak.
- [ ] Build TypeScript, unit test, Chromium E2E, dan tes regresi lulus.
- [ ] Pengujian kamera/proyektor fisik dicatat terpisah; gate tetap terkunci sebelum QA.

## 14. Keputusan desain yang dikunci

**Warna:** Kaki 1 merah-oranye dan Kaki 2 hitam, bisa diganti sendiri.  
**Karakter:** coretan dua garis yang saling melintasi, dari gerak kaki sungguhan.  
**Letak:** satu tombol merah Garis · BETA di toolbar Compose.  
**Tampilan:** Stage Monitor yang sudah ada, panel kanan yang ringan, fullscreen benar-benar bersih.  
**Engine:** memakai hasil tracking yang sudah berjalan dan menambah adapter posisi kaki; tanpa inferensi kedua.  
**Rilis:** PRD dulu, implementasi dan deploy hanya setelah instruksi berikutnya.
