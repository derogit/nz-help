/**
 * NZ Help — UI kit.
 *
 * Every visible piece of the extension is built from these components so all
 * dialogs, buttons and messages look and behave the same way.
 */
(() => {
  'use strict';

  const NZ = (globalThis.NZ = globalThis.NZ || {});
  const utils = NZ.utils;
  const { el, qs } = utils;

  let uid = 0;
  const nextId = (prefix) => `${prefix}-${++uid}`;

  /* ------------------------------------------------------------------ *
   * Form controls
   * ------------------------------------------------------------------ */

  function button({ label, variant = 'ghost', onClick, type = 'button', ...rest }) {
    return el(
      'button',
      { class: `nz-btn nz-btn--${variant}`, type, onClick, ...rest },
      [label]
    );
  }

  function iconButton({ label, title, onClick, variant = 'plain' }) {
    return el('button', { class: `nz-icon-btn nz-icon-btn--${variant}`, type: 'button', title, 'aria-label': title, onClick }, [label]);
  }

  function input(props = {}) {
    return el('input', { class: 'nz-input', type: 'text', ...props });
  }

  function textarea(props = {}) {
    return el('textarea', { class: 'nz-input nz-textarea', rows: 6, ...props });
  }

  function select(props = {}, options = []) {
    const node = el('select', { class: 'nz-input nz-select', ...props });
    for (const option of options) {
      node.append(el('option', { value: option.value, selected: option.selected }, [option.label]));
    }
    return node;
  }

  /** Label + optional hint + control, laid out consistently. */
  function field({ label, hint, control, counter }) {
    const id = control.id || nextId('nz-field');
    control.id = id;

    return el('label', { class: 'nz-field', for: id }, [
      el('span', { class: 'nz-field__label' }, [label, counter || null]),
      control,
      hint ? el('span', { class: 'nz-field__hint', text: hint }) : null,
    ]);
  }

  /** Live line counter for textareas: returns { node, bind(textarea) }. */
  function lineCounter() {
    const node = el('span', { class: 'nz-counter', text: '0' });
    return {
      node,
      bind(target) {
        const update = () => {
          node.textContent = String(utils.lines(target.value).length);
        };
        target.addEventListener('input', update);
        update();
        return target;
      },
    };
  }

  /* ------------------------------------------------------------------ *
   * Modal
   * ------------------------------------------------------------------ */

  const openModals = [];

  function modal({ title, eyebrow, body = [], footer = [], headActions = [], size = 'md', onClose } = {}) {
    const bodyNode = el('div', { class: 'nz-modal__body' }, body);
    const footNode = el('footer', { class: 'nz-modal__foot' }, footer);

    const closeButton = iconButton({ label: '✕', title: 'Закрити', onClick: () => handle.close() });

    const dialog = el('div', { class: `nz-modal nz-modal--${size}`, role: 'dialog', 'aria-modal': 'true' }, [
      el('header', { class: 'nz-modal__head' }, [
        el('div', { class: 'nz-modal__heading' }, [
          eyebrow ? el('p', { class: 'nz-eyebrow', text: eyebrow }) : null,
          el('h2', { class: 'nz-modal__title', text: title || 'NZ Help' }),
        ]),
        el('div', { class: 'nz-modal__head-actions' }, [...headActions, closeButton]),
      ]),
      bodyNode,
      footer.length ? footNode : null,
    ]);

    const overlay = el('div', { class: 'nz-root nz-overlay' }, [dialog]);

    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) handle.close();
    });

    const onKeydown = (e) => {
      if (e.key === 'Escape' && openModals[openModals.length - 1] === handle) {
        e.stopPropagation();
        handle.close();
      }
    };

    const handle = {
      root: overlay,
      dialog,
      body: bodyNode,
      footer: footNode,
      close() {
        document.removeEventListener('keydown', onKeydown, true);
        const index = openModals.indexOf(handle);
        if (index > -1) openModals.splice(index, 1);
        overlay.classList.remove('is-visible');
        setTimeout(() => overlay.remove(), 200);
        onClose?.();
      },
      /** Disable the whole dialog while a batch of requests is running. */
      setBusy(busy) {
        dialog.classList.toggle('is-busy', Boolean(busy));
        dialog.querySelectorAll('button, input, select, textarea').forEach((control) => {
          if (control === closeButton) return;
          control.disabled = Boolean(busy);
        });
      },
    };

    document.body.append(overlay);
    document.addEventListener('keydown', onKeydown, true);
    openModals.push(handle);
    requestAnimationFrame(() => overlay.classList.add('is-visible'));

    dialog.querySelector('input, textarea, select, .nz-btn')?.focus?.();

    return handle;
  }

  function confirm({ title, text, confirmLabel = 'Підтвердити', cancelLabel = 'Скасувати', danger = false }) {
    return new Promise((resolve) => {
      let decided = false;
      const settle = (value) => {
        if (decided) return;
        decided = true;
        resolve(value);
        handle.close();
      };

      const handle = modal({
        title,
        size: 'sm',
        body: [el('p', { class: 'nz-text', text })],
        footer: [
          button({ label: cancelLabel, variant: 'ghost', onClick: () => settle(false) }),
          button({ label: confirmLabel, variant: danger ? 'danger' : 'primary', onClick: () => settle(true) }),
        ],
        onClose: () => settle(false),
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Toasts and blocking loader
   * ------------------------------------------------------------------ */

  function toastHost() {
    let host = qs('.nz-toasts');
    if (!host) {
      host = el('div', { class: 'nz-root nz-toasts' });
      document.body.append(host);
    }
    return host;
  }

  function toast(message, { type = 'info', timeout = 3200 } = {}) {
    const node = el('div', { class: `nz-toast nz-toast--${type}` }, [
      el('span', { class: 'nz-toast__mark' }),
      el('span', { text: message }),
    ]);

    toastHost().append(node);
    requestAnimationFrame(() => node.classList.add('is-visible'));

    const dismiss = () => {
      node.classList.remove('is-visible');
      setTimeout(() => node.remove(), 200);
    };
    setTimeout(dismiss, timeout);
    node.addEventListener('click', dismiss);

    return dismiss;
  }

  function loader(text = 'Зачекайте…') {
    const label = el('span', { class: 'nz-loader__text', text });
    const node = el('div', { class: 'nz-root nz-loader' }, [
      el('div', { class: 'nz-loader__card' }, [el('span', { class: 'nz-spinner' }), label]),
    ]);
    document.body.append(node);
    requestAnimationFrame(() => node.classList.add('is-visible'));

    return {
      update(nextText) {
        label.textContent = nextText;
      },
      close() {
        node.classList.remove('is-visible');
        setTimeout(() => node.remove(), 200);
      },
    };
  }

  /* ------------------------------------------------------------------ *
   * Log list — shared result panel for every batch operation
   * ------------------------------------------------------------------ */

  function logList({ title = 'Результати' } = {}) {
    const items = el('ol', { class: 'nz-log__items' });
    const meter = el('span', { class: 'nz-log__meter' });
    const bar = el('i', { class: 'nz-log__bar-fill' });

    const node = el('section', { class: 'nz-log', hidden: true }, [
      el('header', { class: 'nz-log__head' }, [el('p', { class: 'nz-eyebrow', text: title }), meter]),
      el('div', { class: 'nz-log__bar' }, [bar]),
      items,
    ]);

    let done = 0;
    let total = 0;
    let failed = 0;

    const render = () => {
      meter.textContent = total ? `${done} / ${total}${failed ? ` · ${failed} з помилкою` : ''}` : '';
      bar.style.width = total ? `${Math.round((done / total) * 100)}%` : '0%';
    };

    return {
      node,
      start(count) {
        total = count;
        done = 0;
        failed = 0;
        items.replaceChildren();
        node.hidden = false;
        render();
      },
      /** status: 'ok' | 'error' | 'info' */
      add(message, status = 'ok') {
        if (status !== 'info') {
          done += 1;
          if (status === 'error') failed += 1;
        }
        items.append(el('li', { class: `nz-log__item nz-log__item--${status}`, text: message }));
        items.scrollTop = items.scrollHeight;
        render();
      },
      get failed() {
        return failed;
      },
    };
  }

  /* ------------------------------------------------------------------ *
   * Page tools launcher (floating button, bottom right)
   * ------------------------------------------------------------------ */

  const launcher = (() => {
    let root = null;
    let menu = null;
    let badge = null;
    const actions = new Map();

    function build() {
      menu = el('div', { class: 'nz-launcher__menu', hidden: true }, [
        el('p', { class: 'nz-eyebrow', text: 'Інструменти сторінки' }),
      ]);
      badge = el('span', { class: 'nz-fab__badge' });

      const fab = el(
        'button',
        {
          class: 'nz-fab',
          type: 'button',
          title: 'Інструменти NZ Help',
          onClick: (e) => {
            e.stopPropagation();
            toggle();
          },
        },
        [el('span', { class: 'nz-fab__label', text: 'NZ' }), badge]
      );

      root = el('div', { class: 'nz-root nz-launcher' }, [menu, fab]);
      document.body.append(root);

      document.addEventListener('click', (e) => {
        if (!root.contains(e.target)) close();
      });
    }

    function toggle() {
      menu.hidden ? open() : close();
    }

    function open() {
      menu.hidden = false;
      requestAnimationFrame(() => root.classList.add('is-open'));
    }

    function close() {
      root?.classList.remove('is-open');
      setTimeout(() => {
        if (root && !root.classList.contains('is-open')) menu.hidden = true;
      }, 180);
    }

    return {
      /** Register a page-level tool. { id, label, hint, onClick } */
      add(action) {
        if (!root) build();
        if (actions.has(action.id)) return;

        const item = el('button', { class: 'nz-launcher__item', type: 'button', onClick: () => {
          close();
          action.onClick();
        } }, [
          el('span', { class: 'nz-launcher__label', text: action.label }),
          action.hint ? el('span', { class: 'nz-launcher__hint', text: action.hint }) : null,
        ]);

        actions.set(action.id, { action, item });
        menu.append(item);
        badge.textContent = String(actions.size);
      },

      /** Update the secondary line of an already registered tool. */
      setHint(id, hint) {
        const entry = actions.get(id);
        if (!entry) return;
        let hintNode = entry.item.querySelector('.nz-launcher__hint');
        if (!hintNode) {
          hintNode = el('span', { class: 'nz-launcher__hint' });
          entry.item.append(hintNode);
        }
        hintNode.textContent = hint;
      },

      close,
    };
  })();

  /* ------------------------------------------------------------------ *
   * Tooltip and popover
   * ------------------------------------------------------------------ */

  /**
   * Attach a hover tooltip to an element.
   * `resolve` may return a string or a promise of a string.
   */
  function tooltip(target, resolve) {
    let node = null;
    let token = 0;

    const place = () => {
      const rect = target.getBoundingClientRect();
      const box = node.getBoundingClientRect();
      const left = Math.min(Math.max(8, rect.left + rect.width / 2 - box.width / 2), window.innerWidth - box.width - 8);
      const above = rect.top > box.height + 16;
      node.style.left = `${left}px`;
      node.style.top = above ? `${rect.top - box.height - 8}px` : `${rect.bottom + 8}px`;
    };

    const show = async () => {
      const current = ++token;
      // mouseenter and focus can both fire for one interaction (hover, then a
      // click): drop the previous bubble instead of orphaning it in the DOM.
      node?.remove();
      node = el('div', { class: 'nz-root nz-tooltip', text: '…' });
      document.body.append(node);
      place();

      const text = await Promise.resolve(resolve());
      if (current !== token || !node) return;
      node.textContent = text || 'Порожньо';
      place();
      node.classList.add('is-visible');
    };

    const hide = () => {
      token += 1;
      node?.remove();
      node = null;
    };

    target.addEventListener('mouseenter', show);
    target.addEventListener('focus', show);
    target.addEventListener('mouseleave', hide);
    target.addEventListener('blur', hide);
    // A click usually opens something on top of the tooltip, and the pointer may
    // never leave the target afterwards — so no mouseleave would arrive.
    target.addEventListener('click', hide);

    return hide;
  }

  /** Small floating panel anchored to an element. */
  function popover(anchor, content) {
    const node = el('div', { class: 'nz-root nz-popover' }, content);
    document.body.append(node);

    const rect = anchor.getBoundingClientRect();
    const box = node.getBoundingClientRect();
    node.style.left = `${Math.min(rect.left, window.innerWidth - box.width - 8)}px`;
    node.style.top = `${rect.bottom + 6}px`;
    requestAnimationFrame(() => node.classList.add('is-visible'));

    const close = () => {
      document.removeEventListener('mousedown', onOutside, true);
      node.remove();
    };
    const onOutside = (e) => {
      if (!node.contains(e.target) && e.target !== anchor) close();
    };
    setTimeout(() => document.addEventListener('mousedown', onOutside, true), 0);

    return { node, close };
  }

  NZ.ui = {
    button,
    iconButton,
    input,
    textarea,
    select,
    field,
    lineCounter,
    modal,
    confirm,
    toast,
    loader,
    logList,
    launcher,
    tooltip,
    popover,
    el,
  };
})();
