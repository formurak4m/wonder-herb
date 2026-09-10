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
 *
 * Every section here is built from markup that exists on the live pages, using
 * the live class names. See each file's header for its source page and line.
 */
import * as PageHeader from './PageHeader.jsx';
import * as Hero from './Hero.jsx';
import * as TextBlock from './TextBlock.jsx';
import * as ProductGrid from './ProductGrid.jsx';
import * as ProductDetail from './ProductDetail.jsx';
import * as Gallery from './Gallery.jsx';
import * as RelatedProducts from './RelatedProducts.jsx';
import * as ContactCards from './ContactCards.jsx';
import * as CtaBand from './CtaBand.jsx';
import * as FaqAccordion from './FaqAccordion.jsx';

export const registry = {
  'page-header': PageHeader,
  'hero': Hero,
  'text-block': TextBlock,
  'product-grid': ProductGrid,
  'product-detail': ProductDetail,
  'gallery': Gallery,
  'related-products': RelatedProducts,
  'contact-cards': ContactCards,
  'cta-band': CtaBand,
  'faq-accordion': FaqAccordion
};

/* { type: Component } — the shape the renderer wants. */
export default Object.fromEntries(
  Object.entries(registry).map(([type, mod]) => [type, mod.default])
);
