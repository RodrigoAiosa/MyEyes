// Clique por permanência (dwell): olhar para um alvo por X ms aciona o clique.
// Inclui "imã" (snap) para alvos próximos e histerese para evitar tremor entre alvos.

const GRACE_MS = 250;        // tolerância ao sair do alvo antes de zerar o progresso
const HOLD_START_MS = 350;   // elementos [data-hold] começam a repetir depois disso
const HOLD_REPEAT_MS = 130;

function domTargets(scope) {
  const root = scope || document;
  const out = [];
  for (const el of root.querySelectorAll('[data-gaze]')) {
    if (el.disabled || el.closest('[hidden]') || el.getClientRects().length === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) out.push({ el, rect: r });
  }
  return out;
}

const inside = (r, x, y, m = 0) =>
  x >= r.left - m && x <= r.right + m && y >= r.top - m && y <= r.bottom + m;

const distToRect = (r, x, y) =>
  Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));

export class DwellController {
  constructor(opts = {}) {
    this.dwellMs = opts.dwellMs ?? 1200;
    this.snapPx = opts.snapPx ?? 40;
    this.hysteresisPx = opts.hysteresisPx ?? 24;
    this.onFire = opts.onFire ?? (() => {});
    this.getTargets = opts.getTargets ?? (() => domTargets(this.scope));
    this.scope = null;
    this.enabled = true;
    this.current = null;
    this.locked = null;
    this._ms = 0;
    this._lost = 0;
    this._holdAcc = 0;
    this._lastT = null;
  }

  get progress() {
    return this.current && this.current !== this.locked ? Math.min(this._ms / this.dwellMs, 1) : 0;
  }

  getState() {
    return { el: this.current, progress: this.progress, locked: !!this.locked && this.locked === this.current };
  }

  setScope(el) {
    this.scope = el;
    this.reset();
  }

  setEnabled(v) {
    this.enabled = v;
    if (!v) this.reset();
  }

  reset() {
    this._leave();
    this.locked = null;
    this._lastT = null;
  }

  /** Mantém o relógio sem avançar o progresso (ex.: durante uma piscada). */
  hold(tMs) {
    this._lastT = tMs;
  }

  /** Aciona imediatamente o alvo atual (usado pelo clique por piscada longa). */
  clickNow() {
    if (!this.enabled || !this.current) return false;
    this._fire(this.current);
    return true;
  }

  update(x, y, tMs) {
    const dt = this._lastT == null ? 0 : Math.min(Math.max(tMs - this._lastT, 0), 100);
    this._lastT = tMs;
    if (!this.enabled) return this.getState();

    const entries = this.getTargets();
    const picked = this._pick(entries, x, y);

    if (picked !== this.current) {
      if (this.current && !picked) {
        this._lost += dt;
        if (this._lost >= GRACE_MS) this._leave();
        return this.getState();
      }
      this._leave();
      this._enter(picked);
    } else {
      this._lost = 0;
    }

    const el = this.current;
    if (!el || el === this.locked) return this.getState();

    if (el.dataset && el.dataset.hold !== undefined) {
      this._ms += dt;
      this._setProgress(el, Math.min(this._ms / HOLD_START_MS, 1));
      if (this._ms >= HOLD_START_MS) {
        this._holdAcc += dt;
        while (this._holdAcc >= HOLD_REPEAT_MS) {
          this._holdAcc -= HOLD_REPEAT_MS;
          el.click();
        }
      }
      return this.getState();
    }

    this._ms += dt;
    this._setProgress(el, Math.min(this._ms / this.dwellMs, 1));
    if (this._ms >= this.dwellMs) this._fire(el);
    return this.getState();
  }

  _pick(entries, x, y) {
    if (this.current) {
      const cur = entries.find((e) => e.el === this.current);
      if (cur && inside(cur.rect, x, y, this.hysteresisPx)) return this.current;
    }
    let best = null, bestArea = Infinity;
    for (const e of entries) {
      if (!inside(e.rect, x, y)) continue;
      const area = e.rect.width * e.rect.height;
      if (area < bestArea) { best = e.el; bestArea = area; }
    }
    if (best) return best;
    if (this.snapPx > 0) {
      let near = null, nd = this.snapPx;
      for (const e of entries) {
        const d = distToRect(e.rect, x, y);
        if (d <= nd) { near = e.el; nd = d; }
      }
      return near;
    }
    return null;
  }

  _enter(el) {
    this.current = el;
    this._ms = 0;
    this._lost = 0;
    this._holdAcc = 0;
    if (el) {
      el.classList.add('gaze-active');
      this._setProgress(el, 0);
    }
  }

  _leave() {
    const el = this.current;
    if (el) {
      el.classList.remove('gaze-active', 'gaze-locked');
      this._setProgress(el, 0);
      if (this.locked === el) this.locked = null;
    }
    this.current = null;
    this._ms = 0;
    this._lost = 0;
    this._holdAcc = 0;
  }

  _setProgress(el, p) {
    if (el.style) el.style.setProperty('--p', String(p));
  }

  _fire(el) {
    this.locked = el;
    this._ms = 0;
    this._setProgress(el, 0);
    el.classList.add('gaze-locked', 'gaze-fired');
    setTimeout(() => el.classList.remove('gaze-fired'), 350);
    el.click();
    this.onFire(el);
  }
}
