/* assets/site.js - behaviour every pre-rendered page shares: the cart store and
 * its badge, the phone menu, the language switcher. Built once for all 18 pages
 * (P9-T1, docs/FINDINGS.md finding 23), never copied into a page.
 *
 * Loaded by renderer/template.js on every page that has site chrome. It binds to
 * the chrome's existing ids and classes and to plain data-* hooks the sections
 * emit (data-sku, data-price, data-status, data-clinic-only). It never uses
 * data-wh-*: those are editor-only (CLAUDE.md non-negotiable 4).
 *
 * The published site must work with scripts off, so nothing here creates
 * content. Without this file a visitor loses interaction, never text.
 */
(function (root) {
  'use strict';

  /* ==========================================================================
     SKU -> the cart id the EXISTING pages use. Bind by SKU, NEVER by id.

     購物車.html names cart items through productNameMap[product.id], and every
     detail page writes its own hard-coded id. Those ids are NOT the database
     ids: in data/products.json 標準裝 is id 1, on the old pages it is id 2 (the
     trial pack). A cart item written with the database id would appear in the
     cart as the WRONG PRODUCT. finding 19 and finding 23.

     Hand-checked, and cross-checked on every `npm run test:behaviour` against
     three independent sources: scripts/migrate-products.js MATCH, the
     WH_SKU_PAGES map on the live pages, and each detail page's own cart id.
     Do not derive this table and do not edit it without the test.
     ========================================================================== */
  var CART_IDS = {
    'WH-PSP-060': 1,   // 試用裝   產品_雲芝糖肽精華_A.html
    'WH-PSP-500': 2,   // 標準裝   產品_雲芝糖肽精華_B.html
    'WH-T3-120':  3,   // T3       產品_T3.html
    'WH-HB-180':  4,   // 乙肝清    產品_乙肝清.html
    'WH-MB-060':  5,   // 憶活素    產品_憶活素.html
    'WH-PT3-090': 6    // PT3      產品_PT3.html
  };

  /* ==========================================================================
     PRICE HOLD - SKUs that cannot be added to the cart while their price is
     unsettled. Refused visibly, never silently priced.

     EMPTY BY OWNER DECISION, 15 Sep 2026. The current site content is not
     authoritative (the client will replace all of it), so the database value
     in data/products.json is the price: 憶活素 HK$880, PT3 HK$2,480. Their old
     pages said 520 and clinic-only; that disagreement is recorded in
     docs/FINDINGS.md findings 9 and 23 as background, not a blocker. A
     different price later is a data edit in the admin, not a code change.

     The mechanism stays so a genuinely unsettled price can be held again:
     add 'SKU': 'reason' here and the cart refuses it with MSG.priceHold.
     ========================================================================== */
  var PRICE_HOLD = {};

  var CART_KEY = 'wonderHerbCart';     // shared with every live page and 購物車.html
  var LANG_KEY = 'wonderherb_lang';    // shared with every live page
  var LANGS = ['zh', 'en', 'de', 'es', 'fr', 'ja', 'ru'];
  var HREFLANG = { zh: 'zh-Hant', en: 'en', de: 'de', es: 'es', fr: 'fr', ja: 'ja', ru: 'ru' };

  /* The live pages' own wording (產品介紹.html addToCart), so a visitor hears the
     same thing on a migrated page. Shown INLINE, never through alert().

     priceHold was approved by the owner on 15 Sep 2026. It gives a reason and a
     next step, and it does not tell a customer who can see a price on the card
     that we are unsure of our own price. It also reads right for PT3, which is
     sold through clinics. English equivalent, for the record: "This product
     isn't available to order online. Message us on WhatsApp and we'll tell you
     how to buy it." */
  var MSG = {
    added:      function (n, name) { return '已將 ' + n + ' 件 ' + name + ' 加入購物車'; },
    outOfStock: '此產品暫時缺貨，請聯絡我們查詢補貨時間。',
    clinicOnly: '此產品僅限診所購買，請諮詢您的醫生。',
    priceHold:  '此產品暫未開放網上訂購，歡迎透過 WhatsApp 查詢購買方式。',
    unavailable:'此產品暫時未能加入購物車，請透過 WhatsApp 查詢。'
  };

  /* ------------------------------------------------------------ cart store */

  function storage() {
    try { return root.localStorage; } catch (e) { return null; }
  }

  function readCart() {
    var s = storage();
    if (!s) return [];
    try {
      var raw = JSON.parse(s.getItem(CART_KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (e) { return []; }
  }

  /* Three shapes exist in visitors' browsers today: {productId, quantity,
     product} from the product pages, {product, quantity} after 購物車.html has
     re-saved the cart (it drops productId), and a flat {id, name, quantity}. */
  function itemId(item) {
    if (!item) return null;
    if (item.productId !== undefined) return item.productId;
    if (item.product && item.product.id !== undefined) return item.product.id;
    return item.id !== undefined ? item.id : null;
  }

  function cartCount() {
    return readCart().reduce(function (sum, item) {
      var q = parseInt(item && item.quantity, 10);
      return sum + (q > 0 ? q : 0);
    }, 0);
  }

  function paintBadges() {
    var total = String(cartCount());
    var els = document.querySelectorAll('.cart-count');
    for (var i = 0; i < els.length; i++) els[i].textContent = total;
  }

  /* Decide whether a product may go in the cart. Pure: no alerts, no writes. */
  function check(p) {
    var sku = p && p.sku;
    if (!sku || !(sku in CART_IDS)) return { ok: false, reason: 'unknown-sku', message: MSG.unavailable };
    if (sku in PRICE_HOLD) return { ok: false, reason: 'price-hold', message: MSG.priceHold };
    if (p.clinicOnly) return { ok: false, reason: 'clinic-only', message: MSG.clinicOnly };
    if (String(p.status || '').toLowerCase().indexOf('out') === 0) {
      return { ok: false, reason: 'out-of-stock', message: MSG.outOfStock };
    }
    var price = parseFloat(p.price);
    if (!isFinite(price) || price <= 0) return { ok: false, reason: 'no-price', message: MSG.unavailable };
    return { ok: true, id: CART_IDS[sku], price: price };
  }

  /* Add to the shared cart. Returns { ok, reason, message }: the CALLER shows
     the message inline where the visitor is looking (the quick view shows a
     refusal inside the modal). A refusal is also logged, so it can never pass as
     "no errors". No alert(): a browser dialog reads as a broken page. */
  function add(p, quantity) {
    var verdict = check(p);
    if (!verdict.ok) {
      if (root.console) {
        root.console.error('[wonder-herb] cart refused ' + (p && p.sku) + ': ' + verdict.reason +
          (verdict.reason === 'price-hold' ? ' (' + PRICE_HOLD[p.sku] + ')' : ''));
      }
      return verdict;
    }
    var q = Math.min(99, Math.max(1, parseInt(quantity, 10) || 1));
    var cart = readCart();
    var existing = null;
    for (var i = 0; i < cart.length; i++) {
      if (itemId(cart[i]) === verdict.id) { existing = cart[i]; break; }
    }
    if (existing) {
      existing.quantity = (parseInt(existing.quantity, 10) || 0) + q;
      if (existing.productId === undefined) existing.productId = verdict.id;
    } else {
      cart.push({
        productId: verdict.id,
        quantity: q,
        product: { id: verdict.id, sku: p.sku, name: p.name, price: verdict.price, image: p.image || '' }
      });
    }
    var s = storage();
    if (s) {
      try { s.setItem(CART_KEY, JSON.stringify(cart)); }
      catch (e) { return { ok: false, reason: 'storage', message: MSG.unavailable }; }
    }
    paintBadges();
    return { ok: true, id: verdict.id, price: verdict.price, message: MSG.added(q, p.name) };
  }

  /* ------------------------------------------------------------ phone menu */

  function bindMenu() {
    var toggle = document.getElementById('menuToggle');
    var panel = document.getElementById('headerNavPanel');
    if (!toggle || !panel) return;
    var label = function (open) { return open ? '關閉選單' : '開啟選單'; };
    var set = function (open) {
      panel.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', label(open));
      document.body.classList.toggle('menu-open', open);
    };
    toggle.addEventListener('click', function () { set(!panel.classList.contains('is-open')); });
    var links = panel.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) links[i].addEventListener('click', function () { set(false); });
    root.addEventListener('resize', function () { if (root.innerWidth > 768) set(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) { set(false); toggle.focus(); }
    });
  }

  /* ------------------------------------------------------ language switcher

     Pre-rendered pages have one URL per language (Phase 14). Choosing a
     language goes to this page's alternate in that language when the page
     declares one (<link rel="alternate" hreflang>), which is what a crawler
     sees too. Month 1 pages are Chinese only and declare none, so the choice is
     saved - every other page honours it, as it always has - and the visitor is
     told plainly that THIS page is not available in that language. A control
     that silently does nothing would be worse than the Chinese page itself.
     Accepted regression, docs/FINDINGS.md finding 24. */

  /* Owner-approved wording, 15 Sep 2026: say what the visitor IS looking at
     (Chinese), not only what is missing. Every Month 1 migrated page is Chinese;
     Phase 14 gives each page its alternates and this notice stops appearing.
     The zh line is here for completeness: it never shows on a Chinese page. */
  var UNAVAILABLE = {
    zh: '本頁暫時只提供中文版本。',
    en: 'Sorry, this page is only available in Chinese for now.',
    de: 'Diese Seite ist derzeit leider nur auf Chinesisch verfügbar.',
    es: 'Lo sentimos, por ahora esta página solo está disponible en chino.',
    fr: "Désolé, cette page n'est pour l'instant disponible qu'en chinois.",
    ja: '申し訳ありません。このページは現在、中国語でのみご覧いただけます。',
    ru: 'К сожалению, эта страница пока доступна только на китайском языке.'
  };
  /* The close button's screen-reader label, in the SAME language as the notice
     it closes (an English "Close" on a Japanese notice helps nobody). */
  var CLOSE = { zh: '關閉', en: 'Close', de: 'Schließen', es: 'Cerrar', fr: 'Fermer', ja: '閉じる', ru: 'Закрыть' };

  function pageLang() {
    var tag = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    for (var i = 0; i < LANGS.length; i++) {
      if (HREFLANG[LANGS[i]].toLowerCase() === tag || LANGS[i] === tag) return LANGS[i];
    }
    return tag.indexOf('zh') === 0 ? 'zh' : null;
  }

  function alternateFor(code) {
    var links = document.querySelectorAll('link[rel="alternate"][hreflang]');
    for (var i = 0; i < links.length; i++) {
      if (links[i].getAttribute('hreflang') === HREFLANG[code]) return links[i].getAttribute('href');
    }
    return null;
  }

  /* A dismissible bar at the bottom of the screen, in one language: the text,
     its lang attribute and its close label all agree. Used for the language
     notice and for "added to cart". */
  function notice(id, text, code) {
    var old = document.getElementById(id);
    if (old) old.parentNode.removeChild(old);
    var box = document.createElement('div');
    box.id = id;
    box.className = 'site-notice';
    box.setAttribute('role', 'status');
    box.setAttribute('lang', HREFLANG[code] || HREFLANG.zh);
    /* Styled here, not in a sheet: assets/chrome.css is generated, and this is
       the only visual this file owns. Sits above the phone WhatsApp bar. */
    box.style.cssText = 'position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:1001;' +
      'max-width:calc(100% - 32px);box-sizing:border-box;display:flex;gap:12px;align-items:center;' +
      'background:#2f3b2f;color:#fff;padding:12px 16px;border-radius:8px;font-size:15px;line-height:1.4;' +
      'box-shadow:0 4px 18px rgba(0,0,0,.25)';
    var body = document.createElement('span');
    body.textContent = text;
    var close = document.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', CLOSE[code] || CLOSE.zh);
    close.style.cssText = 'background:none;border:0;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:0 2px';
    close.addEventListener('click', function () { box.parentNode && box.parentNode.removeChild(box); });
    box.appendChild(body);
    box.appendChild(close);
    document.body.appendChild(box);
    return box;
  }

  function showLangNotice(code) { notice('langNotice', UNAVAILABLE[code], code); }

  function chooseLanguage(code) {
    if (LANGS.indexOf(code) === -1) return;
    var s = storage();
    if (s) { try { s.setItem(LANG_KEY, code); } catch (e) { /* private mode */ } }
    if (code === pageLang()) {
      var n = document.getElementById('langNotice');
      if (n) n.parentNode.removeChild(n);
      return;
    }
    var alt = alternateFor(code);
    if (alt) { root.location.href = alt; return; }
    showLangNotice(code);
  }

  function bindLanguage() {
    var controls = document.querySelectorAll('.lang-selector [data-lang], #langDropdown [data-lang]');
    var dropdown = document.getElementById('langDropdown');
    var current = document.getElementById('langCurrentBtn');
    var setDropdown = function (open) {
      if (!dropdown || !current) return;
      dropdown.classList.toggle('show', open);
      current.setAttribute('aria-expanded', String(open));
    };
    var pick = function (el) { setDropdown(false); chooseLanguage(el.getAttribute('data-lang')); };
    for (var i = 0; i < controls.length; i++) {
      (function (el) {
        el.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); pick(el); });
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(el); }
        });
      })(controls[i]);
    }
    if (current && dropdown) {
      var flip = function (e) { e.preventDefault(); e.stopPropagation(); setDropdown(!dropdown.classList.contains('show')); };
      current.addEventListener('click', flip);
      current.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') flip(e); });
      document.addEventListener('click', function (e) {
        if (!current.contains(e.target) && !dropdown.contains(e.target)) setDropdown(false);
      });
    }
    /* A visitor who chose a language on another page lands here in Chinese:
       say so once, rather than let the page look broken. */
    var s = storage();
    var saved = null;
    try { saved = s && s.getItem(LANG_KEY); } catch (e) { saved = null; }
    if (saved && LANGS.indexOf(saved) !== -1 && saved !== pageLang() && !alternateFor(saved)) {
      showLangNotice(saved);
    }
  }

  /* ---------------------------------------------------------------- export */

  var api = { CART_IDS: CART_IDS, PRICE_HOLD: PRICE_HOLD, CART_KEY: CART_KEY, LANG_KEY: LANG_KEY,
              MSG: MSG, UNAVAILABLE: UNAVAILABLE, CLOSE: CLOSE,
              check: check, add: add, count: cartCount, paintBadges: paintBadges, chooseLanguage: chooseLanguage,
              /* "added to cart", in the page's own language */
              notify: function (text) { return notice('cartNotice', text, pageLang() || 'zh'); } };

  if (typeof module === 'object' && module.exports) module.exports = api;   // test:behaviour reads the tables
  if (typeof document === 'undefined') return;

  root.WonderHerb = api;
  var start = function () {
    bindMenu();
    bindLanguage();
    paintBadges();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  /* another tab changed the cart; back/forward cache restored this page */
  root.addEventListener('storage', function (e) { if (e.key === CART_KEY) paintBadges(); });
  root.addEventListener('pageshow', paintBadges);
})(typeof window !== 'undefined' ? window : this);
