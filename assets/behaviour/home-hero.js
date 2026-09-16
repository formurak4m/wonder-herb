/* Homepage hero: the carousel, its hover physics, the particle canvas and the
 * 3D models. Lifted from index.html's inline script (the block at :3144) when
 * the homepage became a tree at P9; the physics and the WebGL are the live
 * code, unchanged, so the page behaves exactly as it does today.
 *
 * WHAT CHANGED, and it is the whole point: the live page BUILT the slides and
 * the dots in buildHeroCarousel() before it could animate them, so with
 * scripts off the hero's right-hand side was empty and a crawler saw no
 * product image at all. The slides and dots are now in the HTML (sections/
 * Hero.jsx). This file only drives what is already there - it never writes
 * innerHTML into #heroSlides - so nothing here is load-bearing for content.
 *
 * NOT PORTED, deliberately:
 *   - buildHeroCarousel(): the markup it built is pre-rendered now.
 *   - updateHeroCarouselAlt(): it rewrote each slide's alt text on a language
 *     switch. Migrated pages are Chinese-only until Phase 14 (finding 24) and
 *     the alt text is in the HTML; it comes back with the other languages.
 *   - syncFixedNavOffset(): superseded by D1 (sticky nav in assets/chrome.css),
 *     as on the other migrated pages.
 *
 * The .glb URL is NOT named here. It arrives as data-model on each slide, from
 * the tree, which is what makes the Phase 10 move to R2 a data edit.
 *
 * Needs THREE, THREE.GLTFLoader and THREE.OrbitControls, which the template
 * loads ahead of this file (renderer/template.js BEHAVIOURS deps). If they are
 * absent the 3D slides keep their photograph and everything else still runs.
 */
(function () {
  'use strict';

  /* ---- carousel state (index.html:3590) ---- */
  let heroCurrent = 0,
      heroInterval;

  /* ---- hover "jelly" physics (index.html:3595-3769), verbatim ---- */
  const MAX_SCALE = 1.06;
  const MAX_IMG_PARALLAX = 10;
  const JELLY_STIFFNESS = 0.12;
  const JELLY_DAMPING = 0.75;
  const HOVER_TRANSLATE_Y = -8;
  const BASE_BORDER_RADIUS = 32;
  const MAX_BORDER_DELTA = 10;

  let jellyTargetScale = 1.0,
      jellyCurrentScale = 1.0,
      jellyVelocityScale = 0;
  let jellyTargetTranslateY = 0,
      jellyCurrentTranslateY = 0,
      jellyVelocityTranslateY = 0;
  let jellyTargetImgX = 0,
      jellyCurrentImgX = 0,
      jellyVelocityImgX = 0;
  let jellyTargetImgY = 0,
      jellyCurrentImgY = 0,
      jellyVelocityImgY = 0;

  let brTargetTL = BASE_BORDER_RADIUS,
      brCurrentTL = BASE_BORDER_RADIUS,
      brVelocityTL = 0;
  let brTargetTR = BASE_BORDER_RADIUS,
      brCurrentTR = BASE_BORDER_RADIUS,
      brVelocityTR = 0;
  let brTargetBR = BASE_BORDER_RADIUS,
      brCurrentBR = BASE_BORDER_RADIUS,
      brVelocityBR = 0;
  let brTargetBL = BASE_BORDER_RADIUS,
      brCurrentBL = BASE_BORDER_RADIUS,
      brVelocityBL = 0;

  let jellyRafId = null;
  let isMouseOnCarousel = false;
  let isTouchActive = false;
  let jellyCarouselEl = null;
  let jellyIsFinePointer = true;

  function applyJellyTransform() {
      if (!jellyCarouselEl) return;
      jellyCarouselEl.style.transform = `scale(${jellyCurrentScale}) translateY(${jellyCurrentTranslateY}px)`;
      jellyCarouselEl.style.borderRadius = `${brCurrentTL}px ${brCurrentTR}px ${brCurrentBR}px ${brCurrentBL}px`;
      const activeSlide = jellyCarouselEl.querySelector('.carousel-slide.active');
      if (activeSlide) {
          const img = activeSlide.querySelector('img');
          if (img) { img.style.transform = `translate(${jellyCurrentImgX}px, ${jellyCurrentImgY}px)`; }
      }
  }

  function jellyAnimationLoop() {
      const stiffness = JELLY_STIFFNESS;
      const damping = JELLY_DAMPING;
      const forceS = (jellyTargetScale - jellyCurrentScale) * stiffness;
      jellyVelocityScale += forceS;
      jellyVelocityScale *= damping;
      jellyCurrentScale += jellyVelocityScale;
      const forceTY = (jellyTargetTranslateY - jellyCurrentTranslateY) * stiffness;
      jellyVelocityTranslateY += forceTY;
      jellyVelocityTranslateY *= damping;
      jellyCurrentTranslateY += jellyVelocityTranslateY;
      const forceIX = (jellyTargetImgX - jellyCurrentImgX) * stiffness;
      jellyVelocityImgX += forceIX;
      jellyVelocityImgX *= damping;
      jellyCurrentImgX += jellyVelocityImgX;
      const forceIY = (jellyTargetImgY - jellyCurrentImgY) * stiffness;
      jellyVelocityImgY += forceIY;
      jellyVelocityImgY *= damping;
      jellyCurrentImgY += jellyVelocityImgY;
      const forceBTL = (brTargetTL - brCurrentTL) * stiffness;
      brVelocityTL += forceBTL;
      brVelocityTL *= damping;
      brCurrentTL += brVelocityTL;
      const forceBTR = (brTargetTR - brCurrentTR) * stiffness;
      brVelocityTR += forceBTR;
      brVelocityTR *= damping;
      brCurrentTR += brVelocityTR;
      const forceBBR = (brTargetBR - brCurrentBR) * stiffness;
      brVelocityBR += forceBBR;
      brVelocityBR *= damping;
      brCurrentBR += brVelocityBR;
      const forceBBL = (brTargetBL - brCurrentBL) * stiffness;
      brVelocityBL += forceBBL;
      brVelocityBL *= damping;
      brCurrentBL += brVelocityBL;
      applyJellyTransform();
      const allSettled = Math.abs(jellyTargetScale - jellyCurrentScale) < 0.0005 && Math.abs(jellyVelocityScale) < 0.0005 && Math.abs(jellyTargetTranslateY - jellyCurrentTranslateY) < 0.01 && Math.abs(jellyVelocityTranslateY) < 0.01 && Math.abs(jellyTargetImgX - jellyCurrentImgX) < 0.01 && Math.abs(jellyVelocityImgX) < 0.01 && Math.abs(jellyTargetImgY - jellyCurrentImgY) < 0.01 && Math.abs(jellyVelocityImgY) < 0.01 && Math.abs(brTargetTL - brCurrentTL) < 0.05 && Math.abs(brVelocityTL) < 0.05 && Math.abs(brTargetTR - brCurrentTR) < 0.05 && Math.abs(brVelocityTR) < 0.05 && Math.abs(brTargetBR - brCurrentBR) < 0.05 && Math.abs(brVelocityBR) < 0.05 && Math.abs(brTargetBL - brCurrentBL) < 0.05 && Math.abs(
          brVelocityBL) < 0.05;
      if (allSettled) { jellyCurrentScale = jellyTargetScale;
          jellyCurrentTranslateY = jellyTargetTranslateY;
          jellyCurrentImgX = jellyTargetImgX;
          jellyCurrentImgY = jellyTargetImgY;
          brCurrentTL = brTargetTL;
          brCurrentTR = brTargetTR;
          brCurrentBR = brTargetBR;
          brCurrentBL = brTargetBL;
          jellyVelocityScale = 0;
          jellyVelocityTranslateY = 0;
          jellyVelocityImgX = 0;
          jellyVelocityImgY = 0;
          brVelocityTL = 0;
          brVelocityTR = 0;
          brVelocityBR = 0;
          brVelocityBL = 0;
          applyJellyTransform();
          jellyRafId = null; return; }
      jellyRafId = requestAnimationFrame(jellyAnimationLoop);
  }

  function startJellyLoop() { if (!jellyRafId) { jellyRafId = requestAnimationFrame(jellyAnimationLoop); } }

  function updateJellyTargets(mx, my, carouselRect) {
      const cx = carouselRect.width / 2,
          cy = carouselRect.height / 2,
          rx = mx - carouselRect.left,
          ry = my - carouselRect.top,
          normX = Math.max(-1, Math.min(1, (rx - cx) / cx)),
          normY = Math.max(-1, Math.min(1, (ry - cy) / cy)),
          dist = Math.sqrt(normX * normX + normY * normY),
          strengthMultiplier = jellyIsFinePointer ? 1.0 : 0.55;
      jellyTargetScale = 1.0 + (1 - Math.min(dist, 1)) * (MAX_SCALE - 1.0) * strengthMultiplier;
      jellyTargetTranslateY = HOVER_TRANSLATE_Y * strengthMultiplier;
      jellyTargetImgX = -normX * MAX_IMG_PARALLAX * strengthMultiplier;
      jellyTargetImgY = normY * MAX_IMG_PARALLAX * strengthMultiplier;
      const deltaX = normX * MAX_BORDER_DELTA * strengthMultiplier,
          deltaY = normY * MAX_BORDER_DELTA * strengthMultiplier;
      brTargetTL = BASE_BORDER_RADIUS + deltaY - deltaX;
      brTargetTR = BASE_BORDER_RADIUS + deltaY + deltaX;
      brTargetBR = BASE_BORDER_RADIUS - deltaY + deltaX;
      brTargetBL = BASE_BORDER_RADIUS - deltaY - deltaX;
      const minR = BASE_BORDER_RADIUS - MAX_BORDER_DELTA,
          maxR = BASE_BORDER_RADIUS + MAX_BORDER_DELTA;
      brTargetTL = Math.min(maxR, Math.max(minR, brTargetTL));
      brTargetTR = Math.min(maxR, Math.max(minR, brTargetTR));
      brTargetBR = Math.min(maxR, Math.max(minR, brTargetBR));
      brTargetBL = Math.min(maxR, Math.max(minR, brTargetBL));
      isMouseOnCarousel = true;
      startJellyLoop();
  }

  function resetJellyTargets() { jellyTargetScale = 1.0;
      jellyTargetTranslateY = 0;
      jellyTargetImgX = 0;
      jellyTargetImgY = 0;
      brTargetTL = BASE_BORDER_RADIUS;
      brTargetTR = BASE_BORDER_RADIUS;
      brTargetBR = BASE_BORDER_RADIUS;
      brTargetBL = BASE_BORDER_RADIUS;
      isMouseOnCarousel = false;
      isTouchActive = false;
      startJellyLoop(); }

  function initJellyElasticity() {
      jellyCarouselEl = document.getElementById('heroCarousel');
      if (!jellyCarouselEl) return;
      jellyIsFinePointer = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
      jellyCarouselEl.addEventListener('mousemove', function(e) { if (isTouchActive) return; const rect = jellyCarouselEl.getBoundingClientRect();
          updateJellyTargets(e.clientX, e.clientY, rect); }, { passive: true });
      jellyCarouselEl.addEventListener('mouseenter', function(e) { if (isTouchActive) return; const rect = jellyCarouselEl.getBoundingClientRect();
          updateJellyTargets(e.clientX, e.clientY, rect); });
      jellyCarouselEl.addEventListener('mouseleave', function() { if (isTouchActive) return;
          resetJellyTargets(); });
      jellyCarouselEl.addEventListener('touchmove', function(e) { if (!e.touches.length) return;
          isTouchActive = true; const rect = jellyCarouselEl.getBoundingClientRect();
          updateJellyTargets(e.touches[0].clientX, e.touches[0].clientY, rect); }, { passive: true });
      jellyCarouselEl.addEventListener('touchend', resetJellyTargets);
      jellyCarouselEl.addEventListener('touchcancel', resetJellyTargets);
      applyJellyTransform();
  }

  function cleanupJellyElasticity() { if (jellyRafId) { cancelAnimationFrame(jellyRafId);
          jellyRafId = null; } if (jellyCarouselEl) { jellyCarouselEl.style.transform = '';
          jellyCarouselEl.style.borderRadius = ''; const activeSlide = jellyCarouselEl.querySelector('.carousel-slide.active'); if (activeSlide) { const img = activeSlide.querySelector('img'); if (img) img.style.transform = ''; } }
      jellyCarouselEl = null; }
  /* ---- slide control (index.html:3771-3790), verbatim ---- */
  function goToHeroSlide(idx) {
      const slides = document.querySelectorAll('#heroSlides .carousel-slide'),
          dots = document.querySelectorAll('#heroDots .dot');
      if (idx < 0) idx = slides.length - 1;
      if (idx >= slides.length) idx = 0;
      slides.forEach((s, i) => { s.classList.toggle('active', i === idx); if (i !== idx) s.style.transform = ''; });
      dots.forEach((d, i) => { d.classList.toggle('active', i === idx);
          d.setAttribute('aria-selected', i === idx ? 'true' : 'false'); });
      heroCurrent = idx;
      resetHeroTimer();
      applyJellyTransform();
  }

  function nextHero() { goToHeroSlide(heroCurrent + 1); }

  function prevHero() { goToHeroSlide(heroCurrent - 1); }

  function resetHeroTimer() { clearInterval(heroInterval);
      heroInterval = setInterval(nextHero, 5000); }

  /* ---- the 3D models (index.html:3793-4050), verbatim ---- */
  const carousel3DInstances = {};

  // three@0.128.0's GLTFLoader only imports TEXCOORD_0/TEXCOORD_1 (as "uv"/"uv2") and ignores any
  // non-zero texCoord index on baseColorTexture other than that. These helpers read the GLB container
  // ourselves so we can pull whichever TEXCOORD_n set a model's material actually points to, even if
  // the loader never surfaced it as a geometry attribute.
  function parseGlbContainer(buffer) {
      const dv = new DataView(buffer);
      if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('Not a GLB file');
      const totalLength = dv.getUint32(8, true);
      let offset = 12, json = null, binaryChunk = null;
      while (offset < totalLength) {
          const chunkLength = dv.getUint32(offset, true);
          const chunkType = dv.getUint32(offset + 4, true);
          const chunkData = buffer.slice(offset + 8, offset + 8 + chunkLength);
          if (chunkType === 0x4e4f534a) json = JSON.parse(new TextDecoder('utf-8').decode(chunkData));
          else if (chunkType === 0x004e4942) binaryChunk = chunkData;
          offset += 8 + chunkLength;
      }
      return { json, binaryChunk };
  }

  function readGlbAccessorVec2(json, binaryChunk, accessorIndex) {
      const accessor = json.accessors[accessorIndex];
      const bufferView = json.bufferViews[accessor.bufferView];
      const componentByteSizes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
      const componentSize = componentByteSizes[accessor.componentType];
      const stride = bufferView.byteStride || componentSize * 2;
      const baseOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
      const dv = new DataView(binaryChunk);
      const out = new Float32Array(accessor.count * 2);
      for (let i = 0; i < accessor.count; i++) {
          const off = baseOffset + i * stride;
          let x, y;
          switch (accessor.componentType) {
              case 5126: x = dv.getFloat32(off, true); y = dv.getFloat32(off + 4, true); break;
              case 5121: x = dv.getUint8(off) / 255; y = dv.getUint8(off + 1) / 255; break;
              case 5123: x = dv.getUint16(off, true) / 65535; y = dv.getUint16(off + 2, true) / 65535; break;
              default: throw new Error('Unsupported TEXCOORD component type: ' + accessor.componentType);
          }
          out[i * 2] = x;
          out[i * 2 + 1] = y;
      }
      return out;
  }

  // Applies the correct UV set to every mesh in the model, based on what its own material actually
  // requests (baseColorTexture.texCoord), instead of a hardcoded per-file guess.
  function fixModelUVs(model, glbJson, binaryChunk) {
      if (!glbJson) return;
      let meshCursor = 0;
      model.traverse(function(child) {
          if (!child.isMesh || !child.geometry) return;
          const meshDef = glbJson && glbJson.meshes && glbJson.meshes[meshCursor];
          meshCursor++;
          if (!meshDef) return;
          const primDef = meshDef.primitives && meshDef.primitives[0];
          const matIndex = primDef ? primDef.material : undefined;
          const matDef = matIndex !== undefined ? glbJson.materials[matIndex] : (glbJson.materials && glbJson.materials[0]);
          const bct = matDef && matDef.pbrMetallicRoughness && matDef.pbrMetallicRoughness.baseColorTexture;
          const texCoord = bct && bct.texCoord !== undefined ? bct.texCoord : 0;
          if (texCoord === 0) return;
          if (texCoord === 1 && child.geometry.attributes.uv2) {
              child.geometry.setAttribute('uv', child.geometry.attributes.uv2);
              return;
          }
          if (texCoord >= 2 && primDef) {
              const accessorIdx = primDef.attributes['TEXCOORD_' + texCoord];
              if (accessorIdx === undefined) return;
              try {
                  const uvArray = readGlbAccessorVec2(glbJson, binaryChunk, accessorIdx);
                  child.geometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
              } catch (e) {
                  console.warn('Failed to apply TEXCOORD_' + texCoord + ' fix:', e);
              }
          }
      });
  }

  function init3DCarouselModels() {
      if (typeof THREE === 'undefined') {
          console.error('Three.js not loaded!');
          return;
      }
      if (typeof THREE.GLTFLoader === 'undefined') {
          console.error('GLTFLoader not loaded!');
          return;
      }
      
      document.querySelectorAll('.carousel-3d-container').forEach(container => {
          const modelSrc = container.getAttribute('data-model');
          if (!modelSrc) return;
          const modelSrcNoCache = modelSrc + '?v=' + Date.now();
          
          /* CHANGED FROM THE LIVE PAGE. It replaced the container's contents
             with "載入 3D 模型中..." here, and with "無法載入 3D 模型" if the
             load failed - so the product photograph the tree renders would be
             destroyed before the 19 MB download even started, and a visitor on
             a slow line or a machine without WebGL would be left looking at a
             sentence. The poster now STAYS until the model is actually in the
             scene, and stays for good if the load fails. */
          const poster = container.querySelector('img');

          const containerRect = container.getBoundingClientRect();
          const width = containerRect.width || 400;
          const height = containerRect.height || 300;
          
          const scene = new THREE.Scene();

          const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
          camera.position.set(0, 0, 3);
          
          const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
          renderer.setSize(width, height);
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
          /* the canvas goes in ALONGSIDE the poster, not instead of it */
          container.appendChild(renderer.domElement);

          // Keep the render resolution/aspect in sync with the container's actual box, which changes
          // across responsive breakpoints (see .carousel-slides padding-bottom). Without this, the
          // canvas gets stretched by its CSS width/height:100% while the WebGL content stays rendered
          // at the stale aspect ratio from init time.
          if (typeof ResizeObserver !== 'undefined') {
              const resizeObserver = new ResizeObserver(entries => {
                  for (const entry of entries) {
                      const w = entry.contentRect.width;
                      const h = entry.contentRect.height;
                      if (w <= 0 || h <= 0) continue;
                      camera.aspect = w / h;
                      camera.updateProjectionMatrix();
                      renderer.setSize(w, h);
                  }
              });
              resizeObserver.observe(container);
          }

          const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
          scene.add(ambientLight);

          const keyLight = new THREE.DirectionalLight(0xffffff, 0.6);
          keyLight.position.set(5, 5, 5);
          scene.add(keyLight);

          // const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
          // fillLight.position.set(-5, 0, 5);
          // scene.add(fillLight);

          // const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
          // backLight.position.set(0, -5, -5);
          // scene.add(backLight);

          // Add soft point light for better texture visibility
          // const pointLight = new THREE.PointLight(0xffffff, 0.4, 10);
          // pointLight.position.set(0, 2, 3);
          // scene.add(pointLight);
          
          // Add OrbitControls for mouse interaction
          const controls = new THREE.OrbitControls(camera, renderer.domElement);
          controls.enableDamping = true;
          controls.dampingFactor = 0.05;
          controls.enableZoom = true;
          controls.enablePan = false;
          controls.autoRotate = true;
          controls.autoRotateSpeed = 1.5;
          
          const inst = { scene, camera, renderer, controls, model: null };
          carousel3DInstances[modelSrc] = inst;
          
          const loader = new THREE.GLTFLoader();
          fetch(modelSrcNoCache)
              .then(function(res) { return res.arrayBuffer(); })
              .then(function(buffer) {
                  let glbJson = null, binaryChunk = null;
                  try {
                      const parsed = parseGlbContainer(buffer);
                      glbJson = parsed.json;
                      binaryChunk = parsed.binaryChunk;
                  } catch (e) {
                      console.warn('Could not parse GLB container for UV inspection:', e);
                  }
                  loader.parse(
                      buffer,
                      '',
                      function(gltf) {
                          console.log('3D model loaded successfully!');
                          const model = gltf.scene;

                          fixModelUVs(model, glbJson, binaryChunk);
                          model.traverse(function(child) {
                              if (child.isMesh && child.material) {
                                  const materials = Array.isArray(child.material) ? child.material : [child.material];
                                  materials.forEach(mat => {
                                      mat.side = THREE.DoubleSide;
                                      mat.needsUpdate = true;
                                  });
                              }
                          });

                          const box = new THREE.Box3().setFromObject(model);
                          const center = box.getCenter(new THREE.Vector3());
                          const size = box.getSize(new THREE.Vector3());
                          const maxDim = Math.max(size.x, size.y, size.z);
                          const scale = 1.8 / maxDim;
                          model.scale.setScalar(scale);
                          model.position.sub(center.multiplyScalar(scale));
                          scene.add(model);
                          inst.model = model;
                          /* the model is on screen now: the photograph has done its job */
                          if (poster) poster.style.display = 'none';
                      },
                      function(error) {
                          console.error('Error loading 3D model:', error);
                          /* keep the photograph; remove the empty canvas */
                          if (renderer.domElement.parentNode) renderer.domElement.remove();
                      }
                  );
              })
              .catch(function(error) {
                  console.error('Error fetching 3D model:', error);
                  /* keep the photograph; remove the empty canvas */
                  if (renderer.domElement.parentNode) renderer.domElement.remove();
              });
          
          let isAnimating = false;
          function animate3D() {
              const parentSlide = container.closest('.carousel-slide');
              if (parentSlide && parentSlide.classList.contains('active')) {
                  if (!isAnimating) {
                      isAnimating = true;
                      (function animLoop() {
                          if (!carousel3DInstances[modelSrc]) return;
                          const currentInst = carousel3DInstances[modelSrc];
                          if (currentInst.controls) {
                              currentInst.controls.update();
                          }
                          currentInst.renderer.render(currentInst.scene, currentInst.camera);
                          const stillActive = container.closest('.carousel-slide');
                          if (stillActive && stillActive.classList.contains('active')) {
                              requestAnimationFrame(animLoop);
                          } else {
                              isAnimating = false;
                          }
                      })();
                  }
              }
          }
          
          const observer = new MutationObserver(() => {
              animate3D();
          });
          observer.observe(container, { childList: true });
          animate3D();
          
          // Also try when slide becomes active
          const slideObserver = new MutationObserver(() => {
              const parentSlide = container.closest('.carousel-slide');
              if (parentSlide && parentSlide.classList.contains('active')) {
                  animate3D();
              }
          });
          const carouselSlides = document.getElementById('heroSlides');
          if (carouselSlides) {
              slideObserver.observe(carouselSlides, { attributes: true, attributeFilter: ['class'], subtree: true });
          }
      });
  }
  /* ---- the hero particle canvas (index.html:4106-4253), verbatim ---- */
  function initHeroCanvas() {
      const canvas = document.getElementById('heroCanvas'),
          hero = document.getElementById('heroSection');
      if (!canvas || !hero) return;
      const ctx = canvas.getContext('2d');
      let width, height, particles = [],
          mouseX = -9999,
          mouseY = -9999,
          targetMouseX = -9999,
          targetMouseY = -9999,
          prevMouseX = -9999,
          prevMouseY = -9999;
      const GRID_SPACING = 38,
          DOT_RADIUS = 2.2,
          BASE_INFLUENCE_RADIUS = 100,
          MIN_INFLUENCE_RADIUS = 3,
          REPULSION_STRENGTH = 38,
          SPRING_TENSION = 0.06,
          CONNECTION_DIST = 52,
          WAVE_AMPLITUDE = 1.6,
          WAVE_FREQ = 0.0008;
      let time = 0,
          animFrameId = null,
          isHoverDevice = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
      let mouseActive = false,
          mouseInfluenceFactor = 0,
          mouseActivationStart = performance.now();
      const SHOWER_DURATION = 2000;
      let showerStartTime = performance.now();
      let currentInfluenceRadius = BASE_INFLUENCE_RADIUS,
          targetInfluenceRadius = BASE_INFLUENCE_RADIUS;
      const RADIUS_SHRINK_SPEED = 0.15,
          RADIUS_RECOVERY_SPEED = 0.025;

      function resize() { const rect = hero.getBoundingClientRect(),
              dpr = Math.min(window.devicePixelRatio || 1, 2);
          width = rect.width;
          height = rect.height;
          canvas.width = width * dpr;
          canvas.height = height * dpr;
          canvas.style.width = width + 'px';
          canvas.style.height = height + 'px';
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.scale(dpr, dpr);
          buildParticleGrid(); }

      function buildParticleGrid() { const elapsed = performance.now() - showerStartTime,
              showerProgress = Math.min(elapsed / SHOWER_DURATION, 1),
              remainingShower = 1 - showerProgress;
          particles = []; const cols = Math.floor(width / GRID_SPACING) + 2,
              rows = Math.floor(height / GRID_SPACING) + 2,
              offsetX = (width - (cols - 1) * GRID_SPACING) / 2,
              offsetY = (height - (rows - 1) * GRID_SPACING) / 2; for (let r = 0; r < rows; r++)
              for (let c = 0; c < cols; c++) { const ox = offsetX + c * GRID_SPACING,
                      oy = offsetY + r * GRID_SPACING,
                      showerOffsetY = remainingShower > 0.01 ? -(25 + Math.random() * 55) * remainingShower : 0;
                  particles.push({ ox, oy, x: ox, y: oy + showerOffsetY, vx: 0, vy: 0, baseRadius: DOT_RADIUS * (0.7 + Math.random() * 0.6) }); } }

      function getShowerScale() { const p = Math.min((performance.now() - showerStartTime) / SHOWER_DURATION, 1); return 1 + 1.7 * Math.pow(p - 1, 3) + 1.7 * Math.pow(p - 1, 2); }

      function updateParticles() { time += 0.016; const now = performance.now(); if (mouseActive) { const activeSec = (now - mouseActivationStart) / 1000; if (activeSec < 1) mouseInfluenceFactor = 0; else if (activeSec < 4) mouseInfluenceFactor = (activeSec - 1) / 3; else mouseInfluenceFactor = 1; } else { mouseInfluenceFactor += (0 - mouseInfluenceFactor) * 0.02; if (Math.abs(mouseInfluenceFactor) < 0.001) mouseInfluenceFactor = 0; } const mx = mouseX + (targetMouseX - mouseX) * 0.03; const my = mouseY + (targetMouseY - mouseY) * 0.03;
          mouseX = mx;
          mouseY = my; let vx = 0,
              vy = 0; if (prevMouseX !== -9999) { vx = targetMouseX - prevMouseX;
              vy = targetMouseY - prevMouseY; }
          prevMouseX = targetMouseX;
          prevMouseY = targetMouseY; const mouseSpeed = Math.sqrt(vx * vx + vy * vy); const speedFactor = Math.min(mouseSpeed / 30, 1);
          targetInfluenceRadius = BASE_INFLUENCE_RADIUS - speedFactor * (BASE_INFLUENCE_RADIUS - MIN_INFLUENCE_RADIUS); const lerpSpeed = targetInfluenceRadius < currentInfluenceRadius ? RADIUS_SHRINK_SPEED : RADIUS_RECOVERY_SPEED;
          currentInfluenceRadius += (targetInfluenceRadius - currentInfluenceRadius) * lerpSpeed; const dirX = mouseSpeed > 0.5 ? vx / mouseSpeed : 1; const dirY = mouseSpeed > 0.5 ? vy / mouseSpeed : 0; for (const p of particles) { const waveX = Math.sin(p.oy * WAVE_FREQ + time * 1.3) * WAVE_AMPLITUDE,
                  waveY = Math.cos(p.ox * WAVE_FREQ + time * 1.1) * WAVE_AMPLITUDE; const tx = p.ox + waveX,
                  ty = p.oy + waveY,
                  dx = p.x - mouseX,
                  dy = p.y - mouseY,
                  dist = Math.sqrt(dx * dx + dy * dy); let fx = 0,
                  fy = 0; if (isHoverDevice && dist > 0.01 && mouseInfluenceFactor > 0.01) { const dot = (dx * dirX + dy * dirY) / dist; const radiusScale = dot < 0 ? 1.0 - dot * 0.8 : 1.0; const effectiveRadius = currentInfluenceRadius * radiusScale; if (dist < effectiveRadius) { const directionFactor = 0.3 + 0.7 * Math.max(0, dot); const strength = (1 - dist / effectiveRadius); const smoothStrength = strength * strength * REPULSION_STRENGTH * mouseInfluenceFactor * directionFactor;
                      fx = (dx / dist) * smoothStrength;
                      fy = (dy / dist) * smoothStrength; } }
              p.vx += ((tx - p.x) * SPRING_TENSION) + fx;
              p.vy += ((ty - p.y) * SPRING_TENSION) + fy;
              p.vx *= 0.82;
              p.vy *= 0.82;
              p.x += p.vx;
              p.y += p.vy; } }

      function draw() { ctx.clearRect(0, 0, width, height); const ss = getShowerScale();
          ctx.strokeStyle = 'rgba(210,185,155,0.08)';
          ctx.lineWidth = 0.6;
          ctx.beginPath(); for (let i = 0; i < particles.length; i++) { const a = particles[i]; for (let j = i + 1; j < particles.length; j++) { const b = particles[j]; if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 < CONNECTION_DIST ** 2) { ctx.moveTo(a.x, a.y);
                      ctx.lineTo(b.x, b.y); } } }
          ctx.stroke(); for (const p of particles) { const distToMouse = Math.sqrt((p.x - mouseX) ** 2 + (p.y - mouseY) ** 2); let alpha = 0.35,
                  radius = p.baseRadius * ss,
                  glowRadius = 0; if (isHoverDevice && distToMouse < currentInfluenceRadius * 1.5 && mouseInfluenceFactor > 0.01) { const t = 1 - distToMouse / (currentInfluenceRadius * 1.5); const influenceT = Math.min(1, t * mouseInfluenceFactor);
                  alpha = 0.35 + influenceT * 0.45;
                  radius = p.baseRadius * ss + influenceT * 2.8;
                  glowRadius = influenceT * 5.5; } const finalAlpha = Math.min(alpha, 1) * ss; if (glowRadius > 0.2) { const grad = ctx.createRadialGradient(p.x, p.y, radius * 0.5, p.x, p.y, radius + glowRadius);
                  grad.addColorStop(0, `rgba(215,188,160,${finalAlpha*0.6})`);
                  grad.addColorStop(0.5, `rgba(205,175,150,${finalAlpha*0.25})`);
                  grad.addColorStop(1, 'rgba(205,175,150,0)');
                  ctx.fillStyle = grad;
                  ctx.beginPath();
                  ctx.arc(p.x, p.y, radius + glowRadius, 0, Math.PI * 2);
                  ctx.fill(); }
              ctx.fillStyle = `rgba(205,175,150,${finalAlpha})`;
              ctx.beginPath();
              ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
              ctx.fill(); } }

      function animate() { updateParticles();
          draw();
          animFrameId = requestAnimationFrame(animate); }

      function onMouseMove(e) { const rect = hero.getBoundingClientRect();
          targetMouseX = e.clientX - rect.left;
          targetMouseY = e.clientY - rect.top; if (!mouseActive) { mouseActive = true;
              mouseActivationStart = performance.now(); } }

      function onMouseEnter(e) { const rect = hero.getBoundingClientRect();
          targetMouseX = e.clientX - rect.left;
          targetMouseY = e.clientY - rect.top; if (!mouseActive) { mouseActive = true;
              mouseActivationStart = performance.now(); } }

      function onMouseLeave() { mouseActive = false;
          targetInfluenceRadius = BASE_INFLUENCE_RADIUS; }

      function onTouchMove(e) { if (!e.touches.length) return; const rect = hero.getBoundingClientRect();
          targetMouseX = e.touches[0].clientX - rect.left;
          targetMouseY = e.touches[0].clientY - rect.top; if (!mouseActive) { mouseActive = true;
              mouseActivationStart = performance.now(); } }

      function onTouchEnd() { mouseActive = false;
          targetInfluenceRadius = BASE_INFLUENCE_RADIUS; }
      resize();
      hero.addEventListener('mousemove', onMouseMove, { passive: true });
      hero.addEventListener('mouseenter', onMouseEnter);
      hero.addEventListener('mouseleave', onMouseLeave);
      hero.addEventListener('touchmove', onTouchMove, { passive: true });
      hero.addEventListener('touchend', onTouchEnd);
      hero.addEventListener('touchcancel', onTouchEnd);
      window.addEventListener('resize', resize);
      animate();
      canvas._heroCleanup = () => { if (animFrameId) cancelAnimationFrame(animFrameId);
          hero.removeEventListener('mousemove', onMouseMove);
          hero.removeEventListener('mouseenter', onMouseEnter);
          hero.removeEventListener('mouseleave', onMouseLeave);
          hero.removeEventListener('touchmove', onTouchMove);
          hero.removeEventListener('touchend', onTouchEnd);
          hero.removeEventListener('touchcancel', onTouchEnd); };
  }

  /* ---- start ----------------------------------------------------------
     The live page did all of this on window load; same here, so the 19 MB of
     models never competes with the page rendering. The dots were bound inside
     buildHeroCarousel(); they are bound here instead, by position. */
  function init() {
    if (!document.getElementById('heroSlides')) return;
    applyJellyTransform();
    init3DCarouselModels();
    initJellyElasticity();
    initHeroCanvas();
    var prev = document.getElementById('heroPrev');
    var next = document.getElementById('heroNext');
    if (prev) prev.addEventListener('click', function () { prevHero(); resetHeroTimer(); });
    if (next) next.addEventListener('click', function () { nextHero(); resetHeroTimer(); });
    document.querySelectorAll('#heroDots .dot').forEach(function (dot, i) {
      dot.addEventListener('click', function () { goToHeroSlide(i); });
    });
    resetHeroTimer();
  }

  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);

  window.addEventListener('beforeunload', function () {
    var c = document.getElementById('heroCanvas');
    if (c && c._heroCleanup) c._heroCleanup();
    cleanupJellyElasticity();
  });
})();
