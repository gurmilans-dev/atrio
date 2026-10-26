// Pointer effects: borders that light up near the cursor and a gentle wallpaper parallax.
// They run only while the mouse moves, at most once per frame, and never with reduced motion.
import { getState, subscribe } from './store.js';

const PARALLAX_PX = 10; // style.css oversizes the wallpaper by more than this
const REACH_PX = 160; // how far from an element its border starts to glow
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let pointer = null;
let frame = 0;

const wallpaper = () => document.querySelector('.wallpaper');
const parallaxOn = () => getState().parallax && !reducedMotion.matches;

function paint() {
  frame = 0;
  if (!pointer) return;
  const { x, y } = pointer;

  // Read every rectangle first, then write: no layout thrashing.
  const targets = [...document.querySelectorAll('.glow')];
  const rects = targets.map((node) => node.getBoundingClientRect());
  targets.forEach((node, index) => {
    const rect = rects[index];
    const near =
      x > rect.left - REACH_PX &&
      x < rect.right + REACH_PX &&
      y > rect.top - REACH_PX &&
      y < rect.bottom + REACH_PX;
    node.classList.toggle('lit', near);
    if (near) {
      node.style.setProperty('--mx', `${Math.round(x - rect.left)}px`);
      node.style.setProperty('--my', `${Math.round(y - rect.top)}px`);
    }
  });

  if (parallaxOn()) {
    const dx = (0.5 - x / innerWidth) * 2 * PARALLAX_PX;
    const dy = (0.5 - y / innerHeight) * 2 * PARALLAX_PX;
    wallpaper().style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
  }
}

function reset() {
  pointer = null;
  for (const node of document.querySelectorAll('.glow.lit')) node.classList.remove('lit');
  wallpaper().style.transform = '';
}

export function initEffects() {
  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType === 'touch' || reducedMotion.matches) return;
      pointer = { x: event.clientX, y: event.clientY };
      frame ||= requestAnimationFrame(paint);
    },
    { passive: true },
  );
  // relatedTarget is null when the mouse leaves the window.
  document.addEventListener('mouseout', (event) => {
    if (!event.relatedTarget) reset();
  });
  reducedMotion.addEventListener('change', reset);
  subscribe((state) => {
    if (!state.parallax) wallpaper().style.transform = '';
  });
}
