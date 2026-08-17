/**
 * NZ Help — service worker.
 *
 * Owns every cross-origin request (the notes API), so content scripts never need
 * cross-origin permissions of their own. Message contract:
 *   { type: 'notes.get',  payload: { schedule } }        -> { ok, data }
 *   { type: 'notes.save', payload: { schedule, note } }  -> { ok, data }
 */

const NOTES_API = 'https://testix.com.ua/api/nz/schedule-notes/';

const HANDLERS = {
  'notes.get': ({ schedule }) => postForm(`${NOTES_API}get`, { schedule }),
  'notes.save': ({ schedule, note }) => postForm(`${NOTES_API}save`, { schedule, note }),
};

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
