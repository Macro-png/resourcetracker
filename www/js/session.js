// ─── Session ──────────────────────────────────────────────────────────────────
// Owns the session screen: tab switching, renderSession, renderCharacterList,
// rest logic, edit mode toggle, and back navigation.
//
// Uses a custom 'app:rerender' DOM event so sub-modules (resources, spellslots,
// conditions, hitdice) can trigger a full re-render without importing session.js
// (which would create circular dependencies).

import { state, saveState, getSelectedCharacter } from './state.js';
import { editMode, setEditMode, showToast }       from './ui.js';
import { renderDeathSaves }                        from './hp.js';
import { renderSpellSlots }                        from './spellslots.js';
import { renderResources }                         from './resources.js';
import { renderStatuses }                          from './conditions.js';
import { renderHitDice, mergeHitDicePools, HD_SIZES } from './hitdice.js';
import { renderInventory }                         from './inventory.js';

// ─── Screen switching ────────────────────────────────────────────────────────

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
  document.getElementById('hp-max').textContent         = c.maxHP;

  const tempEl = document.getElementById('hp-temp-inline');
  if (tempEl) tempEl.value = c.tempHP > 0 ? c.tempHP : '';

  const fill = document.getElementById('hp-bar-fill');
  if (fill) {
    const pct = c.maxHP > 0 ? Math.max(0, Math.min(100, Math.round(c.currentHP / c.maxHP * 100))) : 0;
    fill.style.width = pct + '%';
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

  // Sync edit mode UI
  document.getElementById('session-screen').classList.toggle('edit-mode', editMode);
  document.getElementById('add-spellslot-btn').hidden  = !editMode;
  document.getElementById('add-resource-btn').hidden   = !editMode;
  document.getElementById('add-hitdice-btn').hidden    = !editMode;
  document.getElementById('edit-character-btn').hidden = !editMode;
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
  saveState(); renderSession();
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

  c.currentHP  = c.maxHP;
  c.tempHP     = 0;
  c.exhaustion = Math.max(0, (c.exhaustion || 0) - 1);
  c.deathSaves = { success: 0, failure: 0 };
  saveState(); renderSession();
}

// ─── Event listener wiring ───────────────────────────────────────────────────

export function initSessionControls() {
  // Global re-render listener (fired by sub-modules after state changes)
  document.addEventListener('app:rerender', () => renderSession());

  // Tabs
  document.getElementById('tab-stats').addEventListener('click',     () => switchTab('stats'));
  document.getElementById('tab-inventory').addEventListener('click', () => switchTab('inventory'));

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
    setEditMode(!editMode);
    document.getElementById('edit-btn').textContent = editMode ? '✓' : '✎';
    document.getElementById('session-screen').classList.toggle('edit-mode', editMode);
    document.getElementById('add-spellslot-btn').hidden  = !editMode;
    document.getElementById('add-resource-btn').hidden   = !editMode;
    document.getElementById('add-hitdice-btn').hidden    = !editMode;
    document.getElementById('edit-character-btn').hidden = !editMode;
    const c = getSelectedCharacter(); if (c) renderInventory(c);
    if (!editMode) _closeSwiped();
  });

  // Rests
  document.getElementById('short-rest').addEventListener('click', () => {
    if (!confirm('Take a short rest?')) return;
    shortRest(); showToast('Short rest taken'); flashBar();
  });

  document.getElementById('long-rest').addEventListener('click', () => {
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