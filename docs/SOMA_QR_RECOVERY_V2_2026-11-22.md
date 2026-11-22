# SOMA — QR Session Recovery V2 (refresh-safe signaling)
Tanggal: 22 November 2026
Rilis: **GitHub Pages preview branch saja. Vercel production tidak diubah.**
Status pengujian: unit/API dan browser statis; pengujian signaling sungguhan memerlukan backend Redis pada lingkungan preview terpisah.

## Masalah sebelumnya
Setelah QR pertama berhasil, laptop memanggil `close` pada ruang Redis. Reload penuh menghapus `RTCPeerConnection` di laptop, sementara HP tidak memiliki ruang signaling untuk menjawab tawaran video baru. Pengirim HP juga menghentikan polling setelah jawaban pertama. Konfirmasi izin kamera dan pergantian menu tak cukup untuk memulihkan sesi.

## Kontrak desain
- Satu kali QR: membuat ruang acak dengan tiket undangan sekali pakai (TTL 3 menit sebelum join).
- Setelah HP menggunakan tiketnya: terbit token **khusus HP**, ruang mempunyai TTL maksimal 3 jam dan tiket QR tidak dapat dipakai kedua kalinya.
- Kedua perangkat menyimpan tokennya sendiri di **sessionStorage tab**, bukan localStorage/URL query. Data ini hanya berisi role, room, token, masa berlaku, tiket (sementara sebelum join); **tidak menyimpan frame kamera, SDP, atau ICE/IP**.
- Laptop atau HP yang reload memakai `resume` dengan token role-nya. Server mengecek SHA-256 credential dan secara atomik menaikkan `epoch`, menolak offer/answer lama, serta mengembalikan status `joined`. Pemilik ruang lain menerima epoch baru lewat polling dan membuat peer video WebRTC baru.
- Sender menyimpan kamera aktif selama tab belum reload dan video track masih live, sehingga laptop yang refresh tidak perlu QR baru. HP yang reload mencoba meminta izin kamera lagi; pada iOS Safari terkadang harus menekan tombol **Coba sambungkan lagi**.
- Kerusakan Wi-Fi singkat di bawah 12 detik tetap ditangani oleh V1; V2 mendukung membangun ulang peer setelah gagal, dengan izin proyektor tetap dicabut.
- **Tidak pernah otomatis mengaktifkan output fisik sesudah reconnect.** App memanggil Blackout, mengosongkan kalibrasi lama, mereset A/B, lalu meneruskan stream baru lewat CameraTracker/Map untuk QA ulang.

## API Redis (atomic EVAL)
| Action | Otentikasi | State transition |
|---|---|---|
| create | origin yang sama + rate limit | waiting; desktopToken/ticket SHA-256 |
| join | tiket QR sekali pakai | waiting → joined, phoneToken SHA-256, epoch=1, TTL 3 jam |
| poll | token role desktop/phone | hanya menerima SDP milik role tersebut serta epoch/TTL |
| resume | token role desktop/phone | epoch++, state=joined, offer/answer lama dihapus |
| offer | desktopToken + epoch | joined → offered |
| answer | phoneToken + epoch | offered → answered |
| close | salah satu role-token | hapus ruang; penerbitan QR baru diperlukan |

Saat `epoch>1`, nomor epoch wajib cocok; jawaban lama dikembalikan sebagai `STALE_EPOCH` (HTTP 409). Token/kunci yang keliru tetap HTTP 403. Ruang yang kedaluwarsa mengembalikan HTTP 410. `poll` tidak memperpanjang TTL. Tanpa Redis: HTTP 503 dengan kode kesalahan eksisting, tidak mengarang ruang palsu.

## UX
- **Laptop refresh:** SOMA membaca sesi desktop dari sessionStorage, memilih Track/Kamera HP/QR dan meminta resume. HP yang masih aktif menjawab tawaran baru.
- **HP refresh:** halaman sender membaca sesi HP yang sama dan meminta resume, lalu membuka kamera dan menunggu tawaran baru. Layar tetap landscape 16:9.
- **Wi-Fi putus singkat:** grace V1, output Blackout, track tidak dipalsukan; koneksi pulih dalam 12 detik boleh lanjut video.
- **Koneksi gagal:** tampilkan pesan dan tombol coba sambungkan lagi, atau buat QR baru; jangan terus memakai frame lama.
- **Hentikan:** menghentikan kamera, menghapus kredensial sesi lokal dan memerintahkan server menghapus room.

## Batasan yang perlu dijelaskan dengan jelas
GitHub Pages menyajikan file statis dan **tidak menjalankan `api/phone-pair.ts`**, sehingga kemampuan refresh QR otomatis belum bisa diuji pada URL GitHub Pages. Untuk E2E sungguhan perlu deployment **preview backend terpisah** dengan Redis yang dikonfigurasi, setelah disepakati; perubahan ini tidak memicu Vercel production. Manual SDP di GitHub Pages masih memerlukan salin-tempel kode sesudah refresh.

Saat OS membekukan tab HP, getUserMedia dan WebRTC tetap dapat berhenti meskipun Screen Wake Lock tersedia. Reconnect saat HP terkunci tidak dijanjikan. NAT/firewall berat masih membutuhkan TURN ber-token sementara; V2 belum menambahnya.

## Quality assurance
- Unit: keamanan sessionStorage, expiry/role, URI fragment, satu QR hanya untuk satu HP.
- API: resume desktop dan HP, epoch meningkat, tawaran lama ditolak, role berbeda tidak bisa mengambil room, close.
- CI: regresi SOMA, kamera universal, Compose/Map/Perform browser, TypeScript/Vite.
- QA fisik yang belum ada di CI: Chrome Android & Safari iOS, reload laptop, reload HP, ganti menu, sentuhan tak sengaja, Wi-Fi hilang 1/5/15/30 detik, IP/NAT berganti, FPS dan jalur Blackout fisik. Hasil harus dicatat per perangkat.
