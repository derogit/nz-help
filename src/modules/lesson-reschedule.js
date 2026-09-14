/**
 * Module: reschedule lessons.
 *
 * The mirror image of "add lesson columns": instead of creating lessons from a
 * list of dates, it takes the lessons that already exist in the journal, groups
 * them by weekday + lesson number ("Середа, 4 урок"), and moves a whole group to
 * another weekday and/or another lesson number in one pass. Dates move inside
 * their own week, so a Wednesday lesson sent to Thursday lands on the Thursday
 * of the same week.
 *
 * Each lesson is read from its own edit form first, so the POST that saves it
 * carries every field the journal expects and only the date, lesson number and
 * room are overwritten.
 */
(() => {
  'use strict';

  const NZ = globalThis.NZ;
  const { utils, net, ui } = NZ;

  const ACTION_ID = 'lesson-reschedule';
  const KEEP = 'keep';
  const CONCURRENCY = 5; // parallel reads of the lesson forms

  const WEEKDAYS = [
    { key: 'mon', label: 'Понеділок', short: 'пн' },
    { key: 'tue', label: 'Вівторок', short: 'вт' },
    { key: 'wed', label: 'Середа', short: 'ср' },
    { key: 'thu', label: 'Четвер', short: 'чт' },
    { key: 'fri', label: 'Пʼятниця', short: 'пт' },
    { key: 'sat', label: 'Субота', short: 'сб' },
    { key: 'sun', label: 'Неділя', short: 'нд' },
  ];

  const dayByKey = (key) => WEEKDAYS.find((day) => day.key === key) || { key, label: key, short: key };
  const dayIndex = (key) => WEEKDAYS.findIndex((day) => day.key === key);

  /* ------------------------------------------------------------------ *
   * Journal header
   * ------------------------------------------------------------------ */

  /** Lesson columns live in <thead>; some journal views render that row in <tbody>. */
  function headerCells() {
    const inHead = utils.qsa('#journalList thead td.pt-point');
    if (inHead.length) return inHead;

    const firstRow = utils.qsa('#journalList tr').find((row) => row.querySelector('td.pt-point a[href*="schedule="]'));
    return firstRow ? utils.qsa('td.pt-point', firstRow) : [];
  }

  /** Schedule ids of every lesson column, with the day/month printed in the header. */
  function lessonColumns() {
    return headerCells()
      .map((cell) => {
        const link = cell.querySelector('a[href*="schedule="]');
        if (!link) return null;

        const scheduleId = new URLSearchParams(link.getAttribute('href').split('?')[1] || '').get('schedule');
        if (!scheduleId) return null;

        const text = link.textContent.trim();
        return { scheduleId, label: text, shown: text.match(/(\d{1,2})\.(\d{1,2})/)?.[0] || null };
      })
      .filter(Boolean);
  }

  /* ------------------------------------------------------------------ *
   * Reading the lessons
   * ------------------------------------------------------------------ */

  /** Turn a parsed <form> into the payload a plain submit would have sent. */
  function serializeForm(form) {
    const data = {};

    for (const control of utils.qsa('input[name], select[name], textarea[name]', form)) {
      const name = control.getAttribute('name');
      if (!name || control.disabled) continue;

      const type = (control.getAttribute('type') || '').toLowerCase();
      if (type === 'checkbox' || type === 'radio') {
        // Yii pairs a checkbox with a hidden field of the same name: the hidden
        // one comes first, so an unchecked box correctly leaves it in place.
        if (control.hasAttribute('checked')) data[name] = control.value;
        continue;
      }
      if (type === 'submit' || type === 'button' || type === 'file') continue;

      if (control.tagName === 'SELECT') {
        const option = control.querySelector('option[selected]') || control.options[control.selectedIndex];
        data[name] = option ? option.value : '';
        continue;
      }

      data[name] = control.getAttribute('value') ?? control.value ?? '';
    }

    return data;
  }

  function selectedValue(select) {
    if (!select) return '';
    const option = select.querySelector('option[selected]') || select.options[select.selectedIndex];
    return option ? option.value : '';
  }

  /** Lesson labels carry the bell time in brackets — noise in a compact select. */
  function optionsOf(select, { stripBrackets = false } = {}) {
    return utils.qsa('option', select).map((option) => {
      const text = option.textContent;
      return {
        value: option.value,
        label: (stripBrackets ? text.replace(/\s*\(.*?\)\s*/g, '') : text).trim(),
      };
    });
  }

  /** The form keeps the date as `yyyy-mm-dd`; older journal views use `dd.mm.yyyy`. */
  function parseFormDate(value) {
    const iso = String(value || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    return iso ? utils.normalizeDate(`${iso[3]}.${iso[2]}.${iso[1]}`) : utils.normalizeDate(value);
  }

  /** Read one lesson through its own edit form. */
  async function readLesson(journalId, column) {
    const doc = await net.getDocument(`/journal/add-edit-lesson?journal=${journalId}&schedule=${column.scheduleId}`);

    const buzzer = utils.qs('#osvitaschedulereal-buzzer_id', doc);
    const form = buzzer?.closest('form');
    if (!form) throw new Error('форму уроку не знайдено');

    const fields = serializeForm(form);
    const date = parseFormDate(fields['OsvitaScheduleReal[lesson_date]']) || utils.normalizeDate(fields.lesson_date_alt);
    if (!date) throw new Error('у формі немає дати уроку');

    const room = utils.qs('#osvitaschedulereal-room_id', doc);
    const buzzerId = selectedValue(buzzer);
    const lessons = optionsOf(buzzer, { stripBrackets: true }).filter((option) => option.value);

    return {
      ...column,
      fields,
      date,
      buzzerId,
      buzzerLabel: lessons.find((option) => option.value === buzzerId)?.label || `урок ${buzzerId}`,
      roomId: selectedValue(room),
      lessonOptions: lessons,
      roomOptions: optionsOf(room).filter((option) => option.value),
    };
  }

  /** Run the reads a few at a time: a journal can hold dozens of columns. */
  async function runQueue(items, limit, worker) {
    let cursor = 0;

    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) await worker(items[cursor++]);
    });

    await Promise.all(runners);
  }

  /**
   * Guard against the journal answering with a blank "new lesson" form: saving
   * those would create duplicates instead of moving anything. The header prints
   * the day and month of every column, so compare it with what the form says.
   */
  function looksLikeEditForms(lessons) {
    const checked = lessons.filter((lesson) => lesson.shown);
    if (checked.length) {
      const matching = checked.filter((lesson) => {
        const [day, month] = lesson.date.split('.');
        const [shownDay, shownMonth] = lesson.shown.split('.');
        return Number(day) === Number(shownDay) && Number(month) === Number(shownMonth);
      });
      return matching.length > checked.length / 2;
    }
    // No dates in the header — fall back to the fact that one journal cannot
    // hold a dozen columns that all sit on the very same date.
    return lessons.length < 2 || new Set(lessons.map((lesson) => lesson.date)).size > 1;
  }

  /**
   * Save one lesson. Creating a lesson answers with JSON, but the edit form may
   * answer with plain HTML — so a body that carries no validation error counts
   * as a success too.
   */
  async function save(journalId, scheduleId, payload) {
    const text = await net.postForm(`/journal/add-edit-lesson?journal=${journalId}&schedule=${scheduleId}`, payload);

    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Not JSON — judge by the returned markup below.
    }

    if (json) {
      return json.status === 'success' ? { ok: true } : { ok: false, error: net.errorFromHtml(json.html) };
    }
    if (/errorSummary|has-error/.test(text)) return { ok: false, error: net.errorFromHtml(text) };
    return { ok: true };
  }

  /* ------------------------------------------------------------------ *
   * Dates
   * ------------------------------------------------------------------ */

  function shiftDate(dottedDate, days) {
    const [day, month, year] = dottedDate.split('.').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + days);
    return [
      String(date.getDate()).padStart(2, '0'),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getFullYear()),
    ].join('.');
  }

  const shortDate = (dottedDate) => dottedDate.split('.').slice(0, 2).join('.');

  /* ------------------------------------------------------------------ *
   * Dialog
   * ------------------------------------------------------------------ */

  async function openDialog(journalId) {
    const columns = lessonColumns();
    if (!columns.length) {
      ui.toast('У журналі немає жодного уроку, який можна перенести.', { type: 'info' });
      return;
    }

    const progress = ui.loader(`Читаємо уроки: 0 з ${columns.length}`);
    const lessons = [];
    const unreadable = [];
    let done = 0;

    try {
      await runQueue(columns, CONCURRENCY, async (column) => {
        try {
          lessons.push(await readLesson(journalId, column));
        } catch (error) {
          unreadable.push(`${column.label} — ${error.message}`);
          utils.warn(`Урок ${column.label} не прочитано`, error);
        }
        progress.update(`Читаємо уроки: ${++done} з ${columns.length}`);
      });
    } finally {
      progress.close();
    }

    if (!lessons.length) {
      ui.toast('Не вдалося прочитати уроки журналу. Оновіть сторінку та спробуйте ще раз.', { type: 'error' });
      return;
    }

    if (!looksLikeEditForms(lessons)) {
      ui.toast('Журнал не віддає дані окремих уроків — перенесення скасовано, щоб не створити дублікати.', { type: 'error' });
      return;
    }

    lessons.sort((a, b) => utils.toIsoDate(a.date).localeCompare(utils.toIsoDate(b.date)));

    // Group the lessons exactly the way the teacher thinks about them: a slot in
    // the timetable, "Середа — 4 урок".
    const groups = new Map();
    for (const lesson of lessons) {
      const key = `${utils.weekdayOf(lesson.date)}|${lesson.buzzerId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(lesson);
    }

    const sortedGroups = [...groups.entries()].sort(([a], [b]) => {
      const [dayA, buzzerA] = a.split('|');
      const [dayB, buzzerB] = b.split('|');
      return dayIndex(dayA) - dayIndex(dayB) || Number(buzzerA) - Number(buzzerB);
    });

    const lessonOptions = lessons.find((lesson) => lesson.lessonOptions.length)?.lessonOptions || [];
    const roomOptions = lessons.find((lesson) => lesson.roomOptions.length)?.roomOptions || [];

    const source = ui.select(
      {},
      sortedGroups.map(([key, items], index) => {
        const [day, buzzerId] = key.split('|');
        const label = items[0].buzzerLabel || `урок ${buzzerId}`;
        return {
          value: key,
          selected: index === 0,
          label: `${dayByKey(day).label} — ${label} · ${items.length} ${utils.plural(items.length, 'урок', 'уроки', 'уроків')}`,
        };
      })
    );

    const targetDay = ui.select({}, [
      { value: KEEP, label: 'Не змінювати', selected: true },
      ...WEEKDAYS.slice(0, 6).map((day) => ({ value: day.key, label: day.label })),
    ]);

    const targetLesson = ui.select({}, [
      { value: KEEP, label: 'Не змінювати', selected: true },
      ...lessonOptions,
    ]);

    const targetRoom = ui.select({}, [
      { value: KEEP, label: 'Не змінювати', selected: true },
      ...roomOptions,
    ]);

    const preview = ui.el('div', { class: 'nz-move' });
    const log = ui.logList({ title: 'Перенесення уроків' });

    const submit = ui.button({ label: 'Перенести уроки', variant: 'primary', onClick: () => run() });

    const journalName = utils.qs('.journal-scores__title a')?.textContent.trim() || 'поточний журнал';

    const dialog = ui.modal({
      eyebrow: journalName,
      title: 'Перенесення уроків',
      size: 'lg',
      body: [
        ui.field({
          label: 'Який урок переносимо',
          hint: 'Групи складено з уроків, які вже є в журналі.',
          control: source,
        }),
        ui.el('p', { class: 'nz-eyebrow', text: 'Перенести на' }),
        ui.el('div', { class: 'nz-grid' }, [
          ui.field({ label: 'День тижня', control: targetDay }),
          ui.field({ label: 'Номер уроку', control: targetLesson }),
          ui.field({ label: 'Кабінет', control: targetRoom }),
        ]),
        preview,
        log.node,
      ],
      footer: [ui.button({ label: 'Закрити', onClick: () => dialog.close() }), submit],
    });

    /** What exactly will be sent, for the preview and for the run. */
    function plan() {
      const items = groups.get(source.value) || [];
      const day = targetDay.value === KEEP ? null : targetDay.value;
      const buzzerId = targetLesson.value === KEEP ? null : targetLesson.value;
      const roomId = targetRoom.value === KEEP ? null : targetRoom.value;

      return items.map((lesson) => {
        const delta = day ? dayIndex(day) - dayIndex(utils.weekdayOf(lesson.date)) : 0;
        const date = delta ? shiftDate(lesson.date, delta) : lesson.date;
        const nextBuzzer = buzzerId || lesson.buzzerId;
        const nextRoom = roomId || lesson.roomId;

        return {
          lesson,
          date,
          buzzerId: nextBuzzer,
          roomId: nextRoom,
          buzzerLabel: lessonOptions.find((option) => option.value === nextBuzzer)?.label || lesson.buzzerLabel,
          changed: date !== lesson.date || nextBuzzer !== lesson.buzzerId || nextRoom !== lesson.roomId,
        };
      });
    }

    function renderPreview() {
      const changes = plan().filter((change) => change.changed);
      submit.disabled = changes.length === 0;

      if (!changes.length) {
        preview.replaceChildren(
          ui.el('p', { class: 'nz-text nz-text--muted', text: 'Виберіть новий день тижня, номер уроку або кабінет — тут з’явиться список змін.' })
        );
        return;
      }

      preview.replaceChildren(
        ui.el('p', { class: 'nz-eyebrow', text: `Зміняться ${changes.length} ${utils.plural(changes.length, 'урок', 'уроки', 'уроків')}` }),
        ui.el(
          'ul',
          { class: 'nz-move__list' },
          changes.map((change) =>
            ui.el('li', { class: 'nz-move__item' }, [
              ui.el('span', { class: 'nz-move__from', text: `${shortDate(change.lesson.date)} ${dayByKey(utils.weekdayOf(change.lesson.date)).short}` }),
              ui.el('span', { class: 'nz-move__arrow', text: '→' }),
              ui.el('span', { class: 'nz-move__to', text: `${shortDate(change.date)} ${dayByKey(utils.weekdayOf(change.date)).short} · ${change.buzzerLabel}` }),
            ])
          )
        )
      );
    }

    [source, targetDay, targetLesson, targetRoom].forEach((control) => control.addEventListener('change', renderPreview));
    renderPreview();

    if (unreadable.length) {
      ui.toast(`${unreadable.length} ${utils.plural(unreadable.length, 'урок', 'уроки', 'уроків')} не вдалося прочитати — їх у списку немає.`, { type: 'info' });
    }

    async function run() {
      const csrf = net.csrfToken();
      if (!csrf) {
        ui.toast('Сторінка втратила токен безпеки. Оновіть її та повторіть.', { type: 'error' });
        return;
      }

      const changes = plan().filter((change) => change.changed);
      if (!changes.length) {
        ui.toast('Нічого переносити: нові значення збігаються з поточними.', { type: 'info' });
        return;
      }

      const confirmed = await ui.confirm({
        title: `Перенести ${changes.length} ${utils.plural(changes.length, 'урок', 'уроки', 'уроків')}?`,
        text: 'Оцінки, теми та домашні завдання залишаться в уроці — зміняться лише дата, номер уроку і кабінет.',
        confirmLabel: 'Перенести',
      });
      if (!confirmed) return;

      dialog.setBusy(true);
      log.start(changes.length);
      unreadable.forEach((message) => log.add(`Пропущено: ${message}`, 'info'));

      for (const change of changes) {
        const title = `${shortDate(change.lesson.date)} → ${shortDate(change.date)}`;

        try {
          const payload = {
            ...change.lesson.fields,
            _csrf: csrf,
            lesson_date_alt: change.date,
            'OsvitaScheduleReal[lesson_date]': utils.toIsoDate(change.date),
            'OsvitaScheduleReal[buzzer_id]': change.buzzerId,
            'OsvitaScheduleReal[room_id]': change.roomId,
          };
          if (!payload['OsvitaScheduleReal[repeate_type]']) payload['OsvitaScheduleReal[repeate_type]'] = 'not';

          const answer = await save(journalId, change.lesson.scheduleId, payload);

          if (answer.ok) {
            log.add(`${title} — перенесено`, 'ok');
          } else {
            log.add(`${title} — ${answer.error}`, 'error');
          }
        } catch (error) {
          log.add(`${title} — запит не пройшов (${error.message})`, 'error');
        }
      }

      dialog.setBusy(false);
      renderPreview();

      if (log.failed) {
        ui.toast(`Готово, але ${log.failed} ${utils.plural(log.failed, 'урок', 'уроки', 'уроків')} не перенесено.`, { type: 'error' });
      } else {
        ui.toast('Уроки перенесено. Оновлюємо журнал…', { type: 'success' });
        setTimeout(() => location.reload(), 1400);
      }
    }
  }

  NZ.registry.register({
    id: ACTION_ID,

    match: (page) => Boolean(page.journalId) && !page.scheduleId && page.has('#journalList td.pt-point a[href*="schedule="]'),

    init(page) {
      ui.launcher.add({
        id: ACTION_ID,
        label: 'Перенести уроки',
        hint: 'Змінити день тижня і номер уроку',
        onClick: () => openDialog(net.journalId() || page.journalId),
      });
    },
  });
})();
