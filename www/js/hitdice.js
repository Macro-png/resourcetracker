// ─── Hit Dice ─────────────────────────────────────────────────────────────────
// Renders hit dice pools, manages the heal-after-use modal, and wires up
// the "Add Pool" modal. Imports heal() from hp.js (no circular dep:
// hp.js does not import from hitdice.js).

import { saveState, getSelectedCharacter } from './state.js';
import { editMode, showToast, makeSwipeable } from './ui.js';
import { heal } from './hp.js';

export const HD_SIZES = ['d12', 'd10', 'd8', 'd6']; // largest first for recovery priority

export function hdTotalAll(c) {
  return (c.hitDice || []).reduce((sum, hd) => sum + hd.total, 0);
}

// Collapse duplicate die-type pools into one row (can accumulate via Add Pool)
export function mergeHitDicePools(c) {
  if (!c.hitDice) return;
  const merged = {};
  c.hitDice.forEach(hd => {
    if (!merged[hd.dieType]) merged[hd.dieType] = { id: hd.id, dieType: hd.dieType, total: 0, spent: 0 };
    merged[hd.dieType].total += hd.total;
    merged[hd.dieType].spent += hd.spent;
  });
  c.hitDice = HD_SIZES
    .map(d => merged[d])
    .filter(Boolean)
    .concat(Object.values(merged).filter(hd => !HD_SIZES.includes(hd.dieType)));
}

// ─── Render ──────────────────────────────────────────────────────────────────

export function renderHitDice(c) {
  if (!c.hitDice) c.hitDice = [];
  mergeHitDicePools(c);

  const container = document.getElementById('hitdice-container');
  container.innerHTML = '';

  c.hitDice.forEach(hd => {
    const el = document.createElement('div');
    el.className = 'spellslot-item card small';

    const slotRow = document.createElement('div');
    slotRow.className = 'slot-row';

    // Left: die-type label
    const slotLeft = document.createElement('div');
    slotLeft.className = 'slot-left';
    const labelEl = document.createElement('div');
    labelEl.className = 'spellslot-label';
    labelEl.textContent = hd.dieType;
    slotLeft.appendChild(labelEl);
    slotRow.appendChild(slotLeft);

    // Center: one checkbox per die (checked = spent, fills from left)
    const slotCenter = document.createElement('div');
    slotCenter.className = 'slot-center';
    const controls = document.createElement('div');
    controls.className = 'spellslot-controls hitdice-controls';

    for (let i = 0; i < hd.total; i++) {
      const lbl = document.createElement('label');
      lbl.className = 'slot-toggle';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'slot-checkbox';
      cb.checked = i < hd.spent;
      cb.setAttribute('aria-label', `${hd.dieType} die ${i + 1}`);

      cb.addEventListener('change', () => {
        if (editMode) {
          // Tapping a box in edit mode removes one die from the pool
          hd.total--;
          hd.spent = Math.min(hd.spent, hd.total);
          if (hd.total === 0) c.hitDice = c.hitDice.filter(x => x.id !== hd.id);
          saveState();
          document.dispatchEvent(new CustomEvent('app:rerender'));
        } else {
          if (cb.checked) {
            hd.spent = i + 1; // fill left up to this box
            saveState();
            document.dispatchEvent(new CustomEvent('app:rerender'));
            openHitDiceHealModal(c, hd);
          } else {
            hd.spent = i; // uncheck from here rightward
            saveState();
            document.dispatchEvent(new CustomEvent('app:rerender'));
          }
        }
      });

      const box = document.createElement('span');
      box.className = 'slot-box hitdice-box';
      lbl.appendChild(cb);
      lbl.appendChild(box);
      controls.appendChild(lbl);
    }

    // + add box (edit mode, max 20 total)
    if (hd.total < 20 && hdTotalAll(c) < 20) {
      const addLbl = document.createElement('label');
      addLbl.className = 'slot-toggle slot-add-toggle';
      const addBox = document.createElement('span');
      addBox.className = 'slot-box hitdice-box slot-add-box';
      addBox.textContent = '+';
      addLbl.appendChild(addBox);
      addLbl.addEventListener('click', () => {
        if (!editMode) return;
        if (hdTotalAll(c) >= 20) return;
        hd.total++;
        saveState();
        document.dispatchEvent(new CustomEvent('app:rerender'));
      });
      controls.appendChild(addLbl);
    }

    slotCenter.appendChild(controls);
    slotRow.appendChild(slotCenter);
    el.appendChild(slotRow);

    makeSwipeable(el, () => {
      c.hitDice = c.hitDice.filter(x => x.id !== hd.id);
      saveState();
      document.dispatchEvent(new CustomEvent('app:rerender'));
    });

    container.appendChild(el);
  });
}

// ─── Heal modal ───────────────────────────────────────────────────────────────

let _hdHealChar = null;

function openHitDiceHealModal(c, hd) {
  _hdHealChar = c;
  document.getElementById('hitdice-heal-title').textContent = `Use ${hd.dieType}`;
  document.getElementById('hitdice-heal-amount').value = '';
  document.getElementById('hitdice-heal-modal').hidden = false;
  setTimeout(() => document.getElementById('hitdice-heal-amount').focus(), 50);
}

// ─── Event listener wiring ───────────────────────────────────────────────────

export function initHitDiceControls() {
  // Heal modal
  document.getElementById('hitdice-heal-confirm').addEventListener('click', () => {
    const v = parseInt(document.getElementById('hitdice-heal-amount').value, 10) || 0;
    if (v > 0 && _hdHealChar) heal(v);
    document.getElementById('hitdice-heal-modal').hidden = true;
    if (v > 0) showToast(`Healed +${v} HP`);
  });

  document.getElementById('hitdice-heal-skip').addEventListener('click', () => {
    document.getElementById('hitdice-heal-modal').hidden = true;
  });

  document.getElementById('hitdice-heal-modal').addEventListener('keydown', e => {
    if (e.key === 'Escape') document.getElementById('hitdice-heal-modal').hidden = true;
    if (e.key === 'Enter')  document.getElementById('hitdice-heal-confirm').click();
  });

  // Add pool modal
  const modal   = document.getElementById('hitdice-modal');
  const form    = document.getElementById('hitdice-form');
  const openBtn = document.getElementById('add-hitdice-btn');
  const cancel  = document.getElementById('hitdice-cancel');
  const typeIn  = document.getElementById('hitdice-form-type');
  const totalIn = document.getElementById('hitdice-form-total');
  const errEl   = document.getElementById('hitdice-form-error');

  const open  = () => { form.reset(); typeIn.value = 'd8'; totalIn.value = 1; errEl.hidden = true; modal.hidden = false; totalIn.focus(); };
  const close = () => { modal.hidden = true; };

  openBtn.addEventListener('click', open);
  cancel.addEventListener('click', close);
  modal.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  form.addEventListener('submit', e => {
    e.preventDefault();
    errEl.hidden = true;
    const total = parseInt(totalIn.value, 10) || 0;
    const c = getSelectedCharacter();
    if (!c) return;
    if (!c.hitDice) c.hitDice = [];

    const remaining = 20 - hdTotalAll(c);
    if (total < 1)         { errEl.textContent = 'Enter at least 1.'; errEl.hidden = false; return; }
    if (total > remaining) { errEl.textContent = `Only ${remaining} dice slots left (max 20 total).`; errEl.hidden = false; return; }

    // Stack with existing pool of same type rather than creating a duplicate
    const existing = c.hitDice.find(hd => hd.dieType === typeIn.value);
    if (existing) existing.total += total;
    else c.hitDice.push({ id: crypto.randomUUID(), dieType: typeIn.value, total, spent: 0 });

    saveState();
    document.dispatchEvent(new CustomEvent('app:rerender'));
    close();
    showToast(`Added ${total}${typeIn.value} hit dice`);
  });
}