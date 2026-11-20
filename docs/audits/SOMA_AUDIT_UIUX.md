# SOMA — Audit UI/UX, Kepadatan Informasi & Keputusan Elemen

## Ringkasan Eksekutif

Inspeksi visual dan interaksi dilakukan langsung pada aplikasi berjalan (`http://localhost:3000`) di desktop **`1440×900`** dan mobile **`390×844`** untuk keempat workspace (`Track`, `Compose`, `Map`, `Perform`) serta jendela `ProjectionOutput`.

| Workspace | Tinggi Dokumen (`1440×900`) | Tombol Terlihat | Input Terlihat | Jumlah Kata | Tombol Blackout | Status Hierarki |
|---|---:|---:|---:|---:|---:|---|
| **Track (kosong)** | `900 px` | 11 | 0 | 40 | 1 | **BAIK** — fokus bersih, kanvas dominan |
| **Track (Simulasi 3D)** | `900 px` | 14 | 1 | 62 | 1 | **BAIK** — kontrol ringkas di sidebar kiri |
| **Compose (FLOOR)** | `1,162 px` | 44 | 6 | 99 | 1 | **PERLU PERBAIKAN** — default membuka `INPUT`, Demo menimpa Track, toast palsu |
| **Map** | `2,925 px` | 34 | 31 | 602 | **4** | **BURUK** — 3.25× tinggi layar, 602 kata, Four-Corner Editor terkubur di `y > 1300px` |
| **Perform** | `1,234 px` | 26 | 2 | 202 | **2** | **BURUK** — monitor panggung terpotong di `y = 855px`, enum mentah (`simulator`), Resume terkunci |
| **ProjectionOutput** | `720 px` | 0 | 0 | 0 | 0 | **SANGAT BAIK** — output bersih bebas chrome |

---

## 1. Evaluasi Struktur Navigasi (3 vs 4 Workspace)

Prinsip audit meminta evaluasi: apakah **Compose → Map → Perform** (3 tab dengan Tracking di dalam Compose) atau **Track → Compose → Map → Perform** (4 tab lokal di Stage 1) yang paling ringkas untuk operator panggung?

**Keputusan Audit: PERTAHANKAN 4 tab lokal Stage 1 (`Track → Compose → Map → Perform`) dengan transisi tanpa blackout, DAN ciutkan sidebar global default ke rail ikon tipis (`64px`).**
- **Alasan berbasis bukti:**
  1. `Track` saat ini adalah layar terbersih di seluruh aplikasi (`900px` pas layar, 40 kata, 11 tombol) dan memiliki tugas khusus yang berat: pemilihan kamera/HP QR pairing/MP4 upload/Simulasi 3D + kalibrasi 4-titik kamera + verifikasi skeleton A/B.
  2. Menggabungkan seluruh kontrol Track (WebRTC QR pairing, pemutar MP4 + scrubber, kontrol langkah 3D, skeleton A/B) ke dalam `Compose` akan menghancurkan ruang kanvas Compose dan mengembalikan kepadatan tinggi.
  3. Masalah terbesar navigasi saat ini BUKAN jumlah tab (4 tab di satu baris sudah sangat ringkas), melainkan **efek samping perpindahan tab** (memadamkan proyektor, meng-unmount Map/Output, memunculkan toast palsu) serta **sidebar kiri 220px** yang kosong melompong hanya berisi 2 tombol (`Stage 1` dan `Tools`).

---

## 2. Matriks Keputusan Elemen (KEEP / MERGE / MOVE / COLLAPSE / RENAME / REMOVE)

| Area | Elemen Saat Ini | Keputusan | Alasan |
|---|---|---|---|
| **Global Header** | `SOURCE: Simulasi 3D` · `Simulasi` · `Output terkunci` (3 kotak pill/chip campuran EN/ID) | **MERGE & RENAME** | Gabungkan menjadi strip status teks bersih tanpa kotak berlebihan dalam 1 bahasa: `Sumber: Simulasi 3D · Tracking: Simulasi · Output: Terkunci`. |
| **Global Header** | Tombol `Blackout` | **KEEP** | Satu-satunya tombol Blackout darurat permanen yang konsisten di seluruh workspace. |
| **Global Sidebar** | Rail kiri terbuka `220px` secara default hanya untuk 2 item (`Stage 1`, `Tools`) | **COLLAPSE** | Default diciutkan menjadi rail `64px` (tetap bisa diperluas) agar panggung mendapat tambahan lebar `+156px` langsung saat dibuka. |
| **Toast Global** | `"Footprints dipilih. Hubungkan kamera Body agar gerak kaki terbaca."` saat pindah tab Stage 1 | **REMOVE** | Toast palsu yang menutupi kanvas Compose, Map, Perform, dan Mobile 390px padahal sudah berada di Footprints / Simulasi 3D. |
| **Track** | Dropdown `Sumber` (Webcam, HP, MP4, Simulasi 3D) + kanvas + skeleton toggle | **KEEP** | Sudah sangat bersih dan dominan. Tambahkan tombol cepat `Reset A/B` hanya saat status identitas ambigu. |
| **Compose** | Judul `Composer` vs Tab `Compose` | **RENAME** | Samakan menjadi `Compose` agar tidak ada dua istilah berbeda untuk layar yang sama. |
| **Compose** | Default `previewArrangement = 'input'` pada Simulasi 3D/MP4 | **REMOVE (ubah default)** | Default langsung ke `FLOOR` agar operator langsung melihat hasil visual komposisi. |
| **Compose** | Default `liquidMode = 'demo'` menimpa pijakan Track/Simulasi | **RENAME & FIX** | Otomatis gunakan `Track` ketika ada sumber gerak aktif; beri label eksplisit `Demo (sintetis)` bila mode demo dipilih. |
| **Compose** | Bar `Preview ☑ | ▶ Display` terpisah + `s64-runtime-status` berulang | **MERGE** | Satukan ringkas di header Stage Monitor sehingga kanvas naik lebih tinggi dan muat di `1440×900`. |
| **Map** | Heading mekanis `04 / DUAL-SURFACE OUTPUT ROUTING` + paragraf 3 baris | **REMOVE / RENAME** | Ganti dengan header tenang `Map — Kalibrasi & Output` tanpa nomor kode internal. |
| **Map** | 3 tombol Blackout lokal (`BLACKOUT KEDUA OUTPUT`, BODY `Blackout`, FLOOR `Blackout`) di luar Blackout global | **REMOVE / MERGE** | Sisakan 1 tombol Blackout darurat otoritatif di Global Header; kartu BODY/FLOOR cukup menampilkan tombol `Buka Output`, `Uji Pola`, `Live` / `Hentikan`. |
| **Map** | Tumpukan vertikal 2,925px (`SAFE PERFORM`, `Uji setup`, `Profil`, `BODY/FLOOR`, `WYSIWYG`, lalu `Four-Corner Editor` di bawah) | **MOVE & COLLAPSE** | Pindahkan **WYSIWYG + Four-Corner Editor** ke bagian atas (kolom kiri utama); letakkan kontrol Output & Profil di kolom kanan; lipat **QA 5-Titik** dan **Uji Setup 10 Menit** dalam `<details>` rapi. |
| **Perform** | Header `FOOTPRINTS / PERFORM · LOCAL MONITOR` + `Kembali Build` | **RENAME** | Ganti menjadi `Perform` + `Edit Compose` (hilangkan istilah lama "Build"). |
| **Perform** | Kartu status `ACTIVE SOURCE: simulator`, `HARDWARE: OFFLINE BODY · OFFLINE FLOOR` | **RENAME & MERGE** | Terjemahkan label manusiawi (`Simulasi 3D`, `Webcam`, `Video MP4`, `Kamera HP`; `Output Offline / Terhubung`) dan ringkas agar tidak mendorong panggung ke bawah fold. |
| **Perform** | Tombol `BLACKOUT` besar kedua di dock Perform | **MERGE / KEEP (terkoordinasi)** | Dock Perform fokus pada aksi pertunjukan (`Sebelumnya`, `GO`, `Hold / Resume`, `Rekam`), sementara `Blackout` global selalu di kanan atas + shortcut `B` / `Esc`. |
| **Perform** | Monitor panggung berada di bawah `OperatorStageConsole` (`y = 855px`) | **MOVE** | Ubah Perform menjadi grid 2-kolom di desktop: **Monitor Panggung dominan di kiri**, **Cue Grid 8-slot + Transport GO/Hold di kanan** — seluruhnya terlihat utuh di `1440×900`. |

---

## 3. Konsistensi Terminologi Produk

| Konsep | Istilah Lama yang Bertabrakan | Istilah Standar Baru |
|---|---|---|
| Workspace 1–4 | Track / Tracking, Compose / Composer / Build, Map / Mapping / Dual-Surface Routing, Perform / Operator Mode | **Track**, **Compose**, **Map**, **Perform** |
| Sumber input | `SOURCE: simulator`, `Webcam laptop`, `Kamera Body`, `Sumber gerak` | **Sumber**: `Webcam`, `Kamera HP`, `Video MP4`, `Simulasi 3D` |
| Status tracking | `Belum terhubung`, `Kamera mati`, `Tracking belum aktif`, `Menunggu pose valid` | `Belum terhubung`, `Menghubungkan`, `Tracking aktif`, `Tracking hilang`, `Simulasi aktif`, `Error` |
| Status output | `Output terkunci`, `OFFLINE BODY · OFFLINE FLOOR`, `BLACKOUT`, `QA diperlukan` | `Output offline`, `Preview software`, `QA diperlukan`, `Siap Live`, `Live`, `Blackout` |
| Aksi utama | `Buka output`, `PERFORM · FLOOR`, `Kembali Build`, `BLACKOUT KEDUA OUTPUT` | `Pilih sumber`, `Kalibrasi`, `Buka output`, `Proyeksikan`, `Blackout`, `Pulihkan` |

---

## 4. Wireframe Informasi Target (`1440×900`)

### Global Chrome (Konsisten di Semua Workspace)
```text
+----+--------------------------------------------------------------------------------+
| [=]| SOMA · Stage 1   | Sumber: Simulasi 3D · Tracking: Aktif · Output: Preview | [Blackout] [?]
+----+--------------------------------------------------------------------------------+
| S1 | [ Track ]  [ Compose ]  [ Map ]  [ Perform ]                                   |
|    | ------------------------------------------------------------------------------ |
|    |                                                                                |
| Tl |                       < ACTIVE WORKSPACE >                                     |
+----+--------------------------------------------------------------------------------+
```

### Compose (Stage-First, 2-Kolom)
```text
+--------------------------------------------------+----------------------------------+
| Stage Monitor  [FLOOR*] [BODY A] [BODY B] [SPLIT]| Material: Liquid Imprint  [Aktif]|
|                                                  | Sumber: [Track*] [Demo]          |
|              CANVAS DOMINAN (16:9)               | Aliran: ──────●── 76%            |
|        (Jejak nyata + Liquid Imprint)            | -------------------------------- |
|                                                  | [Material] [Layer] [Objek]       |
| ▶ Timeline (event)  |  ▶ Layer (1)  | ▶ Media    |                                  |
+--------------------------------------------------+----------------------------------+
```

### Map (Kalibrasi Di Atas Fold, 2-Kolom)
```text
+--------------------------------------------------+----------------------------------+
| Bidang: [FLOOR*] [BODY]  | Preview: [Draf][Kirim]| Status Layar & Output            |
|                                                  | [x] Konfirmasi keamanan operator |
|   [ WYSIWYG Preview ]   [ Four-Corner Editor ]   | FLOOR: [Buka output] [Uji] [Live]|
|   (Transformasi aktif)  (Drag 4 titik sudut)     | BODY : [Buka output] [Uji] [Live]|
|                                                  | -------------------------------- |
| Kecerahan [──●──] 38%  | Resolusi [720p v]       | ▶ Profil Proyektor Tersimpan     |
|                                                  | ▶ QA Fisik 5 Titik (0/5)         |
|                                                  | ▶ Uji Setup (<10 mnt) & Presisi  |
+--------------------------------------------------+----------------------------------+
```

### Perform (Monitor + Cue Grid Berdampingan Di Atas Fold)
```text
+--------------------------------------------------+----------------------------------+
| Stage Monitor (Aktif & Utuh Di Atas Fold)        | Perform · Cue 01 / 08  [Compose] |
|                                                  | Sumber: Simulasi 3D · Output: Off|
|                                                  | [01][02][03][04]                 |
|              PREVIEW PANGGUNG                    | [05][06][07][08]                 |
|             (Tidak terpotong!)                   | ▶ Edit Cue 01                    |
|                                                  | -------------------------------- |
|                                                  | [←] [ GO · Cue Berikutnya → ]    |
|                                                  | [Hold / Resume]  [Rekam]         |
+--------------------------------------------------+----------------------------------+
```

---

## 5. Perilaku State & Aksesibilitas

| State | Perilaku yang Diharuskan |
|---|---|
| **Kosong (belum ada sumber)** | Track menampilkan satu dropdown `Pilih sumber` & area kanvas bersih tanpa error palsu. |
| **Loading / Izin Kamera** | Spinner halus, tombol `Menghubungkan…` disabled, pesan izin kamera 1-baris yang actionable bila ditolak. |
| **Tracking Aktif / Hilang** | Indikator warna + teks eksplisit (bukan warna saja). Bila A/B ambigu, tampilkan peringatan + tombol `Reset A/B` 1-klik. |
| **Blackout** | Satu klik `Blackout` (atau `B`/`Esc` di Perform) mengirim blackout ke seluruh output fisik + software tanpa membekukan UI operator. |
| **Keyboard & Mobile (`390×844`)** | Target klik ≥44px pada kontrol utama mobile, urutan Tab logis, `focus-visible` jelas, 0 horizontal overflow, tanpa toast yang menutupi kanvas utama. |
