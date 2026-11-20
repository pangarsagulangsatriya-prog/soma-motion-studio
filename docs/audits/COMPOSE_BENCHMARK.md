# SOMA — Compose Benchmark & Technology Evaluation
**Tanggal:** 20 November 2026  
**Fokus:** Interactive Floor Projection (**LUMOplay**) + Creative Coding Live Performance Visuals (**TouchDesigner**, **Resolume Arena 7**, **Hydra**, **teamLab**)

---

## 1. Benchmark Interaksi Lantai: LUMOplay (Dokumentasi Resmi)
Prinsip yang terverifikasi dari dokumentasi resmi LUMOplay untuk instalasi *interactive floor* (kamera depth seperti Intel RealSense / Orbbec Astra / Kinect):
1. **Respons instan pada zona terkalibrasi:** Saat kaki memasuki area masker lantai yang sudah dikalibrasi, efek jejak (*Footprints* / *particle trail*) muncul tepat di posisi sentuhan tanpa lag visual.
2. **Pemisahan zona masker & reduksi noise:** Kalibrasi mendefinisikan area lantai aktif, mengabaikan area luar proyeksi, dan memisahkan sensitivitas agar bayangan atau objek diam tidak memicu jejak palsu (*0 duplicate stamp saat diam*).
3. **Konfigurasi aset kiri/kanan yang jelas:** Template jejak kaki membedakan telapak kiri/kanan dan tidak menyamarkan uji pratinjau dengan deteksi live.
4. **Batasan jujur SOMA vs LUMOplay:** LUMOplay memakai *depth camera* (jarak Z fisik terhadap bidang lantai), sedangkan SOMA Stage 1 memakai kamera RGB monokular + MediaPipe Pose. Karena itu SOMA **tidak mengklaim sensor tekanan/depth**; SOMA mengompensasinya dengan hysteresis fase stance/swing, homografi 4 sudut di Map, serta pelabelan provenance jujur (`LIVE DETECTED` / `VIDEO ESTIMATE` / `SIMULATION` / `DEMO SYNTHETIC`).

---

## 2. Benchmark Estetika & Steering Creative-Coding Performance
Dari praktik pertunjukan visual real-time (**TouchDesigner**, **Resolume Arena 7**, **Hydra-synth**, **teamLab**):
1. **Pustaka gaya visual yang kurasi & responsif (*Style Library*):** Operator kreatif tidak hanya menginginkan satu warna tinta; mereka butuh beberapa karakter shader GPU yang berbeda drastis secara atmosfer (organik cair, neon vektor/flux, termal bara, aurora spektral, topografi garis vektor, riak kromatik) namun **tetap terikat secara anatomis pada mask telapak yang terdeteksi**.
2. **Kontrol *Live Steering* (Macro XY Pad + Real-Time Uniforms):** Dalam pertunjukan panggung, performa visual "disetir" secara halus menggunakan pad 2D (`Flow × Turbulence`) dan slider makro (`Glow`, `Hue Shift`, `Pulse`) tanpa memutus *frame* atau membongkar *scene graph*.
3. **Satu Engine GPU Ringan:** Semua gaya visual berjalan sebagai variasi uniform/branch di dalam **satu WebGL2 fragment shader PixiJS v8** yang sudah ada—nol *WebGL context* tambahan, nol dependency baru, 60fps-capable, dan 100% mempertahankan gerbang keamanan proyektor.

---

## 3. Matriks Evaluasi Repositori Pembanding

| Repositori | Kemampuan Utama | Manfaat untuk SOMA Compose | Lisensi | Kesiapan Browser | Risiko | Keputusan | Alasan |
|---|---|---|---|---|---|---|---|
| `google-ai-edge/mediapipe-samples` | Referensi landmark Pose 33 titik (ankle 27/28, heel 29/30, toe 31/32, hip 23/24) + segmentasi | Validasi indeks landmark & konvensi visibilitas kaki yang sudah dipakai `GaitAnalyzer` | Apache-2.0 | Tinggi (WASM/WebGL) | Rendah — `@mediapipe/tasks-vision` sudah terpasang | **REFERENCE** | SOMA sudah mengintegrasikan `@mediapipe/tasks-vision`; cukup selaraskan penerusan `headingRad` dan fase gait tanpa menambah paket. |
| `tensorflow/tfjs-models` (`pose-detection` / MoveNet) | Deteksi pose 17 keypoint ringan (MoveNet Single/MultiPose) | Pembanding latensi untuk deteksi tubuh cepat | Apache-2.0 | Tinggi (WebGL/WebGPU) | **Tinggi untuk Footprints**: MoveNet hanya 17 keypoint **tanpa landmark heel & toe**, sehingga tidak bisa menghitung sudut heel→toe telapak! | **REJECT** | Tanpa landmark tumit & jari kaki (heel/toe), orientasi telapak akurat tidak dapat dihitung; MediaPipe 33-point jauh lebih tepat untuk SOMA. |
| `Eric-Canas/Homography.js` | Estimasi matriks homografi 2D dari pasangan titik | Referensi transformasi kamera → lantai | MIT | Tinggi (JS murni) | Rendah; duplikasi fungsional | **REFERENCE** | `src/projection/geometry.ts` & `src/footprints/spatial/coordinates.ts` di SOMA sudah menyediakan homografi 4-titik teruji (unit test + grid 9-titik). Tidak perlu dependency baru. |
| `hydra-synth/hydra-synth` | Live-coding video synth & feedback shader | Inspirasi modulasi warna/osila/feedback kreatif | **AGPL-3.0** | Tinggi (WebGL) | Konteks WebGL kedua jika dijalankan paralel dengan PixiJS; kewajiban lisensi AGPL sudah dipenuhi di footer | **REFERENCE (KEEP ISOLATED)** | Sudah terpasang di SOMA Labs, namun untuk Compose Footprints kita gunakan shader GLSL terpadu di dalam PixiJS agar hanya **1 konteks WebGL2** dan tidak melanggar arsitektur RESET-00. |
| `pixijs/pixijs` (v8) | Renderer WebGL2/WebGPU terkelola dengan custom `Filter` & `CanvasSource` | Menjalankan seluruh 6 gaya visual + live steering dalam 1 konteks WebGL2 di atas mask telapak 5-jari | MIT | Sangat Tinggi | Perlu manajemen tekstur & dispose ketat (sudah diterapkan di `PixiLiquidImprintCompositor`) | **ADOPT (EXISTING)** | Sudah terpasang di `package.json` dan terbukti stabil (`contexts: 1`); memperluas shader PixiJS adalah jalur terbersih, tercepat, dan nol bloat. |
