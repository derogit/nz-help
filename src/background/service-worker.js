/**
 * NZ Help — service worker.
 *
 * Owns every cross-origin request (the notes and Testix APIs), so content scripts
 * never need cross-origin permissions of their own. Message contract:
 *   { type: 'notes.get',       payload: { schedule } }        -> { ok, data }
 *   { type: 'notes.save',      payload: { schedule, note } }  -> { ok, data }
 *   { type: 'testix.get',      payload: { schedule } }        -> { ok, data }
 *   { type: 'testix.save',     payload: { schedule, url } }   -> { ok, data }
 *   { type: 'testix.list',     payload: { schedules } }       -> { ok, data }
 *   { type: 'testix.results',  payload: { url } }             -> { ok, data }
 */

const API_HOST = 'testix.com.ua';
const NOTES_API = `https://${API_HOST}/api/nz/schedule-notes/`;
const TESTIX_API = `https://${API_HOST}/api/nz/schedule-tests/`;

const HANDLERS = {
  'notes.get': ({ schedule }) => postForm(`${NOTES_API}get`, { schedule }),
  'notes.save': ({ schedule, note }) => postForm(`${NOTES_API}save`, { schedule, note }),
  'testix.get': ({ schedule }) => postForm(`${TESTIX_API}get`, { schedule }),
  'testix.save': ({ schedule, url }) => postForm(`${TESTIX_API}save`, { schedule, url }),
  'testix.list': ({ schedules }) => postForm(`${TESTIX_API}list`, { schedules }),
  'testix.results': ({ url }) => getJson(url),
};

/**
 * Fetch a teacher-supplied results link. Only the API host is allowed: it is the
 * single cross-origin host in the manifest, and an unchecked URL here would turn
 * the worker into an open proxy.
 */
async function getJson(url) {
  let target;
  try {
    target = new URL(url);
  } catch {
    throw new Error('Посилання некоректне');
  }
  if (target.protocol !== 'https:' || target.hostname !== API_HOST) {
    throw new Error(`Дозволені лише посилання з https://${API_HOST}`);
  }

  const response = await fetch(target.href, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Сервер повернув не JSON');
  }
}

async function postForm(url, data) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) body.append(key, value ?? '');

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: body.toString(),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, raw: text };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = HANDLERS[message?.type];
  if (!handler) return false;

  handler(message.payload || {})
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true; // keep the channel open for the async answer
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
