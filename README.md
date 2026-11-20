# DealNews Blog Card Editor

A Chrome sidebar extension for DealNews editorial use. It does three things:

1. **Card generator** — look up offers in DatoCMS and generate styled `.bu-card` HTML for longform articles.
2. **Article scanner** — read an article's HTML out of the CMS editor, check each deal card's expiration status against DatoCMS, flag/remove/reorder stale cards, and regenerate clean HTML to paste back in.
3. **Monetized links** — turn a normal web address into a monetized DealNews link (the sidebar's **Links** tab), and do the same from inside the SEO audit's HTML working copies. For the working copies, open `chrome://extensions`, click Details on this extension, and switch on **Allow access to file URLs**. The Links tab needs the magic URL token and your email once (saved only in this browser).

It's a plain Manifest V3 extension — vanilla JS/HTML/CSS, no build step, no dependencies.

## Installing

You can install it from a zip download (no git needed) or by cloning the repo. Both end the same way: you load a folder in Chrome.

### Option A: download a zip

1. Download the newest code: [dealnews-blog-card-extension main.zip](https://github.com/jramhold514/dealnews-blog-card-extension/archive/refs/heads/main.zip). (On the repo page this is **Code > Download ZIP**.)
2. Unzip it somewhere you'll leave it, for example `Documents\DealNews`. The zip unzips into a folder named `dealnews-blog-card-extension-main`; the extension is that folder, the one that has `manifest.json` directly inside it.
3. Go to Chrome's `chrome://extensions`, turn on **Developer mode** (top right), click **Load unpacked**, and select that folder.

### Option B: clone with git

```
git clone https://github.com/jramhold514/dealnews-blog-card-extension.git
```

Then do step 3 above, selecting the cloned folder.

### First use

1. Pin the extension and click its icon to open the sidebar.
2. Paste a DatoCMS read-only API token into the token field at the top of the sidebar (it's saved locally in your browser via `chrome.storage.sync` — never committed to this repo, never sent anywhere but DatoCMS).
3. For the **Links** tab, add the magic URL token and your email once. To use monetized links from the SEO audit's HTML working copies, open the extension's Details page at `chrome://extensions` and switch on **Allow access to file URLs**.

## Getting updates

Loading a folder in developer mode does not auto-update. The sidebar checks this repo's `main` branch and shows a yellow banner when a newer version is out; that's your cue to update.

**If you installed from a zip:** download the zip again and copy its files over the same folder you loaded before (replace everything when asked). Then click the reload icon (↻) on "DealNews Blog Card Editor" at `chrome://extensions`, and close and reopen the sidebar. Keep using the same folder: Chrome treats a different folder as a different extension, so your saved tokens would not carry over.

**If you cloned:**

```
git pull
```

Then reload it the same way.

## For contributors

See [CLAUDE.md](CLAUDE.md) for a detailed architecture reference, function-level rationale, and full version history — it's written for AI-assisted development but is equally useful as human documentation of *why* things work the way they do.

`manifest.json`'s `"version"` field is bumped for every behavior-changing commit; see CLAUDE.md's "Versioning" section for the convention.
