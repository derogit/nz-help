/**
 * NZ Help — network layer.
 *
 * Same-origin nz.ua requests go straight from the content script (cookies and
 * session are the page's own). The external notes API is cross-origin, so those
 * calls are proxied through the service worker, which holds the host permission.
 */
(() => {
  'use strict';

  const NZ = (globalThis.NZ = globalThis.NZ || {});
  const { utils } = NZ;

  const ORIGIN = 'https://nz.ua';

  function absolute(url) {
    return url.startsWith('http') ? url : ORIGIN + (url.startsWith('/') ? url : `/${url}`);
  }

  function encode(data) {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(data)) {
      body.append(key, value === null || value === undefined ? '' : String(value));
    }
    return body.toString();
  }

  const net = {
    /** CSRF token the journal puts in the page head; required for every POST. */
    csrfToken() {
      return utils.qs('meta[name="csrf-token"]')?.getAttribute('content') || null;
    },

    /** Journal id of the currently open journal. */
    journalId() {
      return utils.qs('input[name="journal"]')?.value || utils.param('journal');
    },

    async getText(url) {
      const response = await fetch(absolute(url), { credentials: 'same-origin' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    },

    /** Fetch a journal page and return it as a parsed document for scraping. */
    async getDocument(url) {
      const html = await net.getText(url);
      return new DOMParser().parseFromString(html, 'text/html');
    },

    /** POST an urlencoded form the way the journal expects it. */
    async postForm(url, data) {
      const response = await fetch(absolute(url), {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: encode(data),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    },

    /** POST a form and parse the JSON answer; returns null for non-JSON bodies. */
    async postFormJson(url, data) {
      const text = await net.postForm(url, data);
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    },

    /**
     * Pull a human-readable message out of a Yii validation response
     * (the journal returns rendered HTML inside `response.html`).
     */
    errorFromHtml(html) {
      if (!html) return 'Невідома помилка';
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const message = doc.querySelector('.errorSummary li, .help-block')?.textContent?.trim();
      return message || 'Невідома помилка';
    },

    /** Notes API — proxied through the service worker. */
    notes: {
      async get(schedule) {
        return net.sendToWorker('notes.get', { schedule });
      },
      async save(schedule, note) {
        return net.sendToWorker('notes.save', { schedule, note });
      },
    },

    async sendToWorker(type, payload) {
      const response = await chrome.runtime.sendMessage({ type, payload });
      if (!response || !response.ok) throw new Error(response?.error || 'Немає зв’язку з розширенням');
      return response.data;
    },
  };

  NZ.net = net;
})();
