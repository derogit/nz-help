/**
 * Module: delete selected lessons.
 *
 * Puts a checkbox into every lesson column header and deletes the checked ones
 * in one pass, instead of opening each lesson separately.
 */
(() => {
  'use strict';

  const NZ = globalThis.NZ;
  const { utils, net, ui } = NZ;

  const ACTION_ID = 'lesson-cleanup';

  function selected() {
    return utils.qsa('.nz-lesson-check.is-checked').map((box) => ({
      scheduleId: box.dataset.scheduleId,
      label: box.dataset.label || box.dataset.scheduleId,
    }));
  }

  function updateHint() {
    const count = selected().length;
    ui.launcher.setHint(
      ACTION_ID,
      count ? `Вибрано ${count} ${utils.plural(count, 'урок', 'уроки', 'уроків')}` : 'Спочатку відмітьте уроки в шапці журналу'
    );
  }

  /** Lesson columns live in <thead>; some journal views render that row in <tbody>. */
  function headerCells() {
    const inHead = utils.qsa('#journalList thead td.pt-point');
    if (inHead.length) return inHead;

    const firstRow = utils.qsa('#journalList tr').find((row) => row.querySelector('td.pt-point a[href*="schedule="]'));
    return firstRow ? utils.qsa('td.pt-point', firstRow) : [];
  }

  function addCheckboxes() {
    let added = 0;

    for (const cell of headerCells()) {
      if (cell.querySelector('.nz-lesson-check')) continue;

      const link = cell.querySelector('a[href*="schedule="]');
      if (!link) continue;

      const scheduleId = new URLSearchParams(link.getAttribute('href').split('?')[1] || '').get('schedule');
      if (!scheduleId) continue;

      // Not an <input>: the site hides bare checkboxes, so this is a button
      // carrying the checkbox role and its own tick mark.
      const box = ui.el('button', {
        type: 'button',
        class: 'nz-lesson-check',
        role: 'checkbox',
        'aria-checked': 'false',
        title: 'Відмітити урок',
        dataset: { scheduleId, label: link.textContent.trim() },
        onClick: (e) => {
          e.preventDefault();
          const checked = box.classList.toggle('is-checked');
          box.setAttribute('aria-checked', String(checked));
          updateHint();
        },
      });

      cell.prepend(box);
      added += 1;
    }

    return added;
  }

  async function removeSelected() {
    const lessons = selected();

    if (!lessons.length) {
      ui.toast('Відмітьте уроки в шапці журналу — і повторіть.', { type: 'info' });
      return;
    }

    const confirmed = await ui.confirm({
      title: `Видалити ${lessons.length} ${utils.plural(lessons.length, 'урок', 'уроки', 'уроків')}?`,
      text: 'Разом з уроком зникнуть оцінки та домашнє завдання в цьому стовпчику. Дію не можна скасувати.',
      confirmLabel: 'Видалити',
      danger: true,
    });
    if (!confirmed) return;

    const csrf = net.csrfToken();
    const progress = ui.loader(`Видаляємо: 0 з ${lessons.length}`);
    let done = 0;
    let failed = 0;

    for (const lesson of lessons) {
      try {
        await net.postForm('/journal/delete-lesson', { _csrf: csrf, schedule_id: lesson.scheduleId });
      } catch (error) {
        failed += 1;
        utils.error(`Не вдалося видалити урок ${lesson.label}`, error);
      }
      done += 1;
      progress.update(`Видаляємо: ${done} з ${lessons.length}`);
    }

    progress.close();

    if (failed) {
      ui.toast(`${failed} з ${lessons.length} не видалено. Перезавантажуємо журнал…`, { type: 'error' });
    } else {
      ui.toast('Уроки видалено. Перезавантажуємо журнал…', { type: 'success' });
    }
    setTimeout(() => location.reload(), 1400);
  }

  NZ.registry.register({
    id: ACTION_ID,

    match: (page) => Boolean(page.journalId) && !page.scheduleId && page.has('#journalList td.pt-point a[href*="schedule="]'),

    init() {
      if (!addCheckboxes()) {
        utils.warn('Шапку журналу не розпізнано — чекбокси уроків не додано');
        return;
      }

      ui.launcher.add({
        id: ACTION_ID,
        label: 'Видалити відмічені уроки',
        hint: 'Спочатку відмітьте уроки в шапці журналу',
        onClick: removeSelected,
      });
    },
  });
})();
