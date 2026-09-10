/**
 * Module: delete selected lessons.
 *
 * Puts a checkbox into every lesson column header and deletes the checked ones
 * in one pass, instead of opening each lesson separately. A master toggle next
 * to the lesson columns ticks or clears them all at once.
 */
(() => {
  'use strict';

  const NZ = globalThis.NZ;
  const { utils, net, ui } = NZ;

  const ACTION_ID = 'lesson-cleanup';
  const SELECT_ALL_ID = 'lesson-select-all';

  const boxes = () => utils.qsa('.nz-lesson-check');
  const checkedBoxes = () => utils.qsa('.nz-lesson-check.is-checked');

  function selected() {
    return checkedBoxes().map((box) => ({
      scheduleId: box.dataset.scheduleId,
      label: box.dataset.label || box.dataset.scheduleId,
    }));
  }

  function setChecked(box, checked) {
    box.classList.toggle('is-checked', checked);
    box.setAttribute('aria-checked', String(checked));
  }

  /** One place that redraws everything derived from the ticks. */
  function updateState() {
    const count = checkedBoxes().length;
    const total = boxes().length;

    ui.launcher.setHint(
      ACTION_ID,
      count ? `Вибрано ${count} ${utils.plural(count, 'урок', 'уроки', 'уроків')}` : 'Спочатку відмітьте уроки в шапці журналу'
    );
    ui.launcher.setHint(SELECT_ALL_ID, `Відмічено ${count} з ${total}`);
    master.sync();
  }

  /** Tick every lesson, or clear them all when nothing is left to tick. */
  function toggleAll() {
    const all = boxes();
    if (!all.length) return;

    const next = checkedBoxes().length < all.length;
    for (const box of all) setChecked(box, next);

    updateState();
    bubble.refresh();
  }

  /**
   * Floating "delete checked" button that hovers above the checkbox the teacher
   * ticked last, so the action is right where the eyes already are.
   */
  const bubble = (() => {
    let node = null;
    let anchor = null;

    function build() {
      node = ui.el('div', { class: 'nz-root nz-lesson-bulk', hidden: true }, [
        ui.button({ label: 'Видалити відмічене', variant: 'danger', onClick: removeSelected }),
      ]);
      document.body.append(node);

      // Capture phase: the journal table scrolls inside its own container.
      window.addEventListener('scroll', place, true);
      window.addEventListener('resize', place);
    }

    /** Anchor to the last ticked box; if it was unticked, fall back to the rightmost one. */
    function pickAnchor(box, checked) {
      if (checked) {
        anchor = box;
        return;
      }
      if (anchor !== box) return;
      anchor = lastChecked();
    }

    function lastChecked() {
      const ticked = checkedBoxes();
      return ticked[ticked.length - 1] || null;
    }

    function place() {
      if (!node || node.hidden || !anchor || !anchor.isConnected) return;
      const rect = anchor.getBoundingClientRect();
      node.style.left = `${rect.left + rect.width / 2 + window.scrollX}px`;
      node.style.top = `${rect.top + window.scrollY - 8}px`;
    }

    function show() {
      node.hidden = !anchor;
      if (!node.hidden) place();
    }

    function sync(box, checked) {
      if (!node) build();
      pickAnchor(box, checked);
      show();
    }

    /** Nobody clicked a particular box (select all / clear all) — re-derive the anchor. */
    function refresh() {
      if (!node) build();
      anchor = lastChecked();
      show();
    }

    return { sync, refresh };
  })();

  /**
   * Master toggle. Lives in the header cell right before the lesson columns, so
   * it lines up with the row of lesson checkboxes it controls.
   */
  const master = (() => {
    let node = null;

    function build() {
      node = ui.el(
        'button',
        {
          type: 'button',
          class: 'nz-select-all',
          role: 'checkbox',
          'aria-checked': 'false',
          title: 'Відмітити всі уроки',
          onClick: (e) => {
            e.preventDefault();
            toggleAll();
          },
        },
        [ui.el('span', { class: 'nz-select-all__box' }), ui.el('span', { text: 'Всі' })]
      );
      return node;
    }

    function mount() {
      // The cell before the first lesson column — the student name header.
      const host = headerCells()[0]?.previousElementSibling;
      if (!host || host.querySelector('.nz-select-all')) return;
      host.append(build());
    }

    function sync() {
      if (!node) return;

      const total = boxes().length;
      const count = checkedBoxes().length;
      const all = total > 0 && count === total;

      node.classList.toggle('is-checked', all);
      node.classList.toggle('is-partial', count > 0 && !all);
      node.setAttribute('aria-checked', all ? 'true' : count ? 'mixed' : 'false');
      node.title = all ? 'Зняти всі відмітки' : 'Відмітити всі уроки';
    }

    return { mount, sync };
  })();

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
          const checked = !box.classList.contains('is-checked');
          setChecked(box, checked);
          updateState();
          bubble.sync(box, checked);
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

      master.mount();

      ui.launcher.add({
        id: SELECT_ALL_ID,
        label: 'Відмітити всі уроки',
        hint: `Відмічено 0 з ${boxes().length}`,
        onClick: toggleAll,
      });

      ui.launcher.add({
        id: ACTION_ID,
        label: 'Видалити відмічені уроки',
        hint: 'Спочатку відмітьте уроки в шапці журналу',
        onClick: removeSelected,
      });
    },
  });
})();
