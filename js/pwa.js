// ─── PWA ──────────────────────────────────────────────────────────────────────
// Service worker registration, install-to-home-screen prompt, and
// JSON export / import. Isolated so it can be tested or replaced without
// touching any game logic.

import { STORAGE_KEY } from './state.js';

export function initPWA() {
  let deferred;
  const installBtn = document.getElementById('pwa-install-btn');

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
    installBtn.hidden = false;
    installBtn.removeAttribute('aria-hidden');
  });

  installBtn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    installBtn.hidden = true;
    installBtn.setAttribute('aria-hidden', 'true');
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('pwa/service-worker.js').catch(() => {});
  }
}

export function initExportImport() {
  document.getElementById('export-btn').addEventListener('click', () => {
    try {
      const blob = new Blob(
        [localStorage.getItem(STORAGE_KEY) || '{}'],
        { type: 'application/json' }
      );
      const a = Object.assign(document.createElement('a'), {
        href:     URL.createObjectURL(blob),
        download: 'dnd-tracker-export.json',
      });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
  });

  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });

  document.getElementById('import-file').addEventListener('change', async ev => {
    const file = ev.target.files[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.characters)) throw new Error('Invalid format');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      location.reload();
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
  });
}