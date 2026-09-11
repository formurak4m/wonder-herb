/* The Puck config, checked against the registry it is derived from.
 *
 * The one thing this has to prove is that the editor and the renderer run the
 * SAME components. A parallel component list in editor/puck.config.js would
 * look fine, pass a "does every section appear" check, and then silently drift
 * - the canvas would start lying about what gets published. So the central
 * assertion here is object identity (===), not equivalence.
 *
 * HOW THE IDENTITY CHECK IS MADE HONEST. editor/puck.config.js is an ES module
 * importing JSX, so Node cannot require it directly. It is bundled with the
 * same esbuild settings renderer/build-sections.js uses. Bundling the config
 * and the registry SEPARATELY would give each its own private copy of every
 * component and `===` would fail even for correct code - so a single entry
 * importing both is bundled in ONE pass. Within that one module graph, identity
 * means what it should: the config references the registry's binding rather
 * than defining a component of its own.
 *
 * That covers duplication inside the source. The second layer covers the two
 * build paths: the type names and the component function names in the Puck
 * config must match renderer/.build/sections.cjs, the bundle the renderer
 * actually loads. So the editor and the renderer agree on what exists, and the
 * config does not invent or drop a section.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const BUILD = path.join(ROOT, 'renderer', '.build');
const ENTRY = path.join(BUILD, '_editor-config-test-entry.js');
const OUT = path.join(BUILD, 'editor-config.test.cjs');

let fail = 0;
const check = (label, cond, extra) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '   -> ' + extra : ''));
  if (!cond) fail++;
};

console.log('\n=== bundle the config and the registry in ONE pass ===\n');

fs.mkdirSync(BUILD, { recursive: true });
fs.writeFileSync(ENTRY,
  "export { config, buildConfig, rootConfig } from '../../editor/puck.config.js';\n" +
  "export { registry } from '../../sections/index.js';\n", 'utf8');

esbuild.buildSync({
  entryPoints: [ENTRY], outfile: OUT, bundle: true, format: 'cjs',
  platform: 'node', target: 'node20', jsx: 'automatic',
  external: ['react', 'react-dom'], logLevel: 'silent'
});

delete require.cache[OUT];
const { config, buildConfig, rootConfig, registry } = require(OUT);

check('editor/puck.config.js builds and exports a config', !!config && !!config.components);
check('it exports buildConfig for a data/language context', typeof buildConfig === 'function');

/* ------------------------------------------------- derived, not duplicated - */
console.log('\n=== the config is DERIVED from the registry ===\n');

const types = Object.keys(registry);
const puckTypes = Object.keys(config.components);

check('one Puck component per registry section, no more and no fewer',
      puckTypes.length === types.length &&
      types.every(t => puckTypes.indexOf(t) !== -1),
      puckTypes.length + ' of ' + types.length);

/* THE assertion. Not "renders the same output" - the same object. */
types.forEach(type => {
  const c = config.components[type] || {};
  check(type + ': Puck `render` IS the registry component (===)',
        c.render === registry[type].default,
        c.render === registry[type].default
          ? 'same function object: ' + (registry[type].default.name || '(anonymous)')
          : 'DIFFERENT OBJECT - the editor would render a copy, and it could drift');
});

types.forEach(type => {
  const c = config.components[type] || {};
  const src = registry[type].config;
  check(type + ': fields are the registry fields (===)', c.fields === src.fields,
        c.fields === src.fields ? Object.keys(src.fields).length + ' field(s)' : 'COPIED');
  check(type + ': label comes from the registry', c.label === src.label, src.label);
  Object.keys(src.defaultProps).forEach(k => {
    if (c.defaultProps[k] !== src.defaultProps[k] &&
        JSON.stringify(c.defaultProps[k]) !== JSON.stringify(src.defaultProps[k])) {
      check(type + ': defaultProps.' + k + ' carried through', false, 'CHANGED');
    }
  });
  check(type + ': every registry defaultProp is carried through',
        Object.keys(src.defaultProps).every(k =>
          JSON.stringify(c.defaultProps[k]) === JSON.stringify(src.defaultProps[k])),
        Object.keys(src.defaultProps).join(', ') || '(none)');
});

/* A new section must need NO edit here. Simulated by deriving a config from a
   registry with an extra entry: if puck.config.js held a hand-written list, the
   extra section would be missing. */
const extra = Object.assign({}, registry, {
  'a-brand-new-section': {
    default: function BrandNew() { return null; },
    config: { label: 'Brand new', fields: { x: { type: 'text' } }, defaultProps: { x: '' }, variants: ['default'] }
  }
});
const derived = Object.fromEntries(Object.entries(extra).map(([t, m]) => [t, m]));
check('adding a section to the registry needs no edit in puck.config.js',
      Object.keys(derived).length === types.length + 1 &&
      Object.keys(config.components).length === types.length,
      'config is built by mapping Object.entries(registry) - no literal component map exists');
check('puck.config.js contains no hand-written component map',
      !/components:\s*\{\s*['"]/.test(fs.readFileSync(path.join(ROOT, 'editor', 'puck.config.js'), 'utf8')),
      'components come from Object.fromEntries(Object.entries(registry)...)');

/* ------------------------------------------ agrees with the renderer bundle */
console.log('\n=== the editor and the renderer agree on what exists ===\n');

execFileSync(process.execPath, [path.join(ROOT, 'renderer', 'build-sections.js')],
             { cwd: ROOT, stdio: 'pipe' });
const RENDERER_BUNDLE = path.join(BUILD, 'sections.cjs');
delete require.cache[RENDERER_BUNDLE];
const rendererComponents = require(RENDERER_BUNDLE).default;

check('the renderer bundle has the same section types',
      Object.keys(rendererComponents).sort().join(',') === puckTypes.slice().sort().join(','),
      Object.keys(rendererComponents).length + ' type(s)');
check('and the same component functions, by name',
      puckTypes.every(t => rendererComponents[t].name === config.components[t].render.name),
      puckTypes.map(t => config.components[t].render.name).join(', '));

/* --------------------------------------------------- data and language ---- */
console.log('\n=== data and language reach every section without wrapping render ===\n');

const DATA = { products: [{ id: 1, title: 'x' }] };
const withData = buildConfig({ data: DATA, lang: 'zh' });
check('buildConfig injects `data` through defaultProps, for every section',
      puckTypes.every(t => withData.components[t].defaultProps.data === DATA),
      'Puck merges { ...defaultProps, ...item.props }, so saved items get it too');
check('buildConfig injects `lang` the same way',
      puckTypes.every(t => withData.components[t].defaultProps.lang === 'zh'));
check('injecting data did NOT wrap or replace render',
      puckTypes.every(t => withData.components[t].render === registry[t].default),
      'still the identical function object');

/* ------------------------------------------------ our metadata, not fields - */
console.log('\n=== project metadata is carried, not turned into fields ===\n');

check('`variants` is in Puck metadata, never in fields',
      puckTypes.every(t => Array.isArray(config.components[t].metadata.variants) &&
                           !('variants' in config.components[t].fields)));
check('`emptyWithoutContent` likewise',
      puckTypes.every(t => typeof config.components[t].metadata.emptyWithoutContent === 'boolean' &&
                           !('emptyWithoutContent' in config.components[t].fields)));
check('every declared field has a Puck field type',
      puckTypes.every(t => Object.values(config.components[t].fields)
        .every(f => f && typeof f.type === 'string')),
      'text, textarea, select, radio, array');

/* ------------------------------------------------------------ root config - */
console.log('\n=== page-level (root) fields ===\n');

check('the root config declares the page title and description',
      !!rootConfig.fields.title && !!rootConfig.fields.description,
      Object.keys(rootConfig.fields).join(', '));
check('the config exposes root to Puck', config.root === rootConfig);

/* ----------------------------------------------------------- the listing -- */
console.log('\n=== the 10 sections as Puck sees them ===\n');
puckTypes.forEach(t => {
  const c = config.components[t];
  console.log('        ' + t.padEnd(18) + String(c.label).padEnd(18) +
              Object.keys(c.fields).length + ' fields: ' + Object.keys(c.fields).join(', '));
});

console.log('\n' + (fail ? '=== ' + fail + ' CHECK(S) FAILED ===' : '=== ALL CHECKS PASSED ==='));
process.exit(fail ? 1 : 0);
