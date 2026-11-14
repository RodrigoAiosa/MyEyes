import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, diagnose, toPoints, evaluateGroups } from '../js/diagnostics.js';
import { fitFromGroups } from '../js/regression.js';
import { CALIB_POINTS } from '../js/calibration.js';

const W = 1366, H = 768;
const keys = (pts) => diagnose(summarize(pts, W, H)).map((f) => f.key);
const pt = (i, fx, fy, dxPx, dyPx, jitterPx = 10) => ({ i, fx, fy, px: fx + dxPx / W, py: fy + dyPx / H, jitterPx });

test('previsões perfeitas → "boa precisão" e nada de alerta', () => {
  const pts = CALIB_POINTS.map(([x, y], i) => pt(i, x, y, 2, 2));
  const k = keys(pts);
  assert.deepEqual(k, ['diag.f.good']);
});

test('desvio sistemático para a direita é detectado, com o sinal certo', () => {
  const pts = CALIB_POINTS.map(([x, y], i) => pt(i, x, y, 120, 0));
  const f = diagnose(summarize(pts, W, H));
  const bias = f.find((x) => x.key === 'diag.f.bias');
  assert.ok(bias, 'deveria detectar viés');
  assert.ok(bias.vars.dx > 100 && Math.abs(bias.vars.dy) < 1);
});

test('erro dominante na vertical e na horizontal', () => {
  const alt = (v) => (v % 2 ? 1 : -1);
  const vert = CALIB_POINTS.map(([x, y], i) => pt(i, x, y, 10 * alt(i), 160 * alt(i + 1)));
  assert.ok(keys(vert).includes('diag.f.vertical'));
  const hor = CALIB_POINTS.map(([x, y], i) => pt(i, x, y, 160 * alt(i), 10 * alt(i + 1)));
  assert.ok(keys(hor).includes('diag.f.horizontal'));
});

test('bordas muito piores que o centro', () => {
  const pts = CALIB_POINTS.map(([x, y], i) => {
    const edge = Math.abs(x - 0.5) > 0.3 || Math.abs(y - 0.5) > 0.3;
    return pt(i, x, y, (edge ? 220 : 30) * (i % 2 ? 1 : -1), 0);
  });
  assert.ok(keys(pts).includes('diag.f.edges'));
});

test('tremor alto e pior ponto', () => {
  const noisy = CALIB_POINTS.map(([x, y], i) => pt(i, x, y, 20, 20, 90));
  assert.ok(keys(noisy).includes('diag.f.jitter'));
  const one = CALIB_POINTS.map(([x, y], i) => pt(i, x, y, i === 4 ? 500 : 20 * (i % 2 ? 1 : -1), 0));
  const w = diagnose(summarize(one, W, H)).find((f) => f.key === 'diag.f.worst');
  assert.equal(w.vars.n, 5);
});

test('summarize: média, RMS e centro × borda corretos', () => {
  const s = summarize([pt(0, 0.5, 0.5, 30, 40), pt(1, 0.08, 0.1, 60, 80)], W, H);
  assert.ok(Math.abs(s.rows[0].err - 50) < 1e-6);
  assert.ok(Math.abs(s.center - 50) < 1e-6 && Math.abs(s.edge - 100) < 1e-6);
  assert.ok(Math.abs(s.mean - 75) < 1e-6);
  assert.equal(summarize([], W, H), null);
});

test('fitFromGroups devolve previsões por ponto (cv e ajuste) coerentes', () => {
  let seed = 3;
  const r = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296 - 0.5);
  const groups = CALIB_POINTS.map(([fx, fy]) => ({
    fx, fy,
    samples: Array.from({ length: 30 }, () => {
      const h = 0.2 * (fx - 0.5) + r() * 0.004, v = 0.09 * (fy - 0.5) + r() * 0.004;
      return [h, v, h, v, 0.5 + r() * 0.01, 0.55 + r() * 0.01, r() * 0.01, r() * 0.01];
    }),
  }));
  const { perPoint } = fitFromGroups(groups, W, H);
  assert.equal(perPoint.length, CALIB_POINTS.length);
  const s = summarize(toPoints(perPoint, 'fit'), W, H);
  assert.ok(s.mean < 60, `ajuste: ${s.mean}`);
  assert.ok(perPoint.every((p) => p.cv && Number.isFinite(p.jitterPx)));
  const cv = summarize(toPoints(perPoint, 'cv'), W, H);
  assert.ok(Number.isFinite(cv.mean));
});

test('evaluateGroups mede pontos de teste com a função atual', () => {
  const groups = [{ fx: 0.3, fy: 0.4, samples: [[0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0]] }];
  const pts = evaluateGroups(groups, () => [0.3 + 50 / W, 0.4], W, H);
  const s = summarize(pts, W, H);
  assert.ok(Math.abs(s.mean - 50) < 1e-6 && s.jitter < 1e-6);
});
