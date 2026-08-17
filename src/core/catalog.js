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
      summary: 'Чекбокси в шапці журналу і масове видалення вибраних уроків.',
      where: 'Журнал класу',
      enabled: true,
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

  /** Default enabled map, used before the user ever opens the options page. */
  NZ.catalogDefaults = () =>
    NZ.catalog.reduce((acc, entry) => {
      acc[entry.id] = entry.enabled;
      return acc;
    }, {});
})();
