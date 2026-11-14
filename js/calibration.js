// Calibração de 9 pontos: o usuário apenas OLHA para cada ponto (sem cliques).
import { fitFromGroups, qualityLabel } from './regression.js';

// Ordem em "serpente" para os olhos não precisarem atravessar a tela toda a cada ponto.
export const CALIB_POINTS = [
  [0.08, 0.1], [0.5, 0.1], [0.92, 0.1],
  [0.92, 0.5], [0.5, 0.5], [0.08, 0.5],
  [0.08, 0.9], [0.5, 0.9], [0.92, 0.9],
];
const SETTLE_MS = 900;       // tempo para os olhos chegarem ao ponto
const SAMPLES_PER_POINT = 30;
const MAX_WAIT_MS = 20000;   // sem rosto por tanto tempo → desiste

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Cancelado', 'AbortError'));
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(id); reject(new DOMException('Cancelado', 'AbortError')); }, { once: true });
  });

export class Calibration {
  /**
   * @param {{root: HTMLElement, dot: HTMLElement, label: HTMLElement, hint: HTMLElement,
   *          getFrame: () => ({seq:number, found:boolean, features:number[]|null, blink:number})}} ui
   */
  constructor(ui) {
    this.ui = ui;
  }

  async run(signal) {
    const { dot, label, hint } = this.ui;
    const groups = [];
    for (let i = 0; i < CALIB_POINTS.length; i++) {
      const [fx, fy] = CALIB_POINTS[i];
      label.textContent = `Ponto ${i + 1} de ${CALIB_POINTS.length} — olhe fixamente para o círculo`;
      dot.style.left = `${fx * 100}%`;
      dot.style.top = `${fy * 100}%`;
      dot.classList.remove('pulse');
      void dot.offsetWidth; // reinicia a animação
      dot.classList.add('pulse');
      await sleep(SETTLE_MS, signal);
      const samples = await this._collect(signal);
      groups.push({ fx, fy, samples });
    }
    dot.classList.remove('pulse');
    const { innerWidth: W, innerHeight: H } = window;
    const { model, errPx, trainErrPx } = fitFromGroups(groups, W, H);
    return { model, errPx, trainErrPx, quality: qualityLabel(errPx) };
  }

  async _collect(signal) {
    const { getFrame, hint } = this.ui;
    const samples = [];
    let lastSeq = -1;
    let waitingSince = performance.now();
    while (samples.length < SAMPLES_PER_POINT) {
      await new Promise((r) => requestAnimationFrame(r));
      if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
      const fr = getFrame();
      if (!fr || fr.seq === lastSeq) continue;
      lastSeq = fr.seq;
      if (fr.found && fr.blink < 0.35) {
        samples.push(fr.features);
        waitingSince = performance.now();
        hint.textContent = '';
      } else if (performance.now() - waitingSince > 1500) {
        hint.textContent = fr.found ? 'Mantenha os olhos abertos.' : 'Não encontro seu rosto — fique de frente para a câmera.';
      }
      if (performance.now() - waitingSince > MAX_WAIT_MS) {
        throw new Error('Rosto não detectado durante a calibração.');
      }
    }
    return samples;
  }
}
