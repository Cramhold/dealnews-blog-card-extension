/* magic-link.js — turns a normal URL into a monetized DealNews link.
 *
 * Shared by the sidebar's Links tab (sidebar.js) and the service worker
 * (background.js, which answers requests from working-copy pages). No DOM, no
 * chrome.* calls: everything the caller owns (tokens, e-mail) is passed in.
 *
 * Flow, the same one the CMS plugin uses:
 *   1. POST the landing URL to the magic URL service. It answers with `vendor`
 *      (a DatoCMS record id), `monetized_url` and `program` (a JSON string with
 *      the chosen program and the programs on offer).
 *   2. Look the vendor up in DatoCMS to get its legacy id (the `vendor`
 *      attribute on the link).
 *   3. Build the anchor with the CMS attributes.
 *
 * Nothing here writes to DatoCMS. Links the service cannot monetize are
 * flagged, never guessed at.
 */
(function (root) {
  'use strict';

  const SERVICE  = 'https://url-service.dealnews.net/magic-url/dato-plugin/';
  const DATO_CDA = 'https://graphql.datocms.com/';
  const DATO_API = 'https://site-api.datocms.com';
  const BUTTON_CLASS = 'btn btn-cta bu-m-0';

  const vendorCache = new Map();

  function escAttr(v) {
    // Quotes and angle brackets only: the CMS plugin leaves "&" in URLs as it is.
    return String(v == null ? '' : v).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escText(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** "AWIN (Historical: 7d: 4.95%, ...)" -> "AWIN" */
  function cleanLabel(label) {
    return String(label == null ? '' : label).replace(/\s*\(Historical[^)]*\)/i, '').trim();
  }

  /** Accepts "example.com/x" as well as full URLs. Returns the URL as typed (with a scheme), or '' if it is not a web address. */
  function normalizeUrl(input) {
    let u = String(input || '').trim();
    if (!u) return '';
    if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
    try {
      const p = new URL(u);
      if (p.protocol !== 'http:' && p.protocol !== 'https:') return '';
      if (!p.hostname || p.hostname.indexOf('.') < 0) return '';
    } catch (e) { return ''; }
    return u;
  }

  /** The magic_url_info attribute: label without the (Historical...) part, then "(Default) - " and the program id. */
  function magicInfo(label, programId) {
    return cleanLabel(label) + ' (Default) - ' + programId;
  }

  /** The finished anchor as text. `button: true` adds the CTA classes. */
  function buildTag(o) {
    return '<a href="' + escAttr(o.href) + '" vendor="' + escAttr(o.vendor) + '" brand="0" category="0"' +
      ' landing_url="' + escAttr(o.landing) + '" magic_url_info="' + escAttr(o.info) + '"' +
      (o.button ? ' class="' + BUTTON_CLASS + '"' : '') + '>' + escText(o.text) + '</a>';
  }

  /** The attributes only, for code that sets them on an existing element. */
  function linkAttrs(o) {
    return {
      href: o.href, vendor: String(o.vendor), brand: '0', category: '0',
      landing_url: o.landing, magic_url_info: o.info,
    };
  }

  function sameUrl(a, b) {
    const n = s => String(s || '').trim().replace(/\/+$/, '').toLowerCase();
    return n(a) === n(b);
  }

  async function callService(landing, token, email, selection, options) {
    if (!token) throw new Error('No magic URL token saved yet.');
    const body = {
      environment: 'main',
      user_email: email || '',
      landing_url: landing,
      program: { selection: selection == null ? '' : selection, options: options || [] },
    };
    let res;
    try {
      res = await fetch(SERVICE, {
        method: 'POST',
        redirect: 'manual',
        headers: { 'Authorization': 'DNADMINAPI ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new Error('Could not reach the magic URL service (' + (e && e.message ? e.message : e) + ').');
    }
    if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) {
      throw new Error('The magic URL service sent us to a sign-in page, so it did not accept the token.');
    }
    if (!res.ok) throw new Error('The magic URL service answered ' + res.status + '.');
    let json;
    try { json = await res.json(); } catch (e) { throw new Error('The magic URL service sent something that is not JSON.'); }
    return json;
  }

  async function lookupVendor(vendorId, datoToken) {
    if (!vendorId) return null;
    const id = String(vendorId);
    if (vendorCache.has(id)) return vendorCache.get(id);
    if (!/^[\w-]+$/.test(id)) throw new Error('Unexpected vendor id from the service.');
    if (!datoToken) throw new Error('No DatoCMS token saved, so the vendor cannot be looked up.');
    let found = null, lastErr = null;
    try {
      const q = '{ allVendors(first: 1, filter: { id: { eq: "' + id + '" } }) { legacyId name } }';
      const res = await fetch(DATO_CDA, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + datoToken, 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Environment': 'main' },
        body: JSON.stringify({ query: q }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json && !json.errors) {
        const v = json.data && json.data.allVendors && json.data.allVendors[0];
        if (v && v.legacyId != null) found = { legacyId: v.legacyId, name: v.name || '' };
        else lastErr = 'not found';
      } else lastErr = (json && json.errors && json.errors[0] && json.errors[0].message) || ('DatoCMS ' + res.status);
    } catch (e) { lastErr = e && e.message ? e.message : String(e); }
    if (!found) {
      // Fall back to the record itself on the management API.
      try {
        const res = await fetch(DATO_API + '/items/' + encodeURIComponent(id), {
          headers: { 'Authorization': 'Bearer ' + datoToken, 'X-Api-Version': '3', 'Accept': 'application/json' },
        });
        if (res.ok) {
          const j = await res.json();
          const at = (j.data && j.data.attributes) || {};
          if (at.legacy_id != null) found = { legacyId: at.legacy_id, name: at.name || at.title || '' };
        }
      } catch (e) { /* keep lastErr */ }
    }
    if (!found) throw new Error('Could not find the vendor in DatoCMS (' + lastErr + ').');
    vendorCache.set(id, found);
    return found;
  }

  function parseProgram(raw) {
    let p = raw;
    if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { p = null; } }
    if (!p || typeof p !== 'object') return { selection: null, options: [] };
    const options = Array.isArray(p.options) ? p.options.map(o => ({ label: o.label, value: o.value })) : [];
    return { selection: p.selection === '' ? null : (p.selection == null ? null : p.selection), options };
  }

  /**
   * Resolve one landing URL.
   *  opts: { url, token, email, datoToken, selection? }  (selection: a program value the writer picked)
   * Returns { ok, landing, flags:[{code, level:'stop'|'note', msg}], ...details }.
   * `ok` is true only when there is no 'stop' flag, i.e. a finished tag can be built.
   */
  async function resolveLink(opts) {
    const landing = normalizeUrl(opts.url);
    const out = { ok: false, landing, flags: [], options: [] };
    if (!landing) { out.flags.push({ code: 'bad-url', level: 'stop', msg: 'That does not look like a web address.' }); return out; }
    let svc;
    try {
      svc = await callService(landing, opts.token, opts.email, null, []);
      let prog = parseProgram(svc.program);
      // The writer picked a program other than the default: ask again with their choice.
      if (opts.selection != null && opts.selection !== '' && prog.options.length && String(opts.selection) !== String(prog.selection) &&
          prog.options.some(o => String(o.value) === String(opts.selection))) {
        const v = prog.options.find(o => String(o.value) === String(opts.selection)).value;
        svc = await callService(landing, opts.token, opts.email, v, prog.options);
        prog = parseProgram(svc.program);
      }
      out.options = prog.options.map(o => ({ label: o.label, clean: cleanLabel(o.label), value: o.value }));
      out.selection = prog.selection;
      out.vendorId = svc.vendor || '';
      out.monetizedUrl = svc.monetized_url || '';
    } catch (e) {
      out.error = e && e.message ? e.message : String(e);
      out.flags.push({ code: 'service', level: 'stop', msg: out.error });
      return out;
    }

    if (!out.vendorId) out.flags.push({ code: 'no-vendor', level: 'stop', msg: 'The service found no vendor for this address, so it cannot be monetized here.' });
    if (out.selection == null || out.selection === '') {
      out.flags.push({ code: 'no-program', level: 'stop', msg: 'No affiliate program is set up for this address.' });
    } else {
      const sel = out.options.find(o => String(o.value) === String(out.selection));
      out.programId = out.selection;
      out.programLabel = sel ? sel.clean : '';
      if (!sel || !out.programLabel) out.flags.push({ code: 'no-label', level: 'stop', msg: 'The service did not name the program, so the info attribute cannot be filled in.' });
    }
    if (!out.monetizedUrl) out.flags.push({ code: 'no-url', level: 'stop', msg: 'The service sent no monetized address.' });
    else if (sameUrl(out.monetizedUrl, landing)) out.flags.push({ code: 'same-as-landing', level: 'stop', msg: 'The monetized address is the same as the one you gave, so nothing was added.' });
    if (out.options.length > 1 && out.selection != null && out.selection !== '') {
      out.flags.push({ code: 'many-programs', level: 'note', msg: out.options.length + ' programs are offered; using ' + (out.programLabel || 'the default') + '. Pick another if you need it.' });
    }

    if (out.vendorId) {
      try {
        const v = await lookupVendor(out.vendorId, opts.datoToken);
        out.vendorLegacyId = v.legacyId;
        out.vendorName = v.name;
      } catch (e) {
        out.flags.push({ code: 'vendor-lookup', level: 'stop', msg: e && e.message ? e.message : String(e) });
      }
    }

    out.ok = !out.flags.some(f => f.level === 'stop');
    if (out.ok) {
      out.href = out.monetizedUrl;
      out.info = magicInfo(out.programLabel, out.programId);
      out.attrs = linkAttrs({ href: out.href, vendor: out.vendorLegacyId, landing, info: out.info });
    }
    return out;
  }

  root.DNMagic = { resolveLink, buildTag, linkAttrs, normalizeUrl, cleanLabel, magicInfo, escText, escAttr, BUTTON_CLASS };
})(typeof self !== 'undefined' ? self : this);
