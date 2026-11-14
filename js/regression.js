// Regressão Ridge (mínimos quadrados com regularização) + ajuste da calibração.
import { expandFeatures } from './features.js';

/** Resolve A·x = b por eliminação de Gauss com pivoteamento parcial. */
export function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) throw new Error('Matriz singular');
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let k = i + 1; k < n; k++) s -= M[i][k] * x[k];
    x[i] = s / M[i][i];
  }
  return x;
}

export class RidgeModel {
  /** @param {number} lambda regularização (proporcional ao nº de amostras) */
  constructor(lambda = 0.05, cols = null) {
    this.lambda = lambda;
    this.cols = cols; // subconjunto de colunas usadas (null = todas)
  }

  _sel(x) {
    return this.cols ? this.cols.map((c) => x[c]) : x;
  }

  fit(X, Y) {
    X = X.map((x) => this._sel(x));
    const n = X.length, d = X[0].length, m = Y[0].length;
    this.mean = new Array(d).fill(0);
    this.std = new Array(d).fill(0);
    for (const x of X) for (let j = 0; j < d; j++) this.mean[j] += x[j] / n;
    for (const x of X) for (let j = 0; j < d; j++) this.std[j] += (x[j] - this.mean[j]) ** 2 / n;
    this.std = this.std.map((s) => Math.sqrt(s) || 1);

    const D = d + 1;
    const Z = X.map((x) => [1, ...x.map((v, j) => (v - this.mean[j]) / this.std[j])]);
    const A = Array.from({ length: D }, () => new Array(D).fill(0));
    const B = Array.from({ length: m }, () => new Array(D).fill(0));
    for (let s = 0; s < n; s++) {
      const z = Z[s];
      for (let i = 0; i < D; i++) {
        for (let j = 0; j < D; j++) A[i][j] += z[i] * z[j];
        for (let t = 0; t < m; t++) B[t][i] += z[i] * Y[s][t];
      }
    }
    for (let i = 1; i < D; i++) A[i][i] += this.lambda * n; // não penaliza o viés
    this.W = B.map((b) => solveLinear(A, b));
    return this;
  }

  predict(x) {
    x = this._sel(x);
    const z = [1, ...x.map((v, j) => (v - this.mean[j]) / this.std[j])];
    return this.W.map((w) => w.reduce((s, wi, i) => s + wi * z[i], 0));
  }
}

const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const k = s.length >> 1;
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
};

/** Descarta as amostras mais distantes da mediana do ponto (piscadas, sacadas). */
export function trimOutliers(samples, keep = 0.8) {
  if (samples.length < 5) return samples;
  const med = [0, 1, 2, 3].map((j) => median(samples.map((s) => s[j])));
  const scored = samples.map((s) => ({
    s,
    d: Math.hypot(...[0, 1, 2, 3].map((j) => s[j] - med[j])),
  }));
  scored.sort((a, b) => a.d - b.d);
  return scored.slice(0, Math.max(3, Math.ceil(scored.length * keep))).map((o) => o.s);
}

function toTrainingSet(groups) {
  const X = [], Y = [];
  for (const g of groups) {
    for (const f of trimOutliers(g.samples)) {
      X.push(expandFeatures(f));
      Y.push([g.fx, g.fy]);
    }
  }
  return { X, Y };
}

// Colunas do vetor expandido: 0-3 íris, 4-5 nariz, 6-7 yaw/pitch, 8-10 termos quadráticos.
const FEATURE_SETS = {
  completo: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  'sem-angulos': [0, 1, 2, 3, 4, 5, 8, 9, 10],
  'só-olhos': [0, 1, 2, 3, 8, 9, 10],
  'só-olhos-linear': [0, 1, 2, 3],
};
const LAMBDAS = [0.005, 0.02, 0.08, 0.3, 1];

/**
 * Modelo final: Ridge + limites das características da cabeça (evita extrapolar se a
 * pessoa se mexer) + correção de viés online (autoajuste a cada clique confirmado).
 */
export class GazeModel {
  constructor(ridge, headRange, info = {}) {
    this.ridge = ridge;
    this.headRange = headRange; // [{min,max}] para nariz x, y, yaw, pitch
    this.bias = [0, 0];
    this.info = info;
  }

  _clampHead(f) {
    const g = f.slice();
    for (let i = 0; i < 4; i++) {
      const { min, max } = this.headRange[i];
      const m = (max - min) * 0.5 + 1e-3;
      g[4 + i] = Math.min(max + m, Math.max(min - m, g[4 + i]));
    }
    return g;
  }

  predictRaw(f) {
    return this.ridge.predict(expandFeatures(this._clampHead(f)));
  }

  /** @param {number[]} f características base (8) → [x, y] normalizados na tela */
  predict(f) {
    const p = this.predictRaw(f);
    return [p[0] + this.bias[0], p[1] + this.bias[1]];
  }

  /**
   * O usuário confirmou (clicou) que estava olhando para (tx, ty): aproxima o viés
   * dessa diferença. Ignora diferenças absurdas (clique acidental) e limita a correção.
   */
  adapt(f, tx, ty, rate = 0.12, maxJump = 0.2, maxBias = 0.15) {
    const p = this.predictRaw(f);
    const dx = tx - p[0] - this.bias[0];
    const dy = ty - p[1] - this.bias[1];
    if (Math.hypot(dx, dy) > maxJump) return false;
    const c = (v) => Math.max(-maxBias, Math.min(maxBias, v));
    this.bias[0] = c(this.bias[0] + rate * dx);
    this.bias[1] = c(this.bias[1] + rate * dy);
    return true;
  }
}

function headRangeOf(groups) {
  const r = [0, 1, 2, 3].map(() => ({ min: Infinity, max: -Infinity }));
  for (const g of groups) {
    for (const f of g.samples) {
      for (let i = 0; i < 4; i++) {
        const v = f[4 + i];
        if (v < r[i].min) r[i].min = v;
        if (v > r[i].max) r[i].max = v;
      }
    }
  }
  return r;
}

function cvError(groups, lambda, cols, width, height) {
  const err = (mdl, xs, ys) =>
    xs.reduce((s, x, i) => {
      const p = mdl.predict(x);
      return s + Math.hypot((p[0] - ys[i][0]) * width, (p[1] - ys[i][1]) * height);
    }, 0) / xs.length;
  const cv = [];
  for (let k = 0; k < groups.length; k++) {
    const rest = toTrainingSet(groups.filter((_, i) => i !== k));
    const held = toTrainingSet([groups[k]]);
    if (rest.X.length < 20 || !held.X.length) continue;
    try {
      cv.push(err(new RidgeModel(lambda, cols).fit(rest.X, rest.Y), held.X, held.Y));
    } catch {
      /* dobra degenerada */
    }
  }
  return cv.length ? median(cv) : Infinity;
}

/**
 * Ajusta o modelo, escolhendo o melhor conjunto de características e regularização por
 * validação cruzada "deixe um ponto de fora" (conservadora: pontos de borda são extrapolados).
 * @param {{fx:number, fy:number, samples:number[][]}[]} groups  fx/fy em [0,1]
 * @returns {{model: GazeModel, errPx: number, trainErrPx: number, chosen: {set: string, lambda: number}, headRef: {x:number,y:number}}}
 */
export function fitFromGroups(groups, width, height, lambda = null) {
  const { X, Y } = toTrainingSet(groups);
  if (X.length < 20) throw new Error('Poucas amostras para calibrar');

  const lambdas = lambda == null ? LAMBDAS : [lambda];
  let best = { err: Infinity, set: 'completo', lambda: lambdas[0] };
  for (const [set, cols] of Object.entries(FEATURE_SETS)) {
    for (const l of lambdas) {
      const e = cvError(groups, l, cols, width, height);
      if (e < best.err) best = { err: e, set, lambda: l };
    }
  }
  if (!Number.isFinite(best.err)) best.err = 0;

  const ridge = new RidgeModel(best.lambda, FEATURE_SETS[best.set]).fit(X, Y);
  const model = new GazeModel(ridge, headRangeOf(groups), { set: best.set, lambda: best.lambda });
  const trainErrPx =
    X.reduce((s, x, i) => {
      const p = ridge.predict(x);
      return s + Math.hypot((p[0] - Y[i][0]) * width, (p[1] - Y[i][1]) * height);
    }, 0) / X.length;

  const hr = model.headRange;
  const headRef = { x: (hr[0].min + hr[0].max) / 2, y: (hr[1].min + hr[1].max) / 2 };
  return { model, errPx: best.err || trainErrPx, trainErrPx, chosen: { set: best.set, lambda: best.lambda }, headRef };
}

export function qualityLabel(errPx) {
  if (errPx < 150) return { level: 'boa', text: 'Boa' };
  if (errPx < 280) return { level: 'media', text: 'Razoável' };
  return { level: 'baixa', text: 'Baixa' };
}
