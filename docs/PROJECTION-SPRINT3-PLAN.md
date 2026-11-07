# Sprint 3 — rencana implementasi, 29 Oktober 2026

Baseline: Studio 11, commit 839f2b963f931b9a2612673ceba11733670b52c7. Kamera dan MotionFrame bersama, body mask, kalibrasi v2, output terpisah serta fallback Canvas 2D tersedia. Uji perangkat fisik tetap belum tersedia pada lingkungan ini.

Urutan perubahan:
1. organic/config.ts, history.ts, shape.ts: konfigurasi artistik terpisah, riwayat bertimestamp dengan masker 128² dan batas 300 sampel, deformasi lokal/global berbasis landmark serta pembagian bidang.
2. organic/compositor.ts, engine.ts: shader WebGL pada render target 256², fallback CPU 128², Delay/Echo/Freeze/Merge/Residue. Hasil monokrom masuk kembali ke Calibration Engine. Preview dan output menerima masker komposisi yang sama, bukan dua mesin riwayat yang dapat bergeser waktunya.
3. useOrganic.ts, OrganicPanel.tsx: kontrol live, preset artistik dan cue dengan transisi. Preset artistik menyimpan referensi kalibrasi untuk catatan; recall tidak mengubah perangkat atau titik kalibrasi.
4. model/useProjection/channel/renderer/output: salurkan landmark dan masker terolah, hindari crop/smoothing ganda, pertahankan prioritas Blackout dan Hold, bebaskan resource ketika workspace/output berhenti.
5. Unit test geometri, timestamp, batas buffer, freeze, recovery dan validasi. Browser integration pada App nyata dan dua jendela, dengan batas kamera sintetis yang dinyatakan jelas. Regresi Sprint 2 dan kamera gestural.
6. Panduan operator, laporan hasil aktual, paket sumber, build dan publikasi Studio 12.

Perilaku yang ditetapkan:
- Freeze menyimpan komposisi sebelum kalibrasi, tetap tampil ketika aktor keluar; Release kembali ke aliran live. Hold transport membekukan komposisi. Blackout mengalahkan semua efek serta grid.
- Delay menunggu history yang cukup; tidak mengarang frame sebelum rekaman. Buffer menyimpan data baru hingga 24 sampel/detik, maksimal 300 sampel dan 12 detik. Riwayat lama dibuang; cue tidak menyimpan piksel webcam.
- Split anatomis memakai tiga pita berdasarkan kepala/bahu/panggul sebagai perkiraan 2D. Kontur tersembunyi tidak direkonstruksi.
- Residue menyimpan maksimal 24 cap komposisi. Screen-space mempertahankan posisi cap ketika aktor bergerak; Body-clipped membatasi bekas dengan siluet terbaru. Kalibrasi tetap bekerja pada seluruh komposisi.
- Merge memakai satu aktor: tubuh terbaru dengan tubuh tertunda atau pasangan yang ditangkap operator.
- Klaim 30 FPS, GPU pada Mac, akurasi proyektor, latensi gerak-ke-cahaya dan sesi fisik 20 menit menunggu pengukuran perangkat sebenarnya.
