# F3 Source Adapter — Track camera reuse (22 November 2026)

Input F3 per role A/B sekarang menggunakan pilihan sumber yang sama dengan Track: Kamera lain, Kamera HP, Video MP4. Simulasi 3D tidak ditampilkan karena renderer dan foto F3 memerlukan frame video nyata.

Kamera lain memakai pemilih perangkat lokal dan engine `openUniversalCamera` (constraints fallback Track). Kamera HP memakai `PhoneCameraReceiver`: kabel/Continuity/Android Webcam atau WebRTC nirkabel; pada GitHub Pages QR memerlukan langkah kode manual. Masukan HP dinormalisasi ke 16:9 menggunakan `createLandscapePhoneCamera` dari Track sebelum frame masuk engine F3.

Setiap role mempunyai registry, source selector, status dan liveness independen. Pergantian mode memutus stream sebelumnya dan mengunci rana. Perangkat lokal sama tidak boleh dipakai dua role, sementara pairing WebRTC independen per role. Video MP4 tetap dapat dipilih untuk simulasi dan QA.

Keamanan: bila frame A/B terputus, gestur otomatis disarm; consent tetap dibutuhkan untuk foto; proyektor fisik tetap terkunci. Uji kamera HP fisik dan dua sesi WebRTC belum diselesaikan pada CI browser.
