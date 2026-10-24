/* FAQ list - the questions and answers.
 * Source: 常見問題.html:1 <div class="faq-list">, hand-coded entries.
 * Real classes: faq-list, faq-item, faq-question, faq-answer.
 *
 * Registered as `faq-accordion` because that is the type name BUILD_TASKS
 * P4-T2 fixes, but NOTE: the live block is not an accordion. There is no
 * toggle, no collapse and no aria-expanded anywhere on that page - every
 * answer is always visible. This renders what the site actually does. If the
 * client wants real collapsing later that is a behaviour change to agree, not
 * something to smuggle in behind the name.
 *
 * DATA SHAPE. `source: 'faq.json'` -> `data.faq`. The keys used are the ones
 * that exist in data/faq.json today:
 *
 *     id, cat, q, a
 *
 * `a` accepts BOTH shapes, because the data has not been migrated yet:
 *
 *   a string   - blank lines split it into <p> elements (what data/faq.json
 *                holds today)
 *   an array   - a list of blocks, each one of:
 *                  "text"                     -> <p>
 *                  { label, text, emphasis }  -> <p> with a bold lead-in
 *                  { bullets: [ ... ] }       -> <ul> of the same copy items
 *
 * The array shape is the structural answer to inline formatting (finding 14,
 * option c) and covers the two live answers that contain a <ul> and the six
 * that contain a bold lead-in. Copy items are rendered by copyBody, shared
 * with text-block so both sections treat a lead-in identically.
 *
 * `cat` (General, Usage & Dosage, Safety & Testing, Purchasing) is used to
 * filter, so one page can show a subset. Empty `category` means show all.
 */
import { copyBody } from './TextBlock.jsx';

/* One answer -> a list of blocks, whichever shape the data is in. */
function answerBlocks(a) {
  if (Array.isArray(a)) return a;
  return String(a || '').split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
}

export const config = {
  label: 'FAQ list',
  fields: {
    source: { type: 'text' },
    category: { type: 'text' },
    // every live question opens with a glyph; the page varies it per topic
    // (fa-question-circle, fa-flask, fa-leaf, fa-shield-alt, fa-chart-line).
    // data/faq.json has no icon key yet, so an entry's own `icon` wins if it
    // ever gains one, and this is the fallback.
    defaultIcon: { type: 'text' }
  },
  defaultProps: { source: 'faq.json', category: '', defaultIcon: '' },
  variants: ['default']
};

export default function FaqAccordion({ source, data, category, defaultIcon }) {
  const key = String(source || 'faq.json').replace(/\.json$/, '');
  const all = (data && Array.isArray(data[key])) ? data[key] : [];
  const items = category ? all.filter(f => f && f.cat === category) : all;

  return (
    <div className="faq-list" role="list">
      {items.map(f => (
        <div className="faq-item" role="listitem" key={f.id}>
          <h3 className="faq-question">
            {(f.icon || defaultIcon)
              ? <i className={f.icon || defaultIcon} aria-hidden="true"></i>
              : null}
            <span>{f.q}</span>
          </h3>
          <div className="faq-answer">
            {answerBlocks(f.a).map((b, i) =>
              (b && typeof b === 'object' && Array.isArray(b.bullets))
                ? <ul key={i}>{b.bullets.map((x, j) => <li key={j}>{copyBody(x)}</li>)}</ul>
                : <p key={i}>{copyBody(b)}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
