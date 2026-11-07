# SOMA Studio 09: camera as part of the performance

## Single session

App owns the one CameraTracker and HTMLVideoElement. The audio mapper, existing
kinetic text / Hydra renderer, archive photos and new camera cue consume that same
MotionFrame/video pair. Voice opens an overlay on the existing stage; it does not
navigate to the Archive workspace, initialize another tracker, reset text or stop
recording. Switching Studio/Clean keeps the cue and photos. The optional old pinch
trigger remains available, mutually exclusive with voice/frame capture.

## Voice boundary

CameraVoice uses SpeechRecognition or webkitSpeechRecognition, id-ID, continuous
recognition and interim results. The operator must enable it through a click and
allow the browser microphone. Whole words kamera/camera open the frame; batal and
tutup kamera close it. Intermediate/final repetitions and rapid duplicates are
suppressed. No transcript is stored. Recognition may use the browser provider's
remote service and needs network access; this is disclosed beside activation.
No microphone audio is connected to the synthesizer or audio recorder. Mute affects
sound output; the separate microphone button controls listening.

Network errors retry with a delay and stop after three failures; permission,
service, language and missing-device errors stop immediately. Hidden documents,
unmount and the old Archive workspace stop listening. Re-enabling is explicit.
No speech model is bundled, and offline speech support is not claimed.

## Frame and punch

The centered square begins at 60%, clamped to 25–90%. Two open palms establish a
relative distance anchor; greater separation expands it, smaller separation
contracts it. Exponential smoothing reduces jitter. CameraCrop computes a central
square in source pixels. CameraFrame draws that exact crop, with the main mirror
setting. The capture function copies the same source rectangle synchronously
before JPEG encoding. Size is frozen when a palm becomes a fist. The manual full
camera capture and old pinch gesture retain their full-frame JPEG behavior.

A completely closed hand must remain within a small position tolerance for 180 ms
before the punch can arm. A downward displacement of at least .075 of normalized
camera height, with speed at least .8 height/second over a 45–180 ms history,
accepts one strike. Open-hand resizing, horizontal motion and slow downward drift
do not trigger. This release intentionally uses a downward strike; it does not
claim monocular depth measurement or recognize a punch toward the lens.

The closest previous wrist associates the closed hand across detector-order
changes. Missing/invalid/offscreen hands and gaps reset motion history. A stopped
camera, different tracker, hidden tab or full wall closes the frame. A valid strike
closes it before encoding. Another camera command is required for another shot.
Existing archive logic owns locking, slot selection, persistence, quota fallback,
undo, replacement and download. A full wall never automatically overwrites.

## Validation

`tests/camera-cue.test.ts` covers the gesture state machine, word boundaries,
recognition deduplication, permission failure and crop geometry.
`tests/camera-performance.html` mounts the real App with a synthetic camera and
speech recognition boundary. All UI, shared motion processing, real canvas text,
audio recording, JPEG encoding and IndexedDB run normally. The test source stays
outside the production build.

Verification completed on 27 October 2026:

- 66 Node tests passed, including 11 new camera-cue tests.
- 16 real-App browser integration checks passed with synthetic device inputs:
  explicit microphone activation; voice open; bidirectional sizing without a
  shutter; single-shot punch; no repeat from a held fist; crop metadata and actual
  JPEG pixels; ongoing main tracking/canvas/audio recording; Clean continuity;
  tracking loss; spoken cancel; manual fallback; four-slot guard; selected-slot
  replacement; one camera stream; and microphone-denial recovery controls.
- 15 photo-storage browser checks passed: full-frame capture, four-slot limit,
  IndexedDB, mirroring, replacement, undo, deletion, layout/view retention,
  hiding, quota failure/retry and ended-camera rejection.
- The legacy pinch fixture timed out in this cloud browser, whose animation-frame
  callbacks were throttled. Its two timing checks were not counted as passing.
  The separate storage suite explicitly skips them; the legacy pure gesture
  state-machine tests passed in Node. The new punch path reads each main tracking
  callback directly and does not depend on the renderer's animation-frame rate.
- The cloud browser has no WebGL; this run exercised the existing canvas fallback,
  not Hydra's GPU output. Synthetic screenshots are labelled as test-camera views.

Physical speech recognition, real MediaPipe inference, venue microphone distance,
background sound and stage lighting require a rehearsal on the performance device.

Browser speech API reference: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
