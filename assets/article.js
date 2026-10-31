import { esc, chip, formatDate, formatTimestamp, articleUrl, safeUrl, EDITIONS } from './utils.js';
const callouts = {
  'GERÜCHT': ['geruecht', 'Social Media · unbestätigt'], GERUECHT: ['geruecht', 'Social Media · unbestätigt'],
  SOCIAL: ['social', 'Social Media · Inhalt belegt'], SPEKULATION: ['spekulation', 'Spekulation'],
  EINORDNUNG: ['einordnung', 'Einordnung'], LERNEN: ['lernen', 'Zum Lernen'], FRAGE: ['frage', 'Zum Nachdenken']
};
const types = { news: 'Nachrichten', official: 'Offiziell', data: 'Daten', analysis: 'Analyse', x: 'X', reddit: 'Reddit', social: 'Social Media', video: 'Video', podcast: 'Podcast' };
export function stripFrontmatter(md) { return md.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, ''); }
export function sourceHtml(s) {
  const url = safeUrl(s.url);
  return `<div>${url ? `<a class="src-title" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>` : `<strong>${esc(s.title)}</strong>`}<div class="src-meta"><span class="src-type">${esc(types[s.type] || s.type)}</span><span>${esc(s.publisher || '')}</span>${s.date ? `<span>${esc(s.date)}</span>` : ''}</div></div>`;
}
export function renderMarkdown(md) {
  // Sanitize both before and after citation decoration. Never trust article HTML.
  const html = window.DOMPurify.sanitize(window.marked.parse(stripFrontmatter(md), { gfm: true }));
  const root = document.createElement('div'); root.innerHTML = html;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (node.parentElement.closest('a, code, pre, script, style')) continue;
    const re = /\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\]/g;
    if (!re.test(node.textContent)) continue;
    re.lastIndex = 0; let last = 0, match; const fragment = document.createDocumentFragment();
    while ((match = re.exec(node.textContent))) {
      fragment.append(document.createTextNode(node.textContent.slice(last, match.index)));
      const sup = document.createElement('sup'); sup.className = 'cite';
      for (const [i, n] of match[1].split(/\s*,\s*/).entries()) {
        if (i) sup.append(document.createTextNode(', '));
        const button = document.createElement('button'); button.type = 'button'; button.dataset.source = n;
        button.setAttribute('aria-label', `Quelle ${n} anzeigen`); button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-controls', 'sourceDialog'); button.textContent = n; sup.append(button);
      }
      fragment.append(sup); last = re.lastIndex;
    }
    fragment.append(document.createTextNode(node.textContent.slice(last))); node.replaceWith(fragment);
  }
  root.querySelectorAll('blockquote').forEach(bq => {
    const p = bq.querySelector('p'), node = p?.firstChild;
    if (node?.nodeType !== Node.TEXT_NODE) return;
    const match = node.textContent.match(/^\s*\[!([A-ZÄÖÜ]+)\]\s*/);
    const type = match && callouts[match[1]]; if (!type) return;
    node.textContent = node.textContent.slice(match[0].length); bq.classList.add('callout', `callout-${type[0]}`);
    const label = document.createElement('span'); label.className = 'callout-label'; label.textContent = type[1]; bq.prepend(label);
  });
  root.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (/^https:/i.test(href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    else if (!href.startsWith('#/artikel/') && !href.startsWith('#')) a.removeAttribute('href');
  });
  const sections = [];
  root.querySelectorAll('h2, h3').forEach((h, i) => { h.id = `abschnitt-${i + 1}`; sections.push({ id: h.id, text: h.textContent, level: h.tagName }); });
  return { html: root.innerHTML, sections };
}
export function articleHtml(a, md, older, newer, personal, returnHref) {
  const { html, sections } = renderMarkdown(md);
  const correction = a.updated_at && a.correction_note ? `<aside class="correction"><strong>Korrigiert am ${esc(formatTimestamp(a.updated_at))} Uhr</strong><p>${esc(a.correction_note)}</p></aside>` : '';
  return `<article class="article" data-article="${esc(a.id)}">
    <a class="back" href="${esc(returnHref)}">← Zur Übersicht</a>
    <header class="article-head"><div class="meta"><span class="edition">${esc(EDITIONS[a.edition].long)} · ${esc(a.time)} Uhr</span><span>${esc(formatDate(a.date))}</span><span>${a.reading_minutes} Min. Lesezeit</span></div>
    <h1 data-tts>${esc(a.title)}</h1><p class="lede" data-tts>${esc(a.summary)}</p><div class="labels">${a.labels.map(l => chip(l)).join('')}</div>
    <div class="article-actions"><button type="button" data-bookmark aria-pressed="${personal.bookmarked}">${personal.bookmarked ? '★ Gespeichert' : '☆ Merken'}</button><button type="button" data-read aria-pressed="${personal.read}">${personal.read ? 'Als ungelesen markieren' : 'Als gelesen markieren'}</button><button type="button" id="listenCta">▶ Anhören</button></div>
    ${personal.progress > .02 && personal.progress < .98 ? '<button class="link-btn" type="button" data-resume>An letzter Leseposition weiterlesen</button>' : ''}
    <div class="reading-tools"><label>Schriftgröße <select id="fontScale" aria-label="Schriftgröße"><option value="1">Normal</option><option value="1.15">Groß</option><option value="1.3">Sehr groß</option></select></label><span id="readingPercent" role="status">0 % gelesen</span></div>
    <progress id="readingProgress" max="1" value="0" aria-label="Lesefortschritt"></progress>${correction}</header>
    <nav class="toc" aria-label="Inhaltsverzeichnis"><details open><summary>In dieser Ausgabe</summary><ol>${sections.map(s => `<li class="${s.level === 'H3' ? 'subsection' : ''}"><a href="#${s.id}" data-anchor="${s.id}">${esc(s.text)}</a></li>`).join('')}</ol></details></nav>
    <div class="prose" id="prose">${html}</div>
    <section class="sources" id="quellen"><h2>Quellen</h2><p class="muted">Originalquellen zur ${esc(EDITIONS[a.edition].long)}. Ein Quellenlink ersetzt keine Prüfung der Aussage.</p><ol>${a.sources.map(s => `<li id="quelle-${s.id}"><span class="src-n">${s.id}</span>${sourceHtml(s)}</li>`).join('')}</ol></section>
    <nav class="article-nav" aria-label="Weitere Ausgaben">${older ? `<a href="${articleUrl(older.id)}"><span class="lbl">← Vorherige Ausgabe</span>${esc(older.title)}</a>` : '<span></span>'}${newer ? `<a href="${articleUrl(newer.id)}"><span class="lbl">Nächste Ausgabe →</span>${esc(newer.title)}</a>` : ''}</nav>
  </article>`;
}
