/* The per-language field resolver. Every editable string on the site passes
 * through it, so the edge cases matter more than the happy path.
 */
const { resolveField, isLangMap, LANGS, PRIMARY } = require('../renderer/i18n');

let fail = 0;
const check = (label, cond, extra) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '   -> ' + extra : ''));
  if (!cond) fail++;
};
const show = v => JSON.stringify(v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const eq = (label, got, want) =>
  check(label + (same(got, want) ? '' : '   expected ' + show(want)), same(got, want), show(got));

console.log('\n=== the languages ===\n');

eq('seven languages, zh first', LANGS, ['zh', 'en', 'de', 'es', 'fr', 'ja', 'ru']);
eq('zh is the primary', PRIMARY, 'zh');

console.log('\n=== picking a language ===\n');

const products = { zh: '產品', en: 'Products' };
eq('asks for en, gets en', resolveField(products, 'en'), 'Products');
eq('asks for zh, gets zh', resolveField(products, 'zh'), '產品');
eq('a language not in the object falls back to zh', resolveField(products, 'ru'), '產品');
eq('no language asked for falls back to zh', resolveField(products), '產品');

console.log('\n=== missing means fall back, in every form it takes ===\n');

eq('empty string falls back to zh',
   resolveField({ zh: '產品', en: '' }, 'en'), '產品');
eq('a whitespace-only translation is a real value, not missing',
   resolveField({ zh: '產品', en: ' ' }, 'en'), ' ');
eq('null falls back to zh',
   resolveField({ zh: '產品', en: null }, 'en'), '產品');
eq('undefined falls back to zh',
   resolveField({ zh: '產品', en: undefined }, 'en'), '產品');
eq('a key that is simply absent falls back to zh',
   resolveField({ zh: '產品' }, 'en'), '產品');

console.log('\n=== when zh itself is missing ===\n');

/* Defined behaviour: the result is '' - never undefined, and never another
   language. A French page must not silently show German because someone
   translated that one first; it shows nothing, and Phase 14 reports the gap. */
eq('asked language present, zh absent -> the asked language',
   resolveField({ en: 'Products' }, 'en'), 'Products');
eq('asked language absent AND zh absent -> empty string, not undefined',
   resolveField({ en: 'Products' }, 'fr'), '');
eq('every value empty -> empty string',
   resolveField({ zh: '', en: '' }, 'en'), '');
check('the fallback is never another language',
   resolveField({ de: 'Produkte', ja: '製品' }, 'fr') === '', '""');
check('and the result is never the string "undefined"',
   String(resolveField({ en: 'x' }, 'fr')).indexOf('undefined') === -1, 'ok');

console.log('\n=== nested field groups ===\n');

const seo = {
  description: { zh: '康草堂產品系列', en: 'Wonder Herb products' },
  image: ''
};
eq('seo.description resolves, seo.image is left alone',
   resolveField(seo, 'en'), { description: 'Wonder Herb products', image: '' });
eq('the same group in zh',
   resolveField(seo, 'zh'), { description: '康草堂產品系列', image: '' });
eq('three levels deep still resolves',
   resolveField({ a: { b: { c: { zh: '深', en: 'deep' } } } }, 'en'),
   { a: { b: { c: 'deep' } } });

console.log('\n=== arrays ===\n');

const cards = [
  { title: { zh: '第一', en: 'First' }, n: 1 },
  { title: { zh: '第二', en: '' }, n: 2 }
];
eq('every card resolves, the untranslated one falls back',
   resolveField(cards, 'en'),
   [{ title: 'First', n: 1 }, { title: '第二', n: 2 }]);
eq('an array of language maps resolves item by item',
   resolveField([{ zh: '一', en: 'one' }, { zh: '二', en: 'two' }], 'en'),
   ['one', 'two']);
eq('an empty array stays an empty array', resolveField([], 'en'), []);
eq('an array of plain strings is untouched',
   resolveField(['a', 'b'], 'en'), ['a', 'b']);

console.log('\n=== things that must NOT be treated as a language map ===\n');

eq('a plain string comes back unchanged', resolveField('產品介紹', 'en'), '產品介紹');
eq('a number comes back unchanged', resolveField(3, 'en'), 3);
eq('a boolean comes back unchanged', resolveField(true, 'en'), true);
eq('null comes back unchanged', resolveField(null, 'en'), null);
eq('undefined comes back unchanged', resolveField(undefined, 'en'), undefined);

eq('{columns: 3} is settings, not languages',
   resolveField({ columns: 3 }, 'en'), { columns: 3 });
eq('a real section fields object survives intact',
   resolveField({ source: 'products.json', columns: 3, showPrices: true }, 'en'),
   { source: 'products.json', columns: 3, showPrices: true });
eq('an empty object stays an empty object, it is not an empty language map',
   resolveField({}, 'en'), {});
eq('a section with no fields keeps its shape',
   resolveField({ type: 'cta-band', id: 's3', fields: {} }, 'en'),
   { type: 'cta-band', id: 's3', fields: {} });
eq('a mixed object resolves only the language parts',
   resolveField({ heading: { zh: '標題', en: 'Heading' }, columns: 3 }, 'en'),
   { heading: 'Heading', columns: 3 });
eq('an object with one language key AND a non-language key is not a language map',
   resolveField({ zh: '值', columns: 3 }, 'en'), { zh: '值', columns: 3 });
check('a Date is a value, not a field group',
   resolveField(new Date('2026-09-10T00:00:00Z'), 'en') instanceof Date, 'still a Date');

console.log('\n=== isLangMap, directly ===\n');

check('{zh,en} is a language map', isLangMap({ zh: 'a', en: 'b' }) === true, 'true');
check('{} is not', isLangMap({}) === false, 'false');
check('{columns:3} is not', isLangMap({ columns: 3 }) === false, 'false');
check('an array is not', isLangMap(['zh']) === false, 'false');
check('null is not', isLangMap(null) === false, 'false');
check('a string is not', isLangMap('zh') === false, 'false');
check('every one of the 7 codes is accepted',
   LANGS.every(l => isLangMap({ [l]: 'x' })), 'all 7');

console.log('\n=== a whole page tree, the way the renderer will use it ===\n');

const tree = {
  slug: 'products',
  title: { zh: '產品介紹', en: 'Products' },
  seo: { description: { zh: '康草堂產品系列', en: 'Wonder Herb products' }, image: '' },
  sections: [
    { type: 'page-header', id: 's1', fields: { heading: { zh: '產品介紹', en: 'Our Products' } } },
    { type: 'product-grid', id: 's2', fields: { source: 'products.json', columns: 3, showPrices: true } },
    { type: 'cta-band', id: 's3', fields: {} }
  ]
};

const en = resolveField(tree, 'en');
eq('the tree resolves to English', en, {
  slug: 'products',
  title: 'Products',
  seo: { description: 'Wonder Herb products', image: '' },
  sections: [
    { type: 'page-header', id: 's1', fields: { heading: 'Our Products' } },
    { type: 'product-grid', id: 's2', fields: { source: 'products.json', columns: 3, showPrices: true } },
    { type: 'cta-band', id: 's3', fields: {} }
  ]
});

const ja = resolveField(tree, 'ja');
eq('an untranslated language falls the whole tree back to zh', ja.title, '產品介紹');
eq('and section text falls back too', ja.sections[0].fields.heading, '產品介紹');
eq('while settings are untouched by language', ja.sections[1].fields.columns, 3);

check('resolving does not mutate the original tree',
   tree.title.zh === '產品介紹' && typeof tree.title === 'object', 'original intact');

console.log('\n' + (fail ? '=== ' + fail + ' CHECK(S) FAILED ===' : '=== ALL CHECKS PASSED ==='));
process.exit(fail ? 1 : 0);
