/**
 * NZ Help — demo mode, early half.
 *
 * Runs at document_start, before the journal is painted, and puts the
 * .nz-marks-hidden class on <html> when the teacher left the mode on. Without it
 * every page load would show the marks for a moment until the main bundle runs.
 * The rest (toggle, indicator, shortcut) lives in src/modules/marks-hidden.js.
 *
 * The core is not loaded yet, so storage is read directly — keep the key names
 * and areas in step with NZ.storage.KEYS, and the default with the catalog entry.
 */
(() => {
  'use strict';

  if (window.top !== window.self) return;

  const MODULE_ID = 'marks-hidden';

  Promise.all([chrome.storage.local.get('marksHidden'), chrome.storage.sync.get('modules')])
    .then(([local, sync]) => {
      // Only toggled modules are saved, so a missing entry means "on by default".
      const enabled = (sync.modules || {})[MODULE_ID] !== false;
      if (enabled && local.marksHidden === true) {
        document.documentElement.classList.add('nz-marks-hidden');
      }
    })
    .catch(() => {
      // The module re-applies the state once the page is ready.
    });
})();
