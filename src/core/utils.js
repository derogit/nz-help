/**
 * NZ Help — shared utilities.
 * Loaded first, creates the global `NZ` namespace inside the isolated world.
 */
(() => {
  'use strict';

  const NZ = (globalThis.NZ = globalThis.NZ || {});

  const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  const utils = {
    /**
     * Create an element from a compact description.
     * Supported props: class, text, html, style (object), dataset, on* handlers,
     * anything else becomes an attribute.
     */
    el(tag, props = {}, children = []) {
      const node = document.createElement(tag);

      for (const [key, value] of Object.entries(props)) {
        if (value === null || value === undefined || value === false) continue;

        if (key === 'class') node.className = value;
        else if (key === 'text') node.textContent = value;
        else if (key === 'html') node.innerHTML = value;
        else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
        else if (key === 'dataset') Object.assign(node.dataset, value);
        else if (key.startsWith('on') && typeof value === 'function') {
          node.addEventListener(key.slice(2).toLowerCase(), value);
        } else {
          node.setAttribute(key, value === true ? '' : value);
        }
      }

      for (const child of [].concat(children)) {
        if (child === null || child === undefined || child === false) continue;
        node.append(child.nodeType ? child : document.createTextNode(String(child)));
      }

      return node;
    },

    qs(selector, root = document) {
      return root.querySelector(selector);
    },

    qsa(selector, root = document) {
      return Array.from(root.querySelectorAll(selector));
    },

    /** Delegated event listener. */
    delegate(root, event, selector, handler) {
      const listener = (e) => {
        const target = e.target.closest(selector);
        if (target && root.contains(target)) handler(e, target);
      };
      root.addEventListener(event, listener);
      return () => root.removeEventListener(event, listener);
    },

    /** Read a query-string parameter of the current page. */
    param(name, search = location.search) {
      return new URLSearchParams(search).get(name);
    },

    /** Inject an extension stylesheet into the page (once per path). */
    injectStylesheet(path) {
      const href = chrome.runtime.getURL(path);
      if (document.querySelector(`link[href="${href}"]`)) return;
      document.head.append(utils.el('link', { rel: 'stylesheet', href }));
    },

    sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },

    /** Split a textarea value into trimmed, non-empty lines. */
    lines(value) {
      return String(value || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    },

    /** Normalize `dd.mm` / `d.m.yyyy` into `dd.mm.yyyy`. Returns null if unparsable. */
    normalizeDate(input) {
      const parts = String(input || '').trim().split('.');
      if (parts.length < 2) return null;

      const day = Number(parts[0]);
      const month = Number(parts[1]);
      const year = parts.length > 2 && parts[2] ? Number(parts[2]) : new Date().getFullYear();
      if (!day || !month || !year) return null;

      const date = new Date(year, month - 1, day);
      if (date.getDate() !== day || date.getMonth() !== month - 1) return null;

      return [String(day).padStart(2, '0'), String(month).padStart(2, '0'), String(year)].join('.');
    },

    /** Weekday key (`mon`…`sun`) for a `dd.mm.yyyy` string. */
    weekdayOf(dottedDate) {
      const [day, month, year] = String(dottedDate).split('.').map(Number);
      return WEEKDAYS[new Date(year, month - 1, day).getDay()];
    },

    /** `dd.mm.yyyy` → `yyyy-mm-dd`, the format the journal expects. */
    toIsoDate(dottedDate) {
      return String(dottedDate).split('.').reverse().join('-');
    },

    /** Pluralize Ukrainian nouns: plural(3, 'урок', 'уроки', 'уроків'). */
    plural(count, one, few, many) {
      const mod100 = count % 100;
      const mod10 = count % 10;
      if (mod100 >= 11 && mod100 <= 14) return many;
      if (mod10 === 1) return one;
      if (mod10 >= 2 && mod10 <= 4) return few;
      return many;
    },

    async copyToClipboard(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        // Clipboard API can be blocked when the document is not focused — fall back.
        const helper = utils.el('textarea', {
          text,
          style: { position: 'fixed', top: '-1000px', opacity: '0' },
        });
        document.body.append(helper);
        helper.select();
        const ok = document.execCommand('copy');
        helper.remove();
        return ok;
      }
    },

    log(...args) {
      console.log('%c[NZ Help]', 'color:#D6323C;font-weight:600', ...args);
    },

    warn(...args) {
      console.warn('[NZ Help]', ...args);
    },

    error(...args) {
      console.error('[NZ Help]', ...args);
    },
  };

  NZ.utils = utils;
})();
