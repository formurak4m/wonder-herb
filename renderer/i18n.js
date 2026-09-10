/* Turn a per-language field object into a value for one language.
 *
 * Every editable string on the site is stored as { zh: '...', en: '...' } with
 * zh as the primary. This is the one place that decides which one is shown, so
 * the renderer and the editor agree. CommonJS so the Node renderer can require
 * it; Vite imports it happily too.
 *
 * The rules, in order:
 *
 *   array          -> resolve every item
 *   language map   -> the asked-for language, else the primary, else ''
 *   plain object   -> resolve every value (a group of fields, e.g. `seo`)
 *   anything else  -> returned untouched
 *
 * Three decisions worth stating, because they are easy to get wrong:
 *
 *   1. Empty string counts as missing. A half-translated field falls back to
 *      Chinese instead of publishing a blank, matching how .pages.yml already
 *      behaves. null and undefined are treated the same way.
 *   2. `{}` is NOT a language map. Its keys are trivially a subset of the
 *      language codes, but a section with `fields: {}` must stay `{}` rather
 *      than collapse to a value. A language map needs at least one key, and
 *      every key must be a language code.
 *   3. If the primary is missing too, the result is '' - never undefined.
 *      A missing translation should render as nothing, not as the text
 *      "undefined" on a customer-facing page.
 */
const LANGS = ['zh', 'en', 'de', 'es', 'fr', 'ja', 'ru'];
const PRIMARY = 'zh';

/* A real `{}` literal, not a Date, RegExp, class instance or array - those are
   values in their own right and must pass through untouched. */
function isPlainObject(v) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function isLangMap(v) {
  if (!isPlainObject(v)) return false;
  const keys = Object.keys(v);
  if (!keys.length) return false;                       // see decision 2
  return keys.every(k => LANGS.indexOf(k) !== -1);
}

const isEmpty = v => v === undefined || v === null || v === '';

function resolveField(value, lang, primary) {
  const p = primary === undefined ? PRIMARY : primary;
  const l = lang || p;

  if (Array.isArray(value)) return value.map(item => resolveField(item, l, p));

  if (isLangMap(value)) {
    const asked = value[l];
    if (!isEmpty(asked)) return asked;
    const fallback = value[p];
    return isEmpty(fallback) ? '' : fallback;           // see decision 3
  }

  if (isPlainObject(value)) {
    const out = {};
    Object.keys(value).forEach(k => { out[k] = resolveField(value[k], l, p); });
    return out;
  }

  return value;
}

module.exports = { resolveField, isLangMap, LANGS, PRIMARY };
