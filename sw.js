/* Daily Brief offline shell. The build stamps this file when shell assets change. */
// build-version: 1516f44a899c0cc9
const BUILD_VERSION = '1516f44a899c0cc9';
const PREFIX = 'daily-brief-shell-';
const ARTICLES = 'daily-brief-articles-v1';
const META = 'daily-brief-cache-meta-v1';
const base = new URL('./', self.location.href);
let operations = Promise.resolve();
const shellName = PREFIX + BUILD_VERSION;
async function activeShell() {
  return (await caches.keys()).includes(shellName) ? caches.open(shellName) : null;
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch(new URL('precache.json', base), { cache: 'no-store' });
    if (!response.ok) throw new Error('Precache manifest unavailable');
    const manifest = await response.json();
    if (manifest.version !== BUILD_VERSION) throw new Error('Precache version mismatch');
    const cache = await caches.open(shellName);
    await cache.addAll(manifest.files.map(path => new URL(path, base).href));
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const shell = await activeShell();
    if (!shell) return;
    for (const name of await caches.keys()) if (name.startsWith(PREFIX) && name !== shellName) await caches.delete(name);
    await self.clients.claim();
  })());
});
function validFile(file) { return typeof file === 'string' && /^\d{4}-\d{2}-\d{2}-(morgen|mittag|abend)\.md$/.test(file); }
async function storeArticle(file, response) {
  const articleCache = await caches.open(ARTICLES), metadata = await caches.open(META);
  const key = new URL('__article_order__', base).href;
  const previous = await metadata.match(key);
  let order = previous ? await previous.json() : [];
  order = order.filter(value => value !== file); order.push(file);
  await articleCache.put(new URL('articles/' + file, base), response);
  while (order.length > 10) await articleCache.delete(new URL('articles/' + order.shift(), base));
  await metadata.put(key, new Response(JSON.stringify(order), { headers: { 'Content-Type': 'application/json' } }));
}
function enqueue(operation) { operations = operations.catch(() => {}).then(operation); return operations; }
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') { self.skipWaiting(); return; }
  if (event.data?.type === 'CACHE_ARTICLE' && validFile(event.data.file) && typeof event.data.body === 'string' && event.data.body.length < 2 * 1024 * 1024) {
    event.waitUntil(enqueue(() => storeArticle(event.data.file, new Response(event.data.body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } }))).catch(() => event.source?.postMessage({ type: 'CACHE_ERROR' })));
  }
});
async function networkFirst(request, fallback) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(request, { signal: controller.signal });
    if (response.ok) { const shell = await activeShell(); await shell?.put(request, response.clone()).catch(() => {}); return response; }
    // A real 404 must remain a 404. Do not resurrect removed articles or indexes.
    if (response.status === 404) return response;
    const cached = await fallback(); return cached || response;
  } catch { const cached = await fallback(); return cached || new Response('Offline nicht gespeichert', { status: 503 }); }
  finally { clearTimeout(timer); }
}
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return;
  const path = url.pathname.slice(base.pathname.length);
  if (path.startsWith('articles/') && validFile(path.slice(9))) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) { const copy = response.clone(); event.waitUntil(enqueue(() => storeArticle(path.slice(9), copy)).catch(() => {})); return response; }
        if (response.status === 404) return response;
        return (await caches.open(ARTICLES)).match(request).then(cached => cached || response);
      } catch { const cache = await caches.open(ARTICLES); return (await cache.match(request)) || new Response('Ausgabe nicht offline gespeichert', { status: 503 }); }
    })()); return;
  }
  if (['articles/index.json', 'articles/search-index.json', 'articles/learning.json'].includes(path)) {
    event.respondWith(networkFirst(request, async () => (await activeShell())?.match(request))); return;
  }
  if (request.mode === 'navigate') {
    event.respondWith((async () => (await (await activeShell())?.match(new URL('index.html', base))) || fetch(request))()); return;
  }
  event.respondWith((async () => (await (await activeShell())?.match(request)) || fetch(request))());
});
