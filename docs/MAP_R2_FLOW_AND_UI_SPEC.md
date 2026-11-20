# SOMA MAP-R2 — Alur 3 Langkah, Spesifikasi UI & Copy Final

- **Tanggal:** 2026-11-20
- **Mental Model:** **1 Pilih → 2 Cocokkan → 3 Uji** (Map menempatkan hasil Compose ke panggung nyata dan menguji keamanan proyektor — bukan editor komposisi).

---

## 1. Diagram Alur 1 Halaman

```text
[Track: Kamera / Video / Simulasi 3D] ──▶ [Compose: Visual Lantai & Mask Tubuh]
                                                    │
                                                    ▼
                    ┌───────────────────────────────────────────────────┐
                    │                  WORKSPACE MAP                    │
                    │  Header: Map · [Lantai | Tubuh] · Status · [BO]   │
                    ├──────────────────────────────┬────────────────────┤
                    │     STAGE MAP MONITOR        │ 1. Pilih           │
                    │  • Panggung (default):       │    Lantai / Tubuh  │
                    │    lantai 5×5m, A/B, jejak,  │    Ukuran panggung │
                    │    mask tubuh, handle ①–④    │                    │
                    │  • Kamera: feed + pose/quad  │ 2. Cocokkan        │
                    │  • Hasil: WYSIWYG output     │    Atur sudut      │
                    │  • Split: Panggung | Hasil   │    Snap · Undo     │
                    │                              │    Reset · Kal.Kam │
                    │  Empty state:                │                    │
                    │   [Gunakan simulasi]         │ 3. Uji & Simpan    │
                    │                              │    Uji proyektor   │
                    │                              │    QA Fisik 5/5    │
                    │                              │    Simpan profil   │
                    │                              │                    │
                    │                              │ ▸ Advanced (tutup) │
                    ├──────────────────────────────┴────────────────────┤
                    │ Status / Blocker 1 baris            [Ke Perform →]│
                    └───────────────────────────────────────────────────┘
                                                    │
                                    (Handoff aman tanpa test grid)
                                                    ▼
                                            [Perform Console]
```

---

## 2. State Machine Status Dominan (4 Status)

| State ID | Label Dominan | Kondisi | Blocker 1 Baris (Contoh) | `Ke Perform` |
|---|---|---|---|---|
| `uncalibrated` | **Belum dikalibrasi** | Tidak ada kamera terkalibrasi lantai dan bukan simulasi aktif, atau quad belum valid | `Hubungkan kamera & kalibrasi lantai di Track, atau jalankan simulasi.` | Terbuka untuk latihan software (warning terkunci untuk proyektor fisik) |
| `ready-to-test` | **Siap diuji** | Sumber aktif (kamera terkalibrasi / simulasi / video) dan quad valid, namun belum dilakukan uji proyektor / output belum terhubung | `Buka jendela proyektor dan jalankan pola uji untuk memeriksa posisi.` | Terbuka dengan keterangan output fisik masih terkunci |
| `needs-physical-qa` | **Perlu QA fisik** | Jendela proyektor terhubung atau sedang uji optik, namun QA fisik 5 titik / checklist keselamatan belum lulus | `Lengkapi QA fisik 5 titik (N/5) dan uji Blackout sebelum LIVE.` | Terbuka namun LIVE fisik tetap terkunci sampai QA 5/5 lulus |
| `ready-perform` | **Siap Perform** | Kamera terkalibrasi + izin operator + jendela proyektor terhubung + QA 5/5 `within-provisional-target` | `Kalibrasi & QA fisik tercatat. Periksa area cahaya sebelum masuk Perform.` | Siap masuk Perform |

---

## 3. Tata Letak Desktop vs Tablet vs Mobile

- **Desktop (`1440×900`) & Laptop (`1280×800`):**
  - Grid 2 kolom (`minmax(0, 1.5fr) minmax(320px, 390px)`), monitor dominan di kiri, panel 3-langkah ringkas di kanan, footer status + `[Ke Perform]` di bawah.
- **Tablet (`768×1024`) & Mobile (`390×844`):**
  - Satu kolom vertikal: **Stage Map Monitor selalu pertama**, diikuti switcher tampilan `[Panggung | Kamera | Hasil | Split]`, lalu panel 3 langkah ringkas dan drawer `Advanced` yang tertutup.
  - Tombol `Blackout` tetap terlihat di header Map (dan header global).

---

## 4. Copy Final Setiap Kontrol (Layar Utama)

| Zona | Kontrol | Copy Final | Keterangan |
|---|---|---|---|
| Header Map | Judul | `Map` | Satu judul saja, tanpa sub-judul duplikat. |
| Header Map | Pemilih permukaan | `Lantai` · `Tubuh` | Mengatur `selected` (`floor` / `body`). |
| Header Map | Sumber & Status | `Sumber: Kamera / Video / Simulasi` · `<Status Dominan>` | Unboxed clean typography (`·` separator), zero pill clutter. |
| Header Map | Keselamatan | `Blackout` | Selalu aktif, langsung memadamkan output `BODY` & `FLOOR`. |
| Monitor | Mode tampilan | `Panggung` · `Kamera` · `Hasil Proyektor` · `Split` | Default `Panggung`. |
| Monitor | Empty state | `Belum ada kamera aktif — coba pratinjau panggung virtual.` + CTA `Gunakan simulasi` | Non-blocking; panggung contoh tetap terlihat di belakangnya. |
| Step 1 | Pilih permukaan | `1. Pilih` — `Lantai` / `Tubuh`, preset ukuran `5 × 5 m` (dapat diubah) | Menjelaskan `Tubuh` menggabungkan A & B ke satu output BODY. |
| Step 2 | Cocokkan | `2. Cocokkan` — `Atur sudut`, `Snap`, `Undo`, `Redo`, `Reset`, dan (jika kamera belum terkalibrasi) `Kalibrasi kamera` | Instruksi 1 baris: `Seret sudut 1–4 pada panggung atau gunakan tombol panah.` |
| Step 3 | Uji & Simpan | `3. Uji` — `Uji proyektor`, checkbox izin operator, `QA Fisik 5 Titik`, `Simpan profil` | Detail dual-window, kecerahan, resolusi, `SOURCE/PROJECTOR`, grid 3×3, angka numerik, dan timer UAT masuk `Advanced`. |
| Footer | Handoff | Status 1 baris + tombol `Ke Perform` | Membawa state aktif ke Perform tanpa test grid tertinggal. |
