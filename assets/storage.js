import { LABELS } from './utils.js';
const KEY = 'daily-brief-v1';
const idPattern = /^\d{4}-\d{2}-\d{2}-(morgen|mittag|abend)$/;
export function defaults() { return { settings: { fontScale: 1, favorites: [], autoScroll: true, tts: { rate: 1, auto: false, voice: '' }, theme: 'system', hideDisclaimer: false }, articles: {} }; }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function bounded(value, min, max) { return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max; }
export function validateBackup(input) {
  if (!object(input) || input.version !== 1 || !object(input.data)) throw new Error('Keine unterstützte Daily-Brief-Sicherung (Version 1).');
  const { settings: s, articles } = input.data;
  if (!object(s) || ![1, 1.15, 1.3].includes(s.fontScale) || !Array.isArray(s.favorites) || s.favorites.some(l => !LABELS.includes(l)) || s.favorites.length > LABELS.length || typeof s.autoScroll !== 'boolean' || !['system', 'light', 'dark'].includes(s.theme) || typeof s.hideDisclaimer !== 'boolean' || !object(s.tts) || !bounded(s.tts.rate, .5, 2) || typeof s.tts.auto !== 'boolean' || typeof s.tts.voice !== 'string' || s.tts.voice.length > 300) throw new Error('Die Einstellungen in der Sicherung sind ungültig.');
  if (!object(articles) || Object.keys(articles).length > 10000) throw new Error('Die Lesemarkierungen sind ungültig.');
  const clean = defaults();
  clean.settings = { fontScale: s.fontScale, favorites: [...new Set(s.favorites)], autoScroll: s.autoScroll, theme: s.theme, hideDisclaimer: s.hideDisclaimer, tts: { rate: s.tts.rate, auto: s.tts.auto, voice: s.tts.voice } };
  for (const [id, a] of Object.entries(articles)) {
    if (!idPattern.test(id) || !object(a) || typeof a.read !== 'boolean' || typeof a.bookmarked !== 'boolean' || !bounded(a.progress, 0, 1) || !Number.isInteger(a.section) || !bounded(a.section, 0, 10000)) throw new Error('Eine Lesemarkierung ist ungültig.');
    const entry = { read: a.read, bookmarked: a.bookmarked, progress: a.progress, section: a.section };
    if (a.listen !== undefined) {
      if (!object(a.listen) || !Number.isInteger(a.listen.index) || !bounded(a.listen.index, 0, 100000) || typeof a.listen.signature !== 'string' || !/^[0-9a-f]{1,8}$/.test(a.listen.signature)) throw new Error('Eine Hörposition ist ungültig.');
      entry.listen = { index: a.listen.index, signature: a.listen.signature };
    }
    clean.articles[id] = entry;
  }
  return clean;
}
export function createStore(storage) {
  let data = defaults(), persistent = true;
  try {
    const raw = storage?.getItem(KEY);
    if (raw) data = validateBackup({ version: 1, data: JSON.parse(raw) });
    else {
      const theme = storage?.getItem('db-theme'); if (['light', 'dark'].includes(theme)) data.settings.theme = theme;
      const old = JSON.parse(storage?.getItem('db-tts') || 'null');
      if (old && bounded(old.rate, .5, 2) && typeof old.auto === 'boolean' && typeof old.voice === 'string') data.settings.tts = old;
      data.settings.hideDisclaimer = storage?.getItem('db-hide-disclaimer') === 'true';
    }
    if (!storage) persistent = false;
    else { storage.setItem('daily-brief-probe', '1'); storage.removeItem('daily-brief-probe'); }
  } catch {
    // Corrupt saved JSON is recoverable; storage denial is not.
    try { storage.setItem('daily-brief-probe', '1'); storage.removeItem('daily-brief-probe'); } catch { persistent = false; }
  }
  function save() { try { if (storage) storage.setItem(KEY, JSON.stringify(data)); else persistent = false; } catch { persistent = false; } }
  return {
    get data() { return data; }, get persistent() { return persistent; },
    article(id) { return data.articles[id] || { read: false, bookmarked: false, progress: 0, section: 0 }; },
    updateArticle(id, patch) { if (!idPattern.test(id)) return; data.articles[id] = { ...this.article(id), ...patch }; save(); },
    updateSettings(patch) { data.settings = { ...data.settings, ...patch }; save(); },
    export() { return { version: 1, exported_at: new Date().toISOString(), data: structuredClone(data) }; },
    import(input) { const clean = validateBackup(input); data = clean; save(); },
    save
  };
}
