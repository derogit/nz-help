/**
 * Module: demo mode — hide marks.
 *
 * Blurs every grade in the journal so it can be shown on a projector or a shared
 * screen. The state is remembered across pages and tabs; the blur itself is pure
 * CSS (src/styles/marks-hidden.css), applied by a class on <html> that
 * src/content/marks-hidden-early.js sets before the page is painted.
 */
(() => {
  'use strict';

  const NZ = globalThis.NZ;
  const { utils, storage, ui } = NZ;

  const CLASS = 'nz-marks-hidden';
  const ACTION_ID = 'marks-hidden';

  NZ.registry.register({
    id: 'marks-hidden',

    match: (page) => page.has('td.pt-point, input.mark-cell'),

    async init() {
      let hidden = (await storage.get(storage.KEYS.marksHidden, false)) === true;

      const showButton = ui.el('button', {
        class: 'nz-marks-pill__action',
        type: 'button',
        text: 'Показати',
        onClick: () => toggle(false),
      });
      const pill = ui.el('div', { class: 'nz-root nz-marks-pill', hidden: true }, [
        ui.el('span', { class: 'nz-marks-pill__dot' }),
        ui.el('span', { text: 'Оцінки приховано' }),
        showButton,
      ]);
      document.body.append(pill);

      const apply = (isHidden) => {
        hidden = isHidden;
        document.documentElement.classList.toggle(CLASS, isHidden);
        pill.hidden = !isHidden;
        ui.launcher.setHint(ACTION_ID, isHidden ? 'Зараз приховані · Alt+Shift+H' : 'Розмити оцінки для показу · Alt+Shift+H');
      };

      const toggle = async (next = !hidden) => {
        apply(next);
        ui.toast(next ? 'Оцінки приховано — журнал можна показувати.' : 'Оцінки знову видно.', { type: 'info' });
        await storage.set(storage.KEYS.marksHidden, next);
      };

      ui.launcher.add({
        id: ACTION_ID,
        label: 'Режим демонстрації',
        onClick: () => toggle(),
      });

      document.addEventListener('keydown', (event) => {
        if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) return;
        // event.code, because Alt changes the produced character on macOS.
        if (event.code !== 'KeyH') return;
        event.preventDefault();
        toggle();
      });

      // Another tab switched the mode — follow it, so no tab is left showing marks.
      storage.onChange(storage.KEYS.marksHidden, (value) => apply(value === true));

      apply(hidden);
      if (hidden) utils.log('режим демонстрації: оцінки приховано');
    },
  });
})();
