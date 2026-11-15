# SOMA — Deployment policy

## Hosting aktif
- **Production:** Vercel, sumber branch `main`.
- **GitHub Pages:** workflow manual saja. Fitur ini hanya boleh dipakai setelah GitHub Pages diaktifkan di repository settings; Vercel tetap hosting utama.

## Branch dan pemicu deploy
- `feat/**`, `fix/**`, `chore/**`, dan `wip/**`: pengembangan. **Tidak membuat Preview Vercel otomatis** melalui `vercel.json`. Tetap jalankan GitHub Actions `Verify SOMA changes` pada push maupun PR.
- `preview/**`: branch khusus untuk preview yang sudah lolos pemeriksaan. Vercel tetap membangun branch ini, karena tidak termasuk daftar yang dinonaktifkan.
- `main`: deploy Production Vercel setiap merge. Jangan push perubahan kode yang belum melewati tes.

## Rilis yang dianjurkan
1. Kembangkan dalam branch kerja; lengkapi seluruh file yang saling bergantung.
2. Periksa `npm ci`, `npm test`, dan `npm run build`; pastikan GitHub Actions hijau.
3. Jika perlu uji preview di Vercel, pindahkan kode siap uji ke `preview/<nama-fitur>` lalu periksa deployment.
4. Buka PR ke `main` dari commit yang lolos tes. Merge setelah semua pemeriksaan selesai.
5. Periksa status Deployment Production Vercel dan cocokkan SHA commit di `main`.

## Cara membaca error historis
Vercel membuat deployment per commit untuk branch yang diizinkan. Build dari commit yang belum lengkap dapat gagal walaupun commit lanjutannya sudah memperbaiki kode. Entri Error lama tetap tersimpan sebagai riwayat dan **tidak mengubah** deployment Production terbaru yang Ready. Filter **Environment = Production** untuk melihat status produksi.

## Bila deploy GitHub Pages gagal
Alur tersebut sudah dibuat manual. Log sebelumnya menunjukkan build sukses tetapi `actions/deploy-pages` mengembalikan 404 karena GitHub Pages belum diaktifkan. Aktifkan di `Settings → Pages` bila ingin memakai hosting kedua, lalu jalankan workflow manual.

## Catatan
Pengaturan `git.deploymentEnabled` di `vercel.json` berlaku untuk deployment baru. Ia tidak menghapus atau mengubah status deployment lama. Jangan memasukkan kata sandi, token Vercel, atau file `.env` ke repository.
