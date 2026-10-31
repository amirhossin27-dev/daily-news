export async function cacheArticle(file, body) {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: 'CACHE_ARTICLE', file, body });
  } catch { /* Reading works without offline storage. */ }
}
export async function setupOffline(notify) {
  let installPrompt = null;
  const installButton = () => {
    const button = document.getElementById('installApp'); if (!button || !installPrompt) return;
    button.hidden = false;
    button.onclick = async () => { const prompt = installPrompt; installPrompt = null; button.hidden = true; await prompt.prompt(); await prompt.userChoice; };
  };
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; installButton(); });
  window.addEventListener('daily-brief-settings', installButton);
  window.addEventListener('appinstalled', () => { installPrompt = null; const b = document.getElementById('installApp'); if (b) b.hidden = true; });
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  try {
    const registration = await navigator.serviceWorker.register(new URL('../sw.js', import.meta.url), { scope: new URL('../', import.meta.url).pathname });
    let reloading = false;
    const showUpdate = () => {
      if (!registration.waiting || !navigator.serviceWorker.controller) return;
      document.getElementById('updateNotice').hidden = false;
      document.getElementById('applyUpdate').onclick = () => { reloading = true; registration.waiting?.postMessage({ type: 'SKIP_WAITING' }); };
    };
    registration.addEventListener('updatefound', () => { const worker = registration.installing; worker?.addEventListener('statechange', () => { if (worker.state === 'installed') showUpdate(); }); });
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) location.reload(); });
    navigator.serviceWorker.addEventListener('message', event => { if (event.data?.type === 'CACHE_ERROR') notify('Diese Ausgabe konnte nicht offline gespeichert werden. Prüfe den freien Gerätespeicher.'); });
    showUpdate();
  } catch { notify('Offline-Einrichtung ist in diesem Browser gerade nicht möglich. Online kannst du weiter lesen.'); }
}
