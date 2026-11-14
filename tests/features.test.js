import test from 'node:test';
import assert from 'node:assert/strict';
import { eyeOffsets, extractFeatures, expandFeatures, blinkScore, headAngles, MIN_LANDMARKS } from '../js/features.js';

function makeLandmarks({ irisDx = 0, irisDy = 0 } = {}) {
  const lm = Array.from({ length: MIN_LANDMARKS }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  // olho direito da pessoa (imagem esquerda): cantos 33 e 133, largura 0.1
  lm[33] = { x: 0.35, y: 0.4, z: 0 }; lm[133] = { x: 0.45, y: 0.4, z: 0 };
  lm[468] = { x: 0.4 + irisDx, y: 0.4 + irisDy, z: 0 };
  // olho esquerdo (imagem direita): 362 (esq. na imagem) e 263 (dir. na imagem)
  lm[362] = { x: 0.55, y: 0.4, z: 0 }; lm[263] = { x: 0.65, y: 0.4, z: 0 };
  lm[473] = { x: 0.6 + irisDx, y: 0.4 + irisDy, z: 0 };
  lm[1] = { x: 0.5, y: 0.55, z: 0 };
  return lm;
}

test('íris centralizada → offsets ~0', () => {
  const [h, v] = eyeOffsets(makeLandmarks(), 1000, 1000, { a: 33, b: 133, iris: 468 });
  assert.ok(Math.abs(h) < 1e-9 && Math.abs(v) < 1e-9);
});

test('íris para a direita da imagem → h positivo em ambos os olhos', () => {
  const lm = makeLandmarks({ irisDx: 0.02 });
  const f = extractFeatures(lm, null, 1000, 1000);
  assert.ok(Math.abs(f[0] - 0.2) < 1e-9, `hD=${f[0]}`);
  assert.ok(Math.abs(f[2] - 0.2) < 1e-9, `hE=${f[2]}`);
  assert.ok(Math.abs(f[1]) < 1e-9);
});

test('íris para baixo → v positivo', () => {
  const f = extractFeatures(makeLandmarks({ irisDy: 0.01 }), null, 1000, 1000);
  assert.ok(f[1] > 0.09 && f[3] > 0.09);
});

test('extractFeatures retorna null sem íris (poucos landmarks)', () => {
  assert.equal(extractFeatures(new Array(468).fill({ x: 0, y: 0 }), null, 100, 100), null);
});

test('expandFeatures acrescenta 3 termos', () => {
  const f = extractFeatures(makeLandmarks({ irisDx: 0.01 }), null, 1000, 1000);
  assert.equal(expandFeatures(f).length, f.length + 3);
});

test('headAngles da identidade = 0', () => {
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const [yaw, pitch] = headAngles(I);
  assert.ok(Math.abs(yaw) < 1e-9 && Math.abs(pitch) < 1e-9);
});

test('blinkScore faz a média dos dois olhos', () => {
  const s = blinkScore([
    { categoryName: 'eyeBlinkLeft', score: 0.8 },
    { categoryName: 'eyeBlinkRight', score: 0.6 },
    { categoryName: 'jawOpen', score: 1 },
  ]);
  assert.ok(Math.abs(s - 0.7) < 1e-9);
  assert.equal(blinkScore(null), 0);
});
