import test from 'node:test';
import assert from 'node:assert/strict';
import { OneEuroFilter } from '../js/filters.js';

test('primeira amostra passa sem alteração', () => {
  const f = new OneEuroFilter();
  assert.equal(f.filter(100, 0), 100);
});

test('reduz ruído em sinal parado', () => {
  const f = new OneEuroFilter({ minCutoff: 0.8, beta: 0.01 });
  let seed = 1;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 40;
  let rawVar = 0, outVar = 0, n = 0;
  for (let i = 0; i < 300; i++) {
    const v = 500 + noise();
    const o = f.filter(v, i / 30);
    if (i > 30) { rawVar += (v - 500) ** 2; outVar += (o - 500) ** 2; n++; }
  }
  assert.ok(outVar / n < (rawVar / n) / 4, 'variância deveria cair bastante');
});

test('acompanha movimento rápido (beta alto reduz o atraso)', () => {
  const f = new OneEuroFilter({ minCutoff: 0.5, beta: 0.05 });
  for (let i = 0; i < 30; i++) f.filter(100, i / 30);
  let out = 0;
  for (let i = 30; i < 45; i++) out = f.filter(900, i / 30);
  assert.ok(out > 700, `out=${out}`);
});
