/* npm run publish - the whole publish pipeline, in order, stopping on the
 * first failure.
 *
 *     1. export          MongoDB  ->  data/*.json and data/pages/*.json
 *     2. sections:build  sections/ ->  renderer/.build/sections.cjs
 *     3. render          page trees + data  ->  static HTML
 *     4. test:seo        THE GATE. A page that loses SEO stops the pipeline.
 *
 * ============================================================================
 * WHAT THIS COMMAND DOES NOT DO: it does not commit, it does not push, and it
 * does not deploy. There is no `git` call anywhere in this file.
 * ============================================================================
 *
 * That is deliberate and it is the project's rule, not an oversight. Publishing
 * to the live site is `git push` to main, which fires
 * .github/workflows/static.yml. Keeping that manual means a human looks at
 * `git diff` before the site changes. This command's job is to produce the
 * files and to REFUSE to hand them over if the SEO gate fails - the deploy
 * decision stays with a person.
 *
 * Consequently, ordering matters in a specific way: the gate is the LAST stage,
 * and the "here is how to deploy" instructions are printed only after it
 * passes. A failed gate exits non-zero and those instructions are never
 * reached, so the pipeline cannot end with a red gate and a green-looking
 * "now push" message.
 *
 * Each stage is a real subprocess of the same script npm would run, so there
 * is one definition of each stage rather than a copy that can drift.
 *
 * SCOPE TODAY. `render` writes to renderer/.out/, which is gitignored - it does
 * NOT write over any of the 18 hand-coded pages. P5-T2 (the full-site build)
 * and Phase 9 (page migration) are what start writing to the repo root, and
 * when they do, the write goes through writeIfChanged so an unchanged publish
 * still leaves `git status` clean.
 */
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

/* The same commands package.json's individual scripts run. Run directly with
   this Node binary rather than by shelling out to npm: one process per stage,
   no shell quoting, and identical behaviour on every platform. */
const STAGES = [
  { name: 'export',         why: 'MongoDB -> data/',
    args: ['--env-file-if-exists=.env', 'scripts/export.js'] },
  { name: 'sections:build', why: 'sections/ -> renderer/.build/sections.cjs',
    args: ['renderer/build-sections.js'] },
  { name: 'render',         why: 'page trees + data -> static HTML',
    args: ['renderer/render.js'] },
  { name: 'test:seo',       why: 'THE GATE - blocks a page that loses SEO',
    args: ['scripts/test-seo.js'] }
];

const line = ch => ch.repeat(72);

console.log('\n' + line('=') + '\npublish: ' + STAGES.map(s => s.name).join(' -> ') +
            '\n' + line('=') + '\n' +
            'This renders and gates. It does not commit, push or deploy.\n');

for (let i = 0; i < STAGES.length; i++) {
  const s = STAGES[i];
  console.log('\n' + line('-'));
  console.log('[' + (i + 1) + '/' + STAGES.length + '] ' + s.name + '   (' + s.why + ')');
  console.log(line('-'));

  const r = spawnSync(process.execPath, s.args, { cwd: ROOT, stdio: 'inherit' });

  if (r.error) {
    console.error('\n' + line('!'));
    console.error('PUBLISH STOPPED at stage ' + (i + 1) + ' (' + s.name + '): ' + r.error.message);
    console.error(line('!') + '\n');
    process.exit(1);
  }
  if (r.status !== 0) {
    console.error('\n' + line('!'));
    console.error('PUBLISH STOPPED at stage ' + (i + 1) + ' of ' + STAGES.length +
                  ': ' + s.name + ' exited ' + r.status + '.');
    if (s.name === 'test:seo') {
      console.error('');
      console.error('The SEO gate failed. NOTHING HAS BEEN DEPLOYED and nothing should be.');
      console.error('Fix the failures listed above and run `npm run publish` again.');
    } else {
      console.error('');
      console.error('Later stages did not run, so the SEO gate has NOT passed.');
      console.error('Do not commit or deploy this state.');
    }
    console.error(line('!') + '\n');
    process.exit(r.status || 1);
  }
}

/* Reached only when every stage, gate included, succeeded. */
console.log('\n' + line('=') );
console.log('publish OK - all ' + STAGES.length + ' stages passed, SEO gate included.');
console.log(line('='));
console.log('');
console.log('Nothing has been committed, pushed or deployed. That is still yours to do:');
console.log('');
console.log('    git diff                 # read what changed');
console.log('    git add -A');
console.log('    git commit -m "publish"');
console.log('    git push                 # main -> GitHub Actions -> GitHub Pages');
console.log('');
console.log('If `git diff` is empty, nothing changed and there is nothing to publish.');
console.log('');
