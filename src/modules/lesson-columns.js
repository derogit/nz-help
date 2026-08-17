/**
 * Module: add lesson columns.
 *
 * Takes a list of dates and a lesson number per weekday, then creates one lesson
 * (journal column) for every date whose weekday has a lesson number assigned.
 */
(() => {
  'use strict';

  const NZ = globalThis.NZ;
  const { utils, storage, net, ui } = NZ;

  const LESSON_TYPE_ID = 110; // regular lesson, same value the journal form posts
  const WEEKDAYS = [
    { key: 'mon', label: 'Понеділок' },
    { key: 'tue', label: 'Вівторок' },
    { key: 'wed', label: 'Середа' },
    { key: 'thu', label: 'Четвер' },
    { key: 'fri', label: 'Пʼятниця' },
    { key: 'sat', label: 'Субота' },
  ];

  /** Read the lesson and room options straight from the journal's own form. */
  async function loadOptions(journalId) {
    const doc = await net.getDocument(`/journal/add-edit-lesson?journal=${journalId}`);

    const lessons = utils.qsa('#osvitaschedulereal-buzzer_id option', doc).map((option) => ({
      value: option.value,
      // Lesson labels carry the bell time in brackets — noise in a compact select.
      label: option.textContent.replace(/\s*\(.*?\)\s*/g, '').trim(),
    }));

    const rooms = utils.qsa('#osvitaschedulereal-room_id option', doc).map((option) => ({
      value: option.value,
      label: option.textContent.trim(),
    }));

    return { lessons, rooms };
  }

  async function openDialog(journalId) {
    const loading = ui.loader('Завантажуємо уроки та кабінети…');
    let options;
    try {
      options = await loadOptions(journalId);
    } catch (error) {
      utils.error(error);
      ui.toast('Не вдалося отримати список уроків. Оновіть сторінку та спробуйте ще раз.', { type: 'error' });
      return;
    } finally {
      loading.close();
    }

    const journalName = utils.qs('.journal-scores__title a')?.textContent.trim() || 'поточний журнал';
    const savedRoom = await storage.get(storage.KEYS.roomId, null);

    const datesCounter = ui.lineCounter();
    const dates = ui.textarea({ rows: 8, placeholder: '01.09\n03.09\n08.09.2026' });
    datesCounter.bind(dates);

    const weekdaySelects = new Map();
    const grid = ui.el(
      'div',
      { class: 'nz-grid' },
      WEEKDAYS.map(({ key, label }) => {
        const control = ui.select({}, [
          { value: 'none', label: 'Немає уроку', selected: true },
          ...options.lessons,
        ]);
        weekdaySelects.set(key, control);
        return ui.field({ label, control });
      })
    );

    const room = ui.select({}, options.rooms.map((option) => ({ ...option, selected: option.value === savedRoom })));
    const log = ui.logList({ title: 'Створення уроків' });

    const submit = ui.button({
      label: 'Створити уроки',
      variant: 'primary',
      onClick: () => run(),
    });

    const dialog = ui.modal({
      eyebrow: journalName,
      title: 'Додавання стовпчиків уроків',
      size: 'lg',
      body: [
        ui.field({
          label: 'Дати уроків',
          hint: 'Кожна дата з нового рядка. Формат: 01.09.2026 або 01.09 — для поточного року.',
          control: dates,
          counter: datesCounter.node,
        }),
        ui.el('p', { class: 'nz-eyebrow', text: 'Номер уроку за днем тижня' }),
        grid,
        ui.field({ label: 'Кабінет', control: room }),
        log.node,
      ],
      footer: [ui.button({ label: 'Закрити', onClick: () => dialog.close() }), submit],
    });

    async function run() {
      const csrf = net.csrfToken();
      if (!csrf) {
        ui.toast('Сторінка втратила токен безпеки. Оновіть її та повторіть.', { type: 'error' });
        return;
      }

      const mapping = {};
      for (const [key, control] of weekdaySelects) mapping[key] = control.value;

      const roomId = room.value;
      await storage.set(storage.KEYS.roomId, roomId);

      const planned = [];
      const skipped = [];

      for (const raw of utils.lines(dates.value)) {
        const date = utils.normalizeDate(raw);
        if (!date) {
          skipped.push(`${raw} — не схоже на дату`);
          continue;
        }
        const weekday = utils.weekdayOf(date);
        const lessonNumber = mapping[weekday];
        if (!lessonNumber || lessonNumber === 'none') {
          skipped.push(`${date} — для цього дня тижня немає уроку`);
          continue;
        }
        planned.push({ date, lessonNumber });
      }

      if (!planned.length) {
        ui.toast('Немає жодної дати, для якої можна створити урок.', { type: 'error' });
        return;
      }

      dialog.setBusy(true);
      log.start(planned.length);
      skipped.forEach((message) => log.add(`Пропущено: ${message}`, 'info'));

      for (const lesson of planned) {
        try {
          const response = await net.postFormJson(`/journal/add-edit-lesson?journal=${journalId}`, {
            _csrf: csrf,
            lesson_date_alt: lesson.date,
            'OsvitaScheduleReal[lesson_type_id]': LESSON_TYPE_ID,
            'OsvitaScheduleReal[lesson_date]': utils.toIsoDate(lesson.date),
            'OsvitaScheduleReal[repeate_type]': 'not',
            'OsvitaScheduleReal[buzzer_id]': lesson.lessonNumber,
            'OsvitaScheduleReal[room_id]': roomId,
          });

          if (response?.status === 'success') {
            log.add(`${lesson.date} — урок створено`, 'ok');
          } else {
            log.add(`${lesson.date} — ${net.errorFromHtml(response?.html)}`, 'error');
          }
        } catch (error) {
          log.add(`${lesson.date} — запит не пройшов (${error.message})`, 'error');
        }
      }

      dialog.setBusy(false);
      submit.textContent = 'Створити ще';

      if (log.failed) {
        ui.toast(`Готово, але ${log.failed} ${utils.plural(log.failed, 'урок', 'уроки', 'уроків')} не створено.`, { type: 'error' });
      } else {
        ui.toast('Уроки створено. Оновлюємо журнал…', { type: 'success' });
        setTimeout(() => location.reload(), 1400);
      }
    }
  }

  NZ.registry.register({
    id: 'lesson-columns',

    match: (page) => Boolean(page.journalId) && !page.scheduleId && page.has('#journalList'),

    init(page) {
      ui.launcher.add({
        id: 'lesson-columns',
        label: 'Додати стовпчики уроків',
        hint: 'За списком дат',
        onClick: () => openDialog(net.journalId() || page.journalId),
      });
    },
  });
})();
