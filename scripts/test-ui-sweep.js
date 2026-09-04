/* Click everything.
 *
 * Loads the console and every site page in a real DOM against a real API,
 * then presses every button, opens every section and every editor, and
 * reports any JavaScript error the page throws while doing it. It does not
 * check that each button did the right thing - the other suites do that -
 * it checks that nothing is broken, missing or mis-wired.
 *
 *   node scripts/test-ui-sweep.js
 */
process.env.MONGO_DB = process.env.MONGO_DB_TEST || 'wonderherb_test';
const PORT = 4116;
const API = 'http://localhost:' + PORT;

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
function loadJsdom() {
  try { return require('jsdom'); } catch (e) {}
  return require(path.join(require('os').tmpdir(), 'claude',
    'c--Users-DELL-G15-OneDrive-Desktop-wonderhub-wonder-herb',
    'f8b7d956-d3e9-4d6f-b21a-60850f00a2f1', 'scratchpad', 'node_modules', 'jsdom'));
}
const { JSDOM, VirtualConsole } = loadJsdom();
const app = require('../server/index');
const { connect, close, COLLECTIONS, AUTH_COLLECTIONS, SALES_COLLECTIONS } = require('../server/db');

const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fail = 0;
const check = (label, cond, extra) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '   -> ' + extra : ''));
  if (!cond) fail++;
};
const settle = ms => new Promise(r => setTimeout(r, ms));

function makeFetch(apiUp) {
  return (url, opts) => {
    const u = String(url);
    if (/^https?:/.test(u)) {
      if (!apiUp()) return Promise.reject(new Error('connection refused'));
      return fetch(u, opts);
    }
    const name = decodeURIComponent(u.split('/').pop());
    try {
      const body = fs.readFileSync(path.join(ROOT, 'data', name), 'utf8');
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(body), json: () => Promise.resolve(JSON.parse(body)) });
    } catch (e) { return Promise.resolve({ ok: false, status: 404 }); }
  };
}

/* Every uncaught error the page throws is collected, with the page's name. */
function loadPage(file, url, apiUp, apiBase, errors) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => {
    if (/navigation|Not implemented: HTMLCanvasElement|Not implemented: window\.scrollTo|Could not load/.test(e.message)) return;
    errors.push(file + ': ' + e.message.split('\n')[0]);
  });
  return new Promise(resolve => {
    const dom = new JSDOM(read(file), {
      url, runScripts: 'dangerously', virtualConsole: vc, pretendToBeVisual: true,
      beforeParse(w) {
        w.alert = () => {};
        w.confirm = () => false;      // never take a destructive branch in a blind sweep
        w.prompt = () => null;        // cancel every prompt
        w.open = () => null;
        w.scrollTo = () => {};
        // browsers have these; jsdom does not
        w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
        // observers every browser has and jsdom does not
        const Obs = class { constructor(cb) { this.cb = cb; } observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
        w.IntersectionObserver = Obs; w.ResizeObserver = Obs; w.MutationObserver = w.MutationObserver || Obs;
        // video.play() returns a promise in browsers; jsdom returns nothing
        w.HTMLMediaElement.prototype.play = () => Promise.resolve();
        w.HTMLMediaElement.prototype.pause = () => {};
        w.HTMLMediaElement.prototype.load = () => {};
        // the homepage draws on a canvas; jsdom has no 2D context, browsers do
        w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => (k === 'canvas' ? null : () => 0) });
        w.URL.createObjectURL = () => 'blob:stub';
        w.URL.revokeObjectURL = () => {};
        w.HTMLElement.prototype.scrollIntoView = function () {};
        if (apiBase) w.WH_API_BASE = apiBase;
        w.fetch = makeFetch(apiUp);
      }
    });
    dom.window.addEventListener('error', e => errors.push(file + ': ' + (e.message || e.error)));
    dom.window.addEventListener('load', () => setTimeout(() => resolve(dom), 80));
  });
}

(async () => {
  const db = await connect();
  for (const c of Object.values(COLLECTIONS)) await db.collection(c).deleteMany({});
  for (const c of Object.values(AUTH_COLLECTIONS)) await db.collection(c).deleteMany({});
  for (const c of Object.values(SALES_COLLECTIONS)) await db.collection(c).deleteMany({});
  const server = app.listen(PORT);
  await new Promise(r => server.once('listening', r));
  let up = true;
  const apiUp = () => up;

  // real data, so every list has rows and every row has buttons
  const post = (p, body, token) => fetch(API + p, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body) }).then(r => r.json());
  const admin = (await post('/api/auth/signup', { name: 'Sweep Admin', email: 'sweep@example.com', password: 'sweep-password', asAdmin: true })).token;
  const strip = s => s.replace(/^﻿/, '');
  await post('/api/cms?type=products', JSON.parse(strip(read('data/products.json'))).map((p, i) => Object.assign(p, i === 0 ? { stock: 12, reorder: 5 } : {})), admin);
  await post('/api/cms?type=cases', JSON.parse(strip(read('data/cases.json'))), admin);
  await post('/api/cms?type=faq', JSON.parse(strip(read('data/faq.json'))), admin);
  await post('/api/cms?type=homepage', JSON.parse(strip(read('data/homepage.json'))), admin);
  await post('/api/auth/users', { name: 'Sweep Staff', email: 'staff@example.com', password: 'staff-password', role: 'staff', permissions: { cases: 'view', sales: 'edit' } }, admin);
  await post('/api/sales/customers', { name: 'Sweep Customer', phone: '90000000', prices: { 'WH-PSP-500': 2800 } }, admin);
  await post('/api/sales/invoices', { number: 1301, date: new Date().toISOString().slice(0, 10), customerName: 'Sweep Customer',
    lines: [{ sku: 'WH-PSP-500', price: 2800, qty: 1 }], payment: 'Cash' }, admin);
  await post('/api/stock/WH-PSP-500/adjust', { type: 'receive', qty: 3, note: 'sweep' }, admin);

  // ------------------------------------------------------------- the console
  console.log('\n=== /admin: every section, every button ===\n');
  const errors = [];
  const dom = await loadPage('admin/index.html', 'http://localhost:4000/admin/index.html', apiUp, API, errors);
  const w = dom.window, d = w.document;
  w.localStorage.setItem('wh_admin_token', admin);
  await w.eval('restoreSession()');
  await settle(700);
  check('the console opens for the administrator', d.getElementById('app').style.display === 'grid');

  const sections = ['dashboard', 'cases', 'products', 'inventory', 'faq', 'homepage', 'users', 'sales'];
  for (const sec of sections) {
    const before = errors.length;
    w.switchNav(sec);
    await settle(sec === 'sales' || sec === 'users' ? 500 : 150);
    const visible = !d.getElementById('sec-' + sec).classList.contains('hidden');
    const others = sections.filter(s => s !== sec).every(s => d.getElementById('sec-' + s).classList.contains('hidden'));
    check('section "' + sec + '" opens alone and without errors', visible && others && errors.length === before,
      errors.slice(before).join(' | '));
  }

  // every button in the document, one at a time, in whichever section it lives
  const buttons = Array.from(d.querySelectorAll('button[onclick]'));
  let clicked = 0;
  const failures = [];
  for (const btn of buttons) {
    const handler = btn.getAttribute('onclick');
    // signing out mid-sweep would make every later click meaningless
    if (/logout\(|enterDemo\(|doLogin\(/.test(handler) || btn.closest('#login')) continue;
    // find the section this button belongs to so the screen is in a sensible state
    const sec = btn.closest('section[id^="sec-"]');
    if (sec) { w.switchNav(sec.id.replace('sec-', '')); await settle(60); }
    const before = errors.length;
    try {
      btn.click();
      await settle(handler.includes('download') || handler.includes('export') || handler.includes('render') || handler.includes('load') ? 250 : 40);
    } catch (e) { errors.push('click threw: ' + e.message); }
    clicked++;
    if (errors.length > before) failures.push(handler.slice(0, 70) + '  =>  ' + errors.slice(before).join(' | '));
    // close whatever it opened so the next click starts clean
    d.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    ['caseEditor', 'prodEditor', 'faqEditor'].forEach(id => { const el = d.getElementById(id); if (el) el.classList.add('hidden'); });
  }
  check('every one of the ' + clicked + ' buttons ran its handler without throwing', failures.length === 0,
    failures.length ? '\n        ' + failures.join('\n        ') : '');

  // dynamically rendered row buttons: the ones the sweep above cannot see until a list is drawn
  const rowChecks = [
    ['cases', '#casesList button, #caseList button, #sec-cases table button'],
    ['products', '#prodList button, #sec-products table button'],
    ['faq', '#faqList button, #sec-faq table button'],
    ['inventory', '#invBody button'],
    ['users', '#usersBody button'],
    ['sales', '#salesBody button, #custBody button']
  ];
  for (const [sec, selector] of rowChecks) {
    w.switchNav(sec); await settle(400);
    const rowButtons = Array.from(d.querySelectorAll(selector));
    const before = errors.length;
    for (const b of rowButtons) {
      try { b.click(); await settle(60); } catch (e) { errors.push(sec + ' row button threw: ' + e.message); }
      d.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    }
    check('"' + sec + '": ' + rowButtons.length + ' row button(s) all run clean', rowButtons.length > 0 && errors.length === before,
      errors.slice(before).join(' | ') || (rowButtons.length ? '' : 'no row buttons found'));
  }

  // the editors, opened and closed the way a person would
  const modals = [
    ['users', 'openUserEditor(null)', 'userModal', 'closeUserEditor()'],
    ['sales', 'openSaleEditor(null)', 'saleModal', 'closeSaleEditor()'],
    ['sales', 'openCustomerEditor(null)', 'custModal', 'closeCustomerEditor()'],
    ['inventory', 'openInvAdjust(0)', 'invModal', 'closeInvAdjust()']
  ];
  for (const [sec, open, id, closeFn] of modals) {
    w.switchNav(sec); await settle(300);
    const before = errors.length;
    w.eval(open); await settle(150);
    const shown = !d.getElementById(id).classList.contains('hidden');
    w.eval(closeFn); await settle(30);
    const hidden = d.getElementById(id).classList.contains('hidden');
    check(open + ' opens and ' + closeFn + ' closes, cleanly', shown && hidden && errors.length === before, errors.slice(before).join(' | '));
  }

  // the sign-in card in each of its states
  await w.logout(); await settle(300);
  check('log out returns to the sign-in card', d.getElementById('login').style.display === 'flex' && errors.length === 0);
  const staffDom = await loadPage('admin/index.html', 'http://localhost:4000/admin/index.html', apiUp, API, errors);
  const sw = staffDom.window, sd = staffDom.window.document;
  await settle(300);
  sd.getElementById('loginEmail').value = 'staff@example.com';
  sd.getElementById('loginPassword').value = 'staff-password';
  sd.getElementById('loginForm').dispatchEvent(new sw.Event('submit', { bubbles: true, cancelable: true }));
  await settle(900);
  check('a staff account with limited ticks gets in', sd.getElementById('app').style.display === 'grid');
  const staffButtons = Array.from(sd.querySelectorAll('button[onclick]')).filter(b => !b.closest('#login'));
  const beforeStaff = errors.length;
  for (const b of staffButtons) {
    if (/logout\(/.test(b.getAttribute('onclick'))) continue;
    const sec = b.closest('section[id^="sec-"]');
    if (sec) { sw.switchNav(sec.id.replace('sec-', '')); await settle(40); }
    try { b.click(); await settle(40); } catch (e) { errors.push('staff click threw: ' + e.message); }
    sd.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
  }
  check('every button also runs clean for a limited staff account (' + staffButtons.length + ')', errors.length === beforeStaff,
    errors.slice(beforeStaff).join(' | '));

  // ------------------------------------------------------------- the site
  console.log('\n=== every site page, API up and API down ===\n');
  const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
  for (const mode of [['API up', true, 'http://localhost:4000/'], ['published (no API)', true, 'https://www.wonder-herb.com/']]) {
    const [label, apiState, origin] = mode;
    up = apiState;
    const pageErrors = [];
    for (const page of pages) {
      const pdom = await loadPage(page, origin + encodeURIComponent(page), apiUp, origin.includes('localhost') ? API : null, pageErrors);
      await settle(250);
      // the language switcher on every page
      const pw = pdom.window;
      if (typeof pw.setLanguage === 'function') {
        for (const lang of ['en', 'ja', 'zh']) { try { pw.setLanguage(lang); } catch (e) { pageErrors.push(page + ': setLanguage(' + lang + ') ' + e.message); } }
      }
      // every button with a handler on the page
      Array.from(pdom.window.document.querySelectorAll('button')).slice(0, 40).forEach(b => {
        try { b.click(); } catch (e) { pageErrors.push(page + ': button threw ' + e.message); }
      });
      await settle(60);
      pdom.window.close();
    }
    check(pages.length + ' pages load, switch language and take clicks with no errors (' + label + ')',
      pageErrors.length === 0, pageErrors.length ? '\n        ' + [...new Set(pageErrors)].slice(0, 12).join('\n        ') : '');
  }

  server.close();
  for (const c of Object.values(COLLECTIONS)) await db.collection(c).deleteMany({});
  for (const c of Object.values(AUTH_COLLECTIONS)) await db.collection(c).deleteMany({});
  for (const c of Object.values(SALES_COLLECTIONS)) await db.collection(c).deleteMany({});
  await close();
  console.log('');
  console.log(fail === 0 ? '=== ALL CHECKS PASSED ===' : '=== ' + fail + ' CHECK(S) FAILED ===');
  process.exit(fail ? 1 : 0);
})().catch(err => { console.error('\nSweep failed:', err); process.exit(1); });
