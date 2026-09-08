/**
 * Module: lesson planning.
 *
 * The same input as "fill topics and homework", but nothing is sent yet: topics
 * and tasks are kept per journal and date, shown greyed out under the journal,
 * and published on their own once the lesson day is near — but only while the
 * topic on the site is still empty, so a plan never overwrites live work.
 */
(() => {
  'use strict';

  const NZ = globalThis.NZ;
  const { utils, storage, net, ui } = NZ;

  const ACTION_ID = 'lesson-plan';
  const LESSON_LINK = 'a.modal-box[href*="add-edit-home-task"]';

  /**
   * Lessons of the open journal + the plan for it, kept in sync with the DOM.
   * `leadDays` — how early a lesson goes live; the catalog default is a day,
   * because the teacher usually prepares the evening before.
   */
  const state = { journalId: null, lessons: [], entries: [], leadDays: 1 };
  let listHost = null; // set while the plan dialog is open

  /* ------------------------------------------------------------------ *
   * Stored plan
   * ------------------------------------------------------------------ */

  const isoOf = (entry) => utils.toIsoDate(entry.date);

  function sortEntries(entries) {
    return entries.slice().sort((a, b) => isoOf(a).localeCompare(isoOf(b)));
  }

  async function readAll() {
    const all = await storage.get(storage.KEYS.lessonPlans, {});
    return all && typeof all === 'object' ? all : {};
  }

  async function loadEntries(journalId) {
    const all = await readAll();
    return sortEntries(Array.isArray(all[journalId]) ? all[journalId] : []);
  }

  /** Persist the plan of the current journal and re-render everything that shows it. */
  async function saveEntries(entries) {
    const all = await readAll();
    const sorted = sortEntries(entries);

    if (sorted.length) all[state.journalId] = sorted;
    else delete all[state.journalId];

    await storage.set(storage.KEYS.lessonPlans, all);
    state.entries = sorted;
    refresh();
  }

  /* ------------------------------------------------------------------ *
   * Journal rows
   * ------------------------------------------------------------------ */

  /**
   * The homework list has no column ids. Lesson rows carry one cell more than the
   * header (the "на 2 вересня" column has no title), so only the topic can be found
   * by its header; the task column is always the one before last.
   */
  function columnIndexes(cells) {
    const header = utils.qsa('.homework-row--header .homework__item');
    const find = (pattern, fallback) => {
      const index = header.findIndex((cell) => pattern.test(cell.textContent.trim().toLowerCase()));
      return index > -1 ? index : fallback;
    };

    const homework = cells.length - 2;
    return { number: find(/№/, 2), topic: find(/тема/, homework - 2), homework };
  }

  /* ------------------------------------------------------------------ *
   * Dates
   * ------------------------------------------------------------------ */

  const MONTHS = [
    ['січ'], ['лют'], ['берез', 'бер'], ['квіт'], ['трав'], ['черв'],
    ['лип'], ['серп'], ['верес', 'вер'], ['жовт'], ['листоп', 'лист'], ['груд'],
  ];

  function monthFromName(word) {
    const clean = word.toLowerCase().replace(/[^\p{L}]/gu, '');
    return MONTHS.findIndex((prefixes) => prefixes.some((prefix) => clean.startsWith(prefix))) + 1;
  }

  /** "2 вересня" or "02.09.2026" → { day, month, year }; the year is usually absent. */
  function parseDayMonth(label) {
    const dotted = String(label).match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?/);
    if (dotted) return { day: Number(dotted[1]), month: Number(dotted[2]), year: dotted[3] ? Number(dotted[3]) : null };

    const named = String(label).match(/(\d{1,2})\s+(\p{L}+)/u);
    if (!named) return null;

    const month = monthFromName(named[2]);
    return month ? { day: Number(named[1]), month, year: null } : null;
  }

  /** The school year that is running today: it starts in August. */
  function schoolYearStart(today = new Date()) {
    return today.getMonth() + 1 >= 8 ? today.getFullYear() : today.getFullYear() - 1;
  }

  /**
   * The list shows no year at all, so it is carried along the rows — they go in
   * calendar order — and bumped whenever the month steps backwards (грудень → січень).
   */
  function withYears(parts) {
    const start = schoolYearStart();
    let year = null;
    let previousMonth = 0;

    return parts.map((part) => {
      if (!part) return null;

      if (part.year) year = part.year;
      else if (year === null) year = part.month >= 8 ? start : start + 1;
      else if (part.month < previousMonth) year += 1;

      previousMonth = part.month;
      return utils.normalizeDate(`${part.day}.${part.month}.${year}`);
    });
  }

  /** Text the site itself put into a cell — our own nodes do not count as content. */
  function ownText(cell) {
    if (!cell) return '';
    const copy = cell.cloneNode(true);
    copy.querySelectorAll('[class*="nz-"]').forEach((node) => node.remove());
    return copy.textContent.replace(/\s+/g, ' ').trim();
  }

  function collectLessons() {
    const lessons = utils
      .qsa('.homework-container .homework-row')
      .map((row) => {
        const link = row.querySelector(LESSON_LINK);
        if (!link) return null;

        const params = new URLSearchParams(link.getAttribute('href').split('?')[1]);
        const schedule = params.get('schedule');
        const journal = params.get('journal');
        if (!schedule || !journal) return null;

        const cells = utils.qsa('.homework__item', row);
        const label = cells[1]?.textContent.trim() || `урок ${schedule}`;
        const index = columnIndexes(cells);

        return {
          row,
          schedule,
          journal,
          label,
          part: parseDayMonth(label),
          numberCell: cells[index.number] || null,
          topicCell: cells[index.topic] || null,
          homeworkCell: cells[index.homework] || null,
        };
      })
      .filter(Boolean);

    const dates = withYears(lessons.map((lesson) => lesson.part));
    lessons.forEach((lesson, index) => {
      lesson.date = dates[index];
    });

    return lessons;
  }

  const lessonByDate = (date) => state.lessons.find((lesson) => lesson.date === date) || null;

  function dayOf(dottedDate) {
    const [day, month, year] = String(dottedDate).split('.').map(Number);
    return new Date(year, month - 1, day).setHours(0, 0, 0, 0);
  }

  /** The lesson day is here or within the lead time — time to put it on the site. */
  function isDue(dottedDate) {
    const limit = new Date();
    limit.setHours(0, 0, 0, 0);
    limit.setDate(limit.getDate() + state.leadDays);
    return dayOf(dottedDate) <= limit.getTime();
  }

  /** How the lead time reads for the user: "напередодні", "за 3 дні до" and so on. */
  function leadPhrase(date = null) {
    const days = state.leadDays;
    if (days <= 0) return date ? `у день уроку — ${date}` : 'у день уроку';
    if (days === 1) return date ? `напередодні ${date}` : 'напередодні своєї дати';

    const counted = `за ${days} ${utils.plural(days, 'день', 'дні', 'днів')}`;
    return date ? `${counted} до ${date}` : `${counted} до своєї дати`;
  }

  /* ------------------------------------------------------------------ *
   * Ghost text under the journal
   * ------------------------------------------------------------------ */

  function ghost(entry, text) {
    return ui.el('span', {
      class: 'nz-plan-ghost',
      title: `Заплановано на ${entry.date}. Опублікується ${leadPhrase(entry.date)} — натисніть, щоб змінити.`,
      text,
      onClick: (e) => {
        e.preventDefault();
        e.stopPropagation();
        openDialog();
      },
    });
  }

  /** Draw the plan into the lessons it belongs to, skipping cells that already have text. */
  function renderGhosts() {
    utils.qsa('.nz-plan-ghost').forEach((node) => node.remove());

    for (const entry of state.entries) {
      const lesson = lessonByDate(entry.date);
      if (!lesson) continue;

      if (entry.number && lesson.numberCell && !ownText(lesson.numberCell)) {
        lesson.numberCell.append(ghost(entry, entry.number));
      }
      if (entry.topic && lesson.topicCell && !ownText(lesson.topicCell)) {
        lesson.topicCell.append(ghost(entry, entry.topic));
      }
      if (entry.homework && lesson.homeworkCell && !ownText(lesson.homeworkCell)) {
        lesson.homeworkCell.append(ghost(entry, entry.homework));
      }
    }
  }

  function updateHint() {
    const count = state.entries.length;
    ui.launcher.setHint(
      ACTION_ID,
      count
        ? `${count} ${utils.plural(count, 'урок', 'уроки', 'уроків')} у плані`
        : 'Теми і ДЗ, які опублікуються самі'
    );
  }

  function refresh() {
    renderGhosts();
    updateHint();
    if (listHost) renderList();
  }

  /* ------------------------------------------------------------------ *
   * Publishing
   * ------------------------------------------------------------------ */

  /**
   * The topic as the server has it right now. Returns null when the form cannot
   * be read, so the caller can fall back to what the journal page shows.
   */
  async function serverTopic(lesson) {
    try {
      const doc = await net.getDocument(`/journal/add-edit-home-task?schedule=${lesson.schedule}&journal=${lesson.journal}`);
      const field = doc.querySelector('[name="OsvitaScheduleReal[lesson_topic]"], #osvitaschedulereal-lesson_topic');
      if (!field) return null;
      return String(field.value ?? field.textContent ?? '').trim();
    } catch (error) {
      utils.warn(`Тему уроку ${lesson.label} не вдалося перевірити`, error);
      return null;
    }
  }

  async function publish(lesson, entry, csrf) {
    await net.postForm(`/journal/add-edit-home-task?schedule=${lesson.schedule}&journal=${lesson.journal}`, {
      _csrf: csrf,
      'OsvitaScheduleReal[lesson_topic]': entry.topic,
      'OsvitaScheduleReal[lesson_number_in_plan]': entry.number || '',
      'OsvitaScheduleReal[hometask]': entry.homework || '',
      'OsvitaScheduleReal[hometask_to]': lesson.schedule,
      'OsvitaScheduleReal[second_personal_id]': '',
      'OsvitaScheduleReal[second_predmet_id]': '',
    });
  }

  /** Show the published text right away, so the page does not have to be reloaded. */
  function fillCell(cell, text) {
    if (!cell || !text) return;
    utils.qsa('.nz-plan-ghost', cell).forEach((node) => node.remove());
    cell.append(ui.el('span', { class: 'nz-plan-fresh', title: 'Щойно опубліковано з плану', text }));
  }

  async function publishDue() {
    const due = state.entries.filter((entry) => isDue(entry.date));
    if (!due.length) return;

    const csrf = net.csrfToken();
    if (!csrf) {
      utils.warn('Заплановані уроки не опубліковано: на сторінці немає токена безпеки');
      return;
    }

    const rest = state.entries.slice();
    let published = 0;
    let taken = 0;
    let failed = 0;

    for (const entry of due) {
      const lesson = lessonByDate(entry.date);
      if (!lesson) continue; // the lesson column does not exist yet — keep waiting

      let current = ownText(lesson.topicCell);
      if (!current) {
        const fromServer = await serverTopic(lesson);
        if (fromServer === null && !lesson.topicCell) continue; // nothing could be verified
        current = fromServer || '';
      }

      if (current) {
        entry.conflict = true;
        taken += 1;
        continue;
      }

      entry.conflict = false;

      try {
        await publish(lesson, entry, csrf);
        fillCell(lesson.numberCell, entry.number);
        fillCell(lesson.topicCell, entry.topic);
        fillCell(lesson.homeworkCell, entry.homework);
        rest.splice(rest.indexOf(entry), 1);
        published += 1;
      } catch (error) {
        failed += 1;
        utils.error(`Запланований урок ${entry.date} не опублікувався`, error);
      }
    }

    await saveEntries(rest);

    if (published) {
      ui.toast(
        `Опубліковано ${published} ${utils.plural(published, 'заплановану тему', 'заплановані теми', 'запланованих тем')}.`,
        { type: 'success' }
      );
    }
    if (taken) {
      ui.toast(
        `${taken} ${utils.plural(taken, 'урок', 'уроки', 'уроків')} пропущено: тему вже заповнено на сайті.`,
        { type: 'info' }
      );
    }
    if (failed) {
      ui.toast(
        `${failed} ${utils.plural(failed, 'урок', 'уроки', 'уроків')} не опубліковано. Спробуємо ще раз при наступному відкритті журналу.`,
        { type: 'error' }
      );
    }
  }

  /* ------------------------------------------------------------------ *
   * Dialog
   * ------------------------------------------------------------------ */

  function statusOf(entry) {
    const lesson = lessonByDate(entry.date);
    if (!lesson) return { text: 'уроку з такою датою немає в журналі', warning: true };
    if (entry.conflict) return { text: 'тему вже заповнено на сайті — план не опублікується', warning: true };
    if (isDue(entry.date)) return { text: 'час настав — опублікуємо при наступному відкритті журналу', warning: false };
    return { text: `опублікується автоматично ${leadPhrase(entry.date)}`, warning: false };
  }

  function planRow(entry) {
    const number = ui.input({
      type: 'number',
      min: '1',
      class: 'nz-input nz-input--narrow',
      value: entry.number || '',
      title: 'Номер уроку за планом',
    });
    const topic = ui.input({ value: entry.topic || '', placeholder: 'Тема уроку' });
    const homework = ui.input({ value: entry.homework || '', placeholder: 'Домашнє завдання' });

    const commit = () => {
      entry.number = number.value.trim();
      entry.topic = topic.value.trim();
      entry.homework = homework.value.trim();

      // An entry with neither a topic nor a task is not a plan any more.
      const rest = entry.topic || entry.homework ? state.entries : state.entries.filter((item) => item !== entry);
      saveEntries(rest);
    };

    [number, topic, homework].forEach((control) => control.addEventListener('change', commit));

    const remove = ui.iconButton({
      label: '✕',
      title: 'Прибрати з плану',
      onClick: () => saveEntries(state.entries.filter((item) => item !== entry)),
    });

    const status = statusOf(entry);

    return ui.el('div', { class: 'nz-plan__row' }, [
      ui.el('span', { class: 'nz-plan__date', text: entry.date }),
      number,
      topic,
      homework,
      remove,
      ui.el('span', { class: `nz-plan__status${status.warning ? ' is-warning' : ''}`, text: status.text }),
    ]);
  }

  function renderList() {
    if (!listHost) return;

    listHost.replaceChildren(
      ...(state.entries.length
        ? state.entries.map(planRow)
        : [ui.el('p', { class: 'nz-text nz-text--muted', text: 'Поки що нічого не заплановано.' })])
    );
  }

  function openDialog() {
    const planned = new Set(state.entries.map((entry) => entry.date));
    const dated = state.lessons.filter((lesson) => lesson.date);

    if (!dated.length) {
      ui.toast('У списку уроків не знайдено жодної дати. Спочатку створіть стовпчики уроків.', { type: 'info' });
      return;
    }

    // Planning usually starts at the first lesson that is neither filled nor planned.
    const firstEmpty = dated.findIndex((lesson) => !ownText(lesson.topicCell) && !planned.has(lesson.date));

    const startSelect = ui.select(
      {},
      dated.map((lesson, index) => ({
        value: String(index),
        label: `${lesson.label}${ownText(lesson.topicCell) ? ' · тема вже є' : planned.has(lesson.date) ? ' · у плані' : ''}`,
        selected: index === Math.max(firstEmpty, 0),
      }))
    );
    const startNumber = ui.input({ type: 'number', min: '1', value: '1', class: 'nz-input nz-input--narrow' });

    /** Continue the numbering of the journal instead of always starting at one. */
    function suggestNumber() {
      const from = Number(startSelect.value) || 0;
      for (let i = from - 1; i >= 0; i -= 1) {
        const planned = state.entries.find((entry) => entry.date === dated[i].date);
        const previous = Number(planned?.number || ownText(dated[i].numberCell));
        if (previous) return previous + 1;
      }
      return 1;
    }

    startSelect.addEventListener('change', () => {
      startNumber.value = String(suggestNumber());
    });
    startNumber.value = String(suggestNumber());

    const topicsCounter = ui.lineCounter();
    const topics = ui.textarea({ rows: 6, placeholder: 'Тема 1\nТема 2\nТема 3' });
    topicsCounter.bind(topics);

    const homeworkCounter = ui.lineCounter();
    const homework = ui.textarea({ rows: 6, placeholder: 'ДЗ 1\nДЗ 2\nДЗ 3' });
    homeworkCounter.bind(homework);

    listHost = ui.el('div', { class: 'nz-plan__rows' });
    renderList();

    const dialog = ui.modal({
      eyebrow: `Уроків у плані: ${state.entries.length}`,
      title: 'Планування тем і ДЗ',
      size: 'xl',
      body: [
        ui.el('p', { class: 'nz-eyebrow', text: 'Додати до плану' }),
        ui.el('div', { class: 'nz-row' }, [
          ui.field({ label: 'Почати з уроку', control: startSelect }),
          ui.field({ label: 'Номер за планом', control: startNumber }),
        ]),
        ui.el('div', { class: 'nz-row nz-row--equal' }, [
          ui.field({
            label: 'Теми уроків',
            hint: 'Один рядок — один урок. Нічого не надсилається зараз.',
            control: topics,
            counter: topicsCounter.node,
          }),
          ui.field({
            label: 'Домашні завдання',
            hint: 'Можна залишити порожнім або заповнити частково.',
            control: homework,
            counter: homeworkCounter.node,
          }),
        ]),
        ui.el('p', { class: 'nz-eyebrow', text: 'Заплановані уроки' }),
        ui.el('p', {
          class: 'nz-text nz-text--muted',
          text:
            'Тему й ДЗ можна змінити просто в рядку. Кожен урок опублікується сам ' +
            `${leadPhrase()}, якщо тема на сайті ще порожня. ` +
            'За скільки днів публікувати — у налаштуваннях розширення.',
        }),
        listHost,
      ],
      footer: [
        ui.button({ label: 'Закрити', onClick: () => dialog.close() }),
        ui.button({ label: 'Запланувати', variant: 'primary', onClick: () => add() }),
      ],
      onClose: () => {
        listHost = null;
      },
    });

    async function add() {
      const topicList = utils.lines(topics.value);
      const homeworkList = utils.lines(homework.value);

      if (!topicList.length && !homeworkList.length) {
        ui.toast('Додайте хоча б одну тему.', { type: 'info' });
        return;
      }

      let index = Number(startSelect.value) || 0;
      let lessonNumber = Number(startNumber.value) || 1;
      const rows = Math.max(topicList.length, homeworkList.length);
      const available = dated.length - index;

      const next = state.entries.slice();
      let added = 0;
      let replaced = 0;

      for (let i = 0; i < rows; i += 1) {
        const lesson = dated[index];
        if (!lesson) break;

        const entry = {
          date: lesson.date,
          number: String(lessonNumber),
          topic: topicList[i] || '',
          homework: homeworkList[i] || '',
        };

        const existing = next.findIndex((item) => item.date === entry.date);
        if (existing > -1) {
          next[existing] = entry;
          replaced += 1;
        } else {
          next.push(entry);
        }

        added += 1;
        index += 1;
        lessonNumber += 1;
      }

      await saveEntries(next);

      topics.value = '';
      homework.value = '';
      topics.dispatchEvent(new Event('input'));
      homework.dispatchEvent(new Event('input'));

      // Leave the form ready for the next block of topics, right after this one.
      startSelect.value = String(Math.min(index, dated.length - 1));
      startNumber.value = String(suggestNumber());

      ui.toast(
        `Заплановано ${added} ${utils.plural(added, 'урок', 'уроки', 'уроків')}` +
          (replaced ? `, з них ${replaced} оновлено` : '') + '.',
        { type: 'success' }
      );

      if (rows > available) {
        ui.toast(
          `${rows - available} ${utils.plural(rows - available, 'рядок', 'рядки', 'рядків')} не додано — далі в журналі немає уроків.`,
          { type: 'info' }
        );
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * Module
   * ------------------------------------------------------------------ */

  NZ.registry.register({
    id: ACTION_ID,

    match: (page) => page.has(`.homework-container .homework-row ${LESSON_LINK}`),

    async init(page) {
      state.lessons = collectLessons();
      if (!state.lessons.length) return;

      state.journalId = String(page.journalId || state.lessons[0].journal);
      state.leadDays = (await NZ.settings.get(ACTION_ID)).leadDays ?? state.leadDays;
      state.entries = await loadEntries(state.journalId);

      ui.launcher.add({
        id: ACTION_ID,
        label: 'Запланувати уроки',
        hint: 'Теми і ДЗ, які опублікуються самі',
        onClick: openDialog,
      });

      refresh();
      await publishDue();
    },
  });
})();
