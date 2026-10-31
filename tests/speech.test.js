import test from 'node:test';
import assert from 'node:assert/strict';
import { SpeechPlayer, splitText } from '../assets/tts.js';
import { createStore } from '../assets/storage.js';
test('Sentence chunks retain decimal values and bound normal utterances', () => {
  const text = 'Binance meldet 6,34 Milliarden. ' + 'Ein ausführlicher Satz mit vielen Worten. '.repeat(50);
  const chunks = splitText(text); assert.ok(chunks.length > 5); assert.ok(chunks.every(c => c.length <= 261)); assert.ok(chunks.some(c => c.includes('6,34')));
});
function setup(supported = true) {
  const nodes = new Map();
  function node() { return { hidden: true, value: '', checked: false, classList: { add() {}, remove() {} }, addEventListener() {}, setAttribute() {}, replaceChildren() {}, add() {}, querySelectorAll: () => [] }; }
  globalThis.document = { getElementById(id) { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); }, body: node() };
  globalThis.Option = class { constructor(text, value) { this.text = text; this.value = value; } };
  const synth = { cancel() {}, getVoices: () => [], addEventListener() {}, speak(u) { this.utterance = u; }, speaking: true, pending: false };
  globalThis.window = { speechSynthesis: supported ? synth : undefined, SpeechSynthesisUtterance: supported ? class {} : undefined, addEventListener() {} };
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  globalThis.matchMedia = () => ({ matches: true });
  const store = createStore(undefined), messages = [], player = new SpeechPlayer(store, m => messages.push(m));
  store.updateSettings({ autoScroll: false });
  const el = { classList: { add() {} } };
  player.id = '2026-10-31-abend'; player.signature = 'abc123';
  player.queue = [0, 0, 1, 1, 2].map((section, i) => ({ text: 'Satz ' + i, section, sectionName: 'Thema ' + section, el }));
  return { player, store, synth, messages };
}
test('Section navigation, pause/resume and stale speech callbacks', () => {
  const { player, store, synth } = setup(); player.jump(1); assert.equal(player.pos, 2);
  player.start(); const old = synth.utterance; player.pause(); old.onend(); assert.equal(player.pos, 2);
  player.start(); synth.utterance.onend(); assert.equal(player.pos, 3);
  player.pause(); assert.equal(store.article(player.id).listen.index, 3);
  player.jump(-1); assert.equal(player.pos, 0); player.stop(); assert.equal(player.pos, 0);
});
test('Unsupported speech degrades to readable status without crashing', () => {
  const { player, messages } = setup(false); player.start(); player.stop(); assert.equal(messages.length, 1); assert.match(player.status.textContent, /keine Sprachausgabe/);
});

test('Article playback omits chapter numbers only in H2/H3 headings', () => {
  const { player, synth } = setup();
  function block(tagName, textContent) {
    return {
      tagName, textContent, classList: { add() {} },
      parentElement: { closest: () => null, classList: { contains: () => false } },
      cloneNode: () => ({ textContent, querySelectorAll: () => [] })
    };
  }
  const title = block('H1', '2. Ausgabe des Tages');
  const chapter = block('H2', '  2. Iran: Der Plan auf dem Tisch');
  const subsection = block('H3', '3) Zinsen und Inflation');
  const amountHeading = block('H2', '3.000 Arbeitsplätze in Gefahr');
  const percentageHeading = block('H3', '2,5 % Inflation');
  const paragraph = block('P', '2. November: Der Kurs liegt bei 6,34 Euro und steigt um 2,5 %.');
  const root = { querySelectorAll(selector) {
    if (selector === '[data-tts]') return [title];
    if (selector.startsWith('#prose ')) return [chapter, subsection, amountHeading, percentageHeading, paragraph];
    return [];
  } };
  player.attach(root, { id: '2026-10-31-abend' });
  const spoken = el => player.queue.filter(item => item.el === el).map(item => item.text).join(' ').replace(/\s+/g, ' ').trim();
  assert.equal(spoken(chapter), 'Iran: Der Plan auf dem Tisch');
  assert.equal(spoken(subsection), 'Zinsen und Inflation');
  for (const el of [title, amountHeading, percentageHeading, paragraph]) assert.equal(spoken(el), el.textContent);
  assert.equal(chapter.textContent, '  2. Iran: Der Plan auf dem Tisch');
  player.pos = player.queue.findIndex(item => item.el === chapter);
  player.start(); assert.equal(synth.utterance.text, 'Iran: Der Plan auf dem Tisch');
  player.pause();
});
