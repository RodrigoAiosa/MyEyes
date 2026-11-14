import { EyeTracker, describeError } from './tracker.js';
import { Calibration, TEST_POINTS } from './calibration.js';
import { fitFromGroups, qualityLabel } from './regression.js';
import { toPoints, evaluateGroups, summarize, diagnose } from './diagnostics.js';
import { renderDiagnostic } from './diag-ui.js';
import { DwellController } from './dwell.js';
import { OneEuroFilter } from './filters.js';
import { loadSettings, saveSettings } from './settings.js';
import { t, getLang, setLang, speechLang, applyI18n, phrases, keyRows } from './i18n.js';

const $ = (sel, root = document) => root.querySelector(sel);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ───────────── Conteúdo ───────────── */
const SETTINGS_UI = [
  { key: 'dwellMs', label: 'set.dwell', min: 600, max: 3000, step: 200, fmt: (v) => `${(v / 1000).toFixed(1)} s` },
  { key: 'smoothing', label: 'set.smoothing', min: 1, max: 5, step: 1, fmt: (v) => `${v}/5` },
  { key: 'cursorScale', label: 'set.cursor', min: 1, max: 3, step: 0.5, fmt: (v) => `${v}×` },
  { key: 'snapPx', label: 'set.snap', min: 0, max: 120, step: 20, fmt: (v) => (v ? `${v} px` : t('val.snapoff')) },
];
const TOGGLES_UI = [
  { key: 'blinkClick', label: 'set.blink' },
  { key: 'showCamera', label: 'set.camera' },
  { key: 'sound', label: 'set.sound' },
  { key: 'autoAdjust', label: 'set.auto' },
  { key: 'fullscreen', label: 'set.fullscreen' },
];
const CUTOFFS = [2.5, 1.6, 1.0, 0.6, 0.35]; // Hz mínimos do filtro, por nível de suavização
const BLINK_ON = 0.55, BLINK_OFF = 0.35;
const BLINK_MIN_MS = 550, BLINK_MAX_MS = 1800, BLINK_SETTLE_MS = 150;
const CIRC = 2 * Math.PI * 26;

/* ───────────── Estado ───────────── */
const els = {
  video: $('#cam'), cursor: $('#gaze-cursor'), ring: $('#cursor-progress'),
  welcome: $('#welcome'), loading: $('#loading'), calib: $('#calib'), app: $('#app'), paused: $('#paused'),
  diag: $('#diag'), calibResult: $('#calib-result'), message: $('#message'), faceStatus: $('#face-status'), faceWarning: $('#face-warning'),
};
const S = {
  name: 'welcome', model: null, settings: loadSettings(), message: '', tab: 'phrases',
  gaze: { x: innerWidth / 2, y: innerHeight / 2 },
  lastFaceMs: 0, blinking: false, blinkStart: null, blinkEndMs: 0, faceOk: null,
  prev: 'running', diagKind: 'calib', testGroups: null, testPoints: null,
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
  u.lang = speechLang();
  speechSynthesis.speak(u);
}

/**
 * Tela cheia "sempre": o navegador só aceita o pedido após um gesto REAL do usuário
 * (clique, toque ou tecla). Por isso pedimos no botão de início e em todo gesto real
 * enquanto a tela cheia não estiver ativa. (Instalado como app, abre em tela cheia direto.)
 */
function goFullscreen() {
  if (!S.settings.fullscreen || document.fullscreenElement) return;
  try {
    document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })?.catch(() => {});
  } catch { /* ignora */ }
}
for (const ev of ['pointerdown', 'touchstart', 'keydown']) {
  window.addEventListener(ev, (e) => { if (!(e.type === 'keydown' && e.key === 'Escape')) goFullscreen(); }, true);
}
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && S.settings.fullscreen && !['welcome', 'loading'].includes(S.name)) {
    notify(t('toast.fullscreen'), 8000);
  }
});

/* ───────────── Máquina de estados ───────────── */
function setState(name) {
  S.name = name;
  document.body.dataset.state = name;
  // o diagnóstico é uma camada sobre a tela de origem (resultado ou app)
  const base = name === 'diagnostic' ? S.prev : name;
  els.welcome.hidden = base !== 'welcome';
  els.loading.hidden = base !== 'loading';
  els.calib.hidden = !['calibrating', 'result'].includes(base);
  els.calibResult.hidden = base !== 'result';
  els.app.hidden = !['running', 'paused'].includes(base);
  els.paused.hidden = base !== 'paused';
  els.diag.hidden = name !== 'diagnostic';
  els.cursor.hidden = !['result', 'running', 'paused', 'diagnostic'].includes(name);

  const scopes = { result: els.calibResult, running: els.app, paused: els.paused, diagnostic: els.diag };
  dwell.setScope(scopes[name] ?? null);
  dwell.setEnabled(name in scopes);
  if (base === 'calibrating') {
    $('#calib-dot').hidden = false;
    els.calibResult.hidden = true;
  }
  if (base === 'result') $('#calib-dot').hidden = true;
  if (['result', 'diagnostic'].includes(name)) {
    $('#calib-label').textContent = '';
    $('#calib-hint').textContent = '';
  }
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
    res.size = { W: innerWidth, H: innerHeight };
    S.testGroups = null;
    S.testPoints = null;
    S.diagKind = 'calib';
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
      err.textContent = `${e.message} ${t('calib.err.retry')}`;
      err.hidden = false;
      tracker.stop();
    }
  }
}

let lastResult = null;
function showCalibrationResult(res) {
  lastResult = res;
  renderCalibrationResult();
  setState('result');
}

function renderCalibrationResult() {
  if (!lastResult) return;
  const { errPx, quality } = lastResult;
  $('#calib-quality').textContent = t('result.quality', { q: t(`quality.${quality.level}`), err: Math.round(errPx) });
  $('#calib-tip').textContent = t(quality.level === 'baixa' ? 'result.tip.low' : 'result.tip.ok');
}

/* ───────────── Diagnóstico ───────────── */
function renderDiag() {
  if (!lastResult) return;
  const { W, H } = lastResult.size;
  const kind = S.diagKind === 'test' && S.testPoints ? 'test' : 'calib';
  const points = kind === 'test' ? S.testPoints : toPoints(lastResult.perPoint, 'cv');
  const summary = summarize(points, W, H);
  renderDiagnostic({ summary, findings: diagnose(summary), kind, W, H, hasTest: !!S.testPoints });
}

function openDiagnostic() {
  if (!lastResult || !['running', 'result'].includes(S.name)) return;
  S.prev = S.name;
  setState('diagnostic');
  renderDiag();
}

/** Teste de precisão: 8 pontos NOVOS (fora do treino) medidos com o modelo atual. */
async function runAccuracyTest() {
  const back = S.prev;
  setState('calibrating');
  abort = new AbortController();
  try {
    await new Promise((r) => setTimeout(r, 400));
    const { W, H } = lastResult.size;
    S.testGroups = await calibration.collectGroups(abort.signal, TEST_POINTS, 'test.point');
    S.testPoints = evaluateGroups(S.testGroups, (f) => S.model.predict(f), W, H);
    S.diagKind = 'test';
  } catch (e) {
    if (e.name !== 'AbortError') {
      console.error(e);
      notify(`${e.message} ${t('calib.err.retry')}`, 8000);
    }
  }
  resetGaze();
  S.prev = back;
  setState('diagnostic');
  renderDiag();
}

/** Junta os pontos do teste à calibração e reajusta o modelo (a "segunda rodada"). */
function improveWithTest() {
  if (!S.testGroups || !lastResult) return;
  try {
    const { W, H } = lastResult.size;
    const groups = [...lastResult.groups, ...S.testGroups];
    const fit = fitFromGroups(groups, W, H);
    S.model = fit.model;
    S.headRef = fit.headRef;
    lastResult = { ...fit, groups, quality: qualityLabel(fit.errPx), size: { W, H } };
    S.testGroups = null;
    S.testPoints = null;
    S.diagKind = 'calib';
    resetGaze();
    renderCalibrationResult();
    renderDiag();
    notify(t('toast.improved'));
  } catch (e) {
    console.error(e);
  }
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
    refreshFaceStatus();
  }
  if (S.model && ['result', 'running', 'paused', 'diagnostic'].includes(S.name)) processGaze(fr);
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
    notify(t('toast.drift'));
  }
}

function renderCursor() {
  els.cursor.style.transform = `translate3d(${S.gaze.x}px, ${S.gaze.y}px, 0)`;
  const { progress, locked } = dwell.getState();
  els.ring.style.strokeDashoffset = String(CIRC * (1 - progress));
  els.ring.style.stroke = locked ? 'var(--warn)' : 'var(--accent)';
}

/* ───────────── Interface ───────────── */
function refreshFaceStatus() {
  if (S.faceOk === null) return;
  els.faceStatus.dataset.ok = String(S.faceOk);
  els.faceStatus.textContent = t(S.faceOk ? 'face.found' : 'face.lost');
}

function renderMessage() {
  const max = 38;
  els.message.textContent = S.message.length > max ? `…${S.message.slice(-max)}` : S.message;
}

function renderPhrases() {
  $('#tab-phrases').innerHTML = phrases()
    .map(
      ([ico, text]) =>
        `<button class="phrase" data-gaze data-action="phrase" data-text="${text}"><span class="ico">${ico}</span>${text}</button>`,
    )
    .join('');
}

function renderKeyboard() {
  const rows = keyRows().map(
    (row) => `<div class="kb-row">${row.map((k) => `<button data-gaze data-action="key" data-key="${k}">${k}</button>`).join('')}</div>`,
  );
  rows.push(
    `<div class="kb-row">
      <button class="w6" data-gaze data-action="key" data-key=" ">${t('key.space')}</button>
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
      <span class="name">${t(d.label)}</span>
      <button data-gaze data-action="step" data-key="${d.key}" data-dir="-1" ${v <= d.min ? 'disabled' : ''} aria-label="${t('aria.dec')}">−</button>
      <span class="val">${d.fmt(v)}</span>
      <button data-gaze data-action="step" data-key="${d.key}" data-dir="1" ${v >= d.max ? 'disabled' : ''} aria-label="${t('aria.inc')}">+</button>
    </div>`;
  });
  const toggles = TOGGLES_UI.map(
    (d) => `<div class="setting" data-skey="${d.key}">
      <span class="name">${t(d.label)}</span>
      <button class="toggle" data-gaze data-action="toggle" data-key="${d.key}" aria-pressed="${S.settings[d.key]}">${S.settings[d.key] ? t('val.on') : t('val.off')}</button>
    </div>`,
  );
  const language = `<div class="setting" data-skey="lang">
      <span class="name">${t('set.lang')}</span>
      <button class="toggle" data-gaze data-action="lang">${t('lang.name')}</button>
    </div>`;
  $('#tab-settings').innerHTML = [...steppers, ...toggles, language].join('');
}

function relabelSettings() {
  for (const d of [...SETTINGS_UI, ...TOGGLES_UI]) {
    $(`#tab-settings [data-skey="${d.key}"] .name`).textContent = t(d.label);
  }
  document.querySelectorAll('#tab-settings [data-dir="-1"]').forEach((b) => b.setAttribute('aria-label', t('aria.dec')));
  document.querySelectorAll('#tab-settings [data-dir="1"]').forEach((b) => b.setAttribute('aria-label', t('aria.inc')));
  $('#tab-settings [data-skey="lang"] .name').textContent = t('set.lang');
  $('#tab-settings [data-skey="lang"] .toggle').textContent = t('lang.name');
  updateSettingsView();
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
    b.textContent = S.settings[d.key] ? t('val.on') : t('val.off');
  }
}

function showTab(tab) {
  S.tab = tab;
  for (const id of ['phrases', 'keyboard', 'settings']) $(`#tab-${id}`).hidden = id !== tab;
  document.querySelectorAll('.tabs [role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
}

function changeLanguage() {
  setLang(getLang() === 'pt' ? 'en' : 'pt');
  refreshLanguage();
}

/** Reaplica todos os textos (estáticos e gerados) no idioma atual. */
function refreshLanguage() {
  applyI18n();
  renderPhrases();
  renderKeyboard();
  // Ajustes: atualiza no lugar (recriar trocaria o botão sob o olhar e o clique se repetiria)
  if ($('#tab-settings').children.length) relabelSettings(); else renderSettings();
  renderMessage();
  refreshFaceStatus();
  renderCalibrationResult();
  if (S.name === 'diagnostic') renderDiag();
  showTab(S.tab);
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
  if (key === 'fullscreen' && value) goFullscreen();
  applySettings();
  updateSettingsView();
}

/* ───────────── Ações (clique do mouse OU clique por olhar) ───────────── */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, key, text, dir, tab } = btn.dataset;
  switch (action) {
    case 'lang': changeLanguage(); break;
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
    case 'diag-open': openDiagnostic(); break;
    case 'diag-close': setState(S.prev); break;
    case 'diag-switch': S.diagKind = S.diagKind === 'test' ? 'calib' : 'test'; renderDiag(); break;
    case 'diag-test': runAccuracyTest(); break;
    case 'diag-improve': improveWithTest(); break;
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
    notify(t('toast.resize'));
  }
});

/* ───────────── Inicialização ───────────── */
refreshLanguage();
showTab('phrases');
applySettings();
setState('welcome');
