# SOMA MAP-R2 — Benchmark Produk Mapping & Keputusan Desain

- **Tanggal:** 2026-11-20
- **Fokus:** Simplifikasi UX mapping panggung, simulasi visual panggung, koherensi preview–output, dan keamanan proyektor.

---

## 1. Matriks Benchmark Produk Referensi

| Dimensi | **Resolume Arena (Advanced Output)** | **MadMapper (Surfaces)** | **TouchDesigner (Kantan Mapper)** | **MapMap (Open-Source)** | **SOMA MAP-R2 (Adopsi / Tolak)** |
|---|---|---|---|---|---|
| **Pemisahan Input vs Output** | Memisahkan tab *Input Selection* (crop sumber) dan *Output Transformation* (warp proyektor) dalam satu dialog Advanced Output. | Memisahkan *Input* dan *Output* quad per surface, tetapi pengguna memanipulasi langsung di kanvas output. | Memisahkan kanvas 2D masking/polygon dari jaringan node TOP. | Memisahkan *Source* dan *Destination* quad side-by-side secara sederhana. | **ADOPSI (di engine):** Pertahankan `sourceQuad` vs `projectorQuad` terpisah di `StageSurfacePlan`, dan pertahankan `camera→floor` terpisah dari `floor→projector`. **TOLAK (di default UI):** Jangan paksa operator melihat dua panel teknis sekaligus; default fokus ke target proyeksi dengan `Source Quad` & angka presisi di `Advanced`. |
| **Manipulasi Visual di Kanvas** | Handle sudut + bezier + slice list di kiri. | Klik surface langsung di kanvas, drag handle dengan feedback visual instan + test card built-in. | Gambar polygon/mask langsung di atas visual sumber. | Drag 4 sudut langsung dengan garis grid. | **ADOPSI:** Satu **Stage Map Monitor** besar yang menampilkan lantai perspektif, performer A/B, jejak kaki dari Compose, mask tubuh, batas proyeksi, dan handle `①–④` yang bisa langsung di-drag + snap + undo/redo + keyboard nudge. |
| **Jumlah Klik Tahap Pertama (Operator Baru)** | ~6–8 klik (Output → Advanced → pilih screen → pilih slice → Input/Output tab → Save). | ~3–4 klik (Pilih surface → aktifkan Test Pattern → drag sudut → selesai). | ~5–7 klik (Buka Kantan → buat shape → pilih texture → edit mask). | ~3 klik (Pilih mapping → drag sudut → output). | **TARGET SOMA:** **3 langkah linier (`1 Pilih → 2 Cocokkan → 3 Uji`)** tanpa membuka `Advanced`. |
| **Istilah UI** | Sangat teknis (*Slice, Input Selection, Soft Edge, Screen Routing*). | Cukup visual (*Surface, Quad, Test Pattern*). | Sangat teknis (*TOP, COMP, Keystoning*). | Sederhana (*Source, Destination, Mesh*). | **ADOPSI BAHASA PANGGUNG:** `Lantai`, `Tubuh`, `Atur sudut`, `Uji proyektor`, `Simpan profil`, `Ke Perform`. Singkirkan `SOURCE UV / DESTINATION QUAD` dari layar default. |
| **Hubungan Preview–Output** | Output langsung mengikuti transform slice. | Output realtime mengikuti manipulasi surface. | Output mengikuti TOP render akhir. | Preview kanvas langsung merefleksikan quad. | **ADOPSI + GUARD KEAMANAN:** Stage Map Monitor memakai `sourceQuad`/`projectorQuad` & `artworkTransform` yang sama dengan jendela output, tetapi setiap edit quad **wajib memicu Blackout & invalidasi QA fisik** demi keselamatan mata/panggung. |
| **Empty State & Simulasi** | Kanvas kosong jika layer tidak dipicu. | Test pattern dapat dinyalakan tanpa konten live. | Kosong jika TOP input belum tersambung. | Membutuhkan media file dulu. | **KEUNGGULAN SOMA:** Jika kamera belum aktif, tampilkan **panggung simulasi 2 performer A/B** dengan satu CTA **`Gunakan simulasi`** (berlabel jelas `SIMULASI`, bukan live camera). |

---

## 2. Keputusan Adopsi vs Penolakan untuk SOMA

### Diadopsi
1. **Satu Mental Model 3 Langkah (`Pilih → Cocokkan → Uji`)** — terinspirasi kesederhanaan MadMapper & MapMap tanpa mengorbankan pemisahan koordinat Resolume di engine.
2. **Direct Canvas Manipulation + Alignment Overlays** — drag handle `①–④` langsung di atas monitor panggung dengan opsi Snap, Undo/Redo, keyboard arrow nudge (`Shift` untuk langkah besar), dan test grid proyektor.
3. **Progressive Disclosure (`Advanced`)** — seluruh kontrol teknis (`SOURCE / PROJECTOR` switch, input numerik X/Y, kecerahan, resolusi 720p/1080p, grid homografi 3×3, panel dual-window lengkap, dan stopwatch UAT) dipindahkan ke satu drawer `Advanced` yang tertutup secara default.
4. **Honest Preview Parity** — switcher 4 tampilan (`Panggung`, `Kamera`, `Hasil Proyektor`, `Split`) memisahkan simulasi panggung dari sinyal proyektor aktual (`Draf lokal` vs `Sinyal dikirim`), tanpa pernah mengklaim akurasi foton fisik dari browser.

### Ditolak
1. **Multi-monitor 3–4 panel hidup bersamaan** — membebani GPU/CPU dan memecah fokus operator; `Split` bersifat opsional (maksimal 2 pandangan: Panggung vs Hasil Proyektor).
2. **Menyalin hirarki slice/screen kompleks ala Resolume** — SOMA Stage 1 memiliki tepat dua jalur output (`FLOOR` untuk lantai, `BODY` untuk performer A/B bermasker dalam satu output BODY), sehingga pemilih dua permukaan (`Lantai` / `Tubuh`) jauh lebih tepat.
3. **Auto-live tanpa QA fisik** — berbeda dari VJ tool biasa, SOMA memproyeksikan cahaya ke lantai dan tubuh manusia sehingga gerbang Blackout + QA 5 titik manual tetap wajib tidak dapat dilewati.
