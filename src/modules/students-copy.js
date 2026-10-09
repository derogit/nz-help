/**
 * Module: copy the student list.
 *
 * Grabs the names from the journal table and copies them one per line, with an
 * optional prefix and suffix (handy for numbering or building formulas). The
 * journal shows only surname and first name; the full name with patronymic is
 * read from each student's profile page on demand.
 */
(() => {
  'use strict';

  const NZ = globalThis.NZ;
  const { utils, ui, net } = NZ;

  /** Profiles fetched at once — enough to be quick without hammering the site. */
  const PROFILE_CONCURRENCY = 4;

  /** Profile link → full name; lives as long as the page, so reopening is instant. */
  const fullNames = new Map();

  function readStudents() {
    return utils
      .qsa('#journalList tbody tr td.pt-theme a')
      .map((link) => ({ name: link.textContent.trim(), href: link.getAttribute('href') || '' }))
      .filter((student) => student.name);
  }

  async function fetchFullName(href) {
    const doc = await net.getDocument(href);
    const name = doc.querySelector('.profile__name')?.textContent.replace(/\s+/g, ' ').trim();
    if (!name) throw new Error('На сторінці профілю немає імені');
    return name;
  }

  /** Fill the cache for every student that is not in it yet; returns how many failed. */
  async function loadFullNames(students, onProgress) {
    const queue = [...new Set(students.map((student) => student.href))].filter(
      (href) => href && !fullNames.has(href)
    );
    const total = queue.length;
    let done = 0;
    let failed = 0;

    onProgress(done, total);

    const workers = Array.from({ length: Math.min(PROFILE_CONCURRENCY, total) }, async () => {
      while (queue.length) {
        const href = queue.shift();
        try {
          fullNames.set(href, await fetchFullName(href));
        } catch (error) {
          failed += 1;
          utils.warn(`По батькові не отримано: ${href}`, error);
        }
        onProgress(++done, total);
      }
    });
    await Promise.all(workers);

    return failed;
  }

  function openDialog() {
    const students = readStudents();
    const count = students.length;

    if (!count) {
      ui.toast('У журналі не знайдено жодного учня.', { type: 'info' });
      return;
    }

    const before = ui.input({ placeholder: 'напр. «— »', maxlength: '40' });
    const after = ui.input({ placeholder: 'напр. « ;»', maxlength: '40' });
    const preview = ui.el('pre', { class: 'nz-preview' });

    const withPatronymic = ui.checkbox({
      label: 'З по батькові',
      hint: 'Повне ПІБ береться з профілю кожного учня — перший раз це займе кілька секунд.',
      onChange: async (checked) => {
        if (checked) await loadPatronymics();
        render();
      },
    });

    const displayName = (student) =>
      (withPatronymic.checked && fullNames.get(student.href)) || student.name;

    const compose = () => students.map((student) => `${before.value}${displayName(student)}${after.value}`);

    async function loadPatronymics() {
      dialog.setBusy(true);
      const failed = await loadFullNames(students, (done, total) => {
        preview.textContent = `Завантаження по батькові… ${done} з ${total}`;
      });
      dialog.setBusy(false);

      if (failed) {
        ui.toast(
          `Для ${failed} ${utils.plural(failed, 'учня', 'учнів', 'учнів')} по батькові не знайдено — лишилося ім’я з журналу. Спробуйте ще раз пізніше.`,
          { type: 'error', timeout: 6000 }
        );
      }
    }

    const render = () => {
      const list = compose();
      preview.textContent = list.slice(0, 5).join('\n') + (list.length > 5 ? `\n… ще ${list.length - 5}` : '');
    };

    before.addEventListener('input', render);
    after.addEventListener('input', render);
    render();

    const copy = ui.button({
      label: 'Копіювати список',
      variant: 'primary',
      onClick: async () => {
        const ok = await utils.copyToClipboard(compose().join('\n'));
        if (ok) {
          ui.toast(`Скопійовано ${count} ${utils.plural(count, 'рядок', 'рядки', 'рядків')}.`, { type: 'success' });
          dialog.close();
        } else {
          ui.toast('Браузер не дозволив копіювання. Виділіть текст у перегляді вручну.', { type: 'error' });
        }
      },
    });

    const dialog = ui.modal({
      eyebrow: `${count} ${utils.plural(count, 'учень', 'учні', 'учнів')}`,
      title: 'Копіювання списку учнів',
      size: 'md',
      body: [
        ui.el('div', { class: 'nz-row' }, [
          ui.field({ label: 'Текст перед прізвищем', control: before }),
          ui.field({ label: 'Текст після прізвища', control: after }),
        ]),
        withPatronymic,
        ui.el('p', { class: 'nz-eyebrow', text: 'Як це виглядатиме' }),
        preview,
      ],
      footer: [ui.button({ label: 'Закрити', onClick: () => dialog.close() }), copy],
    });
  }

  NZ.registry.register({
    id: 'students-copy',

    match: (page) => page.has('#journalList tbody td.pt-theme'),

    init() {
      ui.launcher.add({
        id: 'students-copy',
        label: 'Скопіювати список учнів',
        hint: 'З по батькові, текстом до і після прізвища',
        onClick: openDialog,
      });
    },
  });
})();
