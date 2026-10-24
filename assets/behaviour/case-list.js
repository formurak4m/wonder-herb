/* case-list behaviour: filter, search, reset, count, and read more.
 *
 * Loaded by renderer/template.js for a page whose tree has a `case-list`
 * section (BEHAVIOURS). Static file, no framework, no build step - the same
 * shape as quick-view.js.
 *
 * WHAT IS DIFFERENT FROM THE OLD PAGE. 典型病例.html built all fifteen cards in
 * the browser from an inline array, so a crawler saw an empty shell and a
 * visitor with JavaScript off saw nothing at all. Here the cards, the chips
 * and the count are already in the HTML; this file only hides and shows what
 * is there. That is the whole point of pre-rendering, and it is why the
 * scripts-off rules can leave a readable page: every case's full text is in
 * the document.
 *
 * Refusals and messages: none. Nothing here can fail in a way a visitor needs
 * told about - the worst case is the list not filtering, which the scripts-off
 * rules already handle by hiding the panel.
 */
(function () {
  'use strict';

  var panel = document.querySelector('.filter-panel');
  var grid = document.querySelector('.cases-grid');
  if (!grid) return;

  var cards = Array.prototype.slice.call(grid.querySelectorAll('.case-card'));
  var search = document.getElementById('caseSearch');
  var reset = document.getElementById('caseReset');
  var count = document.getElementById('caseCount');
  var chips = panel ? Array.prototype.slice.call(panel.querySelectorAll('.filter-chip')) : [];

  var disease = '';
  var term = '';

  /* The count's own text says how it is built: prefix + number + suffix, as
     rendered. Reading them back beats duplicating the wording here. */
  var prefix = '', suffix = '';
  if (count) {
    var parts = count.textContent.split(String(cards.length));
    prefix = parts[0] || '';
    suffix = parts.length > 1 ? parts[parts.length - 1] : '';
  }

  var empty = null;
  function emptyMessage(show) {
    var text = grid.getAttribute('data-empty-text');
    if (!text) return;
    if (show && !empty) {
      empty = document.createElement('p');
      empty.className = 'cases-empty';
      empty.setAttribute('role', 'status');
      empty.textContent = text;
      grid.appendChild(empty);
    } else if (!show && empty) {
      empty.parentNode.removeChild(empty);
      empty = null;
    }
  }

  function matches(card) {
    if (disease && card.getAttribute('data-disease') !== disease) return false;
    if (!term) return true;
    return card.textContent.toLowerCase().indexOf(term) !== -1;
  }

  function apply() {
    var shown = 0;
    cards.forEach(function (card) {
      var ok = matches(card);
      card.hidden = !ok;
      if (ok) shown++;
    });
    if (count) count.textContent = prefix + shown + suffix;
    emptyMessage(shown === 0);
  }

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      disease = chip.getAttribute('data-disease') || '';
      chips.forEach(function (c) {
        var on = c === chip;
        c.classList.toggle('active', on);
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      apply();
    });
  });

  if (search) {
    search.addEventListener('input', function () {
      term = search.value.trim().toLowerCase();
      apply();
    });
  }

  if (reset) {
    reset.addEventListener('click', function () {
      term = '';
      disease = '';
      if (search) search.value = '';
      chips.forEach(function (c, i) {
        c.classList.toggle('active', i === 0);
        c.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
      });
      apply();
    });
  }

  /* Read more: the full text is in the document either way, so this toggles
     .expanded exactly as the old page did, and swaps the button's label
     between the two the section rendered into data-more / data-less. */
  grid.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.read-more-btn') : null;
    if (!btn || !grid.contains(btn)) return;
    var full = document.getElementById(btn.getAttribute('data-target'));
    var open = btn.classList.toggle('expanded');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (full) full.classList.toggle('expanded', open);
    var label = btn.querySelector('.read-more-text');
    var more = btn.getAttribute('data-more'), less = btn.getAttribute('data-less');
    if (label && more && less) label.textContent = open ? less : more;
  });
})();
