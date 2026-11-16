# SOMA Footprints — S5.6.3 Calibration QA Preview

Preview code is based on the S5.6.3 implementation branch; PR #15 is still draft. Production and default branch have not changed.

Open Studio → Footprints → Live Floor Tracking · Kamera. Connect one SOMA Body camera, calibrate four unmirrored camera corners, then open the shared Projection Output. After projector four-corner alignment, open **01B / Camera–Projector QA** on the left, click **Mulai uji 5 titik**, explicitly switch the Projection panel to **Live**, and mark the actual illuminated cross on the camera preview for Q1–Q5. The last point triggers Blackout. Export the QA JSON.

Expected diagnostics: independent per-checkpoint centimetre displacement, RMSE, P95, max error and complete/incomplete status. This is a manual light-spot alignment check, not measured gait contact accuracy or proof of physical latency. Run the stage checklist before merging to Production.

Read `docs/FOOTPRINTS-S5-6-3-CAMERA-PROJECTOR-QA.md` for physical setup and release gates.
