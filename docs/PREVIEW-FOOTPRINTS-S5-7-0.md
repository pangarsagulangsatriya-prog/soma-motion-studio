# UNPACKING / SOMA — S5.7.0 Stage Optics Preview

Preview of Draft PR #17 based on the S5.6.4 stack. **No changes to Production and no new physical output connection.**

1. Open Studio → Footprints → Live Floor Tracking → **00 / Stage Optics & Spatial Design**.
2. Inspect **Denah atas** for the two isolated initial walking zones, shared central crossing, one SOMA RGB camera, body projector and floor pad projector.
3. Inspect **Potongan tubuh** for the soft upper edge of the light band (default 1.27 m). This is a target sketch; it does not track a moving human body yet.
4. Switch **2 proyektor** (body A/B together plus floor pad) or **3 proyektor** (one body projector per performer plus pad).
5. Select actual floor dimensions or adjust device XYZ coordinates, then enter manufacturer throw ratio and camera FOV values only if known.
6. Read estimate warnings, **Ekspor JSON** and bring it to the theatre for physical measurement.
7. Validate stray light, tracking in stage darkness, performer crossing and rig positions physically before building the S5.7.1 mask.

Planner calculations are preliminary. The current SOMA Projection output and the Footprints Live Floor tracking code remain unchanged. Future dual-output hardware and body projection mapping are **not** ready for a stage performance.

Details: `docs/FOOTPRINTS-S5-7-0-STAGE-OPTICS-SPATIAL-DESIGN.md`.
