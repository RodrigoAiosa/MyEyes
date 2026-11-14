# 👁 MyEyes

Mova o cursor e clique **usando apenas o movimento dos olhos**, com a webcam comum do computador. Pensado para pessoas que só conseguem mover os olhos (ELA, lesão medular, paralisia cerebral, síndrome do encarceramento, entre outras condições).

- 100% no navegador — nada para instalar.
- **Privacidade:** o vídeo é processado localmente (MediaPipe) e **nunca é enviado** a nenhum servidor.
- Sem backend, sem build: arquivos estáticos publicados direto na Vercel.

## Como funciona

1. **Câmera →** o [MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) encontra 478 pontos do rosto, incluindo as **íris**.
2. **Características do olhar →** posição da íris em relação aos cantos de cada olho (invariante à inclinação da cabeça) + posição e ângulos da cabeça (`js/features.js`).
3. **Calibração de 13 pontos →** o usuário só *olha* para cada círculo (~25 s). O app espera o olhar *fixar* de verdade antes de coletar (`js/fixation.js`), descarta quadros de sacada/piscada e aprende o mapa "olhar → posição na tela" com regressão Ridge. Ele **testa vários modelos** (com/sem ângulos da cabeça, 5 níveis de regularização) e fica com o de menor erro por validação cruzada "deixe um ponto de fora" (`js/regression.js`). A precisão estimada é mostrada ao final.
4. **Suavização →** mediana de 3 quadros (elimina saltos isolados) + filtro One Euro, que remove o tremor sem criar atraso em movimentos rápidos (`js/filters.js`).
5. **Autoajuste contínuo →** cada clique confirmado indica onde o usuário *estava* olhando; o app corrige aos poucos o desvio sistemático (cansaço, mudança de postura), com limites para um clique acidental não bagunçar o modelo. Pode ser desligado em Ajustes.
6. **Proteção contra a cabeça:** as características da cabeça são limitadas à faixa vista na calibração, e um aviso aparece se a cabeça se afastar muito da posição calibrada.
7. **Clique por permanência (dwell) →** fixar o olhar num botão por ~1,2 s clica. Há *imã* nos botões próximos, tolerância a pequenos desvios e travamento até o olhar sair (evita cliques repetidos) (`js/dwell.js`).
8. **Opcional: clique por piscada longa** (~0,6–1,8 s). Piscadas curtas naturais são ignoradas e o cursor fica congelado durante a piscada.

### O que já vem no app
- 💬 **Frases rápidas** com voz (síntese de fala em pt-BR) — "Sim", "Não", "Preciso de ajuda!"…
- ⌨ **Teclado** na tela com teclas grandes e botão de falar.
- ⚙ **Ajustes** operáveis só com o olhar (botões − / +, sem sliders): tempo de clique, suavização, tamanho do cursor, imã, piscada, câmera, som.
- ⏸ **Pausar** (só o botão "Continuar" fica ativo) e 🎯 **Recalibrar** a qualquer momento.

## Rodar localmente

```bash
npm run dev      # serve a pasta em http://localhost:3000 (a câmera funciona em localhost)
npm test         # testes unitários (regressão, filtro, características, dwell)
```

> A câmera só funciona em **HTTPS** ou **localhost**. A Vercel já serve em HTTPS.

## Publicar na Vercel

1. Em [vercel.com/new](https://vercel.com/new), importe o repositório `RodrigoAiosa/MyEyes`.
2. **Framework Preset:** `Other`. Deixe *Build Command* e *Output Directory* vazios (o `vercel.json` já cuida dos cabeçalhos).
3. *Deploy*. Cada `git push` na `main` publica automaticamente.

## Limitações (leia antes de prometer o que o app não entrega)

- **Só controla a página do próprio MyEyes.** Um site não pode mover o cursor do sistema operacional. Para controlar o computador inteiro seria preciso um aplicativo desktop (veja o roteiro abaixo).
- **Precisão de webcam é limitada:** em geral 100–200 px de erro. Por isso a interface usa **alvos grandes**. Qualquer coisa menor que ~150 px é difícil de acertar.
- **A cabeça precisa ficar razoavelmente parada** depois da calibração. Se o cursor ficar deslocado, recalibre. Mudar o tamanho da janela também pede recalibração.
- Luz de frente para o rosto, 50–70 cm da tela e câmera na altura dos olhos fazem muita diferença. Óculos com reflexo e franja sobre os olhos pioram o resultado.
- O primeiro passo ("Ativar câmera") exige um clique/toque/Enter (regra do navegador para liberar a câmera). Um acompanhante pode fazer esse passo.
- O modelo (~4 MB) e o runtime são baixados da internet na primeira vez (jsDelivr e Google Storage); depois ficam em cache do navegador.
- Este é um projeto de apoio e **não é um dispositivo médico**. Testar com usuários reais, com acompanhamento de terapeuta ocupacional/fonoaudiólogo, é essencial.

## Roteiro / ideias

- [ ] Extensão de navegador para clicar em **qualquer site** (reaproveita este núcleo).
- [ ] App desktop (Electron/Python) para controlar o cursor do sistema.
- [ ] Predição de palavras no teclado e frases personalizáveis pelo cuidador.
- [ ] Hospedar o modelo e o runtime no próprio projeto (funcionar offline / PWA).
- [ ] Mais idiomas.

## Estrutura

```
index.html        telas: boas-vindas, calibração, app
css/styles.css    tema escuro de alto contraste, alvos grandes
js/main.js        orquestra estados, interface e pipeline do olhar
js/tracker.js     câmera + MediaPipe Face Landmarker
js/features.js    landmarks → características do olhar / piscada
js/calibration.js calibração de 13 pontos com espera de fixação
js/fixation.js    detecção de fixação / descarte de sacadas
js/regression.js  Ridge, seleção de modelo por validação cruzada, autoajuste
js/filters.js     filtro One Euro
js/dwell.js       clique por permanência, imã, histerese
tests/            testes (node --test), incluindo simulação antigo × novo
vercel.json       cabeçalhos (Permissions-Policy: camera)
```

## Créditos

Rastreamento facial: [MediaPipe](https://github.com/google-ai-edge/mediapipe) (Apache-2.0). Filtro: *1€ Filter* (Casiez, Roussel, Vogel — CHI 2012).
