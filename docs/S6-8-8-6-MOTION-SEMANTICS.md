# SOMA — S6.8.8.6 Motion Semantics

## Tujuh event terukur
- **Contact, Swing, Pivot:** transisi gait yang telah disetujui oleh QA A/B. Event dilampirkan ke jalur semantik; tidak dihitung ulang dari bentuk postur.
- **Reach:** pergelangan bergerak menjauhi bahu pada panjang >= 1,35 kali torso (jarak bahu–pinggul) dan kecepatan radial >= 0,035 unit koordinat gambar/dtk.
- **Bend:** siku/lutut menekuk >= 48° relatif terhadap posisi lurus, dengan pertambahan fleksi >= 16°/dtk.
- **Turn:** orientasi garis bahu berubah >= 35°/dtk pada bidang gambar 2D. Perputaran ini tidak mengukur yaw 3D.
- **Hold:** bahu, pinggul, dan setidaknya satu pergelangan kaki bergerak <= 0,035 unit koordinat gambar/dtk selama >= 650 ms.

## Sinyal, status, dan output
Event Reach/Bend/Turn memerlukan minimal dua sampel berturutan pada interval waktu video; Hold memerlukan durasi nyata 650 ms. Hysteresis menekan event berulang. Event memuat timestamp, actor A/B, sisi/lengan/kaki, confidence, nilai, ambang, satuan, durasi dan bukti. Historinya dibatasi 1.600 event per segmen. Event lama dikosongkan ketika sumber video diganti, seek atau loop.

Semua event hanya diturunkan dari data valid yang telah dikaitkan dengan aktor A/B oleh Identity Recovery QA. Aktor B yang hilang tidak menghentikan A. Status A/B yang belum pasti tidak menghasilkan event semantik baru.

## Penggunaan
Buka Footprints → Video MP4 → Lanjutan → Video Motion Lab, jalankan analisis, buka Motion Semantics. Pilih aktor A/B dan jenis event. Panel memperlihatkan hitungan, posisi waktu, nilai terukur, dan ekspor CSV segmen aktif.

## Batas ilmiah
Gerak dilihat dari satu kamera video 2D dengan estimasi landmark. Contact tidak mengukur tekanan, gaya atau lantai sebenarnya. Turn mengukur rotasi sumbu bahu pada bidang gambar, bukan yaw tubuh 3D. Threshold bersifat eksploratif dan masih perlu pengujian dengan rekaman dua aktor asli, termasuk false positive / false negative dan variasi sudut kamera. Event ini tidak dapat membuka output fisik proyektor.
