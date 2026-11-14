// Calibração de 9 pontos: o usuário apenas OLHA para cada ponto (sem cliques).
import { fitFromGroups, qualityLabel } from './regression.js';
import { isFixation, dropSaccades } from './fixation.js';
import { t } from './i18n.js';

// 13 pontos: grade 3x3 + 4 interiores. Os interiores melhoram muito a precisão no meio da tela,
// onde o usuário mais olha. Ordem em "serpente" para os olhos não atravessarem a tela toda.
export const CALIB_POINTS = [
  [0.08, 0.1], [0.5, 0.1], [0.92, 0.1],
  [0.71, 0.3], [0.29, 0.3],
  [0.08, 0.5], [0.5, 0.5], [0.92, 0.5],
  [0.71, 0.7], [0.29, 0.7],
  [0.92, 0.9], [0.5, 0.9], [0.08, 0.9],
];
const MIN_SETTLE_MS = 450;   // mínimo antes de procurar a fixação
const MAX_FIXATION_WAIT_MS = 2500; // se o olhar nunca estabilizar, segue assim mesmo
const FIX_WINDOW = 6;        // quadros consecutivos estáveis = fixação
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
    const { dot, label } = this.ui;
    const groups = [];
    for (let i = 0; i < CALIB_POINTS.length; i++) {
      const [fx, fy] = CALIB_POINTS[i];
      label.textContent = t('calib.point', { n: i + 1, total: CALIB_POINTS.length });
      dot.style.left = `${fx * 100}%`;
      dot.style.top = `${fy * 100}%`;
      dot.classList.remove('pulse');
      void dot.offsetWidth; // reinicia a animação
      dot.classList.add('pulse');
      await sleep(MIN_SETTLE_MS, signal);
      await this._waitFixation(signal);
      const samples = dropSaccades(await this._collect(signal));
      groups.push({ fx, fy, samples });
    }
    dot.classList.remove('pulse');
    const { innerWidth: W, innerHeight: H } = window;
    const fit = fitFromGroups(groups, W, H);
    return { ...fit, quality: qualityLabel(fit.errPx) };
  }

  /** Espera o olhar parar de se mover (sacada terminou) — ou desiste após um tempo máximo. */
  async _waitFixation(signal) {
    const { getFrame } = this.ui;
    const t0 = performance.now();
    const win = [];
    let lastSeq = -1;
    while (performance.now() - t0 < MAX_FIXATION_WAIT_MS) {
      await new Promise((r) => requestAnimationFrame(r));
      if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
      const fr = getFrame();
      if (!fr || fr.seq === lastSeq) continue;
      lastSeq = fr.seq;
      if (!fr.found || fr.blink >= 0.35) { win.length = 0; continue; }
      win.push(fr.features);
      if (win.length > FIX_WINDOW) win.shift();
      if (win.length === FIX_WINDOW && isFixation(win)) return;
    }
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
        hint.textContent = fr.found ? t('calib.hint.eyes') : t('calib.hint.noface');
      }
      if (performance.now() - waitingSince > MAX_WAIT_MS) {
        throw new Error(t('calib.err.noface'));
      }
    }
    return samples;
  }
}
