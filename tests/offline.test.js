import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function worker() {
  const source = await fs.readFile(new URL('../sw.js', import.meta.url), 'utf8');
  const version = source.match(/const BUILD_VERSION = '([^']+)'/)[1];
  const base = 'https://example.com/daily-news/';
  const entries = new Map(), listeners = new Map();
  let online = true, status = 200;
  const key = request => typeof request === 'string' ? request : request.url || request.href;
  class Cache {
    constructor() { this.values = new Map(); }
    async put(request, response) { this.values.set(key(request), response.clone()); }
    async match(request) { return this.values.get(key(request))?.clone(); }
    async delete(request) { return this.values.delete(key(request)); }
    async addAll(urls) { for (const url of urls) await this.put(url, new Response('shell:' + new URL(url).pathname)); }
  }
  const caches = { async keys() { return [...entries.keys()]; }, async open(name) { if (!entries.has(name)) entries.set(name, new Cache()); return entries.get(name); }, async delete(name) { return entries.delete(name); } };
  const self = { location: { href: base + 'sw.js' }, clients: { async claim() {} }, skipWaiting() {}, addEventListener(name, fn) { listeners.set(name, fn); } };
  const fetch = async request => {
    if (!online) throw new Error('offline');
    if (key(request).endsWith('precache.json')) return new Response(JSON.stringify({ version, files: ['index.html', 'assets/app.js', 'articles/index.json'] }));
    return new Response('fresh:' + new URL(key(request)).pathname, { status });
  };
  vm.runInNewContext(source, { self, caches, fetch, URL, Response, Request, AbortController, setTimeout, clearTimeout, console });
  async function lifecycle(name) { const pending = []; listeners.get(name)({ waitUntil(promise) { pending.push(promise); } }); await Promise.all(pending); }
  await lifecycle('install'); await lifecycle('activate');
  return {
    entries, caches, version, base,
    setOnline(value) { online = value; }, setStatus(value) { status = value; },
    async fetch(path, navigate = false) {
      const pending = []; let response;
      const request = { url: base + path, method: 'GET', mode: navigate ? 'navigate' : 'cors' };
      listeners.get('fetch')({ request, respondWith(promise) { response = promise; }, waitUntil(promise) { pending.push(promise); } });
      const result = await response; await Promise.all(pending); return result;
    },
    async cache(file) { const pending = []; listeners.get('message')({ data: { type: 'CACHE_ARTICLE', file, body: 'saved:' + file }, waitUntil(promise) { pending.push(promise); }, source: { postMessage() {} } }); await Promise.all(pending); }
  };
}
test('Offline shell and cached editions work beneath a GitHub Pages project path', async () => {
  const w = await worker(); await w.cache('2026-10-31-abend.md'); w.setOnline(false);
  assert.match(await (await w.fetch('', true)).text(), /shell:.*index.html/);
  assert.equal(await (await w.fetch('articles/2026-10-31-abend.md')).text(), 'saved:2026-10-31-abend.md');
  assert.equal((await w.fetch('articles/2026-10-31-mittag.md')).status, 503);
});
test('Article cache keeps the ten most recently opened editions and retouches old ones', async () => {
  const w = await worker();
  for (let day = 1; day <= 10; day++) await w.cache('2026-10-' + String(day).padStart(2, '0') + '-morgen.md');
  await w.cache('2026-10-01-morgen.md'); await w.cache('2026-10-11-morgen.md');
  w.setOnline(false);
  assert.equal((await w.fetch('articles/2026-10-02-morgen.md')).status, 503);
  assert.equal((await w.fetch('articles/2026-10-01-morgen.md')).status, 200);
  assert.equal((await w.caches.open('daily-brief-articles-v1')).values.size, 10);
});
test('Fresh indexes win, network failures fall back and actual 404s remain visible', async () => {
  const w = await worker();
  assert.match(await (await w.fetch('articles/index.json')).text(), /^fresh:/);
  w.setOnline(false); assert.match(await (await w.fetch('articles/index.json')).text(), /^fresh:/);
  w.setOnline(true); w.setStatus(404); assert.equal((await w.fetch('articles/index.json')).status, 404);
});
test('A waiting update cannot replace assets used by the active worker', async () => {
  const w = await worker(); const next = await w.caches.open('daily-brief-shell-future'); await next.put(w.base + 'assets/app.js', new Response('wrong version'));
  assert.match(await (await w.fetch('assets/app.js')).text(), /^shell:/);
});
test('Cache messages reject traversal and do not fetch foreign resources', async () => {
  const w = await worker(); await w.cache('../private.md'); await w.cache('https://other.example/news.md');
  assert.equal(w.entries.has('daily-brief-articles-v1'), false);
});
