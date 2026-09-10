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
 * `a` is a single string in the data, while the live page has multi-paragraph
 * answers. Blank lines in `a` are split into separate <p> elements, which
 * matches the markup without needing HTML in the field.
 *
 * `cat` (General, Usage & Dosage, Safety & Testing, Purchasing) is used to
 * filter, so one page can show a subset. Empty `category` means show all.
 */
export const config = {
  label: 'FAQ list',
  fields: {
    source: { type: 'text' },
    category: { type: 'text' }
  },
  defaultProps: { source: 'faq.json', category: '' },
  variants: ['default']
};

export default function FaqAccordion({ source, data, category }) {
  const key = String(source || 'faq.json').replace(/\.json$/, '');
  const all = (data && Array.isArray(data[key])) ? data[key] : [];
  const items = category ? all.filter(f => f && f.cat === category) : all;

  return (
    <div className="faq-list" role="list">
      {items.map(f => (
        <div className="faq-item" role="listitem" key={f.id}>
          <h3 className="faq-question"><span>{f.q}</span></h3>
          <div className="faq-answer">
            {String(f.a || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
              .map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </div>
      ))}
    </div>
  );
}
