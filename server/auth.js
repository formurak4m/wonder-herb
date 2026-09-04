/* Accounts for the Wonder Herb site and the admin console.
 *
 * Passwords are never stored, only a scrypt hash with a per-user salt, and a
 * login hands back a random token whose *hash* is what the sessions collection
 * keeps — so a copy of the database is not a copy of anybody's password or a
 * usable set of logins.
 *
 * Uses only node's own crypto, so there is no native module to build.
 */
const crypto = require('crypto');
const { connect, AUTH_COLLECTIONS: COLLECTIONS } = require('./db');

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const SESSION_DAYS = 30;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200;

/* ------------------------------------------------------------- passwords */

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, SCRYPT.keylen,
    { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 64 * 1024 * 1024 });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p,
    salt.toString('hex'), key.toString('hex')].join('$');
}

function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, saltHex, keyHex] = String(stored || '').split('$');
    if (scheme !== 'scrypt') return false;
    const key = Buffer.from(keyHex, 'hex');
    const test = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), key.length,
      { N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
    // constant time, so a wrong password cannot be narrowed down by timing
    return crypto.timingSafeEqual(key, test);
  } catch (e) {
    return false;
  }
}

/* ------------------------------------------------------------ validation */

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase().slice(0, 254);
}

function emailProblem(email) {
  if (!email) return 'An email address is required';
  if (!EMAIL_RE.test(email)) return 'That does not look like an email address';
  return null;
}

function passwordProblem(password) {
  const value = String(password || '');
  if (value.length < MIN_PASSWORD) return 'Use at least ' + MIN_PASSWORD + ' characters';
  if (value.length > MAX_PASSWORD) return 'That password is too long';
  return null;
}

/* --------------------------------------------------------------- sessions */

const tokenHash = token => crypto.createHash('sha256').update(String(token)).digest('hex');

async function createSession(db, user, userAgent) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  await db.collection(COLLECTIONS.sessions).insertOne({
    _id: tokenHash(token),
    userId: user._id,
    email: user.email,
    role: user.role,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_DAYS * 86400000),
    ua: String(userAgent || '').slice(0, 200)
  });
  return token;
}

function bearer(req) {
  const header = String(req.headers.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

/* The session and its user in one go, or null. An expired session is treated
   as absent even before MongoDB's TTL job gets around to removing it. */
async function currentUser(req) {
  const token = bearer(req);
  if (!token) return null;
  const db = await connect();
  const session = await db.collection(COLLECTIONS.sessions).findOne({ _id: tokenHash(token) });
  if (!session) return null;
  if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
    await db.collection(COLLECTIONS.sessions).deleteOne({ _id: session._id });
    return null;
  }
  const user = await db.collection(COLLECTIONS.users).findOne({ _id: session.userId });
  if (!user || user.status === 'disabled') return null;
  return { user, session };
}

/* Everything about a user except the things nobody outside should ever see. */
function publicUser(user) {
  if (!user) return null;
  const iso = v => (v instanceof Date ? v.toISOString() : (v || null));
  return {
    id: String(user._id),
    name: user.name || '',
    email: user.email,
    role: user.role || 'customer',
    super: isSuperAdmin(user),
    status: user.status || 'active',
    permissions: permissionsOf(user),
    console: hasConsoleAccess(user),
    createdAt: iso(user.createdAt),
    lastLoginAt: iso(user.lastLoginAt)
  };
}

/* ------------------------------------------------------------ privileges
   Three kinds of account:

     admin     everything, including managing accounts
     staff     only the modules an administrator ticked, at the level ticked
     customer  a website account; no way into the console at all

   A staff member's privileges are one level per module, so "can edit stock,
   can look at products, cannot see the FAQ" is expressible. `users` is never
   one of them: managing accounts stays with administrators. */
const MODULES = ['cases', 'products', 'inventory', 'faq', 'homepage', 'sales'];
const LEVELS = ['none', 'view', 'edit'];
const ROLES = ['admin', 'staff', 'customer'];

const emptyPermissions = () => MODULES.reduce((acc, m) => { acc[m] = 'none'; return acc; }, {});

/* Whatever a form sends, what gets stored is one known level for every known
   module - never a half-filled object and never a module we do not have. */
function cleanPermissions(input) {
  const out = emptyPermissions();
  if (input && typeof input === 'object') {
    MODULES.forEach(m => {
      const level = String(input[m] || 'none').toLowerCase();
      if (LEVELS.indexOf(level) !== -1) out[m] = level;
    });
  }
  return out;
}

const cleanRole = value => {
  const role = String(value || '').toLowerCase();
  return ROLES.indexOf(role) !== -1 ? role : 'customer';
};

/* An administrator is not stored with a tick list - the role itself is the
   answer, so a new module is theirs automatically. */
function permissionsOf(user) {
  if (!user) return emptyPermissions();
  if (user.role === 'admin') {
    return MODULES.reduce((acc, m) => { acc[m] = 'edit'; return acc; }, {});
  }
  if (user.role !== 'staff') return emptyPermissions();
  return cleanPermissions(user.permissions);
}

/* `level` is the minimum needed: 'view' is satisfied by 'edit'. */
function can(user, module, level) {
  const have = permissionsOf(user)[module] || 'none';
  return LEVELS.indexOf(have) >= LEVELS.indexOf(level || 'view');
}

/* Who may open /admin at all: an administrator, or a staff member with at
   least one module they can do something with. */
function hasConsoleAccess(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const perms = permissionsOf(user);
  return MODULES.some(m => perms[m] !== 'none');
}

/* ------------------------------------------------------------ super admin
   One account, named in .env, that no other administrator can demote,
   disable, delete or reset. It is the way back in if every other account is
   mismanaged. Created at startup if it does not exist. */
const SUPER_ADMIN_EMAIL = cleanEmail(process.env.SUPER_ADMIN_EMAIL || '');
const isSuperAdmin = user => !!(user && SUPER_ADMIN_EMAIL && user.email === SUPER_ADMIN_EMAIL);

/* --------------------------------------------------------- login throttle
   Wrong passwords are slowed down per email+address, so a stolen email list
   cannot be walked through a password guesser at full speed. In memory: this
   is a single local process, and a restart clearing it is acceptable. */
const FAIL_LIMIT = 5;
const FAIL_WINDOW = 15 * 60 * 1000;
const failures = new Map();

const failKey = (email, ip) => email + '|' + (ip || '');

function throttleCheck(email, ip) {
  const rec = failures.get(failKey(email, ip));
  if (!rec) return null;
  if (Date.now() - rec.first > FAIL_WINDOW) { failures.delete(failKey(email, ip)); return null; }
  if (rec.count < FAIL_LIMIT) return null;
  return Math.ceil((rec.first + FAIL_WINDOW - Date.now()) / 60000);
}

function throttleFail(email, ip) {
  const key = failKey(email, ip);
  const rec = failures.get(key);
  if (!rec || Date.now() - rec.first > FAIL_WINDOW) failures.set(key, { count: 1, first: Date.now() });
  else rec.count++;
}

const throttleClear = (email, ip) => failures.delete(failKey(email, ip));
const throttleReset = () => failures.clear();

module.exports = {
  hashPassword, verifyPassword,
  cleanEmail, emailProblem, passwordProblem,
  createSession, currentUser, publicUser, tokenHash, bearer,
  throttleCheck, throttleFail, throttleClear, throttleReset,
  MODULES, LEVELS, ROLES, cleanPermissions, cleanRole, emptyPermissions,
  permissionsOf, can, hasConsoleAccess, SUPER_ADMIN_EMAIL, isSuperAdmin,
  MIN_PASSWORD, SESSION_DAYS
};
