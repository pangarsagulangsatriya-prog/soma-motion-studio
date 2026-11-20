# SOMA — Kamera HP USB, bingkai horizontal 16:9

**Implementasi:** USB-01 → USB-04 (software) · **Perangkat fisik:** belum diuji

## Ringkasan

Di `Track → Kamera HP` tersedia tiga metode:

1. **Kabel USB** (default): HP dikenali sebagai webcam oleh sistem operasi, lalu SOMA memilih `videoinput` melalui `MediaDevices`. Perlu kabel data; Android memerlukan mode Webcam bila tersedia, iPhone + Mac dapat memakai Continuity Camera berkabel, perangkat lain mungkin memerlukan aplikasi webcam virtual.
2. **QR**: WebRTC yang sudah ada tetap tersedia.
3. **Manual**: WebRTC OFFER/ANSWER yang sudah ada tetap tersedia.

Ketiga metode meneruskan **satu stream yang sama** ke `CameraTracker` lama. Proyeksi fisik tidak otomatis aktif setelah koneksi kamera.

## Orientasi video (syarat utama)

`src/engine/landscapePhoneCamera.ts` memproses **piksel video asli sebelum tracking**:

- Keluaran: **1280×720 / 16:9**, target 24 fps.
- Video sumber landscape: gambar dipertahankan di tengah, tidak dipotong (letterbox untuk 4:3).
- Video sumber portrait: orientasi awal diputar 90° dan dirender ke bidang 16:9.
- Perubahan dimensi/orientasi video ditangani per frame.
- Jika gambar sideways/terbalik, operator menggunakan tombol **Putar gambar HP 90°** di Track, lalu ulangi kalibrasi Map. Untuk komposisi panggung, posisikan HP **mendatar secara fisik**.
- Seluruh pelacakan pose, koordinat Map, dan keluaran FLOOR/BODY membaca bingkai yang sama. Rotasi **bukan sekadar CSS**.

## Keamanan koneksi

- Kamera membutuhkan HTTPS atau localhost dan izin `getUserMedia` dari browser.
- Daftar perangkat diperbarui lewat `devicechange`, dengan tombol **Cari kamera** sebagai fallback.
- Webcam/USB native tidak memerlukan Redis/signaling/QR.
- Pergantian kamera, perubahan orientasi manual, dan koneksi terputus memicu **blackout**, reset identitas, serta pencabutan konfirmasi kalibrasi.
- Menutup komponen/sumber menghentikan stream serta loop kanvas untuk mencegah kamera tersembunyi tetap aktif.
- Jika perangkat mengirim track `ended` atau lama `muted`, video dihentikan dan output dikembalikan ke kondisi aman.
- SOMA tidak dapat memastikan kabel fisik hanya dari `navigator.mediaDevices`; label UI menjelaskan bahwa sumber dikenali OS, dan pengguna memilih kameranya sendiri.

## Uji otomatis dan QA panggung

- `npm test`: tes unit model dan wiring untuk pemilihan sumber, normalisasi orientasi, cleanup, dan gate output; hasil tercatat dalam PR.
- `npm run build`: wajib diverifikasi dalam environment dengan dependencies sebelum rilis.
- Uji fisik Android USB Webcam → Windows/macOS, iPhone Continuity Camera → macOS, aplikasi webcam virtual bila diperlukan.
- Latihan dua performer: frame real-time, crossing A/B, kalibrasi empat titik, dan FLOOR/BODY; kemudian cabut kabel saat video aktif untuk memastikan blackout.

**Belum tervalidasi fisik:** HP aktual, latensi end-to-end, kompatibilitas driver kamera, orientasi gambar yang dilihat operator, dan proyektor panggung.
