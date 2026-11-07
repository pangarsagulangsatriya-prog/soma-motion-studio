# SOMA / PROJECTION — Panduan Studio 12 / Sprint 3

Tubuh bergerak di depan kamera. Siluet putih atau garis tepinya bergerak di layar. Operator mengatur bidang proyeksi, pasangan titik kamera–proyektor, dan respons gerak dari Studio.

## Mulai dari SOMA

1. Buka SOMA, lalu klik Projection pada bilah atas. Pastikan label STUDIO 12 muncul.
2. Klik Mulai kamera Body dan izinkan kamera. Pilih webcam yang sesuai. SOMA memakai kamera utama yang sama.
3. Mundur sampai satu tubuh masuk bingkai kamera. Beri cahaya yang cukup pada aktor.
4. Output mulai dalam Blackout. Klik Live untuk melihat siluet.
5. Klik Buka output proyektor. Izinkan pop-up SOMA saat browser memblokirnya.
6. Geser jendela itu ke proyektor. Klik dua kali pada bidang output atau tekan F untuk fullscreen. Escape keluar dari fullscreen.
7. Periksa Output tersambung dan jumlah masker diterima. Studio tetap berada pada layar laptop.

Klik Studio untuk kembali ke teks, suara, foto, dan arsip. Rekaman tetap berjalan saat berpindah workspace. Pilih Hands untuk perintah suara “kamera”, ukuran bingkai melalui dua telapak, dan foto lewat pukulan. Satu jenis pelacak aktif pada satu waktu. Memilih Hands menerapkan kebijakan tracking hilang pada proyeksi Body.

## Menyambungkan Mac, webcam, dan HDMI

1. Hubungkan webcam USB ke Mac. Kamera HDMI memerlukan perangkat capture yang dikenali sebagai webcam.
2. Hubungkan Mac ke proyektor melalui HDMI atau adaptor yang sesuai. Pilih input HDMI pada proyektor.
3. Buka Apple → System Settings → Displays. Pilih Extended display supaya laptop tetap memuat kontrol operator.
4. Susun posisi layar mengikuti meja operator. Buka output SOMA, geser jendelanya ke layar proyektor, lalu aktifkan fullscreen dari jendela itu.
5. Mulai pada output 720p. Naikkan ke 1080p setelah perangkat diuji bersama.
6. Biarkan Studio terlihat. Jangan minimalkan jendela atau menidurkan laptop selama sesi.

Pemindahan jendela dilakukan lewat desktop. Pemilihan monitor otomatis belum tersedia. Fullscreen memerlukan klik atau tombol F. Pilihan resolusi mengatur raster render; ukuran viewport dan skala layar juga memengaruhi hasil fisik.

## Organic Studio: tubuh berubah bentuk

1. Buka Projection, aktifkan Body, lalu tekan Live.
2. Buka tab Organic. Siluet kecil memperlihatkan tubuh sebelum efek. Kanvas besar memperlihatkan komposisi yang dikirim ke proyektor.
3. Pilih Utuh, Melar, Mengerut, Terbelah atau Bergabung. Kontrol langsung mengubah gambar. Kamera dan rekaman audio tetap berjalan.
4. Aktifkan Delay, Echo atau Residue pada bagian Waktu & jejak untuk menggabungkan bentuk dengan riwayat gerak.
5. Gunakan Blackout di bawah kanvas untuk memadamkan seluruh hasil. Reset Organic mengembalikan bentuk asli dan melepas history; kalibrasi tetap mengikuti sesi.

Mulai dengan satu efek. Siluet putih memakai kontur tubuh yang terbaca kamera. Efek ini tidak membuat gambar dengan model generatif per frame.

## Melar dan Mengerut

Melar memperpanjang siluet pada arah horizontal, vertikal atau arah gerak. Intensitas 1–3 kali. Mengerut memakai skala 25–100% menuju pegangan yang dipilih.

Pegangan tersedia pada pusat tubuh, kepala, bahu, panggul, atau tangan tertinggi. Titik yang tidak terlihat memakai titik tubuh yang tersedia atau pusat bounding box. Jangkauan Lokal memperkuat tarikan di dekat pegangan dan melemahkannya menjauhi titik itu. Seluruh tubuh memperluas perubahan ke semua bagian siluet.

Coba Melar → Tangan tertinggi → Lokal → Gerak aktor. Angkat lengan dan sapukan tangan. Tinggi lengan serta kecepatan gerak mengubah kekuatan tarikan; arah gerak memakai perpindahan pegangan. Badan di luar area tarikan tetap mengikuti masker terbaru.

Waktu pulih mengatur seberapa cepat bentuk mendekati nilai baru. Ini waktu respons artistik. Metrik inferensi dan pipeline kamera tetap terpisah.

## Terbelah dan menyatu kembali

Pita horizontal atau vertikal membagi masker menjadi 2–8 bagian. Jarak potongan menggeser bagian secara bergantian sepanjang arah pisah. Delay tiap potongan memberi jeda tambahan 0–500 ms untuk setiap bagian berikutnya. Bagian pertama mengambil waktu utama; bagian berikutnya mengambil waktu yang lebih lama.

Satukan potongan mengembalikan jarak serta delay potongan ke nol. Waktu menyatu mengatur laju jarak mendekati nol. Selama proses ini setiap potongan masih membaca riwayat tubuh.

Area anatomis memakai tiga pita dengan batas dari bahu dan panggul. Pembagian ini perkiraan 2D. Lengan yang melintasi dada ikut masuk pita dada. Kontur yang tertutup tidak dibuat ulang.

## Delay, Echo, Freeze

| Kontrol | Perilaku |
| --- | --- |
| Delay artistik | Pilih tubuh dari 0–5 detik sebelumnya. Awal sesi menunggu history yang cukup. |
| Echo tubuh | Tampilkan 1–6 lapisan, termasuk tubuh utama. Jarak waktu 100–1000 ms. |
| Pudar tiap echo | Kurangi terang lapisan yang lebih lama. Nilai 0 mempertahankan terang semua lapisan. |
| Freeze komposisi / Z | Simpan seluruh komposisi yang sedang terlihat, termasuk bentuk, echo dan bekas. |
| Release Freeze / Z | Kembali ke aliran komposisi live dengan konfigurasi saat ini. |
| Hold | Tahan gambar lewat transport Projection. Tekan Live untuk melanjutkan. |

Freeze tetap terlihat saat aktor berjalan keluar dari bingkai. Preview siluet kecil serta kamera terus diperbarui. Blackout selalu mengalahkan Freeze dan Hold. Setelah kembali ke Live, gambar Freeze masih menunggu Release.

Freeze menangkap masker komposisi sebelum kalibrasi. Sudut kalibrasi, mirror, offset dan penempatan proyeksi tetap dapat disesuaikan pada citra beku. Perubahan deformasi dan crop sumber mulai terlihat setelah Release.

History mengambil sampel berdasarkan timestamp aktual. Saat frame terlewat, mesin mengambil sampel tersedia yang tidak lebih baru dari waktu yang diminta. Umur tubuh terpilih menunjukkan jarak waktu sampel tersebut; hasil dapat lebih tua saat kamera tersendat. Nilai ini tidak mencakup latensi proyektor fisik.

## Bergabung dan bekas gerak

Bergabung memakai satu aktor dengan dua representasi:

- Tubuh tertunda mengambil masker dari waktu yang dipilih lewat Delay artistik.
- Pasangan tersimpan memakai tubuh yang ditangkap lewat Ambil tubuh pasangan. Freeze juga menyimpan tubuh pasangan.

Atur Campuran pasangan untuk terang tubuh kedua. Union menggabungkan kedua masker. Interpolasi silang mengurangi tubuh utama sambil menambah pasangan. Tarik pasangan mendekat menggeser pasangan menuju pusat tubuh terbaru. Nilai 0 mempertahankan posisi historis; nilai 1 mempertemukan kedua pusat tubuh. Aktor masih dapat menjauh dan bergerak.

Residue menyimpan cap komposisi dan mempertahankannya selama 0,2–12 detik:

| Ruang bekas | Perilaku |
| --- | --- |
| Screen-space | Cap tinggal pada posisi sebelumnya ketika aktor berpindah. Kalibrasi tetap memetakan seluruh bidang komposisi. |
| Current body | Cap hanya tampil di dalam siluet tubuh terbaru. Saat tubuh hilang, cap yang dipotong tubuh ikut tersembunyi. |

Bekas memudar menurunkan terang menurut usia cap. Saat pilihan itu mati, cap tetap terang lalu dilepas pada batas durasi. Hapus bekas menghapus semua cap lama; Residue yang masih aktif mulai mencatat gerak baru. Matikan Residue untuk berhenti mencatat.

Freeze dan bekas Screen-space dapat bertahan setelah tracking hilang. Kebijakan Hold/Fade/Blackout tracking berlaku pada sumber tubuh live; tombol Blackout utama tetap memadamkan semua lapisan.

## Preset artistik dan cue

Pustaka awal memuat Utuh, Lengan memanjang, Tubuh terbelah, Tubuh berulang, serta Tubuh dan bekas. Pilih nama lalu tekan GO / Mainkan. Tombol panah atau [ / ] langsung memainkan cue sebelumnya/berikutnya; urutan berputar setelah cue terakhir. Z mengaktifkan atau melepas Freeze. Pintasan tidak bekerja saat mengetik pada kolom isian.

1. Ubah mode dan kontrol artistik.
2. Isi Nama cue, lalu Simpan cue untuk memperbarui cue terpilih.
3. Duplikat cue menyimpan pengaturan saat ini sebagai cue baru. Ganti nama hanya mengubah nama cue terpilih.
4. Transisi cue 0–3 detik mencampur gambar sebelumnya dengan komposisi baru. Peralihan ini bekerja juga ketika dua cue memakai mode yang sama.
5. Ekspor cue menyimpan pustaka JSON. Impor cue mengganti daftar cue di browser, tanpa langsung memainkannya. Tekan GO setelah memilih.

Pustaka menyimpan maksimal 32 cue. Data mencakup mode, kontrol bentuk/waktu, blend, fade, serta nama referensi kalibrasi. Recall cue mempertahankan sudut proyektor, perangkat, mirror, crop dan kebijakan tracking. Freeze dan piksel history tidak disimpan dalam berkas preset. Cue yang dipanggil melepas Freeze, lalu memakai transisi yang dipilih.

## Batas history dan renderer Organic

Mesin menyimpan maksimal 300 sampel, sampai 24 sampel per detik, dan membuang sampel yang lebih tua dari 12 detik ketika data baru masuk. Masker history memakai 128 × 128 piksel: paling banyak 4,69 MiB untuk array masker history. Angka ini tidak menghitung seluruh heap browser, model detektor, atau GPU.

Residue menyimpan maksimal 24 cap. Pasangan beku dan gambar transisi masing-masing memakai satu snapshot. Tekstur GPU dipakai ulang; tidak ada texture baru yang ditimbun untuk setiap frame. Menutup workspace sekaligus jendela output melepaskan history dan resource Organic. Konfigurasi artistik tetap tersimpan pada sesi; Freeze dan cap lama dilepas.

WebGL mengolah deformasi serta komposisi pada target 256 × 256. Hasil monokrom yang sama dikirim ke preview dan Clean melalui jalur Projection yang sudah ada. Browser tanpa WebGL memakai CPU 128 × 128. Pembesaran dapat memperlihatkan tepi berundak, terutama pada fallback. Raster akhir proyeksi masih mengikuti pengaturan Sprint 2.

Panel menampilkan durasi komposisi terukur, jumlah history, serta jumlah bekas. Ekspor hasil ukur browser menyertakan status Organic. Target 30 FPS, sesi fisik 20 menit, dan latensi gerak-ke-cahaya tetap memerlukan pengukuran pada Mac serta proyektor yang dipakai.

## Rangkaian latihan Organic 60 detik

| Waktu | Aksi aktor dan operator |
| --- | --- |
| 00–10 s | Utuh. Aktor berjalan dan mengangkat lengan. |
| 10–20 s | Melar, pegangan tangan, Lokal. Aktor menahan dan menggeser tangan. |
| 20–30 s | Terbelah, tiga pita horizontal. Operator membuka jarak lalu menyatukannya. |
| 30–45 s | Utuh + Echo, empat lapisan dengan jarak 600 ms. Aktor berjalan menyamping. |
| 45–60 s | Bergabung dengan pasangan tertunda, lalu Freeze. Aktor keluar dari bingkai. Blackout menutup rangkaian. |

Catat bentuk yang terbaca pada kain, bagian yang terpotong, respons setelah tracking hilang, FPS/P95 dan komposisi ms. Rangkaian ini panduan uji, belum menjadi laporan hasil perangkat fisik.

## Kalibrasi bidang layar

1. Posisikan kamera, proyektor, dan layar atau kain. Tandai posisi tripod serta proyektor.
2. Buka tab Kalibrasi. Pilih Bidang layar · empat sudut.
3. Nyalakan Test Grid + crosshair, lalu tekan Live.
4. Geser titik 1 kiri atas, 2 kanan atas, 3 kanan bawah, dan 4 kiri bawah di preview. Empat titik harus tetap berurutan dan membentuk bidang cembung.
5. Angka X/Y memakai piksel raster output aktual. Tombol panah menggeser satu piksel; Shift + panah menggeser sepuluh piksel.
6. Preview memperlihatkan draf. Proyektor tetap memakai kalibrasi sebelumnya. Tekan Terapkan ke output untuk melihat hasilnya pada bidang fisik.
7. Ulangi penyesuaian hingga garis grid mencapai batas layar. Batalkan draf memanggil kembali kalibrasi yang sedang dipakai output.
8. Simpan kalibrasi dengan nama ruang dan posisi kamera. Matikan Test Grid setelah selesai.

Reset Calibration meluruskan sudut bidang dan mematikan registrasi titik dalam draf. Terapkan untuk mengirim perubahan. Pengaturan offset, skala, rotasi, dan crop tersedia terpisah di tab Gerak.

Ukuran yang tampil mengikuti renderer output selama heartbeat tersambung. Saat output belum dibuka, panel memakai ukuran preview. WebGL memakai raster 1280 × 720 atau 1920 × 1080. Renderer cadangan Canvas 2D memakai 480 × 270. Normalisasi koordinat menjaga proporsi saat resolusi berubah; kecocokan pada bidang fisik tetap perlu diperiksa.

## Pasangan titik kamera–proyektor

Empat sudut bidang layar mengubah bentuk komposisi. Registrasi memakai titik yang benar-benar cocok antara gambar kamera dan bidang fisik yang disinari proyektor.

1. Ratakan layar. Letakkan empat tanda yang berjauhan pada satu bidang fisik. Beri angka 1–4 searah jarum jam, mulai dari kiri atas dalam gambar kamera.
2. Buka Kalibrasi → Pasangan kamera–proyektor. Preview kamera asli muncul di bawah komposisi. Gambar sumber ini selalu memakai orientasi kamera asli.
3. Geser titik sumber 1–4 tepat pada empat tanda yang terlihat di kamera. Angka sumber memakai piksel kamera aktual.
4. Aktifkan Gunakan registrasi titik dan Test Grid + crosshair. Titik tujuan mengatur empat crosshair pada output. Tekan Terapkan ke output.
5. Geser titik tujuan sampai masing-masing crosshair jatuh pada tanda fisik dengan angka yang sama. Terapkan setiap penyesuaian dan periksa hasilnya pada kain.
6. Buka tab Gerak. Klik Luruskan penyesuaian gambar untuk mematikan cermin, mengembalikan offset dan rotasi ke nol, serta skala ke 1. Pilih Follow Body untuk kecocokan koordinat fisik.
7. Kembali ke Kalibrasi, periksa pasangan titik, lalu Simpan kalibrasi.
8. Matikan grid. Gerakkan objek atau aktor pada bidang uji dan catat selisih citra terhadap tanda fisik.

Registrasi memetakan koordinat kamera langsung ke raster proyektor. Transformasi empat sudut layar tidak dikalikan lagi; sudut layar membatasi area yang boleh menampilkan siluet. Cermin, rotasi, offset, Fixed Position, dan smoothing mengubah posisi artistik setelah/sebelum pemetaan. Mulai uji ketepatan dengan strength 0, Follow Body, cermin mati, offset 0, rotasi 0, dan skala 1.

Keempat pasangan selalu berada pada bidang fisik yang sama. Tubuh yang bergerak mendekat, menjauh, atau berputar keluar dari bidang itu dapat menerima cahaya yang meleset. Kalibrasi ini belum mengoreksi lensa, kedalaman, atau permukaan tubuh 3D.

## Gerak siluet dan smoothing

Tab Gerak langsung mengubah parameter visual yang sedang berjalan. Draf titik kalibrasi tetap menunggu Terapkan ke output.

| Kontrol | Respons di layar |
| --- | --- |
| Follow Body | Posisi siluet mengikuti pusat tubuh yang terdeteksi. |
| Fixed Position | Pusat siluet ditahan di tengah. Bentuk pose serta ukuran tubuh tetap diperbarui. |
| Putih penuh | Isi masker tubuh tampil putih. |
| Outline | Garis tepi masker tampil putih. |
| Offset X / Y | Geser gambar dalam satuan persentase bidang. |
| Skala | Besarkan atau kecilkan gambar, 0,25–3 kali. |
| Rotasi | Putar gambar dalam bidang dua dimensi. |
| Cermin proyeksi | Balik citra secara mendatar. |
| Crop kamera | Potong bagian gambar kamera asli sebelum cermin dan pemetaan. |
| Smoothing strength | Haluskan perpindahan pusat dan ukuran bounding box. Nilai 0 melepas filter. |
| Responsiveness | Percepat respons filter saat gerak makin cepat. |
| Tracking confidence | Tolak sampel pose di bawah ambang yang dipilih. |

Smoothing mengubah penempatan masker terbaru. Bentuk tangan, lengan, dan torso tetap berasal dari sampel terbaru. Filter tidak merata-ratakan gambar lama dan tidak membuat gema. Getaran detail kontur masih mengikuti kualitas segmentasi, cahaya, dan resolusi kamera.

Filter memperkecil konstanta waktu ketika gerak makin cepat. Nilai strength tinggi dapat membuat posisi terasa lebih lambat. Latih langkah cepat dan putaran bahu sambil membandingkan layar dengan tubuh. Setelah tracking pulih, filter mulai dari posisi baru agar citra tidak menyapu dari lokasi lama.

## Live, Hold, Fade, Blackout

| Tombol atau pilihan | Yang terjadi |
| --- | --- |
| Live | Tampilkan siluet terbaru atau pola kalibrasi. |
| Hold | Bekukan citra terakhir. Kamera serta suara terus berjalan. |
| Blackout | Padamkan output, termasuk saat Hold atau grid aktif. |
| Reset | Lepas citra tertahan, matikan pola, lalu masuk Blackout. Kalibrasi tetap tersedia. |
| Tracking hilang: Hold | Tahan citra terakhir sampai tubuh kembali terdeteksi. |
| Tracking hilang: Fade | Pudarkan citra terakhir selama durasi yang dipilih di tab Gerak. |
| Tracking hilang: Blackout | Padamkan citra saat sampel tidak lagi valid. |

Live pulih saat tubuh kembali terdeteksi. Hold manual menunggu tombol Live. Heartbeat Studio yang berhenti lebih dari 2,8 detik memadamkan output, termasuk saat Hold. Gambar Live juga dipadamkan saat kiriman masker berhenti. Blackout tetap bisa ditekan selama kamera belum tersedia.

Rekam audio menyimpan suara sintesis SOMA. Rekaman video proyektor belum tersedia. Mute audio tetap membiarkan visual bergerak.

## Preset kalibrasi versi 2

Simpan kalibrasi menyimpan draf yang terlihat di preview. Terapkan ke output mengirimnya ke proyektor. Kedua tombol mempunyai tugas terpisah.

Preset JSON memuat nama, mode, sudut bidang, pasangan titik, urutan TL/TR/BR/BL, matriks transformasi, cermin, rotasi, skala, offset, crop, smoothing, confidence, kebijakan kehilangan tracking, kamera, resolusi kamera, raster output, viewport, serta skala layar.

1. Isi Nama dan klik Simpan kalibrasi. Daftar menyimpan 20 preset terakhir di browser ini.
2. Pilih Buka kalibrasi untuk memuatnya ke preview.
3. Baca catatan perangkat. Kamera berbeda, resolusi berubah, atau ukuran viewport berubah perlu diperiksa sebelum Apply.
4. Preset tidak mengganti webcam secara otomatis. Pilih perangkat yang sesuai, nyalakan kamera, lalu periksa titik sumber.
5. Tekan Terapkan ke output setelah gambar cocok. Live/Hold/Blackout dan rekaman tetap mengikuti sesi.
6. Ekspor JSON untuk salinan. Impor memuat JSON ke preview; klik Simpan untuk menambahkannya ke daftar lokal.

Preset Sprint 1 tetap bisa diimpor. Preset lama belum mencatat perangkat. Matriks versi 2 diperiksa terhadap pasangan titiknya; nilai rusak, bidang menyilang, crop terlalu kecil, dan berkas lebih dari 60 KB ditolak.

## Membaca pengukuran

| Metrik | Yang benar-benar diukur |
| --- | --- |
| Tracking FPS | Laju sampel yang dilaporkan engine utama. |
| Umur sampel | Waktu sejak frame dikirim untuk deteksi, memakai clock browser. |
| Inferensi | Durasi panggilan detektor pada backend yang dipakai. |
| Pipeline kamera | Durasi kirim frame, deteksi, pemrosesan data dan penyalinan masker sampai callback utama. |
| Frame dilewati aplikasi | Sampel kamera teramati yang dilewati ketika worker masih sibuk. Tidak mencakup semua frame yang mungkin hilang di webcam atau OS. |
| Preview / Output FPS | Rata-rata cadence render pada 600 interval terakhir. |
| P95 frame time | Persentil 95 interval render browser pada jendela yang sama. |

Klik Ekspor hasil ukur browser untuk mengunduh JSON. Nilai kosong menandakan metrik belum tersedia. Output terputus tidak diberi angka FPS yang tampak masih live.

MediaPipe Body dicoba lewat satu classic worker dengan OffscreenCanvas. Browser yang belum mendukung jalur itu kembali memakai detektor utama. Panel menampilkan worker atau main setelah sampel fisik diterima. Webcam tetap dibuka sekali. Worker memproses satu frame pada satu waktu agar antrean gambar tidak menumpuk.

Angka browser tidak mencakup paparan sensor, scanout layar, HDMI, serta respons cahaya proyektor. Ukur gerak sampai cahaya lewat kamera eksternal. Jangan menuliskan umur sampel sebagai latensi end-to-end.

## Uji panggung 20 menit

Gunakan lembar kosong di bawah dan isi dengan pengamatan perangkat sebenarnya. Target rancangan: output 30 FPS; P95 gerak sampai cahaya maksimal 150 ms. Target belum dinyatakan tercapai oleh pengujian browser sintetis.

| Langkah | Catatan aktual |
| --- | --- |
| Catat Mac, browser, webcam, proyektor, resolusi dan jarak | Belum diuji fisik |
| Mulai sesi, buka audio dan rekaman, jalankan 20 menit | Belum diuji fisik |
| Menit 0, 5, 10, 15, 20: ekspor hasil ukur browser | Belum diuji fisik |
| Berjalan kiri/kanan, membungkuk, angkat kedua tangan | Belum diuji fisik |
| Mendekat, menjauh, putar bahu, berjongkok | Belum diuji fisik |
| Hilangkan tracking; coba Hold, Fade, Blackout dan pulih | Belum diuji fisik |
| Buka ulang output dan sambungkan ulang webcam | Belum diuji fisik |
| Simpan, ekspor, impor, Apply; cocokkan titik | Belum diuji fisik |

Uji galat bidang datar: pasang lima tanda uji tambahan di antara empat titik kalibrasi. Pakai pusat, tengah sisi, atau titik lain yang tidak dipakai menyusun matriks. Ukur jarak antara cahaya hasil pemetaan dan tanda fisik dalam cm. Catat setiap titik, rata-rata, dan selisih terbesar. Pengujian empat titik pembentuk matriks saja belum cukup.

Uji latensi: rekam tubuh dan hasil proyeksi dalam satu bidikan kamera berkecepatan tinggi. Catat FPS kamera eksternal yang benar-benar dipakai. Untuk setiap gerak, hitung selisih frame antara perubahan tubuh dan perubahan cahaya, lalu kalikan 1000/FPS kamera. Ukur paling sedikit 30 gerak dan hitung median serta P95. Resolusi waktu pengukuran mengikuti FPS kamera eksternal.

## Body Mapping eksperimental

Batasi pengujian pada satu aktor, satu kamera, satu proyektor, dan area bertanda. Mulai pada jarak tetap. Pakai body mask dan offset manual untuk mencocokkan citra pada bidang uji.

Catat galat saat aktor maju, mundur, memutar bahu, dan berjongkok. Perubahan kedalaman serta permukaan tubuh tidak dikoreksi oleh homografi 2D. Cahaya belum dijamin menempel pada kulit dalam ruang tiga dimensi.

## Menjalankan kode di Mac

Unduh KODE SUMBER dari SOMA. Ekstrak ZIP dan buka Terminal pada folder yang memuat package.json. Pasang Node.js LTS dari https://nodejs.org/en/download.

```sh
npm ci
npm run setup:assets
npm run dev
```

Buka http://localhost:4173. Model/WASM disiapkan oleh setup:assets. Skrip predev dan prebuild menyalin bundle MediaPipe yang dipakai worker dari versi paket terkunci. Jangan membuka index.html langsung sebagai file.

```sh
npm test
npm run build
```

## Batas dan Sprint 4

Studio 12 menambahkan Organic Body Engine, Stretch/Shrink, Split, Delay/Echo/Freeze, Merge/Residue, preset artistik serta cue. Semua efek memakai siluet 2D dari engine utama. Kalibrasi bidang dan registrasi pasangan titik tetap bekerja pada hasil komposisi.

Sprint 4 menyiapkan Archive Fusion & Semantic Data Mapping: tekstur foto/video/teks serta data yang memengaruhi kontrol bentuk. Fitur tersebut belum aktif di modul Projection. Bahan teks/foto dan Archive SOMA lama tetap tersedia pada workspace masing-masing.

## Sumber teknis

MediaPipe Pose Landmarker Web: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js

OpenCV, homografi bidang: https://docs.opencv.org/4.13.0/d9/dab/tutorial_homography.html

MDN Window Management: https://developer.mozilla.org/en-US/docs/Web/API/Window_Management_API

MDN postMessage: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage

Apple extended desktop: https://support.apple.com/en-gb/guide/mac-help/mchlb5f905a1/mac
