/* Nothing private is in what publishes.
 *
 * data/ is committed to a PUBLIC repository and deployed to a public URL. Twice
 * now something private has reached it by a path nobody was watching:
 *
 *   - docs/FINDINGS.md finding 16: `npm run export` wrote the audit trail and the
 *     stock-movement log, including staff email addresses. Fixed at P7-T1a by not
 *     emitting them at all.
 *   - P9-T1: page trees were exported raw, so the PUT /api/pages route's
 *     `updatedBy` stamp put the super-admin's email into data/pages/products.json.
 *     The P7-T1a fix never covered it because page trees did not exist yet.
 *
 * Both were fixed in the export. Neither had a test, so the next new data path
 * could do it a third time. This checks the OUTPUT - every file under data/ -
 * rather than any one code path, so it does not care how the leak got there.
 *
 * AND THE WHOLE REPOSITORY. The third exposure did not come through data/ at
 * all: docs/FINDINGS.md quoted the finding-16 audit trail verbatim as evidence
 * and put two more staff logins into public history (finding 22). A data/-only
 * scan structurally cannot see that class, so the second half of this suite
 * scans every tracked file, plus untracked files git would pick up, so a new
 * file is checked before its first commit.
 *
 * KNOWN LIMITS - written down so nobody assumes this is complete (finding 22):
 * disguised addresses ("name [at] gmail"), phone numbers and personal names
 * inside free text, anything in binary files (skipped), and anything already
 * in git history (this reads the working tree).
 *
 * Plain Node, no database, no network. Reads the working tree as it stands.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');

let fail = 0;
const check = (label, cond, extra) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '   -> ' + extra : ''));
  if (!cond) fail++;
};

/* Exact addresses that may appear in published data, each deliberately.
   NOT a domain: a staff login on the company's own domain (owner@, you@...) is
   exactly the kind of address that must not publish, and a domain allow-list
   would wave it through. Adding an address here is a decision - e.g. the
   partner contacts on 聯絡我們 when that page migrates to data. */
const PUBLIC_EMAILS = ['info@wonder-herb.com'];

/* The decision that comment anticipated, taken 16 Sep 2026 when 聯絡我們
   migrated: the three overseas distributor addresses the contact page has
   always published are allowed in that page's tree, and ONLY there. Any other
   address in that file, and these addresses in any other file under data/,
   still fail. Keyed by path so it cannot widen into a domain rule. */
const DATA_EMAIL_ALLOW = {
  'pages/contact.json': ['wonderherbusa@gmail.com', 'jc@smartgroupinc.org', 'enquiry@provital.com.au']
};

/* Collections that exist in MongoDB and must never be exported. customers and
   invoices carry real names, phone numbers and medical remarks (CLAUDE.md);
   movements and activity are the audit trail (finding 16); users and sessions
   are credentials. */
const NEVER_PUBLISHED = ['customers', 'invoices', 'movements', 'activity', 'users', 'sessions'];

/* Database bookkeeping and identity fields. None of these is page content. */
const PRIVATE_KEYS = ['updatedBy', 'createdBy', '_id', 'password', 'passwordHash',
                      'hash', 'salt', 'token', 'sessionId', 'phone', 'remarks'];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

console.log('\n=== nothing private is in data/ (it deploys publicly) ===\n');

const files = walk(DATA);
const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');
check('data/ exists and has files to check', files.length > 0, files.length + ' file(s)');

const badNames = files.filter(f =>
  NEVER_PUBLISHED.some(n => path.basename(f).toLowerCase().startsWith(n)));
check('no private collection is exported', badNames.length === 0,
      badNames.length ? badNames.map(rel).join(', ') : NEVER_PUBLISHED.join(', ') + ': none');

const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const EMAIL_ONE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const leakedEmails = [];
const leakedKeys = [];
files.forEach(f => {
  const text = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = EMAIL.exec(text))) {
    const where = rel(f).replace(/^data\//, '');
    const allowed = PUBLIC_EMAILS.includes(m[0].toLowerCase()) ||
                    (DATA_EMAIL_ALLOW[where] || []).includes(m[0].toLowerCase());
    if (!allowed) leakedEmails.push(rel(f) + ': ' + m[0]);
  }
  PRIVATE_KEYS.forEach(k => {
    if (new RegExp('"' + k + '"\\s*:').test(text)) leakedKeys.push(rel(f) + ': "' + k + '"');
  });
});
check('no email address except the deliberately public ones',
      leakedEmails.length === 0,
      leakedEmails.length ? leakedEmails.join(', ') : 'only ' + PUBLIC_EMAILS.join(', '));
check('no bookkeeping or identity field',
      leakedKeys.length === 0,
      leakedKeys.length ? leakedKeys.join(', ') : PRIVATE_KEYS.join(', ') + ': none');

/* The CSV is the one non-JSON file; check its header rather than trusting the
   key scan, since a column would not look like a JSON key. */
const csv = files.find(f => f.endsWith('inventory.csv'));
if (csv) {
  const header = fs.readFileSync(csv, 'utf8').split(/\r?\n/)[0].toLowerCase();
  const badCols = ['customer', 'phone', 'email', 'remark', 'invoice', 'staff', 'user']
    .filter(c => header.indexOf(c) !== -1);
  check('inventory.csv carries no customer or staff column', badCols.length === 0,
        badCols.length ? badCols.join(', ') : header);
}

/* ------------------------------------------------- the whole repository ---
   Every address must be allowed FOR THE FILE IT IS IN. Per location, not
   global: info@wonder-herb.com belongs on a public page; a staff login belongs
   nowhere; a partner contact belongs on the contact page and not in a doc.

   Adding an entry is a decision, and the reason prints on every run. NEVER add
   an exposed or leaked address here to silence the check - remove it from the
   file instead (see the standing practice in docs/FINDINGS.md finding 22). */
console.log('\n=== nothing private anywhere in the repository (docs/FINDINGS.md finding 22) ===\n');

/* RFC 2606 / 6761 reserved names can never be a real mailbox, so they are
   allowed everywhere: test fixtures and the samples in this file use them. */
const RESERVED = /@([a-z0-9-]+\.)*(example\.(com|org|net)|[a-z0-9-]+\.(test|example|invalid|localhost))$/i;

const EMAIL_ALLOW = [
  { files: /^(?!admin\/)[^/]+\.html$|^data\//,
    emails: ['info@wonder-herb.com'],
    why: 'the business\'s own public contact address, printed on the live pages' },
  { files: /^legacy\/[^/]+\.html$/,
    emails: ['info@wonder-herb.com'],
    why: 'the same public contact address, in a retired original kept for reference (P9-T1)' },
  /* The shared chrome partial is the footer that used to be copied into all 18
     pages, so it carries the same public address those pages already print.
     Scoped to the partial directory, not widened to renderer/ generally. */
  { files: /^renderer\/chrome\/[\w-]+\.html$/,
    emails: ['info@wonder-herb.com'],
    why: 'the shared site chrome (P10), holding the public contact address every page prints' },
  /* The same three addresses, in the three places the contact page now lives:
     its retired original, its page tree, and (until it is retired) the root
     page itself. Migrating a page moves its published copy into data/, so the
     allowance follows the content rather than being widened - anything else in
     data/pages/ still fails. */
  { files: /^(聯絡我們\.html|legacy\/聯絡我們\.html|data\/pages\/contact\.json)$/,
    emails: ['wonderherbusa@gmail.com', 'jc@smartgroupinc.org', 'enquiry@provital.com.au'],
    why: 'overseas distributor contacts published on the contact page by the business' },
  { files: /^admin\/index\.html$/,
    emails: ['info@wonder-herb.com', 'you@wonder-herb.com', 'name@wonder-herb.com'],
    why: 'the contact shown in the console, and input placeholders (no such mailbox is used)' },
  { files: /^(SETUP\.md|\.env\.example|scripts\/create-admin\.js)$/,
    emails: ['you@wonder-herb.com', 'owner@wonder-herb.com'],
    why: 'documentation placeholders in setup instructions, not accounts' },
  { files: /^(docs\/FINDINGS\.md|scripts\/test-published-data\.js)$/,
    emails: ['info@wonder-herb.com', 'owner@wonder-herb.com'],
    why: 'named as examples of an allowed and a disallowed address, never as a real login' },
  { files: /^scripts\/test-sections\.js$/,
    emails: ['info@wonder-herb.com'],
    why: 'fidelity fixture copying the live contact card' },
  { files: /^package-lock\.json$/,
    emails: ['i@izs.me'],
    why: 'a third-party npm package author, published in that package\'s own metadata' }
];

/* This file has to NAME the allowed addresses, so it may contain exactly those
   and nothing else - derived from the list above, not a blanket exemption,
   which would let a leak pasted into this file pass. */
EMAIL_ALLOW.push({
  files: /^scripts\/test-published-data\.js$/,
  emails: Array.from(new Set(PUBLIC_EMAILS.concat(...EMAIL_ALLOW.map(e => e.emails)))),
  why: 'this scanner names its own allow-list; nothing beyond that list is permitted here'
});

const { execFileSync } = require('child_process');
const gitList = extra => execFileSync('git', ['-c', 'core.quotepath=off', 'ls-files', '-z'].concat(extra),
  { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString('utf8').split('\0').filter(Boolean);
const repoFiles = Array.from(new Set(gitList([]).concat(gitList(['-o', '--exclude-standard']))));

const EMAIL_ANY = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

function allowedIn(file, address) {
  if (RESERVED.test(address)) return true;
  return EMAIL_ALLOW.some(e => e.files.test(file) && e.emails.includes(address));
}

function scanRepo(files, read) {
  const found = [];
  let text = 0, binary = 0;
  files.forEach(f => {
    let buf;
    try { buf = read(f); } catch (e) { return; }         // deleted in the working tree
    if (buf.subarray(0, 8000).includes(0)) { binary++; return; }
    text++;
    (buf.toString('utf8').match(EMAIL_ANY) || []).forEach(m => {
      if (!allowedIn(f, m.toLowerCase())) found.push(f + ': ' + m);
    });
  });
  return { found: Array.from(new Set(found)), text, binary };
}

const repo = scanRepo(repoFiles, f => fs.readFileSync(path.join(ROOT, f)));
check('every file git would publish was scanned', repo.text > 0,
      repo.text + ' text file(s), ' + repo.binary + ' binary skipped (a stated limit)');
check('no email address in any file except where it is allowed for that file',
      repo.found.length === 0,
      repo.found.length ? repo.found.join(' | ') : 'clean');
EMAIL_ALLOW.forEach(e => console.log('        allowed ' + e.emails.join(', ') + ' in ' + e.files.source + ' - ' + e.why));

/* Prove the scan bites, on a throwaway string rather than by editing data/. */
/* ------------------------------------------------ legacy/ is never public ---
   P9-T1 retires a migrated page's hand-coded original to legacy/ for reference.
   The deploy still uploads the whole repository (P8-T3's allow-list is not
   applied), so legacy/ IS reachable by URL. Until that changes, a retired copy
   must be unmistakably non-public: noindex on every file, robots.txt keeping
   every crawler group out, and nothing that ships linking to it. Without this, a
   duplicate of the page - older copy, older structured data - competes with
   the real one in search results. */
console.log('\n=== legacy/ is never public (retired originals, P9-T1) ===\n');

function legacyProblems(listLegacy, readFile, rootPages) {
  const problems = [];
  listLegacy.forEach(f => {
    if (!/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(readFile(f))) problems.push(f + ' has no robots noindex');
  });
  const robots = readFile('robots.txt') || '';
  const groups = robots.split(/\r?\n(?=User-agent:)/i).filter(g => /^User-agent:/im.test(g));
  groups.forEach(g => {
    if (!/^Disallow:\s*\/legacy\/\s*$/im.test(g)) problems.push('robots.txt group "' + g.split(/\r?\n/)[0] + '" does not disallow /legacy/');
  });
  if (!groups.length) problems.push('robots.txt has no User-agent groups');
  ['sitemap.xml', 'llms.txt'].concat(rootPages).forEach(f => {
    const body = readFile(f) || '';
    if (/(href=["']|\/)legacy\//i.test(body)) problems.push(f + ' links to legacy/');
  });
  return problems;
}
{
  const legacyDir = path.join(ROOT, 'legacy');
  const legacyFiles = fs.existsSync(legacyDir)
    ? fs.readdirSync(legacyDir).filter(f => f.endsWith('.html')).map(f => 'legacy/' + f) : [];
  const rootPages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
  const readRepo = f => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { return null; } };
  const problems = legacyProblems(legacyFiles, readRepo, rootPages);
  check('every retired original carries noindex, every robots.txt group disallows /legacy/, nothing links to it',
        problems.length === 0,
        problems.length ? problems.join('; ') : legacyFiles.length + ' retired page(s): ' + legacyFiles.join(', '));

  // negative control: the same checks on a copy with the guard missing
  const fakeRead = f => f === 'legacy/x.html' ? '<head><meta charset="UTF-8"></head>'
    : f === 'robots.txt' ? 'User-agent: *\nAllow: /\nDisallow: /legacy/\n\nUser-agent: GPTBot\nAllow: /\n'
    : f === 'index.html' ? '<a href="legacy/x.html">old</a>' : '';
  const caught = legacyProblems(['legacy/x.html'], fakeRead, ['index.html']);
  check('negative control: a missing noindex, a crawler group without the rule, and a link to legacy/ are all caught',
        caught.length === 3, caught.join('; '));
}

console.log('\n=== the scan bites ===\n');
const sample = '{ "slug": "x", "updatedBy": "someone@example.org" }';
check('a staff email in a published file would be caught',
      !PUBLIC_EMAILS.includes(sample.match(EMAIL_ONE)[0].toLowerCase()));
/* The per-file allowance (DATA_EMAIL_ALLOW) must not become a blanket one. */
{
  const allowedFor = (file, addr) => PUBLIC_EMAILS.includes(addr) ||
    (DATA_EMAIL_ALLOW[file] || []).includes(addr);
  check('the distributor addresses are allowed in the contact tree',
        allowedFor('pages/contact.json', 'jc@smartgroupinc.org'), 'allowed there');
  check('...and nowhere else under data/',
        !allowedFor('products.json', 'jc@smartgroupinc.org') &&
        !allowedFor('pages/faq.json', 'jc@smartgroupinc.org'), 'caught in products.json and faq.json');
  check('...and no OTHER address is allowed in the contact tree',
        !allowedFor('pages/contact.json', 'owner@wonder-herb.com'), 'caught');
}
check('a staff address on the COMPANY domain is caught too',
      !PUBLIC_EMAILS.includes('owner@wonder-herb.com'),
      'owner@wonder-herb.com is not allowed just because of its domain');
check('an updatedBy key would be caught', /"updatedBy"\s*:/.test(sample));
check('the business contact address is allowed', PUBLIC_EMAILS.includes('info@wonder-herb.com'));

const probe = (file, body) => scanRepo([file], () => Buffer.from(body, 'utf8')).found.length;
/* Assembled at runtime so no non-reserved address is written into this file. */
const FAKE_LOGIN = ['not-a-real-staff-login', 'mailbox.co'].join('@');
check('a staff login quoted into a doc is caught (the finding-22 door)',
      probe('docs/FINDINGS.md', 'evidence: ' + FAKE_LOGIN + ' added a user') === 1);
check('a leak pasted into THIS scanner file is caught too',
      probe('scripts/test-published-data.js', '// ' + FAKE_LOGIN) === 1);
check('a partner contact is allowed on the contact page but NOT in a doc',
      probe('聯絡我們.html', 'mailto:jc@smartgroupinc.org') === 0 &&
      probe('docs/NOTES.md', 'mailto:jc@smartgroupinc.org') === 1);
check('a company-domain address outside its allowed files is caught',
      probe('scripts/some-new-script.js', 'owner@wonder-herb.com') === 1);
check('reserved example domains are allowed anywhere', probe('docs/x.md', 'mei@example.com') === 0);

console.log('\n' + (fail ? '=== ' + fail + ' CHECK(S) FAILED ===' : '=== ALL CHECKS PASSED ==='));
process.exit(fail ? 1 : 0);
