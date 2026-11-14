const KEY = 'myeyes.settings.v1';

export const DEFAULTS = {
  dwellMs: 1200,
  smoothing: 3,
  cursorScale: 1.5,
  snapPx: 40,
  blinkClick: false,
  showCamera: true,
  sound: true,
  autoAdjust: true,
};

export function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* armazenamento indisponível: segue sem persistir */
  }
}
