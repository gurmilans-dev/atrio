// Optional mouse effects (Settings → General, off by default): link borders that light up near
// the cursor, a slight lift of the hovered link and a gentle wallpaper parallax.
// When they are off, or the system asks for reduced motion, no pointer listener is attached at
// all, so the page does no work when the mouse moves. When on, they are kept cheap: element
// positions are cached instead of measured every frame, and the parallax target is updated
// ~10 times a second while the CSS transition on .wallpaper smooths the movement.
import { getState, subscribe } from './store.js';

const PARALLAX_PX = 10; // style.css oversizes the wallpaper by more than this
const PARALLAX_EVERY_MS = 100;
const REACH_PX = 100; // how far from an element its border starts to glow (fewer lit at once = less repaint)
const RECTS_TTL_MS = 500; // cached positions are refreshed at least this often
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let enabled = false;
let pointer = null;
let frame = 0;
let targets = null;
let targetsAt = 0;
let parallaxAt = 0;
let parallaxTimer = 0;

const wallpaper = () => document.querySelector('.wallpaper');

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
  if (!pointer || !enabled) return;
  const dx = (0.5 - pointer.x / innerWidth) * 2 * PARALLAX_PX;
  const dy = (0.5 - pointer.y / innerHeight) * 2 * PARALLAX_PX;
  wallpaper().style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
}

// Throttled with a trailing call, so the wallpaper always settles on the last position.
function scheduleParallax() {
  if (parallaxTimer) return;
  parallaxTimer = setTimeout(applyParallax, Math.max(0, PARALLAX_EVERY_MS - (Date.now() - parallaxAt)));
}

function onPointerMove(event) {
  if (event.pointerType === 'touch') return;
  const moved = !pointer || Math.abs(event.clientX - pointer.x) + Math.abs(event.clientY - pointer.y) >= 2;
  if (!moved) return;
  pointer = { x: event.clientX, y: event.clientY };
  frame ||= requestAnimationFrame(paintSpotlight);
  scheduleParallax();
}

function reset() {
  pointer = null;
  clearTimeout(parallaxTimer);
  parallaxTimer = 0;
  for (const node of document.querySelectorAll('.glow.lit')) node.classList.remove('lit');
  wallpaper().style.transform = '';
}

function setEnabled(on) {
  if (on === enabled) return;
  enabled = on;
  document.documentElement.toggleAttribute('data-mouse-effects', on); // hover lift in style.css
  if (on) {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
  } else {
    window.removeEventListener('pointermove', onPointerMove);
    reset();
  }
}

const sync = () => setEnabled(getState().mouseEffects && !reducedMotion.matches);

export function initEffects() {
  const forgetPositions = () => (targets = null);
  window.addEventListener('resize', forgetPositions, { passive: true });
  window.addEventListener('scroll', forgetPositions, { passive: true });
  // relatedTarget is null when the mouse leaves the window.
  document.addEventListener('mouseout', (event) => {
    if (enabled && !event.relatedTarget) reset();
  });
  reducedMotion.addEventListener('change', sync);
  subscribe(() => {
    targets = null; // a re-render may have replaced or moved the glowing elements
    sync();
  });
  sync();
}
