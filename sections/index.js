/* The section registry — the single source of truth both sides import.
 *
 * The Puck editor and the Node renderer read the SAME components from here, so
 * what the client sees on the canvas is what gets published. Do not add an
 * "editor-only" variant of a section; if the two ever diverge, the preview
 * starts lying.
 *
 * Each section module default-exports a React component and named-exports a
 * `config` describing its Puck fields. Two shapes come out of this file:
 *
 *   registry  { type: wholeModule }   - the editor wants config AND component
 *   default   { type: Component }     - the renderer only wants the component
 */
import * as PageHeader from './PageHeader.jsx';

export const registry = {
  'page-header': PageHeader
};

/* { type: Component } — the shape the renderer wants. */
export default Object.fromEntries(
  Object.entries(registry).map(([type, mod]) => [type, mod.default])
);
