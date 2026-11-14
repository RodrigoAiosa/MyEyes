// Internacionalização mínima: português do Brasil (padrão) e inglês.
const KEY = 'myeyes.lang';

const DICT = {
  pt: {
    'app.title': 'MyEyes — controle o cursor com os olhos',
    'app.desc': 'Mova o cursor e clique usando apenas o movimento dos olhos, com a webcam comum. Gratuito, roda no navegador e o vídeo nunca sai do seu dispositivo.',
    'noscript': 'Este aplicativo precisa de JavaScript para funcionar.',
    'lang.switch': '🌐 English',
    'lang.name': 'Português',

    'welcome.lead': 'Mova o cursor e clique usando <strong>apenas o movimento dos olhos</strong>. Funciona no navegador, com a webcam comum — nada para instalar.',
    'welcome.step1': '<strong>Permita a câmera.</strong> O vídeo é processado no seu dispositivo e nunca é enviado a ninguém.',
    'welcome.step2': '<strong>Olhe para os 13 círculos</strong> que aparecem na tela. Não precisa clicar em nada.',
    'welcome.step3': '<strong>Fixe o olhar em um botão</strong> por cerca de 1 segundo para clicar.',
    'welcome.tip1': '💡 Luz de frente para o rosto (evite janela atrás de você).',
    'welcome.tip2': '📏 Fique a 50–70 cm da tela, com a câmera na altura dos olhos.',
    'welcome.tip3': '🪑 Apoie a cabeça confortavelmente e tente não mexê-la após calibrar.',
    'welcome.start': 'Ativar câmera e começar',
    'welcome.note': 'Só este primeiro botão precisa de clique (mouse, toque, Enter ou Espaço) — o navegador exige uma ação para liberar a câmera. Um acompanhante pode ajudar. Depois disso, tudo funciona só com o olhar.',

    'loading.default': 'Carregando…',
    'loading.camera': 'Pedindo acesso à câmera…',
    'loading.model': 'Carregando o modelo de rastreamento (só na primeira vez)…',

    'calib.esc': 'Esc para cancelar',
    'calib.point': 'Ponto {n} de {total} — olhe fixamente para o círculo',
    'calib.hint.noface': 'Não encontro seu rosto — fique de frente para a câmera.',
    'calib.hint.eyes': 'Mantenha os olhos abertos.',
    'calib.err.noface': 'Rosto não detectado durante a calibração.',
    'calib.err.retry': 'Confira a iluminação e a posição e tente de novo.',
    'result.title': 'Calibração concluída',
    'result.quality': 'Precisão estimada: {q} (erro ≈ {err} px)',
    'result.tip.low': 'A precisão ficou baixa. Melhore a luz no rosto, aproxime-se da câmera e refaça. Se continuar, use botões grandes e aumente o "Imã nos botões" em Ajustes.',
    'result.tip.ok': 'Quanto mais parada a cabeça, melhor. Se o cursor ficar deslocado, use "Recalibrar" a qualquer momento.',
    'result.continue': '✔ Continuar',
    'result.retry': '↻ Refazer',
    'quality.boa': 'Boa',
    'quality.media': 'Razoável',
    'quality.baixa': 'Baixa',

    'face.searching': 'Procurando rosto…',
    'face.found': 'Rosto detectado',
    'face.lost': 'Rosto não encontrado',
    'face.warning': 'Não encontro seu rosto. Fique de frente para a câmera.',

    'btn.pause': '⏸ Pausar',
    'btn.recalibrate': '🎯 Recalibrar',
    'btn.speak': '🔊 Falar',
    'btn.clear': '✕ Limpar',
    'btn.diag': '📊 Diagnóstico',
    'diag.title': 'Diagnóstico da calibração',
    'diag.kind.calib': 'Calibração (validação cruzada)',
    'diag.kind.test': 'Teste de precisão (pontos novos)',
    'diag.legend.target': 'Ponto real',
    'diag.legend.pred': 'Onde o app acha que você olhou',
    'diag.hint.calib': 'Cada ponto foi previsto por um modelo treinado SEM ele (validação cruzada). Por isso as bordas aparecem piores aqui do que no uso real.',
    'diag.hint.test': 'Pontos novos, que não foram usados na calibração: é a medida mais realista da precisão.',
    'diag.m.mean': 'Erro médio',
    'diag.m.x': 'Erro horizontal',
    'diag.m.y': 'Erro vertical',
    'diag.m.bias': 'Desvio sistemático',
    'diag.m.jitter': 'Tremor entre quadros',
    'diag.m.center': 'Centro da tela',
    'diag.m.edge': 'Bordas',
    'diag.m.worst': 'Pior ponto',
    'diag.btn.back': '← Voltar',
    'diag.btn.test': '🎯 Teste de precisão',
    'diag.btn.view.test': '↔ Ver teste',
    'diag.btn.view.calib': '↔ Ver calibração',
    'diag.btn.improve': '➕ Usar estes pontos para melhorar',
    'diag.findings': 'O que isso significa',
    'diag.f.good': 'Boa precisão ({mean} px). Use botões com pelo menos {size} px de largura.',
    'diag.f.bias': 'Desvio sistemático: o cursor cai, em média, {h} e {v} do ponto real. O autoajuste contínuo corrige isso aos poucos; se for grande, recalibre com a cabeça mais parada.',
    'diag.f.vertical': 'O erro vertical ({y} px) é bem maior que o horizontal ({x} px). É comum em webcam: a pálpebra cobre parte da íris. Ponha a câmera na altura dos olhos, abra bem os olhos e evite olhar a tela de muito baixo.',
    'diag.f.horizontal': 'O erro horizontal ({x} px) é bem maior que o vertical ({y} px). Centralize a webcam em relação à tela e evite girar a cabeça ao olhar para os lados.',
    'diag.f.edges': 'As bordas ({edge} px) são bem piores que o centro ({center} px). Aproxime-se da tela, centralize a webcam e use botões maiores nas bordas.',
    'diag.f.jitter': 'Muito tremor entre quadros ({j} px). Melhore a luz no rosto, limpe a lente e aumente a Suavização em Ajustes.',
    'diag.f.worst': 'O ponto {n} foi o pior ({err} px): provavelmente o olhar desviou ou houve piscada. Refaça a calibração se o erro geral estiver alto.',
    'dir.right': '{n} px à direita',
    'dir.left': '{n} px à esquerda',
    'dir.up': '{n} px acima',
    'dir.down': '{n} px abaixo',
    'test.point': 'Teste {n} de {total} — olhe fixamente para o círculo',
    'toast.improved': 'Calibração melhorada com os pontos do teste.',
    'btn.resume': '▶ Continuar',
    'tab.phrases': '💬 Frases',
    'tab.keyboard': '⌨ Teclado',
    'tab.settings': '⚙ Ajustes',
    'paused.title': '⏸ Pausado',
    'paused.text': 'O olhar não aciona nada enquanto estiver pausado.',
    'message.placeholder': 'Escolha uma frase ou escreva no teclado…',
    'key.space': 'ESPAÇO',

    'set.dwell': 'Tempo para clicar',
    'set.smoothing': 'Suavização do cursor',
    'set.cursor': 'Tamanho do cursor',
    'set.snap': 'Imã nos botões',
    'set.blink': 'Clicar com piscada longa',
    'set.camera': 'Mostrar câmera',
    'set.sound': 'Som ao clicar',
    'set.auto': 'Autoajuste contínuo',
    'set.fullscreen': 'Tela cheia sempre',
    'set.lang': 'Idioma / Language',
    'val.on': 'Ligado',
    'val.off': 'Desligado',
    'val.snapoff': 'off',
    'aria.dec': 'Diminuir',
    'aria.inc': 'Aumentar',

    'toast.resize': 'O tamanho da janela mudou. Use "Recalibrar" para manter a precisão.',
    'toast.fullscreen': 'A tela cheia foi desativada. Clique ou pressione uma tecla para voltar.',
    'toast.drift': 'Sua cabeça mudou de posição. Volte à posição da calibração ou use "Recalibrar".',

    'err.denied': 'O acesso à câmera foi negado. Libere a câmera nas permissões do navegador (ícone de cadeado ao lado do endereço) e tente de novo.',
    'err.notfound': 'Nenhuma câmera foi encontrada neste dispositivo.',
    'err.busy': 'A câmera está em uso por outro programa. Feche-o e tente novamente.',
    'err.generic': 'Não foi possível iniciar o rastreamento: {msg}. Verifique a conexão com a internet (o modelo é baixado na primeira vez).',
  },

  en: {
    'app.title': 'MyEyes — control the cursor with your eyes',
    'app.desc': 'Move the cursor and click using only eye movement, with an ordinary webcam. Free, runs in the browser, and your video never leaves your device.',
    'noscript': 'This app needs JavaScript to run.',
    'lang.switch': '🌐 Português',
    'lang.name': 'English',

    'welcome.lead': 'Move the cursor and click using <strong>only your eye movements</strong>. Works in the browser with an ordinary webcam — nothing to install.',
    'welcome.step1': '<strong>Allow the camera.</strong> Video is processed on your device and is never sent to anyone.',
    'welcome.step2': '<strong>Look at the 13 circles</strong> that appear on screen. No clicking needed.',
    'welcome.step3': '<strong>Hold your gaze on a button</strong> for about 1 second to click.',
    'welcome.tip1': '💡 Light facing your face (avoid a window behind you).',
    'welcome.tip2': '📏 Sit 50–70 cm (20–28 in) from the screen, with the camera at eye level.',
    'welcome.tip3': '🪑 Rest your head comfortably and try not to move it after calibrating.',
    'welcome.start': 'Enable camera and start',
    'welcome.note': 'Only this first button needs a click (mouse, touch, Enter or Space) — the browser requires an action to unlock the camera. A companion can help. After that, everything works with your eyes alone.',

    'loading.default': 'Loading…',
    'loading.camera': 'Requesting camera access…',
    'loading.model': 'Loading the tracking model (first time only)…',

    'calib.esc': 'Esc to cancel',
    'calib.point': 'Point {n} of {total} — look steadily at the circle',
    'calib.hint.noface': "I can't find your face — face the camera.",
    'calib.hint.eyes': 'Keep your eyes open.',
    'calib.err.noface': 'Face not detected during calibration.',
    'calib.err.retry': 'Check the lighting and your position, then try again.',
    'result.title': 'Calibration complete',
    'result.quality': 'Estimated accuracy: {q} (error ≈ {err} px)',
    'result.tip.low': 'Accuracy is low. Improve the light on your face, move closer to the camera and redo it. If it stays low, use big buttons and increase "Button magnet" in Settings.',
    'result.tip.ok': 'The stiller your head, the better. If the cursor drifts, use "Recalibrate" at any time.',
    'result.continue': '✔ Continue',
    'result.retry': '↻ Redo',
    'quality.boa': 'Good',
    'quality.media': 'Fair',
    'quality.baixa': 'Low',

    'face.searching': 'Looking for face…',
    'face.found': 'Face detected',
    'face.lost': 'Face not found',
    'face.warning': "I can't find your face. Face the camera.",

    'btn.pause': '⏸ Pause',
    'btn.recalibrate': '🎯 Recalibrate',
    'btn.speak': '🔊 Speak',
    'btn.clear': '✕ Clear',
    'btn.diag': '📊 Diagnostics',
    'diag.title': 'Calibration diagnostics',
    'diag.kind.calib': 'Calibration (cross-validation)',
    'diag.kind.test': 'Accuracy test (new points)',
    'diag.legend.target': 'Real point',
    'diag.legend.pred': 'Where the app thinks you looked',
    'diag.hint.calib': 'Each point was predicted by a model trained WITHOUT it (cross-validation). That is why edges look worse here than in real use.',
    'diag.hint.test': 'New points that were not used for calibration: the most realistic measure of accuracy.',
    'diag.m.mean': 'Mean error',
    'diag.m.x': 'Horizontal error',
    'diag.m.y': 'Vertical error',
    'diag.m.bias': 'Systematic offset',
    'diag.m.jitter': 'Frame-to-frame jitter',
    'diag.m.center': 'Screen center',
    'diag.m.edge': 'Edges',
    'diag.m.worst': 'Worst point',
    'diag.btn.back': '← Back',
    'diag.btn.test': '🎯 Accuracy test',
    'diag.btn.view.test': '↔ View test',
    'diag.btn.view.calib': '↔ View calibration',
    'diag.btn.improve': '➕ Use these points to improve',
    'diag.findings': 'What this means',
    'diag.f.good': 'Good accuracy ({mean} px). Use buttons at least {size} px wide.',
    'diag.f.bias': 'Systematic offset: the cursor lands, on average, {h} and {v} of the real point. Continuous auto-adjust corrects this gradually; if it is large, recalibrate with your head stiller.',
    'diag.f.vertical': 'Vertical error ({y} px) is much larger than horizontal ({x} px). This is common with webcams: the eyelid covers part of the iris. Put the camera at eye level, open your eyes wide and avoid looking at the screen from far below.',
    'diag.f.horizontal': 'Horizontal error ({x} px) is much larger than vertical ({y} px). Center the webcam on the screen and avoid turning your head when looking sideways.',
    'diag.f.edges': 'Edges ({edge} px) are much worse than the center ({center} px). Sit closer to the screen, center the webcam and use larger buttons near the edges.',
    'diag.f.jitter': 'A lot of frame-to-frame jitter ({j} px). Improve the light on your face, clean the lens and increase Smoothing in Settings.',
    'diag.f.worst': 'Point {n} was the worst ({err} px): your gaze probably drifted or you blinked. Redo the calibration if overall error is high.',
    'dir.right': '{n} px to the right',
    'dir.left': '{n} px to the left',
    'dir.up': '{n} px above',
    'dir.down': '{n} px below',
    'test.point': 'Test {n} of {total} — look steadily at the circle',
    'toast.improved': 'Calibration improved with the test points.',
    'btn.resume': '▶ Resume',
    'tab.phrases': '💬 Phrases',
    'tab.keyboard': '⌨ Keyboard',
    'tab.settings': '⚙ Settings',
    'paused.title': '⏸ Paused',
    'paused.text': 'Your gaze triggers nothing while paused.',
    'message.placeholder': 'Pick a phrase or type on the keyboard…',
    'key.space': 'SPACE',

    'set.dwell': 'Time to click',
    'set.smoothing': 'Cursor smoothing',
    'set.cursor': 'Cursor size',
    'set.snap': 'Button magnet',
    'set.blink': 'Click with a long blink',
    'set.camera': 'Show camera',
    'set.sound': 'Click sound',
    'set.auto': 'Continuous auto-adjust',
    'set.fullscreen': 'Always fullscreen',
    'set.lang': 'Idioma / Language',
    'val.on': 'On',
    'val.off': 'Off',
    'val.snapoff': 'off',
    'aria.dec': 'Decrease',
    'aria.inc': 'Increase',

    'toast.resize': 'The window size changed. Use "Recalibrate" to keep accuracy.',
    'toast.fullscreen': 'Fullscreen was turned off. Click or press a key to go back.',
    'toast.drift': 'Your head moved. Return to the calibration position or use "Recalibrate".',

    'err.denied': 'Camera access was denied. Allow the camera in your browser permissions (padlock icon next to the address) and try again.',
    'err.notfound': 'No camera was found on this device.',
    'err.busy': 'The camera is being used by another program. Close it and try again.',
    'err.generic': 'Could not start tracking: {msg}. Check your internet connection (the model is downloaded the first time).',
  },
};

const PHRASES = {
  pt: [
    ['✅', 'Sim'], ['❌', 'Não'], ['🙏', 'Obrigado'], ['🤝', 'Por favor'],
    ['💧', 'Quero água'], ['🍽', 'Estou com fome'], ['🚻', 'Preciso ir ao banheiro'], ['🤕', 'Estou com dor'],
    ['🥶', 'Estou com frio'], ['🥵', 'Estou com calor'], ['🛏', 'Quero mudar de posição'], ['🚨', 'Preciso de ajuda!'],
  ],
  en: [
    ['✅', 'Yes'], ['❌', 'No'], ['🙏', 'Thank you'], ['🤝', 'Please'],
    ['💧', 'I want water'], ['🍽', "I'm hungry"], ['🚻', 'I need the bathroom'], ['🤕', "I'm in pain"],
    ['🥶', "I'm cold"], ['🥵', "I'm hot"], ['🛏', 'I would like to change position'], ['🚨', 'I need help!'],
  ],
};

const KEY_ROWS = {
  pt: ['QWERTYUIOP', 'ASDFGHJKLÇ', 'ZXCVBNM,.?'],
  en: ['QWERTYUIOP', "ASDFGHJKL'", 'ZXCVBNM,.?'],
};

function detect() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'pt' || saved === 'en') return saved;
  } catch { /* sem armazenamento */ }
  const nav = String(globalThis.navigator?.language || 'pt-BR').toLowerCase();
  return nav.startsWith('pt') ? 'pt' : 'en';
}

let lang = detect();

export const LANG_CODES = Object.keys(DICT);
export const dictionaries = DICT;
export const getLang = () => lang;
export const speechLang = () => (lang === 'pt' ? 'pt-BR' : 'en-US');
export const phrases = () => PHRASES[lang];
export const phrasesFor = (l) => PHRASES[l];
export const keyRows = () => KEY_ROWS[lang].map((r) => [...r]);

export function setLang(l) {
  lang = l === 'en' ? 'en' : 'pt';
  try { localStorage.setItem(KEY, lang); } catch { /* ignora */ }
}

export function t(key, vars) {
  let s = DICT[lang][key] ?? DICT.pt[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** Aplica as traduções aos elementos marcados no HTML. */
export function applyI18n(root = document) {
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
  document.title = t('app.title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('app.desc'));
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll('[data-i18n-ph]')) el.dataset.placeholder = t(el.dataset.i18nPh);
}
