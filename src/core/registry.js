/**
 * NZ Help — module registry.
 *
 * A module is a plain object:
 *   {
 *     id: 'lesson-cleanup',            // must exist in src/core/catalog.js
 *     match: (page) => boolean,        // should this page get the feature?
 *     init: (page) => void | Promise   // build the UI, attach listeners
 *   }
 */
(() => {
  'use strict';

  const NZ = (globalThis.NZ = globalThis.NZ || {});
  const { utils } = NZ;

  const modules = [];

  NZ.registry = {
    register(module) {
      if (!module?.id || typeof module.init !== 'function') {
        utils.warn('Модуль пропущено: потрібні поля id та init', module);
        return;
      }
      if (!NZ.catalogById(module.id)) {
        utils.warn(`Модуль "${module.id}" відсутній у каталозі (src/core/catalog.js)`);
        return;
      }
      modules.push(module);
    },

    /** Describe the current page once, so modules don't parse the URL themselves. */
    page() {
      const params = new URLSearchParams(location.search);
      return {
        url: location.href,
        path: location.pathname,
        params,
        param: (name) => params.get(name),
        journalId: params.get('journal'),
        scheduleId: params.get('schedule'),
        has: (selector) => Boolean(document.querySelector(selector)),
      };
    },

    /** Start every enabled module whose match() accepts this page. */
    async run() {
      const page = NZ.registry.page();
      const enabled = { ...NZ.catalogDefaults(), ...(await NZ.storage.get(NZ.storage.KEYS.modules, {})) };
      const started = [];

      for (const module of modules) {
        if (enabled[module.id] === false) continue;

        let matches = true;
        try {
          matches = module.match ? Boolean(module.match(page)) : true;
        } catch (error) {
          utils.error(`Помилка перевірки сторінки в модулі "${module.id}"`, error);
          matches = false;
        }
        if (!matches) continue;

        try {
          await module.init(page);
          started.push(module.id);
        } catch (error) {
          utils.error(`Модуль "${module.id}" не запустився`, error);
        }
      }

      return started;
    },
  };
})();
