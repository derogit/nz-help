/**
 * NZ Help — module catalog.
 *
 * The single place that describes every feature for humans: the options page
 * renders this list, and the registry refuses to start a module that is missing
 * from it. Adding a feature = one entry here + one file in src/modules/.
 *
 * Fields:
 *   id       — must match the id passed to NZ.registry.register()
 *   group    — section title on the options page
 *   title    — what the user sees
 *   summary  — one sentence, plain language
 *   where    — where in the journal it shows up
 *   enabled  — default state
 *   settings — optional per-module options: { id, type, label, hint, default, min, max }.
 *              Rendered by the options page, read by the module via NZ.settings.get().
 */
(() => {
  'use strict';

  const NZ = (globalThis.NZ = globalThis.NZ || {});

  NZ.catalog = [
    {
      id: 'site-tweaks',
      group: 'Інтерфейс журналу',
      title: 'Компактний вигляд журналу',
      summary: 'Ширші колонки, повністю розгорнуті таблиці оцінок і коротші заголовки «№» та «Дз».',
      where: 'Усі сторінки nz.ua',
      enabled: true,
    },
    {
      id: 'sidebar-toggle',
      group: 'Інтерфейс журналу',
      title: 'Згортання бокового меню',
      summary: 'Кнопка згортання меню; вибраний стан зберігається між сторінками.',
      where: 'Усі сторінки nz.ua',
      enabled: true,
    },
    {
      id: 'lesson-columns',
      group: 'Уроки',
      title: 'Додавання стовпчиків уроків',
      summary: 'Створює уроки за списком дат: для кожного дня тижня свій номер уроку та кабінет.',
      where: 'Журнал класу',
      enabled: true,
    },
    {
      id: 'lesson-cleanup',
      group: 'Уроки',
      title: 'Видалення відмічених уроків',
      summary: 'Чекбокси в шапці журналу, кнопка «Всі» для відмічання одним кліком і масове видалення вибраних уроків.',
      where: 'Журнал класу',
      enabled: true,
    },
    {
      id: 'lesson-plan',
      group: 'Уроки',
      title: 'Планування тем і домашніх завдань',
      summary: 'Запам’ятовує теми та ДЗ наперед і публікує кожен урок сам, коли настає його дата.',
      where: 'Журнал класу',
      enabled: true,
      settings: [
        {
          id: 'leadDays',
          type: 'number',
          label: 'Публікувати наперед, днів',
          hint: 'За скільки днів до уроку тема і ДЗ з’являться на сайті. 0 — у день уроку.',
          default: 1,
          min: 0,
          max: 30,
        },
      ],
    },
    {
      id: 'homework-fill',
      group: 'Уроки',
      title: 'Заповнення тем і домашніх завдань',
      summary: 'Вставляє список тем та ДЗ у послідовні уроки, починаючи з вибраної дати.',
      where: 'Сторінка домашніх завдань',
      enabled: true,
    },
    {
      id: 'homework-notes',
      group: 'Домашні завдання',
      title: 'Нотатки до уроків',
      summary: 'Приватна нотатка для кожного уроку з підказкою при наведенні.',
      where: 'Журнал класу, домашні завдання',
      enabled: true,
    },
    {
      id: 'homework-preview',
      group: 'Домашні завдання',
      title: 'Перегляд відповідей у вікні',
      summary: 'Відкриває відповідь учня поверх сторінки, без переходу і повернення назад.',
      where: 'Домашні завдання',
      enabled: true,
    },
    {
      id: 'testix-marks',
      group: 'Домашні завдання',
      title: 'Інтеграція Testix',
      summary: 'Прикріплює до уроку посилання на результати тесту і виставляє звідти оцінки в цей же стовпчик.',
      where: 'Журнал класу',
      enabled: true,
    },
    {
      id: 'students-copy',
      group: 'Учні',
      title: 'Копіювання списку учнів',
      summary: 'Копіює прізвища з журналу, за потреби додаючи текст до і після кожного рядка.',
      where: 'Журнал класу',
      enabled: true,
    },
    {
      id: 'students-highlight',
      group: 'Учні',
      title: 'Кольорові позначки учнів',
      summary: 'Позначає рядки учнів кольором; позначки зберігаються для всіх журналів.',
      where: 'Журнал класу',
      enabled: true,
    },
    {
      id: 'quick-replies',
      group: 'Спілкування',
      title: 'Швидкі відповіді',
      summary: 'Готові фрази, які вставляються у поле відповіді одним кліком.',
      where: 'Сторінки з полем відповіді',
      enabled: true,
    },
  ];

  NZ.catalogById = (id) => NZ.catalog.find((entry) => entry.id === id) || null;

  /** Bring a stored value back into what the catalog declared, or fall back to the default. */
  function coerce(setting, value) {
    // Nothing saved yet, or the field was simply cleared.
    if (value === undefined || value === null || value === '') return setting.default;
    if (setting.type !== 'number') return value;

    const number = Math.round(Number(value));
    if (!Number.isFinite(number)) return setting.default;

    const min = setting.min ?? -Infinity;
    const max = setting.max ?? Infinity;
    return Math.min(Math.max(number, min), max);
  }

  /**
   * Per-module options. Values are always read through the catalog, so a module
   * never sees a missing, out-of-range or hand-edited value.
   */
  NZ.settings = {
    coerce,

    /** Catalog defaults with the user's saved values on top. */
    async get(moduleId) {
      const entry = NZ.catalogById(moduleId);
      if (!entry || !entry.settings) return {};

      const all = await NZ.storage.get(NZ.storage.KEYS.moduleSettings, {});
      const saved = (all && all[moduleId]) || {};

      return entry.settings.reduce((values, setting) => {
        values[setting.id] = coerce(setting, saved[setting.id]);
        return values;
      }, {});
    },

    /** Merge values into one module's settings, leaving the other modules alone. */
    async set(moduleId, values) {
      const all = await NZ.storage.get(NZ.storage.KEYS.moduleSettings, {});
      const next = all && typeof all === 'object' ? all : {};
      next[moduleId] = { ...(next[moduleId] || {}), ...values };
      await NZ.storage.set(NZ.storage.KEYS.moduleSettings, next);
      return next[moduleId];
    },
  };

  /** Default enabled map, used before the user ever opens the options page. */
  NZ.catalogDefaults = () =>
    NZ.catalog.reduce((acc, entry) => {
      acc[entry.id] = entry.enabled;
      return acc;
    }, {});
})();
