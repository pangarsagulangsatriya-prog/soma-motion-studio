# SOMA — Audit Keamanan & Stress Test Multi-Kamera (22 November 2026)
Lingkungan: branch GitHub Pages preview. Tidak ada deploy Vercel Production.
Hasil akhir: baca status GitHub Actions untuk commit ini; pengujian otomatis memakai simulasi HTTP/Redis dan perangkat virtual, bukan kamera fisik.

## Kesimpulan audit arsitektur
**SOMA saat ini hanya mengolah satu sumber video aktif per Stage.** `FootprintsInputChoice` memiliki pilihan webcam, phone, video, simulator; `App.tsx` memakai satu `CameraTracker`, satu video input, satu `phoneLandscapeRef`, dan `switchFootprintsSource` menghentikan sumber sebelumnya. Enumerasi 10 webcam/USB ≠ decoding dan tracking 10 webcam sekaligus.

Sistem QR signaling Redis bisa memiliki beberapa room independen pada server; **satu room hanya menerima satu HP** melalui tiket sekali pakai. Tombol pemilihan Stage bukan multi-room receiver. Jika kamera 1/3/10 dipakai dari 1 laptop sekaligus, diperlukan arsitektur multi-receiver, camera registry, resource governor, pemilihan output dan QA per sumber—belum terpasang.

## Keamanan yang sudah ada
- HTTPS/same-origin untuk API browser; koneksi media WebRTC melalui DTLS-SRTP (protokol terenkripsi oleh browser).
- Token desktop dan HP terpisah 24-byte acak per sesi; server menyimpan SHA-256, dibandingkan atomik Redis Lua.
- Tiket QR hanya untuk join pertama dan dihapus. Token resume milik perangkat tersimpan di sessionStorage selama sesi.
- `room` acak, epoch baru setiap resume; offer/answer lama ditolak.
- SDP/ICE tidak berisi frame video, namun dapat menyimpan metadata jaringan atau alamat IP; **perbaikan ini menambahkan `ack` dari laptop** agar SDP/ICE segera dihapus setelah jawaban WebRTC berhasil dibaca.
- Output fisik terpisah dari kamera dan tetap melalui Blackout + QA kalibrasi saat gangguan/penyambungan ulang.

## Temuan kapasitas dan perbaikan
1. **Batas polling lama, P0:** sebelum audit, 240 permintaan per menit dibagi oleh IP dan action, sedangkan satu sesi QR memakai sekitar 2×(60/0,85)=141 polling/menit (laptop + HP). Pada Wi-Fi/NAT yang sama, ≥2 sesi dapat mencapai 429 walau normal.
2. **Baru, P0:** setiap `poll` memiliki satu operasi Redis atomik yang menguji **maksimal 1.800 polling/menit/IP** dan **95 polling/menit per pasangan room+token**. Perhitungan 10 sesi: sekitar 1.412 polling/menit (di bawah 1.800), sebelum retry/jitter. Role berisik dibatasi secara mandiri. Batas ini kuota permintaan, **bukan jaminan CPU, bandwidth, atau 10 stream live**.
3. **Pembuatan QR tetap dibatasi 8 per IP per 60 detik**. Sepuluh koneksi dari satu jaringan harus diundang bertahap melewati menit berikutnya; pembatas ini sengaja tidak dilonggarkan agar tidak mempermudah spam room.
4. **Perbaikan privasi, P1:** API menerima `ack` berotorisasi desktop dan epoch; menghapus field Redis `offer` dan `answer` sesudah laptop memasang jawaban. Room dan token tetap ada untuk resume.
5. **P0 tetap:** QR auto/recovery butuh endpoint `/api/phone-pair` + Redis aktif. GitHub Pages statis hanya mendukung pairing manual; sepuluh QR otomatis tidak bisa dijalankan di URL GitHub Pages saja.
6. **Kabel USB/virtual:** perangkat 1/3/10 bisa muncul di `enumerateDevices`. Keberhasilan enumerasi tidak menguji keterbatasan port USB, hub, izin kamera, bandwidth, atau kesanggupan browser membuka semuanya sekaligus.

## Test otomatis dalam `tests/phone-multi-device-stress.test.ts`
| Kasus | Asersi |
|---|---|
| 3 room, 1 IP NAT | join terpisah, credential role tidak melintas, polling 70 putaran serentak |
| 10 room, 1 IP NAT | 8 undangan pada menit pertama, 2 berikutnya; 20 pihak polling 70 putaran, total 1.400 polling simulasi |
| Penyalahgunaan kuota | satu token melebihi 95/min → 429; token kamera lain tetap mendapat 200 |
| Pencurian/pertukaran token | token room lain tidak dapat membaca SDP/ICE; phone token tidak berhak membuat offer |
| Replay QR | tiket lama ditolak; epoch stale setelah resume ditolak |
| ACK privasi | token HP tidak boleh menghapus SDP; token laptop dapat membersihkan SDP; polling selanjutnya tidak lagi mendapat metadata jaringan |
| Stop satu sesi | hanya room bersangkutan yang hilang; kamera lain masih dapat poll |
| Perangkat USB | 10 `videoinput` virtual terdeduplikasi, request mengunci deviceId yang dipilih dan mempertahankan satu pipeline |
| HTTP safety | origin asing → 403, permintaan terlalu panjang → 413 |

Tes ini memakai Redis EVAL palsu yang menirukan transisi atomik dan permintaan API in-process. Tes **tidak** mengukur performa Vercel/Upstash, koneksi fisik, FPS inference, suhu HP, USB bus, dropped frames, atau Wi-Fi access point.

## Risiko yang belum terselesaikan
- **10 kamera live bersamaan di satu Stage belum tersedia.** Butuh desain multi-source dengan ingest terpisah, routing identitas per kamera, limits resource, per-source fail closed, dan kebijakan prioritas visual.
- **Satu sesi QR per receiver UI** meski backend punya room terpisah. Jangan memaksa sepuluh browser tab menjadi satu Stage tanpa pengatur konsumsi sumber.
- Tidak ada TURN relay dengan kredensial sementara; STUN-only dapat gagal di NAT ketat; UI harus memberi pesan kegagalan.
- Browser/OS dapat menghentikan video HP saat layar terkunci; Wake Lock membantu saat halaman terlihat, bukan jaminan.
- Kunci di `sessionStorage` tetap perlu pertahanan XSS, kebijakan CSP, review dependensi, dan mitigasi malware lokal.
- Redis signaling yang menyimpan SDP sebelum ACK berisi data alamat jaringan sampai ACK/TTL; jangan menampilkan SDP dalam log.
- Kecepatan 10 stream 720p dipengaruhi codec, resolusi, FPS, CPU/GPU, jaringan, perangkat, dan kabel. Tidak ada angka throughput atau stabilitas fisik yang diklaim.

## Pengujian perangkat yang diperlukan sebelum produksi multi-kamera
1. **3 kamera**: 1 USB webcam, 1 HP WebRTC, 1 capture/virtual; sambungkan bergantian dahulu untuk memeriksa guard dan naming, lanjutkan ke multi-ingest setelah implementasi.
2. **10 perangkat**: 5 kabel/virtual dan 5 HP Wi-Fi pada switch/AP; uji bersama dengan alat telemetry yang membaca WebRTC bytes, RTT, decode FPS, inference FPS, CPU/GPU, penggunaan RAM, packet loss, dan interupsi USB.
3. **Fault injection**: matikan satu HP; refresh satu browser; tukar IP dan jaringan; coba QR lama; bombardir token salah; hentikan satu stream saat 9 lainnya hidup.
4. **Ambang go/no-go**: tidak ada salah identitas antar room; 0 stream stale yang diperlakukan fresh; 0 akses antar room; 0 proyektor LIVE otomatis setelah loss; jumlah 429 normal=0 selama beban terukur; parameter FPS/latensi ditentukan setelah baseline fisik.

## Keputusan produk
Untuk pertunjukan dua performer: pertahankan 1 kamera aktif per Stage agar tracking/Map stabil. Multi-kamera perlu proyek berbeda: **Camera Hub (Connect → Monitor → Route)**, lalu Stage memilih feed yang aktif. Jangan langsung menjalankan 10 inferensi AI berat pada satu tab laptop.
