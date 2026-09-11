/* Wonder Herb local CMS API
 *
 * The public site is static and stays that way. This server exists so the
 * admin and the site can share one database while you work: MongoDB is the
 * editing surface, and `npm run export` writes it back into data/ for
 * committing. If this server is not running, both the admin and the site
 * fall back to the committed files exactly as before.
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const { ObjectId } = require('mongodb');
const cors = require('cors');
const { connect, COLLECTIONS, AUTH_COLLECTIONS, normalise, ensureIndexes,
        ensureAuthIndexes, ensureSalesIndexes, PAGE_COLLECTIONS,
        ensurePageIndexes, URL, DB_NAME } = require('./db');
const auth = require('./auth');
const reports = require('./reports');
const sales = require('./sales');
const stock = require('./stock');

const PORT = process.env.PORT || 4000;
const app = express();

app.use(cors());
app.use(express.json({ limit: '20mb' }));

/* A module is either a list (cases/products/faq/movements) or the single
   homepage settings document. */
const LIST_MODULES = Object.keys(COLLECTIONS);
const isList = m => LIST_MODULES.indexOf(m) !== -1;

/* Housekeeping fields stay in the database and out of the browser's copy. */
function stripId(doc) {
  if (!doc) return doc;
  const { _id, pos, updatedAt, ...rest } = doc;
  return rest;
}

async function readList(db, name) {
  const rows = await db.collection(COLLECTIONS[name]).find({}).sort({ pos: 1 }).toArray();
  return rows.map(stripId);
}

/* Replace a whole list, preserving the order the editor sees.
 *
 * Written into a temporary collection and renamed over the real one, so a
 * failure part-way through leaves the existing data untouched. A plain
 * deleteMany + insertMany would empty the collection if the insert threw.
 */
async function writeList(db, name, items) {
  const target = COLLECTIONS[name];
  const list = Array.isArray(items) ? items : [];
  const stamp = new Date();

  if (!list.length) {
    await db.collection(target).deleteMany({});
    return 0;
  }

  const tmp = target + '_writing';
  await db.collection(tmp).drop().catch(() => {});
  try {
    await db.collection(tmp).insertMany(list.map((item, i) =>
      Object.assign(normalise(name, item), { pos: i, updatedAt: stamp })));
    await db.collection(tmp).rename(target, { dropTarget: true });
  } catch (err) {
    await db.collection(tmp).drop().catch(() => {});
    throw err;
  }
  await ensureIndexes(db);
  return list.length;
}

async function readHomepage(db) {
  const doc = await db.collection('homepage').findOne({ _id: 'homepage' });
  return doc ? stripId(doc) : {};
}

async function writeHomepage(db, values) {
  await db.collection('homepage').replaceOne(
    { _id: 'homepage' },
    Object.assign({ _id: 'homepage' }, values || {}, { updatedAt: new Date() }),
    { upsert: true }
  );
  return 1;
}

/* ===========================================================================
   NEVER SILENTLY DROP LANGUAGES YOU WERE NOT SHOWN.
   docs/FINDINGS.md finding 20. HIGH.

   Product titles and descriptions became per-language objects at P9-T1
   ({ zh: '…', en: '…', … }), recovered from seven translations the live site
   already shipped. But admin/index.html edits a title in an <input>, and an
   input holds a STRING. So an ordinary product edit - fixing a typo, changing
   a price - would POST `title: "…"` over the language map and delete six
   languages of the client's paid-for copy. No error, no warning; the admin
   would look like it had worked.

   This is the guard, and it lives HERE rather than in the form on purpose: the
   API is the only way into the database, so the invariant holds for every
   caller - the admin today, the Puck editor, a script, whatever is written
   next. Fixing the form protects the form, and only until someone writes
   another one.

   The rule: a plain string arriving where a language map is stored is treated
   as an edit to the PRIMARY language, not as a replacement of the whole map.
   The merge is reported back to the caller, so it is visible rather than
   magic.

   The real fix for the UX - an admin form that knows about languages - is
   registered as its own task (BUILD_TASKS P12-T3). Until it lands, staff can
   edit zh safely and simply cannot reach the other six.
   =========================================================================== */
const LANG_CODES = ['zh', 'en', 'de', 'es', 'fr', 'ja', 'ru'];
const PRIMARY_LANG = 'zh';

function isLangMap(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  return keys.length > 0 && keys.every(k => LANG_CODES.indexOf(k) !== -1);
}

/* Identity for matching an incoming item to the one already stored. SKU first
   because product ids are not stable across sources (see P9-T1). */
const identityOf = item => (item && (item.sku || (item.id !== undefined ? 'id:' + item.id : null))) || null;

function protectLangMaps(existing, incoming) {
  const byKey = new Map();
  existing.forEach(doc => { const k = identityOf(doc); if (k) byKey.set(k, doc); });

  const merges = [];
  const items = incoming.map(item => {
    const before = byKey.get(identityOf(item));
    if (!before || !item || typeof item !== 'object') return item;

    const out = Object.assign({}, item);
    Object.keys(out).forEach(field => {
      if (isLangMap(before[field]) && typeof out[field] === 'string') {
        const kept = Object.keys(before[field]).filter(l => l !== PRIMARY_LANG);
        out[field] = Object.assign({}, before[field], { [PRIMARY_LANG]: out[field] });
        merges.push({ item: identityOf(item), field: field, keptLanguages: kept });
      }
    });
    return out;
  });

  return { items, merges };
}

const asyncRoute = fn => (req, res) => fn(req, res).catch(err => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

/* ---------------------------------------------------------------- health */
app.get('/api/health', asyncRoute(async (req, res) => {
  const db = await connect();
  const counts = {};
  for (const name of LIST_MODULES) {
    counts[name] = await db.collection(COLLECTIONS[name]).countDocuments();
  }
  counts.homepage = await db.collection('homepage').countDocuments();
  res.json({ ok: true, db: DB_NAME, url: URL.replace(/\/\/.*@/, '//'), counts });
}));

/* ---------------------------------------------------------------- modules
   Kept on the same /api/cms?type=… shape the admin already speaks, so the
   editor's existing save calls did not have to be rewritten. */
app.get('/api/cms', asyncRoute(async (req, res) => {
  const db = await connect();
  const type = req.query.type;
  if (!type) {
    const all = {};
    for (const name of LIST_MODULES) all[name] = await readList(db, name);
    all.homepage = await readHomepage(db);
    return res.json(all);
  }
  if (type === 'homepage') return res.json(await readHomepage(db));
  if (!isList(type)) return res.status(404).json({ error: 'Unknown type: ' + type });
  res.json(await readList(db, type));
}));

app.post('/api/cms', asyncRoute(async (req, res) => {
  const db = await connect();
  const type = req.query.type;
  const module = MODULE_OF[type];
  if (!module) return res.status(404).json({ error: 'Unknown type: ' + type });
  const actor = await requireCan(req, res, module, 'edit');
  if (!actor) return;
  if (type === 'homepage') {
    await writeHomepage(db, req.body);
    return res.json({ success: true, type, count: 1 });
  }
  if (!isList(type)) return res.status(404).json({ error: 'Unknown type: ' + type });
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Expected an array for ' + type });
  }
  /* see protectLangMaps above - a plain string must not flatten a stored
     language map, and the caller is told when that was prevented */
  const stored = await readList(db, type);
  const { items, merges } = protectLangMaps(stored, req.body);
  const count = await writeList(db, type, items);
  const body = { success: true, type, count };
  if (merges.length) {
    body.mergedIntoPrimary = merges;
    body.notice = merges.length + ' field(s) arrived as plain text where a ' +
      'translated value is stored. Each was saved as the ' + PRIMARY_LANG +
      ' text and the other languages were kept.';
  }
  res.json(body);
}));

/* ---------------------------------------------------------------- activity
   The dashboard's "Recent changes" trail. Append-only and capped, so it is a
   history rather than something the editor can silently rewrite. */
app.post('/api/activity', asyncRoute(async (req, res) => {
  const found = await auth.currentUser(req);
  if (!found || !auth.hasConsoleAccess(found.user)) {
    return res.status(403).json({ error: 'Only console users write to the activity trail' });
  }
  const db = await connect();
  const entry = {
    at: req.body.at || new Date().toISOString(),
    module: String(req.body.module || 'other'),
    text: String(req.body.text || '').slice(0, 500),
    by: found.user.email,
    pos: -Date.now(),
    updatedAt: new Date()
  };
  if (!entry.text) return res.status(400).json({ error: 'An activity entry needs text' });
  await db.collection(COLLECTIONS.activity).insertOne(entry);

  // keep the most recent 200
  const extra = await db.collection(COLLECTIONS.activity)
    .find({}).sort({ pos: 1 }).skip(200).project({ _id: 1 }).toArray();
  if (extra.length) {
    await db.collection(COLLECTIONS.activity).deleteMany({ _id: { $in: extra.map(d => d._id) } });
  }
  res.json({ success: true });
}));

/* ---------------------------------------------------------------- stock
   One atomic update per movement, so two people adjusting the same product
   at once cannot overwrite each other the way a whole-list save would. */
app.post('/api/stock/:sku/adjust', asyncRoute(async (req, res) => {
  const actor = await requireCan(req, res, 'inventory', 'edit');
  if (!actor) return;
  const db = await connect();
  const sku = req.params.sku;
  const type = String(req.body.type || 'correction');
  const qty = Math.max(0, parseInt(req.body.qty, 10) || 0);
  const note = String(req.body.note || '').trim();

  const result = await stock.applyMovement(db, {
    sku: sku, type: type, qty: qty, note: note, by: actor.user.email
  });
  if (!result) return res.status(404).json({ error: 'No product with SKU ' + sku });
  res.json({ success: true, before: result.before, after: result.after,
             status: result.status, movement: result.movement });
}));

/* ---------------------------------------------------------------- accounts
   Signup / login / logout for the storefront and the admin console. The user
   record lives in MongoDB; what travels back to the browser is a session
   token, never the password and never its hash. */

async function adminCount(db) {
  return db.collection(AUTH_COLLECTIONS.users).countDocuments({ role: 'admin' });
}

/* Guards. Each answers 401/403 itself and returns null, so a route can simply
   bail out when it gets nothing back. */
/* `code: 'no_session'` marks the one case where the browser should forget the
   token it is holding. A 401 for a wrong password is not that case - it must
   not sign the person out of the session they are already in. */
const noSession = res => res.status(401).json({ error: 'Please sign in', code: 'no_session' });

async function requireUser(req, res) {
  const found = await auth.currentUser(req);
  if (!found) { noSession(res); return null; }
  return found;
}

async function requireAdmin(req, res) {
  const found = await auth.currentUser(req);
  if (!found) { noSession(res); return null; }
  if (found.user.role !== 'admin') {
    res.status(403).json({ error: 'Administrators only' });
    return null;
  }
  return found;
}

/* Editing rights are checked here, on the server, not by hiding a button:
   a view-only account calling the API directly is refused. */
async function requireCan(req, res, module, level) {
  const found = await auth.currentUser(req);
  if (!found) { noSession(res); return null; }
  if (!auth.can(found.user, module, level)) {
    res.status(403).json({
      error: level === 'edit'
        ? 'Your account cannot change ' + module
        : 'Your account cannot see ' + module
    });
    return null;
  }
  return found;
}

/* Which privilege a content module is governed by. Stock movements are part of
   inventory; the activity trail is a log any console user may append to. */
const MODULE_OF = {
  cases: 'cases', products: 'products', faq: 'faq',
  homepage: 'homepage', movements: 'inventory'
};

/* Enough for a login screen to know whether it should offer to create the
   first administrator. Deliberately says nothing about who those users are. */
app.get('/api/auth/status', asyncRoute(async (req, res) => {
  const db = await connect();
  res.json({
    ok: true,
    users: await db.collection(AUTH_COLLECTIONS.users).countDocuments(),
    adminExists: (await adminCount(db)) > 0,
    minPassword: auth.MIN_PASSWORD
  });
}));

app.post('/api/auth/signup', asyncRoute(async (req, res) => {
  const db = await connect();
  await ensureAuthIndexes(db);

  const email = auth.cleanEmail(req.body.email);
  const name = String(req.body.name || '').trim().slice(0, 120);
  const password = String(req.body.password || '');

  const problem = auth.emailProblem(email) || auth.passwordProblem(password);
  if (problem) return res.status(400).json({ error: problem });

  /* The very first account may claim the admin role, so a fresh install has a
     way in. After that an administrator can only be made from the command
     line (npm run admin:create), not by anyone filling in the signup form. */
  let role = 'customer';
  if (req.body.asAdmin) {
    if ((await adminCount(db)) > 0) {
      return res.status(403).json({ error: 'An administrator already exists' });
    }
    role = 'admin';
  }

  const doc = {
    name: name,
    email: email,
    passwordHash: auth.hashPassword(password),
    role: role,
    status: 'active',
    createdAt: new Date(),
    lastLoginAt: null
  };

  try {
    const result = await db.collection(AUTH_COLLECTIONS.users).insertOne(doc);
    doc._id = result.insertedId;
  } catch (err) {
    // the unique index is what actually prevents two accounts on one address,
    // so a duplicate is caught here rather than in a check that could race
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'That email address already has an account' });
    }
    throw err;
  }

  const token = await auth.createSession(db, doc, req.headers['user-agent']);
  res.status(201).json({ success: true, token: token, user: auth.publicUser(doc) });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const db = await connect();
  await ensureAuthIndexes(db);

  const email = auth.cleanEmail(req.body.email);
  const password = String(req.body.password || '');
  const ip = req.ip || '';

  const waitMinutes = auth.throttleCheck(email, ip);
  if (waitMinutes) {
    return res.status(429).json({ error: 'Too many attempts. Try again in ' + waitMinutes + ' minute(s).' });
  }

  const user = await db.collection(AUTH_COLLECTIONS.users).findOne({ email: email });
  // one message for both halves, so this cannot be used to find out which
  // addresses have accounts
  const wrong = () => {
    auth.throttleFail(email, ip);
    res.status(401).json({ error: 'Wrong email or password' });
  };
  if (!user) return wrong();
  if (!auth.verifyPassword(password, user.passwordHash)) return wrong();
  if (user.status === 'disabled') return res.status(403).json({ error: 'This account has been disabled' });

  auth.throttleClear(email, ip);
  const now = new Date();
  await db.collection(AUTH_COLLECTIONS.users)
    .updateOne({ _id: user._id }, { $set: { lastLoginAt: now } });
  user.lastLoginAt = now;

  const token = await auth.createSession(db, user, req.headers['user-agent']);
  res.json({ success: true, token: token, user: auth.publicUser(user) });
}));

/* Logging out removes the session server-side, so the token in the browser is
   worthless even if it was copied. Always a 200: signing out twice is not an
   error worth showing anyone. */
app.post('/api/auth/logout', asyncRoute(async (req, res) => {
  const db = await connect();
  const token = auth.bearer(req);
  if (token) {
    await db.collection(AUTH_COLLECTIONS.sessions).deleteOne({ _id: auth.tokenHash(token) });
  }
  res.json({ success: true });
}));

app.get('/api/auth/me', asyncRoute(async (req, res) => {
  const found = await requireUser(req, res);
  if (!found) return;
  res.json({ ok: true, user: auth.publicUser(found.user) });
}));

app.post('/api/auth/password', asyncRoute(async (req, res) => {
  const found = await requireUser(req, res);
  if (!found) return;
  const db = await connect();

  const current = String(req.body.currentPassword || '');
  const next = String(req.body.newPassword || '');
  if (!auth.verifyPassword(current, found.user.passwordHash)) {
    return res.status(401).json({ error: 'Your current password is not right' });
  }
  const problem = auth.passwordProblem(next);
  if (problem) return res.status(400).json({ error: problem });

  await db.collection(AUTH_COLLECTIONS.users).updateOne(
    { _id: found.user._id },
    { $set: { passwordHash: auth.hashPassword(next), passwordChangedAt: new Date() } });

  // every other device is signed out; this one stays signed in
  await db.collection(AUTH_COLLECTIONS.sessions).deleteMany({
    userId: found.user._id, _id: { $ne: found.session._id } });

  res.json({ success: true });
}));

/* The account list behind the admin's Users screen. Password hashes are not
   part of publicUser(), so they cannot leak through here. */
app.get('/api/auth/users', asyncRoute(async (req, res) => {
  const found = await requireAdmin(req, res);
  if (!found) return;
  const db = await connect();
  const rows = await db.collection(AUTH_COLLECTIONS.users)
    .find({}).sort({ createdAt: -1 }).limit(500).toArray();
  res.json(rows.map(auth.publicUser));
}));

/* ---------------------------------------------------------- managing users
   Only an administrator gets here, and the rules below exist so that no
   sequence of clicks can leave the site with nobody able to administer it. */

function userId(value) {
  try { return new ObjectId(String(value)); } catch (e) { return null; }
}

async function activeAdmins(db, exceptId) {
  const query = { role: 'admin', status: { $ne: 'disabled' } };
  if (exceptId) query._id = { $ne: exceptId };
  return db.collection(AUTH_COLLECTIONS.users).countDocuments(query);
}

/* Every session of a user whose access just changed, so a disabled account or
   a reset password cannot keep working from a tab that is already open. */
async function endSessionsFor(db, id) {
  await db.collection(AUTH_COLLECTIONS.sessions).deleteMany({ userId: id });
}

/* The super admin from .env always exists and is always an administrator.
   An existing password is never touched here - only a missing account is
   created - so changing it from the console sticks. */
async function ensureSuperAdmin(db) {
  const email = auth.SUPER_ADMIN_EMAIL;
  if (!email) return;
  const users = db.collection(AUTH_COLLECTIONS.users);
  const existing = await users.findOne({ email: email });
  if (existing) {
    if (existing.role !== 'admin' || existing.status === 'disabled') {
      await users.updateOne({ _id: existing._id },
        { $set: { role: 'admin', status: 'active', permissions: auth.emptyPermissions() } });
      console.log('Super admin ' + email + ' restored to administrator.');
    }
    return;
  }
  const password = String(process.env.SUPER_ADMIN_PASSWORD || '');
  if (!password) {
    console.log('SUPER_ADMIN_EMAIL is set but the account does not exist and no ' +
      'SUPER_ADMIN_PASSWORD was given, so it was not created.');
    return;
  }
  if (auth.passwordProblem(password)) {
    console.log('Warning: the super admin password is weaker than the site allows ' +
      'for anyone else (' + auth.passwordProblem(password) + '). Change it before going anywhere public.');
  }
  await users.insertOne({
    name: String(process.env.SUPER_ADMIN_NAME || 'Super admin'),
    email: email,
    passwordHash: auth.hashPassword(password),
    role: 'admin',
    permissions: auth.emptyPermissions(),
    status: 'active',
    createdAt: new Date(),
    createdBy: 'startup',
    lastLoginAt: null
  });
  console.log('Super admin ' + email + ' created.');
}

app.post('/api/auth/users', asyncRoute(async (req, res) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;
  const db = await connect();
  await ensureAuthIndexes(db);

  const email = auth.cleanEmail(req.body.email);
  const password = String(req.body.password || '');
  const problem = auth.emailProblem(email) || auth.passwordProblem(password);
  if (problem) return res.status(400).json({ error: problem });

  const role = auth.cleanRole(req.body.role);
  const doc = {
    name: String(req.body.name || '').trim().slice(0, 120),
    email: email,
    passwordHash: auth.hashPassword(password),
    role: role,
    permissions: role === 'staff' ? auth.cleanPermissions(req.body.permissions) : auth.emptyPermissions(),
    status: 'active',
    createdAt: new Date(),
    createdBy: actor.user.email,
    lastLoginAt: null
  };

  try {
    const result = await db.collection(AUTH_COLLECTIONS.users).insertOne(doc);
    doc._id = result.insertedId;
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'That email address already has an account' });
    }
    throw err;
  }
  res.status(201).json({ success: true, user: auth.publicUser(doc) });
}));

app.patch('/api/auth/users/:id', asyncRoute(async (req, res) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;
  const db = await connect();
  const id = userId(req.params.id);
  if (!id) return res.status(404).json({ error: 'No such account' });

  const users = db.collection(AUTH_COLLECTIONS.users);
  const target = await users.findOne({ _id: id });
  if (!target) return res.status(404).json({ error: 'No such account' });

  const isSelf = String(target._id) === String(actor.user._id);
  if (auth.isSuperAdmin(target) && !isSelf) {
    if (req.body.role !== undefined || req.body.status !== undefined) {
      return res.status(400).json({ error: 'The super admin cannot be changed by another account' });
    }
  }
  const update = {};

  if (req.body.name !== undefined) update.name = String(req.body.name).trim().slice(0, 120);

  if (req.body.role !== undefined) {
    const role = auth.cleanRole(req.body.role);
    if (isSelf && role !== target.role) {
      return res.status(400).json({ error: 'You cannot change your own account type' });
    }
    if (target.role === 'admin' && role !== 'admin' && await activeAdmins(db, target._id) === 0) {
      return res.status(400).json({ error: 'This is the last administrator' });
    }
    update.role = role;
    // a demoted administrator keeps no leftover rights, and a promoted one
    // needs no tick list at all
    if (role !== 'staff') update.permissions = auth.emptyPermissions();
  }

  if (req.body.permissions !== undefined) {
    update.permissions = auth.cleanPermissions(req.body.permissions);
  }

  if (req.body.status !== undefined) {
    const status = String(req.body.status) === 'disabled' ? 'disabled' : 'active';
    if (isSelf && status === 'disabled') {
      return res.status(400).json({ error: 'You cannot disable your own account' });
    }
    if (status === 'disabled' && target.role === 'admin' && await activeAdmins(db, target._id) === 0) {
      return res.status(400).json({ error: 'This is the last administrator' });
    }
    update.status = status;
  }

  if (!Object.keys(update).length) return res.status(400).json({ error: 'Nothing to change' });
  update.updatedBy = actor.user.email;
  await users.updateOne({ _id: id }, { $set: update });

  // losing access should not wait for a page refresh
  if (update.status === 'disabled') await endSessionsFor(db, id);

  res.json({ success: true, user: auth.publicUser(await users.findOne({ _id: id })) });
}));

app.post('/api/auth/users/:id/password', asyncRoute(async (req, res) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;
  const db = await connect();
  const id = userId(req.params.id);
  if (!id) return res.status(404).json({ error: 'No such account' });

  const target = await db.collection(AUTH_COLLECTIONS.users).findOne({ _id: id });
  if (!target) return res.status(404).json({ error: 'No such account' });
  if (auth.isSuperAdmin(target) && String(target._id) !== String(actor.user._id)) {
    return res.status(400).json({ error: 'Only the super admin can change their own password' });
  }

  const password = String(req.body.password || '');
  const problem = auth.passwordProblem(password);
  if (problem) return res.status(400).json({ error: problem });

  const result = await db.collection(AUTH_COLLECTIONS.users).updateOne({ _id: id }, {
    $set: {
      passwordHash: auth.hashPassword(password),
      passwordChangedAt: new Date(),
      passwordSetBy: actor.user.email
    }
  });
  if (!result.matchedCount) return res.status(404).json({ error: 'No such account' });

  // whoever was signed in with the old password is signed out
  await endSessionsFor(db, id);
  res.json({ success: true });
}));

app.delete('/api/auth/users/:id', asyncRoute(async (req, res) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;
  const db = await connect();
  const id = userId(req.params.id);
  if (!id) return res.status(404).json({ error: 'No such account' });

  const users = db.collection(AUTH_COLLECTIONS.users);
  const target = await users.findOne({ _id: id });
  if (!target) return res.status(404).json({ error: 'No such account' });
  if (String(target._id) === String(actor.user._id)) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }
  if (auth.isSuperAdmin(target)) {
    return res.status(400).json({ error: 'The super admin cannot be deleted' });
  }
  if (target.role === 'admin' && await activeAdmins(db, target._id) === 0) {
    return res.status(400).json({ error: 'This is the last administrator' });
  }

  await users.deleteOne({ _id: id });
  await endSessionsFor(db, id);
  res.json({ success: true });
}));

/* ------------------------------------------------------------------ pages
   Page layouts as data: one tree per page, addressed by slug. The renderer
   turns these into pre-rendered static HTML at publish time.

   Reads are open, like the rest of the content API - a page tree is public
   content and is what the site gets built from. Writes are administrators
   only, via the same requireAdmin guard the account routes use. Phase 12
   replaces that with a finer permission. */
const cleanSlug = v => String(v === undefined || v === null ? '' : v).trim().toLowerCase();
const SLUG_OK = /^[a-z0-9][a-z0-9_-]*$/;

app.get('/api/pages', asyncRoute(async (req, res) => {
  const db = await connect();
  res.json(await db.collection(PAGE_COLLECTIONS.pages)
    .find({}, { projection: { _id: 0 } }).sort({ slug: 1 }).toArray());
}));

app.get('/api/pages/:slug', asyncRoute(async (req, res) => {
  const db = await connect();
  const doc = await db.collection(PAGE_COLLECTIONS.pages)
    .findOne({ slug: cleanSlug(req.params.slug) }, { projection: { _id: 0 } });
  if (!doc) return res.status(404).json({ error: 'No such page: ' + req.params.slug });
  res.json(doc);
}));

app.put('/api/pages/:slug', asyncRoute(async (req, res) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;
  const slug = cleanSlug(req.params.slug);
  if (!SLUG_OK.test(slug)) {
    return res.status(400).json({ error: 'Bad slug: ' + req.params.slug });
  }
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Expected a page tree object' });
  }
  if (!Array.isArray(body.sections)) {
    return res.status(400).json({ error: 'A page tree needs a sections array' });
  }
  const db = await connect();
  const { _id, ...rest } = body;          // the slug in the URL wins
  const doc = Object.assign({}, rest, {
    slug: slug, updatedAt: new Date(), updatedBy: actor.user.email
  });
  await db.collection(PAGE_COLLECTIONS.pages)
    .replaceOne({ slug: slug }, doc, { upsert: true });
  res.json({ success: true, slug: slug, sections: doc.sections.length });
}));

/* ---------------------------------------------------------------- preview
   Render a DRAFT tree through the real renderer and hand back the HTML.
   P8-T2, BUILD_TASKS step 4.

   WHY THIS IS A SERVER ROUTE AND NOT A BROWSER RENDER. Puck's canvas already
   uses the same section components as the renderer (P8-T1 asserts that by
   object identity), so section markup matches. But a published page is more
   than its sections: the <head> from renderer/head.js, the document shell and
   the load-bearing scroll-reveal script from renderer/template.js, the page
   CSS and the chrome. Rebuilding any of that in the browser would create a
   second implementation, and "the preview and the published page disagree" is
   precisely the Puck fidelity gap this project is built to avoid (CLAUDE.md,
   Conventions). So the preview calls renderPage - the same function
   `npm run render` calls, in the same process family - and what the client sees
   is what publishes.

   Admin-only, via the existing requireAdmin. No new auth path.

   SECURITY: a tree names the page its CSS and chrome come from
   (`assets.stylesFrom` / `chromeFrom`), and the renderer reads that file off
   disk. This route accepts a tree from the network, so those two values are
   restricted to the actual page files in the repo root - otherwise a posted
   tree could ask for `../.env` and have it inlined into the response. */
const PAGE_FILE_OK = /^[^/\\]+\.html$/;
function safeSourcePage(value) {
  const name = String(value === undefined || value === null ? '' : value).trim();
  if (!name) return '';
  if (!PAGE_FILE_OK.test(name)) return '';
  const full = path.join(__dirname, '..', name);
  return fs.existsSync(full) ? name : '';
}

app.post('/api/preview', asyncRoute(async (req, res) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  const body = req.body || {};
  const tree = body.tree;
  if (!tree || typeof tree !== 'object' || !Array.isArray(tree.sections)) {
    return res.status(400).json({ error: 'Expected a page tree with a sections array' });
  }

  let renderer;
  try {
    renderer = require('../renderer/render');
  } catch (err) {
    return res.status(500).json({
      error: 'Renderer not built. Run `npm run sections:build` first. (' + err.message + ')'
    });
  }

  const assets = tree.assets || {};
  const safe = Object.assign({}, tree, {
    assets: Object.assign({}, assets, {
      stylesFrom: safeSourcePage(assets.stylesFrom),
      chromeFrom: safeSourcePage(assets.chromeFrom)
    })
  });

  try {
    const data = renderer.loadData();
    const html = renderer.renderPage(safe, body.lang || renderer.PRIMARY, data, {
      styles: renderer.loadStyles(safe.assets.stylesFrom),
      chrome: renderer.loadChrome(safe.assets.chromeFrom)
    });
    res.json({ html: html, lang: body.lang || renderer.PRIMARY, bytes: html.length });
  } catch (err) {
    // an unknown section type or a broken tree is a 400, not a server fault
    res.status(400).json({ error: 'Could not render this draft: ' + err.message });
  }
}));

/* ------------------------------------------------------------------ sales
   Invoices, customers and the yearly sales workbook. */
sales.mount(app, { connect: connect, requireCan: requireCan, asyncRoute: asyncRoute });

/* ---------------------------------------------------------------- reports
   The inventory spreadsheet, in the layout the client keeps by hand. Built
   from the database on request; anyone who may see inventory may download. */
app.get('/api/reports/inventory.xlsx', asyncRoute(async (req, res) => {
  const actor = await requireCan(req, res, 'inventory', 'view');
  if (!actor) return;
  const db = await connect();
  const products = await readList(db, 'products');
  const now = new Date();
  const wb = await reports.inventoryWorkbook(products, now);
  res.setHeader('Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition',
    'attachment; filename="' + reports.inventoryFilename(now) + '"');
  res.send(Buffer.from(await wb.xlsx.writeBuffer()));
}));

/* ---------------------------------------------------------------- CSV
   Same columns as data/inventory.csv, so the site's existing reader works
   against the live database with no change to how it parses. */
const CSV_HEAD = ['SKU', 'Product', 'Price (HKD)', 'On hand', 'Reorder at',
                  'Status', 'Stock value (HKD)', 'Last updated'];

const csvCell = v => '"' + String(v === undefined || v === null ? '' : v).replace(/"/g, '""') + '"';

app.get('/api/inventory.csv', asyncRoute(async (req, res) => {
  const db = await connect();
  const rows = await readList(db, 'products');
  const lines = [CSV_HEAD.map(csvCell).join(',')];
  rows.forEach(p => {
    const tracked = p.stock !== undefined && p.stock !== null && p.stock !== '';
    const n = tracked ? (parseInt(p.stock, 10) || 0) : null;
    const price = parseFloat(p.price) || 0;
    lines.push([
      p.sku || '', p.title || '', price.toFixed(2),
      n === null ? '' : n,
      tracked ? (p.reorder === undefined ? 10 : p.reorder) : '',
      p.status || '',
      n === null ? '' : (n * price).toFixed(2),
      p.stockUpdated || ''
    ].map(csvCell).join(','));
  });
  res.type('text/csv; charset=utf-8').send('﻿' + lines.join('\r\n') + '\r\n');
}));

/* ---------------------------------------------------------------- the site
   The same process also serves the pages, so working locally is one command
   rather than two. This is a convenience for development only: in production
   the files are served by GitHub Pages / Vercel and this server does not exist.

   Registered last, so every /api route above still wins. */
const SITE_ROOT = path.join(__dirname, '..');
const PRIVATE = /^\/(server|scripts|node_modules|data\/[^\/]*\.log)(\/|$)/i;

app.use((req, res, next) => {
  // the source of the server itself is not part of the site
  if (PRIVATE.test(decodeURIComponent(req.path))) return res.status(404).send('Not found');
  next();
});

app.use(express.static(SITE_ROOT, {
  dotfiles: 'ignore',
  extensions: ['html'],
  setHeaders(res, filePath) {
    // editing a page and refreshing should show the edit
    if (/\.(html|json|csv)$/i.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
  }
}));

if (require.main === module) {
  connect()
    .then(db => ensureAuthIndexes(db).then(() => ensureSalesIndexes(db))
                  .then(() => ensurePageIndexes(db)).then(() => ensureSuperAdmin(db)))
    .then(() => app.listen(PORT, () => {
      console.log('Site                 ->  http://localhost:' + PORT + '/');
      console.log('Admin                ->  http://localhost:' + PORT + '/admin/');
      console.log('API                  ->  http://localhost:' + PORT + '/api/health');
      console.log('MongoDB              ->  ' + URL + '/' + DB_NAME);
    }))
    .catch(err => {
      console.error('Cannot reach MongoDB at ' + URL);
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = app;
module.exports.ensureSuperAdmin = ensureSuperAdmin;
