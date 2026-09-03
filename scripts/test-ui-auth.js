/* The account page and the admin sign-in screen, in a real DOM, against a real
 * MongoDB-backed API. Uses a throwaway database, so your data is untouched.
 *
 *   node scripts/test-ui-auth.js
 */
process.env.MONGO_DB = process.env.MONGO_DB_TEST || 'wonderherb_test';
const PORT = 4114;
const API = 'http://localhost:' + PORT;

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* jsdom is a test-only dependency and deliberately not in package.json, so the
   site itself installs nothing. Falls back to the scratch copy. */
function loadJsdom() {
  try { return require('jsdom'); } catch (e) {}
  return require(path.join(require('os').tmpdir(), 'claude',
    'c--Users-DELL-G15-OneDrive-Desktop-wonderhub-wonder-herb',
    'f8b7d956-d3e9-4d6f-b21a-60850f00a2f1', 'scratchpad', 'node_modules', 'jsdom'));
}
const { JSDOM, VirtualConsole } = loadJsdom();

const app = require('../server/index');
const authLib = require('../server/auth');
const { connect, close, COLLECTIONS, AUTH_COLLECTIONS } = require('../server/db');

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
    const name = u.split('/').pop();
    try {
      const body = fs.readFileSync(path.join(ROOT, 'data', name), 'utf8');
      return Promise.resolve({
        ok: true, status: 200,
        text: () => Promise.resolve(body),
        json: () => Promise.resolve(JSON.parse(body))
      });
    } catch (e) {
      return Promise.resolve({ ok: false, status: 404 });
    }
  };
}

function loadPage(file, url, apiUp, apiBase) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/navigation/.test(e.message)) console.log('  [page] ' + e.message.split('\n')[0]); });
  return new Promise(resolve => {
    const dom = new JSDOM(read(file), {
      url, runScripts: 'dangerously', virtualConsole: vc,
      beforeParse(w) {
        w.alert = m => { w.__lastAlert = m; };
        w.confirm = () => true;
        w.URL.createObjectURL = () => 'blob:stub';
        if (apiBase) w.WH_API_BASE = apiBase;
        w.fetch = makeFetch(apiUp);
      }
    });
    dom.window.addEventListener('load', () => setTimeout(() => resolve(dom), 60));
  });
}

/* Fill a field the way a person does, so the page's own handlers see it. */
const type = (d, id, value) => { d.getElementById(id).value = value; };
const submitForm = (w, d, id) =>
  d.getElementById(id).dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));

const usersRow = (d, email) => {
  const row = Array.from(d.querySelectorAll('#usersBody tr'))
    .find(r => r.textContent.includes(email));
  return row ? row.textContent.replace(/\s+/g, ' ').trim() : '';
};

const PASS = 'lantern-street-12';

(async () => {
  const db = await connect();
  const users = db.collection(AUTH_COLLECTIONS.users);
  const sessions = db.collection(AUTH_COLLECTIONS.sessions);
  for (const c of Object.values(COLLECTIONS)) await db.collection(c).deleteMany({});
  await users.deleteMany({});
  await sessions.deleteMany({});
  authLib.throttleReset();

  const server = app.listen(PORT);
  await new Promise(r => server.once('listening', r));
  let up = true;
  const apiUp = () => up;

  // ------------------------------------------------------------ account page
  console.log('\n=== account.html: creating an account ===\n');
  let dom = await loadPage('account.html', 'http://localhost:8747/account.html', apiUp, API);
  let w = dom.window, d = w.document;

  check('the sign-in and register panels are shown', !d.getElementById('accountPanels').hidden);
  check('the member panel is not', d.getElementById('accountMember').hidden);
  check('the offline notice is not shown while the API is up',
    d.getElementById('accountOffline').hidden);
  check('the header account link is visible',
    d.getElementById('whAccountLink').style.display !== 'none');
  check('the page is kept out of search results',
    /noindex/.test(d.querySelector('meta[name="robots"]').getAttribute('content')));

  type(d, 'signupName', 'Wing Lau');
  type(d, 'signupEmail', 'wing@example.com');
  type(d, 'signupPassword', PASS);
  type(d, 'signupConfirm', 'something-else');
  submitForm(w, d, 'signupForm');
  await settle(120);
  // the page is in Chinese here, so this checks the message it actually shows
  check('a mismatched confirmation is caught before anything is sent',
    d.getElementById('signupMsg').textContent === '兩次輸入的密碼不相同' &&
    await users.countDocuments() === 0, d.getElementById('signupMsg').textContent);

  type(d, 'signupConfirm', PASS);
  submitForm(w, d, 'signupForm');
  await settle(500);

  const stored = await users.findOne({ email: 'wing@example.com' });
  check('registering from the page creates the account in MongoDB', !!stored);
  check('with the name that was typed', stored && stored.name === 'Wing Lau');
  check('and the password stored only as a hash',
    stored && !JSON.stringify(stored).includes(PASS) && /^scrypt\$/.test(stored.passwordHash));
  check('the page switches to the member panel',
    !d.getElementById('accountMember').hidden && d.getElementById('accountPanels').hidden);
  check('it greets the new member by name',
    d.getElementById('memberWelcome').textContent.includes('Wing Lau'),
    d.getElementById('memberWelcome').textContent);
  check('and shows the address it registered', d.getElementById('memberEmail').textContent === 'wing@example.com');
  check('the browser keeps a session token', !!w.localStorage.getItem('wh_auth_token'));
  check('and that token belongs to a session in the database',
    !!(await sessions.findOne({ _id: authLib.tokenHash(w.localStorage.getItem('wh_auth_token')) })));
  check('the header link shows as signed in',
    d.getElementById('whAccountLink').classList.contains('is-signed-in'));

  console.log('\n=== account.html: the seven languages ===\n');
  w.setLanguage('en');
  await settle(30);
  check('switching language relabels the account screen',
    d.querySelector('#accountMember [data-wh-t="change_title"]').textContent === 'Change password',
    d.querySelector('#accountMember [data-wh-t="change_title"]').textContent);
  w.setLanguage('ja');
  await settle(30);
  check('and again in Japanese',
    d.querySelector('#accountMember [data-wh-t="logout_btn"]').textContent === 'ログアウト',
    d.querySelector('#accountMember [data-wh-t="logout_btn"]').textContent);
  w.setLanguage('zh');
  await settle(30);
  check('and back in Chinese',
    d.querySelector('#accountMember [data-wh-t="logout_btn"]').textContent === '登出');

  console.log('\n=== account.html: changing the password and signing out ===\n');
  type(d, 'currentPassword', 'not-my-password');
  type(d, 'newPassword', 'brand-new-password');
  submitForm(w, d, 'passwordForm');
  await settle(600);
  check('a wrong current password is refused, with the reason shown',
    /not right/i.test(d.getElementById('passwordMsg').textContent),
    d.getElementById('passwordMsg').textContent);

  type(d, 'currentPassword', PASS);
  type(d, 'newPassword', 'brand-new-password');
  submitForm(w, d, 'passwordForm');
  await settle(700);
  check('the right one goes through', /已更新|changed/i.test(d.getElementById('passwordMsg').textContent),
    d.getElementById('passwordMsg').textContent);
  const rehashed = await users.findOne({ email: 'wing@example.com' });
  check('and the stored hash actually changed', rehashed.passwordHash !== stored.passwordHash);

  d.getElementById('logoutBtn').dispatchEvent(new w.Event('click', { bubbles: true }));
  await settle(400);
  check('signing out clears the token from the browser', !w.localStorage.getItem('wh_auth_token'));
  check('and the session from the database',
    await sessions.countDocuments({ userId: rehashed._id }) === 0);
  check('the sign-in panels come back', !d.getElementById('accountPanels').hidden);
  check('the account itself is still there', await users.countDocuments({ email: 'wing@example.com' }) === 1);

  console.log('\n=== account.html: signing back in ===\n');
  type(d, 'loginEmail', 'wing@example.com');
  type(d, 'loginPassword', 'wrong-one');
  submitForm(w, d, 'loginForm');
  await settle(600);
  check('a wrong password is refused on the page',
    /Wrong email or password/i.test(d.getElementById('loginMsg').textContent),
    d.getElementById('loginMsg').textContent);
  check('and no session was created', await sessions.countDocuments({ userId: rehashed._id }) === 0);

  type(d, 'loginPassword', 'brand-new-password');
  submitForm(w, d, 'loginForm');
  await settle(600);
  check('the new password signs in', !d.getElementById('accountMember').hidden);
  check('the password field is not left filled in', d.getElementById('loginPassword').value === '');
  check('a session exists again', await sessions.countDocuments({ userId: rehashed._id }) === 1);

  console.log('\n=== account.html with no API (the published site) ===\n');
  const offline = await loadPage('account.html', 'https://www.wonder-herb.com/account.html', apiUp, null);
  await settle(120);
  check('the account link is hidden on the public site',
    offline.window.document.getElementById('whAccountLink').style.display === 'none');
  check('the forms are replaced by a plain notice',
    !offline.window.document.getElementById('accountOffline').hidden &&
    offline.window.document.getElementById('accountPanels').hidden);
  check('the notice says so in the visitor\'s language',
    /WhatsApp/.test(offline.window.document.getElementById('accountOffline').textContent));

  const shop = await loadPage('產品介紹.html', 'https://www.wonder-herb.com/產品介紹.html', apiUp, null);
  await settle(120);
  check('and the product page keeps the header it always had',
    shop.window.document.getElementById('whAccountLink').style.display === 'none');

  // ------------------------------------------------------------------ admin
  console.log('\n=== /admin: the first administrator ===\n');
  let adm = await loadPage('admin/index.html', 'http://localhost:8747/admin/index.html', apiUp, API);
  let aw = adm.window, ad = adm.window.document;
  await settle(400);

  check('with no administrator yet, the card offers to create one',
    ad.getElementById('loginSubmit').textContent === 'Create administrator',
    ad.getElementById('loginSubmit').textContent);
  check('and asks for a name', !ad.getElementById('loginNameField').classList.contains('hidden'));
  check('the console is not open yet', aw.getComputedStyle(ad.getElementById('app')).display === 'none');

  // somebody who already has an account must not be cornered by the first-run form
  check('the card offers a way to sign in instead',
    !ad.getElementById('loginSwitch').classList.contains('hidden') &&
    /sign in/i.test(ad.getElementById('loginSwitch').textContent),
    ad.getElementById('loginSwitch').textContent);
  ad.getElementById('loginSwitch').dispatchEvent(new aw.Event('click', { bubbles: true }));
  await settle(60);
  check('taking it turns the card into a plain sign-in',
    ad.getElementById('loginSubmit').textContent === 'Sign in' &&
    ad.getElementById('loginNameField').classList.contains('hidden'));

  type(ad, 'loginEmail', 'wing@example.com');
  type(ad, 'loginPassword', 'brand-new-password');
  submitForm(aw, ad, 'loginForm');
  await settle(800);
  check('an existing member can sign in there, and is told the console is not for them',
    /cannot open the console/i.test(ad.getElementById('loginError').textContent),
    ad.getElementById('loginError').textContent);

  ad.getElementById('loginSwitch').dispatchEvent(new aw.Event('click', { bubbles: true }));
  await settle(60);
  check('and the first-run form is one click back',
    ad.getElementById('loginSubmit').textContent === 'Create administrator');

  type(ad, 'loginName', 'Site Owner');
  type(ad, 'loginEmail', 'owner@example.com');
  type(ad, 'loginPassword', 'short');
  submitForm(aw, ad, 'loginForm');
  await settle(500);
  check('a weak password is refused, with the reason on screen',
    /at least/i.test(ad.getElementById('loginError').textContent),
    ad.getElementById('loginError').textContent);
  check('and no account was created', await users.countDocuments({ email: 'owner@example.com' }) === 0);

  type(ad, 'loginPassword', PASS);
  submitForm(aw, ad, 'loginForm');
  await settle(900);

  const admin = await users.findOne({ email: 'owner@example.com' });
  check('the first sign-in creates the administrator in MongoDB',
    !!admin && admin.role === 'admin');
  check('the console opens', ad.getElementById('app').style.display === 'grid');
  check('and says who is signed in',
    ad.getElementById('whoami').textContent === 'Site Owner', ad.getElementById('whoami').textContent);
  check('the token is kept for the next page load', !!aw.localStorage.getItem('wh_admin_token'));

  console.log('\n=== /admin: the Users screen ===\n');
  aw.switchNav('users');
  await settle(500);
  const rows = Array.from(ad.querySelectorAll('#usersBody tr'));
  check('every account is listed', rows.length === await users.countDocuments(),
    rows.length + ' rows');
  check('with the member and the administrator on it',
    rows.some(r => r.textContent.includes('wing@example.com')) &&
    rows.some(r => r.textContent.includes('Administrator')));
  check('and no password hash anywhere on the page',
    !ad.getElementById('usersBody').innerHTML.toLowerCase().includes('scrypt'));

  console.log('\n=== /admin Users screen: adding someone with limited rights ===\n');
  aw.switchNav('users');
  await settle(500);

  aw.openUserEditor(null);
  check('the add-user form opens', !ad.getElementById('userModal').classList.contains('hidden'));
  type(ad, 'user_name', 'Pat Stock');
  type(ad, 'user_email', 'pat@example.com');
  type(ad, 'user_password', 'pats-password-1');
  ad.getElementById('user_role').value = 'staff';
  aw.renderPermGrid();
  await settle(30);
  check('the tick grid lists every module',
    ad.querySelectorAll('#userPerms .perm-row').length === 5,
    ad.querySelectorAll('#userPerms .perm-row').length + ' rows');

  // Pat looks after stock, may read the catalogue, and sees nothing else
  const tick = (module, level) => {
    ad.querySelector('input[name="perm_' + module + '"][value="' + level + '"]').checked = true;
  };
  ['cases', 'faq', 'homepage'].forEach(m => tick(m, 'none'));
  tick('products', 'view');
  tick('inventory', 'edit');
  await aw.saveUser();
  await settle(700);

  const pat = await users.findOne({ email: 'pat@example.com' });
  check('the account is created in MongoDB', !!pat && pat.role === 'staff');
  check('with exactly the ticks that were set',
    pat && pat.permissions.inventory === 'edit' && pat.permissions.products === 'view' &&
    pat.permissions.cases === 'none', pat && JSON.stringify(pat.permissions));
  check('and a hashed password, not the one that was typed',
    pat && /^scrypt\$/.test(pat.passwordHash) && !JSON.stringify(pat).includes('pats-password-1'));
  check('the table shows what they can do',
    ad.getElementById('usersBody').textContent.includes('Edits Inventory'),
    ad.getElementById('usersBody').textContent.replace(/\s+/g, ' ').slice(0, 120));

  console.log('\n=== The console as that staff account ===\n');
  const patDom = await loadPage('admin/index.html', 'http://localhost:8747/admin/index.html', apiUp, API);
  const pw = patDom.window, pd = patDom.window.document;
  await settle(400);
  type(pd, 'loginEmail', 'pat@example.com');
  type(pd, 'loginPassword', 'pats-password-1');
  submitForm(pw, pd, 'loginForm');
  await settle(900);

  check('staff can open the console', pd.getElementById('app').style.display === 'grid');
  check('the modules they cannot see are gone from the sidebar',
    pd.body.classList.contains('no-cases') && pd.body.classList.contains('no-faq') &&
    pd.body.classList.contains('no-homepage'), pd.body.className);
  check('inventory, which they run, is not', !pd.body.classList.contains('no-inventory') &&
    !pd.body.classList.contains('ro-inventory'));
  check('products is there but read-only', pd.body.classList.contains('ro-products'));
  check('the Users screen is hidden from them', pd.body.classList.contains('no-users'));
  check('and so are the whole-site exports', pd.body.classList.contains('no-export'));
  check('the view-only notice appears on the read-only module', (() => {
    pw.switchNav('products');
    return !pd.getElementById('viewOnlyNote').classList.contains('hidden');
  })());
  check('and not on the one they may edit', (() => {
    pw.switchNav('inventory');
    return pd.getElementById('viewOnlyNote').classList.contains('hidden');
  })());

  // the server is the thing that actually refuses
  const patToken = pw.localStorage.getItem('wh_admin_token');
  const refused = await fetch(API + '/api/cms?type=faq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + patToken },
    body: JSON.stringify([{ id: 1, q: 'sneaked', a: 'in' }])
  });
  check('a module they cannot see is refused by the API, not just hidden',
    refused.status === 403, String(refused.status));
  check('and the FAQ is untouched', await db.collection(COLLECTIONS.faq).countDocuments() === 0);

  console.log('\n=== Changing what someone may do ===\n');
  aw.switchNav('users');
  await settle(400);
  const patRow = usersRow(ad, 'pat@example.com');
  check('the row offers Edit, Reset password, Disable and Delete',
    ['Edit', 'Reset password', 'Disable', 'Delete'].every(t => patRow.includes(t)), patRow);

  const patId = String(pat._id);
  aw.openUserEditor(patId);
  await settle(60);
  check('editing an existing account does not ask for a password again',
    ad.getElementById('userPasswordField').classList.contains('hidden'));
  check('and will not let the email be retyped', ad.getElementById('user_email').disabled);
  check('the grid shows what they have now',
    ad.querySelector('input[name="perm_inventory"][value="edit"]').checked);
  ad.querySelector('input[name="perm_faq"][value="edit"]').checked = true;
  await aw.saveUser();
  await settle(700);
  const patAfter = await users.findOne({ email: 'pat@example.com' });
  check('a new tick is stored', patAfter.permissions.faq === 'edit');
  check('and the account can now save that module', (await fetch(API + '/api/cms?type=faq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + patToken },
    body: JSON.stringify([{ id: 1, cat: 'General', q: 'Allowed now?', a: 'Yes.' }])
  })).status === 200);

  console.log('\n=== Disabling and deleting ===\n');
  await aw.toggleUserStatus(patId);
  await settle(600);
  check('disabling is stored', (await users.findOne({ _id: pat._id })).status === 'disabled');
  check('and the open session is ended at once',
    await sessions.countDocuments({ email: 'pat@example.com' }) === 0);
  check('their token stops working',
    (await fetch(API + '/api/auth/me', { headers: { Authorization: 'Bearer ' + patToken } })).status === 401);

  await aw.deleteUser(patId);
  await settle(600);
  check('deleting removes the account', await users.countDocuments({ email: 'pat@example.com' }) === 0);
  check('and the table no longer lists it',
    !ad.getElementById('usersBody').textContent.includes('pat@example.com'));

  console.log('\n=== The console cannot be emptied of administrators ===\n');
  const ownerRow = usersRow(ad, 'owner@example.com');
  check('an administrator sees no Delete on their own row',
    !/Delete/.test(ownerRow), ownerRow);
  const ownerId = String((await users.findOne({ email: 'owner@example.com' }))._id);
  aw.openUserEditor(ownerId);
  await settle(60);
  ad.getElementById('user_role').value = 'staff';
  await aw.saveUser();
  await settle(600);
  check('and cannot demote themselves even by trying',
    /own account type/i.test(ad.getElementById('userError').textContent),
    ad.getElementById('userError').textContent);
  check('so the administrator is still an administrator',
    (await users.findOne({ email: 'owner@example.com' })).role === 'admin');
  aw.closeUserEditor();

  console.log('\n=== /admin: only administrators ===\n');
  await aw.logout();
  await settle(400);
  check('logging out closes the console',
    ad.getElementById('app').style.display === 'none' &&
    ad.getElementById('login').style.display === 'flex');
  check('and drops the token', !aw.localStorage.getItem('wh_admin_token'));
  check('the sign-in card is now a normal sign-in',
    ad.getElementById('loginSubmit').textContent === 'Sign in',
    ad.getElementById('loginSubmit').textContent);
  check('with no offer to create another administrator',
    ad.getElementById('loginSwitch').classList.contains('hidden'));

  type(ad, 'loginEmail', 'wing@example.com');
  type(ad, 'loginPassword', 'brand-new-password');
  submitForm(aw, ad, 'loginForm');
  await settle(800);
  check('a member account cannot open the console',
    /cannot open the console/i.test(ad.getElementById('loginError').textContent),
    ad.getElementById('loginError').textContent);
  check('the console stays shut', ad.getElementById('app').style.display === 'none');
  check('and the session it opened is closed again',
    !aw.localStorage.getItem('wh_admin_token') &&
    await sessions.countDocuments({ email: 'wing@example.com' }) === 1);

  type(ad, 'loginEmail', 'owner@example.com');
  type(ad, 'loginPassword', PASS);
  submitForm(aw, ad, 'loginForm');
  await settle(900);
  check('the administrator signs back in', ad.getElementById('app').style.display === 'grid');

  console.log('\n=== /admin: a remembered session ===\n');
  const token = aw.localStorage.getItem('wh_admin_token');
  const reopened = await loadPage('admin/index.html', 'http://localhost:8747/admin/index.html', apiUp, API);
  reopened.window.localStorage.setItem('wh_admin_token', token);
  await reopened.window.eval('restoreSession()');
  await settle(500);
  check('a valid token opens the console without signing in again',
    reopened.window.document.getElementById('app').style.display === 'grid');

  const stale = await loadPage('admin/index.html', 'http://localhost:8747/admin/index.html', apiUp, API);
  stale.window.localStorage.setItem('wh_admin_token', 'a-token-the-server-never-issued');
  await stale.window.eval('restoreSession()');
  await settle(400);
  check('a token the server does not know does not',
    stale.window.getComputedStyle(stale.window.document.getElementById('app')).display === 'none');
  check('and it is thrown away', !stale.window.localStorage.getItem('wh_admin_token'));

  console.log('\n=== /admin with the database down ===\n');
  up = false;
  const down = await loadPage('admin/index.html', 'http://localhost:8747/admin/index.html', apiUp, API);
  await settle(400);
  check('the card explains the database is offline',
    /offline/i.test(down.window.document.getElementById('loginNote').textContent),
    down.window.document.getElementById('loginNote').textContent.slice(0, 60));
  check('and still offers the local-files way in',
    !down.window.document.getElementById('demoBtn').classList.contains('hidden'));
  down.window.enterDemo();
  await settle(300);
  check('which opens the console as before',
    down.window.document.getElementById('app').style.display === 'grid');
  up = true;

  server.close();
  for (const c of Object.values(COLLECTIONS)) await db.collection(c).deleteMany({});
  await users.deleteMany({});
  await sessions.deleteMany({});
  await close();

  console.log('');
  console.log(fail === 0 ? '=== ALL CHECKS PASSED ===' : '=== ' + fail + ' CHECK(S) FAILED ===');
  process.exit(fail ? 1 : 0);
})().catch(err => {
  console.error('\nTest run failed:', err);
  process.exit(1);
});
