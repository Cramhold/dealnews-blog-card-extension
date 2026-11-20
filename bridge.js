/* bridge.js — lets a DealNews working-copy page ask this extension for monetized links.
 *
 * Injected into local files (file:///), which Chrome only allows after the
 * extension's "Allow access to file URLs" switch is turned on at
 * chrome://extensions. It does nothing unless the page declares itself a
 * working copy with <meta name="dn-working-copy">, and it only forwards two
 * message types to the service worker. The tokens stay in the extension.
 *
 * Page -> bridge:  window.postMessage({ dnWc: 'req', id, type, url?, selection? }, '*')
 * Bridge -> page:  window.postMessage({ dnWc: 'res', id, res }, '*')
 *                  window.postMessage({ dnWc: 'ready', version }, '*')   (once at load, and on request)
 */
(function () {
  'use strict';
  if (!document.querySelector('meta[name="dn-working-copy"]')) return;

  const ALLOWED = { MAGIC_RESOLVE: true, MAGIC_STATUS: true };

  function announce() {
    window.postMessage({ dnWc: 'ready', version: chrome.runtime.getManifest().version }, '*');
  }

  window.addEventListener('message', ev => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || d.dnWc !== 'req') return;
    if (d.type === 'PING') { announce(); return; }
    if (!ALLOWED[d.type]) {
      window.postMessage({ dnWc: 'res', id: d.id, res: { ok: false, error: 'Unknown request.' } }, '*');
      return;
    }
    const msg = { type: d.type };
    if (d.type === 'MAGIC_RESOLVE') {
      msg.url = typeof d.url === 'string' ? d.url.slice(0, 2000) : '';
      if (d.selection != null) msg.selection = d.selection;
    }
    chrome.runtime.sendMessage(msg, res => {
      const err = chrome.runtime.lastError;
      window.postMessage({ dnWc: 'res', id: d.id, res: res || { ok: false, error: err ? err.message : 'No answer from the extension.' } }, '*');
    });
  });

  announce();
})();
