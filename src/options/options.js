/**
 * Options page.
 * Renders the module catalog as toggles and lets the teacher clear stored data.
 */
(async () => {
  'use strict';

  const { utils, storage, catalog, catalogDefaults, settings, changelog = [], changelogUrl } = NZ;
  const { el } = utils;

  const enabled = { ...catalogDefaults(), ...(await storage.get(storage.KEYS.modules, {})) };
  const values = { ...(await storage.get(storage.KEYS.moduleSettings, {})) };

  document.getElementById('version').textContent = `Версія ${chrome.runtime.getManifest().version}`;

  /* --- what's new --------------------------------------------------------- */

  if (changelog.length) {
    const format = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });

    const release = (entry) =>
      el('div', { class: 'release' }, [
        el('p', { class: 'release__head' }, [
          el('span', { class: 'release__version', text: entry.version }),
          el('span', { class: 'release__date', text: format.format(new Date(`${entry.date}T00:00:00`)) }),
        ]),
        el('ul', { class: 'release__list' }, entry.changes.map((text) => el('li', { text }))),
      ]);

    const [latest, ...older] = changelog;

    const parts = [
      el('p', { class: 'nz-eyebrow', text: 'Що нового' }),
      release(latest),
      older.length
        ? el('details', { class: 'release__older' }, [
            el('summary', { text: 'Попередні версії' }),
            ...older.map(release),
          ])
        : null,
      changelogUrl
        ? el('a', {
            class: 'release__link',
            href: changelogUrl,
            target: '_blank',
            rel: 'noopener',
            text: 'Усі зміни на GitHub',
          })
        : null,
    ].filter(Boolean);

    const whatsNew = document.getElementById('whats-new');
    whatsNew.append(...parts);
    whatsNew.hidden = false;
  }

  /* --- module toggles ----------------------------------------------------- */

  /** One catalog-declared option of a module: label, control, hint under it. */
  function settingRow(entry, setting) {
    const control = el('input', {
      class: 'setting__control',
      type: setting.type === 'number' ? 'number' : 'text',
      min: setting.min === undefined ? null : String(setting.min),
      max: setting.max === undefined ? null : String(setting.max),
      value: String(settings.coerce(setting, values[entry.id]?.[setting.id])),
      onChange: async (event) => {
        // Whatever was typed comes back through the catalog, so the field always
        // shows the value the module will actually use.
        const value = settings.coerce(setting, event.target.value);
        event.target.value = String(value);
        values[entry.id] = { ...(values[entry.id] || {}), [setting.id]: value };
        await storage.set(storage.KEYS.moduleSettings, values);
      },
    });

    return el('div', { class: 'setting' }, [
      el('label', { class: 'setting__head' }, [
        el('span', { class: 'setting__label', text: setting.label }),
        control,
      ]),
      setting.hint ? el('span', { class: 'setting__hint', text: setting.hint }) : null,
    ]);
  }

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
      entry.settings
        ? el('div', { class: 'module__settings' }, entry.settings.map((setting) => settingRow(entry, setting)))
        : null,
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
      key: storage.KEYS.lessonPlans,
      label: 'Заплановані теми і ДЗ',
      empty: {},
      count: (value) =>
        `${Object.values(value || {}).reduce((sum, list) => sum + (list || []).length, 0)} уроків у планах`,
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
