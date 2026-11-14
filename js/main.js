import { EyeTracker, describeError } from './tracker.js';
import { Calibration } from './calibration.js';
import { DwellController } from './dwell.js';
import { OneEuroFilter } from './filters.js';
import { loadSettings, saveSettings } from './settings.js';

const $ = (sel, root = document) => root.querySelector(sel);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ───────────── Conteúdo ───────────── */
const PHRASES = [
  ['✅', 'Sim'], ['❌', 'Não'], ['🙏', 'Obrigado'], ['🤝', 'Por favor'],
  ['💧', 'Quero água'], ['🍽', 'Estou com fome'], ['🚻', 'Preciso ir ao banheiro'], ['🤕', 'Estou com dor'],
  ['🥶', 'Estou com frio'], ['🥵', 'Estou com calor'], ['🛏', 'Quero mudar de posição'], ['🚨', 'Preciso de ajuda!'],
];
const KEY_ROWS = [
  'QWERTYUIOP'.split(''),
  'ASDFGHJKLÇ'.split(''),
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '?'],
];
const SETTINGS_UI = [
  { key: 'dwellMs', label: 'Tempo para clicar', min: 600, max: 3000, step: 200, fmt: (v) => `${(v / 1000).toFixed(1)} s` },
  { key: 'smoothing', label: 'Suavização do cursor', min: 1, max: 5, step: 1, fmt: (v) => `${v}/5` },
  { key: 'cursorScale', label: 'Tamanho do cursor', min: 1, max: 3, step: 0.5, fmt: (v) => `${v}×` },
  { key: 'snapPx', label: 'Imã nos botões', min: 0, max: 120, step: 20, fmt: (v) => (v ? `${v} px` : 'off') },
];
const TOGGLES_UI = [
  { key: 'blinkClick', label: 'Clicar com piscada longa' },
  { key: 'showCamera', label: 'Mostrar câmera' },
  { key: 'sound', label: 'Som ao clicar' },
  { key: 'autoAdjust', label: 'Autoajuste contínuo' },
];
const CUTOFFS = [2.5, 1.6, 1.0, 0.6, 0.35]; // Hz mínimos do filtro, por nível de suavização
const BLINK_ON = 0.55, BLINK_OFF = 0.35;
const BLINK_MIN_MS = 550, BLINK_MAX_MS = 1800, BLINK_SETTLE_MS = 150;
const CIRC = 2 * Math.PI * 26;

/* ───────────── Estado ───────────── */
const els = {
  video: $('#cam'), cursor: $('#gaze-cursor'), ring: $('#cursor-progress'),
  welcome: $('#welcome'), loading: $('#loading'), calib: $('#calib'), app: $('#app'), paused: $('#paused'),
  calibResult: $('#calib-result'), message: $('#message'), faceStatus: $('#face-status'), faceWarning: $('#face-warning'),
};
const S = {
  name: 'welcome', model: null, settings: loadSettings(), message: '', tab: 'phrases',
  gaze: { x: innerWidth / 2, y: innerHeight / 2 },
  lastFaceMs: 0, blinking: false, blinkStart: null, blinkEndMs: 0, faceOk: null,
  featBuf: [], rawX: [], rawY: [], headRef: null, driftSince: null, lastDriftNotice: -1e9,
};
let frame = null, seq = 0, abort = null;
let fx = new OneEuroFilter(), fy = new OneEuroFilter();

const tracker = new EyeTracker(els.video);
const calibration = new Calibration({
  root: els.calib, dot: $('#calib-dot'), label: $('#calib-label'), hint: $('#calib-hint'),
  getFrame: () => frame,
});
const dwell = new DwellController({ onFire: onDwellFire });

/** Clique confirmado: o usuário estava olhando para o centro deste alvo → corrige o desvio aos poucos. */
function onDwellFire(el) {
  if (S.settings.sound) tick();
  if (!S.settings.autoAdjust || !S.model || S.name !== 'running' || S.featBuf.length < 4) return;
  const r = el.getBoundingClientRect();
  const f = S.featBuf[0].map((_, j) => S.featBuf.reduce((a, v) => a + v[j], 0) / S.featBuf.length);
  const size = Math.max(r.width, r.height);
  const rate = 0.12 * Math.min(1, 200 / size); // alvos grandes: o centro é um rótulo menos confiável
  S.model.adapt(f, (r.left + r.width / 2) / innerWidth, (r.top + r.height / 2) / innerHeight, rate);
}

/* ───────────── Utilidades ───────────── */
let audioCtx = null;
function tick() {
  try {
    audioCtx ??= new AudioContext();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.06, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.12);
  } catch { /* sem áudio */ }
}

function speak(text) {
  if (!text || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'pt-BR';
  speechSynthesis.speak(u);
}

function goFullscreen() {
  try { document.documentElement.requestFullscreen?.().catch(() => {}); } catch { /* ignora */ }
}

/* ───────────── Máquina de estados ───────────── */
function setState(name) {
  S.name = name;
  document.body.dataset.state = name;
  els.welcome.hidden = name !== 'welcome';
  els.loading.hidden = name !== 'loading';
  els.calib.hidden = !['calibrating', 'result'].includes(name);
  els.calibResult.hidden = name !== 'result';
  els.app.hidden = !['running', 'paused'].includes(name);
  els.paused.hidden = name !== 'paused';
  els.cursor.hidden = !['result', 'running', 'paused'].includes(name);

  const scopes = { result: els.calibResult, running: els.app, paused: els.paused };
  dwell.setScope(scopes[name] ?? null);
  dwell.setEnabled(name in scopes);
  if (name === 'calibrating') {
    $('#calib-dot').hidden = false;
    els.calibResult.hidden = true;
  }
  if (name === 'result') $('#calib-dot').hidden = true;
}

async function start() {
  const err = $('#welcome-error');
  err.hidden = true;
  setState('loading');
  goFullscreen();
  try {
    if (!tracker.running) {
      await tracker.start((msg) => { $('#loading-text').textContent = msg; });
    }
  } catch (e) {
    console.error(e);
    tracker.stop();
    err.textContent = describeError(e);
    err.hidden = false;
    setState('welcome');
    return;
  }
  await runCalibration();
}

async function runCalibration() {
  setState('calibrating');
  abort = new AbortController();
  try {
    await new Promise((r) => setTimeout(r, 400));
    const res = await calibration.run(abort.signal);
    S.model = res.model;
    S.headRef = res.headRef;
    applySettings();
    resetGaze();
    showCalibrationResult(res);
  } catch (e) {
    if (e.name === 'AbortError') {
      setState(S.model ? 'running' : 'welcome');
    } else {
      console.error(e);
      setState('welcome');
      const err = $('#welcome-error');
      err.textContent = `${e.message} Confira a iluminação e a posição e tente de novo.`;
      err.hidden = false;
      tracker.stop();
    }
  }
}

function showCalibrationResult({ errPx, quality }) {
  $('#calib-quality').textContent = `Precisão estimada: ${quality.text} (erro ≈ ${Math.round(errPx)} px)`;
  $('#calib-tip').textContent =
    quality.level === 'baixa'
      ? 'A precisão ficou baixa. Melhore a luz no rosto, aproxime-se da câmera e refaça. Se continuar, use botões grandes e aumente o "Imã nos botões" em Ajustes.'
      : 'Quanto mais parada a cabeça, melhor. Se o cursor ficar deslocado, use "Recalibrar" a qualquer momento.';
  setState('result');
}

function resetGaze() {
  fx = new OneEuroFilter({ minCutoff: CUTOFFS[S.settings.smoothing - 1], beta: 0.01 });
  fy = new OneEuroFilter({ minCutoff: CUTOFFS[S.settings.smoothing - 1], beta: 0.01 });
  S.blinking = false;
  S.blinkStart = null;
  S.featBuf = [];
  S.rawX = [];
  S.rawY = [];
  S.driftSince = null;
}

/* ───────────── Pipeline do olhar ───────────── */
tracker.onFrame = (fr) => {
  frame = { ...fr, seq: ++seq };
  if (fr.found !== S.faceOk) {
    S.faceOk = fr.found;
    els.faceStatus.dataset.ok = String(fr.found);
    els.faceStatus.textContent = fr.found ? 'Rosto detectado' : 'Rosto não encontrado';
  }
  if (S.model && ['result', 'running', 'paused'].includes(S.name)) processGaze(fr);
};

function processGaze(fr) {
  const tMs = fr.t * 1000;
  if (!fr.found) {
    if (tMs - S.lastFaceMs > 600) {
      els.cursor.classList.add('lost');
      if (S.name === 'running') els.faceWarning.hidden = false;
      dwell.hold(tMs);
    }
    return;
  }
  S.lastFaceMs = tMs;
  els.cursor.classList.remove('lost');
  els.faceWarning.hidden = true;

  // Piscada (com histerese): congela o olhar e, se habilitado, vira clique.
  const wasBlinking = S.blinking;
  S.blinking = fr.blink > (wasBlinking ? BLINK_OFF : BLINK_ON);
  if (S.blinking && !wasBlinking) S.blinkStart = tMs;
  if (!S.blinking && wasBlinking) {
    const dur = tMs - S.blinkStart;
    S.blinkEndMs = tMs;
    if (S.settings.blinkClick && dur >= BLINK_MIN_MS && dur <= BLINK_MAX_MS) dwell.clickNow();
  }

  checkHeadDrift(fr, tMs);
  const settling = tMs - S.blinkEndMs < BLINK_SETTLE_MS;
  if (S.blinking || settling) {
    dwell.hold(tMs);
  } else {
    const p = S.model.predict(fr.features);
    const px = clamp(p[0], -0.05, 1.05) * innerWidth;
    const py = clamp(p[1], -0.05, 1.05) * innerHeight;
    // mediana de 3 quadros: elimina saltos isolados (falha de rastreamento) antes do filtro
    S.rawX.push(px); S.rawY.push(py);
    if (S.rawX.length > 3) { S.rawX.shift(); S.rawY.shift(); }
    S.gaze.x = fx.filter(med3(S.rawX), fr.t);
    S.gaze.y = fy.filter(med3(S.rawY), fr.t);
    S.featBuf.push(fr.features);
    if (S.featBuf.length > 12) S.featBuf.shift();
    dwell.update(S.gaze.x, S.gaze.y, tMs);
  }
  renderCursor();
}

const med3 = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];

function checkHeadDrift(fr, tMs) {
  if (!S.headRef || S.name !== 'running') return;
  const off = Math.max(Math.abs(fr.features[4] - S.headRef.x), Math.abs(fr.features[5] - S.headRef.y));
  if (off <= 0.06) { S.driftSince = null; return; }
  S.driftSince ??= tMs;
  if (tMs - S.driftSince > 2500 && tMs - S.lastDriftNotice > 20000) {
    S.lastDriftNotice = tMs;
    notify('Sua cabeça mudou de posição. Volte à posição da calibração ou use "Recalibrar".');
  }
}

function renderCursor() {
  els.cursor.style.transform = `translate3d(${S.gaze.x}px, ${S.gaze.y}px, 0)`;
  const { progress, locked } = dwell.getState();
  els.ring.style.strokeDashoffset = String(CIRC * (1 - progress));
  els.ring.style.stroke = locked ? 'var(--warn)' : 'var(--accent)';
}

/* ───────────── Interface ───────────── */
function renderMessage() {
  const max = 38;
  els.message.textContent = S.message.length > max ? `…${S.message.slice(-max)}` : S.message;
}

function renderPhrases() {
  $('#tab-phrases').innerHTML = PHRASES.map(
    ([ico, text]) =>
      `<button class="phrase" data-gaze data-action="phrase" data-text="${text}"><span class="ico">${ico}</span>${text}</button>`,
  ).join('');
}

function renderKeyboard() {
  const rows = KEY_ROWS.map(
    (row) => `<div class="kb-row">${row.map((k) => `<button data-gaze data-action="key" data-key="${k}">${k}</button>`).join('')}</div>`,
  );
  rows.push(
    `<div class="kb-row">
      <button class="w6" data-gaze data-action="key" data-key=" ">ESPAÇO</button>
      <button class="w2" data-gaze data-action="backspace">⌫</button>
      <button class="w2 accent" data-gaze data-action="speak">🔊</button>
    </div>`,
  );
  $('#tab-keyboard').innerHTML = rows.join('');
}

function renderSettings() {
  const steppers = SETTINGS_UI.map((d) => {
    const v = S.settings[d.key];
    return `<div class="setting" data-skey="${d.key}">
      <span class="name">${d.label}</span>
      <button data-gaze data-action="step" data-key="${d.key}" data-dir="-1" ${v <= d.min ? 'disabled' : ''} aria-label="Diminuir">−</button>
      <span class="val">${d.fmt(v)}</span>
      <button data-gaze data-action="step" data-key="${d.key}" data-dir="1" ${v >= d.max ? 'disabled' : ''} aria-label="Aumentar">+</button>
    </div>`;
  });
  const toggles = TOGGLES_UI.map(
    (d) => `<div class="setting" data-skey="${d.key}">
      <span class="name">${d.label}</span>
      <button class="toggle" data-gaze data-action="toggle" data-key="${d.key}" aria-pressed="${S.settings[d.key]}">${S.settings[d.key] ? 'Ligado' : 'Desligado'}</button>
    </div>`,
  );
  $('#tab-settings').innerHTML = [...steppers, ...toggles].join('');
}

function updateSettingsView() {
  for (const d of SETTINGS_UI) {
    const row = $(`#tab-settings [data-skey="${d.key}"]`);
    const v = S.settings[d.key];
    row.querySelector('.val').textContent = d.fmt(v);
    row.querySelector('[data-dir="-1"]').disabled = v <= d.min;
    row.querySelector('[data-dir="1"]').disabled = v >= d.max;
  }
  for (const d of TOGGLES_UI) {
    const b = $(`#tab-settings [data-skey="${d.key}"] .toggle`);
    b.setAttribute('aria-pressed', String(S.settings[d.key]));
    b.textContent = S.settings[d.key] ? 'Ligado' : 'Desligado';
  }
}

function showTab(tab) {
  S.tab = tab;
  for (const id of ['phrases', 'keyboard', 'settings']) $(`#tab-${id}`).hidden = id !== tab;
  document.querySelectorAll('.tabs [role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
}

function applySettings() {
  const s = S.settings;
  dwell.dwellMs = s.dwellMs;
  dwell.snapPx = s.snapPx;
  document.documentElement.style.setProperty('--cursor-scale', String(s.cursorScale));
  els.video.classList.toggle('cam-hidden', !s.showCamera);
  const c = CUTOFFS[s.smoothing - 1];
  fx.minCutoff = fy.minCutoff = c;
}

function changeSetting(key, value) {
  S.settings[key] = value;
  saveSettings(S.settings);
  applySettings();
  updateSettingsView();
}

/* ───────────── Ações (clique do mouse OU clique por olhar) ───────────── */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, key, text, dir, tab } = btn.dataset;
  switch (action) {
    case 'tab': showTab(tab); break;
    case 'phrase': S.message = text; renderMessage(); speak(text); break;
    case 'key': S.message += key.toLowerCase(); renderMessage(); break;
    case 'backspace': S.message = S.message.slice(0, -1); renderMessage(); break;
    case 'clear': S.message = ''; renderMessage(); break;
    case 'speak': speak(S.message); break;
    case 'step': {
      const d = SETTINGS_UI.find((x) => x.key === key);
      const next = Math.round((S.settings[key] + d.step * Number(dir)) * 100) / 100;
      changeSetting(key, clamp(next, d.min, d.max));
      break;
    }
    case 'toggle': changeSetting(key, !S.settings[key]); break;
    case 'pause': setState('paused'); break;
    case 'resume': setState('running'); break;
    case 'recalibrate': goFullscreen(); runCalibration(); break;
    case 'calib-accept': calibSize = { w: innerWidth, h: innerHeight }; setState('running'); break;
    case 'calib-retry': runCalibration(); break;
  }
});

$('#btn-start').addEventListener('click', start);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && S.name === 'calibrating') abort?.abort();
});
window.addEventListener('beforeunload', () => tracker.stop());

let toastTimer = null;
function notify(msg, ms = 6000) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), ms);
}
let calibSize = null;
window.addEventListener('resize', () => {
  if (!S.model || !['running', 'paused'].includes(S.name)) return;
  calibSize ??= { w: innerWidth, h: innerHeight };
  if (Math.abs(innerWidth - calibSize.w) / calibSize.w > 0.05 || Math.abs(innerHeight - calibSize.h) / calibSize.h > 0.05) {
    notify('O tamanho da janela mudou. Use "Recalibrar" para manter a precisão.');
  }
});

/* ───────────── Inicialização ───────────── */
renderPhrases();
renderKeyboard();
renderSettings();
renderMessage();
showTab('phrases');
applySettings();
setState('welcome');
