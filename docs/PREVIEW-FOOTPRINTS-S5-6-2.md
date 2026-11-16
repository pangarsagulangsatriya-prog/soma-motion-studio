# SOMA Footprints — S5.6.2 Adaptive Gait Preview

Preview branch untuk PR #14, berasal dari commit `1af83f8b653b84ab9ecdb95c2dd1681af01a6278`. Production tidak berubah.

Studio → Footprints → **Live Floor Tracking · Kamera** → kalibrasikan kamera/lantai → jalankan gerakan kaki. Di bagian 02 / Floor Coordinates tampil indikator gait untuk masing-masing kaki: **Hold, Step, Pivot, Slide**.

Lakukan uji gerakan lambat, berdiri, membungkuk dengan telapak tetap, pivot, geser, keluar-masuk kamera, dan dua performer. Geseran yang cukup jauh tercatat sebagai event `move`; tidak menambah contact stamp kedua.

Dokumen pengujian: `docs/FOOTPRINTS-S5-6-2-ADAPTIVE-GAIT.md`. Hasil tes otomatis tidak membuktikan akurasi pijakan fisik atau tingkat kesalahan saat menonton aktor sebenarnya. Gunakan data video dan pengukuran S5.5 untuk validasi sebelum Production.
