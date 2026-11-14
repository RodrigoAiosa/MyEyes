import test from 'node:test';
import assert from 'node:assert/strict';
import { RidgeModel, solveLinear, fitFromGroups, trimOutliers, qualityLabel } from '../js/regression.js';

// gerador pseudo-aleatório determinístico
function rng(seed = 42) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

test('solveLinear resolve um sistema 3x3', () => {
  const x = solveLinear([[2, 1, -1], [-3, -1, 2], [-2, 1, 2]], [8, -11, -3]);
  assert.ok(Math.abs(x[0] - 2) < 1e-9 && Math.abs(x[1] - 3) < 1e-9 && Math.abs(x[2] + 1) < 1e-9);
});

test('RidgeModel recupera um mapa linear', () => {
  const r = rng();
  const X = [], Y = [];
  for (let i = 0; i < 200; i++) {
    const a = r(), b = r();
    X.push([a, b]);
    Y.push([0.2 + 0.5 * a + 0.1 * b, 0.7 - 0.3 * a + 0.4 * b]);
  }
  const m = new RidgeModel(1e-6).fit(X, Y);
  const p = m.predict([0.5, 0.5]);
  assert.ok(Math.abs(p[0] - 0.5) < 1e-3, `x=${p[0]}`);
  assert.ok(Math.abs(p[1] - 0.75) < 1e-3, `y=${p[1]}`);
});

test('trimOutliers remove amostras distantes', () => {
  const base = Array.from({ length: 20 }, () => [0.1, 0.1, 0.1, 0.1, 0, 0, 0, 0]);
  const withOut = [...base, [5, 5, 5, 5, 0, 0, 0, 0]];
  const out = trimOutliers(withOut, 0.9);
  assert.ok(!out.some((s) => s[0] === 5));
});

test('fitFromGroups: calibração sintética 3x3 com ruído tem erro baixo', () => {
  const r = rng(7);
  const W = 1366, H = 768;
  const pts = [];
  for (const fy of [0.08, 0.5, 0.92]) for (const fx of [0.08, 0.5, 0.92]) pts.push([fx, fy]);
  // olhar "verdadeiro": íris desloca-se linearmente com o ponto na tela
  const groups = pts.map(([fx, fy]) => ({
    fx, fy,
    samples: Array.from({ length: 30 }, () => {
      const h = (fx - 0.5) * 0.3 + (r() - 0.5) * 0.004;
      const v = (fy - 0.5) * 0.15 + (r() - 0.5) * 0.004;
      return [h, v, h * 1.02, v * 0.98, 0.5 + (r() - 0.5) * 0.01, 0.5 + (r() - 0.5) * 0.01, 0.01 * r(), 0.01 * r()];
    }),
  }));
  const { model, errPx, trainErrPx, chosen } = fitFromGroups(groups, W, H);
  assert.ok(chosen.set && chosen.lambda > 0);
  assert.ok(trainErrPx < 60, `trainErrPx=${trainErrPx}`);
  assert.ok(Number.isFinite(errPx));
  const center = model.predict([0, 0, 0, 0, 0.5, 0.5, 0.005, 0.005]);
  assert.ok(Math.abs(center[0] - 0.5) < 0.05 && Math.abs(center[1] - 0.5) < 0.05);
});

test('fitFromGroups rejeita poucos dados', () => {
  assert.throws(() => fitFromGroups([{ fx: 0.5, fy: 0.5, samples: [[0, 0, 0, 0, 0, 0, 0, 0]] }], 100, 100));
});

test('qualityLabel', () => {
  assert.equal(qualityLabel(100).level, 'boa');
  assert.equal(qualityLabel(200).level, 'media');
  assert.equal(qualityLabel(400).level, 'baixa');
});
