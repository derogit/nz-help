/**
 * Module: preview student answers.
 *
 * Opens `/hometask/view-answer` in an overlay instead of navigating away, and
 * strips the site chrome inside the frame so only the answer is visible.
 */
(() => {
  'use strict';

  const NZ = globalThis.NZ;
  const { utils, ui } = NZ;

  const LINK_SELECTOR = 'a[href*="/hometask/view-answer"]';
  const HIDE_INSIDE_FRAME = ['.sidebar', '.header', '.footer'];

  function openPreview(url, title) {
    const frame = ui.el('iframe', {
      class: 'nz-frame',
      sandbox: 'allow-same-origin allow-scripts allow-forms',
      hidden: true,
    });

    const spinner = ui.el('div', { class: 'nz-frame__state' }, [
      ui.el('span', { class: 'nz-spinner' }),
      ui.el('span', { class: 'nz-text nz-text--muted', text: 'Завантажуємо відповідь…' }),
    ]);

    const failure = ui.el('div', { class: 'nz-frame__state', hidden: true }, [
      ui.el('p', { class: 'nz-text', text: 'Відповідь не відкрилася у вікні.' }),
      ui.el('a', { class: 'nz-btn nz-btn--primary', href: url, target: '_blank', rel: 'noopener', text: 'Відкрити в новій вкладці' }),
    ]);

    const openInTab = ui.el('a', {
      class: 'nz-btn nz-btn--quiet',
      href: url,
      target: '_blank',
      rel: 'noopener',
      text: 'Відкрити в новій вкладці',
    });

    const dialog = ui.modal({
      eyebrow: 'Домашнє завдання',
      title: title || 'Відповідь учня',
      size: 'xl',
      headActions: [openInTab],
      body: [ui.el('div', { class: 'nz-frame__wrap' }, [spinner, failure, frame])],
    });

    frame.addEventListener('load', () => {
      try {
        const location_ = frame.contentWindow.location.href;
        if (/login|signin/i.test(location_)) throw new Error('redirected to login');

        const doc = frame.contentDocument || frame.contentWindow.document;
        HIDE_INSIDE_FRAME.forEach((selector) => {
          doc.querySelectorAll(selector).forEach((node) => {
            node.style.display = 'none';
          });
        });

        spinner.hidden = true;
        frame.hidden = false;
      } catch (error) {
        utils.warn('Перегляд у вікні недоступний', error);
        spinner.hidden = true;
        failure.hidden = false;
      }
    });

    frame.src = url;
  }

  NZ.registry.register({
    id: 'homework-preview',

    match: (page) => page.path.startsWith('/hometask/'),

    init() {
      utils.delegate(document, 'click', LINK_SELECTOR, (event, link) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        openPreview(new URL(link.getAttribute('href'), location.origin).href, link.textContent.trim());
      });
    },
  });
})();
