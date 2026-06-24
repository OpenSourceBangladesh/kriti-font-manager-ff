/**
 * Kriti Bangla Font Manager — Popup Script v3.1
 * 2-col grid, site-override by default.
 */
'use strict';

const KRITI_BASE = 'https://kriti.app';
const PREVIEW_TEXT = 'আমার সোনার বাংলা';

// ─── State ─────────────────────────────────────────────────────────────────────
let allFonts = [];
let filteredFonts = [];
let settings = {};
let currentHostname = '';
let searchQuery = '';

// ─── Utility ───────────────────────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }

function getActiveFont() {
  if (!settings) return null;
  return settings.siteOverrides?.[currentHostname] || settings.globalFont || null;
}

// ─── Font Preview Manager ──────────────────────────────────────────────────────
const previewManager = (() => {
  const loaded = new Set();
  const loading = new Set();
  let observer = null;

  function getObserver() {
    if (!observer) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const slug = el.dataset.slug;
          const family = el.dataset.family;
          if (slug && family) loadFont(slug, family, el);
          observer.unobserve(el);
        });
      }, { root: $('fontGrid'), rootMargin: '100px', threshold: 0 });
    }
    return observer;
  }

  async function loadFont(slug, familyName, previewEl) {
    if (loaded.has(slug)) {
      applyToEl(previewEl, familyName);
      return;
    }
    if (loading.has(slug)) return;
    loading.add(slug);

    const fontCss = await browser.runtime.sendMessage({ type: 'GET_FONT_CSS', slug });
    if (fontCss) {
      const styleId = `kriti-preview-${slug}`;
      if (!document.getElementById(styleId)) {
        const styleEl = document.createElement('style');
        styleEl.id = styleId;
        styleEl.textContent = fontCss;
        document.head.appendChild(styleEl);
      }
      loaded.add(slug);
      loading.delete(slug);
      applyToEl(previewEl, familyName);
    } else {
      loading.delete(slug);
    }
  }

  function applyToEl(el, familyName) {
    if (!el || !el.isConnected) return;
    el.style.fontFamily = `'${familyName}', sans-serif`;
    el.classList.add('loaded');
    const parent = el.closest('.card-preview');
    if (parent) parent.classList.add('font-ready');
  }

  function observe(el) { getObserver().observe(el); }
  return { observe };
})();

// ─── Header & Active Bar ───────────────────────────────────────────────────────
function updateActiveBar() {
  const f = getActiveFont();
  const bar = $('activeBar');
  const nameEl = $('activeFontName');

  if (f && settings.enabled) {
    nameEl.textContent = f.name || f.familyName || '—';
    bar.style.opacity = '1';
  } else if (!settings.enabled) {
    nameEl.textContent = 'অক্ষম (Disabled)';
    bar.style.opacity = '0.5';
  } else {
    nameEl.textContent = 'কোনো ফন্ট নেই';
    bar.style.opacity = '0.6';
  }
}

// ─── Filtering & Search ────────────────────────────────────────────────────────
function applyFilter() {
  let result = allFonts;

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    result = result.filter(f =>
      (f.n || '').toLowerCase().includes(q) ||
      (f.f || '').toLowerCase().includes(q)
    );
  }

  filteredFonts = result;
  renderGrid();
}

// ─── Rendering ─────────────────────────────────────────────────────────────────
function renderGrid() {
  const gridEl = $('fontGrid');
  const countEl = $('fontCount');
  const activeFont = getActiveFont();

  countEl.textContent = filteredFonts.length ? `${filteredFonts.length} টি ফন্ট` : '';

  if (filteredFonts.length === 0) {
    gridEl.innerHTML = '<div class="grid-empty">কোনো ফন্ট পাওয়া যায়নি।</div>';
    return;
  }

  const frag = document.createDocumentFragment();
  const cardGrid = document.createElement('div');
  cardGrid.className = 'card-grid';

  let priorityDividerAdded = false;
  let regularDividerAdded = false;

  filteredFonts.forEach((font, idx) => {
    const isPriority = font.priority >= 0;
    const isGlobalActive = !settings.siteOverrides?.[currentHostname] && activeFont?.slug === font.s;
    const isSiteActive = settings.siteOverrides?.[currentHostname]?.slug === font.s;

    if (isPriority && !priorityDividerAdded) {
      const d = document.createElement('div');
      d.className = 'grid-divider';
      d.textContent = 'পছন্দের ফন্ট';
      cardGrid.appendChild(d);
      priorityDividerAdded = true;
    }
    if (!isPriority && priorityDividerAdded && !regularDividerAdded) {
      const d = document.createElement('div');
      d.className = 'grid-divider';
      d.textContent = 'সব ফন্ট';
      cardGrid.appendChild(d);
      regularDividerAdded = true;
    }

    const card = document.createElement('div');
    card.className = `font-card${(isGlobalActive || isSiteActive) ? ' is-active' : ''}`;
    card.dataset.slug = font.s;
    card.style.animationDelay = `${Math.min(idx, 15) * 0.015}s`;

    const familyName = font.f || font.n;
    
    let btnClass = 'card-btn';
    let btnText = 'প্রয়োগ';
    if (isSiteActive) {
      btnClass += ' is-site-active';
      btnText = 'এই সাইটে সক্রিয়';
    } else if (isGlobalActive) {
      btnClass += ' is-global-active';
      btnText = '✓ প্রয়োগিত';
    }

    card.innerHTML = `
      <div class="card-preview">
        <div class="card-preview-text" data-slug="${font.s}" data-family="${familyName}">${PREVIEW_TEXT}</div>
      </div>
      <div class="card-footer">
        <div class="card-name" title="${font.n}">${font.n}</div>
        <button class="${btnClass}" data-action="toggle" data-slug="${font.s}">${btnText}</button>
      </div>
    `;

    cardGrid.appendChild(card);
  });

  gridEl.innerHTML = '';
  gridEl.appendChild(cardGrid);

  cardGrid.querySelectorAll('.card-preview-text').forEach(el => previewManager.observe(el));
}

function renderSiteOverrides() {
  const container = $('siteOverrides');
  const list = $('siteOverridesList');
  const overrides = settings.siteOverrides || {};
  const hosts = Object.keys(overrides);

  if (hosts.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  list.innerHTML = '';

  hosts.forEach(host => {
    const fd = overrides[host];
    const el = document.createElement('div');
    el.className = 'so-item';
    el.innerHTML = `
      <div class="so-host" title="${host}">${host}</div>
      <div class="so-font">${fd.name}</div>
      <button class="so-remove" data-host="${host}" title="সরান">✕</button>
    `;
    list.appendChild(el);
  });
}

// ─── Font Application Logic ────────────────────────────────────────────────────
function makeFontData(font) {
  return {
    slug: font.s,
    name: font.n,
    familyName: font.f || font.n,
    licenseType: font.l || '',
    previewUrl: font.p || '',
    hasBengali: true,
    hasLatin: true
  };
}

async function handleCardAction(slug) {
  const font = allFonts.find(f => f.s === slug);
  if (!font) return;
  const fd = makeFontData(font);
  
  if (!settings.enabled) {
    settings.enabled = true;
    $('masterToggle').checked = true;
    await browser.runtime.sendMessage({ type: 'SET_ENABLED', enabled: true });
  }

  if (currentHostname) {
    // Primary action: Set for current site
    await browser.runtime.sendMessage({ type: 'SET_SITE_FONT', hostname: currentHostname, fontData: fd });
    if (!settings.siteOverrides) settings.siteOverrides = {};
    settings.siteOverrides[currentHostname] = fd;
  } else {
    // If no valid hostname (e.g. new tab page), set globally
    await browser.runtime.sendMessage({ type: 'SET_GLOBAL_FONT', fontData: fd });
    settings.globalFont = fd;
  }

  refreshUI();
}

async function clearFont() {
  if (settings.siteOverrides?.[currentHostname]) {
    await browser.runtime.sendMessage({ type: 'CLEAR_SITE_OVERRIDE', hostname: currentHostname });
    delete settings.siteOverrides[currentHostname];
  } else {
    await browser.runtime.sendMessage({ type: 'SET_GLOBAL_FONT', fontData: null });
    settings.globalFont = null;
  }
  refreshUI();
}

function refreshUI() {
  updateActiveBar();
  applyFilter();
  renderSiteOverrides();
}

// ─── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      const u = new URL(tab.url);
      if (['http:', 'https:'].includes(u.protocol)) currentHostname = u.hostname;
    }
  } catch (_) {}

  $('currentSiteLabel').textContent = currentHostname || 'Global';

  settings = await browser.runtime.sendMessage({ type: 'GET_SETTINGS' });
  $('masterToggle').checked = settings.enabled !== false;

  const sz = settings.fontSize || 100;
  $('fontSizeSlider').value = sz;
  $('fontSizeValue').textContent = `${sz}%`;

  const scope = settings.applyScope || 'all';
  document.querySelectorAll('.sp').forEach(p => p.classList.toggle('active', p.dataset.scope === scope));

  updateActiveBar();
  renderSiteOverrides();

  try {
    allFonts = await browser.runtime.sendMessage({ type: 'GET_FONT_INDEX' });
  } catch (_) {}

  if (!Array.isArray(allFonts) || allFonts.length === 0) {
    $('loadingState').innerHTML = '<span style="color:var(--red)">ফন্ট লোড ব্যর্থ। ইন্টারনেট যাচাই করুন।</span>';
    return;
  }

  $('loadingState').style.display = 'none';
  applyFilter();
}

// ─── Event Listeners ───────────────────────────────────────────────────────────
$('masterToggle').addEventListener('change', async e => {
  settings.enabled = e.target.checked;
  await browser.runtime.sendMessage({ type: 'SET_ENABLED', enabled: settings.enabled });
  refreshUI();
});

$('searchInput').addEventListener('input', e => {
  searchQuery = e.target.value.trim();
  $('searchClearBtn').classList.toggle('visible', searchQuery.length > 0);
  applyFilter();
});

$('searchClearBtn').addEventListener('click', () => {
  $('searchInput').value = '';
  searchQuery = '';
  $('searchClearBtn').classList.remove('visible');
  applyFilter();
  $('searchInput').focus();
});

$('fontGrid').addEventListener('click', async e => {
  const btn = e.target.closest('.card-btn');
  const card = e.target.closest('.font-card');
  const slug = btn ? btn.dataset.slug : (card ? card.dataset.slug : null);
  
  if (slug) await handleCardAction(slug);
});

$('siteOverridesList').addEventListener('click', async e => {
  const removeBtn = e.target.closest('.so-remove');
  if (removeBtn) {
    const host = removeBtn.dataset.host;
    await browser.runtime.sendMessage({ type: 'CLEAR_SITE_OVERRIDE', hostname: host });
    delete settings.siteOverrides[host];
    refreshUI();
  }
});

$('clearFontBtn').addEventListener('click', clearFont);

$('fontSizeSlider').addEventListener('input', async e => {
  const val = parseInt(e.target.value);
  $('fontSizeValue').textContent = `${val}%`;
  settings.fontSize = val;
  await browser.runtime.sendMessage({ type: 'SET_FONT_SIZE', fontSize: val });
});

$('scopePills').addEventListener('click', async e => {
  const pill = e.target.closest('.sp');
  if (!pill) return;
  const scope = pill.dataset.scope;
  settings.applyScope = scope;
  document.querySelectorAll('.sp').forEach(p => p.classList.toggle('active', p === pill));
  await browser.runtime.sendMessage({ type: 'SET_APPLY_SCOPE', applyScope: scope });
});

$('resetAllBtn').addEventListener('click', async () => {
  if (!confirm('সব সেটিংস মুছবেন?')) return;
  await browser.runtime.sendMessage({ type: 'RESET_ALL' });
  settings = { enabled: true, globalFont: null, siteOverrides: {}, fontSize: 100, applyScope: 'all' };
  $('masterToggle').checked = true;
  $('fontSizeSlider').value = 100;
  $('fontSizeValue').textContent = '100%';
  document.querySelectorAll('.sp').forEach(p => p.classList.toggle('active', p.dataset.scope === 'all'));
  refreshUI();
});

document.addEventListener('DOMContentLoaded', init);
