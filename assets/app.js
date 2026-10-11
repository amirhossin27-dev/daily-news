/* Daily Brief: Liste, Filter, Artikelansicht und Vorlesefunktion (Web Speech API). */
(function () {
  'use strict';

  var EDITIONS = {
    morgen: { name: 'Morgen', long: 'Morgenausgabe' },
    mittag: { name: 'Mittag', long: 'Mittagsausgabe' },
    abend: { name: 'Abend', long: 'Abendausgabe' }
  };

  // Feste Farben für bekannte Labels, alle anderen bekommen eine aus der Palette.
  var LABEL_COLORS = {
    'Wirtschaft': '#2f8f6a', 'Märkte': '#3a7bd5', 'Zinsen': '#5b6ee1', 'Deutschland': '#c9a227',
    'Krypto': '#e08a1e', 'Bitcoin': '#f7931a', 'Ethereum': '#7a7fe0', 'Hedera': '#555b66',
    'Iran': '#1d9a6c', 'USA': '#c73e4c', 'Naher Osten': '#b5651d', 'Israel': '#3b6fd8',
    'Energie': '#d1662b', 'Geopolitik': '#8a5cc2', 'KI': '#0fa3b1', 'Tech': '#4f7cac', 'Europa': '#2b59c3'
  };
  var PALETTE = ['#2f8f6a', '#3a7bd5', '#c73e4c', '#8a5cc2', '#d1662b', '#0fa3b1', '#b5651d', '#5b6ee1'];

  var CALLOUTS = {
    'GERÜCHT': { cls: 'geruecht', label: 'Social Media · unbestätigt' },
    'GERUECHT': { cls: 'geruecht', label: 'Social Media · unbestätigt' },
    'SOCIAL': { cls: 'social', label: 'Social Media · Inhalt belegt' },
    'SPEKULATION': { cls: 'spekulation', label: 'Spekulation' },
    'LERNEN': { cls: 'lernen', label: 'Zum Lernen' },
    'FRAGE': { cls: 'frage', label: 'Zum Nachdenken' },
    'EINORDNUNG': { cls: 'einordnung', label: 'Einordnung' }
  };

  var SOURCE_TYPES = {
    news: 'Nachrichten', official: 'Offiziell', data: 'Daten', analysis: 'Analyse',
    x: 'X', reddit: 'Reddit', social: 'Social Media', video: 'Video', podcast: 'Podcast'
  };

  var view = document.getElementById('view');
  var state = { articles: [], loaded: false, error: null, labels: new Set(), edition: 'alle', q: '' };

  /* ---------- Hilfen ---------- */

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function parseDate(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  var fmtLong = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  var fmtShort = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });

  function dayLabel(dateStr) {
    var today = new Date(); var y = new Date(); y.setDate(today.getDate() - 1);
    if (dateStr === ymd(today)) return 'Heute · ' + fmtShort.format(parseDate(dateStr));
    if (dateStr === ymd(y)) return 'Gestern · ' + fmtShort.format(parseDate(dateStr));
    return fmtLong.format(parseDate(dateStr));
  }

  function labelColor(name) {
    if (LABEL_COLORS[name]) return LABEL_COLORS[name];
    var h = 0; for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }

  function chip(name, opts) {
    opts = opts || {};
    var tag = opts.href ? 'a' : opts.plain ? 'span' : 'button';
    var attrs = opts.href ? ' href="' + esc(opts.href) + '"' : opts.plain ? '' : ' type="button" aria-pressed="' + (opts.pressed ? 'true' : 'false') + '" data-label="' + esc(name) + '"';
    return '<' + tag + ' class="chip' + (opts.small ? ' small' : '') + '"' + attrs + ' style="--c:' + labelColor(name) + '">' +
      '<span class="dot"></span>' + esc(name) + (opts.count != null ? ' <span class="count">' + opts.count + '</span>' : '') + '</' + tag + '>';
  }

  function editionBadge(a) {
    var e = EDITIONS[a.edition] || { name: a.edition };
    return '<span class="edition">' + esc(e.name) + (a.time ? ' · ' + esc(a.time) + ' Uhr' : '') + '</span>';
  }

  function toast(msg, ms) {
    var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, ms || 3500);
  }

  /* ---------- Daten ---------- */

  function loadIndex() {
    return fetch('articles/index.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        state.articles = (data.articles || []).slice().sort(function (a, b) {
          return (b.date + (b.time || '')).localeCompare(a.date + (a.time || ''));
        });
        state.loaded = true;
      })
      .catch(function (e) { state.error = e; state.loaded = true; });
  }

  /* ---------- Startseite ---------- */

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return state.articles.filter(function (a) {
      if (state.edition !== 'alle' && a.edition !== state.edition) return false;
      if (state.labels.size && !a.labels.some(function (l) { return state.labels.has(l); })) return false;
      if (q) {
        var hay = (a.title + ' ' + a.summary + ' ' + a.labels.join(' ')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function renderHome() {
    if (state.error) {
      view.innerHTML = '<div class="empty">Die Artikel konnten nicht geladen werden. Bitte später erneut versuchen.</div>';
      return;
    }
    var counts = {};
    state.articles.forEach(function (a) { a.labels.forEach(function (l) { counts[l] = (counts[l] || 0) + 1; }); });
    var labelNames = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b, 'de'); });

    var html = '<section class="intro"><h1>Das Wichtigste des Tages.</h1>' +
      '<p>Dreimal täglich eine kompakte Lage: Wirtschaft, Krypto, Iran, USA und Naher Osten. Mit Quellen, klar gekennzeichneten Gerüchten und etwas zum Nachdenken.</p></section>';

    html += '<section class="filters" aria-label="Filter">' +
      '<div class="filter-row">' +
        '<label class="search"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
        '<input id="q" type="search" placeholder="Suchen…" aria-label="Artikel durchsuchen" value="' + esc(state.q) + '"></label>' +
        '<div class="seg" role="group" aria-label="Ausgabe">' +
          ['alle', 'morgen', 'mittag', 'abend'].map(function (e) {
            return '<button type="button" data-edition="' + e + '" aria-pressed="' + (state.edition === e) + '">' + (e === 'alle' ? 'Alle' : EDITIONS[e].name) + '</button>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div class="chips" role="group" aria-label="Themen">' +
        labelNames.map(function (l) { return chip(l, { pressed: state.labels.has(l), count: counts[l] }); }).join('') +
        (state.labels.size ? '<button type="button" class="clear-btn" id="clearLabels">Filter zurücksetzen</button>' : '') +
      '</div>' +
    '</section>';

    html += '<div id="list"></div>';
    view.innerHTML = html;
    renderList();

    var q = document.getElementById('q');
    q.addEventListener('input', function () { state.q = q.value; renderList(); });
    view.querySelectorAll('[data-edition]').forEach(function (b) {
      b.addEventListener('click', function () { state.edition = b.dataset.edition; saveFilters(); renderHome(); });
    });
    view.querySelectorAll('.chips [data-label]').forEach(function (b) {
      b.addEventListener('click', function () {
        var l = b.dataset.label;
        if (state.labels.has(l)) state.labels.delete(l); else state.labels.add(l);
        saveFilters(); renderHome();
      });
    });
    var clr = document.getElementById('clearLabels');
    if (clr) clr.addEventListener('click', function () { state.labels.clear(); saveFilters(); renderHome(); });
  }

  function renderList() {
    var list = document.getElementById('list');
    var items = filtered();
    if (!state.articles.length) { list.innerHTML = '<div class="empty">Noch keine Artikel. Die erste Ausgabe folgt in Kürze.</div>'; return; }
    if (!items.length) { list.innerHTML = '<div class="empty">Keine Artikel für diese Auswahl.</div>'; return; }
    var isUnfiltered = !state.labels.size && state.edition === 'alle' && !state.q.trim();
    var groups = []; var byDate = {};
    items.forEach(function (a) {
      if (!byDate[a.date]) { byDate[a.date] = []; groups.push(a.date); }
      byDate[a.date].push(a);
    });
    list.innerHTML = groups.map(function (d, gi) {
      return '<section class="day"><h2 class="day-head">' + esc(dayLabel(d)) + '</h2><div class="cards">' +
        byDate[d].map(function (a, i) { return card(a, isUnfiltered && gi === 0 && i === 0); }).join('') +
        '</div></section>';
    }).join('');
  }

  function card(a, hero) {
    return '<a class="card' + (hero ? ' hero' : '') + '" href="#/artikel/' + encodeURIComponent(a.id) + '">' +
      '<div class="meta">' + editionBadge(a) + '<span>' + a.reading_minutes + ' Min. Lesezeit</span><span>· ' + a.sources.length + ' Quellen</span></div>' +
      '<h2>' + esc(a.title) + '</h2><p>' + esc(a.summary) + '</p>' +
      '<div class="labels">' + a.labels.map(function (l) { return chip(l, { small: true, plain: true }); }).join('') + '</div>' +
    '</a>';
  }

  // Filter gelten nur für die aktuelle Sitzung, damit beim nächsten Besuch wieder alles sichtbar ist.
  function saveFilters() {
    try { sessionStorage.setItem('db-filters', JSON.stringify({ labels: Array.from(state.labels), edition: state.edition })); } catch (e) {}
  }
  function loadFilters() {
    var f = null; try { f = JSON.parse(sessionStorage.getItem('db-filters')); } catch (e) {}
    if (f) { state.labels = new Set(f.labels || []); state.edition = f.edition || 'alle'; }
  }

  /* ---------- Artikel ---------- */

  function stripFrontmatter(md) {
    if (md.slice(0, 3) !== '---') return md;
    var end = md.indexOf('\n---', 3);
    return end === -1 ? md : md.slice(md.indexOf('\n', end + 1) + 1);
  }

  function linkCitations(md) {
    // [1] oder [1, 3] (nicht Teil eines Markdown-Links) wird zu hochgestellten Quellenlinks.
    return md.replace(/[ \t]*\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\](?!\(|\[|:\s*https?:)/g, function (_, nums) {
      return '<sup class="cite">' + nums.split(/\s*,\s*/).map(function (n) {
        return '<a href="#quelle-' + n + '" data-src="' + n + '" aria-label="Quelle ' + n + '">' + n + '</a>';
      }).join(',') + '</sup>';
    });
  }

  function decorateCallouts(root) {
    root.querySelectorAll('blockquote').forEach(function (bq) {
      var p = bq.querySelector('p'); if (!p || !p.firstChild || p.firstChild.nodeType !== 3) return;
      var m = p.firstChild.nodeValue.match(/^\s*\[!([A-ZÄÖÜ]+)\]\s*/);
      if (!m) return;
      var type = CALLOUTS[m[1]]; if (!type) return;
      p.firstChild.nodeValue = p.firstChild.nodeValue.slice(m[0].length);
      bq.classList.add('callout', 'callout-' + type.cls);
      var lab = document.createElement('span'); lab.className = 'callout-label'; lab.textContent = type.label;
      bq.insertBefore(lab, bq.firstChild);
    });
    root.querySelectorAll('a[href^="http"]').forEach(function (a) { a.target = '_blank'; a.rel = 'noopener'; });
  }

  function renderArticle(id) {
    var idx = state.articles.findIndex(function (a) { return a.id === id; });
    var a = state.articles[idx];
    if (!a) { view.innerHTML = '<div class="empty">Artikel nicht gefunden. <a href="#/">Zur Übersicht</a></div>'; return; }
    view.innerHTML = '<div class="empty">Lade Artikel…</div>';

    fetch('articles/' + a.file, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (md) {
        var body = DOMPurify.sanitize(marked.parse(linkCitations(stripFrontmatter(md)), { gfm: true }));
        var hasCrypto = a.labels.some(function (l) { return ['Krypto', 'Bitcoin', 'Ethereum', 'Hedera'].indexOf(l) !== -1; });
        var newer = state.articles[idx - 1], older = state.articles[idx + 1];
        var e = EDITIONS[a.edition] || { long: a.edition };

        view.innerHTML = '<article class="article">' +
          '<a class="back" href="#/"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>Alle Ausgaben</a>' +
          '<header class="article-head">' +
            '<div class="meta">' + editionBadge(a) + '<span>' + esc(fmtLong.format(parseDate(a.date))) + '</span><span>· ' + a.reading_minutes + ' Min.</span></div>' +
            '<h1 data-tts>' + esc(a.title) + '</h1>' +
            '<p class="lede" data-tts>' + esc(a.summary) + '</p>' +
            '<div class="labels">' + a.labels.map(function (l) { return chip(l, { small: true, href: '#/?label=' + encodeURIComponent(l) }); }).join('') + '</div>' +
            '<button class="listen-cta" type="button" id="listenCta"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>Artikel anhören</button>' +
            (hasCrypto ? '<p class="notice">Keine Anlageberatung. Kursangaben und Einschätzungen zu Kryptowährungen dienen nur der Information.</p>' : '') +
          '</header>' +
          '<div class="prose" id="prose">' + body + '</div>' +
          '<section class="sources" id="quellen"><h2>Quellen</h2><p class="muted">' + esc(e.long) + ' vom ' + esc(fmtLong.format(parseDate(a.date))) + '. Zahlen und Zitate stammen aus diesen Quellen; Einordnungen sind als solche markiert.</p><ol>' +
            a.sources.map(function (s) {
              var host = ''; try { host = new URL(s.url).hostname.replace(/^www\./, ''); } catch (err) {}
              return '<li id="quelle-' + esc(s.id) + '"><span class="src-n">' + esc(s.id) + '</span><div>' +
                '<a class="src-title" href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.title) + '</a>' +
                '<div class="src-meta"><span class="src-type t-' + esc(s.type) + '">' + esc(SOURCE_TYPES[s.type] || s.type) + '</span>' +
                '<span>' + esc(s.publisher || host) + '</span>' + (s.date ? '<span>· ' + esc(s.date) + '</span>' : '') + '</div></div></li>';
            }).join('') +
          '</ol></section>' +
          '<nav class="article-nav">' +
            (older ? '<a href="#/artikel/' + encodeURIComponent(older.id) + '"><span class="lbl">← Vorherige Ausgabe</span>' + esc(older.title) + '</a>' : '<span></span>') +
            (newer ? '<a class="next" href="#/artikel/' + encodeURIComponent(newer.id) + '"><span class="lbl">Nächste Ausgabe →</span>' + esc(newer.title) + '</a>' : '<span></span>') +
          '</nav>' +
        '</article>';

        var prose = document.getElementById('prose');
        decorateCallouts(prose);
        document.title = a.title + ' · Daily Brief';
        document.getElementById('listenCta').addEventListener('click', function () { tts.start(); });
        tts.attach(view.querySelector('.article'), a);
        if (tts.settings.auto) tts.start(true);
      })
      .catch(function () {
        view.innerHTML = '<div class="empty">Der Artikel konnte nicht geladen werden. <a href="#/">Zur Übersicht</a></div>';
      });
  }

  /* ---------- Info ---------- */

  function renderInfo() {
    view.innerHTML = '<div class="info"><a class="back" href="#/">← Alle Ausgaben</a><h1>Über den Daily Brief</h1><div class="prose">' +
      '<p>Der Daily Brief fasst dreimal täglich das Wichtigste zusammen: <strong>morgens um 7 Uhr, mittags um 12 Uhr und abends um 18 Uhr</strong> (deutsche Zeit). Schwerpunkte sind Wirtschaft und Märkte, Krypto (Bitcoin, Ethereum, Hedera), Iran, die USA und der Nahe Osten.</p>' +
      '<h2>Regeln für jeden Artikel</h2><ul>' +
      '<li>Jede Aussage mit Zahl, Zitat oder Ereignis ist mit einer Quelle belegt. Die hochgestellten Zahlen führen zur Quellenliste.</li>' +
      '<li>Virale Beiträge aus X oder Reddit stehen in rosa Kästen und gelten als <strong>unbestätigt</strong>, bis seriöse Quellen sie bestätigen.</li>' +
      '<li>Spekulation und eigene Einordnung sind eigens markiert und von Fakten getrennt.</li>' +
      '<li>Weniger ist mehr: höchstens drei bis vier Themen pro Ausgabe, dazu ein Gedanke zum Nachdenken und ein Begriff zum Lernen.</li>' +
      '<li>Keine Anlageberatung. Kursbewegungen werden berichtet und erklärt, nicht empfohlen.</li></ul>' +
      '<h2>Vorlesen</h2><p>Jeder Artikel kann vorgelesen werden. Die Geschwindigkeit stellst du in der Leiste unten ein (0,5× bis 2×). Unter den Einstellungen kannst du eine Stimme wählen und das automatische Vorlesen beim Öffnen eines Artikels einschalten. Die Stimmen kommen von deinem Gerät; auf manchen Browsern muss das erste Vorlesen per Tippen gestartet werden.</p>' +
      '<h2>Wer schreibt hier?</h2><p>Die Artikel recherchiert und schreibt Claude, ein KI-Assistent, für Amir. KI kann Fehler machen. Bei wichtigen Entscheidungen bitte die verlinkten Originalquellen lesen.</p>' +
      '</div></div>';
  }

  /* ---------- Vorlesen ---------- */

  var tts = (function () {
    var synth = window.speechSynthesis;
    var supported = !!(synth && window.SpeechSynthesisUtterance);
    var settings = store.get('db-tts', { rate: 1, auto: false, voice: '' });
    var player = document.getElementById('player');
    var btnPlay = document.getElementById('ttsPlay');
    var btnStop = document.getElementById('ttsStop');
    var status = document.getElementById('ttsStatus');
    var progress = document.getElementById('ttsProgress');
    var rate = document.getElementById('ttsRate');
    var rateVal = document.getElementById('ttsRateVal');
    var auto = document.getElementById('ttsAuto');
    var voiceSel = document.getElementById('ttsVoice');
    var settingsBtn = document.getElementById('ttsSettingsBtn');
    var settingsBox = document.getElementById('ttsSettings');

    var queue = [], pos = 0, playing = false, gen = 0, voices = [], keepAlive = null, root = null;

    function save() { store.set('db-tts', settings); }
    function fmtRate(r) { return r.toFixed(1).replace('.', ',') + '×'; }

    rate.value = settings.rate; rateVal.textContent = fmtRate(+settings.rate); auto.checked = !!settings.auto;

    function loadVoices() {
      if (!supported) return;
      var all = synth.getVoices();
      var de = all.filter(function (v) { return /^de(-|_|$)/i.test(v.lang); });
      voices = de.length ? de : all;
      voiceSel.innerHTML = voices.map(function (v) {
        return '<option value="' + esc(v.name) + '">' + esc(v.name.replace(/^(Microsoft|Google)\s+/, '')) + ' (' + esc(v.lang) + ')</option>';
      }).join('') || '<option>Keine Stimme gefunden</option>';
      var chosen = currentVoice();
      if (chosen) voiceSel.value = chosen.name;
    }

    function currentVoice() {
      if (!voices.length) return null;
      var byName = voices.find(function (v) { return v.name === settings.voice; });
      if (byName) return byName;
      var pref = [/google.*deutsch/i, /neural|natural|online/i, /anna|katja|petra|helena|marlene|vicki/i];
      for (var i = 0; i < pref.length; i++) {
        var hit = voices.find(function (v) { return pref[i].test(v.name) && /^de/i.test(v.lang); });
        if (hit) return hit;
      }
      return voices.find(function (v) { return /^de-DE/i.test(v.lang); }) || voices[0];
    }

    function splitText(text) {
      // Lange Absätze in Sätze zerlegen: kurze Stücke laufen in allen Browsern stabil.
      var parts = text.match(/[^.!?…]+[.!?…]+["“”»«)]*\s*|[^.!?…]+$/g) || [text];
      var out = [], cur = '';
      parts.forEach(function (p) {
        if ((cur + p).length > 180 && cur) { out.push(cur.trim()); cur = ''; }
        cur += p;
      });
      if (cur.trim()) out.push(cur.trim());
      return out;
    }

    function blockText(el) {
      var c = el.cloneNode(true);
      c.querySelectorAll('.cite').forEach(function (n) { n.remove(); });
      var lab = c.querySelector('.callout-label'); if (lab) lab.textContent = lab.textContent + ': ';
      if (el.tagName === 'TR') return Array.from(c.children).map(function (td) { return td.textContent.trim(); }).filter(Boolean).join(', ') + '.';
      return c.textContent.replace(/\s+/g, ' ').trim();
    }

    function build(articleEl) {
      var prose = articleEl.querySelector('.prose');
      var blocks = Array.from(articleEl.querySelectorAll('[data-tts]'));
      var sel = Array.from(prose.querySelectorAll('h2, h3, p, li, tr, blockquote'));
      sel = sel.filter(function (el) {
        if (el.tagName === 'BLOCKQUOTE') return false;
        var p = el.parentElement;
        while (p && p !== prose) { if (/^(LI|TR)$/.test(p.tagName)) return false; p = p.parentElement; }
        return true;
      });
      blocks = blocks.concat(sel);
      var q = [];
      blocks.forEach(function (el) {
        var t = blockText(el);
        if (!t) return;
        if (/^H[1-3]$/.test(el.tagName) && !/[.!?:]$/.test(t)) t += '.';
        splitText(t).forEach(function (s) { q.push({ el: el, text: s, head: /^H[23]$/.test(el.tagName) ? t : null }); });
      });
      q.push({ el: articleEl.querySelector('.sources h2'), text: 'Ende des Artikels. Die Quellen findest du unter dem Text.' });
      return q;
    }

    function section(i) {
      for (var k = i; k >= 0; k--) if (queue[k].head) return queue[k].head.replace(/\.$/, '');
      return 'Einleitung';
    }

    function mark(i) {
      if (root) root.querySelectorAll('.reading').forEach(function (n) { n.classList.remove('reading'); });
      var item = queue[i]; if (!item || !item.el) return;
      item.el.classList.add('reading');
      var r = item.el.getBoundingClientRect();
      if (r.top < 80 || r.bottom > window.innerHeight - 110) item.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function ui() {
      player.classList.toggle('playing', playing);
      btnPlay.setAttribute('aria-label', playing ? 'Vorlesen pausieren' : 'Vorlesen starten');
      progress.style.width = queue.length ? Math.round((pos / queue.length) * 100) + '%' : '0';
      if (!supported) status.textContent = 'Vorlesen wird von diesem Browser nicht unterstützt';
      else if (playing) status.textContent = 'Liest: ' + section(pos);
      else if (pos > 0 && pos < queue.length) status.textContent = 'Pausiert · ' + section(pos);
      else status.textContent = 'Anhören';
    }

    function speak(i, silentFail) {
      if (i >= queue.length) { stop(true); return; }
      pos = i; var my = ++gen;
      var u = new SpeechSynthesisUtterance(queue[i].text);
      var v = currentVoice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'de-DE';
      u.rate = +settings.rate;
      u.onend = function () { if (my === gen && playing) speak(i + 1); };
      u.onerror = function (ev) {
        if (my !== gen) return;
        if (ev.error === 'interrupted' || ev.error === 'canceled') return;
        playing = false; ui();
        if (ev.error === 'not-allowed') toast(silentFail ? 'Automatisches Vorlesen blockiert: tippe auf ▶.' : 'Tippe auf ▶, um das Vorlesen zu starten.');
        else toast('Vorlesen nicht möglich (' + ev.error + ').');
      };
      mark(i); ui();
      synth.speak(u);
    }

    function start(fromAuto) {
      if (!supported) { toast('Dein Browser unterstützt keine Sprachausgabe.'); return; }
      if (!queue.length) return;
      synth.cancel();
      playing = true;
      if (pos >= queue.length) pos = 0;
      speak(pos, fromAuto);
      // Chrome beendet lange Sitzungen manchmal still; ein leichter Anstoß hält sie wach.
      clearInterval(keepAlive);
      keepAlive = setInterval(function () { if (playing && !synth.speaking && !synth.pending) { synth.cancel(); speak(pos); } }, 4000);
    }

    function pause() {
      playing = false; gen++; synth.cancel(); clearInterval(keepAlive); ui();
    }

    function stop(finished) {
      playing = false; gen++; if (supported) synth.cancel(); clearInterval(keepAlive);
      pos = 0;
      if (root) root.querySelectorAll('.reading').forEach(function (n) { n.classList.remove('reading'); });
      ui();
      if (finished === true) status.textContent = 'Fertig vorgelesen';
    }

    btnPlay.addEventListener('click', function () { playing ? pause() : start(); });
    btnStop.addEventListener('click', function () { stop(); });
    rate.addEventListener('input', function () {
      settings.rate = +rate.value; rateVal.textContent = fmtRate(settings.rate); save();
    });
    rate.addEventListener('change', function () { if (playing) { synth.cancel(); speak(pos); } });
    auto.addEventListener('change', function () { settings.auto = auto.checked; save(); });
    voiceSel.addEventListener('change', function () {
      settings.voice = voiceSel.value; save(); if (playing) { synth.cancel(); speak(pos); }
    });
    settingsBtn.addEventListener('click', function () {
      var open = settingsBox.hidden; settingsBox.hidden = !open; settingsBtn.setAttribute('aria-expanded', String(open));
    });

    if (supported) { loadVoices(); if ('onvoiceschanged' in synth) synth.onvoiceschanged = loadVoices; }

    return {
      settings: settings,
      start: start,
      stop: stop,
      attach: function (articleEl) {
        stop(); root = articleEl; queue = build(articleEl); pos = 0;
        player.hidden = false; document.body.classList.add('has-player'); ui();
      },
      detach: function () {
        stop(); root = null; queue = [];
        player.hidden = true; settingsBox.hidden = true; document.body.classList.remove('has-player');
      }
    };
  })();

  /* ---------- Router ---------- */

  function route() {
    var h = location.hash || '#/';
    if (h.indexOf('#/') !== 0) return; // Sprungmarken innerhalb der Seite
    tts.detach();
    document.title = 'Daily Brief';
    var m;
    if ((m = h.match(/^#\/artikel\/(.+)$/))) { renderArticle(decodeURIComponent(m[1])); window.scrollTo(0, 0); return; }
    if (h === '#/info') { renderInfo(); window.scrollTo(0, 0); return; }
    if ((m = h.match(/[?&]label=([^&]+)/))) {
      state.labels = new Set([decodeURIComponent(m[1])]); saveFilters();
      history.replaceState(null, '', '#/');
    }
    renderHome();
  }

  // Quellenverweise im Text springen zur Quelle, ohne den Router auszulösen.
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[href^="#quelle-"]');
    if (!a) return;
    ev.preventDefault();
    var t = document.getElementById(a.getAttribute('href').slice(1));
    if (!t) return;
    t.scrollIntoView({ behavior: 'smooth', block: 'center' });
    t.style.borderColor = 'var(--accent)'; t.style.boxShadow = '0 0 0 3px var(--accent-soft)';
    setTimeout(function () { t.style.borderColor = ''; t.style.boxShadow = ''; }, 2200);
  });

  document.getElementById('themeToggle').addEventListener('click', function () {
    var root = document.documentElement;
    var dark = root.dataset.theme ? root.dataset.theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('db-theme', root.dataset.theme); } catch (e) {}
  });

  window.addEventListener('hashchange', route);
  loadFilters();
  loadIndex().then(route);
})();
