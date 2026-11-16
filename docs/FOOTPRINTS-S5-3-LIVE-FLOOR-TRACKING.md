# SOMA Footprints S5.3 — Live Floor Tracking

**Implementasi:** Stage-first SOMA Studio → Footprints → **Live Floor Tracking · Kamera**.
**Basis:** S5.0 physical Floor Coordinate/Event V3 → S5.1 Direct Puppet → S5.2 calibrated Projection Bridge.
**Status:** feature branch kandidat, perlu pengujian perangkat nyata; **belum production**.

## Fitur yang sudah dibangun

1. **Satu kamera dan satu GaitAnalyzer.** `StudioFootprints` meneruskan hasil `GaitAnalyzer.observe` dari `MotionFrame` Body yang sudah ada. Tidak ada webcam, MediaPipe, worker, maupun jaringan tambahan.
2. **Raw camera calibration.** Workspace membuka gambar mentah **tanpa mirror** untuk pengambilan titik fisik lantai. Operator menandai **1 upstage-left, 2 upstage-right, 3 downstage-right, 4 downstage-left** menurut posisi panggung yang sebenarnya. Titik dinormalisasi terhadap kotak video sesungguhnya, termasuk saat video 4:3 berada dalam canvas 16:9.
3. **Ukuran lantai dalam meter** (preset 6×4, 8×6, 10×7); perangkat dan ukuran lantai harus benar-benar sesuai panggung.
4. **Camera → floor homography.** `GaitAnalyzer` menghitung posisi kaki pada stage 16:9; `stageUVToRawCamera` menghapus aspect-fit, `calibratedGaitContact` memetakan posisi ke bidang lantai melalui empat sudut kamera.
5. **Footstep events.** `LiveFloorTrackingEngine` menerima swing/contact dari detektor gait yang sama. Pendaratan memunculkan satu contact event, fase ayun menghasilkan release pada posisi tumpuan terakhir, diam tidak menambah stamp, dan jitter kontak kecil tidak menggeser jejak.
6. **Grounding and confidence.** Sampel di luar floor quad, phase tidak pasti, atau confidence rendah tidak mencetak kaki. Event diberi `source:'camera'`, `positionBasis:'calibrated-estimate'`. Ini **estimasi berbasis gambar**, bukan hasil pengukuran ground reaction force.
7. **Perubahan kamera membatalkan kalibrasi.** Fingerprint menyimpan track stream aktif, deviceId dan resolusi video. Ketika kamera dilepas/diganti atau resolusinya berubah, live mapping dinonaktifkan; kontrol proyeksi kembali memerlukan konfirmasi.
8. **Shared floor projection.** Workspace memakai output SOMA Projection dan satu konfigurasi empat sudut proyektor yang sudah ada, melalui `ProjectionLink.sendArtwork`; tidak dibuat projector kedua. `live-floor` mengambil prioritas ketika workspace aktif, menghindari fallback diam-diam ke visual Footprints 2D lama.
9. **Physical floor safety gate.** Operator harus memeriksa sudut kamera, menguji sudut proyektor, lalu mengonfirmasi keduanya. Tanpa persetujuan kamera dan proyektor, output live floor dipadamkan. **Test Pattern** tetap tersedia terpisah untuk menampilkan empat marker lantai.
10. **Replay-ready JSON V3** dari contact/release/move events, dengan posisi meter dan identitas kiri/kanan. Simulator S5.1 tidak terganggu.

## Cara pengujian operator

1. Buka Preview → Studio → Footprints → **Live Floor Tracking · Kamera**. Pilih **Hubungkan Body** dan berikan izin kamera jika browser memintanya.
2. Siapkan empat tanda yang **dapat dilihat kamera** pada empat sudut bidang lantai. Pastikan seluruh sepatu/kaki dan lantai terlihat jelas dalam sudut kamera. Gunakan kamera tetap; jangan geser setelah kalibrasi.
3. Di gambar kamera mentah, klik empat titik berurutan: **kiri belakang (upstage-left), kanan belakang, kanan depan, kiri depan**. Perhatikan orientasi fisik panggung (kiri/kanan performer), bukan sekadar kiri/kanan layar.
4. Pilih ukuran lantai yang sesuai ukuran sebenarnya. Klik **Terapkan 4 titik kamera**. Setelah poligonnya valid, centang **Saya sudah memeriksa keempat sudut kamera**.
5. Jalan perlahan. Pastikan peta lantai menampilkan jejak kaki kiri/kanan. Coba berhenti, mengangkat kaki, bergerak keluar bingkai, lalu masuk kembali. Jejak saat diam tidak boleh mencetak ulang terus-menerus.
6. Di **Floor → Projection**, buka output, lakukan **Kalibrasi lantai** dengan Projection SOMA yang sama, dan terapkan konfigurasi. Kembali ke Live Floor.
7. Klik **Tanda 4 sudut uji**, lalu **Live**. Pastikan marker jatuh tepat pada batas lantai fisik. Ulangi kalibrasi proyektor apabila meleset.
8. Centang persetujuan **empat sudut proyektor** untuk mengaktifkan jejak live. Pilih **Live**, lalu uji **Hold** (gambar beku) dan **Blackout** (cahaya mati). Menutup workspace harus memadamkan output.
9. Simpan **JSON V3** sebagai arsip eksperimen. Ganti perangkat/resolusi kamera; konfirmasi lama harus batal dan meminta pengambilan empat titik baru.

## Detail teknis / batas data

| Lapisan | Input | Output |
| --- | --- | --- |
| SOMA CameraTracker | Video MediaStream terpasang sebelumnya | MotionFrame Body |
| GaitAnalyzer | Landmarks pinggul, pergelangan, tumit, ujung kaki | Phase/stamp/heading/confidence |
| LiveFloorTrackingEngine | GaitSample + camera binding | FloorSession v3, contact/release/swing |
| CameraFloorCalibration | Empat raw-image UV + widthM/depthM | Grounded floor coordinates (metre estimate) |
| FloorCanvas | FloorSession v3 | Unwarped 1280×720 artwork |
| ProjectionLink | Artwork frame + shared SOMA calibration | Output Live/Hold/Blackout |

- **Bukan dua performer live:** SOMA GaitAnalyzer saat ini memproses satu `frame.pose`. Untuk dua performer sekaligus, dibutuhkan tracking identitas dan multi-person confidence (S5.4); dua rig virtual S5.1 sudah terpisah.
- **Bukan prediksi langkah:** Event prediktif `prediction` masih tahap selanjutnya.
- **Bukan gait klinis:** phase stance/swing memakai heuristik perubahan posisi dari satu kamera RGB. Perspektif, oklusi, motion blur, pencahayaan, sepatu dan body tracking dapat mengubah hasil.
- **Bukan hasil pengukuran akurasi panggung:** tes unit geometri tidak membuktikan galat ≤10 cm. Uji dengan pita ukur, kamera dan proyektor fisik sebelum show.
- **Kamera mirroring:** kalibrasi harus dibangun dari gambar kamera mentah. Jika orientasi feed tidak cocok dengan urutan upstage/downstage, atur posisi kamera atau ulangi orientasi; tidak boleh mengubah titik ke urutan tidak cembung secara diam-diam.
- **Tidak menyimpan video:** hanya koordinat dan event JSON. Izin kamera tetap milik SOMA; browser permission dipakai hanya saat mengaktifkan kamera.
- **Fail safe:** mengganti device/track/resolusi, mengubah kalibrasi proyektor, menutup workspace, atau kehilangan persetujuan membuat live artwork gelap (test marker tetap dapat ditampilkan secara eksplisit).

## Unit tests & daftar manual

Tes otomatis: `tests/footprints-live-floor.test.ts` bersama suite S5.0–S5.2; `npm test` dan `npm run build` wajib lulus.

Manual: (belum dilakukan)
- 390×844, 768×1024, 1280×720; dialog, kamera, preview dan tombol tutup tidak terpotong.
- Izin kamera ditolak → ada pesan dan jalur percobaan ulang.
- Kamera 4:3 dan 16:9: marker tetap menunjuk gambar raw yang tepat; tidak mengikut letterbox.
- Jitter/occlusion: tidak muncul cetakan palsu saat kaki diam atau tracking putus.
- Pengaturan kamera berubah → approval batal.
- Empat marker floor → proyektor sesuai bidang fisik.
- Hold mempertahankan frame lama; Blackout padam bahkan saat kamera masih mendeteksi kaki.
- Live Footprints lama, Direct Puppet, studio audio dan Capture tidak berubah.

**Release:** PR S5.3 harus tetap draft di atas S5.2 sampai tes perangkat nyata selesai. Jangan merge chain S5.0–S5.3 tanpa memeriksa rangkaian CI dan panggung.
