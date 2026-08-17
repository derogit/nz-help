/**
 * NZ Help — entry point.
 * Runs after all core files and modules have registered themselves.
 */
(async () => {
  'use strict';

  const NZ = globalThis.NZ;

  // Only the top document gets the toolbar; framed journal pages stay untouched.
  if (window.top !== window.self) return;

  const ready = () =>
    document.readyState === 'loading'
      ? new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true }))
      : Promise.resolve();

  await ready();

  try {
    await NZ.storage.importLegacyCookies();
  } catch (error) {
    NZ.utils.warn('Імпорт старих налаштувань не вдався', error);
  }

  // Version first: it tells at a glance whether the page runs the reloaded build.
  NZ.utils.log(`версія ${chrome.runtime.getManifest().version}`);

  const started = await NZ.registry.run();
  NZ.utils.log(`активні модулі: ${started.join(', ') || 'немає для цієї сторінки'}`);
})();
