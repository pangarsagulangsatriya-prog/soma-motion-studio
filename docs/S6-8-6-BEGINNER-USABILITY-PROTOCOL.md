# SOMA / Footprints — S6.8.6 Beginner Usability Test

## Status
Implementasi perangkat observasi sudah tersedia. **Belum ada pengujian manusia** yang dilakukan dalam sprint ini. CI menguji bahwa kontrol, alur browser, dan pencatatan berfungsi, bukan keberhasilan peserta baru.

## Tujuan observasi
Amati apa yang dilakukan seseorang saat pertama membuka SOMA, tanpa mengajarkan jalurnya terlebih dahulu. Catat waktu yang mereka perlukan untuk menemukan INPUT, memahami Webcam/HP/MP4/3D, melihat preview BODY/FLOOR, serta pulih dari pesan gangguan.

## Menjalankan sesi (moderator)
1. Buka SOMA Footprints di browser. Gunakan akun/perangkat uji; pastikan keluaran proyektor tetap Blackout dan tidak ada file media pribadi.
2. Klik **Uji Pemula → Mulai sesi observasi**. Panel dapat ditutup sementara dan dibuka lagi tanpa menghentikan pencatatan.
3. Bacakan satu instruksi tugas pada satu waktu. Jangan menunjuk tombol sebelum peserta berusaha sendiri.
4. Setelah setiap tugas, pilih **Berhasil**, **Ada kendala**, atau **Lewati**. Tandai **Peserta meminta bantuan** ketika moderator memberi petunjuk; tuliskan contoh tindakan atau kebingungan yang tampak dalam catatan ringkas.
5. Setelah selesai, **Ekspor hasil JSON**. Tinjau dan hilangkan identitas apa pun yang terlanjur tertulis pada catatan sebelum membagikan laporan.
6. Jalankan sesi berikutnya pada browser/session baru; hindari menggabungkan beberapa peserta dalam satu sesi.

## Empat tugas
| Tugas | Instruksi untuk peserta | Yang dicatat moderator |
| --- | --- | --- |
| 01 — Source | Temukan sumber gerak dan aktifkan satu sumber | Titik klik pertama, status yang dipahami, izin kamera |
| 02 — Switch | Pindah ke sumber lain dan temukan perubahan preview | Menu yang dicari, waktu perpindahan, kebingungan video vs 3D |
| 03 — Recovery | Hadapi gangguan webcam atau pairing HP yang aman | Respons membaca pesan, Coba lagi, beralih ke sumber yang berfungsi |
| 04 — BODY/FLOOR | Temukan kedua preview dan jelaskan cara mengontrol keluaran | Pembedaan preview lokal vs proyektor, lokasi Blackout |

## Gangguan yang aman
- Untuk izin kamera: moderator dapat menolak izin browser pada **perangkat uji**; peserta mencoba **Coba lagi** atau beralih ke **Simulasi 3D**. Browser mungkin memerlukan perubahan izin situs secara manual sebelum webcam bisa aktif.
- Untuk HP: hentikan **pairing WebRTC** pada HP uji; peserta dapat membuka pairing kembali atau beralih ke sumber lain.
- Jangan memutus daya proyektor secara mendadak, memindahkan rig aktif, atau menyorot tubuh/penonton untuk menguji pemulihan. Pengujian ini tidak mengubah persetujuan fisik proyektor.

## Data yang dihasilkan
- **Sinyal otomatis**: jenis input, fase status, perpindahan, error, pemulihan pada sumber sama, fallback, dan waktu relatif.
- **Penilaian moderator**: berhasil/kendala/lewati, bantuan, durasi tugas, catatan hingga 240 karakter.
- **Ringkasan**: tugas yang berhasil, tugas dengan kendala, permintaan bantuan, median durasi tugas berhasil, error, retry dan fallback yang tercatat.
- **Tidak dikumpulkan otomatis**: frame kamera, video, audio, identitas peserta, rekaman layar, alamat IP, atau perangkat fisik. JSON hanya dikirim ke luar browser jika moderator melakukan ekspor dan membagikannya.

## Analisis setelah sesi manusia
Bandingkan tugas yang sering gagal, jalur yang memerlukan bantuan, dan pesan error yang gagal dipahami. Gunakan temuan ini untuk membuat backlog UX; uji ulang pada peserta baru setelah perbaikan.

**Catatan pengukuran:** status `ready` dan perpindahan sumber menggambarkan perilaku aplikasi. Keberhasilan memahami antarmuka tetap perlu dinilai moderator; angka tanpa sesi manusia tidak boleh dilaporkan sebagai usability score.
