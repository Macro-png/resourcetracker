// ─── UI Utilities ─────────────────────────────────────────────────────────────
// Generic UI helpers with no domain knowledge.
// editMode is a live binding — setEditMode() updates it and all importers
// that read `editMode` will see the new value immediately.

export let editMode = false;

export function setEditMode(val) {
  editMode = val;
}

// ─── Toast ───────────────────────────────────────────────────────────────────

export function showToast(msg, ms = 1800) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  t.classList.add('show');
  setTimeout(() => { t.classList.remove('show'); t.hidden = true; }, ms);
}

// ─── Swipe-to-delete ─────────────────────────────────────────────────────────
// Wraps el's children in a .swipe-content div and adds a .swipe-delete-bg
// behind it. Only active when editMode is true.

export function makeSwipeable(el, onDelete) {
  el.classList.add('swipe-item');

  const bg = document.createElement('div');
  bg.className = 'swipe-delete-bg';
  bg.textContent = 'Delete';

  const content = document.createElement('div');
  content.className = 'swipe-content';
  while (el.firstChild) content.appendChild(el.firstChild);

  el.appendChild(bg);
  el.appendChild(content);

  let startX = 0, startY = 0, tracking = false;
  const SWIPE_WIDTH     = 56;
  const SWIPE_THRESHOLD = 20;

  content.addEventListener('touchstart', e => {
    if (!editMode) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = false;
  }, { passive: true });

  content.addEventListener('touchmove', e => {
    if (!editMode) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (!tracking && Math.abs(dy) > Math.abs(dx)) return;
    tracking = true;
    const clamped = Math.max(-SWIPE_WIDTH, Math.min(0, dx));
    content.style.transition = 'none';
    content.style.transform  = `translateX(${clamped}px)`;
    bg.style.transition      = 'none';
    bg.style.opacity         = String(Math.min(1, Math.abs(clamped) / SWIPE_WIDTH));
  }, { passive: true });

  content.addEventListener('touchend', () => {
    if (!editMode) return;
    content.style.transition = 'transform 0.2s ease';
    bg.style.transition      = 'opacity 0.15s ease';
    const x = new DOMMatrix(getComputedStyle(content).transform).m41;
    if (x < -SWIPE_THRESHOLD) {
      el.classList.add('swiped');
      content.style.transform = `translateX(-${SWIPE_WIDTH}px)`;
      bg.style.opacity = '1';
    } else {
      el.classList.remove('swiped');
      content.style.transform = '';
      bg.style.opacity = '0';
    }
  });

  bg.addEventListener('click', () => {
    if (!editMode) return;
    el.style.transition = 'opacity 0.2s, max-height 0.25s';
    el.style.overflow   = 'hidden';
    el.style.maxHeight  = el.offsetHeight + 'px';
    el.style.opacity    = '1';
    requestAnimationFrame(() => { el.style.maxHeight = '0'; el.style.opacity = '0'; });
    setTimeout(onDelete, 260);
  });

  // Tap elsewhere closes the open swipe
  document.addEventListener('touchstart', e => {
    if (!editMode) return;
    if (!el.contains(e.target) && el.classList.contains('swiped')) {
      el.classList.remove('swiped');
      content.style.transition = 'transform 0.2s ease';
      content.style.transform  = '';
    }
  }, { passive: true });
}