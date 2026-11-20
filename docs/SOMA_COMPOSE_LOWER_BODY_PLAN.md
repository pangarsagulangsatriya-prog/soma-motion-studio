# SOMA Compose Lower-Body, Wide Camera & Perform Resolume Feed Plan

## 1. Kamera Horizontal Wide Default (`16:9`)
- Modul murni `src/engine/cameraConstraints.ts`:
  - `DEFAULT_CAMERA_CAPTURE_SIZE = '720p'` (`1280×720`, `aspectRatio: { ideal: 16 / 9 }`).
  - `buildHorizontalCameraConstraints()` memastikan `width > height` untuk webcam desktop maupun kamera HP (`PhoneCameraSender.tsx`, `AutomaticPhoneSender.tsx`, `tracking.ts`, `ProjectionWorkspace.tsx`).
  - Mencoba `screen.orientation.lock('landscape')` secara aman di HP dengan panduan landscape.

## 2. Compose: `FLOOR`-First + Quick Lower-Body Composer + `FOOT` & `SKELETON`
- Urutan tab Stage Monitor: **`FLOOR | LEG A | LEG B | SPLIT | FOOT | SKELETON`** (+ `CAM` saat sumber eksperimen aktif).
- `src/studio/v3/composeLowerBodyModel.ts`:
  - 4 Mask presets (`Auto Lower Body`, `Tight Legs`, `Wide Lower Body`, `Custom`).
  - 4 Look modes (`Solid`, `Lighting Wash`, `Texture`, `Image`).
  - 7 Color chips + custom color picker, opacity, brightness, texture type (`Linen`, `Grain`, `Noise`, `Organic`) & scale.
  - 8 Quick Presets bawaan (`A Red / B Blue`, `A Green / B Magenta`, `Both White`, `Both Red Wash`, `Both Blue Wash`, `Texture Linen`, `Texture Grain`, `Archive B/W Fill`) + Simpan/Reset preset lokal.
  - Simulasi bawaan deterministik (`STEP L`, `STEP R`, `SLIDE`, `PIVOT`, `CROSSING` dengan *identity ambiguity guard*, `RESET`) + normalisasi live 33-joint MediaPipe.
- `src/studio/v3/composeLowerBodyRenderer.ts`:
  - Canvas2D ortografis gelap seragam palet Track (`LEG A`, `LEG B`, `SPLIT`, `FOOT`, `SKELETON`) dengan `UPPER THIGH CUTOFF`, kontur kaki, garis bilateral, dan confidence readout.
- `src/studio/v3/LowerBodyQuickInspector.tsx`:
  - Inspector cepat di kanan dengan kontrol teknis (`Layers / Transform / Calib`) disimpan di drawer lipat `Advanced`.

## 3. Perform: Pilihan Jalur Output `SOMA Direct` vs `Feed Resolume`
- Toggle 2 arah di kartu `Output Proyektor` (`OperatorStageConsole.tsx`):
  - **`SOMA Direct`**: proyeksi langsung lewat dual-surface output SOMA dengan seluruh safety gate optik tetap aktif (fail-closed).
  - **`Feed Resolume`**: membuka jendela clean feed 16:9 hitam murni (`?feed=resolume`) untuk `FLOOR` & `BODY` + tombol **Salin URL** agar langsung ditangkap di Resolume Arena / OBS / Spout / Syphon. `BLACKOUT [B]` tetap memadamkan seluruh output.
