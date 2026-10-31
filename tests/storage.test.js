import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, validateBackup } from '../assets/storage.js';
function memory() { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; }
const id = '2026-10-31-abend';
test('Marks, reading position and settings survive restart and export/import', () => {
  const storage = memory(), first = createStore(storage);
  first.updateArticle(id, { bookmarked: true, read: true, progress: .65, section: 3, listen: { index: 8, signature: 'abc123' } });
  first.updateSettings({ fontScale: 1.3, favorites: ['Iran', 'KI'] });
  const restarted = createStore(storage);
  assert.deepEqual(restarted.data, first.data);
  const backup = first.export(), other = createStore(memory()); other.import(JSON.parse(JSON.stringify(backup)));
  assert.deepEqual(other.data, first.data);
  backup.data.articles[id].progress = 0;
  assert.equal(first.article(id).progress, .65);
});
test('Read denial and quota errors retain working in-memory state', () => {
  const blocked = createStore({ getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); } });
  blocked.updateArticle(id, { bookmarked: true });
  assert.equal(blocked.persistent, false); assert.equal(blocked.article(id).bookmarked, true);
  assert.equal(createStore(undefined).persistent, false);
});
test('Invalid import is atomic and rejects unsafe keys, unsupported versions and rates', () => {
  const s = createStore(memory()); s.updateArticle(id, { bookmarked: true });
  const previous = structuredClone(s.data);
  for (const mutate of [b => b.version = 2, b => b.data.settings.tts.rate = 99, b => b.data.articles[id].progress = -1, b => b.data.settings.favorites = ['unknown'], b => Object.defineProperty(b.data.articles, '__proto__', { value: {}, enumerable: true })]) {
    const backup = s.export(); mutate(backup); assert.throws(() => s.import(backup)); assert.deepEqual(s.data, previous);
  }
  assert.throws(() => validateBackup(null));
});
test('Old theme and speech preferences migrate without breaking old installations', () => {
  const storage = memory(); storage.setItem('db-theme', 'dark'); storage.setItem('db-tts', JSON.stringify({ rate: 1.4, auto: true, voice: 'Deutsch' }));
  const s = createStore(storage); assert.equal(s.data.settings.theme, 'dark'); assert.equal(s.data.settings.tts.rate, 1.4);
});
