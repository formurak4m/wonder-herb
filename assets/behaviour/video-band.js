/* The 真實康復見證 band: its background video and the glass card's hover
 * physics. Lifted from index.html's inline script (initCaseStudiesVideo at
 * :4260 and the case-studies jelly system at :4273) when the homepage became a
 * tree at P9. The code is the live code; only the wiring changed.
 *
 * The video is CONTENT, not behaviour: the <video> and its <source> are in the
 * HTML (sections/CtaBand.jsx, the video-band variant), so with scripts off the
 * browser still plays it. What this file adds is what the live page added -
 * respecting prefers-reduced-motion, and pausing the video when the band is
 * scrolled out of view rather than decoding it for nothing.
 *
 * The video URL is not named here. It is a tree field, which is what makes the
 * Phase 10 move off the client's Wix CDN a data edit (finding 1: that CDN dies
 * at cutover).
 */
(function () {
  'use strict';

  /* ---- the background video (index.html:4260), verbatim ---- */
  function initCaseStudiesVideo() {
      const video = document.querySelector('.case-studies-section-video');
      if (!video || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const play = () => { video.play().catch(() => {}); };
      play();
      const section = video.closest('.case-studies-section');
      if (!section || !('IntersectionObserver' in window)) return;
      const obs = new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting) play();
              else video.pause(); }); }, { threshold: 0.15 });
      obs.observe(section);
  }
  /* ---- the card's hover physics (index.html:4273-4489), verbatim ---- */
  const CS_MAX_SCALE = 1.025;
  const CS_HOVER_TRANSLATE_Y = -4;
  const CS_MAX_INNER_PARALLAX = 4;
  const CS_BASE_BORDER_RADIUS = 48;
  const CS_MAX_BORDER_DELTA = 6;
  const CS_JELLY_STIFFNESS = 0.1;
  const CS_JELLY_DAMPING = 0.78;

  let csJellyEl = null;
  let csJellyTargetScale = 1.0,
      csJellyCurrentScale = 1.0,
      csJellyVelocityScale = 0;
  let csJellyTargetTranslateY = 0,
      csJellyCurrentTranslateY = 0,
      csJellyVelocityTranslateY = 0;
  let csJellyTargetInnerX = 0,
      csJellyCurrentInnerX = 0,
      csJellyVelocityInnerX = 0;
  let csJellyTargetInnerY = 0,
      csJellyCurrentInnerY = 0,
      csJellyVelocityInnerY = 0;
  let csBrTargetTL = CS_BASE_BORDER_RADIUS,
      csBrCurrentTL = CS_BASE_BORDER_RADIUS,
      csBrVelocityTL = 0;
  let csBrTargetTR = CS_BASE_BORDER_RADIUS,
      csBrCurrentTR = CS_BASE_BORDER_RADIUS,
      csBrVelocityTR = 0;
  let csBrTargetBR = CS_BASE_BORDER_RADIUS,
      csBrCurrentBR = CS_BASE_BORDER_RADIUS,
      csBrVelocityBR = 0;
  let csBrTargetBL = CS_BASE_BORDER_RADIUS,
      csBrCurrentBL = CS_BASE_BORDER_RADIUS,
      csBrVelocityBL = 0;
  let csJellyRafId = null;
  let csIsMouseOn = false;
  let csIsTouchActive = false;
  let csJellyIsFinePointer = true;
  let csThicknessLayer = null;
  let csHeadingEl = null;
  let csDescEl = null;
  let csButtonsEl = null;

  function applyCsJellyTransform() {
      if (!csJellyEl) return;
      csJellyEl.style.transform = `scale(${csJellyCurrentScale}) translateY(${csJellyCurrentTranslateY}px)`;
      csJellyEl.style.borderRadius = `${csBrCurrentTL}px ${csBrCurrentTR}px ${csBrCurrentBR}px ${csBrCurrentBL}px`;
      if (csThicknessLayer) {
          csThicknessLayer.style.transform = `translate(${csJellyCurrentInnerX}px, ${csJellyCurrentInnerY}px)`;
      }
      if (csHeadingEl) {
          csHeadingEl.style.transform = `translate(${csJellyCurrentInnerX * 0.35}px, ${csJellyCurrentInnerY * 0.35}px)`;
      }
      if (csDescEl) {
          csDescEl.style.transform = `translate(${csJellyCurrentInnerX * 0.25}px, ${csJellyCurrentInnerY * 0.25}px)`;
      }
      if (csButtonsEl) {
          csButtonsEl.style.transform = `translate(${csJellyCurrentInnerX * 0.15}px, ${csJellyCurrentInnerY * 0.15}px)`;
      }
  }

  function csJellyAnimationLoop() {
      const stiffness = CS_JELLY_STIFFNESS;
      const damping = CS_JELLY_DAMPING;
      const forceS = (csJellyTargetScale - csJellyCurrentScale) * stiffness;
      csJellyVelocityScale += forceS;
      csJellyVelocityScale *= damping;
      csJellyCurrentScale += csJellyVelocityScale;
      const forceTY = (csJellyTargetTranslateY - csJellyCurrentTranslateY) * stiffness;
      csJellyVelocityTranslateY += forceTY;
      csJellyVelocityTranslateY *= damping;
      csJellyCurrentTranslateY += csJellyVelocityTranslateY;
      const forceIX = (csJellyTargetInnerX - csJellyCurrentInnerX) * stiffness;
      csJellyVelocityInnerX += forceIX;
      csJellyVelocityInnerX *= damping;
      csJellyCurrentInnerX += csJellyVelocityInnerX;
      const forceIY = (csJellyTargetInnerY - csJellyCurrentInnerY) * stiffness;
      csJellyVelocityInnerY += forceIY;
      csJellyVelocityInnerY *= damping;
      csJellyCurrentInnerY += csJellyVelocityInnerY;
      const forceBTL = (csBrTargetTL - csBrCurrentTL) * stiffness;
      csBrVelocityTL += forceBTL;
      csBrVelocityTL *= damping;
      csBrCurrentTL += csBrVelocityTL;
      const forceBTR = (csBrTargetTR - csBrCurrentTR) * stiffness;
      csBrVelocityTR += forceBTR;
      csBrVelocityTR *= damping;
      csBrCurrentTR += csBrVelocityTR;
      const forceBBR = (csBrTargetBR - csBrCurrentBR) * stiffness;
      csBrVelocityBR += forceBBR;
      csBrVelocityBR *= damping;
      csBrCurrentBR += csBrVelocityBR;
      const forceBBL = (csBrTargetBL - csBrCurrentBL) * stiffness;
      csBrVelocityBL += forceBBL;
      csBrVelocityBL *= damping;
      csBrCurrentBL += csBrVelocityBL;
      applyCsJellyTransform();
      const allSettled = Math.abs(csJellyTargetScale - csJellyCurrentScale) < 0.0003 && Math.abs(csJellyVelocityScale) < 0.0003 && Math.abs(csJellyTargetTranslateY - csJellyCurrentTranslateY) < 0.008 && Math.abs(csJellyVelocityTranslateY) < 0.008 && Math.abs(csJellyTargetInnerX - csJellyCurrentInnerX) < 0.008 && Math.abs(csJellyVelocityInnerX) < 0.008 && Math.abs(csJellyTargetInnerY - csJellyCurrentInnerY) < 0.008 && Math.abs(csJellyVelocityInnerY) < 0.008 && Math.abs(csBrTargetTL - csBrCurrentTL) < 0.04 && Math.abs(csBrVelocityTL) < 0.04 && Math.abs(csBrTargetTR - csBrCurrentTR) < 0.04 && Math.abs(csBrVelocityTR) < 0.04 && Math.abs(csBrTargetBR - csBrCurrentBR) < 0.04 && Math.abs(csBrVelocityBR) < 0.04 && Math.abs(
          csBrTargetBL - csBrCurrentBL) < 0.04 && Math.abs(csBrVelocityBL) < 0.04;
      if (allSettled) {
          csJellyCurrentScale = csJellyTargetScale;
          csJellyCurrentTranslateY = csJellyTargetTranslateY;
          csJellyCurrentInnerX = csJellyTargetInnerX;
          csJellyCurrentInnerY = csJellyTargetInnerY;
          csBrCurrentTL = csBrTargetTL;
          csBrCurrentTR = csBrTargetTR;
          csBrCurrentBR = csBrTargetBR;
          csBrCurrentBL = csBrTargetBL;
          csJellyVelocityScale = 0;
          csJellyVelocityTranslateY = 0;
          csJellyVelocityInnerX = 0;
          csJellyVelocityInnerY = 0;
          csBrVelocityTL = 0;
          csBrVelocityTR = 0;
          csBrVelocityBR = 0;
          csBrVelocityBL = 0;
          applyCsJellyTransform();
          csJellyRafId = null;
          return;
      }
      csJellyRafId = requestAnimationFrame(csJellyAnimationLoop);
  }

  function startCsJellyLoop() { if (!csJellyRafId) { csJellyRafId = requestAnimationFrame(csJellyAnimationLoop); } }

  function updateCsJellyTargets(mx, my, rect) {
      const cx = rect.width / 2,
          cy = rect.height / 2,
          rx = mx - rect.left,
          ry = my - rect.top,
          normX = Math.max(-1, Math.min(1, (rx - cx) / cx)),
          normY = Math.max(-1, Math.min(1, (ry - cy) / cy)),
          dist = Math.sqrt(normX * normX + normY * normY),
          strengthMultiplier = csJellyIsFinePointer ? 1.0 : 0.5;
      csJellyTargetScale = 1.0 + (1 - Math.min(dist, 1)) * (CS_MAX_SCALE - 1.0) * strengthMultiplier;
      csJellyTargetTranslateY = CS_HOVER_TRANSLATE_Y * strengthMultiplier;
      csJellyTargetInnerX = -normX * CS_MAX_INNER_PARALLAX * strengthMultiplier;
      csJellyTargetInnerY = normY * CS_MAX_INNER_PARALLAX * strengthMultiplier;
      const deltaX = normX * CS_MAX_BORDER_DELTA * strengthMultiplier,
          deltaY = normY * CS_MAX_BORDER_DELTA * strengthMultiplier;
      csBrTargetTL = CS_BASE_BORDER_RADIUS + deltaY - deltaX;
      csBrTargetTR = CS_BASE_BORDER_RADIUS + deltaY + deltaX;
      csBrTargetBR = CS_BASE_BORDER_RADIUS - deltaY + deltaX;
      csBrTargetBL = CS_BASE_BORDER_RADIUS - deltaY - deltaX;
      const minR = CS_BASE_BORDER_RADIUS - CS_MAX_BORDER_DELTA,
          maxR = CS_BASE_BORDER_RADIUS + CS_MAX_BORDER_DELTA;
      csBrTargetTL = Math.min(maxR, Math.max(minR, csBrTargetTL));
      csBrTargetTR = Math.min(maxR, Math.max(minR, csBrTargetTR));
      csBrTargetBR = Math.min(maxR, Math.max(minR, csBrTargetBR));
      csBrTargetBL = Math.min(maxR, Math.max(minR, csBrTargetBL));
      csIsMouseOn = true;
      startCsJellyLoop();
  }

  function resetCsJellyTargets() {
      csJellyTargetScale = 1.0;
      csJellyTargetTranslateY = 0;
      csJellyTargetInnerX = 0;
      csJellyTargetInnerY = 0;
      csBrTargetTL = CS_BASE_BORDER_RADIUS;
      csBrTargetTR = CS_BASE_BORDER_RADIUS;
      csBrTargetBR = CS_BASE_BORDER_RADIUS;
      csBrTargetBL = CS_BASE_BORDER_RADIUS;
      csIsMouseOn = false;
      csIsTouchActive = false;
      startCsJellyLoop();
  }

  function initCaseStudiesJelly() {
      csJellyEl = document.getElementById('caseStudiesCard');
      if (!csJellyEl) return;
      csThicknessLayer = document.getElementById('caseStudiesThicknessLayer');
      csHeadingEl = csJellyEl.querySelector('h2');
      csDescEl = csJellyEl.querySelector('p');
      csButtonsEl = document.getElementById('caseActionButtons');
      csJellyIsFinePointer = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
      csJellyEl.addEventListener('mousemove', function(e) {
          if (csIsTouchActive) return;
          const rect = csJellyEl.getBoundingClientRect();
          updateCsJellyTargets(e.clientX, e.clientY, rect);
      }, { passive: true });
      csJellyEl.addEventListener('mouseenter', function(e) {
          if (csIsTouchActive) return;
          const rect = csJellyEl.getBoundingClientRect();
          updateCsJellyTargets(e.clientX, e.clientY, rect);
      });
      csJellyEl.addEventListener('mouseleave', function() {
          if (csIsTouchActive) return;
          resetCsJellyTargets();
      });
      csJellyEl.addEventListener('touchmove', function(e) {
          if (!e.touches.length) return;
          csIsTouchActive = true;
          const rect = csJellyEl.getBoundingClientRect();
          updateCsJellyTargets(e.touches[0].clientX, e.touches[0].clientY, rect);
      }, { passive: true });
      csJellyEl.addEventListener('touchend', resetCsJellyTargets);
      csJellyEl.addEventListener('touchcancel', resetCsJellyTargets);
      applyCsJellyTransform();
  }

  function cleanupCaseStudiesJelly() {
      if (csJellyRafId) { cancelAnimationFrame(csJellyRafId);
          csJellyRafId = null; }
      if (csJellyEl) {
          csJellyEl.style.transform = '';
          csJellyEl.style.borderRadius = '';
      }
      if (csThicknessLayer) { csThicknessLayer.style.transform = ''; }
      if (csHeadingEl) { csHeadingEl.style.transform = ''; }
      if (csDescEl) { csDescEl.style.transform = ''; }
      if (csButtonsEl) { csButtonsEl.style.transform = ''; }
      csJellyEl = null;
      csThicknessLayer = null;
      csHeadingEl = null;
      csDescEl = null;
      csButtonsEl = null;
  }

  function init() {
    if (!document.querySelector('.case-studies-section')) return;
    initCaseStudiesVideo();
    initCaseStudiesJelly();
  }

  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);

  window.addEventListener('beforeunload', cleanupCaseStudiesJelly);
})();
