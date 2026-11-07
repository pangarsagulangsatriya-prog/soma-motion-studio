# Current flow

Studio 09 adds voice → resize → punch on the same stage. See CAMERA-PERFORMANCE.md.
The Studio 08 notes below describe the retained legacy pinch capture and storage.

# Studio 08: gesture photo wall

Four camera-only JPEGs overlay the main Studio/Clean stage, above the existing
canvas (including its text, trails and skeleton). The wall does not change the
text layout. Photo settings and storage are deliberately separate from instrument
presets and the existing Archive workspace. Archive workspace suspends capture.

## Capture lifecycle

`PhotoGesture` consumes unsmoothed per-hand landmarks from the existing Hands
tracker. Both 21-point hands must be present, finite and within the frame.
Two open palms separated by a minimum normalized/adaptive palm distance dwell
for 800 ms (operator range 400–2000 ms). Either-hand pinch over .78, with the
other palm open, must persist for 80 ms. Readiness expires after four seconds.
Tracking loss, a sample gap over 300 ms, disabling gestures or switching input
cancels readiness. A held pinch fires once; two open palms must rearm it.
The photo gesture takes precedence over the optional open-palm tracking-line
trigger. Existing sound mapping stays active. The T shortcut still works.

The capture lock is synchronous and includes encoding and persistence. Capture
selects the first empty slot unless an explicit replacement is selected. Full
walls reject capture. A replacement retains the old photo until successful
capture. Thumbnail flashing uses a border, not a whole-screen flash.

`capturePhoto` copies the video synchronously at the accepted trigger, before
asynchronous JPEG encoding. It captures the full camera aspect ratio, mirrored
according to the instrument, capped at 1920 pixels on the long side. DOM/canvas
visuals are never recaptured. The square thumbnails use center crop via CSS;
JPEG downloads retain the full captured frame.

## Persistence and failure

IndexedDB `soma-photo-wall`, version 1, store `photos`, has four integer slot keys.
Transaction completion, not request success, determines durability. Failed saves
retain the captured blob in memory with an explicit unsaved badge, download and
retry controls. Delete and undo update the UI only after transaction completion.
The last mutation can be undone until the page closes. Previous photo object
URLs are retained only for displayed images and the one undo slot, then revoked.

Display preferences persist in a separate localStorage key. Gesture enablement,
replacement selection, readiness and optional shutter sound reset on reload.
No uploaded camera media, account sync or extra network service is introduced.
Use one operator tab; there is no multi-tab write reconciliation in this release.

## UI and documentation

Entry points: live visual bar (including Clean) and the Visual settings panel.
Photo controls live in a scrollable modal. Each slot has replace, download,
delete, and unsaved retry when relevant. Wall dimensions come from ResizeObserver,
with four equal squares bounded by stage height and width.

User manual: `docs/USER-MANUAL.md`; generate the published HTML and Markdown with
`python scripts/build-user-manual.py`. The page has mobile navigation, anchored
sections and print/PDF CSS. Links are available from the photo panel and Help.

## Verification

- 55 Node tests pass, including 8 new gesture/slot tests.
- 17 browser E2E checks use the actual hook, photo wall, JPEG encoder and IndexedDB,
  with a canvas-backed MediaStream and synthetic hand landmarks. They cover
  gesture/release, the fifth-photo guard, mirror pixels, replace/undo/delete,
  layout at a narrow stage size, storage quota failure/retry and ended tracks.
- Main app restores four photos from the same IndexedDB across navigation and
  shows them in Clean; gesture activation remains off after reload.
- Main app audio recording remains active through photo deletion/undo, mode changes
  and Studio/Clean navigation; a completed 84-second WEBM appeared in Sessions.
- Physical camera capture, actual MediaPipe hand inference and GPU rendering have
  not been exercised in the cloud browser. Rehearse on the performance device.
