import { parseRoute } from './utils.js';
export class Router {
  constructor(render) {
    this.render = render; this.positions = new Map(); this.current = ''; this.articleReturn = '#/';
    window.addEventListener('hashchange', () => this.dispatch());
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#/"]');
      if (a && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) this.remember();
    });
    window.addEventListener('pagehide', () => this.remember());
  }
  remember(extra = {}) {
    if (!this.current) return;
    this.positions.set(this.current, { y: window.scrollY, ...this.positions.get(this.current), ...extra });
    this.positions.get(this.current).y = window.scrollY;
    if (['home', 'archive', 'learning'].includes(parseRoute(this.current).page)) this.articleReturn = this.current;
  }
  async dispatch() {
    const hash = location.hash || '#/';
    if (!hash.startsWith('#/')) return;
    this.current = hash;
    const route = parseRoute(hash), position = this.positions.get(hash);
    await this.render(route, position);
  }
}
