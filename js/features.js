// Converte os landmarks do MediaPipe Face Landmarker em características do olhar.
// Índices do Face Mesh com íris (478 pontos).

// a = canto esquerdo do olho NA IMAGEM, b = canto direito NA IMAGEM.
const EYES = {
  right: { a: 33, b: 133, iris: 468 }, // olho direito da pessoa (lado esquerdo da imagem)
  left: { a: 362, b: 263, iris: 473 }, // olho esquerdo da pessoa (lado direito da imagem)
};
const NOSE_TIP = 1;
export const MIN_LANDMARKS = 478;

/**
 * Posição da íris relativa ao centro do olho, alinhada com o eixo entre os cantos
 * (invariante a rotação da cabeça no plano) e normalizada pela largura do olho.
 * @returns {[number, number] | null} [horizontal, vertical]; + = direita / baixo na imagem
 */
export function eyeOffsets(lm, w, h, eye) {
  const a = lm[eye.a], b = lm[eye.b], c = lm[eye.iris];
  if (!a || !b || !c) return null;
  const ax = a.x * w, ay = a.y * h;
  const bx = b.x * w, by = b.y * h;
  const cx = c.x * w, cy = c.y * h;
  const dx = bx - ax, dy = by - ay;
  const width = Math.hypot(dx, dy);
  if (width < 1e-6) return null;
  const ux = dx / width, uy = dy / width; // eixo do olho
  const nx = -uy, ny = ux;                // perpendicular (aponta para baixo)
  const rx = cx - (ax + bx) / 2, ry = cy - (ay + by) / 2;
  return [(rx * ux + ry * uy) / width, (rx * nx + ry * ny) / width];
}

/** Guinada (yaw) e inclinação (pitch) da cabeça a partir da matriz 4x4 (column-major). */
export function headAngles(m) {
  if (!m || m.length < 16) return [0, 0];
  const r = (row, col) => m[col * 4 + row];
  const yaw = Math.atan2(-r(2, 0), Math.hypot(r(0, 0), r(1, 0)));
  const pitch = Math.atan2(r(2, 1), r(2, 2));
  return [yaw, pitch];
}

/**
 * Vetor base: [hD, vD, hE, vE, narizX, narizY, yaw, pitch]
 * (D/E = olho direito/esquerdo da pessoa)
 */
export function extractFeatures(lm, matrixData, w, h) {
  if (!lm || lm.length < MIN_LANDMARKS) return null;
  const r = eyeOffsets(lm, w, h, EYES.right);
  const l = eyeOffsets(lm, w, h, EYES.left);
  if (!r || !l) return null;
  const nose = lm[NOSE_TIP];
  const [yaw, pitch] = headAngles(matrixData);
  return [r[0], r[1], l[0], l[1], nose.x, nose.y, yaw, pitch];
}

/** Acrescenta termos quadráticos da média dos dois olhos (captura a não linearidade). */
export function expandFeatures(f) {
  const h = (f[0] + f[2]) / 2;
  const v = (f[1] + f[3]) / 2;
  return [...f, h * h, v * v, h * v];
}

/** Média dos blendshapes eyeBlinkLeft/Right (0 = aberto, 1 = fechado). */
export function blinkScore(categories) {
  if (!categories) return 0;
  let sum = 0, n = 0;
  for (const c of categories) {
    if (c.categoryName === 'eyeBlinkLeft' || c.categoryName === 'eyeBlinkRight') {
      sum += c.score;
      n++;
    }
  }
  return n ? sum / n : 0;
}
