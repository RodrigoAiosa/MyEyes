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
  constructor(lambda = 0.05) {
    this.lambda = lambda;
  }

  fit(X, Y) {
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

/**
 * Ajusta o modelo a partir dos pontos de calibração e estima a precisão por
 * validação cruzada "deixe um ponto de fora" (conservadora: os cantos são extrapolados).
 * @param {{fx:number, fy:number, samples:number[][]}[]} groups  fx/fy em [0,1]
 * @returns {{model: RidgeModel, errPx: number, trainErrPx: number}}
 */
export function fitFromGroups(groups, width, height, lambda = 0.05) {
  const { X, Y } = toTrainingSet(groups);
  if (X.length < 20) throw new Error('Poucas amostras para calibrar');
  const model = new RidgeModel(lambda).fit(X, Y);

  const err = (mdl, xs, ys) =>
    xs.reduce((s, x, i) => {
      const p = mdl.predict(x);
      return s + Math.hypot((p[0] - ys[i][0]) * width, (p[1] - ys[i][1]) * height);
    }, 0) / xs.length;

  const trainErrPx = err(model, X, Y);

  const cv = [];
  for (let k = 0; k < groups.length; k++) {
    const rest = toTrainingSet(groups.filter((_, i) => i !== k));
    const held = toTrainingSet([groups[k]]);
    if (rest.X.length < 20 || !held.X.length) continue;
    try {
      cv.push(err(new RidgeModel(lambda).fit(rest.X, rest.Y), held.X, held.Y));
    } catch {
      /* ignora dobra degenerada */
    }
  }
  return { model, errPx: cv.length ? median(cv) : trainErrPx, trainErrPx };
}

export function qualityLabel(errPx) {
  if (errPx < 150) return { level: 'boa', text: 'Boa' };
  if (errPx < 280) return { level: 'media', text: 'Razoável' };
  return { level: 'baixa', text: 'Baixa' };
}
