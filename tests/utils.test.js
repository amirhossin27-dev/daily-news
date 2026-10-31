import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, archiveUrl, filterArticles, berlinParts, editionStatus, matches, readingProgress, esc, safeUrl, snippet } from '../assets/utils.js';

test('Existing article links, old search links and malformed routes', () => {
  assert.deepEqual(parseRoute('#/artikel/2026-10-31-abend'), { page: 'article', id: '2026-10-31-abend' });
  assert.equal(parseRoute('#/artikel/%E0%A4%A').page, 'missing');
  assert.equal(parseRoute('#/artikel/../../x').page, 'missing');
  const f = { q: 'Öl & Zinsen', label: 'Naher Osten', edition: 'morgen', from: '2026-10-01', to: '2026-10-31', saved: '1', unread: '1' };
  assert.deepEqual(parseRoute(archiveUrl(f)).filters, f);
  assert.equal(parseRoute('#/?q=Iran').filters.q, 'Iran');
});
test('Full-text search and exact, combined filters', () => {
  const articles = [
    { id: 'a', title: 'Öl', summary: 'Europa', labels: ['Energie'], date: '2026-10-31', edition: 'morgen' },
    { id: 'b', title: 'Bitcoin', summary: 'Märkte', labels: ['Krypto'], date: '2026-10-30', edition: 'abend' }
  ];
  const docs = [{ id: 'a', text: 'Die Risikoprämie beträgt 6,34 Prozent.' }];
  assert.deepEqual(filterArticles(articles, { q: 'Risikopramie 6,34', label: 'Energie', from: '2026-10-31', saved: '1' }, docs, { a: { bookmarked: true } }).map(a => a.id), ['a']);
  assert.equal(filterArticles(articles, { q: 'Risikoprämie', label: 'Krypto' }, docs).length, 0);
  assert.deepEqual(filterArticles(articles, { unread: '1' }, [], { a: { read: true } }).map(a => a.id), ['b']);
  assert.equal(filterArticles([], {}).length, 0);
  assert.ok(matches('Straße und Märkte', 'strasse markte'));
  assert.ok(snippet('Anfang '.repeat(50) + 'Risikoprämie Ende', 'Risikoprämie').includes('Risikoprämie'));
});
test('Berlin calendar boundaries and both daylight-saving transitions', () => {
  assert.deepEqual(berlinParts(new Date('2026-10-31T23:30:00Z')), { date: '2026-11-01', minutes: 30 });
  assert.equal(berlinParts(new Date('2026-03-29T01:30:00Z')).minutes, 210);
  assert.equal(berlinParts(new Date('2026-10-25T00:30:00Z')).minutes, 150);
  assert.equal(berlinParts(new Date('2026-10-25T01:30:00Z')).minutes, 150);
  assert.match(editionStatus('morgen', null, new Date('2026-10-31T07:01:00Z')), /nicht erschienen/);
});
test('Progress bounds, escaped content and safe source URLs', () => {
  assert.equal(readingProgress(100, 2000, 800), 0);
  assert.equal(readingProgress(-600, 2000, 800), .5);
  assert.equal(readingProgress(-3000, 2000, 800), 1);
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('https://secret@example.com/'), '');
  assert.equal(safeUrl('https://example.com/a'), 'https://example.com/a');
  assert.equal(esc('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
});
