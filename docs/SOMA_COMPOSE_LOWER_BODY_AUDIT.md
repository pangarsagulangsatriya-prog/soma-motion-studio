# SOMA Compose Lower-Body, Camera Wide Default & Perform Resolume Feed Audit

## 1. Masalah yang Ditemukan Sebelum Perbaikan
1. **Compose belum menempatkan `FLOOR` di urutan pertama dan belum menyediakan view `FOOT` & `SKELETON` khusus**:
   - Mode `BODY A` / `BODY B` sebelumnya menampilkan kontrol teknis *Layer / Object / Blend / Alpha / Transform / Leg Calibration* secara terbuka di panel kanan, membuat eksplorasi cepat warna, lighting wash, dan tekstur paha-ke-bawah terasa terlalu teknis bagi operator panggung.
   - Belum ada tampilan **`FOOT`** (closeup telapak/pergelangan & kontak lantai) maupun **`SKELETON`** (tampilan vektor kerangka murni + `UPPER THIGH CUTOFF` + confidence readout tanpa clutter video).
   - Urutan tab monitor harus selalu dimulai dari **`FLOOR`** (`FLOOR | LEG A | LEG B | SPLIT | FOOT | SKELETON`).
2. **Kamera default sebelumnya masih mengizinkan orientasi 480p / potret di perangkat mobile**:
   - `ProjectionWorkspace` & `tracking.ts` sebelumnya default ke `'480p'` (640×480) dan `PhoneCameraSender` / `AutomaticPhoneSender` belum memaksa `aspectRatio: { ideal: 16/9 }` + `1280×720` horizontal wide + `screen.orientation.lock('landscape')`.
3. **Perform belum menyediakan pilihan eksplisit `SOMA Direct` vs `Feed Resolume`**:
   - Operator live stage sering memilih antara proyeksi langsung dari SOMA atau mengirim *clean black 16:9 feed* (Luma Key / Add) ke **Resolume Arena** (melalui Window Capture / Browser Source / OBS / Spout / Syphon) dengan tetap menjaga **BLACKOUT [B]** global.

## 2. Standar Benchmark Produk Serupa
- **Resolume Arena / MadMapper**: kontrol visual langsung di permukaan (*target -> mask -> look -> style -> quick presets*), parameter lanjutan disembunyikan dalam drawer *Advanced*, serta output *clean feed* berlatar hitam murni 16:9 siap compositing.
- **TouchDesigner / Notch Orthographic Stage Monitor**: grid gelap kontras terukur, garis panduan `UPPER THIGH CUTOFF`, indikator confidence `A / B`, serta strip `EVENT TEST` (`STEP L`, `STEP R`, `SLIDE`, `PIVOT`, `CROSSING`, `RESET`) untuk verifikasi perilaku kaki sebelum penari naik panggung.
