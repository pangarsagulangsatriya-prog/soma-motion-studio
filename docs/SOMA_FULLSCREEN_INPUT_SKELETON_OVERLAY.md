# SOMA · Fullscreen Input & Skeleton Diagnostics
Tanggal: 22 November 2026

## Fitur
- Compose → Garis BETA → Overlay fullscreen: dua checkbox independen, **Preview Kamera Input** dan **Skeleton**.
- Keduanya default OFF; tidak disimpan lintas reload, tidak mengubah feed proyektor atau izin LIVE.
- Saat fullscreen aktif, tekan **V** untuk mengaktifkan/menonaktifkan kamera/video input, dan **K** untuk mengaktifkan/menonaktifkan skeleton. Escape mengembalikan pengguna ke Compose.
- Overlay hanya muncul saat kanvas Garis BETA fullscreen. Bentuknya panel picture-in-picture di pojok kanan atas, tanpa toolbar dan tetap satu elemen canvas.
- Kamera + Skeleton ON menumpuk skeleton di video input yang sama. Skeleton saja menampilkan pose di atas latar gelap. Kamera saja menampilkan video input.
- Kamera HP/webcam: gambar diambil dari `videoRef` Track, pose dari `frameRef`. MP4: video dari `experimentFrameRef.video` (fallback frame `experimentInputCanvas`), pose dari snapshot yang sesuai. Simulasi/Demo tidak memalsukan kamera atau skeleton.
- Hanya pose yang masih segar (<450ms) dengan identitas valid digunakan. Jika data hilang, panel menunjukkan informasi belum terbaca.
- Fullscreen dengan dua opsi OFF tetap gambar bersih seperti sebelumnya (tanpa tambahan DOM maupun toolbar).
- Blackout tetap prioritas tertinggi: overlay tidak digambar saat padam.

## Uji
- Unit: default OFF, video saja, skeleton saja, input kosong, pose kedaluwarsa, kamera nonaktif.
- Browser: fullscreen awal bersih, toggle V/K di fullscreen, overlay hilang saat OFF, satu canvas tetap, Escape berfungsi, checkbox Compose dapat disetel sebelum fullscreen.
- Input MP4 dan HP tidak membuka kamera atau engine deteksi baru.

## Catatan panggung
Ini overlay pemeriksaan di kanvas fullscreen Garis BETA. Jangan aktifkan saat memakai kanvas sebagai output visual akhir untuk penonton. Pemetaan proyektor fisik dan kontrol LIVE masih melalui Map/Perform dan tetap perlu QA terpisah.
