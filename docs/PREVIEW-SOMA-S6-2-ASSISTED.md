# S6.2 — Preview Assisted Projected Calibration

**Preview branch** `preview/soma-s6-2-assisted-calibration`. **Feature Draft PR #31**, stacked on Draft PR #30 (S6.1.3). GitHub Actions #612: **311 tests passed, TypeScript/Vite build passed**. Production remains unchanged.

## Preview stage acceptance

1. Open this protected **HTTPS Preview** on the laptop with the same real Body camera source and Floor projector output. Confirm your access to Vercel Preview and camera permissions.
2. In Footprints → Guided Setup → Calibration, complete initial source setup. Open **S6.2 · Marker proyeksi, drag empat titik & QA lima titik**.
3. Under S6.2 Assisted Auto Calibration, witness floor alignment and operator-safe Blackout, then click **1 Rekam baseline & siapkan marker**. This captures one camera frame during software Blackout only.
4. Click **2 Buka jendela proyektor**, move the output window onto the correct FLOOR projector; click **3 Tampilkan marker (Live Test)**. Confirm four distinct colors: **magenta UL, cyan UR, yellow DR, green DL**. The dots must fall on the physically intended floor patch, never on faces/audience.
5. Click **4 Cocokkan marker dari kamera**. Five stable raw-camera frames must show all four projected spots. SOMA calculates a camera-floor draft quad and requests Blackout. If it cannot detect or extrapolate, retain the manual fallback.
6. On raw camera canvas, **drag the four corner points** to refine alignment; you can still use the existing click/select inputs. Apply four points, then manually confirm.
7. Run independent **S5.6.3 camera–projector five-point QA**. Observe physical projected crosses and capture their positions in the camera image; inspect RMSE and P95. Export report. Optical QA is not automatic.
8. Repeat with Android/iPhone input, alternate lighting conditions, and two crossing actors. Check camera change and QR disconnect revoke approval; blackout should extinguish actual physical light, not just change a software flag.

## Safety and limitations

- The stage output is operator-triggered (open window and Live Test). No programmatic power-on or automatic Live occurs.
- Blackout baseline comparison avoids matching stationary colored props, but color-similar lights and changing exposure can still confuse the scan. Never trust a four-marker match without a visual corner check and QA.
- The projected raster must already cover the **desired floor boundary**. Four colored spots alone cannot locate physical floor dimensions. This is assisted **FLOOR** registration, not 3D moving BODY projection calibration.
- The original manual four-click calibration remains available at every step.
- CI tests pure synthetic geometry. No real projector photon/latency or human gait results have been observed by this release automation.
