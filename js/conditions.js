// ─── Conditions ──────────────────────────────────────────────────────────────
// Handles standard conditions, implied conditions, concentration, and
// exhaustion. Does not import from hp.js or session.js — uses the custom
// 'app:rerender' event to trigger a session re-render after state changes.

import { saveState } from './state.js';
import { showToast }  from './ui.js';
import { state }      from './state.js';

export const STANDARD_CONDITIONS = [
  'Prone', 'Unconscious',
  'Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Incapacitated',
  'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Restrained', 'Stunned',
];

// Which conditions are automatically applied by others
export const IMPLIED_CONDITIONS = {
  Paralyzed:   ['Incapacitated'],
  Stunned:     ['Incapacitated'],
  Petrified:   ['Incapacitated'],
  Unconscious: ['Incapacitated', 'Prone'],
};

// Implied conditions that survive after their source is removed
export const STICKY_IMPLIED = new Set(['Prone']);

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function hasCondition(c, name) {
  return c.statuses.some(s => s.name === name);
}

export function toggleCondition(c, name) {
  if (c.locked) return;
  if (hasCondition(c, name)) {
    c.statuses = c.statuses.filter(s => s.name !== name);
    // Clean up implied conditions that no longer have a source
    const stillImplied = new Set(c.statuses.flatMap(s => IMPLIED_CONDITIONS[s.name] || []));
    c.statuses.forEach(s => {
      if (s.implied && STICKY_IMPLIED.has(s.name) && !stillImplied.has(s.name)) s.implied = false;
    });
    c.statuses = c.statuses.filter(s =>
      !s.implied || stillImplied.has(s.name) || STICKY_IMPLIED.has(s.name)
    );
  } else {
    c.statuses.push({ id: crypto.randomUUID(), name, remaining: 0, durationType: 'rest' });
    (IMPLIED_CONDITIONS[name] || []).forEach(imp => {
      const existing = c.statuses.find(s => s.name === imp);
      if (!existing) c.statuses.push({ id: crypto.randomUUID(), name: imp, remaining: 0, durationType: 'rest', implied: true });
      else existing.implied = true;
    });
  }
  saveState();
  document.dispatchEvent(new CustomEvent('app:rerender'));
}

export function getConcentration(c) {
  return c.concentration || null;
}

export function toggleConcentration(c) {
  if (c.locked) return;
  if (getConcentration(c)) {
    if (!confirm('Stop concentrating?')) return;
    delete c.concentration;
  } else {
    c.concentration = { since: Date.now() };
  }
  saveState();
  document.dispatchEvent(new CustomEvent('app:rerender'));
}

// ─── Render ──────────────────────────────────────────────────────────────────

export function renderStatuses(c) {
  if (!('exhaustion' in c)) c.exhaustion = 0;

  // Death by exhaustion — break out of the current render cycle with setTimeout
  if (c.exhaustion >= 6) {
    c.dead = true;
    c.deathSaves = { success: 0, failure: 0 };
    delete c.concentration;
    saveState();
    showToast(`${c.name} has succumbed to exhaustion!`);
    setTimeout(() => document.dispatchEvent(new CustomEvent('app:rerender')), 0);
    return;
  }

  const grid = document.getElementById('condition-grid');
  if (!grid) return;
  grid.innerHTML = '';

  // Standard condition buttons
  STANDARD_CONDITIONS.forEach(cond => {
    const btn     = document.createElement('button');
    btn.className = 'condition-btn';
    btn.textContent = cond;

    const active  = hasCondition(c, cond);
    const implied = active && c.statuses.find(s => s.name === cond)?.implied;
    if (active)  btn.classList.add('active');
    if (implied) { btn.classList.add('implied'); btn.title = 'Applied by another condition'; }

    btn.addEventListener('click', () => {
      if (implied) {
        const stillNeeded = Object.entries(IMPLIED_CONDITIONS).some(
          ([src, imps]) => imps.includes(cond) && hasCondition(c, src)
        );
        if (stillNeeded) return;
      }
      toggleCondition(c, cond);
    });

    grid.appendChild(btn);
  });

  // Concentration button
  const conc    = getConcentration(c);
  const concBtn = document.getElementById('concentration-toggle');
  if (concBtn) {
    concBtn.classList.toggle('active', !!conc);
    concBtn.setAttribute('aria-pressed', String(!!conc));
    concBtn.textContent = conc ? 'Concentrating ✓' : 'Concentrate';
    concBtn.onclick = () => toggleConcentration(c);
  }

  const banner = document.getElementById('concentration-banner');
  if (banner) {
    banner.hidden = !conc;
    if (conc) banner.textContent =
      `${c.name} is concentrating — taking damage requires a CON save to maintain it.`;
  }

  // Exhaustion row
  const exRow = document.createElement('div');
  exRow.className = 'exhaustion-row';

  const exTitle = document.createElement('div');
  exTitle.className = 'exhaustion-title';
  exTitle.textContent = 'Exhaustion';
  exRow.appendChild(exTitle);

  const exBoxes = document.createElement('div');
  exBoxes.className = 'exhaustion-boxes';

  for (let i = 0; i < 6; i++) {
    const label = document.createElement('label');
    label.className = 'slot-toggle';
    label.title = `Exhaustion ${i + 1}`;

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'slot-checkbox';
    cb.checked = c.exhaustion > i;
    cb.setAttribute('aria-label', `Exhaustion level ${i + 1}`);
    cb.addEventListener('change', () => {
      if (c.locked) { cb.checked = c.exhaustion > i; return; }
      c.exhaustion = cb.checked
        ? Math.min(6, c.exhaustion + 1)
        : Math.max(0, c.exhaustion - 1);
      saveState();
      document.dispatchEvent(new CustomEvent('app:rerender'));
    });

    const box = document.createElement('span');
    box.className = 'slot-box';
    label.appendChild(cb);
    label.appendChild(box);
    exBoxes.appendChild(label);
  }

  exRow.appendChild(exBoxes);
  grid.appendChild(exRow);
}