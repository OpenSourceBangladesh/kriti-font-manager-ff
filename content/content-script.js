/**
 * Kriti Bangla Font Manager — Content Script v4
 *
 * - Reads settings from local storage.
 * - Dynamically scans CSSOM for custom fonts.
 * - Forces re-evaluation on window load and fonts ready to ensure 100% coverage.
 * - Uses @font-face aliasing for safe fallback.
 */

(function () {
  'use strict';

  const STYLE_ID   = '__kriti_style__';
  const MARKER_ATTR = 'data-kriti-slug';

  let currentSlug  = null;
  let muObserver   = null;

  // ── Read settings directly from storage (no background round-trip) ──────────

  async function readActiveFont() {
    try {
      const data = await browser.storage.local.get([
        'enabled', 'siteOverrides', 'fontSize', 'applyScope'
      ]);

      if (data.enabled === false) return null;

      const hostname = location.hostname;
      const font = (data.siteOverrides || {})[hostname] || null;
      if (!font || !font.slug) return null;

      return {
        font,
        fontSize:   data.fontSize   || 100,
        applyScope: data.applyScope || 'all'
      };
    } catch (_) {
      return null;
    }
  }

  // ── Fetch CDN CSS via background cache (with wake-up retries) ───────────────

  async function fetchCss(slug, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const css = await browser.runtime.sendMessage({ type: 'GET_FONT_CSS', slug });
        if (css) return css;
      } catch (_) {}
      await new Promise(r => setTimeout(r, 150));
    }
    return null;
  }

  // ── Build the injected style content ─────────────────────────────────────────

  function buildStyle(fontCss, familyName, fontSize) {
    const overrideScale = fontSize !== 100
      ? `html { font-size: ${fontSize}% !important; }`
      : '';

    // Extract the src block and unicode-range from the CDN CSS
    const srcMatch = fontCss.match(/src:\s*([^;]+);/);
    if (!srcMatch) return fontCss; // Fallback if parsing fails
    const srcRule = srcMatch[0];

    const rangeMatch = fontCss.match(/unicode-range:\s*([^;]+);/);
    const baseRange = rangeMatch ? rangeMatch[1] : 'U+0980-09FF, U+200C-200D, U+20B9, U+25CC';
    const unicodeRangeRule = `unicode-range: ${baseRange};`;

    // Collect common generic fonts + dynamic fonts used on the actual page!
    const fontsToOverride = new Set([
      'sans-serif', 'serif', 'monospace', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI',
      'Arial', 'Helvetica', 'Helvetica Neue', 'Tahoma', 'Verdana', 'Times New Roman', 'Georgia',
      'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Inter', 'Poppins', 'Noto Sans',
      'SolaimanLipi', 'Kalpurush', 'Siyam Rupali', 'Vrinda', 'Nirmala UI'
    ]);

    // Add Web Fonts loaded by the site
    if (document.fonts) {
      document.fonts.forEach(f => {
        if (f.family) fontsToOverride.add(f.family.replace(/['"]/g, ''));
      });
    }

    // Quick DOM sample to catch local fonts explicitly set in CSS
    try {
      const sampleEls = document.querySelectorAll('body, h1, h2, h3, p, span, div, a, button, input, textarea');
      const maxSample = Math.min(sampleEls.length, 300); // limit to avoid lag
      for (let i = 0; i < maxSample; i++) {
        const ff = window.getComputedStyle(sampleEls[i]).fontFamily;
        if (ff) {
          ff.split(',').forEach(f => fontsToOverride.add(f.trim().replace(/['"]/g, '')));
        }
      }
    } catch (_) {}

    let aliasRules = '';
    fontsToOverride.forEach(f => {
      // Don't override known icon fonts just to be absolutely safe
      const lower = f.toLowerCase();
      if (lower.includes('icon') || lower.includes('awesome') || lower.includes('symbol')) return;
      
      aliasRules += `
@font-face {
  font-family: "${f}";
  ${srcRule}
  ${unicodeRangeRule}
}\n`;
    });

    return `/* Kriti Font Manager — ${familyName} */
${fontCss}

${aliasRules}

${overrideScale}`;
  }

  // ── Inject / update the style element ────────────────────────────────────────

  function injectStyle(css, slug) {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(el);
    }
    el.setAttribute(MARKER_ATTR, slug);
    el.textContent = css;
  }

  function removeStyle() {
    const el = document.getElementById(STYLE_ID);
    if (el) el.remove();
    currentSlug = null;
  }

  // ── Main apply logic ──────────────────────────────────────────────────────────

  async function applyFont(force = false) {
    const active = await readActiveFont();

    if (!active) { removeStyle(); return; }

    const { font, fontSize } = active;
    const slug       = font.slug;
    const familyName = font.familyName;

    // Skip if same font already injected AND we are not forcing a refresh
    const existing = document.getElementById(STYLE_ID);
    if (!force && existing && existing.getAttribute(MARKER_ATTR) === slug && fontSize === 100) {
      // Fast path exit if nothing structurally changed
      return;
    }

    // Fetch the CDN CSS (served from background's 7-day cache)
    const fontCss = await fetchCss(slug);
    if (!fontCss) return;

    // Build the dynamic CSS incorporating any newly loaded web fonts on the page
    const styleContent = buildStyle(fontCss, familyName, fontSize);
    injectStyle(styleContent, slug);
    currentSlug = slug;
  }

  // ── MutationObserver: handle SPA navigation & dynamic content ────────────────
  // We watch for <head> changes (SPA frameworks swap it) to re-inject if removed.

  function startObserver() {
    if (muObserver) return;
    muObserver = new MutationObserver(() => {
      // If our style was removed (e.g. SPA navigation clearing <head>), re-inject
      if (currentSlug && !document.getElementById(STYLE_ID)) {
        applyFont(true);
      }
    });
    muObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  function stopObserver() {
    if (muObserver) { muObserver.disconnect(); muObserver = null; }
  }

  // ── Message listener (live updates from background when user changes font) ────

  browser.runtime.onMessage.addListener((msg) => {
    if (msg.type !== 'KRITI_APPLY_FONT') return;

    if (!msg.enabled || !msg.fontData) {
      removeStyle();
      stopObserver();
    } else {
      // Settings changed — force re-apply
      applyFont(true).then(() => startObserver());
    }
  });

  // ── Bootstrap ─────────────────────────────────────────────────────────────────

  async function boot() {
    await applyFont(true);
    startObserver();
  }

  // Run as early as possible
  if (document.readyState === 'loading') {
    // document_start: <head> might not exist yet, inject into documentElement
    boot();
    
    // Re-apply when DOM is ready to scan newly created elements
    document.addEventListener('DOMContentLoaded', () => {
      applyFont(true);
    }, { once: true });
    
    // Re-apply when fully loaded to scan deeply loaded async web fonts
    window.addEventListener('load', () => {
      applyFont(true);
    }, { once: true });
    
    // Most robust: re-apply whenever all web fonts finish loading!
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        applyFont(true);
      });
    }
  } else {
    boot();
  }

})();
