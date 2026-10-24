/* The Puck configuration, DERIVED from sections/index.js. Not a parallel list.
 *
 * The whole point: `registry` is the single source of truth, and this file is a
 * transformation of it. Add a section to sections/index.js and it appears in
 * the Puck left panel with its real fields - no second edit here, nothing to
 * forget, no way for the editor's idea of a section to drift from the
 * renderer's. There is deliberately NO hand-written component map below; if you
 * find yourself adding one, that is the bug.
 *
 * The mapping is one entry per registry entry:
 *
 *   registry[type].config.label         ->  Puck `label`
 *   registry[type].config.fields        ->  Puck `fields`
 *   registry[type].config.defaultProps  ->  Puck `defaultProps`
 *   registry[type].default              ->  Puck `render`   (the SAME function
 *                                           object the renderer calls, not a
 *                                           copy - scripts/test-editor-config.js
 *                                           asserts identity with ===)
 *
 * EDITOR-ONLY. Nothing in this file is imported by renderer/ or by any of the
 * 18 static pages, and none of it reaches published output. Puck's canvas
 * attributes (`data-puck-*`, `data-rfd-*`) exist only inside the editor app,
 * because the renderer calls the components directly and never goes through
 * Puck - which is what scripts/test-render.js check (e) asserts on the
 * published HTML. CLAUDE.md non-negotiable 4.
 *
 * ---------------------------------------------------------------------------
 * TWO THINGS THAT ARE DELIBERATELY NOT DECIDED HERE - both belong to P8-T2,
 * when there is an app to test them in.
 *
 * 1. PER-LANGUAGE FIELDS. The data model is `{ zh: '...', en: '...' }` per text
 *    field, but a section's `config.fields` declares a plain `text` /
 *    `textarea`. So Puck currently edits the value directly rather than one
 *    language of it. That degrades safely - `resolveField` passes a plain
 *    string straight through, so a tree edited this way still renders - but it
 *    cannot hold a translation. P8-T2 adds the language picker and decides
 *    whether the wrapping happens here (fields become per-language objects) or
 *    at load/save in the app (edit one language at a time, merge on save).
 *    The second is likely better for a Chinese IME, but that is a decision with
 *    a UI attached, not a config detail.
 *
 * 2. OUR OWN METADATA IS NOT A PUCK FIELD. `variants` and `emptyWithoutContent`
 *    are this project's contract (see scripts/test-sections.js), not something
 *    Puck understands. They are passed through Puck's `metadata` so they stay
 *    available to the editor UI, and are NOT poured into `fields` where they
 *    would render as bogus inputs. Sections that have a real variant choice
 *    already expose it as a normal `select` field (page-header, text-block).
 * ---------------------------------------------------------------------------
 */
import { registry } from '../sections/index.js';

/* Page-level fields. The tree stores these as `tree.title` and
   `tree.seo.description`; mapping root props to that shape happens at load/save
   in P8-T2, so the names here are flat on purpose. */
export const rootConfig = {
  fields: {
    title: { type: 'text' },
    description: { type: 'textarea' }
  },
  defaultProps: { title: '', description: '' }
};

/* One Puck component config from one registry entry.
 *
 * `data` and `lang` are the two props the renderer passes to every section and
 * that no field provides: the data-backed sections (product-grid,
 * product-detail, related-products, faq-accordion) read their list out of
 * `data`. They are injected through `defaultProps` rather than by wrapping
 * `render`, and that is not a style choice:
 *
 *   - Puck merges `{ ...config.defaultProps, ...item.props }` at render time,
 *     so this reaches components loaded from a SAVED tree too, not only
 *     newly dropped ones.
 *   - Wrapping `render` in a closure would make it a different function from
 *     the one the renderer uses, which is exactly the drift this project is
 *     built to prevent - and it would break the identity assertion in
 *     scripts/test-editor-config.js.
 *
 * `data` is never a field, so a saved item never carries its own `data` prop
 * to shadow this. */
function componentFrom(mod, { data, lang }) {
  const c = mod.config;
  return {
    label: c.label,
    fields: c.fields,
    defaultProps: Object.assign({}, c.defaultProps, { data, lang }),
    render: mod.default,
    // this project's contract, carried but not shown as fields - see note 2
    metadata: { variants: c.variants, emptyWithoutContent: !!c.emptyWithoutContent }
  };
}

/* Build the config for one editing context.
 *
 *   buildConfig({ data, lang })
 *
 * `data` is the content bundle keyed by file stem ({ products, faq, cases,
 * homepage }), the same shape renderer/render.js `loadData()` produces and the
 * same shape a section's `source: 'products.json'` resolves against. P8-T2
 * fetches it from the API and passes it here. */
export function buildConfig({ data, lang } = {}) {
  return {
    root: rootConfig,
    components: Object.fromEntries(
      Object.entries(registry).map(([type, mod]) => [type, componentFrom(mod, { data, lang })])
    )
  };
}

/* The default context: no content data, primary language. Useful for tests and
   for rendering the panel before any content has loaded - the data-backed
   sections render an empty list rather than throwing, which is the same thing
   they do in the renderer when a data file is missing. */
export const config = buildConfig({ data: {}, lang: 'zh' });

export default config;
