# কৃতি বাংলা ফন্ট ম্যানেজার
## Kriti: Bangla Font Manager — Firefox Extension

> Change any website's font to your favourite Bangla font, powered by the [Kriti CDN](https://kriti.app). 
> Built specifically for Firefox Manifest V3 with advanced Content Security Policy (CSP) bypassing and 100% safe icon rendering!

---

## ✨ Features

- 🔍 **Unicode Bangla Fonts Only** — Seamlessly browse 200+ clean Unicode Bengali fonts, filtered directly from the Kriti API.
- 🎯 **Interactive Element Picker** — Manually select and force fonts onto stubborn UI elements, just like the uBlock Origin element picker!
- 🛡️ **100% Icon Safe (`@font-face` Aliasing)** — The extension uses an advanced Dynamic DOM/CSSOM Scanner to inject hidden `@font-face` aliases restricted to the Bengali Unicode Range (`U+0980-09FF`). This guarantees your FontAwesome and Material Icons will **never** break or turn into gibberish!
- 🌐 **Strict Per-Site Memory** — Fonts are applied strictly per-domain. Setting a font on Facebook will not accidentally activate it on YouTube.
- 🔓 **Strict CSP Bypass (Base64 Embedding)** — Major websites like Facebook and BBC block external fonts using strict Content Security Policies. Kriti intelligently downloads the `.woff2` font and embeds it as raw Base64 binary directly into the CSS, forcing the browser to render it!
- 🎚️ **Font Size Slider** — Scale your Bengali fonts from 70% to 150%.
- 🎨 **Premium Minimalist UI** — Dark glassmorphism design with a fast 2-column font preview grid.
- 🏳️ **Bangladesh Flag Icon** — National pride right in your browser toolbar, featuring a dynamic active status badge.

---

## 📁 Project Structure

```
kriti-font-manager/
├── manifest.json                 # Firefox WebExtension manifest (v3)
├── background/
│   └── service-worker.js         # CSP Base64 encoding, 7-day caching, and MV3 async messaging
├── content/
│   └── content-script.js         # Dynamic CSSOM font scanner, @font-face injection, Element Picker UI
├── popup/
│   ├── popup.html                # Minimalist 2-column extension UI
│   ├── popup.js                  # Search, filter, and apply logic
│   └── popup.css                 # Premium dark theme styles
└── icons/
    ├── icon.svg                  # Bangladesh flag vector
    └── icon-16/32/48/128.png
```

---

## 🚀 Installation (Development)

1. Open Firefox and go to `about:debugging`
2. Click **"This Firefox"** → **"Load Temporary Add-on"**
3. Navigate to this folder and select `manifest.json`
4. The extension will appear in your toolbar with the 🇧🇩 flag icon. The default font is set to **BCC Purno Black**.

---

## 🔌 API & CDN

This extension uses the [Kriti.app](https://kriti.app) services:

| Resource | URL |
|---|---|
| Font Index | `https://kriti.app/metadata/search-index.json` |
| Font CSS | `https://kriti.app/cdn/<slug>.css` |
| Font Preview | `https://kriti.app/metadata/<slug>-preview.svg` |
| API Docs | `https://kriti.app/api-docs` |

All fonts are served via Cloudflare CDN with immutable caching and WOFF2 compression (60–70% smaller than TTF).

---

## 🏗️ How It Works (Advanced Architecture)

1. **Background Worker** fetches the font index on install and caches it. It filters out non-Unicode fonts.
2. When you pick a font, the background downloads the `.woff2` file from Kriti and converts it to a Base64 string to bypass strict CSPs. The final Base64 CSS is cached locally for 7 days.
3. The **Content Script** injects into every page. It uses a **Dynamic Font Scanner** to probe the website's DOM and loaded web fonts (`document.fonts`).
4. It dynamically generates `@font-face` aliases for every single font actively used on the page. These aliases are restricted using `unicode-range: U+0980-09FF`, ensuring English text and Icons are ignored, and only Bengali characters are replaced!
5. **Element Picker:** A custom interactive overlay allows users to generate robust CSS selectors by clicking elements on the page. These selectors are saved and forcefully injected with `!important` to handle edge cases.

---

## 📜 License

Fonts are provided by [kriti.app](https://kriti.app) under their respective licenses (OFL, GPL, CC, Government).

Extension source: MIT
