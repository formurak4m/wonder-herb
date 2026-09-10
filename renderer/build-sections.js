/* Bundle the shared section components so plain Node can require them.
 *
 *   npm run sections:build   ->   renderer/.build/sections.cjs
 *
 * The sections are JSX ES modules, written once and used twice: the Puck
 * editor imports them through Vite, and the renderer imports the bundle this
 * script produces. Same components on both sides, so the editor preview cannot
 * drift from the published page.
 *
 * `react` and `react-dom` stay external on purpose: the Node process must use
 * the one installed copy, not a second one baked into the bundle. Two React
 * instances in the same process is the classic way to get invalid-hook errors
 * and mismatched rendering.
 *
 * The output is gitignored - it is a build artifact, rebuilt on demand, and it
 * must never reach the public site.
 */
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const ENTRY = path.join(ROOT, 'sections', 'index.js');
const OUTFILE = path.join(ROOT, 'renderer', '.build', 'sections.cjs');

esbuild.build({
  entryPoints: [ENTRY],
  outfile: OUTFILE,
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  jsx: 'automatic',
  external: ['react', 'react-dom'],
  logLevel: 'info',
}).then(() => {
  const mod = require(OUTFILE);
  const types = Object.keys(mod.default || {});
  console.log('  sections bundled -> ' + path.relative(ROOT, OUTFILE).replace(/\\/g, '/'));
  console.log('  registry: ' + (types.length ? types.length + ' section(s) — ' + types.join(', ')
                                             : '0 sections (Phase 4 builds these)'));
}).catch(() => process.exit(1));
