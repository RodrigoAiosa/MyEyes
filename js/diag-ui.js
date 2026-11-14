// Desenha o diagnóstico: mapa (ponto real × previsão), métricas e recomendações.
import { t } from './i18n.js';

const MAP_W = 720;
const color = (err) => (err < 100 ? '#5eead4' : err < 200 ? '#fbbf24' : '#f87171');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function buildMapSvg(rows, W, H) {
  const k = MAP_W / W, mh = Math.round(H * k);
  const parts = [`<svg viewBox="0 0 ${MAP_W} ${mh}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`];
  parts.push(`<rect x="1" y="1" width="${MAP_W - 2}" height="${mh - 2}" fill="none" stroke="#2b3556" stroke-width="2"/>`);
  parts.push(`<g stroke="#1b2442" stroke-width="1"><line x1="${MAP_W / 2}" y1="0" x2="${MAP_W / 2}" y2="${mh}"/><line x1="0" y1="${mh / 2}" x2="${MAP_W}" y2="${mh / 2}"/></g>`);
  for (const r of rows) {
    const tx = r.fx * MAP_W, ty = r.fy * mh;
    const px = Math.min(MAP_W, Math.max(0, r.px * MAP_W)), py = Math.min(mh, Math.max(0, r.py * mh));
    const c = color(r.err);
    parts.push(`<line x1="${tx.toFixed(1)}" y1="${ty.toFixed(1)}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="${c}" stroke-width="3"/>`);
    parts.push(`<circle cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="13" fill="none" stroke="#f5f7ff" stroke-width="3"/>`);
    parts.push(`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="6" fill="${c}"/>`);
    const lx = Math.min(MAP_W - 44, Math.max(4, tx + 16)), ly = Math.min(mh - 6, Math.max(16, ty - 14));
    parts.push(`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" fill="#c9d0ea" font-size="15" font-family="system-ui,sans-serif">${r.i + 1}·${Math.round(r.err)}</text>`);
  }
  parts.push('</svg>');
  return parts.join('');
}

function dirText(dx, dy) {
  const h = t(dx >= 0 ? 'dir.right' : 'dir.left', { n: Math.round(Math.abs(dx)) });
  const v = t(dy >= 0 ? 'dir.down' : 'dir.up', { n: Math.round(Math.abs(dy)) });
  return { h, v };
}

export function renderDiagnostic({ summary, findings, kind, W, H, hasTest }) {
  const $ = (id) => document.getElementById(id);
  const kindEl = $('diag-kind');
  kindEl.textContent = t(`diag.kind.${kind}`);
  kindEl.dataset.ok = kind === 'test' ? 'true' : 'warn';
  $('diag-hint').textContent = t(`diag.hint.${kind}`);
  const map = $('diag-map');
  map.setAttribute('aria-label', t('diag.title'));

  const sw = $('diag-switch');
  sw.hidden = !hasTest;
  sw.textContent = t(kind === 'test' ? 'diag.btn.view.calib' : 'diag.btn.view.test');
  $('diag-improve').hidden = kind !== 'test';

  if (!summary) {
    map.innerHTML = '';
    $('diag-metrics').innerHTML = '';
    $('diag-findings').innerHTML = '';
    return;
  }
  map.innerHTML = buildMapSvg(summary.rows, W, H);
  const bias = dirText(summary.biasX, summary.biasY);
  const rowsHtml = [
    ['diag.m.mean', `${Math.round(summary.mean)} px`],
    ['diag.m.x', `${Math.round(summary.rmsX)} px`],
    ['diag.m.y', `${Math.round(summary.rmsY)} px`],
    ['diag.m.bias', `${bias.h}, ${bias.v}`],
    ['diag.m.jitter', `${Math.round(summary.jitter)} px`],
  ];
  if (summary.center != null) rowsHtml.push(['diag.m.center', `${Math.round(summary.center)} px`]);
  if (summary.edge != null) rowsHtml.push(['diag.m.edge', `${Math.round(summary.edge)} px`]);
  rowsHtml.push(['diag.m.worst', `#${summary.worst.i + 1} · ${Math.round(summary.worst.err)} px`]);
  $('diag-metrics').innerHTML = rowsHtml.map(([k, v]) => `<dt>${esc(t(k))}</dt><dd>${esc(v)}</dd>`).join('');

  $('diag-findings').innerHTML = findings
    .map((f) => {
      const vars = { ...f.vars };
      if (f.key === 'diag.f.bias') Object.assign(vars, dirText(f.vars.dx, f.vars.dy));
      return `<li>${esc(t(f.key, vars))}</li>`;
    })
    .join('');
}
