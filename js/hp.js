// ─── HP ───────────────────────────────────────────────────────────────────────
// Handles HP mutation (damage / heal), death saves, and the concentration
// check modal. Wires up the HP card and revive button event listeners via
// initHPControls(), called once from app.js.

import { saveState, getSelectedCharacter } from './state.js';
import { showToast }                        from './ui.js';
import {
  hasCondition,
  IMPLIED_CONDITIONS,
  STICKY_IMPLIED,
  getConcentration,
} from './conditions.js';

// ─── Core HP logic ───────────────────────────────────────────────────────────

export function applyDamage(amount) {
  const c = getSelectedCharacter();
  if (!c || amount <= 0) return;

  // Temp HP absorbs first
  if (c.tempHP > 0) {
    const absorbed = Math.min(c.tempHP, amount);
    c.tempHP -= absorbed;
    amount   -= absorbed;
  }

  if (amount <= 0) { saveState(); document.dispatchEvent(new CustomEvent('app:rerender')); return; }

  const hpBefore  = c.currentHP;
  c.currentHP     = Math.max(0, c.currentHP - amount);

  // Instant death (massive damage rule)
  if (c.currentHP === 0 && amount >= hpBefore + c.maxHP) {
    c.dead = true;
    c.deathSaves = { success: 0, failure: 0 };
    delete c.concentration;
    saveState();
    document.dispatchEvent(new CustomEvent('app:rerender'));
    showToast(`${c.name} died from massive damage!`);
    return;
  }

  // Dropped to 0 — apply Unconscious + implied conditions
  if (c.currentHP === 0) {
    delete c.concentration;
    if (!hasCondition(c, 'Unconscious')) {
      c.statuses.push({ id: crypto.randomUUID(), name: 'Unconscious', remaining: 0, durationType: 'rest' });
      ['Incapacitated', 'Prone'].forEach(imp => {
        const existing = c.statuses.find(s => s.name === imp);
        if (!existing) c.statuses.push({ id: crypto.randomUUID(), name: imp, remaining: 0, durationType: 'rest', implied: true });
        else existing.implied = true;
      });
    }
  }

  saveState();
  document.dispatchEvent(new CustomEvent('app:rerender'));

  // Prompt a concentration check if concentrating
  if (getConcentration(c)) {
    const dc = Math.max(10, Math.floor(amount / 2));
    document.getElementById('concentration-modal-text').textContent =
      `${c.name} must make a DC ${dc} CON save to maintain concentration.`;
    document.getElementById('concentration-modal').hidden = false;
  }
}

export function heal(amount) {
  const c = getSelectedCharacter();
  if (!c || amount <= 0) return;
  c.currentHP = Math.min(c.maxHP, c.currentHP + amount);

  // Remove Unconscious and its implied conditions when healed above 0
  if (c.currentHP > 0 && hasCondition(c, 'Unconscious')) {
    c.statuses = c.statuses.filter(s => s.name !== 'Unconscious');
    const stillImplied = new Set(c.statuses.flatMap(s => IMPLIED_CONDITIONS[s.name] || []));
    c.statuses.forEach(s => {
      if (s.implied && STICKY_IMPLIED.has(s.name) && !stillImplied.has(s.name)) s.implied = false;
    });
    c.statuses = c.statuses.filter(s =>
      !s.implied || stillImplied.has(s.name) || STICKY_IMPLIED.has(s.name)
    );
  }

  saveState();
  document.dispatchEvent(new CustomEvent('app:rerender'));
}

// ─── Death saves render ───────────────────────────────────────────────────────

export function renderDeathSaves(c) {
  const card = document.getElementById('death-saves-card');
  card.hidden = c.currentHP > 0;
  if (c.currentHP > 0) return;

  ['success', 'failure'].forEach(type => {
    const box = document.getElementById(`death-${type}-boxes`);
    box.innerHTML = '';

    for (let i = 0; i < 3; i++) {
      const label = document.createElement('label');
      label.className = 'slot-toggle';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'slot-checkbox';
      cb.checked = c.deathSaves[type] > i;
      cb.addEventListener('change', () => {
        c.deathSaves[type] = cb.checked
          ? Math.min(3, c.deathSaves[type] + 1)
          : Math.max(0, c.deathSaves[type] - 1);

        if (c.deathSaves.success >= 3) {
          c.currentHP = 1;
          c.deathSaves = { success: 0, failure: 0 };
          showToast(`${c.name} is stable!`);
        } else if (c.deathSaves.failure >= 3) {
          c.dead = true;
          c.deathSaves = { success: 0, failure: 0 };
        }
        saveState();
        document.dispatchEvent(new CustomEvent('app:rerender'));
      });

      const span = document.createElement('span');
      span.className = 'slot-box';
      label.appendChild(cb);
      label.appendChild(span);
      box.appendChild(label);
    }
  });
}

// ─── Event listener wiring ───────────────────────────────────────────────────

export function initHPControls() {
  const amountInput = document.getElementById('hp-update-amount');

  document.getElementById('hp-add').addEventListener('click', () => {
    const v = Math.max(0, parseInt(amountInput.value, 10) || 0);
    if (!v) return;
    heal(v);
    amountInput.value = '';
  });

  document.getElementById('hp-subtract').addEventListener('click', () => {
    const v = Math.max(0, parseInt(amountInput.value, 10) || 0);
    if (!v) return;
    applyDamage(v);
    amountInput.value = '';
  });

  const temp = document.getElementById('hp-temp-inline');
  temp.addEventListener('change', () => {
    const c = getSelectedCharacter();
    if (!c) return;
    c.tempHP = Math.max(0, parseInt(temp.value, 10) || 0);
    saveState();
    document.dispatchEvent(new CustomEvent('app:rerender'));
  });
  temp.addEventListener('keydown', e => { if (e.key === 'Enter') temp.blur(); });

  // Revive button (dead card)
  document.getElementById('revive-btn').addEventListener('click', () => {
    const c = getSelectedCharacter();
    if (!c) return;
    c.dead = false;
    c.currentHP  = 1;
    c.deathSaves = { success: 0, failure: 0 };
    c.statuses   = [];
    c.exhaustion = Math.min(5, (c.exhaustion || 0) + 1);
    saveState();
    document.dispatchEvent(new CustomEvent('app:rerender'));
    showToast(`${c.name} has been revived!`);
  });

  // Concentration check modal
  document.getElementById('concentration-modal-fail').addEventListener('click', () => {
    const c = getSelectedCharacter();
    if (c) { delete c.concentration; saveState(); document.dispatchEvent(new CustomEvent('app:rerender')); }
    document.getElementById('concentration-modal').hidden = true;
  });

  document.getElementById('concentration-modal-success').addEventListener('click', () => {
    document.getElementById('concentration-modal').hidden = true;
  });
}