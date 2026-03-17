// ─── Modals ───────────────────────────────────────────────────────────────────
// Wires up the four "add/edit" modals that live on both screens:
//   • Add Character
//   • Edit Character
//   • Add Resource
//   • Add Spell Slot
//
// Inventory-specific modals (items, components) live in inventory.js because
// they call renderInventory() directly and own no shared state.

import { state, saveState, getSelectedCharacter } from './state.js';
import { showToast }                               from './ui.js';
import { buildSpellSlotsFromCasterInfo }           from './spellslots.js';
import { renderCharacterList, renderSession }      from './session.js';

export function initModals() {
  _initCharacterModal();
  _initEditCharacterModal();
  _initResourceModal();
  _initSpellSlotModal();
}

// ─── Add Character ────────────────────────────────────────────────────────────

function _initCharacterModal() {
  const modal   = document.getElementById('character-modal');
  const form    = document.getElementById('character-form');
  const addBtn  = document.getElementById('add-character-btn');
  const cancel  = document.getElementById('character-cancel');
  const nameIn  = document.getElementById('character-form-name');
  const maxIn   = document.getElementById('character-form-maxhp');
  const saveBtn = document.getElementById('character-save');
  const errEl   = document.getElementById('character-form-error');

  const open  = () => { form.reset(); validate(); modal.hidden = false; nameIn.focus(); };
  const close = () => { modal.hidden = true; addBtn.focus(); };

  addBtn.addEventListener('click', open);
  cancel.addEventListener('click', close);
  modal.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  function fields() {
    return {
      name: nameIn.value.trim(),
      max:  parseInt(maxIn.value, 10),
      full: parseInt(document.getElementById('character-form-fullcaster').value, 10),
      half: parseInt(document.getElementById('character-form-halfcaster').value, 10),
      pact: parseInt(document.getElementById('character-form-pactlevel').value, 10),
    };
  }

  function validate() {
    errEl.hidden = true;
    const { name, max, full, half, pact } = fields();
    const fail = msg => { errEl.textContent = msg; errEl.hidden = false; saveBtn.disabled = true; return false; };
    if (!name)                                    return fail('Please enter a name.');
    if (!Number.isInteger(max)  || max  < 1)      return fail('Max HP must be a positive number.');
    if (!Number.isInteger(full) || full < 0 || full > 20) return fail('Full caster level must be 0–20.');
    if (!Number.isInteger(half) || half < 0 || half > 20) return fail('Half caster level must be 0–20.');
    if (!Number.isInteger(pact) || pact < 0 || pact > 20) return fail('Pact magic level must be 0–20.');
    if (full + half + pact > 20) return fail('Total level cannot exceed 20.');
    saveBtn.disabled = false;
    return true;
  }

  ['character-form-name', 'character-form-maxhp', 'character-form-fullcaster',
   'character-form-halfcaster', 'character-form-pactlevel'].forEach(id =>
    document.getElementById(id).addEventListener('input', validate)
  );
  validate();

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validate()) return;
    const { name, max, full, half, pact } = fields();

    const ch = {
      id: crypto.randomUUID(), name,
      maxHP: max, currentHP: max, tempHP: 0,
      deathSaves: { success: 0, failure: 0 },
      spellSlots: buildSpellSlotsFromCasterInfo(full, half, pact),
      resources: [], statuses: [], exhaustion: 0,
      hitDice: [],
      coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
      items: [], components: [],
    };

    state.characters.push(ch);
    saveState(); renderCharacterList(); close();

    setTimeout(() => {
      const li = document.querySelector(`[data-id="${ch.id}"]`);
      if (li) { li.scrollIntoView({ behavior: 'smooth', block: 'center' }); li.click(); }
    }, 50);

    showToast(`Added ${name}`);
  });
}

// ─── Edit Character ───────────────────────────────────────────────────────────

function _initEditCharacterModal() {
  const modal   = document.getElementById('edit-character-modal');
  const form    = document.getElementById('edit-character-form');
  const openBtn = document.getElementById('edit-character-btn');
  const cancel  = document.getElementById('edit-character-cancel');
  const nameIn  = document.getElementById('edit-character-form-name');
  const maxIn   = document.getElementById('edit-character-form-maxhp');
  const saveBtn = document.getElementById('edit-character-save');
  const errEl   = document.getElementById('edit-character-form-error');

  const open = () => {
    const c = getSelectedCharacter(); if (!c) return;
    nameIn.value = c.name; maxIn.value = c.maxHP;
    errEl.hidden = true; saveBtn.disabled = false;
    modal.hidden = false; nameIn.focus();
  };
  const close = () => { modal.hidden = true; };

  openBtn.addEventListener('click', open);
  cancel.addEventListener('click', close);
  modal.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = nameIn.value.trim();
    const max  = parseInt(maxIn.value, 10);
    if (!name) { errEl.textContent = 'Please enter a name.'; errEl.hidden = false; return; }
    if (!Number.isInteger(max) || max < 1) { errEl.textContent = 'Max HP must be a positive number.'; errEl.hidden = false; return; }

    const c = getSelectedCharacter(); if (!c) return;
    const hpDiff = max - c.maxHP;
    c.name  = name; c.maxHP = max;
    // Proportionally adjust current HP when max increases
    if (hpDiff > 0) c.currentHP = Math.min(max, c.currentHP + hpDiff);
    c.currentHP = Math.min(c.currentHP, c.maxHP);

    saveState(); renderSession(); close();
    showToast(`Updated ${name}`);
  });
}

// ─── Add Resource ─────────────────────────────────────────────────────────────

function _initResourceModal() {
  const modal   = document.getElementById('resource-modal');
  const form    = document.getElementById('resource-form');
  const openBtn = document.getElementById('add-resource-btn');
  const cancel  = document.getElementById('resource-cancel');
  const nameIn  = document.getElementById('resource-form-name');
  const maxIn   = document.getElementById('resource-form-max');
  const recIn   = document.getElementById('resource-form-recoversOn');
  const errEl   = document.getElementById('resource-form-error');

  const open  = () => { modal.hidden = false; nameIn.focus(); };
  const close = () => { modal.hidden = true; openBtn.focus(); };

  openBtn.addEventListener('click', open);
  cancel.addEventListener('click', close);
  modal.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  form.addEventListener('submit', e => {
    e.preventDefault(); errEl.hidden = true;
    const name = nameIn.value.trim();
    const max  = parseInt(maxIn.value, 10) || 1;
    const rec  = recIn.value || 'none';
    if (!name) { errEl.textContent = 'Please enter a name.'; errEl.hidden = false; return; }
    const c = getSelectedCharacter();
    if (!c) { errEl.textContent = 'No character selected.'; errEl.hidden = false; return; }
    c.resources.push({ id: crypto.randomUUID(), name, current: max, max, recoversOn: rec });
    saveState(); renderSession(); close(); form.reset();
    showToast(`Added resource '${name}'`);
  });
}

// ─── Add Spell Slot ───────────────────────────────────────────────────────────

function _initSpellSlotModal() {
  const modal   = document.getElementById('spellslot-modal');
  const form    = document.getElementById('spellslot-form');
  const openBtn = document.getElementById('add-spellslot-btn');
  const cancel  = document.getElementById('spellslot-cancel');
  const lvlIn   = document.getElementById('spellslot-form-level');
  const maxIn   = document.getElementById('spellslot-form-max');
  const recIn   = document.getElementById('spellslot-form-recoversOn');
  const errEl   = document.getElementById('spellslot-form-error');

  const open  = () => { modal.hidden = false; lvlIn.focus(); };
  const close = () => { modal.hidden = true; openBtn.focus(); };

  openBtn.addEventListener('click', open);
  cancel.addEventListener('click', close);
  modal.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  form.addEventListener('submit', e => {
    e.preventDefault(); errEl.hidden = true;
    const level = parseInt(lvlIn.value, 10) || 1;
    const max   = parseInt(maxIn.value, 10) || 0;
    const rec   = recIn.value || 'long';
    if (level < 1 || level > 9) { errEl.textContent = 'Level must be 1–9.'; errEl.hidden = false; return; }
    const c = getSelectedCharacter();
    if (!c) { errEl.textContent = 'No character selected.'; errEl.hidden = false; return; }
    c.spellSlots.push({ id: crypto.randomUUID(), level, max, used: 0, recoversOn: rec, pact: rec === 'short' });
    saveState(); renderSession(); close(); form.reset();
    showToast(`Added level ${level} spell slots`);
  });
}