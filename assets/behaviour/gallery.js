/* assets/behaviour/gallery.js - the product gallery's thumbnails.
 *
 * Loaded only on pages whose tree contains a gallery section
 * (renderer/template.js BEHAVIOURS).
 *
 * The live product pages bind the same thing: clicking a thumbnail swaps the
 * main image and moves the `active` class. Without this the thumbnails
 * publish dead - they still SHOW the other angles, but clicking one does
 * nothing, and nothing throws to say so (finding 23).
 *
 * The source of each image is the thumbnail's own `data-img`, already in the
 * pre-rendered markup, so there is no image list here to drift from the page.
 * The alt text comes from the thumbnail's own <img>, so the main image
 * describes what is actually shown.
 *
 * Scripts off, the thumbnails are left visible on purpose: they are images in
 * a list, not controls, and the live pages leave them too. Nothing here is a
 * button, so the scripts-off rule has nothing to hide.
 */
(function () {
  'use strict';

  var gallery = document.querySelector('.product-gallery');
  if (!gallery) return;
  var main = gallery.querySelector('#mainProductImage, .main-image img');
  var thumbs = gallery.querySelectorAll('.thumbnail[data-img]');
  if (!main || !thumbs.length) return;

  gallery.addEventListener('click', function (e) {
    var thumb = e.target.closest ? e.target.closest('.thumbnail[data-img]') : null;
    if (!thumb || !gallery.contains(thumb)) return;
    var src = thumb.getAttribute('data-img');
    if (!src) return;
    var img = thumb.querySelector('img');
    main.setAttribute('src', src);
    if (img && img.getAttribute('alt')) main.setAttribute('alt', img.getAttribute('alt'));
    for (var i = 0; i < thumbs.length; i++) thumbs[i].classList.toggle('active', thumbs[i] === thumb);
  });
})();
