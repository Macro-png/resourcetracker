// ─── Spell Slots ──────────────────────────────────────────────────────────────
// Renders the spell slot section and owns all caster-level math
// (full caster, half caster, pact magic multiclass merging).

import { saveState }               from './state.js';
import { editMode, makeSwipeable } from './ui.js';

// ─── Slot tables ─────────────────────────────────────────────────────────────

export function computeSlotsForEffectiveLevel(eff) {
  eff = Math.max(0, Math.floor(eff || 0));
  if (eff < 1) return [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const table = {
    1:  [2,0,0,0,0,0,0,0,0], 2:  [3,0,0,0,0,0,0,0,0], 3:  [4,2,0,0,0,0,0,0,0],
    4:  [4,3,0,0,0,0,0,0,0], 5:  [4,3,2,0,0,0,0,0,0], 6:  [4,3,3,0,0,0,0,0,0],
    7:  [4,3,3,1,0,0,0,0,0], 8:  [4,3,3,2,0,0,0,0,0], 9:  [4,3,3,3,1,0,0,0,0],
    10: [4,3,3,3,2,0,0,0,0], 11: [4,3,3,3,2,1,0,0,0], 12: [4,3,3,3,2,1,0,0,0],
    13: [4,3,3,3,2,1,1,0,0], 14: [4,3,3,3,2,1,1,0,0], 15: [4,3,3,3,2,1,1,1,0],
    16: [4,3,3,3,2,1,1,1,0], 17: [4,3,3,3,2,1,1,1,1], 18: [4,3,3,3,3,1,1,1,1],
    19: [4,3,3,3,3,2,1,1,1], 20: [4,3,3,3,3,2,2,1,1],
  };
  return (table[Math.max(1, Math.min(20, eff))] || new Array(9).fill(0)).slice();
}

export function computeHalfCasterSlots(level) {
  const map = {
    1:  [0,0,0,0,0,0,0,0,0], 2:  [2,0,0,0,0,0,0,0,0], 3:  [3,0,0,0,0,0,0,0,0],
    4:  [3,0,0,0,0,0,0,0,0], 5:  [4,2,0,0,0,0,0,0,0], 6:  [4,2,0,0,0,0,0,0,0],
    7:  [4,3,0,0,0,0,0,0,0], 8:  [4,3,0,0,0,0,0,0,0], 9:  [4,3,2,0,0,0,0,0,0],
    10: [4,3,2,0,0,0,0,0,0], 11: [4,3,3,0,0,0,0,0,0], 12: [4,3,3,0,0,0,0,0,0],
    13: [4,3,3,1,0,0,0,0,0], 14: [4,3,3,1,0,0,0,0,0], 15: [4,3,3,2,0,0,0,0,0],
    16: [4,3,3,2,0,0,0,0,0], 17: [4,3,3,3,1,0,0,0,0], 18: [4,3,3,3,1,0,0,0,0],
    19: [4,3,3,3,2,0,0,0,0], 20: [4,3,3,3,2,0,0,0,0],
  };
  return map[Math.max(1, Math.min(20, level))] || [];
}

export function buildSpellSlotsFromCasterInfo(full, half, pact) {
  full = Math.max(0, parseInt(full || 0, 10));
  half = Math.max(0, parseInt(half || 0, 10));
  pact = Math.max(0, parseInt(pact || 0, 10));

  // Clamp to level 20 total
  const total = full + half + pact;
  if (total > 20) {
    let over = total - 20;
    if (pact >= over) { pact -= over; over = 0; }
    else              { over -= pact; pact = 0; }
    if (over > 0) half = Math.max(0, half - over);
  }

  const out = [];

  // Full/half caster slots
  if (full > 0 || half > 0) {
    const slotsPerLevel = (full === 0 && half > 0)
      ? computeHalfCasterSlots(half)
      : computeSlotsForEffectiveLevel(Math.floor(full + 0.5 * half));

    slotsPerLevel.forEach((count, idx) => {
      if (count > 0)
        out.push({ id: crypto.randomUUID(), level: idx + 1, max: count, used: 0, recoversOn: 'long', pact: false });
    });
  }

  // Pact magic — one slot entry that replaces itself each level:
  // slot level = ceil(pact/2) capped at 5
  // slot count: 1 at lvl1, 2 at lvl2-10, 3 at lvl11-16, 4 at lvl17+
  if (pact > 0) {
    const slotLevel = Math.min(Math.ceil(pact / 2), 5);
    const slotCount = pact >= 17 ? 4 : pact >= 11 ? 3 : pact >= 2 ? 2 : 1;
    out.push({
      id: crypto.randomUUID(),
      level: slotLevel,
      max: slotCount,
      used: 0,
      recoversOn: 'short',
      pact: true,
    });
  }

  // Merge duplicate non-pact levels (multiclass edge cases)
  const merged = {};
  out.forEach(s => {
    const key = `${s.level}-${s.recoversOn}-${s.pact ? 'p' : 'c'}`;
    if (!merged[key]) merged[key] = { ...s };
    else merged[key].max += s.max;
  });

  return Object.values(merged).sort((a, b) => {
    if (a.pact && !b.pact) return -1;
    if (!a.pact && b.pact) return 1;
    return a.level - b.level;
  });
}

// ─── Render ──────────────────────────────────────────────────────────────────

export function renderSpellSlots(c) {
  const container = document.getElementById('spellslots-container');
  const template  = document.getElementById('spellslot-template');
  container.innerHTML = '';

  if (!c.spellSlots || c.spellSlots.length === 0) {
    const msg = document.createElement('p');
    msg.className = 'empty-state';
    msg.textContent = 'No spell slots — tap ✎ then + Add Spell Slots';
    container.appendChild(msg);
    return;
  }

  // Keep pact flag in sync with recoversOn
  if (Array.isArray(c.spellSlots)) {
    let changed = false;
    c.spellSlots.forEach(s => {
      const should = s.recoversOn === 'short';
      if (!!s.pact !== should) { s.pact = should; changed = true; }
    });
    if (changed) saveState();
  }

  const slots = (c.spellSlots || []).slice().sort((a, b) => {
    if (a.pact && !b.pact) return -1;
    if (!a.pact && b.pact) return 1;
    return a.level - b.level;
  });

  slots.forEach(s => {
    const el = template.content.firstElementChild.cloneNode(true);
    el.classList.toggle('pact-slot', !!s.pact);

    const labelEl = el.querySelector('[data-key="level"]');
    labelEl.textContent = `Level ${s.level}`;
    if (s.pact) {
      const badge = document.createElement('span');
      badge.className = 'pact-badge';
      badge.textContent = 'Pact';
      labelEl.appendChild(badge);
    }

    const controls = el.querySelector('[data-key="controls"]');
    controls.innerHTML = '';

    // One checkbox per slot
    for (let i = 0; i < s.max; i++) {
      const label = document.createElement('label');
      label.className = 'slot-toggle';
      const title = `${s.pact ? 'Pact ' : ''}Slot ${i + 1} of level ${s.level}`;
      label.title = title;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'slot-checkbox';
      cb.checked = (s.used || 0) > i;
      cb.setAttribute('aria-label', title);
      cb.addEventListener('change', () => {
        if (c.locked) { cb.checked = (s.used || 0) > i; return; }
        if (editMode) {
          if (s.max > 0) {
            s.max--;
            s.used = Math.min(s.used || 0, s.max);
            if (s.max === 0) c.spellSlots = c.spellSlots.filter(x => x.id !== s.id);
          }
        } else {
          s.used = cb.checked
            ? Math.min(s.max, (s.used || 0) + 1)
            : Math.max(0, (s.used || 0) - 1);
        }
        saveState();
        document.dispatchEvent(new CustomEvent('app:rerender'));
      });

      const box = document.createElement('span');
      box.className = 'slot-box';
      label.appendChild(cb);
      label.appendChild(box);
      controls.appendChild(label);
    }

    // + add box (edit mode only, respects max cap)
    const maxAllowed = s.pact ? 2 : 4;
    if (s.max < maxAllowed) {
      const addLabel = document.createElement('label');
      addLabel.className = 'slot-toggle slot-add-toggle';
      addLabel.title = `Add a ${s.pact ? 'pact ' : ''}slot`;
      const addBox = document.createElement('span');
      addBox.className = 'slot-box slot-add-box';
      addBox.textContent = '+';
      addLabel.appendChild(addBox);
      addLabel.addEventListener('click', () => {
        if (!editMode) return;
        s.max++;
        saveState();
        document.dispatchEvent(new CustomEvent('app:rerender'));
      });
      controls.appendChild(addLabel);
    }

    makeSwipeable(el, () => {
      c.spellSlots = c.spellSlots.filter(x => x.id !== s.id);
      saveState();
      document.dispatchEvent(new CustomEvent('app:rerender'));
    });

    container.appendChild(el);
  });
}