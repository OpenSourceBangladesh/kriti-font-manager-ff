/**
 * Kriti Bangla Font Manager — Background Service Worker v3.1
 * Uses index.json, unicode-only fonts.
 */

const KRITI_BASE       = 'https://kriti.app';
const INDEX_URL        = `${KRITI_BASE}/metadata/index.json`;
const INDEX_TTL_MS     = 60 * 60 * 1000;           // 1 hour
const FONT_CSS_TTL_MS  = 7 * 24 * 60 * 60 * 1000;  // 7 days

// ─── Priority Fonts ───────────────────────────────────────────────────────────
const PRIORITY_FONT_SLUGS = [
  'bb5d26a6', // BCC Purno Black
  '9bf9b20f', // BCC Purno Regular
  '128d8e0e', // BCC Purno Bold
  '8b71f854', // BCC Purno Semibold
  '2197ceac', // July Regular
  '7b6654b6', // July Bold
  '60476385', // July Italic
  '1c2a89e9', // July Bold-Italic
  '9677447a', // Hind Siliguri Regular
  '364d6b7e', // Hind Siliguri Medium
  '195d9aa3', // Hind Siliguri Bold
];

// ─── Default Font ─────────────────────────────────────────────────────────────
const DEFAULT_FONT = {
  slug:       'bb5d26a6',
  name:       'BCC Purno Black',
  familyName: 'BCC Purno',
  licenseType:'Government',
  previewUrl: '/metadata/bb5d26a6-preview.svg',
  hasLatin:   true,
  hasBengali: true
};

// ─── Font Index Cache ──────────────────────────────────────────────────────────

async function getFontIndex() {
  const stored = await browser.storage.local.get(['fontIndex', 'fontIndexCachedAt']);
  const now = Date.now();

  if (stored.fontIndex && stored.fontIndexCachedAt &&
      (now - stored.fontIndexCachedAt) < INDEX_TTL_MS) {
    return stored.fontIndex;
  }

  try {
    const resp = await fetch(INDEX_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const raw = await resp.json();

    // Filter: unicode fonts only, no ansi
    const filtered = raw
      .filter(f => f.fontType === 'unicode')
      .map(f => {
        const priority = PRIORITY_FONT_SLUGS.indexOf(f.slug);
        return {
          s: f.slug,
          n: f.name,
          f: f.familyName,
          p: f.previewUrl,
          l: f.licenseType,
          priority
        };
      });

    // Sort: priority first, then A-Z
    filtered.sort((a, b) => {
      if (a.priority >= 0 && b.priority >= 0) return a.priority - b.priority;
      if (a.priority >= 0) return -1;
      if (b.priority >= 0) return 1;
      return (a.n || '').localeCompare(b.n || '');
    });

    await browser.storage.local.set({ fontIndex: filtered, fontIndexCachedAt: now });
    return filtered;
  } catch (err) {
    console.error('[Kriti] Failed to fetch font index:', err);
    return stored.fontIndex || [];
  }
}

// ─── Font CSS Cache ───────────────────────────────────────────────────────────

async function getFontCss(slug) {
  const cKey  = `css_v2_${slug}`;
  const atKey = `css_v2_${slug}_at`;
  const stored = await browser.storage.local.get([cKey, atKey]);
  const now = Date.now();

  if (stored[cKey] && stored[atKey] && (now - stored[atKey]) < FONT_CSS_TTL_MS) {
    return stored[cKey];
  }

  try {
    const resp = await fetch(`${KRITI_BASE}/cdn/${slug}.css`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    let css = await resp.text();
    // Fix relative paths from the CDN CSS to absolute URLs
    css = css.replace(/url\(['"]?\/cdn\//g, `url('${KRITI_BASE}/cdn/`);
    await browser.storage.local.set({ [cKey]: css, [atKey]: now });
    return css;
  } catch (err) {
    console.error('[Kriti] Failed to fetch font CSS for', slug, err);
    return null;
  }
}

// ─── Settings ─────────────────────────────────────────────────────────────────

async function getSettings() {
  const r = await browser.storage.local.get([
    'enabled', 'globalFont', 'siteOverrides', 'fontSize', 'applyScope'
  ]);
  return {
    enabled:       r.enabled !== false,
    globalFont:    r.globalFont   || null,
    siteOverrides: r.siteOverrides || {},
    fontSize:      r.fontSize     || 100,
    applyScope:    r.applyScope   || 'all'
  };
}

async function getFontForHost(hostname) {
  const s = await getSettings();
  if (!s.enabled) return null;
  return s.siteOverrides[hostname] || s.globalFont;
}

// ─── Badge ────────────────────────────────────────────────────────────────────

async function updateBadge(tabId, tabUrl) {
  try {
    const url = new URL(tabUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      await browser.action.setBadgeText({ text: '', tabId });
      return;
    }
    const s        = await getSettings();
    const fontData = await getFontForHost(url.hostname);
    if (s.enabled && fontData) {
      await browser.action.setBadgeText({ text: 'ক', tabId });
      await browser.action.setBadgeBackgroundColor({ color: '#006A4E', tabId });
      await browser.action.setBadgeTextColor({ color: '#FFFFFF', tabId });
    } else {
      await browser.action.setBadgeText({ text: '', tabId });
    }
  } catch (_) {}
}

// ─── Apply Font to Tab ────────────────────────────────────────────────────────

async function applyFontToTab(tabId, tabUrl) {
  try {
    const url = new URL(tabUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return;

    const s        = await getSettings();
    const fontData = await getFontForHost(url.hostname);

    await browser.tabs.sendMessage(tabId, {
      type:      'KRITI_APPLY_FONT',
      fontData,
      enabled:   s.enabled,
      fontSize:  s.fontSize,
      applyScope:s.applyScope
    });
    await updateBadge(tabId, tabUrl);
  } catch (_) {}
}

// ─── Tab Listeners ────────────────────────────────────────────────────────────

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url)  applyFontToTab(tabId, tab.url);
  if (changeInfo.status === 'complete' && tab.url) updateBadge(tabId, tab.url);
});

browser.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await browser.tabs.get(tabId);
  if (tab.url) { applyFontToTab(tabId, tab.url); updateBadge(tabId, tab.url); }
});

// ─── Messages ─────────────────────────────────────────────────────────────────

browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_FONT_INDEX') {
    getFontIndex().then(sendResponse);
    return true; // Async response
  }
  if (msg.type === 'GET_SETTINGS') {
    getSettings().then(sendResponse);
    return true;
  }
  if (msg.type === 'GET_FONT_CSS') {
    getFontCss(msg.slug).then(sendResponse);
    return true;
  }
  if (msg.type === 'GET_FONT_FOR_HOST') {
    getFontForHost(msg.hostname).then(sendResponse);
    return true;
  }
  if (msg.type === 'SET_GLOBAL_FONT') {
    browser.storage.local.set({ globalFont: msg.fontData }).then(() => {
      if (msg.fontData?.slug) getFontCss(msg.fontData.slug);
      broadcastFontUpdate();
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg.type === 'SET_SITE_FONT') {
    browser.storage.local.get('siteOverrides').then(({ siteOverrides = {} }) => {
      if (msg.fontData) siteOverrides[msg.hostname] = msg.fontData;
      else delete siteOverrides[msg.hostname];
      return browser.storage.local.set({ siteOverrides });
    }).then(() => {
      if (msg.fontData?.slug) getFontCss(msg.fontData.slug);
      broadcastFontUpdate();
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg.type === 'SET_ENABLED') {
    browser.storage.local.set({ enabled: msg.enabled }).then(() => {
      broadcastFontUpdate();
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg.type === 'SET_FONT_SIZE') {
    browser.storage.local.set({ fontSize: msg.fontSize }).then(() => {
      broadcastFontUpdate();
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg.type === 'SET_APPLY_SCOPE') {
    browser.storage.local.set({ applyScope: msg.applyScope }).then(() => {
      broadcastFontUpdate();
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg.type === 'CLEAR_SITE_OVERRIDE') {
    browser.storage.local.get('siteOverrides').then(({ siteOverrides = {} }) => {
      delete siteOverrides[msg.hostname];
      return browser.storage.local.set({ siteOverrides });
    }).then(() => {
      broadcastFontUpdate();
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg.type === 'RESET_ALL') {
    browser.storage.local.get(null).then(keys => {
      const toRemove = Object.keys(keys).filter(k => !k.startsWith('css_v2_') && !k.startsWith('fontIndex'));
      return browser.storage.local.remove(toRemove);
    }).then(() => {
      broadcastFontUpdate();
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg.type === 'EVICT_CSS_CACHE') {
    browser.storage.local.get(null).then(keys => {
      const cssKeys = Object.keys(keys).filter(k => k.startsWith('css_v2_'));
      if (cssKeys.length) return browser.storage.local.remove(cssKeys);
    }).then(() => sendResponse({ ok: true }));
    return true;
  }
});

// ─── Broadcast ────────────────────────────────────────────────────────────────

async function broadcastFontUpdate() {
  const tabs = await browser.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  for (const tab of tabs) applyFontToTab(tab.id, tab.url);
}

// ─── Install ──────────────────────────────────────────────────────────────────

browser.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    const existing = await browser.storage.local.get('globalFont');
    if (existing.globalFont === undefined) {
      await browser.storage.local.set({ globalFont: null, enabled: true });
    }
  }
  // Pre-cache default font CSS and build font index
  await Promise.all([getFontIndex(), getFontCss(DEFAULT_FONT.slug)]);
  console.log('[Kriti] Ready.');
});
