/**
 * Module: color marks for students.
 *
 * Click the student number to paint the row. Colors are stored per student id,
 * so a mark follows the student into every journal.
 * Values match the legacy Tampermonkey palette so imported marks stay valid.
 */
(() => {
  'use strict';

  const NZ = globalThis.NZ;
  const { utils, storage, ui } = NZ;

  const PALETTE = [
    { value: 'white', label: 'Без позначки' },
    { value: '#ccc', label: 'Сірий' },
    { value: '#ffdc9b', label: 'Жовтий' },
    { value: '#ffc6c6', label: 'Червоний' },
    { value: '#a7ffa7', label: 'Зелений' },
  ];

  function paint(row, color) {
    const cell = row.querySelectorAll('td')[1];
    if (!cell) return;
    cell.style.background = color && color !== 'white' ? `linear-gradient(to right, ${color}, #fff)` : '';
  }

  NZ.registry.register({
    id: 'students-highlight',

    match: (page) => page.has('#journalList tbody td[data-student-id]'),

    async init() {
      const colors = await storage.get(storage.KEYS.studentColors, {});

      for (const row of utils.qsa('#journalList tbody tr')) {
        const studentId = row.querySelector('td[data-student-id]')?.dataset.studentId;
        if (!studentId) continue;

        paint(row, colors[studentId]);

        const anchor = row.querySelector('td')?.querySelector('a');
        if (!anchor) continue;

        anchor.classList.add('nz-student-anchor');
        anchor.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();

          const swatches = PALETTE.map((color) =>
            ui.el('button', {
              class: `nz-swatch${(colors[studentId] || 'white') === color.value ? ' is-active' : ''}`,
              type: 'button',
              title: color.label,
              style: { background: color.value },
              onClick: async () => {
                if (color.value === 'white') delete colors[studentId];
                else colors[studentId] = color.value;

                paint(row, color.value);
                await storage.set(storage.KEYS.studentColors, colors);
                panel.close();
              },
            })
          );

          const panel = ui.popover(anchor, [
            ui.el('p', { class: 'nz-eyebrow', text: 'Позначка учня' }),
            ui.el('div', { class: 'nz-swatches' }, swatches),
          ]);
        });
      }
    },
  });
})();
