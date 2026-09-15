/* Rotate the super-admin identity, and remove every other account.
 *
 *   1. Put the new address in .env as   NEW_SUPER_ADMIN_EMAIL=...
 *   2. Stop the API (port 4000 must be free).
 *   3. node scripts/rotate-super-admin.js            (dry run: checks only)
 *      node scripts/rotate-super-admin.js --apply    (does it)
 *
 * WHY THIS EXISTS: three login addresses from this database are in public git
 * history (docs/FINDINGS.md finding 22). The owner chose to rotate identities
 * rather than rewrite history, so the exposed accounts must stop existing.
 *
 * WHAT --apply DOES, entirely through the app's own rules:
 *   - generates a strong random password and writes it, with the new address,
 *     into .env as SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD (gitignored);
 *   - starts the API, which creates the new super-admin at startup - the same
 *     bootstrap path as a fresh install;
 *   - signs in as the new super-admin and DELETES every other account through
 *     DELETE /api/auth/users/:id (which also ends their sessions). The old
 *     super-admin is no longer protected once .env names someone else;
 *   - verifies exactly one account remains, that it is the new one, that no
 *     remaining account matches a fingerprint of an exposed address, and that
 *     the old super-admin can no longer sign in;
 *   - stops the API it started, by its own PID.
 *
 * IT NEVER PRINTS an email address or a password. Accounts are shown by role and
 * fingerprint only (standing practice, finding 22). If anything fails before
 * the first deletion, .env is restored exactly.
 *
 * The audit trail (activity) is deliberately left as it is: append-only by
 * design, never exported, and the accounts it names will no longer exist.
 */
const fs = require('fs');
const path = require('path');
const net = require('net');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ENV = path.join(ROOT, '.env');
const PORT = 4000;
const BASE = 'http://localhost:' + PORT;
const APPLY = process.argv.includes('--apply');

/* sha256 of the trimmed, lower-cased exposed addresses. Fingerprints, never
   the addresses. Same list as the Phase 11 hard gate in BUILD_TASKS. */
const EXPOSED = new Set([
  '87924606b4131a8aceeeae8868531fbb9712aaa07a5d3a756b26ce0f5d6ca674',
  '2fbd33c012587b73ab496d79e764917c7c40b0874531c77267b3a83c45aeeb9d',
  '7932b2e116b076a54f452848eaabd5857f61bd957fe8a218faf216f24c9885bb'
]);
/* NO DOMAIN RULE HERE, deliberately (owner's decision, 15 Sep 2026). wonder-herb.com has no
   mailboxes yet, so requiring that domain would force an INVENTED address - the takeover hole
   this rotation exists to close. The real requirement is an inbox a real person can open, which
   no script can verify, so it is the owner's responsibility, stated at run time. This is a LOCAL
   dev database that Phase 11 replaces; the domain and free-mail rules belong to the hosted system
   and live in the Phase 11 hard gate in BUILD_TASKS, unchanged. */

const fp = email => crypto.createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex');
const short = email => fp(email).slice(0, 12);
const say = s => console.log('  ' + s);
const die = s => { console.error('\n  REFUSED: ' + s + '\n'); process.exit(1); };

function readEnv(text) {
  const map = {};
  text.split(/\r?\n/).forEach(l => {
    const i = l.indexOf('=');
    if (i > 0 && /^[A-Z_][A-Z0-9_]*$/.test(l.slice(0, i))) map[l.slice(0, i)] = l.slice(i + 1).trim();
  });
  return map;
}

/* Replace or add KEY=value lines, keeping every other line and the order. */
function writeEnvKeys(text, set, remove) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const seen = new Set();
  const lines = text.split(/\r?\n/).filter(l => {
    const k = l.slice(0, l.indexOf('='));
    return !(remove || []).includes(k);
  }).map(l => {
    const k = l.slice(0, l.indexOf('='));
    if (Object.prototype.hasOwnProperty.call(set, k)) { seen.add(k); return k + '=' + set[k]; }
    return l;
  });
  Object.keys(set).filter(k => !seen.has(k)).forEach(k => lines.push(k + '=' + set[k]));
  return lines.join(eol).replace(new RegExp('(' + eol + ')*$'), '') + eol;
}

const portFree = port => new Promise(res => {
  const s = net.createServer().once('error', () => res(false))
    .once('listening', () => s.close(() => res(true))).listen(port);
});

async function api(method, url, token, body) {
  const r = await fetch(BASE + url, {
    method, headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null; try { json = await r.json(); } catch (e) { /* empty */ }
  return { status: r.status, json };
}

async function main() {
  console.log('\nRotate super-admin identity (docs/FINDINGS.md finding 22)' + (APPLY ? '' : '  -- DRY RUN') + '\n');

  if (require('child_process').execSync('git check-ignore -q .env && echo y || echo n', { cwd: ROOT }).toString().trim() !== 'y') {
    die('.env is not gitignored - refusing to write a password into it.');
  }
  const original = fs.readFileSync(ENV, 'utf8');
  const env = readEnv(original);
  const next = (env.NEW_SUPER_ADMIN_EMAIL || '').trim().toLowerCase();

  if (!next) die('NEW_SUPER_ADMIN_EMAIL is not set in .env.');
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(next)) die('NEW_SUPER_ADMIN_EMAIL is not a valid address.');
  if (EXPOSED.has(fp(next))) die('the new address is one of the exposed ones.');
  if (fp(next) === fp(env.SUPER_ADMIN_EMAIL || '')) die('the new address is the current super-admin address.');
  say('new address: valid, not exposed, not the current one   (fingerprint ' + short(next) + ')');
  say('any domain accepted for this LOCAL rotation - it must be an inbox you can actually open.');
  say('the hosted database (Phase 11) refuses free-mail; see the hard gate in BUILD_TASKS.');
  say('current super-admin fingerprint ' + short(env.SUPER_ADMIN_EMAIL || '') +
      (EXPOSED.has(fp(env.SUPER_ADMIN_EMAIL || '')) ? '  <- exposed' : ''));

  if (!(await portFree(PORT))) die('port ' + PORT + ' is in use. Stop the running API first.');
  say('port ' + PORT + ': free');

  if (!APPLY) {
    say('\n  Dry run OK. Re-run with --apply to rotate. Nothing was changed.');
    return;
  }

  const password = crypto.randomBytes(24).toString('base64url');     // 32 chars, ~192 bits
  const oldEmail = env.SUPER_ADMIN_EMAIL;
  const oldPassword = env.SUPER_ADMIN_PASSWORD;
  fs.writeFileSync(ENV, writeEnvKeys(original,
    { SUPER_ADMIN_EMAIL: next, SUPER_ADMIN_PASSWORD: password }, ['NEW_SUPER_ADMIN_EMAIL']), 'utf8');
  say('.env updated: SUPER_ADMIN_EMAIL rotated, new random password written (not shown), NEW_SUPER_ADMIN_EMAIL removed');

  let child = null, deletedAny = false;
  const restore = why => {
    if (!deletedAny) { fs.writeFileSync(ENV, original, 'utf8'); say('.env RESTORED exactly (' + why + ')'); }
  };
  try {
    child = spawn(process.execPath, ['--env-file=.env', 'server/index.js'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    child.stdout.on('data', d => { log += d; }); child.stderr.on('data', d => { log += d; });
    say('API started, PID ' + child.pid);
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch(BASE + '/api/health')).ok) break; } catch (e) { /* not up yet */ }
      await new Promise(r => setTimeout(r, 500));
      if (i === 59) throw new Error('API did not come up');
    }
    if (!/Super admin .* created\./.test(log) && !/restored to administrator/.test(log)) {
      // the log line contains the address, so only its presence is checked, never printed
      say('note: no bootstrap line seen; verifying by signing in');
    }

    const login = await api('POST', '/api/auth/login', null, { email: next, password });
    if (login.status !== 200 || !login.json || !login.json.token) throw new Error('new super-admin could not sign in (' + login.status + ')');
    const token = login.json.token;
    if (!login.json.user.super) throw new Error('signed in, but the account is not the super-admin');
    say('new super-admin signed in: role ' + login.json.user.role + ', super ' + login.json.user.super);

    const users = (await api('GET', '/api/auth/users', token)).json || [];
    const others = users.filter(u => fp(u.email) !== fp(next));
    say('accounts before: ' + users.length + '   to delete: ' + others.length + '   (' +
        others.map(u => u.role + ' ' + short(u.email) + (EXPOSED.has(fp(u.email)) ? ' exposed' : '')).join(', ') + ')');

    for (const u of others) {
      const r = await api('DELETE', '/api/auth/users/' + u.id, token);
      if (r.status !== 200) throw new Error('delete ' + u.role + ' ' + short(u.email) + ' failed: ' + r.status + ' ' + (r.json && r.json.error));
      deletedAny = true;
      say('deleted ' + u.role + ' ' + short(u.email));
    }

    const after = (await api('GET', '/api/auth/users', token)).json || [];
    const oldLogin = await api('POST', '/api/auth/login', null, { email: oldEmail, password: oldPassword });

    console.log('\n  VERIFY');
    const checks = [
      ['exactly one account remains', after.length === 1, after.length],
      ['it is the new super-admin', after.length === 1 && fp(after[0].email) === fp(next) && after[0].super, after[0] ? after[0].role + ' super=' + after[0].super : '-'],
      ['no remaining account matches an exposed fingerprint', after.every(u => !EXPOSED.has(fp(u.email))), 'checked ' + after.length],
      ['the old super-admin can no longer sign in', oldLogin.status === 401, 'status ' + oldLogin.status]
    ];
    let bad = 0;
    checks.forEach(([label, ok, extra]) => { console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + label + (extra !== '' ? '   -> ' + extra : '')); if (!ok) bad++; });
    if (bad) throw new Error(bad + ' verification check(s) failed');
    console.log('\n  Rotation complete. Nothing was printed; both values are left readable in .env:' +
                '\n    SUPER_ADMIN_EMAIL     your new sign-in address' +
                '\n    SUPER_ADMIN_PASSWORD  the generated password' +
                '\n  Copy both into your password manager now, before anything else.' +
                '\n  (.env is gitignored. The API only uses SUPER_ADMIN_PASSWORD to CREATE the account if it is' +
                '\n  missing, so after saving it you may blank that line - but scripts/migrate-products.js signs in' +
                '\n  with it and would need it back. Keep SUPER_ADMIN_EMAIL: it marks the protected account.)\n');
  } catch (err) {
    console.error('\n  FAILED: ' + err.message);
    restore('failure before any deletion');
    if (deletedAny) console.error('  Some accounts were already deleted; .env keeps the NEW identity so the database and .env agree.');
    process.exitCode = 1;
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill();
      await new Promise(r => child.once('exit', r));
      say('API stopped (PID ' + child.pid + ')');
    } else if (child) {
      say('API had already exited on its own (PID ' + child.pid + ', code ' + child.exitCode + ') - nothing left running');
    }
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
