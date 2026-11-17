# SOMA — S6.8.8.5 Identity & Occlusion Recovery

## Peran dan batas
Pengamatan A/B mengikuti riwayat pose selama segmen MP4 yang sedang diputar. Huruf A/B menandai lintasan, bukan identitas biometrik. Model tetap hanya membaca dua pose MediaPipe dari satu kamera.

## Status per aktor
- **Terlihat:** pose sekarang memiliki kecocokan lintasan.
- **Tertutup:** pose hilang sebentar, belum ada koordinat pengganti.
- **Memulihkan ID:** kandidat kembali muncul dan harus konsisten selama tiga observasi. Pose tetap berwarna netral hingga lolos.
- **Belum pasti:** terjadi persilangan dengan kecocokan yang tidak dapat dipercaya. Dalam situasi tanpa riwayat gerak sebelumnya, identitas tidak otomatis diberikan.
- **Keluar frame:** pose belum muncul kembali setelah periode hilang.
- **Belum ditemukan:** lintasan aktor belum pernah terbentuk.

## Perhitungan
Pelacak memadukan pusat bahu/pinggul, posisi sebelumnya, dan perkiraan arah gerak untuk membandingkan urutan pose pada frame berikutnya. Dua kandidat dengan jarak atau skor terlalu dekat ditahan. Setelah persilangan, kandidat harus konsisten tiga frame sebelum dipulihkan; event gait mengikuti pemeriksaan QA lanjutan selama tiga frame per aktor. Hal ini mengurangi risiko pertukaran label, tetapi tidak menjamin identitas nyata setelah dua tubuh tertutup lama.

## Dampak terhadap mesin
Raw skeleton tetap muncul meskipun label A/B belum aman. TemporalJointAnalyzer dan HandLimbDetailAnalyzer hanya menerima assignment yang valid. Catatan tangan lama hilang begitu identitas aktor belum pasti. Gate event gait terpisah per aktor: A dapat terus menyumbang event ketika B keluar frame. Track B yang hilang menghapus hanya histori kontak dan gait B.

## UI
Video Motion Lab menampilkan status pose dan QA A/B terpisah. Saat satu aktor masih lolos QA, header menampilkan PARTIAL ACTIVE. Pengguna dapat menekan Reset identitas & event atau menggeser posisi video jika crossing tidak dapat direkonstruksi. Tidak ada dialog konfigurasi baru pada Stage.

## QA dan batas lapangan
Unit test mensimulasikan pertukaran urutan deteksi, persilangan dua arah, kehilangan aktor, kemunculan kembali, QA parsial, dan reset. Browser QA menjaga akses lab dan penguncian proyektor. Perlu uji dengan rekaman nyata dan ground truth untuk mengukur identity switches, IDF1, recall, recovery latency, serta false association sebelum menyatakan akurasi. Output fisik tetap terkunci untuk MP4.
