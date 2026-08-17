/**
 * Module: lesson notes.
 *
 * Adds a note button to every lesson row. Notes live on an external API, so they
 * follow the teacher between browsers; the request itself is made by the service
 * worker (the API is on another domain).
 */
(() => {
  'use strict';

  const NZ = globalThis.NZ;
  const { utils, net, ui } = NZ;

  const PREVIEW_LIMIT = 400;

  // Sheet with a folded corner and two text lines; inherits colour from the button.
  const NOTE_ICON = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/>
      <path d="M14 3v5h5"/>
      <path d="M8.5 13h7"/>
      <path d="M8.5 16.5h4.5"/>
    </svg>`;
  const cache = new Map(); // scheduleId -> note text ('' when empty)

  async function readNote(scheduleId) {
    if (cache.has(scheduleId)) return cache.get(scheduleId);

    try {
      const data = await net.notes.get(scheduleId);
      const note = typeof data?.note === 'string' ? data.note : '';
      cache.set(scheduleId, note);
      return note;
    } catch (error) {
      utils.warn(`Нотатку ${scheduleId} не завантажено`, error);
      return null;
    }
  }

  function markButton(button, note) {
    const label = note ? 'Нотатка до уроку' : 'Додати нотатку до уроку';
    button.classList.toggle('has-note', Boolean(note));
    button.title = label;
    button.setAttribute('aria-label', label);
  }

  function openEditor(scheduleId, button, dateLabel) {
    const editor = ui.textarea({ rows: 9, placeholder: 'Що варто пам’ятати про цей урок…' });
    editor.value = cache.get(scheduleId) || '';

    const save = ui.button({
      label: 'Зберегти нотатку',
      variant: 'primary',
      onClick: async () => {
        dialog.setBusy(true);
        try {
          await net.notes.save(scheduleId, editor.value);
          cache.set(scheduleId, editor.value);
          markButton(button, editor.value);
          ui.toast('Нотатку збережено.', { type: 'success' });
          dialog.close();
        } catch (error) {
          dialog.setBusy(false);
          utils.error(error);
          ui.toast('Нотатка не збереглася. Перевірте зв’язок і повторіть.', { type: 'error' });
        }
      },
    });

    const dialog = ui.modal({
      eyebrow: dateLabel || `Урок ${scheduleId}`,
      title: 'Нотатка до уроку',
      size: 'md',
      body: [
        ui.field({
          label: 'Текст нотатки',
          hint: 'Видно лише вам. Порожня нотатка прибирає позначку з кнопки.',
          control: editor,
        }),
      ],
      footer: [ui.button({ label: 'Скасувати', onClick: () => dialog.close() }), save],
    });
  }

  function attach(row) {
    const cell = row.querySelector('.homework__item');
    const link = cell?.querySelector('.modal-box');
    if (!link || cell.querySelector('.nz-note-btn')) return null;

    const scheduleId = new URLSearchParams(link.getAttribute('href').split('?')[1]).get('schedule');
    if (!scheduleId) return null;

    const dateLabel = row.querySelectorAll('.homework__item')[1]?.textContent.trim();

    const button = ui.el('button', {
      class: 'nz-note-btn',
      type: 'button',
      title: 'Нотатка до уроку',
      'aria-label': 'Нотатка до уроку',
      html: NOTE_ICON, // deliberate: an inline SVG is not worth building node by node
      dataset: { schedule: scheduleId },
      onClick: (e) => {
        e.preventDefault();
        openEditor(scheduleId, button, dateLabel);
      },
    });

    ui.tooltip(button, async () => {
      const note = await readNote(scheduleId);
      if (note === null) return 'Нотатку не вдалося завантажити';
      if (!note) return 'Нотатки ще немає — натисніть, щоб додати';
      return note.length > PREVIEW_LIMIT ? `${note.slice(0, PREVIEW_LIMIT)}…` : note;
    });

    link.after(button);
    return { scheduleId, button };
  }

  /** Preload notes with a small concurrency limit, so the highlight shows up fast. */
  async function preload(entries, limit = 4) {
    const queue = entries.slice();
    const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
      while (queue.length) {
        const entry = queue.shift();
        const note = await readNote(entry.scheduleId);
        if (note) markButton(entry.button, note);
      }
    });
    await Promise.all(workers);
  }

  NZ.registry.register({
    id: 'homework-notes',

    match: (page) => page.has('.homework-row .homework__item .modal-box'),

    init() {
      const entries = utils.qsa('.homework-row').map(attach).filter(Boolean);
      if (entries.length) preload(entries);
    },
  });
})();
