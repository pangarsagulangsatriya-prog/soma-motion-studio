# Camera E2E — macOS, iPhone/Android, USB, QR, WebRTC

## Track · Sambung cepat
1. Kamera HP → Kabel. iPhone lewat Continuity Camera atau Android dengan mode USB Webcam. Pilih kamera yang dikenali Mac, lalu Sambungkan. Kabel data biasa tidak otomatis menjadi stream kamera.
2. Kamera lain → Webcam / DSLR-HDMI capture / OBS / NDI. Pilih perangkat macOS pada dropdown Track. SOMA memulai ulang sumber yang dipilih.
3. Kamera HP → Nirkabel. QR membuka kamera HP. Pada GitHub Pages, lanjutkan pertukaran kode WebRTC manual. QR otomatis baru berfungsi bila signaling endpoint `/api/phone-pair` beserta Redis tersedia pada host yang sama.
4. MP4 / Simulasi 3D tetap dalam jalur eksperimen.

## Satu pipeline video
- macOS (UVC, Continuity, OBS/NDI) → browser `getUserMedia` → tracker SOMA.
- HP WebRTC → MediaStream → normalisasi piksel horizontal 16:9 → tracker SOMA yang sama.
- Semua perubahan sumber atau kamera berhenti → reset identitas/pose → Blackout → cabut QA Map; operator menyambungkan ulang.
- Pemilihan HP berdasarkan label hanya petunjuk; browser tidak membuktikan jenis kabel. FaceTime internal tidak dipilih otomatis sebagai HP.

## Uji perangkat yang masih wajib
- Mac hanya FaceTime: HP Kabel tidak memilih FaceTime otomatis.
- iPhone Continuity / Android USB Webcam: perangkat muncul → pilih → sambung → skeleton A/B.
- Webcam/DSLR HDMI/OBS: pilih Kamera lain → sumber masuk ke tracker yang sama.
- Cabut/pasang kamera: Blackout, frame tidak tersisa, QA Map perlu diulang.
- Input portrait: normalisasi benar-benar berlaku pada piksel 16:9, kaki tidak terpotong.
- QR GitHub Pages: manual code exchange tertera jelas. QR otomatis diuji hanya pada origin yang menyediakan signaling.
- Chrome/macOS dan proyektor fisik tetap membutuhkan pengujian nyata terpisah dari unit CI.
