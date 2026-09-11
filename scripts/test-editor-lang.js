/* One-language-at-a-time editing, checked on the round trip that matters:
 * saving in English must not wipe the Chinese in the same field.
 *
 * This is the correctness core of P8-T2. Everything else in the editor is UI;
 * this is the part that can silently destroy the client's content, and it can
 * do it in the most dangerous way - by looking like it worked.
 *
 * Two failure modes are checked explicitly, because both produce a plausible
 * looking result rather than an error:
 *
 *   1. CLOBBER. Saving `en` writes the whole field and `zh` disappears.
 *   2. FALLBACK POISONING. The editor shows the zh fallback in an empty `en`
 *      field, the user saves, and the Chinese text is now stored AS the English
 *      translation. `project` must never fall back for this reason.
 *
 * Bundled with esbuild like the other editor test: editor/lang.js is ESM and
 * imports the CommonJS renderer/i18n.js, which is exactly how it will be loaded
 * by Vite, so this also proves that interop works.
 */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const BUILD = path.join(ROOT, 'renderer', '.build');
const OUT = path.join(BUILD, 'editor-lang.test.cjs');

let fail = 0;
const check = (label, cond, extra) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '   -> ' + extra : ''));
  if (!cond) fail++;
};

fs.mkdirSync(BUILD, { recursive: true });
esbuild.buildSync({
  entryPoints: [path.join(ROOT, 'editor', 'lang.js')], outfile: OUT,
  bundle: true, format: 'cjs', platform: 'node', target: 'node20',
  external: ['react', 'react-dom'], logLevel: 'silent'
});
delete require.cache[OUT];
const L = require(OUT);

console.log('\n=== editor/lang.js loads, and its CJS interop with renderer/i18n.js works ===\n');
check('project / merge / projectTree / mergeTree are exported',
      ['project', 'merge', 'projectTree', 'mergeTree'].every(k => typeof L[k] === 'function'));
check('it shares the renderer\'s language list, not a copy',
      L.LANGS.join(',') === 'zh,en,de,es,fr,ja,ru' && L.PRIMARY === 'zh',
      L.PRIMARY + ' + ' + (L.LANGS.length - 1) + ' others');

/* --------------------------------------------------------- the round trip - */
console.log('\n=== THE ROUND TRIP: load zh+en, edit en, save, does zh survive? ===\n');

/* A tree with real bilingual content, plus the structural fields that must not
   be translated (variant, headingId, source, href, icon). */
const TREE = {
  slug: 'products', path: '產品介紹.html',
  title: { zh: '產品介紹 | Wonder Herb', en: 'Products | Wonder Herb' },
  seo: { description: { zh: '康草堂產品系列', en: 'Wonder Herb product range' },
         jsonld: [{ '@type': 'FAQPage' }] },
  sections: [
    { type: 'page-header', fields: {
        heading: { zh: '產品系列', en: 'Our Products' },
        sub: { zh: '加拿大GMP藥廠', en: 'Canadian GMP facility' },
        variant: 'centered',
        headingId: 'products-heading'
    } },
    { type: 'text-block', fields: {
        heading: { zh: '產品介紹', en: 'About' },
        variant: 'card',
        paragraphs: [
          { label: { zh: '超強抗氧化：', en: 'Antioxidant: ' },
            text:  { zh: '比一般高出60倍', en: '60x stronger' } },
          { text: { zh: '每批雙重檢測。', en: 'Double tested.' }, emphasis: true }
        ]
    } }
  ]
};
const CONFIGS = {
  'page-header': { fields: { heading: { type: 'text' }, sub: { type: 'textarea' },
                             variant: { type: 'select' }, headingId: { type: 'text' } } },
  'text-block': { fields: { heading: { type: 'text' }, variant: { type: 'select' },
                            paragraphs: { type: 'array', arrayFields: {
                              label: { type: 'text' }, text: { type: 'textarea' },
                              emphasis: { type: 'radio' } } } } }
};
const clone = o => JSON.parse(JSON.stringify(o));
const ORIGINAL = clone(TREE);

// 1. load for English
const en = L.projectTree(TREE, 'en', CONFIGS);
check('loading in en shows the English values, not the Chinese',
      en.sections[0].props.heading === 'Our Products' &&
      en.title === 'Products | Wonder Herb',
      JSON.stringify(en.sections[0].props.heading));

// 2. edit some English
en.sections[0].props.heading = 'Product Range';
en.sections[1].props.paragraphs[0].text = '60 times stronger';
en.title = 'Product Range | Wonder Herb';

// 3. save
const saved = L.mergeTree(TREE, en, 'en', CONFIGS);

console.log('');
check('THE ENGLISH EDIT LANDED',
      saved.sections[0].fields.heading.en === 'Product Range',
      saved.sections[0].fields.heading.en);
check('AND THE CHINESE IN THE SAME FIELD SURVIVED',
      saved.sections[0].fields.heading.zh === '產品系列',
      saved.sections[0].fields.heading.zh);
check('zh survived in a nested array item too',
      saved.sections[1].fields.paragraphs[0].text.zh === '比一般高出60倍' &&
      saved.sections[1].fields.paragraphs[0].text.en === '60 times stronger',
      'zh=' + saved.sections[1].fields.paragraphs[0].text.zh +
      '  en=' + saved.sections[1].fields.paragraphs[0].text.en);
check('zh survived in the page title and the meta description',
      saved.title.zh === '產品介紹 | Wonder Herb' &&
      saved.seo.description.zh === '康草堂產品系列',
      saved.title.zh);
check('fields the editor did not touch are completely unchanged',
      JSON.stringify(saved.sections[0].fields.sub) ===
      JSON.stringify(ORIGINAL.sections[0].fields.sub),
      JSON.stringify(saved.sections[0].fields.sub));
check('the input tree was not mutated in place',
      JSON.stringify(TREE) === JSON.stringify(ORIGINAL), 'merge returns a new tree');
check('non-content keys outside title/seo/sections are carried through',
      saved.slug === 'products' && saved.path === '產品介紹.html' &&
      JSON.stringify(saved.seo.jsonld) === JSON.stringify(ORIGINAL.seo.jsonld),
      'slug, path, seo.jsonld');

/* -------------------------------------------------- structural stays shared */
console.log('\n=== structural fields are shared, never translated ===\n');

check('`variant` did not become a language map',
      saved.sections[0].fields.variant === 'centered',
      JSON.stringify(saved.sections[0].fields.variant));
check('`headingId` did not either',
      saved.sections[1] && saved.sections[0].fields.headingId === 'products-heading',
      JSON.stringify(saved.sections[0].fields.headingId));
check('`emphasis` (a radio holding a boolean) is untouched',
      saved.sections[1].fields.paragraphs[1].emphasis === true);

/* ------------------------------------------------ no fallback when editing - */
console.log('\n=== an untranslated field must show EMPTY, never the zh fallback ===\n');

const PARTIAL = { slug: 'p', path: 'p.html',
  title: { zh: '只有中文' }, seo: { description: { zh: '只有中文描述' } },
  sections: [{ type: 'page-header', fields: {
    heading: { zh: '產品系列' }, variant: 'centered' } }] };

const de = L.projectTree(PARTIAL, 'de', CONFIGS);
check('an untranslated heading projects as empty, NOT the Chinese',
      de.sections[0].props.heading === '',
      JSON.stringify(de.sections[0].props.heading) +
      '   (a fallback here would save Chinese text as the German translation)');
check('the UI can tell "untranslated" from "genuinely empty"',
      L.emptyBecauseUntranslated(PARTIAL.sections[0].fields.heading, 'de') === true &&
      L.emptyBecauseUntranslated({ zh: '' }, 'de') === false);

// saving German without touching that field must not invent a German value
const deSaved = L.mergeTree(PARTIAL, de, 'de', CONFIGS);
check('saving de with an untouched empty field does not poison it with zh',
      deSaved.sections[0].fields.heading.de === '' &&
      deSaved.sections[0].fields.heading.zh === '產品系列',
      'de=' + JSON.stringify(deSaved.sections[0].fields.heading.de) +
      '  zh=' + JSON.stringify(deSaved.sections[0].fields.heading.zh));

/* ----------------------------------------------- editing the primary itself */
console.log('\n=== editing zh behaves too ===\n');

const zh = L.projectTree(TREE, 'zh', CONFIGS);
zh.sections[0].props.heading = '全部產品';
const zhSaved = L.mergeTree(TREE, zh, 'zh', CONFIGS);
check('editing zh updates zh', zhSaved.sections[0].fields.heading.zh === '全部產品');
check('and leaves en alone', zhSaved.sections[0].fields.heading.en === 'Our Products');

/* a plain string (not yet a language map) becomes one when a translation
   is added, without losing the original */
const plain = { slug: 'x', path: 'x.html', title: 'Plain title', seo: {},
                sections: [{ type: 'page-header', fields: { heading: '只有一個字串' } }] };
const pEn = L.projectTree(plain, 'en', CONFIGS);
check('a plain string shows as empty when editing a non-primary language',
      pEn.sections[0].props.heading === '',
      'it is zh content stored without a wrapper, so en has nothing');
pEn.sections[0].props.heading = 'English heading';
const pSaved = L.mergeTree(plain, pEn, 'en', CONFIGS);
check('saving it promotes the plain string to a language map, keeping the original as zh',
      pSaved.sections[0].fields.heading.zh === '只有一個字串' &&
      pSaved.sections[0].fields.heading.en === 'English heading',
      JSON.stringify(pSaved.sections[0].fields.heading));

/* ------------------------------------------- structure edits in any language */
console.log('\n=== structural edits (add / remove / reorder) ===\n');

const en2 = L.projectTree(TREE, 'en', CONFIGS);
en2.sections.push({ type: 'cta-band', props: { heading: 'Talk to us', variant: 'banner' } });
const added = L.mergeTree(TREE, en2, 'en', CONFIGS);
check('a section added while editing en is stored with en set',
      added.sections.length === 3 && added.sections[2].fields.heading.en === 'Talk to us',
      JSON.stringify(added.sections[2].fields.heading));
check('and the existing sections keep every language',
      added.sections[0].fields.heading.zh === '產品系列' &&
      added.sections[0].fields.heading.en === 'Our Products');

const en3 = L.projectTree(TREE, 'en', CONFIGS);
en3.sections.splice(0, 1);                       // delete the first section
const removed = L.mergeTree(TREE, en3, 'en', CONFIGS);
check('deleting a section deletes it for all languages (structure is shared)',
      removed.sections.length === 1 && removed.sections[0].type === 'text-block',
      'documented behaviour, same as the Pages CMS');
check('the surviving section keeps all of its translations',
      removed.sections[0].fields.heading.zh === '產品介紹' &&
      removed.sections[0].fields.heading.en === 'About');

/* REORDER - the case index matching corrupts silently. Before sections had
   ids, this test failed: the surviving sections lined up against the wrong
   originals and their translations were merged in from a different section. */
const en5 = L.projectTree(TREE, 'en', CONFIGS);
en5.sections.reverse();
const reordered = L.mergeTree(TREE, en5, 'en', CONFIGS);
check("reordering sections keeps each section's own translations",
      reordered.sections[0].type === 'text-block' &&
      reordered.sections[0].fields.heading.zh === TREE.sections[1].fields.heading.zh &&
      reordered.sections[1].type === 'page-header' &&
      reordered.sections[1].fields.heading.zh === TREE.sections[0].fields.heading.zh,
      'matched by id, not by position');

check('every section carries a stable id after a save',
      saved.sections.every(x => typeof x.id === 'string' && x.id.length > 0),
      saved.sections.map(x => x.id).join(', '));

check('projectTree and mergeTree derive the SAME id for a section without one',
      L.projectTree(TREE, 'en', CONFIGS).sections[0].props.id === L.withIds(TREE).sections[0].id,
      L.withIds(TREE).sections[0].id + '   (a random id here would lose every translation)');

/* a type change at the same id must not merge one section's text into another */
const en4 = L.projectTree(TREE, 'en', CONFIGS);
en4.sections[0] = { type: 'cta-band', props: { heading: 'Replaced', id: en4.sections[0].props.id } };
const swapped = L.mergeTree(TREE, en4, 'en', CONFIGS);
check('replacing a section with a different type does not inherit the old one\'s translations',
      swapped.sections[0].type === 'cta-band' &&
      swapped.sections[0].fields.heading.zh === undefined,
      JSON.stringify(swapped.sections[0].fields.heading));

console.log('\n' + (fail ? '=== ' + fail + ' CHECK(S) FAILED ===' : '=== ALL CHECKS PASSED ==='));
process.exit(fail ? 1 : 0);
