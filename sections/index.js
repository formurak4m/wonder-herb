/* The section registry — the single source of truth both sides import.
 *
 * The Puck editor and the Node renderer read the SAME components from here, so
 * what the client sees on the canvas is what gets published. Do not add an
 * "editor-only" variant of a section; if the two ever diverge, the preview
 * starts lying.
 *
 * Each section module (added in Phase 4) default-exports a React component and
 * named-exports a `config` describing its Puck fields:
 *
 *   import * as PageHeader from './PageHeader.jsx';
 *   export const registry = { 'page-header': PageHeader };
 *
 * Empty for now: Phase 1 only stands up the toolchain. Phase 4 fills this in.
 */

export const registry = {};

/* { type: Component } — the shape the renderer wants. */
export default Object.fromEntries(
  Object.entries(registry).map(([type, mod]) => [type, mod.default])
);
