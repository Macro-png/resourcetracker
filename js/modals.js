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
  _initLevelUpModal();
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
      maxHPReduction: 0,
      deathSaves: { success: 0, failure: 0 },
      spellSlots: buildSpellSlotsFromCasterInfo(full, half, pact),
      casterLevels: { full, half, pact },
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

  const fullIn  = () => document.getElementById('edit-character-form-fullcaster');
  const halfIn  = () => document.getElementById('edit-character-form-halfcaster');
  const pactIn  = () => document.getElementById('edit-character-form-pactlevel');

  const open = () => {
    const c = getSelectedCharacter(); if (!c) return;
    nameIn.value   = c.name;
    maxIn.value    = c.maxHP;
    fullIn().value = (c.casterLevels && c.casterLevels.full) || 0;
    halfIn().value = (c.casterLevels && c.casterLevels.half) || 0;
    pactIn().value = (c.casterLevels && c.casterLevels.pact) || 0;
    errEl.hidden = true; saveBtn.disabled = false;
    modal.hidden = false; nameIn.focus();
  };
  const close = () => { modal.hidden = true; };

  openBtn.addEventListener('click', open);
  cancel.addEventListener('click', close);
  modal.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  // Reset spell slots button — recalculates from the levels currently entered in the form
  document.getElementById('reset-spellslots-btn').addEventListener('click', () => {
    const c    = getSelectedCharacter(); if (!c) return;
    const full = Math.max(0, parseInt(fullIn().value, 10) || 0);
    const half = Math.max(0, parseInt(halfIn().value, 10) || 0);
    const pact = Math.max(0, parseInt(pactIn().value, 10) || 0);
    if (full + half + pact > 20) { errEl.textContent = 'Total caster level cannot exceed 20.'; errEl.hidden = false; return; }
    const newSlots = buildSpellSlotsFromCasterInfo(full, half, pact);
    newSlots.forEach(ns => {
      const existing = c.spellSlots.find(s => s.level === ns.level && !!s.pact === ns.pact);
      if (existing) { ns.id = existing.id; ns.used = Math.min(existing.used || 0, ns.max); }
    });
    c.spellSlots   = newSlots;
    c.casterLevels = { full, half, pact };
    saveState();
    showToast('Spell slots reset');
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = nameIn.value.trim();
    const max  = parseInt(maxIn.value, 10);
    const full = Math.max(0, parseInt(fullIn().value, 10) || 0);
    const half = Math.max(0, parseInt(halfIn().value, 10) || 0);
    const pact = Math.max(0, parseInt(pactIn().value, 10) || 0);

    if (!name) { errEl.textContent = 'Please enter a name.'; errEl.hidden = false; return; }
    if (!Number.isInteger(max) || max < 1) { errEl.textContent = 'Max HP must be a positive number.'; errEl.hidden = false; return; }
    if (full + half + pact > 20) { errEl.textContent = 'Total caster level cannot exceed 20.'; errEl.hidden = false; return; }

    const c = getSelectedCharacter(); if (!c) return;
    const hpDiff = max - c.maxHP;
    c.name         = name;
    c.maxHP        = max;
    c.casterLevels = { full, half, pact };

    // Recalculate spell slots, preserving used counts
    const newSlots = buildSpellSlotsFromCasterInfo(full, half, pact);
    newSlots.forEach(ns => {
      const existing = c.spellSlots.find(s => s.level === ns.level && !!s.pact === ns.pact);
      if (existing) { ns.id = existing.id; ns.used = Math.min(existing.used || 0, ns.max); }
    });
    c.spellSlots = newSlots;

    if (hpDiff > 0) c.currentHP = Math.min(c.maxHP, c.currentHP + hpDiff);
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

// ─── Level Up ─────────────────────────────────────────────────────────────────

function _initLevelUpModal() {
  const modal    = document.getElementById('levelup-modal');
  const form     = document.getElementById('levelup-form');
  const openBtn  = document.getElementById('levelup-btn');
  const cancel   = document.getElementById('levelup-cancel');
  const maxHPIn  = document.getElementById('levelup-maxhp');
  const casterIn = document.getElementById('levelup-caster');
  const errEl    = document.getElementById('levelup-form-error');

  const open = () => {
    const c = getSelectedCharacter(); if (!c) return;
    maxHPIn.value  = c.maxHP;
    casterIn.value = 'none';
    errEl.hidden   = true;
    modal.hidden   = false;
    maxHPIn.focus();
  };
  const close = () => { modal.hidden = true; };

  openBtn.addEventListener('click', open);
  cancel.addEventListener('click', close);
  modal.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  form.addEventListener('submit', e => {
    e.preventDefault();
    errEl.hidden = true;
    const c = getSelectedCharacter(); if (!c) return;

    const newMax = parseInt(maxHPIn.value, 10);
    if (!Number.isInteger(newMax) || newMax < 1) {
      errEl.textContent = 'Max HP must be a positive number.';
      errEl.hidden = false; return;
    }

    const hpGain  = newMax - c.maxHP;
    c.maxHP       = newMax;
    if (hpGain > 0) c.currentHP = Math.min(c.maxHP, c.currentHP + hpGain);
    c.currentHP   = Math.min(c.currentHP, c.maxHP);

    // Grant new spell slots based on caster type
    const casterType = casterIn.value;
    if (casterType !== 'none') {
      // Count existing levels of this type from current slots
      // We grant one level's worth of new slots as a diff
      _grantLevelUpSlots(c, casterType);
    }

    saveState();
    renderSession();
    close();
    showToast(`${c.name} levelled up!`);
  });
}

function _grantLevelUpSlots(c, casterType) {
  if (!c.casterLevels) c.casterLevels = { full: 0, half: 0, pact: 0 };

  const prev = { ...c.casterLevels };
  c.casterLevels[casterType] = (c.casterLevels[casterType] || 0) + 1;

  const total = c.casterLevels.full + c.casterLevels.half + c.casterLevels.pact;
  if (total > 20) { c.casterLevels[casterType]--; return; }

  const oldSlots = _computeSlots(prev.full, prev.half, prev.pact);
  const newSlots = _computeSlots(c.casterLevels.full, c.casterLevels.half, c.casterLevels.pact);

  // Pact slots REPLACE previous entry (level and count change each level)
  const oldPact = oldSlots.find(s => s.pact);
  const newPact = newSlots.find(s => s.pact);
  if (oldPact && newPact) {
    const existing = c.spellSlots.find(s => s.pact);
    if (existing) {
      existing.level = newPact.level;
      existing.max   = newPact.max;
      existing.used  = Math.min(existing.used || 0, newPact.max);
    }
  } else if (newPact && !oldPact) {
    c.spellSlots.push({ id: crypto.randomUUID(), level: newPact.level,
      max: newPact.max, used: 0, recoversOn: 'short', pact: true });
  }

  // Non-pact slots — add differences only
  newSlots.filter(s => !s.pact).forEach(ns => {
    const os     = oldSlots.find(s => s.level === ns.level && !s.pact);
    const diff   = ns.max - (os ? os.max : 0);
    if (diff <= 0) return;
    const existing = c.spellSlots.find(s => s.level === ns.level && !s.pact);
    if (existing) existing.max += diff;
    else c.spellSlots.push({ id: crypto.randomUUID(), level: ns.level,
      max: diff, used: 0, recoversOn: 'long', pact: false });
  });
}

function _computeSlots(full, half, pact) {
  full = Math.max(0, full || 0);
  half = Math.max(0, half || 0);
  pact = Math.max(0, pact || 0);

  const fullTable = {
    0:[0,0,0,0,0,0,0,0,0],
    1:[2,0,0,0,0,0,0,0,0],2:[3,0,0,0,0,0,0,0,0],3:[4,2,0,0,0,0,0,0,0],
    4:[4,3,0,0,0,0,0,0,0],5:[4,3,2,0,0,0,0,0,0],6:[4,3,3,0,0,0,0,0,0],
    7:[4,3,3,1,0,0,0,0,0],8:[4,3,3,2,0,0,0,0,0],9:[4,3,3,3,1,0,0,0,0],
    10:[4,3,3,3,2,0,0,0,0],11:[4,3,3,3,2,1,0,0,0],12:[4,3,3,3,2,1,0,0,0],
    13:[4,3,3,3,2,1,1,0,0],14:[4,3,3,3,2,1,1,0,0],15:[4,3,3,3,2,1,1,1,0],
    16:[4,3,3,3,2,1,1,1,0],17:[4,3,3,3,2,1,1,1,1],18:[4,3,3,3,3,1,1,1,1],
    19:[4,3,3,3,3,2,1,1,1],20:[4,3,3,3,3,2,2,1,1],
  };
  const halfTable = {
    0:[0,0,0,0,0,0,0,0,0],
    1:[0,0,0,0,0,0,0,0,0],2:[2,0,0,0,0,0,0,0,0],3:[3,0,0,0,0,0,0,0,0],
    4:[3,0,0,0,0,0,0,0,0],5:[4,2,0,0,0,0,0,0,0],6:[4,2,0,0,0,0,0,0,0],
    7:[4,3,0,0,0,0,0,0,0],8:[4,3,0,0,0,0,0,0,0],9:[4,3,2,0,0,0,0,0,0],
    10:[4,3,2,0,0,0,0,0,0],11:[4,3,3,0,0,0,0,0,0],12:[4,3,3,0,0,0,0,0,0],
    13:[4,3,3,1,0,0,0,0,0],14:[4,3,3,1,0,0,0,0,0],15:[4,3,3,2,0,0,0,0,0],
    16:[4,3,3,2,0,0,0,0,0],17:[4,3,3,3,1,0,0,0,0],18:[4,3,3,3,1,0,0,0,0],
    19:[4,3,3,3,2,0,0,0,0],20:[4,3,3,3,2,0,0,0,0],
  };

  const eff      = Math.min(20, Math.floor(full + 0.5 * half));
  const perLevel = (full === 0 && half > 0) ? halfTable[Math.min(20, half)] : fullTable[Math.min(20, eff)];
  const out      = [];
  perLevel.forEach((count, idx) => {
    if (count > 0) out.push({ level: idx + 1, max: count, pact: false });
  });

  if (pact > 0) {
    const slotLevel = Math.min(Math.ceil(pact / 2), 5);
    const slotCount = pact >= 17 ? 4 : pact >= 11 ? 3 : pact >= 2 ? 2 : 1;
    out.push({ level: slotLevel, max: slotCount, pact: true });
  }
  return out;
}