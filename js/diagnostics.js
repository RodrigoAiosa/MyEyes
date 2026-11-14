// Diagnóstico da calibração: compara o ponto REAL com onde o app acha que o usuário olhou.
// Tudo aqui é puro (sem DOM) para poder ser testado.

const round = (v) => Math.round(v);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

/** Pontos do diagnóstico a partir das previsões guardadas na calibração. mode: 'cv' | 'fit' */
export function toPoints(perPoint, mode = 'cv') {
  return perPoint.map((p, i) => {
    const pred = (mode === 'cv' && p.cv) || p.fit;
    return { i, fx: p.fx, fy: p.fy, px: pred[0], py: pred[1], jitterPx: p.jitterPx };
  });
}

/** Avalia pontos de TESTE (não usados no treino) com a função de predição atual. */
export function evaluateGroups(groups, predict, W, H) {
  return groups.map((g, i) => {
    const ps = g.samples.map((f) => predict(f));
    const mx = mean(ps.map((p) => p[0]));
    const my = mean(ps.map((p) => p[1]));
    const vx = mean(ps.map((p) => (p[0] - mx) ** 2));
    const vy = mean(ps.map((p) => (p[1] - my) ** 2));
    return { i, fx: g.fx, fy: g.fy, px: mx, py: my, jitterPx: Math.sqrt(vx * W * W + vy * H * H) };
  });
}

const isEdge = (r) => Math.abs(r.fx - 0.5) > 0.3 || Math.abs(r.fy - 0.5) > 0.3;

export function summarize(points, W, H) {
  const rows = points.map((p) => {
    const dx = (p.px - p.fx) * W, dy = (p.py - p.fy) * H;
    return { ...p, dx, dy, err: Math.hypot(dx, dy) };
  });
  if (!rows.length) return null;
  const errs = rows.map((r) => r.err).sort((a, b) => a - b);
  const edge = rows.filter(isEdge), center = rows.filter((r) => !isEdge(r));
  return {
    rows,
    mean: mean(errs),
    median: errs[errs.length >> 1],
    rmsX: Math.sqrt(mean(rows.map((r) => r.dx ** 2))),
    rmsY: Math.sqrt(mean(rows.map((r) => r.dy ** 2))),
    biasX: mean(rows.map((r) => r.dx)),
    biasY: mean(rows.map((r) => r.dy)),
    jitter: mean(rows.map((r) => r.jitterPx)),
    edge: edge.length ? mean(edge.map((r) => r.err)) : null,
    center: center.length ? mean(center.map((r) => r.err)) : null,
    worst: rows.reduce((a, b) => (b.err > a.err ? b : a)),
  };
}

/**
 * Regras que transformam as estatísticas em recomendações.
 * @returns {{key: string, vars: object}[]} chaves de tradução (diag.f.*)
 */
export function diagnose(s) {
  if (!s) return [];
  const f = [];
  if (s.mean < 120) f.push({ key: 'diag.f.good', vars: { mean: round(s.mean), size: Math.max(100, Math.ceil((2 * s.mean) / 10) * 10) } });

  const bias = Math.hypot(s.biasX, s.biasY);
  if (bias > 40 && bias > 0.45 * s.mean) f.push({ key: 'diag.f.bias', vars: { dx: s.biasX, dy: s.biasY } });

  if (s.rmsY > 80 && s.rmsY > 1.6 * s.rmsX) f.push({ key: 'diag.f.vertical', vars: { x: round(s.rmsX), y: round(s.rmsY) } });
  else if (s.rmsX > 80 && s.rmsX > 1.6 * s.rmsY) f.push({ key: 'diag.f.horizontal', vars: { x: round(s.rmsX), y: round(s.rmsY) } });

  if (s.edge != null && s.center != null && s.edge > 120 && s.edge > 1.6 * s.center) {
    f.push({ key: 'diag.f.edges', vars: { edge: round(s.edge), center: round(s.center) } });
  }
  if (s.jitter > 45) f.push({ key: 'diag.f.jitter', vars: { j: round(s.jitter) } });
  if (s.worst.err > 150 && s.worst.err > 2 * s.median) f.push({ key: 'diag.f.worst', vars: { n: s.worst.i + 1, err: round(s.worst.err) } });
  return f;
}
