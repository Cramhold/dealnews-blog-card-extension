importScripts('magic-link.js');

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.action.onClicked.addListener(tab => {
  chrome.sidePanel.open({ tabId: tab.id });
});

/* Monetized-link requests from working-copy pages (bridge.js forwards them).
 * The service worker makes the call so the page itself needs no CORS access,
 * and the tokens never leave the extension: a reply carries only the link. */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || (msg.type !== 'MAGIC_RESOLVE' && msg.type !== 'MAGIC_STATUS')) return;
  // Only the working-copy bridge (a file:// page) may ask.
  if (!sender || !sender.url || sender.url.indexOf('file://') !== 0) {
    sendResponse({ ok: false, error: 'Not allowed from this page.' });
    return;
  }
  (async () => {
    const local = await chrome.storage.local.get(['magicToken', 'magicEmail']);
    const sync  = await chrome.storage.sync.get(['datoToken']);
    if (msg.type === 'MAGIC_STATUS') {
      sendResponse({
        ok: true,
        version: chrome.runtime.getManifest().version,
        hasMagicToken: !!local.magicToken,
        hasEmail: !!local.magicEmail,
        hasDatoToken: !!sync.datoToken,
      });
      return;
    }
    const res = await DNMagic.resolveLink({
      url: msg.url,
      selection: msg.selection,
      token: local.magicToken,
      email: local.magicEmail,
      datoToken: sync.datoToken,
    });
    sendResponse(res);
  })().catch(e => sendResponse({ ok: false, error: e && e.message ? e.message : String(e), flags: [{ code: 'service', level: 'stop', msg: e && e.message ? e.message : String(e) }] }));
  return true; // answer asynchronously
});
