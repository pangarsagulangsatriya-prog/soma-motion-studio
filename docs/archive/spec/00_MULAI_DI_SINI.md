# SOMA / ARCHIVE — Paket Prompt untuk Astra

**Proyek:** peningkatan aplikasi SOMA yang sudah berjalan untuk kebutuhan pertunjukan langsung *UNPACKING: Orang-Orang yang Menunggu Kapal*.

## Cara mengirim

1. Buka proyek/repository SOMA yang **sedang digunakan**, bukan proyek baru.
2. Kirim `01_PROMPT_UTAMA_ASTRA.md` sebagai instruksi utama. Idealnya lampirkan juga tangkapan layar SOMA saat ini dan gambar teks Tillema (1919).
3. Lampirkan `02_SPESIFIKASI_TEKNIS.md`, `03_ARSIP_TILLEMA_1919.md`, `05_UJI_PANGGUNG_DAN_KONTROL_OPERATOR.md`, dan `06_PANDUAN_DRAMATURGI.md` sebagai konteks dan kriteria uji.
4. Gunakan prompt per tahap di `04_PROMPT_TAHAPAN_IMPLEMENTASI.md` secara berurutan. Minta Astra **mengerjakan kode, menjalankan tes, dan menunjukkan perubahan**; jangan berhenti pada mockup atau perencanaan.
5. Apabila Astra hanya menerima satu dokumen, kirim `SOMA_ARCHIVE_MASTER_GABUNGAN.md` (di luar folder atau pada paket ZIP).

## Yang ingin dicapai

- Arsip **teks, foto, dan video** dapat menjadi bahan interaksi tubuh secara langsung.
- Data gerak dari **satu atau dua aktor** mengubah **teks dan rekaman suara** dengan aturan yang dapat diubah dari panel Studio.
- Ada **mode pertunjukan**: proyeksi Clean, konsol operator, tombol cue/fallback, pemulihan jika kamera kehilangan tubuh, serta suara yang tidak terduplikasi.
- **Arsip historis dijaga keutuhannya.** Distorsi untuk panggung terjadi pada tampilan/suara turunan; teks asli tetap dapat dipanggil.
- Pengembangan bersifat **additive / backward compatible** terhadap fitur SOMA sekarang: Hand, Body, Face, Mouse, synth, preset, rekaman, Studio/Clean.

## Berkas

| Berkas | Kegunaan |
|---|---|
| `01_PROMPT_UTAMA_ASTRA.md` | Perintah utama pengembangan lengkap |
| `02_SPESIFIKASI_TEKNIS.md` | Kontrak modul, data, respons gerak, arsitektur audio dan output |
| `03_ARSIP_TILLEMA_1919.md` | Konten sumber pertama, provenance, pemetaan kata dan tiga adegan awal |
| `04_PROMPT_TAHAPAN_IMPLEMENTASI.md` | Prompt audit, implementasi bertahap, integrasi, dan pengujian |
| `05_UJI_PANGGUNG_DAN_KONTROL_OPERATOR.md` | Matriks uji langsung, prosedur operator, mitigasi gangguan |
| `06_PANDUAN_DRAMATURGI.md` | Prinsip artistik dan parameter penilaian selama latihan |

**Peringatan:** paket ini berupa spesifikasi dan prompt. Belum ada klaim bahwa fitur sudah terpasang atau teruji pada kamera dan proyektor sungguhan.
