/**
 * Module: compact journal layout.
 * Injects the layout overrides and shortens two overlong column headers.
 */
(() => {
  'use strict';

  const NZ = globalThis.NZ;
  const { utils } = NZ;

  NZ.registry.register({
    id: 'site-tweaks',

    init() {
      utils.injectStylesheet('src/styles/site-tweaks.css');

      const headerCells = utils.qsa('.homework-row--header .homework__item');
      if (headerCells[2]) headerCells[2].textContent = '№';
      if (headerCells[3]) headerCells[3].textContent = 'Дз';
    },
  });
})();
