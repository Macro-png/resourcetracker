// ─── Session ──────────────────────────────────────────────────────────────────
// Owns the session screen: tab switching, renderSession, renderCharacterList,
// rest logic, edit mode toggle, and back navigation.
//
// Uses a custom 'app:rerender' DOM event so sub-modules (resources, spellslots,
// conditions, hitdice) can trigger a full re-render without importing session.js
// (which would create circular dependencies).

import { state, saveState, getSelectedCharacter } from './state.js';
import { editMode, setEditMode, showToast }       from './ui.js';
import { renderDeathSaves, effectiveMaxHP }                from './hp.js';
import { renderSpellSlots }                        from './spellslots.js';
import { renderResources }                         from './resources.js';
import { renderStatuses }                          from './conditions.js';
import { renderHitDice, mergeHitDicePools, HD_SIZES, promptHitDiceUse } from './hitdice.js';
import { renderInventory }                         from './inventory.js';

// ─── Lock UI ──────────────────────────────────────────────────────────────────

export function applyLockUI() { _applyLockUI(); }

function _applyLockUI() {
  const c      = getSelectedCharacter();
  const locked = c ? !!c.locked : false;
  const btn    = document.getElementById('lock-btn');
  if (btn) {
    btn.textContent  = locked ? '🔒︎' : '🔓︎';
    btn.title        = locked ? 'Locked — tap to unlock' : 'Tap to lock character';
    btn.style.color  = locked ? '#f97316' : '';
  }
}

// ─── Screen switching ─────────────────────────────────────────────────────────

export function showCharacterList() {
  document.getElementById('session-screen').hidden        = true;
  document.getElementById('character-list-screen').hidden = false;
  document.getElementById('app-header').hidden            = false;
}

export function showSession() {
  document.getElementById('character-list-screen').hidden = true;
  document.getElementById('session-screen').hidden        = false;
  document.getElementById('app-header').hidden            = true;
  switchTab('stats');
}

export function switchTab(tab) {
  const isStats = tab === 'stats';
  document.getElementById('stats-panel').hidden   = !isStats;
  document.getElementById('inventory-panel').hidden = isStats;
  document.getElementById('tab-stats').classList.toggle('active', isStats);
  document.getElementById('tab-inventory').classList.toggle('active', !isStats);

  const c = getSelectedCharacter();
  if (!c) return;

  if (isStats) {
    document.getElementById('add-spellslot-btn').hidden  = !editMode;
    document.getElementById('add-resource-btn').hidden   = !editMode;
    document.getElementById('add-hitdice-btn').hidden    = !editMode;
    document.getElementById('edit-character-btn').hidden = !editMode;
    document.getElementById('levelup-btn').hidden        = !editMode;
  } else {
    renderInventory(c);
  }
}

// ─── Character list ───────────────────────────────────────────────────────────

export function renderCharacterList() {
  const list = document.getElementById('character-list');
  list.innerHTML = '';

  if (!state.characters || state.characters.length === 0) {
    const p = document.createElement('div');
    p.className = 'card';
    p.innerHTML = `<p style="color:#cbd5e1;margin:0">No characters yet — tap <strong>+ Add Character</strong> to create one.</p>`;
    list.appendChild(p);
    return;
  }

  state.characters.forEach(character => {
    const li = document.createElement('li');
    li.dataset.id = character.id;
    li.tabIndex = 0;
    li.setAttribute('role', 'button');

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = (character.name || '')
      .split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

    const nameSpan = document.createElement('span');
    nameSpan.textContent = character.name;
    nameSpan.style.flex = '1';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.setAttribute('aria-label', `Delete ${character.name}`);
    deleteBtn.textContent = '✕';
    deleteBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (!confirm(`Delete "${character.name}"?\nThis cannot be undone.`)) return;
      state.characters = state.characters.filter(c => c.id !== character.id);
      if (state.selectedCharacterId === character.id) state.selectedCharacterId = null;
      saveState(); renderCharacterList();
    });

    li.addEventListener('click', () => {
      state.selectedCharacterId = character.id;
      setEditMode(false);
      document.getElementById('edit-btn').textContent = '✎';
      saveState(); renderSession(); showSession();
      li.classList.add('highlight');
      setTimeout(() => li.classList.remove('highlight'), 600);
    });

    li.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.click(); }
    });

    li.appendChild(avatar); li.appendChild(nameSpan); li.appendChild(deleteBtn);
    list.appendChild(li);
  });
}

// ─── Session render ───────────────────────────────────────────────────────────

export function renderSession() {
  const c = getSelectedCharacter();
  if (!c) return;

  // Reset visibility
  ['hp-card', 'spellslots-section', 'resources-section',
   'conditions-section', 'rest-section', 'hitdice-section'].forEach(id => {
    document.getElementById(id).hidden = false;
  });
  document.getElementById('dead-card').hidden              = true;
  document.getElementById('death-saves-card').hidden       = true;
  document.getElementById('concentration-banner').hidden   = true;
  document.getElementById('concentration-toggle').hidden   = false;

  document.getElementById('character-name').textContent = c.name;
  document.getElementById('hp-current').textContent     = c.currentHP;

  const effMax = effectiveMaxHP(c);
  const hpMaxEl = document.getElementById('hp-max');
  hpMaxEl.textContent = effMax;
  hpMaxEl.style.color = (c.maxHPReduction || 0) > 0 ? '#7cad1e' : '';

  const tempEl = document.getElementById('hp-temp-inline');
  if (tempEl) tempEl.value = c.tempHP > 0 ? c.tempHP : '';

  const fill      = document.getElementById('hp-bar-fill');
  const fillLost  = document.getElementById('hp-bar-lost');
  const reduction = c.maxHPReduction || 0;

  if (fill && fillLost) {
    const filledPct = c.maxHP > 0 ? Math.max(0, Math.min(100, Math.round(c.currentHP / c.maxHP * 100))) : 0;
    const lostPct   = c.maxHP > 0 ? Math.round(reduction / c.maxHP * 100) : 0;
    fill.style.width          = filledPct + '%';
    fillLost.style.width      = lostPct + '%';
    fillLost.style.display    = lostPct > 0 ? 'block' : 'none';
    fillLost.style.marginLeft = lostPct > 0 ? 'auto' : '0';
  }

  // Dead state — hide everything except the dead card
  if (c.dead) {
    ['hp-card', 'spellslots-section', 'resources-section',
     'conditions-section', 'rest-section', 'death-saves-card', 'hitdice-section'].forEach(id => {
      document.getElementById(id).hidden = true;
    });
    document.getElementById('concentration-toggle').hidden = true;
    document.getElementById('dead-card').hidden            = false;
    document.getElementById('dead-name').textContent       = `${c.name} has fallen`;
    return;
  }

  // At 0 HP — hide spell slots and resources, show death saves
  if (c.currentHP === 0) {
    document.getElementById('spellslots-section').hidden = true;
    document.getElementById('resources-section').hidden  = true;
  }

  renderDeathSaves(c);
  renderHitDice(c);
  renderSpellSlots(c);
  renderResources(c);
  renderStatuses(c);

  // Sync max HP reduction into edit modal input
  const reductionInput = document.getElementById('hp-max-reduction');
  if (reductionInput) reductionInput.value = c.maxHPReduction > 0 ? c.maxHPReduction : '';

  const locked = !!(c.locked);

  // In locked mode force edit mode off
  if (locked && editMode) { setEditMode(false); }

  // Update lock button appearance
  _applyLockUI();

  // Sync edit mode and locked classes
  document.getElementById('session-screen').classList.toggle('edit-mode', editMode);
  document.getElementById('session-screen').classList.toggle('character-locked', locked);
  document.getElementById('add-spellslot-btn').hidden  = !editMode;
  document.getElementById('add-resource-btn').hidden   = !editMode;
  document.getElementById('add-hitdice-btn').hidden    = !editMode;
  document.getElementById('edit-character-btn').hidden = !editMode;
  document.getElementById('levelup-btn').hidden        = !editMode;

  // Lock/unlock interactive HP controls
  const lockableIds = ['hp-add','hp-subtract','hp-update-amount','hp-temp-inline',
                       'hp-max-reduction','short-rest','long-rest','revive-btn',
                       'concentration-toggle','edit-btn'];
  lockableIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = locked;
  });
  document.getElementById('edit-btn').style.opacity = locked ? '0.35' : '';
}

// ─── Rest helpers ─────────────────────────────────────────────────────────────

function flashBar() {
  const fill = document.getElementById('hp-bar-fill');
  if (!fill) return;
  fill.classList.add('hp-bar-flash');
  setTimeout(() => fill.classList.remove('hp-bar-flash'), 900);
}

function shortRest() {
  const c = getSelectedCharacter(); if (!c) return;
  c.resources.forEach(r => { if (r.recoversOn === 'short') r.current = r.max; });
  c.spellSlots.forEach(s => { if (s.recoversOn === 'short') s.used = 0; });
  saveState();

  const hasAvailable = (c.hitDice || []).some(hd => hd.spent < hd.total);
  if (hasAvailable) {
    promptHitDiceUse(c, healed => {
      if (healed > 0) {
        c.currentHP = Math.min(effectiveMaxHP(c), c.currentHP + healed);
        saveState();
        showToast(`Short rest — healed +${healed} HP`);
      } else {
        showToast('Short rest taken');
      }
      renderSession();
      flashBar();
    });
  } else {
    renderSession();
    showToast('Short rest taken');
    flashBar();
  }
}

function longRest() {
  const c = getSelectedCharacter(); if (!c) return;
  c.resources.forEach(r => { if (r.recoversOn !== 'none') r.current = r.max; });
  c.spellSlots.forEach(s => { s.used = 0; });

  if (c.hitDice && c.hitDice.length) {
    mergeHitDicePools(c);
    const totalHD  = c.hitDice.reduce((sum, hd) => sum + hd.total, 0);
    let toRecover  = Math.max(1, Math.floor(totalHD / 2));
    // Recover from largest dice first
    for (const size of HD_SIZES) {
      const hd = c.hitDice.find(x => x.dieType === size);
      if (!hd || toRecover <= 0) continue;
      const r = Math.min(hd.spent, toRecover); hd.spent -= r; toRecover -= r;
    }
    // Any leftover goes to remaining pools
    for (const hd of c.hitDice) {
      if (toRecover <= 0) break;
      const r = Math.min(hd.spent, toRecover); hd.spent -= r; toRecover -= r;
    }
  }

  c.currentHP      = effectiveMaxHP(c);
  c.tempHP         = 0;
  c.maxHPReduction = 0;
  c.exhaustion     = Math.max(0, (c.exhaustion || 0) - 1);
  c.deathSaves     = { success: 0, failure: 0 };
  saveState(); renderSession();
}

// ─── Event listener wiring ───────────────────────────────────────────────────

export function initSessionControls() {
  // Global re-render listener (fired by sub-modules after state changes)
  document.addEventListener('app:rerender', () => renderSession());

  // Tabs
  document.getElementById('tab-stats').addEventListener('click',     () => switchTab('stats'));
  document.getElementById('tab-inventory').addEventListener('click', () => switchTab('inventory'));

  // Lock button — per character
  document.getElementById('lock-btn').addEventListener('click', () => {
    const c = getSelectedCharacter(); if (!c) return;
    c.locked = !c.locked;
    if (c.locked && editMode) {
      setEditMode(false);
      document.getElementById('edit-btn').textContent = '✎';
      document.getElementById('session-screen').classList.remove('edit-mode');
    }
    saveState();
    renderSession();
  });

  // Back
  document.getElementById('back-btn').addEventListener('click', () => {
    setEditMode(false);
    document.getElementById('edit-btn').textContent = '✎';
    document.getElementById('session-screen').classList.remove('edit-mode');
    _closeSwiped();
    state.selectedCharacterId = null;
    saveState(); showCharacterList(); renderCharacterList();
  });

  // Edit toggle
  document.getElementById('edit-btn').addEventListener('click', () => {
    const c = getSelectedCharacter();
    if (c && c.locked) return;
    setEditMode(!editMode);
    document.getElementById('edit-btn').textContent = editMode ? '✓' : '✎';
    document.getElementById('session-screen').classList.toggle('edit-mode', editMode);
    document.getElementById('add-spellslot-btn').hidden  = !editMode;
    document.getElementById('add-resource-btn').hidden   = !editMode;
    document.getElementById('add-hitdice-btn').hidden    = !editMode;
    document.getElementById('edit-character-btn').hidden = !editMode;
    document.getElementById('levelup-btn').hidden        = !editMode;
    if (c) renderInventory(c);
    if (!editMode) _closeSwiped();
  });

  // Rests
  document.getElementById('short-rest').addEventListener('click', () => {
    const c = getSelectedCharacter(); if (c && c.locked) return;
    if (!confirm('Take a short rest?')) return;
    shortRest();
  });

  document.getElementById('long-rest').addEventListener('click', () => {
    const c = getSelectedCharacter(); if (c && c.locked) return;
    if (!confirm('Take a long rest? This will restore HP and all resources.')) return;
    longRest(); showToast('Long rest taken — HP and resources restored'); flashBar();
  });
}

function _closeSwiped() {
  document.querySelectorAll('.swipe-item.swiped').forEach(el => {
    el.classList.remove('swiped');
    const content = el.querySelector('.swipe-content');
    if (content) { content.style.transition = 'transform 0.2s ease'; content.style.transform = ''; }
  });
} 