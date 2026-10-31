import { signature } from './utils.js';
export function splitText(text) {
  const sentences = typeof Intl.Segmenter === 'function' ? Array.from(new Intl.Segmenter('de', { granularity: 'sentence' }).segment(text), x => x.segment) : text.match(/[^.!?]+[.!?]+\s*|[^.!?]+$/g) || [text];
  const chunks = []; let chunk = '';
  for (const sentence of sentences) {
    if (chunk.length + sentence.length > 220 && chunk) { chunks.push(chunk.trim()); chunk = ''; }
    // Unusually long sentences still need bounded utterances.
    const words = sentence.split(/\s+/);
    for (const word of words) { if (chunk.length + word.length > 260 && chunk) { chunks.push(chunk.trim()); chunk = ''; } chunk += word + ' '; }
  }
  if (chunk.trim()) chunks.push(chunk.trim()); return chunks;
}
export class SpeechPlayer {
  constructor(store, notify) {
    this.store = store; this.notify = notify; this.synth = window.speechSynthesis; this.supported = !!(this.synth && window.SpeechSynthesisUtterance); this.queue = []; this.pos = 0; this.generation = 0; this.playing = false;
    this.player = document.getElementById('player'); this.settings = document.getElementById('ttsSettings');
    this.playButton = document.getElementById('ttsPlay'); this.status = document.getElementById('ttsStatus'); this.voiceSelect = document.getElementById('ttsVoice');
    this.playButton.addEventListener('click', () => this.playing ? this.pause() : this.start());
    document.getElementById('ttsStop').addEventListener('click', () => this.stop());
    document.getElementById('ttsPrevious').addEventListener('click', () => this.jump(-1));
    document.getElementById('ttsNext').addEventListener('click', () => this.jump(1));
    document.getElementById('ttsSettingsBtn').addEventListener('click', e => { this.settings.hidden = !this.settings.hidden; e.currentTarget.setAttribute('aria-expanded', String(!this.settings.hidden)); });
    document.getElementById('ttsRate').addEventListener('change', e => { this.update({ rate: Number(e.target.value) }); if (this.playing) this.start(); });
    document.getElementById('ttsAuto').addEventListener('change', e => this.update({ auto: e.target.checked }));
    document.getElementById('ttsScroll').addEventListener('change', e => this.store.updateSettings({ autoScroll: e.target.checked }));
    this.voiceSelect.addEventListener('change', e => { this.update({ voice: e.target.value }); if (this.playing) this.start(); });
    if (this.supported) this.synth.addEventListener('voiceschanged', () => this.loadVoices());
    this.syncSettings();
    window.addEventListener('pagehide', () => this.pause());
  }
  update(patch) { this.store.updateSettings({ tts: { ...this.store.data.settings.tts, ...patch } }); this.syncSettings(); }
  syncSettings() {
    const s = this.store.data.settings;
    document.getElementById('ttsRate').value = s.tts.rate; document.getElementById('ttsAuto').checked = s.tts.auto; document.getElementById('ttsScroll').checked = s.autoScroll;
    this.loadVoices(); this.ui();
  }
  loadVoices() {
    this.voices = this.supported ? this.synth.getVoices().filter(v => /^de(?:-|_|$)/i.test(v.lang)) : [];
    this.voiceSelect.replaceChildren(new Option(this.voices.length ? 'Systemstimme (Deutsch)' : 'Systemstimme, sofern verfügbar', ''));
    this.voices.forEach(v => this.voiceSelect.add(new Option(v.name, v.name)));
    this.voiceSelect.value = this.voices.some(v => v.name === this.store.data.settings.tts.voice) ? this.store.data.settings.tts.voice : '';
    this.voiceSelect.disabled = !this.supported;
  }
  attach(root, article) {
    this.detach(); this.root = root; this.id = article.id;
    let section = 0, sectionName = 'Einleitung';
    const blocks = [...root.querySelectorAll('[data-tts]'), ...root.querySelectorAll('#prose h2, #prose h3, #prose p, #prose li, #prose tr')].filter(el => !el.parentElement.closest('li, tr'));
    for (const el of blocks) {
      if (/^H[23]$/.test(el.tagName)) { section++; sectionName = el.textContent; }
      const copy = el.cloneNode(true); copy.querySelectorAll('.cite').forEach(n => n.remove());
      let text = copy.textContent.replace(/\s+/g, ' ').trim();
      if (el.parentElement.classList.contains('callout')) text = `${el.parentElement.querySelector('.callout-label')?.textContent || ''}: ${text}`;
      for (const chunk of splitText(text)) this.queue.push({ text: chunk, el, section, sectionName });
    }
    this.signature = signature(this.queue.map(q => q.text).join('\n'));
    const saved = this.store.article(this.id).listen;
    this.pos = saved?.signature === this.signature ? Math.min(saved.index, Math.max(0, this.queue.length - 1)) : 0;
    this.player.hidden = false; document.body.classList.add('has-player');
    const cta = document.getElementById('listenCta'); if (cta) { cta.disabled = !this.supported; cta.addEventListener('click', () => this.start()); }
    this.player.querySelectorAll('[data-requires-speech]').forEach(b => { b.disabled = !this.supported; });
    this.ui(); if (this.store.data.settings.tts.auto && this.supported) this.start(true);
  }
  persist() { if (this.id && this.signature) this.store.updateArticle(this.id, { listen: { index: this.pos, signature: this.signature } }); }
  cancel() { this.generation++; this.synth?.cancel(); clearInterval(this.keepAlive); }
  start(auto = false) {
    if (!this.supported || !this.queue.length) { this.notify('Sprachausgabe ist hier nicht verfügbar. Du kannst den Artikel weiterhin lesen.'); return; }
    this.cancel(); this.playing = true; this.speak(auto);
    this.keepAlive = setInterval(() => { if (this.playing && !this.synth.speaking && !this.synth.pending) this.speak(auto); }, 5000);
  }
  speak(auto = false) {
    if (this.pos >= this.queue.length) { this.stop(); this.status.textContent = 'Fertig vorgelesen'; return; }
    const generation = ++this.generation, item = this.queue[this.pos], u = new SpeechSynthesisUtterance(item.text);
    u.lang = 'de-DE'; u.rate = this.store.data.settings.tts.rate;
    const voice = this.voices.find(v => v.name === this.store.data.settings.tts.voice); if (voice) u.voice = voice;
    u.onend = () => { if (generation === this.generation && this.playing) { this.pos++; this.persist(); this.speak(); } };
    u.onerror = e => {
      if (generation !== this.generation || ['interrupted', 'canceled'].includes(e.error)) return;
      this.playing = false; clearInterval(this.keepAlive); this.ui();
      this.notify(e.error === 'not-allowed' ? (auto ? 'Automatischer Start blockiert. Starte mit „Vorlesen“.' : 'Bitte starte das Vorlesen erneut per Tippen.') : 'Diese Stimme ist nicht verfügbar. Wähle eine andere Stimme oder lies den Text.');
    };
    this.root?.querySelectorAll('.reading').forEach(n => n.classList.remove('reading')); item.el.classList.add('reading');
    if (this.store.data.settings.autoScroll) {
      const r = item.el.getBoundingClientRect(); if (r.top < 100 || r.bottom > window.innerHeight - this.player.offsetHeight - 20) item.el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
    this.persist(); this.ui(); this.synth.speak(u);
  }
  pause() { this.cancel(); this.playing = false; this.persist(); this.ui(); }
  stop() { this.cancel(); this.playing = false; this.pos = 0; this.persist(); this.root?.querySelectorAll('.reading').forEach(n => n.classList.remove('reading')); this.ui(); }
  jump(direction) {
    if (!this.queue.length) return;
    const section = this.queue[Math.min(this.pos, this.queue.length - 1)].section;
    const groups = [...new Set(this.queue.map(q => q.section))]; const target = groups[Math.max(0, Math.min(groups.length - 1, groups.indexOf(section) + direction))];
    this.pos = this.queue.findIndex(q => q.section === target); this.persist(); if (this.playing) this.start(); else this.ui();
  }
  ui() {
    this.playButton.textContent = this.playing ? 'Ⅱ' : '▶'; this.playButton.setAttribute('aria-label', this.playing ? 'Vorlesen pausieren' : 'Vorlesen starten');
    const item = this.queue[Math.min(this.pos, Math.max(0, this.queue.length - 1))];
    this.status.textContent = !this.supported ? 'Dieser Browser bietet keine Sprachausgabe.' : `${this.playing ? 'Liest' : this.pos ? 'Fortsetzen' : 'Anhören'}${item ? ': ' + item.sectionName : ''}`;
    const progress = document.getElementById('ttsProgress'); progress.value = this.queue.length ? this.pos / this.queue.length : 0;
    document.getElementById('ttsPrevious').disabled = !this.supported || !item || item.section === 0;
    document.getElementById('ttsNext').disabled = !this.supported || !item || !this.queue.some(q => q.section > item.section);
  }
  detach() {
    this.pause(); this.root?.querySelectorAll('.reading').forEach(n => n.classList.remove('reading')); this.root = null; this.id = null; this.queue = []; this.pos = 0; this.signature = null;
    this.player.hidden = true; this.settings.hidden = true; document.getElementById('ttsSettingsBtn').setAttribute('aria-expanded', 'false'); document.body.classList.remove('has-player');
  }
}
