# SOMA → TouchDesigner

1. Ekstrak seluruh ZIP ke satu folder di komputer yang menjalankan TouchDesigner.
2. Buka TouchDesigner dan Textport (Alt+T). Jalankan berikut dengan path folder hasil ekstrak:

```python
SOMA_STARTER_DIR = '/Users/nama/Downloads/soma-touchdesigner-starter'
exec(compile(open(SOMA_STARTER_DIR + '/install_soma.py').read(), SOMA_STARTER_DIR + '/install_soma.py', 'exec'))
```

3. Salin kode pairing yang tercetak di Textport. Kode berubah setiap pemasangan. Hindari menyimpan atau membagikan project yang masih memuat kode sesi aktif.
4. SOMA → Perform → Output Proyektor → TouchDesigner. Tempel kode lalu Hubungkan. Alamat bawaan `ws://127.0.0.1:8765`. Izinkan akses jaringan lokal saat browser meminta.
5. Tekan Kirim Trigger Uji. `preview_pulse` berkedip satu kali; `channels` memberi pulsa `a_left_contact`. Preview bisa dilihat di node TD. OUT tetap gelap.
6. Siapkan sumber SOMA di Track. Tekan Mulai Kirim Data, lalu aktifkan `Arm / Nyalakan output TD` pada komponen TD. Setiap kontak menyalakan lingkaran uji di OUT selama 250 ms. Ganti rangkaian lingkaran dengan visual Anda; pertahankan `output_gate`.
7. Posisi tersedia di `a_left_x/y`, `a_right_x/y`, `b_left_x/y`, `b_right_x/y`. `*_valid=0` berarti titik hilang. Satu performer bernama `performer-1` dipetakan ke A. `*_contact/slide/pivot/release/lift` memuat jumlah pemicu baru dalam satu frame CHOP; nilai 0 pada frame berikutnya. Untuk jumlah >1, gunakan hitungan ini saat membuat instancing agar kontak tidak hilang.
8. `scene_gate` harus mengendalikan output akhir. Blackout, Hentikan, pergantian sumber, kalibrasi, tab tersembunyi, atau timeout mematikan gate. Aktifkan ulang Mulai Kirim Data dan Arm secara manual.

Koordinat setiap kaki berlabel `floor-uv`, `image-uv`, atau `simulated-floor-uv`; arah x kiri→kanan, y atas→bawah. Meter hanya dari titik floor-uv dan ukuran lantai yang valid: xM=x*widthM, yM=(1-y)*depthM. Posisi live memakai titik pergelangan kaki; status kontak berasal dari engine gait. Posisi tubuh tengah tidak dijadikan telapak. heading/status kosong dikirim null. Dua identitas yang ragu tidak memicu A/B.

Sumber MP4/3D ditandai latihan (`rehearsal=1`); citra yang belum dikalibrasi memberi `uncalibrated=1`. Kontak dari kamera berupa perkiraan perangkat lunak.

Penerima terikat 127.0.0.1; satu browser per receiver, token per sesi, JSON maksimal 16 KiB, urutan paket dan deduplikasi event. Domain yang diizinkan tercantum pada ORIGINS dalam soma_receiver.py. Tambahkan domain production pribadi secara eksplisit bila digunakan. Saat browser memblokir ws lokal dari HTTPS, izinkan Local Network Access atau buka SOMA lewat localhost. Jangan menonaktifkan keamanan browser.

Status rilis: kode protokol diuji otomatis dan aplikasi diuji di browser. Installer ini memerlukan TouchDesigner di Mac/Windows; pembuatan node, uji kamera/HP, layar fisik, dan durasi latihan perlu dijalankan pada komputer panggung. Tidak menyertakan file biner .tox yang belum teruji.

Rujukan API: https://derivative.ca/UserGuide/Web_Server_DAT dan https://derivative.ca/UserGuide/WebserverDAT_Class
