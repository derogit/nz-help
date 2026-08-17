/**
 * Module: quick replies.
 *
 * Keeps a personal list of phrases above the reply field; one click appends a
 * phrase to whatever is already typed.
 */
(() => {
  'use strict';

  const NZ = globalThis.NZ;
  const { utils, storage, ui } = NZ;

  async function readPhrases() {
    const phrases = await storage.get(storage.KEYS.quickReplies, []);
    return Array.isArray(phrases) ? phrases : [];
  }

  function insert(field, phrase) {
    const needsSpace = field.value.length > 0 && !/\s$/.test(field.value);
    field.value += (needsSpace ? ' ' : '') + phrase;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.focus();
  }

  function askForPhrase(onSave) {
    const input = ui.textarea({ rows: 3, placeholder: 'Дякую за роботу! Оцінка — у журналі.' });

    const save = ui.button({
      label: 'Додати фразу',
      variant: 'primary',
      onClick: () => {
        const value = input.value.trim();
        if (!value) {
          ui.toast('Спочатку введіть текст фрази.', { type: 'info' });
          return;
        }
        onSave(value);
        dialog.close();
      },
    });

    const dialog = ui.modal({
      title: 'Нова швидка відповідь',
      size: 'sm',
      body: [ui.field({ label: 'Текст фрази', control: input })],
      footer: [ui.button({ label: 'Скасувати', onClick: () => dialog.close() }), save],
    });
  }

  NZ.registry.register({
    id: 'quick-replies',

    match: (page) => page.has('.reply__text'),

    async init() {
      const field = utils.qs('.reply__text');
      let phrases = await readPhrases();

      const list = ui.el('div', { class: 'nz-chips' });

      const panel = ui.el('section', { class: 'nz-root nz-quick' }, [
        ui.el('header', { class: 'nz-quick__head' }, [
          ui.el('p', { class: 'nz-eyebrow', text: 'Швидка відповідь' }),
          ui.button({
            label: '+ Додати фразу',
            variant: 'quiet',
            onClick: () =>
              askForPhrase(async (value) => {
                phrases = [...phrases, value];
                await storage.set(storage.KEYS.quickReplies, phrases);
                render();
              }),
          }),
        ]),
        list,
      ]);

      function render() {
        list.replaceChildren();

        if (!phrases.length) {
          list.append(ui.el('p', { class: 'nz-text nz-text--muted', text: 'Фраз ще немає. Додайте ту, яку пишете найчастіше.' }));
          return;
        }

        phrases.forEach((phrase, index) => {
          list.append(
            ui.el('span', { class: 'nz-chip' }, [
              ui.el('button', {
                class: 'nz-chip__use',
                type: 'button',
                title: 'Вставити у відповідь',
                text: phrase,
                onClick: () => insert(field, phrase),
              }),
              ui.el('button', {
                class: 'nz-chip__remove',
                type: 'button',
                title: 'Видалити фразу',
                text: '✕',
                onClick: async () => {
                  phrases = phrases.filter((_, i) => i !== index);
                  await storage.set(storage.KEYS.quickReplies, phrases);
                  render();
                },
              }),
            ])
          );
        });
      }

      render();
      field.before(panel);
    },
  });
})();
