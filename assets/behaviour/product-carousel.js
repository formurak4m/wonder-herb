/* The homepage's 皇牌產品系列 carousel: the two arrows that rotate the three
 * visible cards. Ported from index.html's renderProductTriple() (:3524) and
 * the two click handlers at :3356 when the homepage became a tree at P9.
 *
 * WHAT CHANGED. The live page rendered ALL THREE cards from JavaScript on
 * load, so the homepage's product block was empty HTML - nothing for a crawler,
 * nothing with scripts off. The three cards are pre-rendered now
 * (sections/ProductCarousel.jsx). This file only re-fills them when an arrow is
 * pressed, so the content no longer depends on it.
 *
 * WHERE THE SIX PRODUCTS COME FROM. The cards on screen are three of six, and
 * rotating needs the other three. Re-fetching data/products.json in the
 * browser would reinstate the client-side fetch this project exists to remove,
 * so the section emits the list once as inert
 * <script type="application/json" id="productCarouselItems"> and this reads it
 * from the DOM. If the island is missing, the arrows do nothing and the three
 * rendered cards stay - degraded, never broken.
 *
 * The labels ("瞭解更多", the icon) are read off the card the renderer already
 * produced rather than repeated here, so this file holds no copy: the client
 * edits the label in Puck and the arrows keep using it.
 */
(function () {
  'use strict';

  function text(el) { return el ? el.textContent : ''; }

  function init() {
    var layout = document.getElementById('tripleProductLayout');
    var island = document.getElementById('productCarouselItems');
    var prev = document.getElementById('productPrevManual');
    var next = document.getElementById('productNextManual');
    if (!layout || !island || !prev || !next) return;

    var items;
    try { items = JSON.parse(island.textContent || '[]'); } catch (e) { return; }
    if (!Array.isArray(items) || items.length < 2) return;

    var featured = document.getElementById('featuredCard');
    var left = document.getElementById('leftSideCard');
    var right = document.getElementById('rightSideCard');
    if (!featured || !left || !right) return;

    /* the detail link's wording and icon, as rendered - not repeated here */
    var link = featured.querySelector('.btn-detail-main');
    var linkLabel = link ? text(link).trim() : '';
    var linkIcon = link && link.querySelector('i') ? link.querySelector('i').className : '';
    /* the live side cards cut at 70 characters; the section renders the same */
    var SIDE_CUT = 70;
    var idx = 0;

    function img(p) {
      var wrap = document.createElement('div');
      wrap.className = 'product-img';
      var el = document.createElement('img');
      el.src = p.img || '';
      el.alt = p.title || '';
      el.loading = 'lazy';
      wrap.appendChild(el);
      return wrap;
    }

    function fillSide(card, p) {
      card.textContent = '';
      card.appendChild(img(p));
      var h = document.createElement('h4');
      h.textContent = p.title || '';
      card.appendChild(h);
      var d = document.createElement('div');
      d.className = 'side-desc';
      var desc = String(p.desc || '');
      d.textContent = desc.length > SIDE_CUT ? desc.substring(0, SIDE_CUT) + '…' : desc;
      card.appendChild(d);
    }

    function fillFeatured(p) {
      featured.textContent = '';
      featured.appendChild(img(p));
      var h = document.createElement('h3');
      h.textContent = p.title || '';
      featured.appendChild(h);
      var d = document.createElement('div');
      d.className = 'product-description';
      d.textContent = p.desc || '';
      featured.appendChild(d);
      if (linkLabel) {
        var a = document.createElement('a');
        a.className = 'btn-detail-main';
        a.href = p.link || '#';
        a.textContent = linkLabel + ' ';
        if (linkIcon) {
          var i = document.createElement('i');
          i.className = linkIcon;
          i.setAttribute('aria-hidden', 'true');
          a.appendChild(i);
        }
        featured.appendChild(a);
      }
    }

    function render() {
      var n = items.length;
      fillFeatured(items[idx]);
      fillSide(left, items[(idx - 1 + n) % n]);
      fillSide(right, items[(idx + 1) % n]);
    }

    prev.addEventListener('click', function () { idx = (idx - 1 + items.length) % items.length; render(); });
    next.addEventListener('click', function () { idx = (idx + 1) % items.length; render(); });
  }

  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);
})();
