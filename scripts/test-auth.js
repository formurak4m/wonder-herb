/* Accounts: real Express, real MongoDB, no stubs.
 *
 * Runs against a throwaway database (wonderherb_test), so your working data is
 * never touched. Start it with: npm run test:auth
 */
process.env.MONGO_DB = process.env.MONGO_DB_TEST || 'wonderherb_test';
process.env.PORT = process.env.PORT_TEST || '4113';
process.env.SUPER_ADMIN_EMAIL = 'root@example.com';
process.env.SUPER_ADMIN_PASSWORD = 'root';   // deliberately weak: bootstrap must still work

const app = require('../server/index');
const auth = require('../server/auth');
const { connect, close, AUTH_COLLECTIONS } = require('../server/db');

const BASE = 'http://localhost:' + process.env.PORT;
let fail = 0;
const check = (label, cond, extra) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '   -> ' + extra : ''));
  if (!cond) fail++;
};

const call = (method, path, body, token) => fetch(BASE + path, {
  method: method,
  headers: Object.assign({ 'Content-Type': 'application/json' },
    token ? { Authorization: 'Bearer ' + token } : {}),
  body: body === undefined ? undefined : JSON.stringify(body)
}).then(async r => ({ status: r.status, body: await r.json() }));

const post = (p, b, t) => call('POST', p, b, t);
const get = (p, t) => call('GET', p, undefined, t);
const patch = (p, b, t) => call('PATCH', p, b, t);
const del = (p, t) => call('DELETE', p, undefined, t);

const PASS = 'garden-gate-88';

(async () => {
  const db = await connect();
  const users = db.collection(AUTH_COLLECTIONS.users);
  const sessions = db.collection(AUTH_COLLECTIONS.sessions);
  await users.deleteMany({});
  await sessions.deleteMany({});
  auth.throttleReset();

  const server = app.listen(Number(process.env.PORT));
  await new Promise(r => server.once('listening', r));

  console.log('\n=== Signing up ===\n');
  let r = await get('/api/auth/status');
  check('a fresh install reports no accounts and no administrator',
    r.body.users === 0 && r.body.adminExists === false);

  r = await post('/api/auth/signup', { name: 'Mei Chan', email: '  Mei@Example.COM ', password: PASS });
  check('signup succeeds', r.status === 201 && r.body.success === true, String(r.status));
  check('it hands back a session token', typeof r.body.token === 'string' && r.body.token.length >= 32);
  check('and the account it created', r.body.user && r.body.user.email === 'mei@example.com',
    r.body.user && r.body.user.email);
  check('a new signup is a customer, not an administrator', r.body.user.role === 'customer');
  check('the response never carries the password or its hash',
    !JSON.stringify(r.body).toLowerCase().includes('passwordhash') &&
    !JSON.stringify(r.body).includes(PASS));
  const meiToken = r.body.token;

  console.log('\n=== The user is stored properly ===\n');
  const stored = await users.findOne({ email: 'mei@example.com' });
  check('the account is a document in MongoDB', !!stored);
  check('email is stored trimmed and lowercased', stored.email === 'mei@example.com', stored.email);
  check('the name is kept', stored.name === 'Mei Chan');
  check('the password itself is nowhere in the document',
    !JSON.stringify(stored).includes(PASS));
  check('the password is stored as a salted scrypt hash',
    /^scrypt\$\d+\$\d+\$\d+\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(stored.passwordHash || ''),
    String(stored.passwordHash || '').slice(0, 24) + '...');
  check('two accounts with the same password get different hashes', await (async () => {
    await post('/api/auth/signup', { name: 'Twin', email: 'twin@example.com', password: PASS });
    const twin = await users.findOne({ email: 'twin@example.com' });
    return twin.passwordHash !== stored.passwordHash;
  })());
  check('role, status and createdAt are stored in usable types',
    stored.role === 'customer' && stored.status === 'active' && stored.createdAt instanceof Date);
  check('lastLoginAt starts empty and is not invented', stored.lastLoginAt === null);

  const idx = await users.indexes();
  check('email is unique at the database level, not just in code',
    idx.some(i => i.key && i.key.email === 1 && i.unique));
  const sIdx = await sessions.indexes();
  check('MongoDB expires stale sessions by itself',
    sIdx.some(i => i.expireAfterSeconds !== undefined && i.key && i.key.expiresAt === 1));

  console.log('\n=== Signup refuses bad input ===\n');
  r = await post('/api/auth/signup', { name: 'Again', email: 'MEI@example.com', password: PASS });
  check('the same address cannot register twice, in any casing', r.status === 409, String(r.status));
  check('and it says so plainly', /already/i.test(r.body.error || ''), r.body.error);
  check('one account per address in the database',
    await users.countDocuments({ email: 'mei@example.com' }) === 1);

  r = await post('/api/auth/signup', { email: 'not-an-email', password: PASS });
  check('a malformed address is rejected', r.status === 400, r.body.error);
  r = await post('/api/auth/signup', { email: 'short@example.com', password: 'abc' });
  check('a too-short password is rejected', r.status === 400, r.body.error);
  check('and the rejected signup created nothing',
    await users.countDocuments({ email: 'short@example.com' }) === 0);

  console.log('\n=== Signing in ===\n');
  r = await post('/api/auth/login', { email: 'mei@example.com', password: PASS });
  check('the right password signs in', r.status === 200 && !!r.body.token);
  const loginToken = r.body.token;
  check('signing in records when it happened',
    !!(await users.findOne({ email: 'mei@example.com' })).lastLoginAt);

  r = await post('/api/auth/login', { email: 'mei@example.com', password: 'wrong-password' });
  const wrongPw = r;
  check('a wrong password is refused', r.status === 401);
  r = await post('/api/auth/login', { email: 'nobody@example.com', password: PASS });
  check('an unknown address is refused the same way, so it cannot be used to ' +
    'discover who has an account', r.status === 401 && r.body.error === wrongPw.body.error,
    r.body.error);

  console.log('\n=== Sessions ===\n');
  r = await get('/api/auth/me', meiToken);
  check('a token identifies its owner', r.status === 200 && r.body.user.email === 'mei@example.com');
  check('the account list from /me carries no hash', !('passwordHash' in r.body.user));
  r = await get('/api/auth/me');
  check('no token means no answer', r.status === 401);
  r = await get('/api/auth/me', 'made-up-token');
  check('an invented token is rejected', r.status === 401);

  const meiId = stored._id;
  check('each sign-in is its own session, so signing out on one device leaves ' +
    'the other alone', await sessions.countDocuments({ userId: meiId }) === 2,
    String(await sessions.countDocuments({ userId: meiId })));
  check('the session stores a hash of the token, not the token',
    !!(await sessions.findOne({ _id: auth.tokenHash(loginToken) })) &&
    await sessions.countDocuments({ _id: loginToken }) === 0);

  // a session that has run out is refused even before MongoDB's TTL job runs
  await sessions.updateOne({ _id: auth.tokenHash(loginToken) },
    { $set: { expiresAt: new Date(Date.now() - 1000) } });
  r = await get('/api/auth/me', loginToken);
  check('an expired session is refused', r.status === 401);
  check('and is cleared out', await sessions.countDocuments({ _id: auth.tokenHash(loginToken) }) === 0);

  console.log('\n=== Signing out ===\n');
  r = await post('/api/auth/logout', {}, meiToken);
  check('logout succeeds', r.status === 200 && r.body.success === true);
  check('the session is gone from the database, so a copied token is worthless',
    await sessions.countDocuments({ userId: meiId }) === 0);
  r = await get('/api/auth/me', meiToken);
  check('the old token no longer works', r.status === 401);
  r = await post('/api/auth/logout', {}, meiToken);
  check('signing out twice is not an error', r.status === 200);
  check('logging out does not delete the account', await users.countDocuments({ _id: meiId }) === 1);

  console.log('\n=== Changing a password ===\n');
  const fresh = (await post('/api/auth/login', { email: 'mei@example.com', password: PASS })).body.token;
  const other = (await post('/api/auth/login', { email: 'mei@example.com', password: PASS })).body.token;
  r = await post('/api/auth/password', { currentPassword: 'nope', newPassword: 'new-password-1' }, fresh);
  check('the current password must be right', r.status === 401);
  r = await post('/api/auth/password', { currentPassword: PASS, newPassword: 'abc' }, fresh);
  check('the new password must be long enough', r.status === 400);
  r = await post('/api/auth/password', { currentPassword: PASS, newPassword: 'new-password-1' }, fresh);
  check('a valid change succeeds', r.status === 200);
  check('the old password stops working',
    (await post('/api/auth/login', { email: 'mei@example.com', password: PASS })).status === 401);
  check('the new one works',
    (await post('/api/auth/login', { email: 'mei@example.com', password: 'new-password-1' })).status === 200);
  check('other devices are signed out', (await get('/api/auth/me', other)).status === 401);
  check('the device that changed it stays signed in', (await get('/api/auth/me', fresh)).status === 200);

  console.log('\n=== Guessing is slowed down ===\n');
  auth.throttleReset();
  let last;
  for (let i = 0; i < 6; i++) {
    last = await post('/api/auth/login', { email: 'twin@example.com', password: 'guess-' + i });
  }
  check('repeated wrong passwords start being refused outright', last.status === 429, String(last.status));
  check('even the right password waits out the lock',
    (await post('/api/auth/login', { email: 'twin@example.com', password: PASS })).status === 429);
  auth.throttleReset();
  check('and it works again once the lock clears',
    (await post('/api/auth/login', { email: 'twin@example.com', password: PASS })).status === 200);

  console.log('\n=== Administrators ===\n');
  r = await get('/api/auth/status');
  check('signing up normally never creates an administrator', r.body.adminExists === false);
  r = await post('/api/auth/signup',
    { name: 'Owner', email: 'owner@example.com', password: PASS, asAdmin: true });
  check('the first account may claim the admin role', r.status === 201 && r.body.user.role === 'admin');
  const adminToken = r.body.token;
  r = await post('/api/auth/signup',
    { name: 'Sneaky', email: 'sneaky@example.com', password: PASS, asAdmin: true });
  check('after that, nobody can make themselves an administrator', r.status === 403, String(r.status));
  check('and no account was created for the attempt',
    await users.countDocuments({ email: 'sneaky@example.com' }) === 0);
  check('the login screen can now see an administrator exists',
    (await get('/api/auth/status')).body.adminExists === true);

  const customerToken = (await post('/api/auth/login',
    { email: 'twin@example.com', password: PASS })).body.token;
  check('the user list needs a sign-in', (await get('/api/auth/users')).status === 401);
  check('a customer cannot read the user list',
    (await get('/api/auth/users', customerToken)).status === 403);
  r = await get('/api/auth/users', adminToken);
  check('an administrator can', r.status === 200 && Array.isArray(r.body));
  check('it lists every account', r.body.length === await users.countDocuments(),
    r.body.length + ' listed');
  check('with no password hashes in it', !JSON.stringify(r.body).toLowerCase().includes('passwordhash'));

  console.log('\n=== Privileges: what a staff account may touch ===\n');
  /* The administrator hands out one level per module. Everything below goes
     through the API directly - a hidden button proves nothing. */
  r = await post('/api/auth/users', {
    name: 'Sam Staff', email: 'sam@example.com', password: PASS,
    role: 'staff',
    permissions: { cases: 'edit', products: 'view', inventory: 'none', nonsense: 'edit' }
  }, adminToken);
  check('an administrator can create a staff account', r.status === 201, String(r.status));
  check('with exactly the ticks that were sent',
    r.body.user.permissions.cases === 'edit' && r.body.user.permissions.products === 'view' &&
    r.body.user.permissions.faq === 'none', JSON.stringify(r.body.user.permissions));
  check('a module that does not exist is dropped, not stored',
    !('nonsense' in r.body.user.permissions));
  check('and staff with a tick may open the console', r.body.user.console === true);
  const samId = r.body.user.id;
  const samToken = (await post('/api/auth/login', { email: 'sam@example.com', password: PASS })).body.token;

  check('staff can save the module they may edit',
    (await post('/api/cms?type=cases', [{ zh: { title: 'By Sam' } }], samToken)).status === 200);
  r = await post('/api/cms?type=products', [{ id: 9, sku: 'WH-Z', title: 'Sneaked in' }], samToken);
  check('view-only means view only: the save is refused', r.status === 403, String(r.status));
  check('with a reason naming the module', /products/.test(r.body.error || ''), r.body.error);
  check('and nothing was written',
    !(await get('/api/cms?type=products')).body.some(p => p.sku === 'WH-Z'));
  check('a module they were not given at all is refused too',
    (await post('/api/cms?type=faq', [{ id: 1, q: 'x', a: 'y' }], samToken)).status === 403);
  check('reading is still open, so the public site keeps working',
    (await get('/api/cms?type=products')).status === 200);

  // something to move stock on
  await post('/api/cms?type=products',
    [{ id: 1, sku: 'WH-A', title: 'Alpha', price: '100.00', status: 'In Stock', stock: 10 }], adminToken);
  check('no inventory tick means no stock movements',
    (await post('/api/stock/WH-A/adjust', { type: 'receive', qty: 5 }, samToken)).status === 403);
  r = await patch('/api/auth/users/' + samId, { permissions: { cases: 'edit', inventory: 'edit' } }, adminToken);
  check('the administrator can change the ticks', r.status === 200 &&
    r.body.user.permissions.inventory === 'edit');
  check('and the change applies to the session already open, with no sign-in again',
    (await post('/api/stock/WH-A/adjust', { type: 'receive', qty: 5, note: 'by sam' }, samToken)).status === 200);
  check('products dropped out of the new tick list',
    (await post('/api/cms?type=products', [], samToken)).status === 403);

  console.log('\n=== Privileges: members and strangers ===\n');
  check('a member cannot write anything',
    (await post('/api/cms?type=cases', [], customerToken)).status === 403);
  check('and cannot open the console',
    (await get('/api/auth/me', customerToken)).body.user.console === false);
  r = await post('/api/cms?type=cases', []);
  check('a stranger with no token is refused', r.status === 401, String(r.status));
  check('and told it is the session that is missing', r.body.code === 'no_session');
  check('the activity trail is closed to members',
    (await post('/api/activity', { module: 'cases', text: 'sneaky' }, customerToken)).status === 403);
  await post('/api/activity', { module: 'cases', text: 'Edited a case' }, samToken);
  const trail = await get('/api/cms?type=activity');
  check('and records who wrote each entry',
    trail.body[0].by === 'sam@example.com', trail.body[0].by);
  const moves = await get('/api/cms?type=movements');
  check('stock movements record who made them',
    moves.body.some(m => m.by === 'sam@example.com'));

  console.log('\n=== Privileges: only administrators manage accounts ===\n');
  check('staff cannot list accounts', (await get('/api/auth/users', samToken)).status === 403);
  check('staff cannot create accounts',
    (await post('/api/auth/users', { email: 'x@example.com', password: PASS, role: 'admin' }, samToken)).status === 403);
  check('staff cannot promote themselves',
    (await patch('/api/auth/users/' + samId, { role: 'admin' }, samToken)).status === 403);
  check('and the attempt left them as staff',
    (await get('/api/auth/me', samToken)).body.user.role === 'staff');

  console.log('\n=== Editing an account ===\n');
  r = await patch('/api/auth/users/' + samId, { name: 'Samuel Staff' }, adminToken);
  check('a name can be corrected', r.status === 200 && r.body.user.name === 'Samuel Staff');
  r = await patch('/api/auth/users/' + samId, { role: 'customer' }, adminToken);
  check('turning staff into a plain member clears every tick',
    r.body.user.permissions.cases === 'none' && r.body.user.console === false,
    JSON.stringify(r.body.user.permissions));
  check('and they lose console rights immediately',
    (await post('/api/cms?type=cases', [], samToken)).status === 403);
  await patch('/api/auth/users/' + samId, { role: 'staff', permissions: { cases: 'edit' } }, adminToken);

  r = await post('/api/auth/users/' + samId + '/password', { password: 'set-by-the-admin' }, adminToken);
  check('an administrator can reset a password', r.status === 200);
  check('which signs that account out everywhere',
    (await get('/api/auth/me', samToken)).status === 401);
  check('the old password no longer works',
    (await post('/api/auth/login', { email: 'sam@example.com', password: PASS })).status === 401);
  const samAgain = await post('/api/auth/login', { email: 'sam@example.com', password: 'set-by-the-admin' });
  check('the one the administrator set does', samAgain.status === 200);
  const samToken2 = samAgain.body.token;

  r = await patch('/api/auth/users/' + samId, { status: 'disabled' }, adminToken);
  check('an account can be disabled', r.status === 200 && r.body.user.status === 'disabled');
  check('which also ends its sessions', (await get('/api/auth/me', samToken2)).status === 401);
  check('and it can no longer sign in',
    (await post('/api/auth/login', { email: 'sam@example.com', password: 'set-by-the-admin' })).status === 403);
  await patch('/api/auth/users/' + samId, { status: 'active' }, adminToken);
  check('turning it back on restores the sign-in',
    (await post('/api/auth/login', { email: 'sam@example.com', password: 'set-by-the-admin' })).status === 200);

  console.log('\n=== You cannot lock yourself out ===\n');
  const adminId = (await get('/api/auth/me', adminToken)).body.user.id;
  check('an administrator cannot change their own account type',
    (await patch('/api/auth/users/' + adminId, { role: 'staff' }, adminToken)).status === 400);
  check('nor disable themselves',
    (await patch('/api/auth/users/' + adminId, { status: 'disabled' }, adminToken)).status === 400);
  check('nor delete themselves',
    (await del('/api/auth/users/' + adminId, adminToken)).status === 400);
  check('and they are still an administrator after all that',
    (await get('/api/auth/me', adminToken)).body.user.role === 'admin');

  r = await post('/api/auth/users',
    { name: 'Second Admin', email: 'second@example.com', password: PASS, role: 'admin' }, adminToken);
  check('an administrator can create another administrator', r.status === 201 && r.body.user.role === 'admin');
  const secondId = r.body.user.id;
  const secondToken = (await post('/api/auth/login', { email: 'second@example.com', password: PASS })).body.token;
  check('with two of them, one can be demoted by the other',
    (await patch('/api/auth/users/' + adminId, { role: 'staff', permissions: { cases: 'edit' } }, secondToken)).status === 200);
  check('the last one standing cannot be demoted',
    (await patch('/api/auth/users/' + secondId, { role: 'staff' }, secondToken)).status === 400);
  check('nor disabled', (await patch('/api/auth/users/' + secondId, { status: 'disabled' }, secondToken)).status === 400);
  check('and the site still has an administrator',
    (await get('/api/auth/status')).body.adminExists === true);
  await patch('/api/auth/users/' + adminId, { role: 'admin' }, secondToken);

  console.log('\n=== The super admin ===\n');
  await app.ensureSuperAdmin(db);
  const root = await users.findOne({ email: 'root@example.com' });
  check('the super admin from .env is created at startup', !!root && root.role === 'admin');
  check('its password is hashed like everyone else\'s', /^scrypt\$/.test(root.passwordHash));
  await app.ensureSuperAdmin(db);
  check('running startup again does not duplicate it',
    await users.countDocuments({ email: 'root@example.com' }) === 1);
  const rootLogin = await post('/api/auth/login', { email: 'root@example.com', password: 'root' });
  check('it can sign in with the configured password', rootLogin.status === 200);
  check('and is marked as the super admin', rootLogin.body.user.super === true);
  const rootId = rootLogin.body.user.id;
  const rootToken = rootLogin.body.token;

  check('another administrator cannot demote it',
    (await patch('/api/auth/users/' + rootId, { role: 'staff' }, adminToken)).status === 400);
  check('nor disable it',
    (await patch('/api/auth/users/' + rootId, { status: 'disabled' }, adminToken)).status === 400);
  check('nor delete it', (await del('/api/auth/users/' + rootId, adminToken)).status === 400);
  check('nor reset its password',
    (await post('/api/auth/users/' + rootId + '/password', { password: 'hijacked-1' }, adminToken)).status === 400);
  check('but may correct its name',
    (await patch('/api/auth/users/' + rootId, { name: 'Root' }, adminToken)).status === 200);
  check('the super admin can still change their own password',
    (await post('/api/auth/password', { currentPassword: 'root', newPassword: 'root-password-2' }, rootToken)).status === 200);
  await users.updateOne({ _id: root._id }, { $set: { role: 'staff', status: 'disabled' } });
  await app.ensureSuperAdmin(db);
  check('if it is ever tampered with in the database, startup restores it',
    (await users.findOne({ _id: root._id })).role === 'admin');
  check('and the password set at startup is left alone afterwards',
    (await post('/api/auth/login', { email: 'root@example.com', password: 'root-password-2' })).status === 200);

  console.log('\n=== Deleting an account ===\n');
  const before = await users.countDocuments();
  r = await del('/api/auth/users/' + samId, adminToken);
  check('an administrator can delete an account', r.status === 200);
  check('it is gone from the database', await users.countDocuments() === before - 1);
  check('and its sessions with it',
    await sessions.countDocuments({ email: 'sam@example.com' }) === 0);
  check('deleting an account that is not there is a clean 404',
    (await del('/api/auth/users/' + samId, adminToken)).status === 404);
  check('a nonsense id is a 404, not a crash',
    (await del('/api/auth/users/not-an-id', adminToken)).status === 404);

  console.log('\n=== Accounts are not content ===\n');
  const cms = await fetch(BASE + '/api/cms?type=users');
  check('users cannot be read through the content API', cms.status === 404, String(cms.status));
  const all = await (await fetch(BASE + '/api/cms')).json();
  check('and are not in the everything-at-once response',
    !('users' in all) && !('sessions' in all), Object.keys(all).join(', '));
  const health = await (await fetch(BASE + '/api/health')).json();
  check('the health check still answers', health.ok === true);

  server.close();
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
