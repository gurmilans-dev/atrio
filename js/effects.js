// Pointer effects: borders that light up near the cursor and a gentle wallpaper parallax.
// They run only while the mouse moves and never with reduced motion. Kept cheap on purpose:
// element positions are cached instead of measured every frame, and the parallax target is
// updated ~10 times a second while the CSS transition on .wallpaper smooths the movement.
import { getState, subscribe } from './store.js';

const PARALLAX_PX = 10; // style.css oversizes the wallpaper by more than this
const PARALLAX_EVERY_MS = 100;
const REACH_PX = 100; // how far from an element its border starts to glow (fewer lit at once = less repaint)
const RECTS_TTL_MS = 500; // cached positions are refreshed at least this often
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let pointer = null;
let frame = 0;
let targets = null;
let targetsAt = 0;
let parallaxAt = 0;
let parallaxTimer = 0;

const wallpaper = () => document.querySelector('.wallpaper');
const parallaxOn = () => getState().parallax && !reducedMotion.matches;

// The light lives on a childless ring: updating it restyles one node, not the whole element.
function lightRing(node) {
  let ring = [...node.children].find((child) => child.classList.contains('glow-ring'));
  if (!ring) {
    ring = document.createElement('span');
    ring.className = 'glow-ring';
    ring.setAttribute('aria-hidden', 'true');
    node.append(ring);
  }
  return ring;
}

// Reading layout every frame would force a style/layout pass each time: positions only change
// on resize, scroll or re-render, so a short-lived cache is enough.
function glowTargets(now) {
  if (!targets || now - targetsAt > RECTS_TTL_MS || targets.some(({ node }) => !node.isConnected)) {
    targets = [...document.querySelectorAll('.glow')].map((node) => ({
      node,
      rect: node.getBoundingClientRect(),
      ring: lightRing(node),
    }));
    targetsAt = now;
  }
  return targets;
}

function paintSpotlight() {
  frame = 0;
  if (!pointer) return;
  const { x, y } = pointer;
  for (const { node, rect, ring } of glowTargets(Date.now())) {
    const near =
      x > rect.left - REACH_PX &&
      x < rect.right + REACH_PX &&
      y > rect.top - REACH_PX &&
      y < rect.bottom + REACH_PX;
    node.classList.toggle('lit', near);
    if (!near) continue;
    ring.style.setProperty('--mx', `${Math.round(x - rect.left)}px`);
    ring.style.setProperty('--my', `${Math.round(y - rect.top)}px`);
  }
}

function applyParallax() {
  parallaxTimer = 0;
  parallaxAt = Date.now();
  if (!pointer || !parallaxOn()) return;
  const dx = (0.5 - pointer.x / innerWidth) * 2 * PARALLAX_PX;
  const dy = (0.5 - pointer.y / innerHeight) * 2 * PARALLAX_PX;
  wallpaper().style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
}

// Throttled with a trailing call, so the wallpaper always settles on the last position.
function scheduleParallax() {
  if (parallaxTimer || !parallaxOn()) return;
  parallaxTimer = setTimeout(applyParallax, Math.max(0, PARALLAX_EVERY_MS - (Date.now() - parallaxAt)));
}

function reset() {
  pointer = null;
  clearTimeout(parallaxTimer);
  parallaxTimer = 0;
  for (const node of document.querySelectorAll('.glow.lit')) node.classList.remove('lit');
  wallpaper().style.transform = '';
}

export function initEffects() {
  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType === 'touch' || reducedMotion.matches) return;
      const moved =
        !pointer || Math.abs(event.clientX - pointer.x) + Math.abs(event.clientY - pointer.y) >= 2;
      if (!moved) return;
      pointer = { x: event.clientX, y: event.clientY };
      frame ||= requestAnimationFrame(paintSpotlight);
      scheduleParallax();
    },
    { passive: true },
  );
  const forgetPositions = () => (targets = null);
  window.addEventListener('resize', forgetPositions, { passive: true });
  window.addEventListener('scroll', forgetPositions, { passive: true });
  // relatedTarget is null when the mouse leaves the window.
  document.addEventListener('mouseout', (event) => {
    if (!event.relatedTarget) reset();
  });
  reducedMotion.addEventListener('change', reset);
  subscribe((state) => {
    targets = null; // a re-render may have replaced or moved the glowing elements
    if (!state.parallax) wallpaper().style.transform = '';
  });
}
