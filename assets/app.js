import { EDITIONS, LABELS, esc, berlinParts, formatDate, formatTimestamp, chip, articleUrl, archiveUrl, filterArticles, snippet, matches, readingProgress } from './utils.js';
import { createStore } from './storage.js';
import { Router } from './router.js';
import { articleHtml, sourceHtml } from './article.js';
import { SpeechPlayer } from './tts.js';
import { setupOffline, cacheArticle } from './offline.js';

let local;
try { local = window.localStorage; } catch { /* Private browsing may deny access. */ }
const store = createStore(local);
const view = document.getElementById('view');
let data = { articles: [] }, documents = null, learning = null;
let request, version = 0, currentArticle = null, archiveLimit = 20, results = [];
let pendingImport = null, beforeImport = null, sourceTrigger = null, tracking = false, progressDirty = false, lastSave = 0;
const dialog = document.getElementById('sourceDialog');
function notify(message) {
  const t = document.getElementById('toast'); t.textContent = message; t.hidden = false;
  clearTimeout(notify.timer); notify.timer = setTimeout(() => { t.hidden = true; }, 5500);
}
const speech = new SpeechPlayer(store, notify);
function applySettings() {
  const s = store.data.settings;
  if (s.theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = s.theme;
  document.documentElement.style.setProperty('--reading-scale', s.fontScale);
  document.documentElement.classList.toggle('no-disclaimer', s.hideDisclaimer);
  document.getElementById('storageNotice').hidden = store.persistent;
}
async function json(url, signal) {
  const response = await fetch(url, { cache: 'no-cache', signal });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response.json();
}
async function loadIndex() {
  const next = await json('articles/index.json');
  if (!Array.isArray(next.articles)) throw new Error('Ungültiger Artikelindex');
  next.articles.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)); data = next;
  connection();
}
function loadDocuments() {
  if (!documents) documents = json('articles/search-index.json').then(d => d.documents).catch(e => { documents = null; throw e; });
  return documents;
}
function loadLearning() {
  if (!learning) learning = json('articles/learning.json').then(d => d.items).catch(e => { learning = null; throw e; });
  return learning;
}
function connection() {
  document.getElementById('connection').textContent = (navigator.onLine ? '● Online' : '○ Offline · gespeicherte Inhalte') + (data.generated ? ' · Datenstand: ' + formatTimestamp(data.generated) + ' Uhr (Berlin)' : '');
  document.getElementById('connection').classList.toggle('offline', !navigator.onLine);
}
function personalButtons(a) {
  const p = store.article(a.id);
  return '<div class="card-actions"><button type="button" data-card-bookmark="' + esc(a.id) + '" aria-pressed="' + p.bookmarked + '">' + (p.bookmarked ? '★ Gespeichert' : '☆ Merken') + '</button><button type="button" data-card-read="' + esc(a.id) + '" aria-pressed="' + p.read + '">' + (p.read ? 'Gelesen' : 'Ungelesen') + '</button></div>';
}
function card(a, body = '') {
  const p = store.article(a.id);
  return '<article class="card"><a class="card-main" href="' + articleUrl(a.id) + '"><div class="meta"><span class="edition">' + EDITIONS[a.edition].name + ' · ' + esc(a.time) + ' Uhr</span><span>' + esc(formatDate(a.date, false)) + '</span><span>' + a.reading_minutes + ' Min. · ' + a.sources.length + ' Quellen</span></div><h2>' + esc(a.title) + '</h2><p>' + esc(a.summary) + '</p>' + (body ? '<p class="snippet">… ' + esc(body) + '</p>' : '') + '<span class="read-state">' + (p.progress > .02 && p.progress < .98 ? 'Weiterlesen · ' + Math.round(p.progress * 100) + ' %' : p.read ? 'Bereits gelesen' : 'Ausgabe öffnen →') + '</span></a><div class="card-bottom"><div class="labels">' + a.labels.map(l => chip(l)).join('') + '</div>' + personalButtons(a) + '</div></article>';
}
function pageHeading(kicker, title, description) {
  return '<header class="page-heading"><p class="eyebrow">' + esc(kicker) + '</p><h1>' + esc(title) + '</h1><p>' + esc(description) + '</p></header>';
}
function home() {
  const today = berlinParts().date, latest = data.articles[0];
  const todayArticles = data.articles.filter(a => a.date === today);
  let html = pageHeading(formatDate(today), 'Die Welt verstehen. Jeden Tag.', 'Deine Nachrichtenlage zu Wirtschaft, Technologie und Geopolitik. Mit Einordnung, Originalquellen und einem Gedanken zum Lernen.');
  html += '<section aria-labelledby="todayHeading"><div class="section-heading"><h2 id="todayHeading">Dein Tag in drei Ausgaben</h2><span>Alle Zeiten: Berlin</span></div><div class="edition-grid">';
  for (const [key, edition] of Object.entries(EDITIONS)) {
    const a = todayArticles.find(x => x.edition === key);
    const pending = berlinParts().minutes >= edition.hour * 60 + 60;
    html += '<div class="edition-slot ' + (a && a.id === latest?.id ? 'current' : '') + '"><p class="eyebrow">' + edition.name + '<span>' + (a ? a.time : String(edition.hour).padStart(2, '0') + ':00') + ' Uhr</span></p>' + (a ? '<a href="' + articleUrl(a.id) + '">' + esc(a.title) + '</a><span class="slot-state">' + (a.id === latest?.id ? '● Neueste Ausgabe' : 'Veröffentlicht') + '</span>' : '<p class="slot-placeholder">' + (pending ? 'Noch nicht erschienen' : 'Deine nächste Perspektive auf den Tag.') + '</p><span class="slot-state">' + (pending ? 'Wird nach Veröffentlichung angezeigt' : 'Geplant ab ca. ' + String(edition.hour).padStart(2, '0') + ':00 Uhr') + '</span>') + '</div>';
  }
  html += '</div></section>';
  if (store.data.settings.favorites.length) html += '<nav class="favorite-topics" aria-label="Bevorzugte Themen"><strong>Deine Themen</strong>' + store.data.settings.favorites.map(l => chip(l)).join('') + '</nav>';
  if (latest) html += '<section class="latest-section"><div class="section-heading"><h2>Jetzt lesen</h2><a href="#/archiv">Alle ' + data.articles.length + ' Ausgaben →</a></div>' + card(latest) + '</section>';
  else html += '<div class="empty">Noch keine Ausgaben. Sobald die erste Ausgabe veröffentlicht ist, findest du sie hier.</div>';
  const resumed = data.articles.filter(a => { const p = store.article(a.id); return p.progress > .02 && p.progress < .98 && a.id !== latest?.id; }).slice(0, 2);
  if (resumed.length) html += '<section><div class="section-heading"><h2>Hier warst du zuletzt</h2></div><div class="cards">' + resumed.map(a => card(a)).join('') + '</div></section>';
  html += '<aside class="learning-teaser"><span class="eyebrow">Nachrichten, die bleiben</span><h2>Ein Gedanke mehr als die Schlagzeile.</h2><p>Deine Lernbibliothek sammelt die Erklärungen aus allen Ausgaben. Zum Nachschlagen, Wiederfinden und Weiterdenken.</p><a href="#/lernen">Zur Lernbibliothek →</a></aside>';
  view.innerHTML = html;
}
function selectOptions(values, selected, label) {
  return '<option value="">' + label + '</option>' + values.map(v => '<option value="' + esc(v.value || v) + '"' + ((v.value || v) === selected ? ' selected' : '') + '>' + esc(v.label || v) + '</option>').join('');
}
async function archive(route, token, position) {
  const f = route.filters; archiveLimit = position?.limit || 20;
  view.innerHTML = pageHeading('Das Archiv', 'Zusammenhänge wiederfinden.', 'Durchsuche alle Ausgaben, bis in den Fließtext. Verbinde Themen, Zeiträume und deine persönlichen Markierungen.') +
    '<form class="filters" id="archiveFilters" role="search"><label class="filter-query">Volltextsuche<input name="q" type="search" maxlength="300" value="' + esc(f.q) + '" placeholder="Begriff, Zahl oder Zusammenhang"></label><label>Thema<select name="label">' + selectOptions(LABELS, f.label, 'Alle Themen') + '</select></label><label>Ausgabe<select name="edition">' + selectOptions(Object.entries(EDITIONS).map(([value, e]) => ({ value, label: e.name })), f.edition, 'Alle Ausgaben') + '</select></label><label>Von<input name="from" type="date" value="' + esc(f.from) + '"></label><label>Bis<input name="to" type="date" value="' + esc(f.to) + '"></label><label class="checkbox"><input name="saved" type="checkbox"' + (f.saved ? ' checked' : '') + '>Nur Lesezeichen</label><label class="checkbox"><input name="unread" type="checkbox"' + (f.unread ? ' checked' : '') + '>Nur ungelesen</label><div class="filter-actions"><button class="primary" type="submit">Ergebnisse anzeigen</button><a href="#/archiv">Alles zurücksetzen</a></div></form><div id="archiveResults" aria-live="polite"><p class="empty">Suche wird vorbereitet …</p></div>';
  const target = document.getElementById('archiveResults');
  if (f.from && f.to && f.from > f.to) { target.innerHTML = '<p class="empty">Das Startdatum muss vor dem Enddatum liegen.</p>'; return; }
  let docs = [];
  try { if (f.q.trim()) docs = await loadDocuments(); }
  catch { if (token === version) target.innerHTML = '<p class="empty">Der Volltextindex konnte nicht geladen werden. Prüfe deine Verbindung und versuche es erneut.</p><button type="button" data-retry>Erneut versuchen</button>'; return; }
  if (token !== version) return;
  results = filterArticles(data.articles, f, docs, store.data.articles);
  const docMap = new Map(docs.map(d => [d.id, d.text]));
  const active = [f.q && 'Suche: ' + f.q, f.label, f.edition && EDITIONS[f.edition]?.name, f.from && 'Ab ' + f.from, f.to && 'Bis ' + f.to, f.saved && 'Lesezeichen', f.unread && 'Ungelesen'].filter(Boolean);
  archive.draw = () => {
    target.innerHTML = '<div class="result-heading"><h2 tabindex="-1" id="resultHeading">' + results.length + ' ' + (results.length === 1 ? 'Ausgabe' : 'Ausgaben') + '</h2><span>Neueste zuerst</span></div>' + (active.length ? '<p class="active-filters">Aktiv: ' + active.map(esc).join(' · ') + '</p>' : '') + '<div class="cards">' + results.slice(0, archiveLimit).map(a => card(a, f.q ? snippet(docMap.get(a.id) || a.summary, f.q) : '')).join('') + '</div>' + (!results.length ? '<div class="empty">Keine passenden Ausgaben. <a href="#/archiv">Filter zurücksetzen</a></div>' : '') + (results.length > archiveLimit ? '<button type="button" class="load-more" id="loadMore">Weitere 20 Ausgaben anzeigen (' + (results.length - archiveLimit) + ' verbleibend)</button>' : '');
  };
  archive.draw();
}
async function learningPage(token) {
  const q = new URLSearchParams(location.hash.split('?')[1] || '').get('q') || '';
  view.innerHTML = pageHeading('Zum Lernen', 'Mehr verstehen. Wieder nachschlagen.', 'Die Lernkästen aus deinen Ausgaben, gesammelt an einem Ort. Jeder Eintrag führt zurück zum Kontext und seinen Quellen.') + '<form class="library-search" id="learningSearch" role="search"><label>In der Lernbibliothek suchen<input type="search" name="q" maxlength="300" value="' + esc(q) + '" placeholder="Zum Beispiel: Inflation oder Staking"></label><button class="primary" type="submit">Suchen</button></form><div id="learningResults" aria-live="polite"><p class="empty">Lernbibliothek wird geladen …</p></div>';
  try {
    const items = await loadLearning(); if (token !== version) return;
    const found = items.filter(x => matches(x.text + ' ' + x.title + ' ' + x.labels.join(' '), q));
    document.getElementById('learningResults').innerHTML = '<div class="result-heading"><h2>' + found.length + ' Lerngedanken</h2></div><div class="learning-grid">' + found.map(x => '<article class="learning-card"><p class="eyebrow">' + esc(formatDate(x.date, false)) + '</p><p class="learning-text">' + esc(x.text) + '</p><div class="labels">' + x.labels.map(l => chip(l)).join('') + '</div><a class="learning-origin" href="' + articleUrl(x.article_id) + '">Aus der Ausgabe: ' + esc(x.title) + ' →</a></article>').join('') + '</div>' + (!found.length ? '<p class="empty">Keine passenden Lernkästen gefunden.</p>' : '');
  } catch { if (token === version) document.getElementById('learningResults').innerHTML = '<p class="empty">Die Lernbibliothek ist gerade nicht verfügbar.</p><button type="button" data-retry>Erneut versuchen</button>'; }
}
function settingsPage() {
  const s = store.data.settings;
  view.innerHTML = pageHeading('Dein Daily Brief', 'So liest du am liebsten.', 'Einstellungen, Themen und Lesemarkierungen werden in diesem Browser gespeichert. Mit einer Sicherung kannst du sie auf ein anderes Gerät übertragen.') +
    '<section class="settings-panel"><h2>Lesen und Darstellung</h2><div class="settings-grid"><label>Schriftgröße<select id="fontScale"><option value="1">Normal</option><option value="1.15">Groß</option><option value="1.3">Sehr groß</option></select></label><label>Farbschema<select id="themeSetting"><option value="system">Wie das Gerät</option><option value="light">Hell</option><option value="dark">Dunkel</option></select></label></div><label class="checkbox"><input id="showDisclaimer" type="checkbox"' + (!s.hideDisclaimer ? ' checked' : '') + '>Informationshinweis anzeigen</label></section>' +
    '<section class="settings-panel"><h2>Deine Themen</h2><p>Diese Themen erscheinen als Schnellzugriffe auf der Startseite.</p><fieldset class="topic-choices"><legend class="sr-only">Bevorzugte Themen</legend>' + LABELS.map(l => '<label><input type="checkbox" data-favorite="' + esc(l) + '"' + (s.favorites.includes(l) ? ' checked' : '') + '><span>' + esc(l) + '</span></label>').join('') + '</fieldset></section>' +
    '<section class="settings-panel"><h2>Persönliche Sammlung</h2><div class="settings-links"><a href="#/archiv?saved=1">Deine Lesezeichen →</a><a href="#/archiv?unread=1">Ungelesene Ausgaben →</a></div><p><strong>Reminder:</strong> Beim Löschen der Browserdaten gehen auch deine Markierungen verloren. Sichere sie regelmäßig.</p><button type="button" id="exportData">Sicherung herunterladen</button><label class="import-label">Sicherung auswählen<input type="file" id="importData" accept=".json,application/json"></label><div id="importPreview" role="status"></div>' + (beforeImport ? '<button type="button" id="undoImport">Stand vor dem Import wiederherstellen</button>' : '') + '</section>' +
    '<section class="settings-panel"><h2>Unterwegs</h2><p>Die letzten zehn geöffneten Ausgaben sind nach erfolgreicher Offline-Einrichtung auf diesem Gerät gespeichert. Das Vorlesen hängt von den installierten Stimmen ab.</p><button type="button" id="installApp" hidden>Daily Brief installieren</button><p id="installHint" class="muted">Du kannst Daily Brief über das Browsermenü installieren oder zum Home-Bildschirm hinzufügen, sofern dein Browser dies unterstützt.</p></section>';
  document.getElementById('fontScale').value = s.fontScale; document.getElementById('themeSetting').value = s.theme;
  window.dispatchEvent(new Event('daily-brief-settings'));
}
function infoPage() {
  view.innerHTML = pageHeading('Über diese Seite', 'Nachrichten mit Kontext.', 'Dreimal täglich recherchiert. Für Amir, mit Platz zum Lernen und Nachdenken.') +
    '<div class="info prose"><h2>Wie eine Ausgabe entsteht</h2><p>Claude recherchiert und schreibt die Ausgaben nach dem Redaktionsleitfaden. Die Zielzeiten sind 07:00, 12:00 und 18:00 Uhr in Europe/Berlin. Die tatsächliche Veröffentlichung wird an jeder Ausgabe angezeigt.</p><h2>Was du erwarten kannst</h2><p>Neue und überarbeitete Ausgaben umfassen 700 bis 1.200 Wörter, drei Kernaussagen, drei bis vier Hauptthemen, einen Lernkasten und eine offene Frage. Historische Ausgaben können kürzer sein. Neue Entwicklungen werden mit der vorherigen Ausgabe verknüpft.</p><h2>Quellen und Grenzen</h2><p>Zahlen, Ereignisse und Zitate erhalten Quellen. Einordnung, Spekulation und unbestätigte Social-Media-Inhalte werden gekennzeichnet. KI kann Fehler machen. Eine technische Quellenprüfung bestätigt nicht, dass eine Quelle die Aussage tatsächlich trägt. Bitte prüfe bei wichtigen Entscheidungen die Originalquelle. Es handelt sich nicht um Anlageberatung.</p><h2>Deine Daten</h2><p>Einstellungen, Lesezeichen und Lese- und Hörpositionen bleiben in diesem Browser. Es gibt keine automatische Synchronisierung. Der JSON-Export enthält diese persönlichen Daten. Die Schriftarten werden lokal geladen.</p><h2>Offline und Vorlesen</h2><p>Nach der ersten erfolgreichen Einrichtung stehen die Oberfläche und die letzten zehn geöffneten Ausgaben offline bereit. Der angezeigte Datenstand hilft dir, gespeicherte Inhalte einzuordnen. Geräte- oder Netzwerkstimmen können sich je nach Browser unterscheiden; manche benötigen Internet. Der automatische Start kann blockiert werden.</p></div>';
}
async function showArticle(id, token) {
  const a = data.articles.find(x => x.id === id);
  if (!a) { view.innerHTML = '<div class="empty"><h1>Ausgabe nicht gefunden</h1><a href="#/archiv">Zum Archiv</a></div>'; return; }
  view.innerHTML = '<p class="empty">Ausgabe wird geladen …</p>';
  const response = await fetch('articles/' + a.file, { cache: 'no-cache', signal: request.signal });
  if (!response.ok) throw new Error('Artikel nicht verfügbar');
  const md = await response.text(); if (token !== version) return;
  const at = data.articles.indexOf(a), p = store.article(a.id);
  view.innerHTML = articleHtml(a, md, data.articles[at + 1], data.articles[at - 1], p, router.articleReturn);
  currentArticle = a; document.title = a.title + ' · Daily Brief'; document.getElementById('fontScale').value = store.data.settings.fontScale;
  speech.attach(view.querySelector('article'), a); cacheArticle(a.file, md);
}
function saveProgress() {
  if (!tracking || !progressDirty || !currentArticle) return;
  const prose = document.getElementById('prose'); if (!prose) return;
  const top = document.querySelector('.site-header').offsetHeight + 16;
  const height = window.innerHeight - top - (speech.player.hidden ? 0 : speech.player.offsetHeight);
  const ratio = readingProgress(prose.getBoundingClientRect().top - top, prose.offsetHeight, height);
  const section = [...prose.querySelectorAll('h2,h3')].filter(h => h.getBoundingClientRect().top <= top + 30).length;
  store.updateArticle(currentArticle.id, { progress: ratio, section });
}
function updateProgress() {
  if (!currentArticle) return;
  const prose = document.getElementById('prose'); if (!prose) return;
  const header = document.querySelector('.site-header').offsetHeight + 16;
  const ratio = readingProgress(prose.getBoundingClientRect().top - header, prose.offsetHeight, window.innerHeight - header - speech.player.offsetHeight);
  const progress = document.getElementById('readingProgress'); if (progress) progress.value = ratio;
  const percent = document.getElementById('readingPercent'); if (percent) percent.textContent = Math.round(ratio * 100) + ' % gelesen';
  if (Date.now() - lastSave > 1000) { saveProgress(); lastSave = Date.now(); }
}
function scrollToElement(el) {
  el?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}
const router = new Router(async (route, position) => {
  const token = ++version; saveProgress(); tracking = false; progressDirty = false; currentArticle = null; speech.detach();
  if (dialog.open) dialog.close(); request?.abort(); request = new AbortController();
  view.setAttribute('aria-busy', 'true'); document.title = 'Daily Brief';
  document.querySelectorAll('[data-page]').forEach(a => { if (a.dataset.page === route.page) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  document.getElementById('q').value = route.filters?.q || '';
  try {
    if (route.page === 'home') home();
    else if (route.page === 'archive') await archive(route, token, position);
    else if (route.page === 'article') await showArticle(route.id, token);
    else if (route.page === 'learning') await learningPage(token);
    else if (route.page === 'settings') settingsPage();
    else if (route.page === 'info') infoPage();
    else view.innerHTML = '<div class="empty"><h1>Diese Seite gibt es nicht.</h1><a href="#/">Zur Startseite</a></div>';
  } catch (e) {
    if (e.name !== 'AbortError' && token === version) view.innerHTML = '<div class="empty"><h1>Inhalt gerade nicht verfügbar</h1><p>Prüfe deine Verbindung. Offline kannst du bereits gespeicherte Ausgaben öffnen.</p><button type="button" data-retry>Erneut versuchen</button><p><a href="#/">Zur Startseite</a></p></div>';
  }
  if (token !== version) return;
  view.setAttribute('aria-busy', 'false'); applySettings();
  document.getElementById('main').focus({ preventScroll: true });
  requestAnimationFrame(() => { if (token !== version) return; window.scrollTo({ top: position?.y || 0, behavior: 'instant' }); tracking = true; updateProgress(); });
});
function navigate(hash) { router.remember({ limit: archiveLimit }); if (location.hash === hash) router.dispatch(); else location.hash = hash; }
document.getElementById('headerSearch').addEventListener('submit', e => { e.preventDefault(); navigate(archiveUrl({ q: document.getElementById('q').value.trim() })); });
document.addEventListener('submit', e => {
  if (e.target.id === 'archiveFilters') {
    e.preventDefault(); const f = new FormData(e.target); navigate(archiveUrl(Object.fromEntries([...f].map(([k, v]) => [k, k === 'saved' || k === 'unread' ? '1' : v]))));
  } else if (e.target.id === 'learningSearch') { e.preventDefault(); const q = new FormData(e.target).get('q').trim(); navigate('#/lernen' + (q ? '?q=' + encodeURIComponent(q) : '')); }
});
document.addEventListener('click', async e => {
  const target = e.target.closest('button,a'); if (!target) return;
  if (target.hasAttribute('data-retry')) { router.dispatch(); return; }
  if (target.id === 'loadMore') { const y = window.scrollY; archiveLimit += 20; archive.draw(); router.remember({ limit: archiveLimit }); window.scrollTo({ top: y, behavior: 'instant' }); document.querySelectorAll('#archiveResults .card')[archiveLimit - 20]?.querySelector('a').focus({ preventScroll: true }); return; }
  const bookmarkId = target.dataset.cardBookmark || (target.hasAttribute('data-bookmark') && currentArticle?.id);
  const readId = target.dataset.cardRead || (target.hasAttribute('data-read') && currentArticle?.id);
  if (bookmarkId || readId) {
    const id = bookmarkId || readId, p = store.article(id), key = bookmarkId ? 'bookmarked' : 'read'; store.updateArticle(id, { [key]: !p[key] });
    target.setAttribute('aria-pressed', String(!p[key]));
    target.textContent = bookmarkId ? (!p[key] ? '★ Gespeichert' : '☆ Merken') : target.hasAttribute('data-read') ? (!p[key] ? 'Als ungelesen markieren' : 'Als gelesen markieren') : (!p[key] ? 'Gelesen' : 'Ungelesen');
    if (router.current.includes('saved=1') || router.current.includes('unread=1')) { const y = scrollY; await router.dispatch(); scrollTo({ top: y, behavior: 'instant' }); }
    applySettings(); return;
  }
  if (target.dataset.source && currentArticle) {
    const s = currentArticle.sources.find(s => String(s.id) === target.dataset.source); if (!s) return;
    sourceTrigger = target; target.setAttribute('aria-expanded', 'true'); document.getElementById('sourceHeading').textContent = 'Quelle ' + s.id; document.getElementById('sourceContent').innerHTML = sourceHtml(s); dialog.showModal(); return;
  }
  if (target.id === 'closeSource') { dialog.close(); return; }
  if (target.id === 'allSources') { dialog.close(); const h = document.querySelector('#quellen h2'); h?.setAttribute('tabindex', '-1'); h?.focus({ preventScroll: true }); scrollToElement(h); return; }
  if (target.dataset.anchor) { e.preventDefault(); progressDirty = true; const section = document.getElementById(target.dataset.anchor); section?.setAttribute('tabindex', '-1'); section?.focus({ preventScroll: true }); scrollToElement(section); return; }
  if (target.hasAttribute('data-resume') && currentArticle) {
    const p = store.article(currentArticle.id), prose = document.getElementById('prose'), top = document.querySelector('.site-header').offsetHeight + 16; progressDirty = true;
    window.scrollTo({ top: window.scrollY + prose.getBoundingClientRect().top - top + p.progress * Math.max(0, prose.offsetHeight - window.innerHeight + top + speech.player.offsetHeight), behavior: 'instant' }); return;
  }
  if (target.hasAttribute('data-hide-disclaimer')) { store.updateSettings({ hideDisclaimer: true }); applySettings(); return; }
  if (target.id === 'themeToggle') { const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches); store.updateSettings({ theme: dark ? 'light' : 'dark' }); applySettings(); return; }
  if (target.id === 'exportData') {
    const blob = new Blob([JSON.stringify(store.export(), null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'daily-brief-sicherung-' + berlinParts().date + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return;
  }
  if (target.id === 'applyImport' && pendingImport) {
    beforeImport = store.export(); store.import(pendingImport); pendingImport = null; applySettings(); speech.syncSettings(); settingsPage(); notify('Sicherung übernommen. Der vorherige Stand lässt sich hier wiederherstellen.'); return;
  }
  if (target.id === 'undoImport' && beforeImport) { store.import(beforeImport); beforeImport = null; applySettings(); speech.syncSettings(); settingsPage(); notify('Vorheriger Stand wiederhergestellt.'); }
});
dialog.addEventListener('close', () => { sourceTrigger?.setAttribute('aria-expanded', 'false'); sourceTrigger = null; });
document.addEventListener('change', async e => {
  if (e.target.id === 'fontScale') { store.updateSettings({ fontScale: Number(e.target.value) }); applySettings(); }
  if (e.target.id === 'themeSetting') { store.updateSettings({ theme: e.target.value }); applySettings(); }
  if (e.target.id === 'showDisclaimer') { store.updateSettings({ hideDisclaimer: !e.target.checked }); applySettings(); }
  if (e.target.dataset.favorite) { const favorites = [...document.querySelectorAll('[data-favorite]:checked')].map(n => n.dataset.favorite); store.updateSettings({ favorites }); applySettings(); }
  if (e.target.id === 'importData') {
    const file = e.target.files[0]; if (!file) return;
    const preview = document.getElementById('importPreview'); pendingImport = null;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Die Sicherung ist zu groß (maximal 2 MB).');
      const candidate = JSON.parse(await file.text());
      const { validateBackup } = await import('./storage.js'); const clean = validateBackup(candidate);
      pendingImport = { version: 1, data: clean };
      preview.replaceChildren(document.createTextNode(Object.keys(clean.articles).length + ' Ausgaben mit persönlichen Markierungen und ' + clean.settings.favorites.length + ' bevorzugte Themen. Beim Übernehmen werden die aktuellen Einstellungen ersetzt. '));
      const b = document.createElement('button'); b.type = 'button'; b.id = 'applyImport'; b.textContent = 'Sicherung übernehmen'; preview.append(b);
    } catch (error) { preview.textContent = 'Import nicht möglich: ' + error.message; }
  }
});
window.addEventListener('scroll', () => { if (!updateProgress.pending) { updateProgress.pending = true; requestAnimationFrame(() => { updateProgress.pending = false; updateProgress(); }); } }, { passive: true });
window.addEventListener('wheel', () => { progressDirty = true; }, { passive: true });
window.addEventListener('touchmove', () => { progressDirty = true; }, { passive: true });
window.addEventListener('keydown', e => { if (['PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End', ' '].includes(e.key)) progressDirty = true; });
window.addEventListener('pagehide', saveProgress);
const sizes = new ResizeObserver(() => {
  document.documentElement.style.setProperty('--header-height', document.querySelector('.site-header').offsetHeight + 'px');
  document.documentElement.style.setProperty('--player-height', (speech.player.hidden ? 0 : speech.player.offsetHeight) + 'px');
});
sizes.observe(speech.player); sizes.observe(document.querySelector('.site-header'));
applySettings(); connection();
setupOffline(notify);
window.addEventListener('offline', connection);
window.addEventListener('online', async () => { connection(); const old = data.generated; try { await loadIndex(); documents = null; learning = null; if (data.generated !== old) { if (router.current === '#/' || !location.hash) router.dispatch(); else notify('Neue Ausgaben sind im Archiv verfügbar.'); } } catch { notify('Die Verbindung ist zurück, der Datenstand konnte noch nicht aktualisiert werden.'); } });
loadIndex().then(() => router.dispatch()).catch(() => { view.setAttribute('aria-busy', 'false'); view.innerHTML = '<div class="empty"><h1>Ausgaben konnten nicht geladen werden</h1><p>Bitte prüfe deine Verbindung.</p><button type="button" id="retryIndex">Erneut versuchen</button></div>'; document.getElementById('retryIndex').addEventListener('click', () => location.reload()); });
