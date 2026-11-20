# CAM-00–05 · Universal Camera Connect — implementasi beta GitHub Pages

Basis: `main` SOMA pada 9cd3b2bf. Rilis awal: GitHub Pages saja; **Vercel tidak disentuh**.

## CAM-00 · Audit
SOMA sudah mempunyai satu `CameraTracker` dalam `src/App.tsx`, dan menerima `MediaStream`
baik dari webcam maupun dari kamera HP. Sebelumnya pengambil kamera eksternal berada di
`UsbPhoneCameraReceiver.tsx` dan bernama khusus HP meskipun memindai semua `videoinput`.
Pergantian kamera sudah memanggil blackout, reset identitas A/B, serta revoke kalibrasi Map.
Browser QA lama pada baseline sebagian masih gagal; kegagalan tersebut terpisah dari suite CAM.
Unit dan build wajib tetap hijau sebelum publikasi.

## CAM-01 · Universal local camera registry
`src/engine/universalCamera.ts` memfilter dan mendeduplikasi `videoinput` OS/browser,
menangani nama tersembunyi sebelum izin, urutan kamera, dan profil HD / SD / compatible.
Browser **tidak membuktikan jenis kabel**, jadi label bersumber dari nama perangkat OS.
Daftar kamera memperbarui diri lewat `devicechange`, dan dapat dimuat ulang manual.

## CAM-02 · Satu kamera aktif + satu tracking engine
`Track → Hubungkan kamera → Semua kamera` membuka kamera lokal terpilih sebagai `MediaStream`.
Kamera masuk ke `startPhoneCamera` yang sudah dipakai WebRTC HP, melalui
`createLandscapePhoneCamera` (frame 1280×720) lalu `CameraTracker` existing.
Semua stream lama berhenti saat memilih ulang; callback async dibatasi generation token.
Fallback HD→SD→compatible hanya saat `OverconstrainedError`; izin ditolak tidak diprompt berulang.
Putar dan cermin mengubah **piksel tracker**, membatalkan Map dan membuat output blackout.

## CAM-03 · Quick Connect
Sumber kamera disajikan sebagai **Hubungkan kamera**; di dalam panel:
- **Semua kamera:** webcam laptop, USB UVC, capture HDMI, OBS, NDI, virtual camera;
- **QR:** WebRTC HP yang sudah tersedia;
- **Manual:** pairing HP existing.
Satu pemilih perangkat, CTA Gunakan kamera, Cari kamera, Muat ulang, Putuskan.
Stage Monitor tetap menjadi preview utama; tidak ada preview kedua yang memakan ruang.
Kamera terakhir hanya menjadi pilihan awal, tidak otomatis dinyalakan.

## CAM-04 · Recovery dan frame health
Track `ended`, `mute` lama dan `devicechange` membatalkan sesi.
Pada browser yang mendukung `requestVideoFrameCallback`, tiadanya **frame dekode baru**
selama 3,2 detik ketika tab terlihat memutus sesi. Pada tab tersembunyi, pemeriksaan ini
tidak otomatis memutus agar tidak keliru terhadap throttling browser.
Gambar yang berulang sama persis dari capture card/OBS masih bisa dianggap frame baru:
**tidak ada jaminan bisa mendeteksi setiap frozen visual** hanya dari browser.
Koneksi putus mengaktifkan blackout dan menuntut kalibrasi Map ulang.
Output tidak boleh kembali LIVE secara otomatis.

## CAM-05 · Adapter melalui OS, tidak membuka IP langsung
- **DSLR / HDMI:** HDMI OUT → capture card USB UVC → pilih camera device;
- **IP/RTSP/CCTV:** jalankan OBS → Virtual Camera → pilih OBS dalam daftar;
- **NDI:** jalankan NDI Webcam Input → pilih device;
- **SDI:** capture/konverter UVC atau OBS yang mengekspos kamera virtual.
Masing-masing membutuhkan software/driver dan izin yang sesuai.
Frontend GitHub Pages **tidak menyediakan signaling API** untuk QR otomatis.
Remote antar-kota / WebRTC + TURN tetap fase CAM-06.

## QA rilis
- `npm test` mencakup `tests/universal-camera.test.ts` dan pengujian USB sebelumnya.
- `npm run build -- --mode githubpages` harus lulus.
- GitHub Pages deploy dari `main` saja.
- QA browser dan perangkat fisik HDMI/USB/IP/NDI tetap harus dilaksanakan sebelum panggung.
- Vercel auto-deploy dalam `vercel.json` tetap `false`.

## Batas bukti
Unit test, build, dan deploy membuktikan integritas perangkat lunak.
Kompatibilitas kamera fisik dan latensi riil memerlukan pengujian perangkat.
