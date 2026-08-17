/**
 * Module: copy the student list.
 *
 * Grabs the names from the journal table and copies them one per line, with an
 * optional prefix and suffix (handy for numbering or building formulas).
 */
(() => {
  'use strict';

  const NZ = globalThis.NZ;
  const { utils, ui } = NZ;

  function readNames() {
    return utils
      .qsa('#journalList tbody tr td.pt-theme a')
      .map((link) => link.textContent.trim())
      .filter(Boolean);
  }

  function openDialog() {
    const names = readNames();

    if (!names.length) {
      ui.toast('У журналі не знайдено жодного учня.', { type: 'info' });
      return;
    }

    const before = ui.input({ placeholder: 'напр. «— »', maxlength: '40' });
    const after = ui.input({ placeholder: 'напр. « ;»', maxlength: '40' });
    const preview = ui.el('pre', { class: 'nz-preview' });

    const compose = () => names.map((name) => `${before.value}${name}${after.value}`);

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
          ui.toast(`Скопійовано ${names.length} ${utils.plural(names.length, 'рядок', 'рядки', 'рядків')}.`, { type: 'success' });
          dialog.close();
        } else {
          ui.toast('Браузер не дозволив копіювання. Виділіть текст у перегляді вручну.', { type: 'error' });
        }
      },
    });

    const dialog = ui.modal({
      eyebrow: `${names.length} ${utils.plural(names.length, 'учень', 'учні', 'учнів')}`,
      title: 'Копіювання списку учнів',
      size: 'md',
      body: [
        ui.el('div', { class: 'nz-row' }, [
          ui.field({ label: 'Текст перед прізвищем', control: before }),
          ui.field({ label: 'Текст після прізвища', control: after }),
        ]),
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
        hint: 'З текстом до і після прізвища',
        onClick: openDialog,
      });
    },
  });
})();
