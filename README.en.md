# 👁 MyEyes

[🇧🇷 Português](README.md) · 🇺🇸 English

Move the cursor and click **using only eye movement**, with an ordinary webcam. Built for people who can only move their eyes (ALS/MND, spinal cord injury, cerebral palsy, locked-in syndrome, among other conditions).

- 100% in the browser — nothing to install.
- **Privacy:** video is processed locally (MediaPipe) and is **never sent** to any server.
- No backend, no build step: static files published straight to Vercel.
- **English and Brazilian Portuguese:** the language follows the browser and can be switched in Settings (or on the start screen). It covers the interface, keyboard, phrases and the **spoken voice** (en-US / pt-BR).
- **Always fullscreen:** requested at start and on every real click/key press while not fullscreen (browsers only allow it after a user gesture). It can be turned off in Settings. Installed as an app (see below), it opens fullscreen straight away.

## How it works

1. **Camera →** the [MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) finds 478 face points, including the **irises**.
2. **Gaze features →** iris position relative to each eye's corners (robust to in-plane head tilt) plus head position and angles (`js/features.js`).
3. **13-point calibration →** the user just *looks* at each circle (~25 s). The app waits for the gaze to actually *settle* before sampling (`js/fixation.js`), drops saccade/blink frames, and learns the "gaze → screen position" map with ridge regression. It **tries several models** (with/without head angles, 5 regularization levels) and keeps the one with the lowest leave-one-point-out cross-validation error (`js/regression.js`). The estimated accuracy is shown at the end.
4. **Smoothing →** 3-frame median (removes isolated jumps) + One Euro filter, which removes jitter without lagging fast movements (`js/filters.js`).
5. **Continuous auto-adjust →** every confirmed click tells the app where the user *was* looking; it slowly corrects systematic drift (fatigue, posture changes), with limits so an accidental click can't wreck the model. Can be turned off in Settings.
6. **Head protection:** head features are clamped to the range seen during calibration, and a warning appears if the head moves far from the calibrated position.
7. **Dwell click:** holding your gaze on a button for ~1.2 s clicks it. There is a *magnet* for nearby buttons, tolerance for small slips, and a lock until the gaze leaves (prevents repeated clicks) (`js/dwell.js`).
8. **Optional: long-blink click** (~0.6–1.8 s). Short natural blinks are ignored and the cursor freezes during a blink.

### Diagnostics mode 📊

**Diagnostics** button (on the calibration result screen and in the app's top bar). It shows, on a map of the screen, the **real point** (circle) against **where the app thinks you looked** (colored dot joined by a line — green < 100 px, amber < 200 px, red above), with each point's error. It also computes:

- **horizontal × vertical** error, **systematic offset** (where the cursor tends to land), frame-to-frame **jitter**, **center × edges** error and the **worst point**;
- specific recommendations for what was detected (camera, light, position, smoothing, button size).

Two views: **calibration** (each point predicted by a model trained *without* it — cross-validation, conservative) and **🎯 Accuracy test**: 8 *new* points outside the calibration, the most realistic measure. Optionally, **➕ Use these points to improve** merges the 8 points with the 13 and refits the model (a "second round").

### What's in the app
- 💬 **Quick phrases** with speech ("Yes", "No", "I need help!"…).
- ⌨ **On-screen keyboard** with large keys and a speak button.
- ⚙ **Settings** operable by gaze alone (− / + buttons, no sliders): click time, smoothing, cursor size, magnet, blink, camera, sound, auto-adjust, fullscreen, language.
- ⏸ **Pause** (only "Resume" stays active) and 🎯 **Recalibrate** at any time.

## Run locally

```bash
npm run dev      # serves the folder at http://localhost:3000 (the camera works on localhost)
npm test         # unit tests (regression, filter, features, dwell, calibration simulation, i18n)
```

> The camera only works over **HTTPS** or **localhost**. Vercel already serves HTTPS.

## Deploy to Vercel

1. At [vercel.com/new](https://vercel.com/new), import the `RodrigoAiosa/MyEyes` repository.
2. **Framework Preset:** `Other`. Leave *Build Command* and *Output Directory* empty (`vercel.json` handles the headers).
3. *Deploy*. Every `git push` to `main` publishes automatically.

## Install as an app (always opens fullscreen)

In Chrome or Edge, open the site and use **Install** (icon in the address bar, or ⋮ menu → *Install MyEyes*). The installed app **always opens fullscreen** with no click needed for that (`manifest.webmanifest` → `display: fullscreen`). This is the best option for eye-only users: a companion installs it once.

## Limitations (read before promising what the app doesn't deliver)

- **It only controls the MyEyes page itself.** A website cannot move the operating-system cursor. Controlling the whole computer would need a desktop app (see the roadmap).
- **Webcam accuracy is limited:** typically 100–200 px of error. That is why the interface uses **big targets**. Anything smaller than ~150 px is hard to hit.
- **The head must stay reasonably still** after calibration. If the cursor drifts, recalibrate. Resizing the window also requires recalibration.
- Light on the face, 50–70 cm from the screen and the camera at eye level make a big difference. Reflective glasses and hair over the eyes make results worse.
- The first step ("Enable camera") needs a click/tap/Enter (a browser rule to unlock the camera). A companion can do this step.
- The model (~4 MB) and runtime are downloaded from the internet the first time (jsDelivr and Google Storage); afterwards they stay in the browser cache.
- This is an assistive project and **not a medical device**. Testing with real users, with an occupational therapist or speech-language pathologist, is essential.

## Roadmap / ideas

- [ ] Browser extension to click on **any website** (reusing this core).
- [ ] Desktop app (Electron/Python) to control the system cursor.
- [ ] Word prediction on the keyboard and caregiver-editable phrases.
- [ ] Host the model and runtime in the project itself (work offline / full PWA).
- [ ] More languages (Spanish, for instance) — just add the language to `js/i18n.js`; a test makes sure no key is left untranslated.

## Structure

```
index.html        screens: welcome, calibration, app
css/styles.css    dark high-contrast theme, large targets
js/main.js        orchestrates states, interface and the gaze pipeline
js/i18n.js        pt-BR and en strings, phrases, keyboard, voice language
js/tracker.js     camera + MediaPipe Face Landmarker
js/features.js    landmarks → gaze features / blink
js/calibration.js 13-point calibration with fixation wait
js/fixation.js    fixation detection / saccade dropping
js/regression.js  ridge, cross-validated model selection, auto-adjust
js/diagnostics.js diagnostics statistics and rules (pure, tested)
js/diag-ui.js     SVG map, metrics and recommendations
js/filters.js     One Euro filter
js/dwell.js       dwell click, magnet, hysteresis
manifest.webmanifest + icons/   install as a fullscreen app
tests/            tests (node --test): logic, old × new simulation, translations
vercel.json       headers (Permissions-Policy: camera)
```

## Credits

Face tracking: [MediaPipe](https://github.com/google-ai-edge/mediapipe) (Apache-2.0). Filter: *1€ Filter* (Casiez, Roussel, Vogel — CHI 2012).
