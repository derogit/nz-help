/**
 * Module: Testix integration.
 *
 * The teacher pins the results URL of a Testix assignment to a lesson (stored on
 * the same server as the notes). Opening the dialog pulls the grades, matches the
 * names against the journal and writes the marks into that lesson's column — the
 * date is never picked by hand: the button already sits in its own lesson row.
 */
(() => {
  'use strict';

  const NZ = globalThis.NZ;
  const { utils, net, ui } = NZ;

  const MARK_DELAY = 150; // the journal saves every mark with its own request
  const LIST_LIMIT = 300; // the link API refuses longer batches

  // The link API answers in English; say the same thing the way a teacher can act on.
  const SERVER_HINTS = {
    'URL is invalid': 'Посилання має бути на https://testix.com.ua.',
    'URL is too long': 'Посилання задовге — скоротіть його.',
    'Schedule ID is required': 'Урок не розпізнано — оновіть сторінку.',
    'Schedule ID is invalid': 'Урок не розпізнано — оновіть сторінку.',
  };

  const hintFor = (error, fallback) => SERVER_HINTS[error?.message] || fallback;

  const links = new Map(); // scheduleId -> results url ('' when none)
  const rowButtons = new Map(); // scheduleId -> Set of buttons in the homework rows

  /* ------------------------------------------------------------------ *
   * Journal side
   * ------------------------------------------------------------------ */

  /** Compare names ignoring word order, case and apostrophe variants. */
  function nameTokens(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/[’ʼ`´]/g, "'")
      .replace(/[^\p{L}' ]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .sort();
  }

  function journalStudents() {
    return utils
      .qsa('#journalList tbody td.pt-theme[data-student-id]')
      .map((cell) => {
        const name = cell.querySelector('a')?.textContent.trim() || '';
        const tokens = nameTokens(name);
        return { id: cell.dataset.studentId, name, tokens, key: tokens.join(' '), row: cell.closest('tr') };
      })
      .filter((student) => student.name && student.row);
  }

  function matchStudent(name, students) {
    const tokens = nameTokens(name);
    if (!tokens.length) return null;

    const key = tokens.join(' ');
    const exact = students.filter((student) => student.key === key);
    if (exact.length === 1) return exact[0];

    // The journal often carries a middle name the test does not: accept a single
    // student whose name contains every token of the other one.
    const partial = students.filter((student) => tokens.every((token) => student.tokens.includes(token)));
    return partial.length === 1 ? partial[0] : null;
  }

  /**
   * Two rows with the same name are one student who wrote the test twice: keep
   * the higher grade and count the attempts together.
   */
  function bestPerStudent(list) {
    const best = new Map();
    let merged = 0;

    for (const result of list) {
      const key = nameTokens(result.student).join(' ') || String(result.student || '');
      const previous = best.get(key);

      if (!previous) {
        best.set(key, { ...result });
        continue;
      }

      merged += 1;
      const winner = (Number(result.grade) || 0) > (Number(previous.grade) || 0) ? { ...result } : previous;
      winner.attempts = (Number(previous.attempts) || 0) + (Number(result.attempts) || 0);
      best.set(key, winner);
    }

    return { list: Array.from(best.values()), merged };
  }

  /** Position of the lesson column in the grades table, as an nth-child index. */
  function columnIndex(scheduleId) {
    const col = utils.qs(`#journalList col[data-lesson-id="${scheduleId}"]`);
    if (col?.parentNode) return Array.from(col.parentNode.children).indexOf(col) + 1;

    // No colgroup in this journal view — fall back to the lesson header cell.
    const header = headerLink(scheduleId)?.closest('td');
    return header?.parentNode ? Array.from(header.parentNode.children).indexOf(header) + 1 : 0;
  }

  /** Lesson links in the journal header, by schedule id; the table never re-renders. */
  let headerLinks = null;

  function headerLink(scheduleId) {
    if (!headerLinks) {
      // Some journal views render the lesson row inside <tbody> — same fallback
      // the lesson checkboxes use, so both features find the same cells.
      const inHead = utils.qsa('#journalList thead td.pt-point a[href*="schedule="]');
      const all = inHead.length ? inHead : utils.qsa('#journalList td.pt-point a[href*="schedule="]');
      headerLinks = new Map(all.map((link) => [scheduleOf(link), link]));
    }
    return headerLinks.get(String(scheduleId)) || null;
  }

  function scheduleOf(link) {
    return new URLSearchParams(link.getAttribute('href').split('?')[1] || '').get('schedule');
  }

  function markInput(student, index) {
    return index ? student.row.querySelector(`td:nth-child(${index}) input.mark-cell`) : null;
  }

  /* ------------------------------------------------------------------ *
   * Dialog
   * ------------------------------------------------------------------ */

  function clampGrade(value, min, max) {
    const grade = Number(value);
    if (!Number.isFinite(grade)) return '';
    return String(Math.min(Math.max(Math.round(grade), min), max));
  }

  function openDialog(scheduleId, dateLabel) {
    const students = journalStudents();
    const index = columnIndex(scheduleId);

    const urlInput = ui.input({
      type: 'url',
      placeholder: 'https://testix.com.ua/api/nz/assignment/…',
      value: links.get(scheduleId) || '',
    });

    const summary = ui.el('p', { class: 'nz-text nz-text--muted' });
    const missing = ui.el('p', { class: 'nz-text nz-text--muted', hidden: true });
    const rowsHost = ui.el('div', { class: 'nz-testix__rows' });
    const results = ui.el('section', { class: 'nz-testix', hidden: true }, [summary, missing, rowsHost]);

    let rows = []; // { select, grade, refresh }

    const load = ui.button({
      label: 'Завантажити результати',
      variant: 'primary',
      onClick: () => fetchResults(),
    });

    const apply = ui.button({
      label: 'Виставити оцінки',
      variant: 'primary',
      hidden: true,
      onClick: () => setMarks(),
    });

    const detach = ui.button({
      label: 'Відкріпити тест',
      hidden: !links.get(scheduleId),
      onClick: () => unpin(),
    });

    const dialog = ui.modal({
      eyebrow: dateLabel ? `Урок ${dateLabel}` : `Урок ${scheduleId}`,
      title: 'Інтеграція Testix',
      size: 'lg',
      body: [
        ui.field({
          label: 'Посилання на результати тесту. Отримати можна, натиснувши кнопку API в видачі тесту на Testix.com.ua',
          hint: 'Зберігається за цим уроком — наступного разу підставиться саме воно.',
          control: urlInput,
        }),
        results,
      ],
      footer: [ui.button({ label: 'Закрити', onClick: () => dialog.close() }), detach, load, apply],
    });

    if (!students.length) {
      ui.toast('У журналі не видно списку учнів — оцінки не буде куди виставляти.', { type: 'info' });
    }

    async function fetchResults() {
      const url = urlInput.value.trim();
      if (!url) {
        ui.toast('Додайте посилання на результати тесту.', { type: 'info' });
        return;
      }

      dialog.setBusy(true);
      try {
        if (url !== links.get(scheduleId)) {
          await net.testix.save(scheduleId, url);
          applyLink(scheduleId, url);
          detach.hidden = false;
        }
        render(await net.testix.results(url));
      } catch (error) {
        utils.error(error);
        ui.toast(hintFor(error, 'Результати не завантажилися. Перевірте посилання і спробуйте ще раз.'), { type: 'error' });
      } finally {
        dialog.setBusy(false);
      }
    }

    /** Empty url = the server drops the row, so the lesson has no test again. */
    async function unpin() {
      dialog.setBusy(true);
      try {
        await net.testix.save(scheduleId, '');
        applyLink(scheduleId, '');
        urlInput.value = '';
        rows = [];
        rowsHost.replaceChildren();
        results.hidden = true;
        apply.hidden = true;
        detach.hidden = true;
        load.textContent = 'Завантажити результати';
        ui.toast('Тест відкріплено від уроку.', { type: 'success' });
      } catch (error) {
        utils.error(error);
        ui.toast(hintFor(error, 'Не вдалося відкріпити тест. Спробуйте ще раз.'), { type: 'error' });
      } finally {
        dialog.setBusy(false);
      }
    }

    function render(data) {
      const { list, merged } = bestPerStudent(Array.isArray(data?.results) ? data.results : []);
      const min = Number(data?.assignment?.min_grade) || 1;
      const max = Number(data?.assignment?.max_grade) || 12;
      const title = data?.test?.title || data?.assignment?.title || 'Тест';

      rows = [];
      rowsHost.replaceChildren();
      results.hidden = false;

      summary.textContent =
        `${title} · ${list.length} ${utils.plural(list.length, 'результат', 'результати', 'результатів')} · оцінки від ${min} до ${max}` +
        (merged ? ` · ${merged} ${utils.plural(merged, 'повторне проходження', 'повторні проходження', 'повторних проходжень')} згорнуто до найвищого бала` : '');

      const absent = Array.isArray(data?.missing) ? data.missing : [];
      missing.hidden = !absent.length;
      missing.textContent = absent.length
        ? `Не проходили тест: ${absent.map((item) => item?.student || item).join(', ')}`
        : '';

      if (!list.length) {
        apply.hidden = true;
        ui.toast('У відповіді немає жодного результату.', { type: 'info' });
        return;
      }

      const options = [
        { value: '', label: '— пропустити —' },
        ...students.map((student) => ({ value: student.id, label: student.name })),
      ];

      const sorted = list
        .slice()
        .sort((a, b) => String(a.student || '').localeCompare(String(b.student || ''), 'uk'));

      for (const result of sorted) {
        const matched = matchStudent(result.student, students);

        const select = ui.select(
          {},
          options.map((option) => ({ ...option, selected: option.value === (matched?.id || '') }))
        );
        const grade = ui.input({
          type: 'number',
          min: String(min),
          max: String(max),
          class: 'nz-input nz-input--narrow',
          value: clampGrade(result.grade, min, max),
        });

        const attempts = Number(result.attempts) || 0;
        const hint = ui.el('span', { class: 'nz-testix__hint' });

        const row = ui.el('div', { class: 'nz-testix__row' }, [
          ui.el('span', { class: 'nz-testix__name' }, [
            String(result.student || '—'),
            attempts > 1
              ? ui.el('span', {
                  class: 'nz-testix__attempts',
                  text: ` · ${attempts} ${utils.plural(attempts, 'спроба', 'спроби', 'спроб')}`,
                })
              : null,
          ]),
          grade,
          select,
          hint,
        ]);

        const refresh = () => {
          const student = students.find((item) => item.id === select.value);
          const current = student ? markInput(student, index)?.value?.trim() : '';
          row.classList.toggle('is-unmatched', !select.value);
          hint.textContent = !select.value
            ? 'учня не знайдено — оберіть вручну'
            : current
              ? `у журналі вже ${current}`
              : '';
          hint.classList.toggle('is-warning', !select.value || Boolean(current));
        };

        select.addEventListener('change', refresh);
        refresh();

        rowsHost.append(row);
        rows.push({ select, grade });
      }

      apply.hidden = false;
      load.textContent = 'Оновити результати';
    }

    async function setMarks() {
      if (!index) {
        ui.toast('Стовпчик цього уроку не знайдено в таблиці оцінок. Оновіть сторінку.', { type: 'error' });
        return;
      }

      const planned = rows
        .map(({ select, grade }) => ({
          student: students.find((item) => item.id === select.value),
          grade: grade.value.trim(),
        }))
        .filter((item) => item.student && item.grade);

      if (!planned.length) {
        ui.toast('Немає жодної оцінки для виставлення.', { type: 'info' });
        return;
      }

      dialog.setBusy(true);
      const progress = ui.loader(`Виставляємо оцінки: 0 з ${planned.length}`);
      let done = 0;
      let failed = 0;

      for (const item of planned) {
        const input = markInput(item.student, index);
        if (input) {
          input.value = item.grade;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          failed += 1;
          utils.warn(`Клітинку оцінки не знайдено: ${item.student.name}`);
        }

        done += 1;
        progress.update(`Виставляємо оцінки: ${done} з ${planned.length}`);
        await utils.sleep(MARK_DELAY);
      }

      progress.close();
      dialog.setBusy(false);

      if (failed) {
        ui.toast(`${failed} з ${planned.length} не вдалося виставити — перевірте журнал.`, { type: 'error' });
        return;
      }

      ui.toast(`Виставлено ${planned.length} ${utils.plural(planned.length, 'оцінку', 'оцінки', 'оцінок')}.`, { type: 'success' });
      dialog.close();
    }
  }

  /* ------------------------------------------------------------------ *
   * Buttons: one in the homework row, one in the journal column header
   * ------------------------------------------------------------------ */

  function markButton(button, url) {
    const label = url ? 'Результати Testix прикріплені до уроку' : 'Прикріпити тест Testix до уроку';
    button.classList.toggle('has-link', Boolean(url));
    button.title = label;
    button.setAttribute('aria-label', label);
  }

  /** Single source of truth for a lesson: both buttons follow it. */
  function applyLink(scheduleId, url) {
    links.set(scheduleId, url);
    for (const button of rowButtons.get(scheduleId) || []) markButton(button, url);
    syncColumnButton(scheduleId, url);
  }

  /**
   * A lesson with a test gets a TX button in its journal column header, beside
   * the selection checkbox; unpinning the test takes the button away again.
   */
  function syncColumnButton(scheduleId, url) {
    const link = headerLink(scheduleId);
    const cell = link?.closest('td');
    if (!cell) return;

    const existing = cell.querySelector('.nz-testix-tx');
    if (!url) {
      existing?.remove();
      return;
    }
    if (existing) return;

    cell.append(
      ui.el(
        'button',
        {
          class: 'nz-testix-tx',
          type: 'button',
          title: 'Результати Testix для цього уроку',
          'aria-label': 'Результати Testix для цього уроку',
          dataset: { schedule: scheduleId },
          onClick: (e) => {
            e.preventDefault();
            e.stopPropagation(); // the header cell has its own menu
            openDialog(scheduleId, link.textContent.trim());
          },
        },
        ['TX']
      )
    );
  }

  function attach(row) {
    const cells = utils.qsa('.homework__item', row);
    const cell = cells[cells.length - 2]; // homework column, right before the last one
    const link = row.querySelector('.homework__item .modal-box');
    if (!cell || !link || cell.querySelector('.nz-testix-btn')) return null;

    const scheduleId = scheduleOf(link);
    if (!scheduleId) return null;

    const dateLabel = cells[1]?.textContent.trim();

    const button = ui.el('button', {
      class: 'nz-testix-btn',
      type: 'button',
      dataset: { schedule: scheduleId },
      onClick: (e) => {
        e.preventDefault();
        openDialog(scheduleId, dateLabel);
      },
    }, ['Testix']);

    markButton(button, '');
    cell.append(button);

    if (!rowButtons.has(scheduleId)) rowButtons.set(scheduleId, new Set());
    rowButtons.get(scheduleId).add(button);

    return { scheduleId, button };
  }

  /** Ask the server which lessons already have a test pinned, in one request. */
  async function preload(entries) {
    try {
      const ids = entries.map((entry) => entry.scheduleId);
      const bySchedule = new Map();

      for (let from = 0; from < ids.length; from += LIST_LIMIT) {
        const data = await net.testix.list(ids.slice(from, from + LIST_LIMIT));
        const items = Array.isArray(data?.items) ? data.items : [];
        for (const item of items) bySchedule.set(String(item.schedule), item.url || '');
      }

      for (const entry of entries) {
        applyLink(entry.scheduleId, bySchedule.get(String(entry.scheduleId)) || '');
      }
    } catch (error) {
      utils.warn('Прикріплені тести Testix не завантажилися', error);
    }
  }

  NZ.registry.register({
    id: 'testix-marks',

    match: (page) => page.has('.homework-row .homework__item .modal-box') && page.has('#journalList td.pt-theme'),

    init() {
      const entries = utils.qsa('.homework-row').map(attach).filter(Boolean);
      if (entries.length) preload(entries);
    },
  });
})();
