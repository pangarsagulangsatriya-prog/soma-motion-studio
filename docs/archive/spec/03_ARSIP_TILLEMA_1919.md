# SOMA / ARCHIVE — Bahan Arsip Awal: Tillema (1919)

**Konteks:** fragmen untuk *UNPACKING: Orang-Orang yang Menunggu Kapal*, khususnya tubuh yang beristirahat di kawasan Tanjung Priok dan cara seorang pengunjung kolonial menggambarkannya.

## Sumber dan tingkat kepastian

Dalam gambar yang diberikan pengguna, sumber dicantumkan:

> H. F. Tillema. (1919). *Kampongwee!*. Groningen, hlm. 2. Dikutip dalam Arjan Veering (2014), *Breaking the Boundaries: The Uniekampong and Modernization of Dock Labour in Tanjung Priok, Batavia (1917–1949)*, hlm. 225–226, catatan kaki 20.

**Batas verifikasi:** ejaan fragmen Belanda dan terjemahan Indonesia **ditranskripsikan dari gambar pengguna**. Dokumen primer dan halaman Veering belum dibandingkan ulang. Jangan mengklaim bahan sebagai hasil pemeriksaan independen terhadap buku asli. Penambahan suara/rekaman kelak dibuat baru dan harus diberi label pembacaan kontemporer.

## Kutipan Belanda dan terjemahan kerja (sesuai gambar)

| ID | Kutipan Belanda | Terjemahan kerja bahasa Indonesia |
|---|---|---|
| TIL-01 | `een paar kinine-tabletten ingenomen` | Telah meminum beberapa tablet kina. |
| TIL-02 | `slapende menschen, liggend op de steenkool, blootgesteld aan de steken der beruchte muskieten van Tandjong Priok` | Orang-orang yang sedang tidur, berbaring di atas batu bara, terkena gigitan nyamuk Tanjung Priok yang terkenal ganas. |
| TIL-03 | `Je reinste zelfmoord` | Benar-benar bunuh diri. |

> **Catatan editorial:** jangan mengganti `Tandjong` menjadi `Tanjung` dalam teks Belanda. Jangan secara otomatis menyebut semua `slapende menschen` sebagai buruh dalam metadata kutipan: teks pendek yang tersedia menyebut `orang-orang yang sedang tidur`. Hubungan dengan kerja pelabuhan perlu ditandai sebagai konteks interpretasi pertunjukan, bukan isi eksplisit fragmen tersebut.

## Teks Indonesia lebih panjang yang tampak pada gambar

> Perjalanan itu terasa menyeramkan. Sebelum berangkat, sebagian besar anggota rombongan yang memahami persoalan tersebut telah meminum beberapa tablet kina. Mereka melakukannya agar tidak terserang malaria selama kunjungan.
>
> [...]
>
> Gundukan-gundukan kecil yang baru terlihat setelah diamati dengan saksama ternyata orang-orang yang sedang tidur. Mereka berbaring di atas batu bara, terkena gigitan nyamuk Tanjung Priok yang terkenal ganas.
>
> “Benar-benar bunuh diri,” kata salah seorang anggota rombongan.
>
> Seorang lainnya berkomentar, “Sekarang kita bisa melihat betapa kurangnya pemahaman tentang kesehatan dan kebersihan di kalangan penguasa setempat.”
>
> [...]
>
> Kami pulang dengan kesan yang mendalam.

Status paragraf: **transkripsi kerja dari layar terjemahan yang diberikan pengguna**, bukan transkripsi Belanda lengkap. Pertahankan tanda `[...]` sebagai bagian teks terpotong. Jangan merekonstruksi bagian yang hilang menggunakan generasi teks.

## Rancangan sumber digital

- `TIL-1919-NL-01`, `TIL-1919-NL-02`, `TIL-1919-NL-03`: ketiga kutipan Belanda dalam entri sendiri, beratribusi sama.
- `TIL-1919-ID-01`, `TIL-1919-ID-02`, `TIL-1919-ID-03`: pasangan terjemahan Indonesia yang mengikuti gambar.
- `TIL-1919-ID-CONTEXT`: paragraf Indonesia panjang, berstatus `working-transcription-secondary`.
- Simpan `originalText` immutable, `stageView` atau `renderTokens` sebagai turunan. Semua perubahan artistik dapat di-reset.

## Pemetaan token awal

### Preset A: TIDUR / ACCUMULATION

- Sumber: `TIL-02` Belanda/Indonesia.
- Token sasaran ID: `tidur`, `berbaring`, `batu bara`.
- Input: tinggi tubuh, orientasi torso, durasi diam.
- Visual: teks awal utuh → baris memampat → `tidur` berulang di beberapa posisi, dipicu oleh durasi diam.
- Audio: rekaman Indonesia memutar kalimat lengkap; saat tubuh berada dalam pose rendah-horizontal stabil, loop segmen `tidur` mulai perlahan lalu bertambah rapat dengan batas polyphony.
- Reset: bangun atau cue operator; fade audio dan pengembalian baris secara bertahap.
- Larangan: efek tidak pernah mengganti/menambah kata pada data sumber.

### Preset B: NYAMUK / SWEEP

- Sumber: `TIL-02` Belanda/Indonesia.
- Token sasaran: `nyamuk`, `gigitan`, `muskieten`, `steken`.
- Input: sapuan tangan A atau B; kecepatan dan arah.
- Visual: token sasaran menjauh dari pergelangan tangan dan kembali setelah delay terukur.
- Audio: potongan kata `nya / muk` **hanya jika sudah ada segmen rekaman yang disiapkan**; alternatifnya loop segmen kata utuh `nyamuk`. Jangan membuatnya seolah potongan transkrip Belanda historis baru.
- Batas: setiap efek triggered maksimal per cooldown untuk menghindari bunyi berlebihan.

### Preset C: PENILAIAN / VOICE RESISTANCE

- Sumber: `TIL-03`.
- Input: pose dua aktor/trigger manual cue.
- Visual: `Je reinste zelfmoord` muncul **utuh dahulu**, disusul pemisahan atau pergeseran mengikuti langkah actor A.
- Audio: satu pemutaran Belanda lalu terjemahan Indonesia sesuai cue. Opsional: efek `resists gesture` saat tangan menggeser teks tetapi suara tetap berlangsung.
- Kunci dramaturgi: perbedaan antara tubuh yang beristirahat dan komentar seorang pengunjung kolonial tetap terbaca.

## Rekaman pembacaan

Sediakan dua slot file audio untuk setiap kutipan (NL / ID), dengan metadata:
- pembaca, tanggal rekaman, bahasa, metode rekaman;
- file asset reference, durasi, gain trim;
- daftar timecode kata (manual dahulu);
- status `belum direkam` / `siap dimainkan`.

Pembacaan itu **rekaman masa kini**, bukan suara asli Tillema tahun 1919. Bila belum ada file, UI menampilkan prompt impor dan tetap bisa menguji efek teks lewat kontrol manual.
