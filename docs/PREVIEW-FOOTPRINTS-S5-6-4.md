# SOMA Footprints S5.6.4 — Physical Stage Acceptance Preview

Preview branch for draft PR #16, stacked on S5.6.3. Production is unchanged.

## Operator walkthrough

1. Studio → Footprints → Live Floor Tracking · Kamera. Set performer count (1 or 2), calibrate four camera corners and projector quad, then run the five-point QA (Q1–Q5).
2. Record a complete real stage take using an external high-FPS video that shows both feet and projected light in one frame. Keep the file on your device.
3. Open **04 / Physical Stage Acceptance**, enter the real video filename, duration and FPS, click **Bekukan sesi & Blackout**.
4. Review **every physical touchdown** in that take: select performer/foot, frame of physical touchdown, tape-measured X/Y and a corresponding actual camera event ID. Choose **Tidak tercetak** if no real camera contact event matches.
5. Add one independent frame and explanation for each walk / slow lift / planted pivot / floor slide by each performer, plus one crossing case if two performers are active.
6. For at least five matched real contacts, measure the **frame difference between actual touchdown and projected light** in the external video. The app converts that frame count to real milliseconds from video FPS.
7. Check physical setup and Blackout, enter reviewer, certify that the entire recording and all camera events were reviewed.
8. Review precision, recall, false contacts/minute, physical position P95, camera-projector five-point QA and physical touchdown-to-light P95. Export **SOMA-S5-6-4-physical-acceptance.json**.

The app can only show **meets-provisional-gates** after complete external evidence and operator review. It never automatically certifies or deploys to Production.

Detailed validation procedure and engineering thresholds: `docs/FOOTPRINTS-S5-6-4-PHYSICAL-STAGE-ACCEPTANCE.md`.
