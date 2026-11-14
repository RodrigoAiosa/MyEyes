// Simulação comparando o pipeline ANTIGO (9 pontos, Ridge fixo com todas as características)
// com o NOVO (13 pontos, seleção de modelo por validação cruzada, limites de cabeça, autoajuste).
// Os dados são sintéticos (não substituem testar com olhos reais), mas incluem as dificuldades
// típicas: relação olho→tela não linear, ruído, quadros-outlier e a cabeça se mexendo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RidgeModel, fitFromGroups, trimOutliers } from '../js/regression.js';
import { expandFeatures } from '../js/features.js';
import { dropSaccades, isFixation } from '../js/fixation.js';
import { CALIB_POINTS } from '../js/calibration.js';

const W = 1366, H = 768;
const OLD_POINTS = [0.08, 0.5, 0.92].flatMap((fy) => [0.08, 0.5, 0.92].map((fx) => [fx, fy]));

function rng(seed) {
  let s = seed >>> 0;
  const u = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const g = () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(2 * Math.PI * u());
  return { u, g };
}

function makeWorld(seed, { noise = 0.004, outlier = 0.06 } = {}) {
  const r = rng(seed);
  const head = { nx: 0.5, ny: 0.55, yaw: 0, pitch: 0 };
  const walk = (k = 1) => {
    head.nx += 0.0015 * k * r.g() - 0.02 * (head.nx - 0.5);
    head.ny += 0.0015 * k * r.g() - 0.02 * (head.ny - 0.55);
    head.yaw += 0.002 * k * r.g() - 0.02 * head.yaw;
    head.pitch += 0.002 * k * r.g() - 0.02 * head.pitch;
  };
  // verdade: relação não linear, acoplamento entre eixos e influência da cabeça
  const frame = (u, v, bias = 0) => {
    const du = u - 0.5, dv = v - 0.5;
    const hAvg = 0.2 * Math.sin(du * 1.3) + 0.03 * du * dv - 0.25 * (head.nx - 0.5) - 0.4 * head.yaw + bias;
    const vAvg = 0.09 * dv + 0.04 * dv * dv + 0.02 * du * du + 0.25 * (head.ny - 0.55) + 0.3 * head.pitch;
    const out = r.u() < outlier ? 0.04 : 0;
    const sgn = r.u() < 0.5 ? -1 : 1;
    const n = () => noise * r.g() + sgn * out * r.u();
    return [hAvg * 1.1 + 0.004 + n(), vAvg + 0.003 + n(), hAvg * 0.9 - 0.004 + n(), vAvg - 0.003 + n(), head.nx, head.ny, head.yaw, head.pitch];
  };
  return { head, walk, frame, r };
}

function calibrate(world, points, n = 30) {
  return points.map(([fx, fy]) => {
    world.walk(4); // a cabeça muda um pouco entre um ponto e outro
    const samples = [];
    for (let i = 0; i < n; i++) { world.walk(); samples.push(world.frame(fx, fy)); }
    return { fx, fy, samples };
  });
}

function oldModel(groups) {
  const X = [], Y = [];
  for (const g of groups) for (const f of trimOutliers(g.samples)) { X.push(expandFeatures(f)); Y.push([g.fx, g.fy]); }
  const m = new RidgeModel(0.05).fit(X, Y);
  return { predict: (f) => m.predict(expandFeatures(f)) };
}

/** erro médio (px) em alvos fora da calibração; média de 10 quadros por alvo (≈ efeito do filtro). */
function evaluate(world, model, targets = 60, bias = 0) {
  let sum = 0;
  for (let t = 0; t < targets; t++) {
    const u = 0.05 + 0.9 * world.r.u(), v = 0.05 + 0.9 * world.r.u();
    world.walk(3);
    let px = 0, py = 0;
    for (let i = 0; i < 10; i++) { world.walk(); const p = model.predict(world.frame(u, v, bias)); px += p[0] / 10; py += p[1] / 10; }
    sum += Math.hypot((px - u) * W, (py - v) * H);
  }
  return sum / targets;
}

function newModel(groups) {
  const cleaned = groups.map((g) => ({ ...g, samples: dropSaccades(g.samples) }));
  return fitFromGroups(cleaned, W, H).model;
}

test('pipeline novo tem erro menor que o antigo em alvos novos (média de 25 simulações)', () => {
  let eOld = 0, eNew = 0, wins = 0;
  const N = 25;
  for (let seed = 1; seed <= N; seed++) {
    const wo = makeWorld(seed), wn = makeWorld(seed);
    const o = evaluate(wo, oldModel(calibrate(wo, OLD_POINTS)));
    const n = evaluate(wn, newModel(calibrate(wn, CALIB_POINTS)));
    eOld += o / N; eNew += n / N; if (n < o) wins++;
  }
  console.log(`  erro médio — antigo: ${eOld.toFixed(1)} px | novo: ${eNew.toFixed(1)} px | novo melhor em ${wins}/${N}`);
  assert.ok(eNew < eOld * 0.85, `novo (${eNew}) deveria ser ≥15% melhor que antigo (${eOld})`);
  assert.ok(wins >= Math.ceil(N * 0.7));
});

test('com poucas amostras ruidosas, o novo continua estável (não explode)', () => {
  for (let seed = 100; seed < 110; seed++) {
    const w = makeWorld(seed, { noise: 0.008, outlier: 0.12 });
    const e = evaluate(w, newModel(calibrate(w, CALIB_POINTS, 15)));
    assert.ok(e < 400, `seed ${seed}: erro ${e}`);
  }
});

test('limites da cabeça: sair muito da faixa calibrada não faz o cursor disparar', () => {
  const w = makeWorld(5);
  const model = newModel(calibrate(w, CALIB_POINTS));
  const f = w.frame(0.5, 0.5);
  const base = model.predict(f);
  const wild = f.slice(); wild[4] += 5; wild[6] += 3; // cabeça "teletransportada"
  const p = model.predict(wild);
  assert.ok(Math.hypot((p[0] - base[0]) * W, (p[1] - base[1]) * H) < 0.5 * W, 'deslocamento limitado');
});

test('autoajuste: cliques confirmados reduzem um desvio que surge depois da calibração', () => {
  let before = 0, after = 0;
  const N = 15;
  for (let seed = 200; seed < 200 + N; seed++) {
    const w = makeWorld(seed);
    const model = newModel(calibrate(w, CALIB_POINTS));
    const shift = 0.012; // deslocamento sistemático dos olhos (ex.: cabeça mudou, cansaço)
    before += evaluate(w, model, 30, shift) / N;
    for (let c = 0; c < 20; c++) { // 20 cliques confirmados em alvos aleatórios
      const u = 0.1 + 0.8 * w.r.u(), v = 0.1 + 0.8 * w.r.u();
      const feats = Array.from({ length: 8 }, () => w.frame(u, v, shift));
      const f = feats[0].map((_, j) => feats.reduce((a, x) => a + x[j], 0) / feats.length);
      model.adapt(f, u, v);
    }
    after += evaluate(w, model, 30, shift) / N;
  }
  console.log(`  com desvio: ${before.toFixed(1)} px → após 20 cliques: ${after.toFixed(1)} px`);
  assert.ok(after < before * 0.8, `autoajuste deveria reduzir o erro (${before} → ${after})`);
});

test('autoajuste ignora "cliques" absurdos (olhando muito longe do alvo)', () => {
  const w = makeWorld(9);
  const model = newModel(calibrate(w, CALIB_POINTS));
  const f = w.frame(0.2, 0.2);
  assert.equal(model.adapt(f, 0.9, 0.9), false);
  assert.deepEqual(model.bias, [0, 0]);
});

test('isFixation / dropSaccades', () => {
  const still = Array.from({ length: 6 }, (_, i) => [0.1 + i * 0.0005, 0.02, 0.1, 0.02, 0, 0, 0, 0]);
  assert.equal(isFixation(still), true);
  const moving = Array.from({ length: 6 }, (_, i) => [0.1 + i * 0.03, 0.02, 0.1, 0.02, 0, 0, 0, 0]);
  assert.equal(isFixation(moving), false);
  const mix = [...still, ...still, [0.4, 0.2, 0.4, 0.2, 0, 0, 0, 0]];
  assert.equal(dropSaccades(mix).length, 12);
});
