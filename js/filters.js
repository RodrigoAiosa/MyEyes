// One Euro Filter — suaviza o jitter do olhar sem criar atraso quando o olhar se move rápido.
// Referência: Casiez et al., "1€ Filter" (CHI 2012).

const TWO_PI = 2 * Math.PI;
const alpha = (cutoff, dt) => 1 / (1 + 1 / (TWO_PI * cutoff) / dt);

export class OneEuroFilter {
  constructor({ minCutoff = 1.0, beta = 0.01, dCutoff = 1.0 } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.reset();
  }

  reset() {
    this.x = null;
    this.dx = 0;
    this.t = null;
  }

  /** @param {number} value  @param {number} t tempo em segundos */
  filter(value, t) {
    if (this.t === null) {
      this.x = value;
      this.t = t;
      return value;
    }
    const dt = Math.max(t - this.t, 1e-3);
    const dxRaw = (value - this.x) / dt;
    const ad = alpha(this.dCutoff, dt);
    this.dx = ad * dxRaw + (1 - ad) * this.dx;
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    const a = alpha(cutoff, dt);
    this.x = a * value + (1 - a) * this.x;
    this.t = t;
    return this.x;
  }
}
