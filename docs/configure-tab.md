# Configure tab

The Configure tab's sub-tabs and the Find offers panel.

## Configure sub-tabs

The Configure tab holds three views — Edit, Preview, HTML — behind an internal `.subtabs` nav (`setSubTab()`), not three separate top-level tabs. They used to be separate tabs; merged because all three already operated on the same `offers` array and already cross-linked (Preview's "View HTML →" button, still present, now calls `setSubTab('html')` instead of the old `setTab('html')`).

`setSubTab()` mirrors `setTab()`'s pattern exactly (toggle `.subpane`/`.subtab` `active` classes by name) but is a separate function/array (`['edit', 'preview', 'html']`) — `setTab()` itself now only knows about the four real top-level tabs (`configure`, `processor`, `article`, `live`) and has no awareness that Configure has sub-views at all. Don't merge these two functions or arrays; a sub-view name colliding with a future top-level tab name (or vice versa) would silently break the wrong one.

Re-rendering behavior is unchanged from when these were top-level tabs: `renderPreview()`/`renderHTMLOut()` run only on switching *into* that sub-view (inside `setSubTab()`), not live on every offers edit — except `setCardLayout()` (the Grid/Vertical toggle), which still eagerly re-renders both regardless of which sub-view is currently visible, exactly as it did before the merge.

`.subtab`/`.subtabs` (sidebar.css) are visually similar to `.sort-btn` (same pill shape, same active-fills-dark treatment) but are a deliberately separate class — `.sort-btn` means "sort/layout mode," `.subtab` means "which view is showing." Don't collapse them into one class; they're reused independently and a shared class would make a future style change to one silently affect the other.

## Find offers

The Edit sub-view's "Find offers to add" panel (a collapsed `<details id="find-panel">` under the ID box) exists because the slow part of building a card list is not typing IDs (`addOfferById()` already takes comma-separated IDs) but *finding* which offers to add. It searches the site's own content API, `https://api.dealnews.com/content` — the same feed `blog-slider`, the programmatic pages' offers and the standalone Live Feed generator (`index.html`) use — with the same shared, site-wide public key (`DN_CONTENT_API_AUTH`, the literal already in `index.html`; sent as `Authorization: DN <key>`). Using the site's feed instead of DatoCMS means the editor picks from the offers the site itself currently treats as live, and the "include expired" box is the same switch as the programmatic pages' "show expired" filter.

Query parameters used (found by probing the API on 2026-11-17, not from documentation, so they can change): `search` (words), `category_id`, `facet_ids`, `vendor_id` (any combination; at least one is required), `count` (page size, 30 here; the API accepts at least 100), `start` (offset, for "Load more"), and `expired=1` (include expired offers). The response's `content[].id` is the offer's **legacy ID** (the number in the offer page's URL), so ticked IDs feed straight into the numeric branch of `addOfferById()`, which resolves them with `resolveLegacyId()`. `additional_content_ids.length` is how many results remain; the response's `vendors` array (name, count, `vendor_id`) becomes the vendor chips — click one to filter to that vendor, click it again to clear.

`findAddSelected()` puts the ticked IDs in `#id-input` and calls `addOfferById()` rather than building offers itself, so progress text, "already added" detection, per-ID errors and the card format are all the existing code's. Rows whose legacy ID is already in `offers` show "added" and a disabled checkbox; "Select all" skips added and expired offers. Sorting (site order / hottest / ending soonest) is client-side over the loaded results; expired offers sort last. Result rows are built with DOM APIs and `.textContent` (no HTML strings) since the data comes from the network.

State is session-only (`findState`), like `offers`. Not verified end to end with a real DatoCMS management token (the add step ran against stubbed `resolveLegacyId()`/`fetchOffer()` in a test page); the search, paging, vendor chips, expired toggle, selection and dedupe were exercised against the live API.

### Store chips: only, exclude, clear

Each store chip cycles through three states by clicking: off, "only this store" (sets the Vendor ID box and searches again, server-side), "not this store" (`findState.excluded`, vendor_id → name), and back to off. A store that is "only" replaces any other "only" store. The content API has no exclude parameter and takes a single `vendor_id` (repeated, comma-separated and bracketed forms were tried on 2026-11-24: the last value wins or nothing matches; unknown parameters are ignored), so exclusion is client-side: results stay in `findState.items` and `findVisibleItems()` hides the excluded stores' offers, which makes un-excluding instant with no new search. Because hiding shrinks each page, `runFind()` keeps loading pages (at most `FIND_FILL_PASSES`) until `FIND_PAGE_SIZE` offers are visible or nothing is left. Excluded stores persist across searches in the session and stay in the chip list (crossed out) even when the current results have none, so there is always a way to clear them. The vendors array in the response is the full list for the query even when `vendor_id` is set, so the chips don't collapse when one is chosen. Excluding the only store while nothing else is being searched has nothing to search by, so it just hides what is loaded and says so.

### Export row: legacy IDs and Cards → HTML

Under the results, `#find-ids` shows the found offers as a comma-separated list of legacy IDs, the reverse of the IDs box above the panel. Its scope is the ticked offers when any are ticked, otherwise everything shown (excluded stores left out); only loaded offers are listed, and the label says how many are not loaded. **Copy IDs** copies that list. **Cards → HTML** puts the same IDs in `#id-input`, calls `addOfferById()` (so it needs the DatoCMS token like Add does) and opens the HTML sub-view; "already added" is not treated as a failure, but any other error keeps the Edit view open so it is seen.

