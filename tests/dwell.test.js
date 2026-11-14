import test from 'node:test';
import assert from 'node:assert/strict';
import { DwellController } from '../js/dwell.js';

function stubEl(name, hold = false) {
  const el = {
    name, clicks: 0, classes: new Set(), vars: {},
    dataset: hold ? { hold: '' } : {},
    classList: { add: (...c) => c.forEach((x) => el.classes.add(x)), remove: (...c) => c.forEach((x) => el.classes.delete(x)) },
    style: { setProperty: (k, v) => (el.vars[k] = v) },
    click() { el.clicks++; },
  };
  return el;
}
const rect = (l, t, w, h) => ({ left: l, top: t, right: l + w, bottom: t + h, width: w, height: h });

function setup(opts = {}) {
  const a = stubEl('A'), b = stubEl('B');
  const entries = [{ el: a, rect: rect(100, 100, 200, 100) }, { el: b, rect: rect(400, 100, 200, 100) }];
  const fired = [];
  const d = new DwellController({ dwellMs: 1000, snapPx: 40, hysteresisPx: 20, getTargets: () => entries, onFire: (e) => fired.push(e.name), ...opts });
  return { a, b, d, fired, entries };
}

function gaze(d, x, y, ms, t0 = 0, step = 33) {
  let t = t0;
  for (; t < t0 + ms; t += step) d.update(x, y, t);
  return t;
}

test('clica após o tempo de permanência', () => {
  const { a, d, fired } = setup();
  gaze(d, 150, 150, 1200);
  assert.equal(a.clicks, 1);
  assert.deepEqual(fired, ['A']);
});

test('não clica antes do tempo', () => {
  const { a, d } = setup();
  gaze(d, 150, 150, 800);
  assert.equal(a.clicks, 0);
  assert.ok(d.progress > 0.5 && d.progress < 1);
});

test('não repete o clique enquanto o olhar permanece; rearma ao sair', () => {
  const { a, d } = setup();
  let t = gaze(d, 150, 150, 3000);
  assert.equal(a.clicks, 1, 'travado até sair');
  t = gaze(d, 700, 600, 400, t); // sai (além da tolerância)
  gaze(d, 150, 150, 1200, t);
  assert.equal(a.clicks, 2);
});

test('trocar de alvo zera o progresso', () => {
  const { a, b, d } = setup();
  let t = gaze(d, 150, 150, 700);
  gaze(d, 500, 150, 700, t);
  assert.equal(a.clicks, 0);
  assert.equal(b.clicks, 0);
});

test('imã: olhar perto do botão (dentro do raio) conta', () => {
  const { a, d } = setup();
  gaze(d, 80, 150, 1200); // 20px à esquerda de A
  assert.equal(a.clicks, 1);
});

test('fora do raio do imã não aciona nada', () => {
  const { a, b, d } = setup();
  gaze(d, 350, 400, 2000);
  assert.equal(a.clicks + b.clicks, 0);
});

test('tolerância: um desvio curto não zera o progresso', () => {
  const { a, d } = setup();
  let t = gaze(d, 150, 150, 600);
  t = gaze(d, 350, 400, 100, t); // olhar sai por 100 ms
  gaze(d, 150, 150, 600, t);
  assert.equal(a.clicks, 1);
});

test('clickNow aciona o alvo atual imediatamente', () => {
  const { a, d } = setup();
  gaze(d, 150, 150, 100);
  assert.equal(d.clickNow(), true);
  assert.equal(a.clicks, 1);
});

test('desativado não clica', () => {
  const { a, d } = setup();
  d.setEnabled(false);
  gaze(d, 150, 150, 2000);
  assert.equal(a.clicks, 0);
});

test('[data-hold] repete o clique enquanto o olhar permanece', () => {
  const a = stubEl('UP', true);
  const d = new DwellController({ dwellMs: 1000, getTargets: () => [{ el: a, rect: rect(0, 0, 100, 100) }] });
  gaze(d, 50, 50, 1000);
  assert.ok(a.clicks >= 4, `clicks=${a.clicks}`);
});

test('hold() congela o relógio (piscada não conta como permanência)', () => {
  const { a, d } = setup();
  let t = gaze(d, 150, 150, 500);
  for (let i = 0; i < 20; i++) { d.hold(t); t += 33; }
  gaze(d, 150, 150, 300, t);
  assert.equal(a.clicks, 0);
});
