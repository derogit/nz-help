/**
 * NZ Help — persistence layer.
 * Wraps chrome.storage so modules never care about areas or callbacks.
 * Shared between the content script and the options page.
 */
(() => {
  'use strict';

  const NZ = (globalThis.NZ = globalThis.NZ || {});

  const KEYS = {
    /** { [moduleId]: boolean } — which modules the user keeps enabled. */
    modules: 'modules',
    /** { [moduleId]: { [settingId]: value } } — per-module options declared in the catalog. */
    moduleSettings: 'moduleSettings',
    /** string[] — quick reply phrases. */
    quickReplies: 'quickReplies',
    /** last room chosen in the "add lesson columns" dialog. */
    roomId: 'roomId',
    /** { [journalId]: PlannedLesson[] } — topics and homework waiting for their lesson date. */
    lessonPlans: 'lessonPlans',
    /** { [studentId]: cssColor } */
    studentColors: 'studentColors',
    /** boolean — collapsed state of the site sidebar. */
    sidebarCollapsed: 'sidebarCollapsed',
    /** boolean — legacy Tampermonkey cookies already imported. */
    cookiesImported: 'cookiesImported',
  };

  // Small, user-level preferences sync across devices; bulk/local state stays local.
  const AREAS = {
    [KEYS.modules]: 'sync',
    [KEYS.moduleSettings]: 'sync',
    [KEYS.quickReplies]: 'sync',
    [KEYS.roomId]: 'sync',
    [KEYS.lessonPlans]: 'local',
    [KEYS.studentColors]: 'local',
    [KEYS.sidebarCollapsed]: 'local',
    [KEYS.cookiesImported]: 'local',
  };

  function areaFor(key) {
    return chrome.storage[AREAS[key] || 'local'];
  }

  const storage = {
    KEYS,

    async get(key, fallback = null) {
      const result = await areaFor(key).get(key);
      return result[key] === undefined ? fallback : result[key];
    },

    async set(key, value) {
      await areaFor(key).set({ [key]: value });
      return value;
    },

    async remove(key) {
      await areaFor(key).remove(key);
    },

    /** Subscribe to changes of a single key. Returns an unsubscribe function. */
    onChange(key, callback) {
      const listener = (changes, area) => {
        if (area !== (AREAS[key] || 'local') || !(key in changes)) return;
        callback(changes[key].newValue, changes[key].oldValue);
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    },

    /**
     * One-time import of data saved by the old Tampermonkey scripts,
     * so nobody loses their phrases, colors or last used room.
     */
    async importLegacyCookies() {
      if (await storage.get(KEYS.cookiesImported, false)) return;

      const readCookie = (name) => {
        const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
        return match ? decodeURIComponent(match[1]) : null;
      };
      const readJson = (name, fallback) => {
        try {
          const raw = readCookie(name);
          return raw ? JSON.parse(raw) : fallback;
        } catch {
          return fallback;
        }
      };

      const phrases = readJson('quick_responses', []);
      if (Array.isArray(phrases) && phrases.length) {
        const current = await storage.get(KEYS.quickReplies, []);
        if (!current.length) await storage.set(KEYS.quickReplies, phrases);
      }

      const colors = readJson('student_colors', {});
      if (colors && Object.keys(colors).length) {
        const current = await storage.get(KEYS.studentColors, {});
        if (!Object.keys(current).length) await storage.set(KEYS.studentColors, colors);
      }

      const room = readCookie('selectedRoom');
      if (room) await storage.set(KEYS.roomId, room);

      await storage.set(KEYS.cookiesImported, true);
    },
  };

  NZ.storage = storage;
})();
