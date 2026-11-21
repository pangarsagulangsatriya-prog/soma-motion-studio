# SOMA Perform — Direct dan Resolume (Stage 1)
Tanggal audit: 21 November 2026.

## Kontrak dua keluaran
- **SOMA Direct:** Track/MP4/3D → Compose → Map → jendela FLOOR/BODY → fullscreen (F) di layar proyektor. Membuka popup memulai **Blackout**. Menyalakan LIVE membutuhkan persetujuan operator, pengujian nyata lima titik Map, dan syarat build yang aktif.
- **Resolume:** Track/MP4/3D → Compose → **Clean Feed** FLOOR/BODY 16:9 → **OBS Window Capture** → plugin output **Syphon (Mac)** atau **Spout (Windows)** → Resolume Sources → clip/layer → Resolume Advanced Output ke proyektor. Warp/brightness dari Map SOMA tidak dibakar ke Clean Feed.

**Penting:** GitHub Pages berjalan di browser; web page tidak mendaftar sendiri sebagai sender Syphon atau Spout. OBS + plugin lokal menjalankan fungsi sender tersebut. Tombol di SOMA hanya memastikan frame sampai **popup feed**, belum memeriksa apakah Resolume menangkap sumber.

## SOP Mac: SOMA → OBS → Syphon → Resolume
1. Instal OBS Studio serta [obs-syphon-plugin](https://github.com/ryrotella/obs-syphon-plugin) (lihat petunjuk versi/kompatibilitas di repositori plugin). Opsi yang disediakan proyek: Homebrew tap dan instalasi plugin.
2. Di SOMA: Track pilih kamera/HP/MP4/3D → Compose → Perform → Resolume → **Buka Feed FLOOR**. Jendela baru bertajuk `SOMA / RESOLUME FEED · FLOOR`. Pastikan Feed SOMA aktif; lihat jejak yang bergerak. Untuk BODY, gunakan Buka Feed BODY di Pengaturan.
3. Di OBS: tambahkan **macOS Screen Capture** dengan metode Window Capture bila tersedia; pilih jendela Chrome **SOMA / RESOLUME FEED · FLOOR**. Atur canvas output OBS ke 1280×720 atau 1920×1080 sesuai kebutuhan. Hindari capture bilah alamat/tab jika memungkinkan.
4. Untuk satu sender, hidupkan `Tools → Syphon Output`; untuk sumber FLOOR/BODY terpisah, gunakan **Syphon Filter** pada masing-masing sumber di OBS (tersedia di plugin). Beri nama `SOMA FLOOR` dan `SOMA BODY` di sender bila plugin memungkinkan.
5. Di Resolume: buka **Sources → Syphon**, pilih sender OBS, drag ke clip. Uji satu langkah dan pastikan frame bergerak. Mapping proyektor dilakukan melalui Advanced Output Resolume.

## SOP Windows: SOMA → OBS → Spout → Resolume
1. Instal OBS dan [obs-spout2-plugin](https://github.com/Off-World-Live/obs-spout2-plugin). Cocokkan installer plugin dengan versi OBS.
2. SOMA → Perform → Resolume → Buka Feed FLOOR/BODY. Di OBS, gunakan **Window Capture** untuk masing-masing popup SOMA yang benar (bukan OBS Browser Source).
3. Aktifkan keluaran **Spout2** OBS; gunakan Spout Filter/Output yang disediakan versi plugin untuk menyajikan FLOOR/BODY bila diperlukan.
4. Di Resolume: **Sources → Spout**, pilih sender OBS dan tempatkan pada clip/layer. Routing proyektor di Advanced Output.

## Uji penerimaan — langkah minimal
1. **Sumber**: pilih MP4 atau Simulasi 3D, munculkan jejak kaki/kontak yang jelas di Compose.
2. **SOMA feed**: popup terbuka dengan `feed=resolume&stageSurface=floor`; raster terlihat, bukan hitam. Status **Feed SOMA aktif** berarti pengiriman frame ke popup sudah mendapat ACK.
3. **OBS**: pastikan Window Capture memperlihatkan jejak aktif, tanpa menu, tab browser, atau kursor. Preview OBS bergerak selama SOMA berjalan.
4. **Resolume**: sumber Syphon/Spout muncul di Sources, clip memperlihatkan jejak. Uji FLOOR dan BODY secara terpisah sebelum menggabungkan.
5. **Blackout**: tekan Blackout SOMA. Popup harus gelap. OBS/Resolume dapat menyimpan frame terakhir atau menerapkan blending; operator wajib menguji pemadaman pada rantai akhir.
6. **Pindah jalur**: SOMA Direct ↔ Resolume harus memadamkan dan menutup popup jalur sebelumnya sebelum membuat sesi baru.

## Kesalahan umum
- **OBS Browser Source dengan URL `bodyProjection`**: tidak bekerja secara mandiri. Popup SOMA memerlukan hubungan `window.opener` dan `BroadcastChannel` dari browser operator. Pakai **Window Capture** pada popup yang dibuka SOMA.
- **SOMA status Feed SOMA aktif, OBS kosong**: sumber Window Capture salah, popup tertutup/tersembunyi, izin Screen Recording macOS belum diberikan, atau OBS menangkap monitor yang berbeda.
- **OBS bergerak, Resolume kosong**: plugin Syphon/Spout belum mengirim, sender belum dipilih pada Sources Resolume, atau clip/layer belum diputar.
- **Hanya layar hitam**: periksa HOLD/Blackout, kesiapan MP4 dan kontak kaki, status ACK popup, dan izin pemakaian layar.
- **Kualitas rendah atau FPS turun**: gunakan resolusi output 720p dahulu; cek GPU OBS, FPS Source, beban inferensi pose, dan frame timing. Target 30 fps belum menggantikan uji FPS nyata.

## Batas kemampuan
- Mode Resolume saat ini memakai **OBS sebagai bridge lokal**. Belum ada executable SOMA native sender yang menerbitkan Syphon/Spout sendiri.
- UI SOMA tidak bisa mengonfirmasi penerimaan visual oleh Resolume; verifikasi dilakukan di Resolume.
- Untuk dua feed simultan, periksa dukungan output/filter per-sumber OBS plugin yang terpasang sebelum pertunjukan.

Sumber resmi: [Resolume Syphon & Spout](https://resolume.com/support/en/syphonspout), [OBS Syphon macOS](https://github.com/ryrotella/obs-syphon-plugin), [OBS Spout Windows](https://github.com/Off-World-Live/obs-spout2-plugin).
