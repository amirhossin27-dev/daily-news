export const EDITIONS = {
  morgen: { name: 'Morgen', long: 'Morgenausgabe', hour: 7 },
  mittag: { name: 'Mittag', long: 'Mittagsausgabe', hour: 12 },
  abend: { name: 'Abend', long: 'Abendausgabe', hour: 18 }
};
export const LABELS = ['Wirtschaft', 'Märkte', 'Zinsen', 'Deutschland', 'Europa', 'Energie', 'Krypto', 'Bitcoin', 'Ethereum', 'Hedera', 'Iran', 'USA', 'Naher Osten', 'Israel', 'Geopolitik', 'KI', 'Tech'];
const colors = ['#2f8f6a', '#3a7bd5', '#5b6ee1', '#b48b13', '#2b59c3', '#d1662b', '#e08a1e', '#f7931a', '#7a7fe0', '#687182', '#1d9a6c', '#c73e4c', '#b5651d', '#3b6fd8', '#8a5cc2', '#0f8e99', '#4f7cac'];
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function berlinParts(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}
export function formatDate(date, long = true) {
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', weekday: long ? 'long' : 'short', day: 'numeric', month: long ? 'long' : 'short', ...(long ? { year: 'numeric' } : {}) }).format(new Date(`${date}T12:00:00Z`));
}
export function formatTimestamp(date) {
  try { return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date)); } catch { return 'unbekannt'; }
}
export function safeUrl(url) {
  try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
export function chip(label, link = true) {
  const style = `--c:${colors[LABELS.indexOf(label)] || '#687182'}`;
  const text = `<span class="dot" aria-hidden="true"></span>${esc(label)}`;
  return link ? `<a class="chip small" style="${style}" href="${archiveUrl({ label })}">${text}</a>` : `<span class="chip small" style="${style}">${text}</span>`;
}
export function articleUrl(id) { return '#/artikel/' + encodeURIComponent(id); }
export function archiveUrl(filters = {}) {
  const p = new URLSearchParams();
  for (const key of ['q', 'label', 'edition', 'from', 'to', 'saved', 'unread']) if (filters[key]) p.set(key, String(filters[key]));
  return '#/archiv' + (p.size ? '?' + p.toString() : '');
}
export function parseRoute(hash = '#/') {
  const [path, query = ''] = hash.split('?');
  const p = new URLSearchParams(query);
  if (path.startsWith('#/artikel/')) {
    try { const id = decodeURIComponent(path.slice(10)); return /^[\d]{4}-[\d]{2}-[\d]{2}-(morgen|mittag|abend)$/.test(id) ? { page: 'article', id } : { page: 'missing' }; } catch { return { page: 'missing' }; }
  }
  if (path === '#/archiv' || (path === '#/' && p.has('q'))) return { page: 'archive', filters: Object.fromEntries(['q', 'label', 'edition', 'from', 'to', 'saved', 'unread'].map(k => [k, p.get(k) || ''])) };
  return { page: ({ '#/': 'home', '#/lernen': 'learning', '#/einstellungen': 'settings', '#/info': 'info' })[path] || 'missing' };
}
export function normalize(text) { return String(text).normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('de-DE').replace(/ß/g, 'ss'); }
export function matches(text, query) { return normalize(query).split(/\s+/).filter(Boolean).every(word => normalize(text).includes(word)); }
export function filterArticles(articles, filters, documents = [], personal = {}) {
  const bodies = new Map(documents.map(d => [d.id, d.text]));
  return articles.filter(a => (!filters.label || a.labels.includes(filters.label)) &&
    (!filters.edition || a.edition === filters.edition) && (!filters.from || a.date >= filters.from) &&
    (!filters.to || a.date <= filters.to) && (!filters.saved || personal[a.id]?.bookmarked) &&
    (!filters.unread || !personal[a.id]?.read) && matches(`${a.title} ${a.summary} ${a.labels.join(' ')} ${bodies.get(a.id) || ''}`, filters.q || ''));
}
export function snippet(text, query, size = 190) {
  const token = normalize(query).split(/\s+/).find(Boolean) || '';
  const at = token ? normalize(text).indexOf(token) : 0;
  const start = Math.max(0, at - 60);
  return (start ? '…' : '') + text.slice(start, start + size).trim() + (text.length > start + size ? '…' : '');
}
export function readingProgress(top, height, viewport) {
  return Math.min(1, Math.max(0, -top / Math.max(1, height - viewport)));
}
export function signature(text) {
  let h = 2166136261; for (const c of text) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16);
}
export function editionStatus(edition, article, now = new Date()) {
  if (article) return `${article.time} Uhr · veröffentlicht`;
  const minutes = berlinParts(now).minutes;
  return minutes >= EDITIONS[edition].hour * 60 + 60 ? 'Noch nicht erschienen' : `Ab ca. ${String(EDITIONS[edition].hour).padStart(2, '0')}:00 Uhr`;
}
