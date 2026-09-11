/* Editing ONE language at a time, without losing the others.
 *
 * The data model stores every translatable string as { zh: '...', en: '...' }.
 * Showing seven inputs per field would bury the editor, so the editor picks one
 * content language and edits that (approach (b), agreed at P8-T1 review; the
 * Pages CMS pilot already behaves this way, and it is how a person actually
 * works - especially through a Chinese IME).
 *
 * That makes the round trip the load-bearing part of this file:
 *
 *     project(tree, lang)          tree  ->  flat values for ONE language
 *     merge(original, edited, lang) edits ->  back into the ORIGINAL tree
 *
 * `merge` walks the ORIGINAL, not the edited copy, so every language the editor
 * never saw is carried through untouched. Save in English and the Chinese in
 * the same field survives. scripts/test-editor-lang.js proves exactly that.
 *
 * ===========================================================================
 * THE TRAP THIS FILE EXISTS TO AVOID
 *
 * `resolveField` falls back to zh when a language is missing - correct for
 * RENDERING, catastrophic for EDITING. If the editor showed the zh fallback in
 * an empty English field, the editor would look fine, the user would save, and
 * the Chinese text would be written into `en` as though someone had translated
 * it. Silent, plausible-looking data corruption.
 *
 * So `project` NEVER falls back. An untranslated field shows empty, and
 * `emptyBecauseUntranslated()` lets the UI say why rather than leaving the user
 * guessing. Do not "improve" this by adding a fallback.
 * ===========================================================================
 *
 * WHICH FIELDS ARE TRANSLATABLE. Not every string is content. `variant` is a
 * layout choice, `headingId` is an anchor, `source` names a data file, and
 * hrefs, icon class names and image URLs are technical. Translating any of
 * those would break the page, so they are shared across languages and edited
 * once.
 *
 * The rule, in order:
 *   1. A `select` or `radio` field is never translatable - it holds a token.
 *   2. A key in STRUCTURAL is never translatable, whatever its field type.
 *   3. Anything else that is a string, or is already a language map, is.
 *
 * STRUCTURAL is an explicit list rather than a name-matching heuristic so it
 * can be read and argued with. The durable fix is a `translatable: false` flag
 * on the field configs in sections/, which would put the knowledge next to the
 * field it describes - but that is a change to sections/, which P8-T2 is not
 * allowed to touch. Logged as the intended follow-up.
 */
import i18n from '../renderer/i18n.js';

export const LANGS = i18n.LANGS;
export const PRIMARY = i18n.PRIMARY;
const isLangMap = i18n.isLangMap;

/* Keys that are never content, whatever they look like. Derived from the real
   field names across all ten sections - see each section's config. */
export const STRUCTURAL = new Set([
  'variant', 'headingId', 'source', 'category', 'sku', 'unit',
  'href', 'primaryHref', 'secondaryHref', 'detailHref',
  'icon', 'primaryIcon', 'secondaryIcon', 'addIcon', 'detailIcon', 'descIcon',
  'defaultIcon', 'badgeIcons',
  'videoUrl', 'image', 'images', 'src', 'flag', 'link', 'model',
  'id', 'type', 'showCarousel', 'emphasis', 'number'
]);

const isPlainObject = v =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

export function isTranslatableKey(key, field) {
  if (field && (field.type === 'select' || field.type === 'radio' ||
                field.type === 'number' || field.type === 'checkbox')) return false;
  return !STRUCTURAL.has(key);
}

/* CONTENT (data/products.json, data/faq.json) is DISPLAYED in the editor, not
 * edited there - the admin owns it. So it resolves with RENDER semantics, the
 * same resolveField the renderer uses, fallback and all: the canvas must show
 * what would publish.
 *
 * That is the opposite of `project` below, which deliberately refuses to fall
 * back because its values are about to be EDITED. Two different jobs, two
 * different rules, and mixing them up is how Chinese text gets saved as a
 * German translation. Keep them apart. */
export function resolveContent(data, lang) {
  return data ? i18n.resolveField(data, lang) : data;
}

/* ---------------------------------------------------------------- project --
 * Values for ONE language. Language maps collapse to that language's value, or
 * '' if it has none - never a fallback. Everything else passes through. */
export function project(value, lang, key, field) {
  if (Array.isArray(value)) return value.map(v => project(v, lang, key, field));

  if (isLangMap(value)) {
    if (key !== undefined && !isTranslatableKey(key, field)) {
      // shared value that happens to be stored as a map: show the primary
      const shared = value[PRIMARY];
      return shared === undefined || shared === null ? '' : shared;
    }
    const own = value[lang];
    return own === undefined || own === null ? '' : own;       // NO fallback
  }

  if (isPlainObject(value)) {
    const out = {};
    Object.keys(value).forEach(k => {
      const sub = field && field.arrayFields ? field.arrayFields[k] : undefined;
      out[k] = project(value[k], lang, k, sub);
    });
    return out;
  }

  /* A PLAIN STRING on a translatable key is primary-language content that was
     never wrapped in a language map. Editing German must show it EMPTY, not
     show the Chinese - otherwise the user saves and the Chinese is stored as
     the German translation. This is the same fallback-poisoning trap as above,
     reached by the other door, and it is why every leaf here carries its key. */
  if (typeof value === 'string' && key !== undefined &&
      isTranslatableKey(key, field) && lang !== PRIMARY) {
    return '';
  }

  return value;
}

/* True when this field has content in some other language but nothing in the
   one being edited - so the UI can say "not translated yet" instead of looking
   like the field is simply empty. */
export function emptyBecauseUntranslated(value, lang) {
  if (!isLangMap(value)) return false;
  const own = value[lang];
  if (own !== undefined && own !== null && own !== '') return false;
  return Object.keys(value).some(k => k !== lang && value[k]);
}

/* ------------------------------------------------------------------ merge --
 * Walk the ORIGINAL and fold the edited single-language values back in.
 *
 *   original is a language map  ->  { ...original, [lang]: edited }   <- the point
 *   original is a plain string  ->  lang is primary: replace it
 *                                   otherwise: become { [PRIMARY]: original,
 *                                                       [lang]: edited }
 *   original is missing         ->  primary: the value; otherwise { [lang]: v }
 *   not translatable            ->  the edited value, shared, as-is
 *
 * Arrays merge BY INDEX. Adding an item in one language adds it for all, and
 * removing one removes it for all - that is inherent to editing structure
 * rather than text, and it is the same thing that happens in the Pages CMS.
 * The translations of the items that remain are preserved.
 */
export function merge(original, edited, lang, key, field) {
  const primary = lang === PRIMARY;

  if (Array.isArray(edited)) {
    const base = Array.isArray(original) ? original : [];
    return edited.map((item, i) => {
      const sub = field && field.arrayFields ? field.arrayFields : undefined;
      return mergeItem(base[i], item, lang, sub);
    });
  }

  if (isPlainObject(edited) && !isLangMap(edited)) {
    return mergeItem(original, edited, lang, field && field.arrayFields);
  }

  // a leaf value
  if (key !== undefined && !isTranslatableKey(key, field)) return edited;

  if (isLangMap(original)) {
    return Object.assign({}, original, { [lang]: edited });    // other languages survive
  }
  if (original === undefined || original === null || original === '') {
    return primary ? edited : { [lang]: edited };
  }
  if (typeof original === 'string') {
    return primary ? edited : { [PRIMARY]: original, [lang]: edited };
  }
  return edited;
}

function mergeItem(original, edited, lang, arrayFields) {
  if (!isPlainObject(edited)) return merge(original, edited, lang);
  const base = isPlainObject(original) ? original : {};
  const out = Object.assign({}, base);
  Object.keys(edited).forEach(k => {
    const field = arrayFields ? arrayFields[k] : undefined;
    out[k] = merge(base[k], edited[k], lang, k, field);
  });
  return out;
}

/* ------------------------------------------------------------ whole trees --
 * A page tree is { slug, path, title, seo, sections: [{ id, type, fields }] }.
 * Only `title`, `seo` and each section's `fields` hold content; slug, path and
 * section types are structure and are never touched.
 *
 * ===========================================================================
 * SECTIONS ARE MATCHED BY ID, NOT BY POSITION.
 *
 * Matching by array index looks correct and passes a simple round-trip test,
 * then loses data the first time anyone reorders or deletes a section: every
 * section after the change lines up against a different original, so the
 * translations it never saw are merged in from the wrong section - or, when
 * the types differ, dropped entirely. Caught by
 * scripts/test-editor-lang.js's "delete a section" case, which failed loudly
 * on the index-based version of this function.
 *
 * So every section carries a stable `id`. Existing trees have none - they
 * predate this - so one is minted on load and written back on the first save.
 * `id` is in STRUCTURAL, so it is never translated.
 * ===========================================================================
 */
/* DETERMINISTIC on purpose. project and merge each derive the id from the same
   original tree, independently, and must arrive at the same answer - a random
   or counter-based id would make every lookup miss and every translation vanish
   (which is exactly what the first version of this did, loudly, in the test).
   Once a tree has been saved, the ids are explicit and travel with their
   section through any amount of reordering. */
export function sectionId(node, i) {
  if (node && node.id) return node.id;
  return 's' + i + '-' + (node && node.type ? node.type : 'section');
}

/* A tree whose sections all carry an explicit id. The app holds this as the
   original it merges against; the first save persists the ids. */
export function withIds(tree) {
  return Object.assign({}, tree, {
    sections: (tree.sections || []).map((node, i) =>
      Object.assign({}, node, { id: sectionId(node, i) }))
  });
}

export function projectTree(tree, lang, configs) {
  const fieldsOf = type =>
    configs && configs[type] ? { arrayFields: configs[type].fields } : undefined;
  return {
    title: project(tree.title, lang, 'title'),
    description: project(tree.seo && tree.seo.description, lang, 'description'),
    sections: (tree.sections || []).map((node, i) => ({
      type: node.type,
      props: Object.assign(
        project(node.fields || {}, lang, undefined, fieldsOf(node.type)),
        { id: sectionId(node, i) }
      )
    }))
  };
}

export function mergeTree(original, edited, lang, configs) {
  const fieldsOf = type =>
    configs && configs[type] ? { arrayFields: configs[type].fields } : undefined;

  /* the originals, addressable by the id the editor is carrying around */
  const byId = new Map();
  (original.sections || []).forEach((node, i) => {
    byId.set(sectionId(node, i), node);
  });

  const out = Object.assign({}, original);
  out.title = merge(original.title, edited.title, lang, 'title');
  out.seo = Object.assign({}, original.seo, {
    description: merge(original.seo && original.seo.description, edited.description, lang, 'description')
  });
  out.sections = (edited.sections || []).map(node => {
    const props = node.props || {};
    const id = props.id;
    const before = byId.get(id);
    // a different type at the same id is a replacement, not an edit: it must
    // not inherit the previous section's translations
    const base = before && before.type === node.type ? before.fields : undefined;
    const { id: _drop, ...fields } = props;
    return {
      id: id,
      type: node.type,
      fields: merge(base, fields, lang, undefined, fieldsOf(node.type))
    };
  });
  return out;
}
