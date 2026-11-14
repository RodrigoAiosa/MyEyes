// Câmera + MediaPipe Face Landmarker (roda 100% no navegador; o vídeo nunca sai do dispositivo).
import { FaceLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
import { extractFeatures, blinkScore } from './features.js';
import { t } from './i18n.js';

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export class EyeTracker {
  /** @param {HTMLVideoElement} video */
  constructor(video) {
    this.video = video;
    this.landmarker = null;
    this.stream = null;
    this.running = false;
    this.onFrame = () => {};
    this._lastVideoTime = -1;
    this._loop = this._loop.bind(this);
  }

  async start(onStatus = () => {}) {
    onStatus(t('loading.camera'));
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user', frameRate: { ideal: 30 } },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();

    onStatus(t('loading.model'));
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    const options = (delegate) => ({
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
    try {
      this.landmarker = await FaceLandmarker.createFromOptions(fileset, options('GPU'));
    } catch {
      this.landmarker = await FaceLandmarker.createFromOptions(fileset, options('CPU'));
    }
    this.running = true;
    requestAnimationFrame(this._loop);
  }

  stop() {
    this.running = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  _loop() {
    if (!this.running) return;
    const v = this.video;
    if (v.readyState >= 2 && v.currentTime !== this._lastVideoTime) {
      this._lastVideoTime = v.currentTime;
      const now = performance.now();
      let frame = { t: now / 1000, found: false, features: null, blink: 0 };
      try {
        const res = this.landmarker.detectForVideo(v, now);
        const lm = res.faceLandmarks?.[0];
        if (lm) {
          const matrix = res.facialTransformationMatrixes?.[0]?.data;
          const features = extractFeatures(lm, matrix, v.videoWidth, v.videoHeight);
          if (features) {
            frame = {
              t: now / 1000,
              found: true,
              features,
              blink: blinkScore(res.faceBlendshapes?.[0]?.categories),
            };
          }
        }
      } catch (err) {
        console.error('Falha ao processar o quadro:', err);
      }
      this.onFrame(frame);
    }
    requestAnimationFrame(this._loop);
  }
}

/** Mensagem amigável (no idioma atual) para erros de câmera/modelo. */
export function describeError(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return t('err.denied');
    case 'NotFoundError':
    case 'OverconstrainedError':
      return t('err.notfound');
    case 'NotReadableError':
      return t('err.busy');
    default:
      return t('err.generic', { msg: err?.message || err });
  }
}
