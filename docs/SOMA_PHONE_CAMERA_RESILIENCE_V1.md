# SOMA · CAMERA LINK RELIABILITY V1
Tanggal: 22 November 2026 · Scope: GitHub Pages preview branch; tidak deploy Vercel

## Diagnosa berdasarkan kode
1. Receiver QR otomatis dan pengirim HP langsung menutup RTCPeerConnection begitu status WebRTC menjadi `disconnected`. Ini dapat terjadi pada perpindahan Wi-Fi, perubahan sinyal singkat, atau HP yang berganti fokus; status ini kadang pulih dengan ICE yang sama.
2. Kamera HP di laptop diterjemahkan menjadi video horizontal melalui kanvas. Event `mute` selama 1,5 detik atau 3,2 detik tanpa frame decode memicu stop permanen, lebih cepat daripada kesempatan pemulihan WebRTC.
3. Screen Wake Lock belum aktif, sehingga layar HP dapat tidur. Browser dapat menahan kamera dan timer ketika aplikasi masuk latar belakang.
4. QR signaling otomatis menggunakan ruang sekali pakai; backend menutup ruang setelah jawaban SDP digunakan. Reload penuh laptop/HP menghapus objek RTCPeerConnection. Pertukaran offer/answer yang baru diperlukan. GitHub Pages sendiri tidak meng-host `/api/phone-pair` dan hanya menyediakan QR menuju halaman sender + pasangan manual.

## Implementasi
- `phoneLinkRecovery.ts`: kebijakan status link serta toleransi kehilangan heartbeat. 12s grace untuk koneksi terputus, peringatan heartbeat 4,5s.
- AutomaticPhoneReceiver / Sender: `disconnected` menahan PeerConnection dan MediaStream selama masa grace; `connected` kembali melanjutkan video. `failed` dan `closed` tetap memutuskan sesi.
- App → Track: callback `onPhoneInterrupted` segera memanggil Blackout, mencabut persetujuan Map, mereset A/B; **tidak** langsung menghentikan sumber kamera. Ketika video pulih, Map harus dikonfirmasi ulang sebelum LIVE.
- LandscapePhoneCamera: `mute` dan decoded-frame stall memberi notifikasi interruption; rasio 16:9 tetap sama. Bingkai lama diganti latar gelap ketika decoder tidak lagi segar; setelah 12 detik stall persisten, sumber ditutup dengan aman.
- HP transmitter otomatis & manual: mencoba Screen Wake Lock saat aktif, mengambil ulang setelah kembali ke halaman depan, menampilkan status saat tidak didukung.
- Tombol berhenti HP memakai konfirmasi; saat reload browser mendukung, `beforeunload` memperingatkan bahwa sesi langsung bisa terputus.
- Receiver manual kode memegang koneksi selama grace, mengutamakan link yang pulih; jika gagal, membersihkan peer dan mengharuskan kode baru.

## Yang belum bisa diperbaiki hanya dari GitHub Pages
- **Refresh penuh laptop/HP:** WebRTC peer lama hilang. Sesi otomatis pulih sesudah refresh membutuhkan backend signaling persisten (room credential yang dapat diperbarui, refresh-safe session handoff, reoffer/reanswer, TTL) serta mekanisme autentikasi yang aman. Mencatat token SDP/ICE di localStorage bukan solusi; jangan lakukan itu.
- **Browser HP masuk latar/terkunci:** Wake Lock dapat membantu mencegah tidur ketika halaman terlihat; sistem operasi tetap bisa mematikan kamera sewaktu aplikasi di background.
- **Di jaringan dengan NAT/firewall ketat:** hanya STUN tersedia sekarang. TURN dengan kredensial sementara diperlukan untuk keandalan lebih baik; penambahan server relay memerlukan infrastruktur dan pengujian biaya/jaringan.
- GitHub Pages static tanpa API hanya dapat menguji jalur pairing manual. QR otomatis dan rejoin sesi lintas refresh harus diuji di lingkungan server signaling yang didukung, tanpa mengubah production sebelum disetujui.

## Rencana tahap lanjutan untuk refresh otomatis
1. Persistent signaling terautentikasi dengan ID sesi acak dan token pemulihan **sementara** tersimpan di sessionStorage, tidak di URL biasa. TTL/rotation dan single owner.
2. HP tetap membuka sesi standby selama laptop reload. Laptop kembali dan menawarkan WebRTC baru; HP menerima setelah memverifikasi sesi. Timeout dan pembatalan aman.
3. Reconnect mengembalikan **video saja**. Track harus memverifikasi pose, Map mengulang QA, dan proyektor tetap Blackout sampai operator melanjutkan.
4. Uji dua HP/laptop, reload laptop, refresh sender, lock/unlock HP, pindah tab 5/15/30s, jaringan Wi-Fi berubah dan offline 1/5/15s.

## QA dan batas klaim
- CI memverifikasi kebijakan state, callback shutdown/blackout, fresh-frame guard, build dan regresi UI.
- Pengujian E2E Wi-Fi asli + iOS Safari/Android Chrome tetap wajib untuk membuktikan koneksi pulih dan mengukur FPS/dropout.
