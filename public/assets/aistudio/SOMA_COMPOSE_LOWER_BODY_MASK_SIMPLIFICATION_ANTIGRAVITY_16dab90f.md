# SOMA — Compose Lower-Body Mask Simplification

## Tujuan
Rapikan dan sederhanakan **workspace Compose** khusus untuk kebutuhan tubuh bawah / kaki.
Fokus utama bukan komposisi yang rumit, melainkan **masking sederhana yang langsung berguna untuk pertunjukan**:
- menutup area **dari paha atas ke bawah**,
- bisa dipakai untuk **BODY A** dan **BODY B**,
- cepat dipahami operator,
- bisa langsung dipakai untuk visual panggung seperti **warna solid**, **lighting look**, atau **texture fill**.

Dokumen ini untuk **Antigravity / coding agent** agar mengaudit, merancang, lalu mengimplementasikan perbaikan pada tab **Compose**.

---

## Latar masalah
Compose sekarang terasa terlalu berat dan terlalu "editor". Untuk kebutuhan pertunjukan ini, yang dibutuhkan justru lebih sederhana:

1. Operator ingin cepat membuka Compose.
2. Operator ingin memilih **LEG A**, **LEG B**, atau **SPLIT**.
3. Operator ingin area **kaki / lower body** langsung tertutup mask dengan aman.
4. Operator ingin memilih visual sederhana:
   - warna merah / hijau / biru / putih,
   - gradient / lighting wash,
   - texture,
   - archive/image fill bila perlu.
5. Operator tidak ingin kebingungan dengan terlalu banyak layer, terlalu banyak tulisan, atau terlalu banyak mode.

Dengan kata lain: **Compose harus menjadi “quick lower-body visual composer”, bukan editor komposit yang rumit.**

---

## Konteks artistik
Kebutuhan pertunjukan mengarah pada:
- fokus pada **kaki dan lower body**,
- wajah tidak penting,
- mask cukup sampai **paha atas**,
- visual bisa sangat sederhana seperti **cahaya berwarna**,
- atau bisa sedikit berkembang menjadi **texture / image fill**,
- BODY A dan BODY B sebaiknya bisa dibedakan warna atau treatment-nya.

Contoh treatment yang dibutuhkan:
- **A merah, B biru**
- **A hijau, B merah**
- **dua kaki putih dengan background hitam**
- **texture linen / noise / archive fill di area kaki**
- **satu mode flat lighting**, satu mode **textured lighting**

---

## Masalah UX yang harus diaudit
Agent harus audit Compose saat ini dan jawab dengan bukti:

1. Apakah Compose terlalu banyak tulisan?
2. Apakah terlalu banyak panel yang sebenarnya tidak dibutuhkan untuk workflow panggung?
3. Apakah operator bisa langsung mengerti bedanya:
   - FLOOR
   - LEG A
   - LEG B
   - SPLIT
   - CAM
4. Apakah masking lower body saat ini sudah cukup sederhana dan stabil?
5. Apakah visual untuk kaki bisa dibuat tanpa harus memahami konsep layer yang rumit?
6. Apakah ada kontrol yang dobel / membingungkan / terlalu teknis?
7. Apakah operator bisa membuat hasil yang layak dalam < 1 menit?

---

## Sasaran desain
Rancang ulang Compose agar menjadi **simple lower-body composer**.

### Prinsip utama
1. **Satu tujuan per layar** — Compose dipakai untuk membentuk visual.
2. **Prioritaskan lower body** — bukan seluruh tubuh.
3. **Kurangi panel** — tampilkan hanya yang penting.
4. **Preset dulu, advanced belakangan**.
5. **Langsung terlihat hasilnya di stage monitor**.
6. **Aman untuk pertunjukan** — tidak bikin operator tersesat.

---

## Workflow target yang diinginkan
Workflow ideal untuk Compose:

### 1. Pilih target
Operator memilih salah satu:
- **LEG A**
- **LEG B**
- **SPLIT**

Default yang paling masuk akal:
- jika dua performer aktif → `SPLIT`
- jika hanya satu performer → `LEG A`

### 2. Tentukan mask
Operator cukup memilih salah satu mode mask:
- **Auto Lower Body** — dari paha atas ke bawah
- **Tight Legs** — fokus kaki sampai betis / lutut
- **Wide Lower Body** — paha ke bawah, sedikit longgar
- **Custom** — hanya jika benar-benar perlu

### 3. Pilih look
Operator memilih look sederhana:
- **Solid Color**
- **Gradient / Lighting**
- **Texture Fill**
- **Archive / Image Fill**

### 4. Atur warna / texture
Kontrol minimum:
- color picker / preset color chips,
- opacity,
- brightness,
- blend strength,
- scale texture,
- simple offset jika perlu.

### 5. Simpan / pakai preset
Operator bisa menyimpan preset cepat seperti:
- `A merah / B biru`
- `dua kaki putih`
- `green wash`
- `texture linen`
- `archive black-white`

---

## Struktur UI yang disarankan
Compose sebaiknya disederhanakan jadi **3 area utama** saja.

### A. Top bar sederhana
Isi hanya:
- Judul `Compose`
- Target toggle: `LEG A` / `LEG B` / `SPLIT`
- Tombol `Preset`
- Tombol `Advanced` (opsional)

### B. Stage Monitor besar
Preview utama harus dominan.
Preview harus memperlihatkan:
- area kaki / lower body,
- garis cutoff paha,
- warna atau texture yang aktif,
- perbedaan A dan B,
- hasil split bila dua performer aktif.

### C. Inspector ringkas
Bukan panel panjang. Hanya blok sederhana:

#### 1) Mask
- Auto Lower Body
- Tight Legs
- Wide Lower Body
- Custom
- Feather (simple)

#### 2) Look
- Solid
- Gradient
- Texture
- Image

#### 3) Style
- Color / Tint
- Opacity
- Brightness
- Blend
- Texture Scale

#### 4) Preset
- Save preset
- Apply preset
- Reset

Semua pengaturan teknis yang jarang dipakai jangan langsung muncul. Simpan di **Advanced**.

---

## Visual modes yang wajib ada
Implementasi minimal yang wajib ada:

### Mode 1 — Solid color mask
Mask area kaki diisi warna solid.
Contoh:
- merah,
- hijau,
- biru,
- putih,
- kuning,
- cyan,
- magenta.

### Mode 2 — Lighting wash
Area kaki terlihat seperti terkena cahaya berwarna.
Bukan sekadar fill datar; boleh ada sedikit softness / falloff.
Look-nya terasa seperti lighting panggung sederhana.

### Mode 3 — Texture fill
Isi area kaki dengan texture.
Contoh:
- noise,
- grain,
- linen,
- organic texture,
- archive texture.

### Mode 4 — Image / archive fill
Isi area kaki dengan image / moving archive bila sudah ada.
Tetap jaga agar workflow-nya sederhana.

---

## Preset cepat yang wajib tersedia
Buat preset bawaan berikut:

1. **A Red / B Blue**
2. **A Green / B Magenta**
3. **Both White**
4. **Both Red Wash**
5. **Both Blue Wash**
6. **Texture Linen**
7. **Texture Grain**
8. **Archive B/W Fill**

Preset harus bisa diterapkan cepat tanpa membuka editor panjang.

---

## Aturan masking yang diinginkan
Mask lower body harus mengikuti prinsip ini:

1. **Default cutoff** di paha atas.
2. Area di atas cutoff tidak perlu ikut tampil.
3. Bentuk mask tidak harus super rumit; yang penting stabil.
4. Jika tracking kurang presisi, sistem harus tetap menjaga hasil visual agar tidak terlalu bergetar.
5. BODY A dan BODY B harus tetap terpisah.
6. Saat dua performer crossing, sistem harus sebisa mungkin tetap menjaga pembagian A/B.
7. Jika identitas ambigu, tampilkan status jelas, tapi preview tetap sebersih mungkin.

---

## Simplifikasi yang harus dilakukan
Agent harus menilai dan, bila perlu, menghapus atau memindahkan hal-hal berikut dari Compose utama:

1. Layer editor yang terlalu teknis.
2. Istilah teknis yang tidak membantu operator panggung.
3. Panel media yang terlalu besar jika tidak sedang dipakai.
4. Kontrol yang dobel antara Compose dan Map.
5. Timeline atau event detail yang tidak dibutuhkan untuk quick compose.
6. Mode yang membuat operator bingung saat rehearsal cepat.

Jika fitur tetap penting, pindahkan ke:
- `Advanced`, atau
- drawer sekunder, atau
- halaman khusus lain.

---

## Integrasi dengan Track dan Map
Compose harus tetap terhubung dengan sistem lain:

### Dari Track
Compose menerima:
- BODY A / BODY B,
- lower body mask,
- identity tracking,
- confidence status.

### Dari Map
Compose tidak mengubah kalibrasi panggung.
Compose hanya mengubah tampilan visual.
Semua urusan output fisik / projector QA tetap berada di Map / Perform.

### Ke Perform
Preset Compose yang sudah jadi harus bisa dipanggil sebagai bagian dari cue pertunjukan.

---

## Simulasi yang diharapkan
Jika kamera belum aktif atau latihan sedang dilakukan tanpa performer, Compose harus tetap bisa dipahami lewat simulasi.

Minimal ada:
- preview dua kaki / dua lower body sederhana,
- toggle `A`, `B`, `SPLIT`,
- contoh mask sampai paha,
- contoh warna berbeda,
- contoh texture fill.

Jadi orang langsung kebayang hasilnya walau tracking live belum berjalan.

---

## Acceptance criteria
Perbaikan dianggap berhasil jika:

1. Operator bisa membuka Compose dan paham fungsi utamanya dalam < 10 detik.
2. Operator bisa memilih `LEG A`, `LEG B`, atau `SPLIT` tanpa kebingungan.
3. Operator bisa menerapkan warna solid ke kaki dalam < 20 detik.
4. Operator bisa menerapkan texture fill ke kaki dalam < 30 detik.
5. Mask lower body default terlihat jelas dan cukup stabil.
6. Preview Compose terlihat lebih bersih dibanding versi sekarang.
7. Teks dan panel berkurang signifikan.
8. Preset cepat benar-benar bisa dipakai untuk rehearsal.
9. Compose terasa sebagai alat pertunjukan, bukan editor eksperimen yang rumit.

---

## Tugas untuk Antigravity
Lakukan pekerjaan berikut:

### 1. Audit
- Audit UI/UX Compose saat ini.
- Tandai elemen yang terlalu ramai, terlalu teknis, dan tidak intuitif.
- Jelaskan bagian mana yang dipertahankan, disederhanakan, dipindah, atau dihapus.

### 2. Redesign
- Rancang ulang Compose khusus lower-body composer.
- Sederhanakan struktur tampilan.
- Utamakan stage monitor dan quick controls.

### 3. Implementasi
- Implementasikan mode target `LEG A`, `LEG B`, `SPLIT`.
- Implementasikan mask preset lower body.
- Implementasikan visual modes: solid / wash / texture / image.
- Implementasikan preset cepat.

### 4. Simulasi
- Pastikan preview tetap hidup dalam mode simulasi.
- Tampilkan hasil yang mudah dipahami tanpa kamera.

### 5. QA
Uji:
- satu performer,
- dua performer,
- crossing,
- identity ambiguity,
- preview live,
- texture fill,
- preset switching,
- perform cue handoff.

---

## Deliverables yang diminta
Agent harus menghasilkan:

1. **Audit report**
   - `SOMA_COMPOSE_LOWER_BODY_AUDIT.md`

2. **Implementation plan**
   - `SOMA_COMPOSE_LOWER_BODY_PLAN.md`

3. **Code changes**
   - branch + commit yang jelas

4. **QA report**
   - `SOMA_COMPOSE_LOWER_BODY_QA.md`

5. **Pull Request**
   - PR dengan ringkasan perubahan, screenshot sebelum/sesudah, dan catatan risiko.

---

## Batasan
Jangan lakukan hal berikut:
- jangan menambah jargon teknis yang tidak perlu,
- jangan membuat Compose kembali penuh panel,
- jangan mencampur workflow Map ke Compose,
- jangan membuat output fisik otomatis aktif,
- jangan mempersulit operator pertunjukan.

---

## Ringkasnya
Yang dibutuhkan adalah:

> **Compose yang sederhana, fokus pada kaki / lower body, bisa masking dari paha ke bawah, dan cepat memberi warna atau texture ke kaki performer.**

Bukan editor rumit.
Bukan panel teknis penuh teks.
Bukan workflow yang bikin operator bingung.

Fokus pada:
- cepat,
- jelas,
- visual,
- layak untuk rehearsal dan perform.

