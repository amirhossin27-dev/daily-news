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
