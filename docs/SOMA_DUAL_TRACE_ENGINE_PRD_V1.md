# SOMA — Dual Trace Engine V1
## PRD ringkas | Foot Path + Head & Shoulder Gesture

**Status:** rancangan, belum diimplementasikan atau di-deploy.  
**Konteks:** *Unpacking: In Passing (Melintas)*; dua aktor, satu sumber pose, dua bidang gambar.  
**Acuan kode SOMA:** `VideoPoseGaitEngine.ts` menghasilkan `ReplayAnalysisSnapshot.people[].landmarks` (33 landmark) dengan identitas A/B; live memakai `MotionFrame.pose/poses`, `MultiPoseGaitRouter`; Foot Path sudah memakai `PathObservationRouter`, `ActorPathTracker`, `PersistentPathStore` dan `PainterlyCanvasRenderer`.

## 1. Masalah yang diselesaikan

Foot Path bisa memperlihatkan jalan yang ditempuh, tetapi tidak cukup untuk menghasilkan semua karakter sapuan gestural pada contoh coretan merah–hitam: lengkungan besar, silang, tarikan vertikal, dan belokan cepat. Menambah goresan secara acak akan memutus hubungan gambar dengan tubuh. Dual Trace mengolah gerak kaki dan gerak tubuh atas dalam dua kanvas terpisah, dengan data aktor dan waktu yang sama.

## 2. Sasaran produk

Dari satu kamera/MP4 dan satu proses deteksi pose, SOMA menampilkan **dua layar berdampingan**:

| KANVAS A — FOOT PATH | KANVAS B — UPPER GESTURE |
|---|---|
| Menangkap lintasan kaki dan titik tumpuan yang tepercaya | Menangkap perubahan posisi kepala dan bahu |
| Footprint + jalan yang menetap | Dua jenis garis gestural: kepala dan pusat bahu |
| Karakter garis mengikuti jalur, lebih stabil dan ramping | Karakter garis lebih bebas, bisa membentuk lengkungan, loop, dan silang yang didukung data |
| Footprint memudar setelah 6 detik | Tidak ada footprint |
| Stroke tinta menetap hingga Clear | Stroke tinta menetap hingga Clear |

**Dua layar** berarti dua *view/output canvas* yang berdiri sendiri di aplikasi. Penggunaan dua proyektor fisik hanya opsi Perform berikutnya, bukan prasyarat demo.

## 3. Perilaku visual wajib

- **Identitas warna selalu per aktor**, konsisten di kedua layar: Aktor A vermilion `#E84B32`, Aktor B charcoal `#202226`. Warna tidak dibagi berdasarkan kaki kanan/kiri atau kepala/bahu.
- Latar keduanya putih hangat `#F7F6F2`. Kontras dijaga lewat pigmen, ketebalan, dan opacity. Jangan menukar palet A/B antar layar.
- Foot Path: default ±22 px untuk path; tapak kaki opacity awal jelas, memudar 6 s; path tetap tinggal.
- Upper Gesture: **shoulder center** stroke ±16 px (utama), **head center** stroke ±8 px (sekunder); alpha kepala ±0,75, bahu ±0,9. Tekstur kuas mengikuti tangent. Kontrol bisa diubah.
- Jejak gestural menggambar **gerak yang teramati**. Gerak kepala dapat diperbesar secara artistik (default gain 1,35×; 1–2,5×) dengan label “Amplifikasi gesture”, dan selalu dibatasi. Diam atau landmark goyah tidak boleh menciptakan garis baru.
- Tidak ada cipratan acak. Aksen hanya muncul pada putaran atau gerak terukur dengan confidence cukup; default *off* untuk MVP.
- Setiap kanvas bisa fullscreen sendiri, dengan tampilan bersih. Layout gabungan opsional; **default tetap dua layar terpisah**.

## 4. Input dan landmark

Sumber input: MP4 (prioritas MVP), webcam, kamera HP yang telah terhubung ke SOMA, simulasi, serta demo. Semua memakai **PoseFrameBus** dengan identitas aktor A/B dan timestamp yang sama.

MediaPipe Pose 33 landmarks:
- `0` nose sebagai fallback posisi kepala dengan label estimasi; `7`/`8` telinga untuk midpoint kepala bila keduanya valid.
- `11` bahu kiri, `12` bahu kanan → shoulder center.
- `23`/`24` pinggul kiri/kanan → torso reference jika keduanya tersedia.
- Kaki tetap memakai adapter dan gating V3.5.1 yang ada, tidak membangun jalur deteksi kedua.

**Gating**: landmark wajib finite dan dalam frame, visibility/confidence cukup; minimal 0,60 untuk kedua bahu dan 0,55 untuk kepala. Tanpa identitas aktor stabil, stop/cut kanal terkait. Jangan menggabungkan titik milik A dan B saat crossing. Saat satu bahu hilang, tahan/tutup stroke bahu; jangan mengarang midpoint.

## 5. Peristiwa gerak, bukan efek dekorasi

| Gerak tubuh | Foot Path | Upper Gesture |
|---|---|---|
| Melangkah maju | Footprint + path mengikuti support | Bahu bergerak dengan perpindahan tubuh, stroke relatif lurus |
| Ragu/berhenti | Path berhenti, tinta tetap | Ketiadaan gerak menghasilkan ketiadaan tinta baru |
| Menoleh | Kaki hampir tetap | Kepala menarik lengkung pendek; intensitas boleh diperbesar terbatas |
| Membelok atau memutar torso | Foot path berbelok bila tumpuan berpindah | Shoulder center/tilt membentuk tarikan dan kurva baru |
| Dua aktor melintas | Identitas A/B tidak tertukar | Dua warna boleh bersilangan; stroke masing-masing tetap terpisah |

Gerak kepala dan bahu yang kecil **mungkin tidak menghasilkan loop besar**. Itu hasil yang sah. Untuk mencapai contoh coretan yang lebar, performer harus benar-benar menggerakkan kepala/bahu atau menggunakan kontrol gain yang jelas. Sistem dilarang menambah garis bebas dari noise.

## 6. Navigasi dan kontrol

**Compose → Garis BETA → Dual Trace**. Di atas dua panel terdapat indikator sumber/dua aktor dan tombol `Clear keduanya`.

- Panel kiri: **FOOT PATH** — Footprint 6 detik, bobot path, warna A/B, fullscreen, Clear hanya kaki.
- Panel kanan: **HEAD & SHOULDER** — Head/Bahu toggle, lebar head/bahu, Amplifikasi Gesture, smoothing, warna A/B, fullscreen, Clear hanya gesture.
- Preset `Grounded` (default), `Expressive` (gain lebih besar), `Minimal` (bahu saja). Dua warna tetap per aktor.
- `Split` tetap default; `Combined` di menu sekunder, tidak menggantikan dua view.

## 7. Arsitektur dan batas teknis

Satu frame pose → `PoseFrameBus` → dua adapter independen → tracker kanal → spline → brush → **dua PersistentCanvasStore**. Kanvas 1600×900, white background pada kompositor saja. Store tidak menghapus tinta ketika sumber diganti; saat sumber/seek/identity putus, potong segmen aktif, jangan sambung antarsumber. Simpan batas metadata untuk sesi 30 menit; raster dan memori tidak tumbuh mengikuti jumlah frame.

Source parity harus dilaksanakan sesuai ketersediaan 33 landmarks. Simulator/demo yang hanya punya data kaki **tidak boleh mengarang landmark kepala atau bahu**: tampilkan “Upper Gesture perlu pose tubuh”; gunakan simulator 33 landmark eksplisit bila ingin mendemokan kedua kanvas.

## 8. Acceptance criteria

- [ ] Dua kanvas muncul bersebelahan dengan identitas warna aktor konsisten.
- [ ] MP4 dengan dua orang dan landmark valid menghasilkan Foot Path dan Head/Shoulder dari **frame timestamp yang sama**.
- [ ] Menoleh/bergerak bahu menghasilkan kurva yang mengikuti landmark; saat kepala/bahu diam 10 detik tidak ada tinta tambahan.
- [ ] Crossing tidak menukar aktor atau menyambung stroke lintas identitas.
- [ ] Footprint hilang sekitar 6 detik, semua path/gesture yang disimpan tetap ada; Clear kaki dan Clear gesture independen.
- [ ] Seek, pause, reload source, blackout, fullscreen ditangani tanpa jembatan palsu atau cap berulang.
- [ ] Head vs shoulder tetap bisa dibedakan melalui bobot dan opacity; A vs B terbaca dari warna di kedua kanvas pada thumbnail 320 px.
- [ ] Browser QA MP4 dan satu sumber live, test 20–60 detik, synthetic 30 menit, fallback V3.5.1, serta QA perangkat fisik dicatat secara terpisah.
- [ ] Tidak mengubah kalibrasi Map, F3, feed Resolume/TouchDesigner, ataupun deployment Vercel.

## 9. Prioritas implementasi

**P0 (MVP):** PoseFrameBus → upper landmark adapter (head/shoulder) → dua tracker → dua canvas/preview → kontrol dasar → browser QA.  
**P1:** body-relative decomposition, gain lebih luwes, tangent fibers, playback/export terpisah, Combined preview.  
**P2:** dua output proyektor independen, cue panggung dan kontrol gestur lewat permainan performer.

**Kriteria keputusan artistik:** coretan layar kanan terasa dibangun oleh gerakan kepala/bahu, layar kiri mempertahankan jalan. Pertemuan dua warna boleh membentuk gambar yang kompleks; bentuk tetap bisa ditelusuri kembali ke tubuh pada frame yang sama.