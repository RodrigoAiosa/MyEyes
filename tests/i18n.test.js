import test from 'node:test';
import assert from 'node:assert/strict';
import { dictionaries, phrasesFor, setLang, t, getLang, keyRows } from '../js/i18n.js';
import { readFileSync } from 'node:fs';

const keys = (l) => Object.keys(dictionaries[l]).sort();
const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

test('pt e en têm exatamente as mesmas chaves', () => {
  assert.deepEqual(keys('en'), keys('pt'));
});

test('nenhuma tradução vazia e os {parâmetros} coincidem', () => {
  for (const k of keys('pt')) {
    assert.ok(dictionaries.pt[k].trim() && dictionaries.en[k].trim(), `vazia: ${k}`);
    assert.equal(vars(dictionaries.en[k]), vars(dictionaries.pt[k]), `parâmetros diferentes em ${k}`);
  }
});

test('frases: mesma quantidade e mesmos ícones nos dois idiomas', () => {
  assert.equal(phrasesFor('en').length, phrasesFor('pt').length);
  assert.deepEqual(phrasesFor('en').map((p) => p[0]), phrasesFor('pt').map((p) => p[0]));
  for (const l of ['pt', 'en']) assert.ok(phrasesFor(l).every(([, s]) => s.trim()));
});

test('teclado: 3 fileiras de 10 teclas em cada idioma', () => {
  for (const l of ['pt', 'en']) {
    setLang(l);
    assert.deepEqual(keyRows().map((r) => r.length), [10, 10, 10]);
  }
  setLang('pt');
  assert.ok(keyRows()[1].includes('Ç'));
});

test('t() interpola, troca de idioma e cai para a chave desconhecida', () => {
  setLang('pt');
  assert.match(t('calib.point', { n: 3, total: 13 }), /Ponto 3 de 13/);
  setLang('en');
  assert.match(t('calib.point', { n: 3, total: 13 }), /Point 3 of 13/);
  assert.equal(getLang(), 'en');
  assert.equal(t('chave.inexistente'), 'chave.inexistente');
  setLang('pt');
});

test('todo data-i18n* do index.html existe no dicionário', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const used = [...html.matchAll(/data-i18n(?:-html|-ph)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(used.length > 20);
  for (const k of used) assert.ok(k in dictionaries.pt, `chave ausente: ${k}`);
});

test('main/tracker/calibration só usam chaves que existem', () => {
  for (const f of ['main.js', 'tracker.js', 'calibration.js']) {
    const src = readFileSync(new URL(`../js/${f}`, import.meta.url), 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'([^']+)'/g)) assert.ok(m[1] in dictionaries.pt, `${f}: ${m[1]}`);
    for (const m of src.matchAll(/label: '([a-z]+\.[a-z]+)'/g)) assert.ok(m[1] in dictionaries.pt, `${f}: ${m[1]}`);
  }
  // chaves montadas dinamicamente
  for (const q of ['boa', 'media', 'baixa']) assert.ok(`quality.${q}` in dictionaries.pt);
});
