# SOMA V5 — Unified Node Canvas / Performance Graph
**PRD + Arsitektur + Functional QA Contract · 23 November 2026**

**Status:** spesifikasi implementasi dan audit kode; **belum** menyatakan Node Canvas V5 terintegrasi ke proyektor produksi.  
**Target repository:** `pangarsagulangsatriya-prog/soma-motion-studio`  
**Target release:** GitHub Pages setelah pengujian, bukan deploy otomatis dari PRD.  
**Referensi artistik:** Figma `Unpacking: In Passing` (board `9Oj9BkxjBqZjSnhrvjnggW`) dan desain SOMA Unified Node Canvas V5 (Camera 01–03, Motion, Gesture, Footprint, Dual Trace, F1 recorder, F3 replay, FLOOR, CANVAS).

## 1. Keputusan produk

SOMA memakai **satu workspace node permanen**, dari membuka aplikasi hingga akhir pertunjukan. Semua sumber, proses, media, memory, compositing, dan output tampil sekaligus. **Fragmen/cue mengganti jalur yang aktif, bukan membuka workspace baru**. Panel detail muncul hanya ketika node dipilih. Preview output FLOOR dan CANVAS tetap terlihat.

Tujuan: operator bisa menyambungkan banyak kamera, melihat tepat ke mana frame dan data mengalir, mengatur ulang input, menjalankan F1–F2–F3, merekam gerak pada F1, dan memanggil rekaman tersebut pada F3 tanpa membuka ulang kamera atau mengulang konfigurasi proyek.

### Bukan lingkup rilis awal

- Meniru semua node TouchDesigner, shader bebas, scripting visual sewenang-wenang.
- Mengklaim 10 kamera fisik lancar pada semua laptop. 3 dan 10 adalah target **stress test**, kapasitas dikunci dari hasil benchmark hardware.
- Menghubungkan langsung output browser ke Spout/Syphon/Resolume secara ajaib. Gunakan jalur yang tersedia dan beri status dukungan jujur.
- Membolehkan sebuah cue otomatis menyalakan proyektor yang belum lolos QA fisik.

## 2. Audit aktual repository

| Kebutuhan | Implementasi yang ditemukan | Status terhadap V5 |
|---|---|---|
| Kamera banyak | `src/studio/v3/CameraHubRegistry.ts` menyimpan beberapa CameraTracker sepanjang navigasi; `CameraHubWorkspace.tsx` sudah memiliki canvas kamera; `App.tsx` memiliki registry persistent. | **Parsial**: Stage 1 diobservasi, Stage 2 masih ditandai belum terintegrasi, rute arbitrary engine belum tersedia. |
| Kamera F3 | `src/f3/F3CameraRegistry.ts` memiliki registry dua peran A/B, status frame, phone, MP4. | **Ada, terpisah** dari CameraHub; perlu adapter/ownership agar satu perangkat tidak dibuka dua kali. |
| Deteksi pose/jejak | `src/engine/tracking.ts`, `src/footprints/live/LiveFloorTrackingEngine.ts`, `src/footprints/dual-trace/`, `src/footprints/lines/v3/`. | **Ada engine**; butuh adapter typed dan sink terukur. |
| Capture | `src/f3/F3SessionMachine.ts`, `F3PunchEngine.ts`, `F3PhotoStore.ts`, `F3StageRenderer.ts`. | **Ada** persetujuan, 4-slot, frame freshness, gesture; belum node source/sink bersama. |
| Perekaman | `src/engine/recording.ts` berisi Recorder **audio** serta MotionLog sampel pose/gesture; data dibatasi 18.000 baris dan jeda 90ms. | **Tidak cukup** untuk replay footprint+stroke F1 secara deterministik; buat recorder event visual baru. |
| Session lokal | `src/stage/StageSessionStore.ts` menyimpan metadata dan media A/B pada IndexedDB. | **Bisa diadaptasi**; migrasi schema versi baru dengan recovery. |
| Dual projection | `src/footprints/stage-optics/DualSurfaceSessionStore.ts` memiliki output `body` dan `floor` terpisah, QA fisik, blackout. `src/projection/channel.ts` memiliki heartbeat, ACK, transport. | **Ada fondasi**; CANVAS V5 perlu adapter komposisi dan pemetaan, bukan sekadar mengganti label BODY. |
| Cue | `src/studio/v3/performCueModel.ts` punya 8 slot berisi view/scene footprint; `src/archive/cues.ts` punya state cue arsip terpisah. | **Belum cue graph** untuk empat keadaan F1/F2/F3A/F3B. |
| QA | `npm test`, `npm run build`, `e2e/*.spec.mjs`, `.github/workflows/verify.yml`, `pages.yml`. | **Basis regresi tersedia**, perlu pengujian V5 E2E. |

**Catatan penting:** PRD Camera Hub V1 (`docs/SOMA_CAMERA_HUB_NODE_WORKSPACE_PRD_V1.md`) dibuat sebelum kebutuhan *satu canvas lintas engine*. V5 menggantikan keputusan lokasi menu Camera Hub; jangan langsung menghapus fungsi kamera existing.

## 3. Satu layout; tidak ada workspace fragmen terpisah

- **Topbar:** SOMA / proyek, sumber terhubung, REC status, monitor FPS, warning, Save Graph, Fit All.
- **Canvas pusat:** pan/zoom, grup INPUT → DETECT → GENERATE → STORE/PLAY → COMPOSE → OUTPUT. Kamera bisa ditambah tanpa batas UI nominal; limit runtime mengikuti kapasitas.
- **Node INPUT:** Camera 01 (aktor A/B), Camera 02 (kaki penonton), Camera 03 (gesture), '+ kamera', MP4/arsip, Saved Session, Photo Bank. Status live berasal dari frame timestamp, bukan hanya perangkat terdeteksi.
- **Node PROCESS:** Pose/Motion, Gesture, Footprint, Dual Trace, 4-Photo Capture, Session Recorder, Trace Replay, Archive Composer.
- **Node OUTPUT:** FLOOR dan CANVAS (pinned, preview live berdampingan). Status heartbeat masing-masing, tombol blackout individual dan blackout all.
- **Inspector kanan (kontekstual):** detail 1 node/edge, source selection, preview besar, port compatibility, duration/decay, latency, error, retry.
- **Cue strip bawah:** F1 / F2 / F3 Capture / F3 Archive. Pilih cue hanya mengubah active graph. Tampilkan perubahan sebelum GO; latched LIVE tetap memerlukan QA dan operator.

Status `detected/connecting/live/degraded/stale/disconnected/unsupported` selalu memiliki label teks dan tooltip. Garis visual bisa cerah/redup mengikuti feed sebenarnya. Kabel dekoratif **dilarang** muncul sebagai `LIVE`.

### Node port contract (typed)

| Tipe | Isi | Contoh |
|---|---|---|
| `video` | handle video/frame + timestamp + sourceId | Camera → Pose / Capture |
| `pose` | actor A/B landmarks, confidence, frameId | Pose → Footprint / Trace |
| `gesture` | hand action + eventId + fresh | Gesture → Capture |
| `footsteps` | kontak kaki, actorId, x/y terkalibrasi, timestamp | Footprint → Floor Mix / Recorder |
| `stroke` | path/ink commands + actorId + timestamp | Dual Trace → Canvas Mix / Recorder |
| `photo` | foto B yang disetujui + crop + timestamp | Capture/Photo Bank → Canvas Mix |
| `media` | arsip video/foto | Archive Media → Canvas Mix |
| `session` | log Footstep/Stroke F1 terversi | Saved Session → Replay |
| `frame` | komposisi RGBA stage-surface | Mix → Output |

Semua edge menyatakan `from(nodeId,port)`, `to(nodeId,port)`, `type`, `status`, `updatedAt`. Invalid type, missing node, stale consumer, dan siklus komputasi ditolak sebelum cue dieksekusi. `REC` bersifat sink; hasil recorder yang disimpan masuk kembali lewat **Saved Session**, bukan feedback loop real-time. Banyak penerima dapat memakai satu sumber yang sama.

## 4. Cue graph Unpacking

| Cue | Input & engine aktif | FLOOR | CANVAS |
|---|---|---|---|
| **F1 — Jejak dibentuk** | Camera01 → Pose → Footprint + Dual Trace; event ditulis ke Recorder | footprint live + decay | sapuan Dual Trace |
| **F2 — Arsip** | video/foto dari Media Library → composer | blackout/hold sesuai cue yang eksplisit | arsip video |
| **F3A — Pilih 4 foto** | Camera02 (sepatu penonton) + Camera03 (gestur aktor) → 4 Photo Capture, tersimpan Photo Bank | blackout/standby | kamera/lapisan foto + grid 4 gambar |
| **F3B — Arsip tersusun** | Saved F1 → Replay; Photo Bank + arsip + hasil trace → Canvas Mix | playback footprint F1 | kolase arsip + foto + trace |

F3A wajib mengikuti `F3SessionMachine`: consent, valid frame A/B, verified camera, armed capture, foto maksimum empat, duplicate event ditolak. Jangan memindahkan izin kamera hanya karena cue berubah.

Setiap output punya fallback: `LIVE / HOLD / BLACKOUT` dan health per-surface. Cue yang meminta channel tidak tersedia menghasilkan warning dan **blackout yang aman**, bukan tampilan palsu. Ketika F2 tidak memerlukan FLOOR, output tetap terbuka untuk monitoring namun gelap.

## 5. Arsitektur implementasi (adapter-first)

```text
MediaDevice / Phone WebRTC / MP4 / Saved Session / Archive Files
                 │
          SourceSessionRegistry
          (one producer per live source)
                 │  VideoFrame + sourceId + monotonic time
          TypedPortRouter  ───────────────→ CameraPreview
            │             │
       PoseAdapter    GestureAdapter
        ├─ Footprint     └─ F3Capture → PhotoBank
        ├─ DualTrace
        └─ EventRecorder → IndexedDB → SavedSession → Replay
                   │          │
                FloorMix    CanvasMix ← Archive / PhotoBank
                   │          │
          FLOOR Port        CANVAS Port
          (current safe dual-output runtime + adapter)
                   ▲          ▲
              CueGraphRunner + health + QA safety gates
```

**Adapters, bukan duplikasi engine:**
- Pertahankan `CameraHubRegistry` dan `CameraTracker`; pindahkan ownership `MediaStream` ke satu `SourceSessionRegistry` dengan `subscribe/unsubscribe`, ref-count, cancellation epoch, stale watchdog. F3 membaca feed dari registry yang sama lewat adapter; peran gesture dan audience feet terpisah dari source ID. Migrasi bertahap lewat feature flag.
- Renderer Footprint dan Dual Trace menggunakan source frame/event yang sama; dua layer tetap dapat berjalan dan direkam terpisah. Jangan membatasi data garis pada data kaki jika shoulder/head upper-trace memang aktif.
- Gunakan output runtime `DualSurfaceSessionStore` untuk keamanan dan kalibrasi. Tambahkan adaptor `canvas` ke komposisi layar kanvas; `body` pada kode sekarang tidak otomatis sama dengan target kanvas putih.
- Perekaman baru memakai event semantik tersinkron, tidak hanya screenshot atau MotionLog 90ms. Gunakan log terversi, batch write, checksum serta IndexedDB quota handling; playback mengurutkan event berdasarkan monotonic timestamp dan actorId. Sediakan export/import backup dan tombol clear. Foto penonton memerlukan consent yang dapat dicabut.
- Shared graph state hidup pada root app, tetap ada ketika memilih cue. Full browser refresh tidak menjamin `MediaStream` tetap hidup: restore konfigurasi lalu meminta koneksi ulang; kamera HP boleh rejoin dengan session token yang masih valid.

## 6. Runtime state & batas keselamatan

Node states: `idle → connecting → live → degraded → stale/error → reconnecting`. Status edge menjadi `active` hanya saat producer dan subscriber valid dan frame segar. Hapus satu subscriber tidak menghentikan producer yang masih dipakai subscriber lain.

Cue states: `ready → preflight → running → hold → complete` atau `blocked`. `GO` mengaktifkan graph dan komposisi. **GO tidak mengubah otorisasi listrik/output**. Izin stage LIVE tetap mengikuti bukti QA fisik, output handshake, kamera fresh, kesesuaian calibration signature, serta operator arming yang eksplisit. Escape / tombol B tetap memicu blackout. Reconnect tidak menyalakan kembali output dengan sendirinya.

Sample monitor: sourceId, lastFrameAt, frame age, fps, active consumers, inferenceMs, dropped frames, output heartbeats, last ACK, recording bytes, active cue. Ambang `stale` mengikuti engine lama sampai benchmark mengesahkan nilai baru; tampilkan error actionable.

## 7. Acceptance criteria dan QA yang wajib lulus

**P0 — kontrak graph:**
- Tambah/hapus Camera01/02/03, banyak input tanpa membuat duplicate physical stream.
- Semua node dan port valid; kabel invalid ditolak dengan pesan; pan/zoom dan pilihan port keyboard berfungsi.
- F1/F2/F3A/F3B mengaktifkan jalur berbeda dalam **canvas yang sama**. Tidak ada fullscreen studio/space baru ketika mengganti cue.
- F1: dua aktor → footprint FLOOR dan Dual Trace CANVAS bersamaan; REC menyimpan event A/B; tidak ada lompatan actorId pada crossing tanpa recovery.
- F3B: ambil log F1 dari session, replay deterministic pada floor; foto dan media tampil pada canvas.
- F3A: Camera02/03 dua sumber berbeda, gesture menyeleksi foto B saja, foto 4/4, consent revoke memblokir capture.
- FLOOR dan CANVAS dapat blackout terpisah; output tetap bersih (no DOM editor) dan kalibrasi tersimpan per permukaan.
- Semua fitur tersambung pada engine aktual. Status `simulasi` wajib terlihat untuk fixture; graph mock/demo tidak boleh disebut live.

**P0 — regresi existing:**
- `npm ci && npm test && npm run build` lulus.
- `e2e/camera-hub-multicam.spec.mjs`, `e2e/f3-capture-v2.spec.mjs`, `e2e/dual-trace-v2.spec.mjs`, `e2e/perform-three-routes.spec.mjs`, `e2e/projector-wysiwyg.spec.mjs` tetap lulus.
- Negative tests: izin kamera ditolak, USB dicabut, jaringan HP putus, deviceId berubah, dua consumers satu camera, hilang output, rejoin, refresh, data IndexedDB rusak/quota penuh.
- Jangan anggap lulus build sebagai bukti proyektor benar-benar memproyeksikan gambar.

**Stage test manual Mac + Windows (release-blocking):**
1. Kamera laptop + 2 kamera eksternal/HP, video tetap fresh saat cue diganti; tanpa duplicate request ke physical device.
2. Stress 3 kamera lalu 10 *simulated producers*; cap throughput adaptif, laporkan CPU, latency p50/p95, memory, missed/late frames dan batas hardware.
3. Mapping dua proyektor nyata, bukti output benar pada permukaan masing-masing dan blackout fisik di kedua jalur.
4. 10 menit record → pause → F3 playback; durasi dan urutan footprint/stroke cocok; korupsi data/penyimpanan penuh tidak membuat panggung menggantung.
5. Cabut kamera dan display saat LIVE: output terkait padam, status stale jelas, tidak menyala sendiri saat rejoin.
6. 4 foto audience dengan consent, hapus foto, cek file lokal tidak terkirim ke server.

**Gate release:** CI PASS + browser E2E PASS + signoff QA perangkat dengan bukti foto/video/log + operator rehearsal. Bila hanya CI PASS, label **software QA** dan pertahankan default V5 OFF.

## 8. Urutan implementasi dan area file

| Prioritas | Implementasi | Titik masuk |
|---|---|---|
| P0.1 | Graph schema, typed ports, validation, cue route evaluator, tests | `src/studio/v5/NodeGraphModel.ts`, `tests/v5-node-graph-contract.test.ts` |
| P0.2 | Adapter Camera Hub / F3; single producer, refcount, diagnostics | `src/studio/v3/CameraHubRegistry.ts`, `src/f3/F3CameraRegistry.ts`, new `src/studio/v5/SourceSessionRegistry.ts` |
| P0.3 | Live Footprint/DualTrace adapters + common timestamp | `src/footprints/live/`, `src/footprints/dual-trace/`, `src/studio/v5/` |
| P0.4 | Recorder event F1 + Replay F3 + migrations | `src/stage/StageSessionStore.ts`, new `src/studio/v5/SessionRecorder.ts`, `TraceReplay.ts` |
| P0.5 | Floor/Canvas mixer & safe output adapter | `src/footprints/stage-optics/DualSurfaceSessionStore.ts`, `src/projection/channel.ts` |
| P0.6 | Unified Canvas UI + cue strip + inspector + fixed output previews | new `src/studio/v5/UnifiedNodeWorkspace.tsx`; mount in `src/App.tsx` behind flag |
| P0.7 | E2E, negative flow, hardware QA | `e2e/v5-unified-node.spec.mjs`, `.github/workflows/` |

### Migrasi / rollback

- `VITE_SOMA_NODE_CANVAS_V5` default OFF sampai P0 lulus. Legacy Camera Hub, Stage1/Stage2/F3 dan existing projector remain operational.
- Simpan graph di schema `soma.node-graph.v1`; migrasi **copy-on-read**, jangan overwrite saved V3 cues dan camera mappings.
- Sediakan tombol **Kembali ke tampilan lama** selama beta; hentikan output sementara saat pindah router sehingga tidak ada double-projection.
- Rollout internal hanya setelah bukti pada perangkat; Pages dipicu dari branch `main` yang sudah direview.

## 9. Status kepastian per 23 Nov 2026

Repo telah **diinspeksi dari kode**; telah ditemukan jalur CameraHub, F3, Footprint/Dual Trace, Session, Cue, dan output dual-surface. Existing tests mencakup sebagian besar modul secara terpisah. **Belum ada bukti** graph V5 terhubung end-to-end atau kamera/proyektor fisik lulus. Bagian tersebut tetap `PENDING` sampai implementasi dan uji perangkat selesai. Jangan menandai LIVE / PASS hanya karena node dan kabel ter-render.

**Definition of Done:** satu canvas menjalankan F1 → F2 → F3A → F3B, event F1 benar-benar bisa diputar pada F3, empat foto benar-benar diambil, FLOOR & CANVAS terpisah dan dapat blackout, serta hardware release gate telah ditandatangani.
