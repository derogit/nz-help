/**
 * Options page.
 * Renders the module catalog as toggles and lets the teacher clear stored data.
 */
(async () => {
  'use strict';

  const { utils, storage, catalog, catalogDefaults } = NZ;
  const { el } = utils;

  const enabled = { ...catalogDefaults(), ...(await storage.get(storage.KEYS.modules, {})) };

  document.getElementById('version').textContent = `Версія ${chrome.runtime.getManifest().version}`;

  /* --- module toggles ----------------------------------------------------- */

  function moduleRow(entry) {
    const checkbox = el('input', {
      type: 'checkbox',
      checked: enabled[entry.id] !== false,
      onChange: async (event) => {
        enabled[entry.id] = event.target.checked;
        await storage.set(storage.KEYS.modules, enabled);
      },
    });

    return el('div', { class: 'module' }, [
      el('p', { class: 'module__title', text: entry.title }),
      el('label', { class: 'switch' }, [checkbox, el('span', { class: 'switch__track' })]),
      el('p', { class: 'module__summary', text: entry.summary }),
      el('span', { class: 'module__where', text: entry.where }),
    ]);
  }

  const groups = new Map();
  for (const entry of catalog) {
    if (!groups.has(entry.group)) groups.set(entry.group, []);
    groups.get(entry.group).push(entry);
  }

  const groupsHost = document.getElementById('groups');
  for (const [group, entries] of groups) {
    groupsHost.append(
      el('section', { class: 'card' }, [
        el('p', { class: 'nz-eyebrow', text: group }),
        ...entries.map(moduleRow),
      ])
    );
  }

  /* --- stored data ------------------------------------------------------- */

  const DATA_ROWS = [
    {
      key: storage.KEYS.quickReplies,
      label: 'Швидкі відповіді',
      empty: [],
      count: (value) => `${(value || []).length} фраз`,
    },
    {
      key: storage.KEYS.studentColors,
      label: 'Кольорові позначки учнів',
      empty: {},
      count: (value) => `${Object.keys(value || {}).length} учнів`,
    },
  ];

  const dataHost = document.getElementById('data');

  for (const row of DATA_ROWS) {
    const value = await storage.get(row.key, row.empty);
    const counter = el('span', { class: 'data__count', text: row.count(value) });

    const clear = el(
      'button',
      {
        class: 'nz-btn',
        type: 'button',
        onClick: async () => {
          await storage.set(row.key, row.empty);
          counter.textContent = row.count(row.empty);
        },
      },
      ['Очистити']
    );

    dataHost.append(
      el('div', { class: 'data__row' }, [
        el('div', {}, [el('span', { class: 'data__label', text: row.label }), el('br'), counter]),
        clear,
      ])
    );
  }
})();
