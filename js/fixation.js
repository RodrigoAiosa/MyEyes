// Detecta se o olhar está fixo: as características dos olhos quase não variam nos últimos quadros.
// Usado na calibração para esperar o olho REALMENTE chegar ao ponto (em vez de um atraso fixo).

/**
 * @param {number[][]} frames últimos vetores de características base (usa os 4 primeiros: íris)
 * @param {number} thr variação máxima (max−min) tolerada por componente
 */
export function isFixation(frames, thr = 0.02) {
  if (frames.length < 2) return false;
  for (let j = 0; j < 4; j++) {
    let lo = Infinity, hi = -Infinity;
    for (const f of frames) {
      if (f[j] < lo) lo = f[j];
      if (f[j] > hi) hi = f[j];
    }
    if (hi - lo > thr) return false;
  }
  return true;
}

/** Remove quadros que fogem da mediana do grupo (sacadas e piscadas que escaparam). */
export function dropSaccades(samples, thr = 0.03) {
  if (samples.length < 5) return samples;
  const med = [0, 1, 2, 3].map((j) => {
    const s = samples.map((f) => f[j]).sort((a, b) => a - b);
    return s[s.length >> 1];
  });
  return samples.filter((f) => [0, 1, 2, 3].every((j) => Math.abs(f[j] - med[j]) <= thr));
}
