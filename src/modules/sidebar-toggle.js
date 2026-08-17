/**
 * Module: collapsible sidebar.
 * The site sidebar eats horizontal space that the journal grid needs, so it can
 * be collapsed to an icon rail. The choice is remembered across pages.
 */
(() => {
  'use strict';

  const NZ = globalThis.NZ;
  const { utils, storage, ui } = NZ;

  const COLLAPSED_WIDTH = '104px';

  NZ.registry.register({
    id: 'sidebar-toggle',

    match: (page) => page.has('.sidebar'),

    async init() {
      utils.injectStylesheet('src/styles/sidebar.css');

      const sidebar = utils.qs('.sidebar');
      const collapsed = await storage.get(storage.KEYS.sidebarCollapsed, true);

      const apply = (isCollapsed) => {
        sidebar.classList.toggle('nz-sidebar--collapsed', isCollapsed);
        // Expanded state keeps the site's own width — only collapsing overrides it.
        sidebar.style.width = isCollapsed ? COLLAPSED_WIDTH : '';
        toggle.textContent = isCollapsed ? '›' : '‹';
        toggle.title = isCollapsed ? 'Розгорнути меню' : 'Згорнути меню';
      };

      const toggle = ui.el('button', {
        class: 'nz-sidebar-toggle',
        type: 'button',
        onClick: async () => {
          const next = !sidebar.classList.contains('nz-sidebar--collapsed');
          apply(next);
          await storage.set(storage.KEYS.sidebarCollapsed, next);
        },
      });

      const logo = utils.qs('.sidebar .logo');
      logo ? logo.after(toggle) : sidebar.prepend(toggle);

      apply(collapsed);
    },
  });
})();
