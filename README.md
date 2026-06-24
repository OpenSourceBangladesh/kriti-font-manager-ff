# কৃতি বাংলা ফন্ট ম্যানেজার
## Kriti: Bangla Font Manager — Firefox Extension

> Change any website's font to your favourite Bangla font, powered by the [Kriti CDN](https://kriti.app).

---

## ✨ Features

- 🔍 **Browse 200+ Bangla Fonts** — Searchable catalog from the Kriti font index.
- 🖼️ **2-Column Font Previews** — SVG previews loaded lazily for easy browsing.
- 🌐 **Strictly Per-Site Overrides** — Fonts are applied purely on an opt-in basis for the active tab's domain.
- 🛡️ **100% Icon Safe** — Uses advanced `@font-face` aliasing. Custom fonts are applied *only* to the Bengali Unicode range, preserving FontAwesome, Material Icons, and other glyphs perfectly.
- 🎚️ **Font Size Slider** — Scale fonts from 80% to 150%.
- ⚡ **CDN-Powered & Cached** — Fonts are served from Cloudflare Edge and CSS is cached locally for 7 days.
- 🎨 **Premium UI** — Dark glassmorphism design with micro-animations.
- 🏳️ **Bangladesh Flag Icon** — National pride in your toolbar.

---

## 📁 Project Structure

```text
kriti-font-manager/
├── manifest.json                 # Firefox WebExtension manifest (v3)
├── background/
│   └── service-worker.js         # Font index caching, CSS 7-day caching, and MV3 message handling
├── content/
│   └── content-script.js         # Dynamic CSSOM scanner and @font-face alias injection
├── popup/
│   ├── popup.html                # Extension popup UI
│   ├── popup.js                  # Auto-enabling popup logic
│   └── popup.css                 # Premium dark theme styles
└── icons/
    ├── icon.svg                  # Bangladesh flag vector
    ├── icon-16.png
    ├── icon-32.png
    ├── icon-48.png
    └── icon-128.png
```

---

## 🚀 Installation (Development)

1. Open Firefox and go to `about:debugging`
2. Click **"This Firefox"** → **"Load Temporary Add-on"**
3. Navigate to this folder and select `manifest.json`
4. The extension will appear in your toolbar with the 🇧🇩 flag icon

---

## 🔌 API & CDN

This extension uses the [Kriti.app](https://kriti.app) services:

| Resource | URL |
|---|---|
| Font Index | `https://kriti.app/metadata/index.json` |
| Font CSS | `https://kriti.app/cdn/<slug>.css` |
| Font Preview | `https://kriti.app/metadata/<slug>-preview.svg` |
| API Docs | `https://kriti.app/api-docs` |

All fonts are served via Cloudflare CDN with immutable caching and WOFF2 compression (60–70% smaller than TTF). 

---

## 🏗️ Architecture & How It Works

The extension is built for Firefox Manifest V3 and employs several robust best-practices to ensure high performance and flawless web compatibility:

1. **Background Caching**: The `service-worker.js` fetches the font catalog (`index.json`) and caches it for 1 hour. When a font is applied, its CSS is fetched from the Kriti CDN, relative URLs are dynamically rewritten to absolute paths, and the CSS text is cached in `browser.storage.local` for 7 days to bypass strict website CSPs.
2. **Opt-In Per-Site Storage**: When you click "Apply" in the popup, the font configuration is saved to `siteOverrides` tied strictly to the current domain. The master switch is auto-enabled if it was off.
3. **Dynamic CSSOM Font Scanner**: When `content-script.js` loads, it doesn't just blindly override the `font-family` property (which destroys icon fonts). Instead, it scans `document.fonts` and runs a targeted DOM sample to extract *every single font* currently being used by the website.
4. **`@font-face` Aliasing (Icon Protection)**: The content script generates invisible `@font-face` aliases for every font discovered on the page, pointing them to the Kriti font, but **strictly restricted to the Bengali Unicode Range (`U+0980-09FF`)**. This allows standard English text and icon libraries to fall through to the site's native fonts effortlessly.
5. **Multi-Lifecycle Re-Injection**: To combat complex Single Page Applications (SPAs) and asynchronously loaded Web Fonts, the font scanner re-runs and overwrites styles at `document_start`, `DOMContentLoaded`, `window.load`, and `document.fonts.ready`.
6. **Wake-up Retry Loops**: Implements retry loops for messaging the Firefox background Event Page, seamlessly handling suspension wake-up delays on newly opened tabs.

---

## 📜 License

Fonts are provided by [kriti.app](https://kriti.app) under their respective licenses (OFL, GPL, CC, Government).

Extension source: MIT
