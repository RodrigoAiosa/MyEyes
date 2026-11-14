// Câmera + MediaPipe Face Landmarker (roda 100% no navegador; o vídeo nunca sai do dispositivo).
import { FaceLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
import { extractFeatures, blinkScore } from './features.js';

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
    onStatus('Pedindo acesso à câmera…');
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user', frameRate: { ideal: 30 } },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();

    onStatus('Carregando o modelo de rastreamento (só na primeira vez)…');
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

/** Mensagem amigável (pt-BR) para erros de câmera/modelo. */
export function describeError(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'O acesso à câmera foi negado. Libere a câmera nas permissões do navegador (ícone de cadeado ao lado do endereço) e tente de novo.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Nenhuma câmera foi encontrada neste dispositivo.';
    case 'NotReadableError':
      return 'A câmera está em uso por outro programa. Feche-o e tente novamente.';
    default:
      return `Não foi possível iniciar o rastreamento: ${err?.message || err}. Verifique a conexão com a internet (o modelo é baixado na primeira vez).`;
  }
}
