let state = {
  characters: [],
  selectedCharacterId: null
};

function getSelectedCharacter() {
  return state.characters.find(
    c => c.id === state.selectedCharacterId
  );
}

function saveState() {
  localStorage.setItem("dndTrackerState", JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem("dndTrackerState");
  if (saved) {
    state = JSON.parse(saved);
  }
}

loadState();

const characterListScreen = document.getElementById("character-list-screen");
const sessionScreen = document.getElementById("session-screen");

function showCharacterList() {
  sessionScreen.hidden = true;
  characterListScreen.hidden = false;
}

function showSession() {
  characterListScreen.hidden = true;
  sessionScreen.hidden = false;
}

document.getElementById("back-btn").addEventListener("click", () => {
  state.selectedCharacterId = null;
  saveState();
  showCharacterList();
  renderCharacterList();
});

function renderCharacterList() {
  const list = document.getElementById("character-list");
  list.innerHTML = "";

  if (!state.characters || state.characters.length === 0) {
    const placeholder = document.createElement('div');
    placeholder.className = 'card';
    placeholder.innerHTML = `<p style="color:#cbd5e1; margin:0">No characters yet — tap <strong>+ Add Character</strong> to create one.</p>`;
    list.appendChild(placeholder);
    return;
  }

  state.characters.forEach(character => {
    const li = document.createElement("li");
    li.dataset.id = character.id;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    const initials = (character.name || '').split(' ').map(s => s[0]).filter(Boolean).slice(0,2).join('').toUpperCase();
    avatar.textContent = initials;

    const nameSpan = document.createElement("span");
    nameSpan.textContent = character.name;
    nameSpan.style.flex = "1";

    // Make the entire list item clickable to open the character (keyboard accessible)
    li.tabIndex = 0;
    li.setAttribute('role', 'button');
    li.style.cursor = 'pointer';

    li.addEventListener('click', () => {
      state.selectedCharacterId = character.id;
      saveState();
      renderSession();
      showSession();
      // visual feedback on open
      li.classList.add('highlight');
      setTimeout(()=> li.classList.remove('highlight'), 600);
    });

    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        li.click();
      }
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = 'delete-btn';
    deleteBtn.setAttribute('aria-label', `Delete ${character.name}`);
    deleteBtn.textContent = "✕";

    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // VERY IMPORTANT

      const confirmed = confirm(
        `Delete "${character.name}"?\nThis cannot be undone.`
      );

      if (!confirmed) return;

      state.characters = state.characters.filter(
        c => c.id !== character.id
      );

      // Safety: if deleted character was selected
      if (state.selectedCharacterId === character.id) {
        state.selectedCharacterId = null;
        showCharacterList();
      }

      saveState();
      renderCharacterList();
    });

    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.gap = '0.75rem';

    li.appendChild(avatar);
    li.appendChild(nameSpan);
    li.appendChild(deleteBtn);

    list.appendChild(li);
  });
}


document.getElementById("add-character-btn").addEventListener("click", () => {
  // Open the character modal (preferred UI)
  const modal = document.getElementById('character-modal');
  if (modal) {
    modal.hidden = false;
    const nameInput = document.getElementById('character-form-name');
    nameInput && nameInput.focus();
  }
});

  function renderSession() {
  const c = getSelectedCharacter();
  if (!c) return;

  // Indicate concentration at the global level (subtle border around the screen)
  const conc = getConcentration(c);
  document.body.classList.toggle('concentrating', !!conc);

  document.getElementById("character-name").textContent = c.name;

  document.getElementById('hp-add').addEventListener('click', () => {
    const amount = parseInt(
      document.getElementById('hp-update-amount').value,
      10
    ) || 0;

    if (amount > 0) heal(amount);
  });

  document.getElementById('hp-subtract').addEventListener('click', () => {
    const amount = parseInt(
      document.getElementById('hp-update-amount').value,
      10
    ) || 0;

    if (amount > 0) applyDamage(amount);
  });

  // // HP UI: current/max, temp badge and bar
  // document.getElementById('hp-current').textContent = c.currentHP;
  // document.getElementById('hp-max').textContent = c.maxHP;

  // const tempEl = document.getElementById('hp-temp');
  // tempEl.textContent = c.tempHP && c.tempHP > 0 ? c.tempHP : '--';

  // // HP bar
  // const fill = document.getElementById('hp-bar-fill');
  // if (fill) {
  //   const pct =
  //     c.maxHP > 0
  //       ? Math.max(0, Math.min(100, Math.round((c.currentHP / c.maxHP) * 100)))
  //       : 0;
  //   fill.style.width = pct + '%';
  // }

  // Update separate current / max / temp elements
  const curEl = document.getElementById('hp-current');
  const maxEl = document.getElementById('hp-max');
  if (curEl) curEl.textContent = c.currentHP;
  if (maxEl) maxEl.textContent = c.maxHP;

  const tempInline = document.getElementById('hp-temp-inline');
  if (tempInline) tempInline.value = c.tempHP && c.tempHP > 0 ? c.tempHP : '';

  const fill = document.getElementById('hp-bar-fill');
  if (fill){
    const pct = c.maxHP > 0 ? Math.max(0, Math.min(100, Math.round((c.currentHP / c.maxHP) * 100))) : 0;
    fill.style.width = pct + '%';
  }

  // Render resources, spell slots and statuses
  renderResources(c);
  renderSpellSlots(c);
  renderStatuses(c);
}

function applyDamage(amount) {
  const c = getSelectedCharacter();
  if (!c) return;

  if (c.tempHP > 0) {
    const absorbed = Math.min(c.tempHP, amount);
    c.tempHP -= absorbed;
    amount -= absorbed;
  }

  c.currentHP = Math.max(0, c.currentHP - amount);
  saveState();
  renderSession();
}

function heal(amount) {
  const c = getSelectedCharacter();
  if (!c) return;

  c.currentHP = Math.min(c.maxHP, c.currentHP + amount);
  saveState();
  renderSession();
}

// ----- Resources / Spell slots / Statuses -----
const resourceTemplate = document.getElementById('resource-template');
const spellslotTemplate = document.getElementById('spellslot-template');

function renderResources(c) {
  const container = document.getElementById('resources-container');
  container.innerHTML = '';
  c.resources.forEach(r => {
    const el = resourceTemplate.content.firstElementChild.cloneNode(true);
    el.querySelector('[data-key="label"]').textContent = `${r.name}`;

    const controls = el.querySelector('[data-key="controls"]');
    controls.innerHTML = '';

    const dec = document.createElement('button');
    dec.className = 'decrement small-btn slot-decr';
    dec.textContent = '-';
    dec.addEventListener('click', () => {
      r.current = Math.max(0, r.current - 1);
      saveState();
      renderSession();
    });

    const val = document.createElement('div');
    val.className = 'resource-value';
    val.textContent = `${r.current} / ${r.max}`;

    const inc = document.createElement('button');
    inc.className = 'increment small-btn slot-incr';
    inc.textContent = '+';
    inc.addEventListener('click', () => {
      r.current = Math.min(r.max, r.current + 1);
      saveState();
      renderSession();
    });

    controls.appendChild(dec);
    controls.appendChild(val);
    controls.appendChild(inc);

    const removeBtn = el.querySelector('.slot-remove');
    if (removeBtn){
      removeBtn.addEventListener('click', () => {
        if (!confirm(`Remove resource "${r.name}"?`)) return;
        c.resources = c.resources.filter(x => x.id !== r.id);
        saveState();
        renderSession();
      });
    }

    container.appendChild(el);
  });
}

function renderSpellSlots(c) {
  const container = document.getElementById('spellslots-container');
  container.innerHTML = '';

  // Ensure any slot that recovers on short rest is marked as a pact slot for consistency
  if (Array.isArray(c.spellSlots)) {
    let changed = false;
    c.spellSlots.forEach(s => {
      const shouldBePact = (s.recoversOn === 'short');
      if (!!s.pact !== shouldBePact) {
        s.pact = shouldBePact;
        changed = true;
      }
    });
    if (changed) saveState();
  }

  // Render pact (warlock) slots first, then regular class/multiclass slots.
  const slots = (c.spellSlots || []).slice().sort((a, b) => {
    // Pact slots first; within each group, order by level ascending
    if (a.pact && !b.pact) return -1;
    if (!a.pact && b.pact) return 1;
    return a.level - b.level;
  });

  slots.forEach(s => {
    const el = spellslotTemplate.content.firstElementChild.cloneNode(true);
    el.classList.toggle('pact-slot', !!s.pact);

    const labelEl = el.querySelector('[data-key="level"]');
    labelEl.textContent = s.pact ? `Level ${s.level}` : `Level ${s.level}`;
    if (s.pact) {
      const span = document.createElement('span');
      span.className = 'pact-badge';
      span.textContent = 'Pact';
      labelEl.appendChild(span);
    }

    const controls = el.querySelector('[data-key="controls"]');
    controls.innerHTML = '';

    // Render one checkbox per available slot; checked boxes correspond to used slots.
    for (let i = 0; i < s.max; i++) {
      const wrapper = document.createElement('label');
      wrapper.className = 'slot-toggle';
      const title = `${s.pact ? 'Pact ' : ''}Slot ${i + 1} of level ${s.level}`;
      wrapper.title = title;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'slot-checkbox';
      cb.checked = (s.used || 0) > i;
      cb.setAttribute('aria-label', title);

      // Decorative box that shows checked state and enlarges the touch area
      const box = document.createElement('span');
      box.className = 'slot-box';

      cb.addEventListener('change', () => {
        const boxes = controls.querySelectorAll('input[type="checkbox"]');
        s.used = Array.from(boxes).filter(x => x.checked).length;
        saveState();
      });

      wrapper.appendChild(cb);
      wrapper.appendChild(box);
      controls.appendChild(wrapper);
    }


    const removeBtn = el.querySelector('.slot-remove');
    if (removeBtn){
      removeBtn.addEventListener('click', () => {
        if (!confirm(`Remove spell slots level ${s.level}${s.pact ? ' (pact)' : ''}?`)) return;
        c.spellSlots = c.spellSlots.filter(x => x.id !== s.id);
        saveState();
        renderSession();
      });
    }

    container.appendChild(el);
  });
} 

const STANDARD_CONDITIONS = [
  'Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious'
];

function hasCondition(c, name){
  return c.statuses.some(s => s.name === name);
}

// Small toast helper (used from app-level to provide feedback)
function showToast(msg, ms = 1200){
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  t.classList.add('show');
  setTimeout(()=>{ t.classList.remove('show'); t.hidden = true; }, ms);
}

function toggleCondition(c, name){
  if (hasCondition(c, name)){
    c.statuses = c.statuses.filter(s => s.name !== name);
  } else {
    c.statuses.push({ id: crypto.randomUUID(), name, remaining: 0, durationType: 'rest' });
  }
  saveState();
  renderSession();
}

// Concentration helpers (stored separately from statuses)
function getConcentration(c){
  return c.concentration || null;
}

function setConcentration(c, spell){
  if (spell && String(spell).trim()) {
    c.concentration = { spell: String(spell).trim(), since: Date.now() };
  } else {
    c.concentration = { since: Date.now() };
  }
  saveState();
  renderSession();
}

function clearConcentration(c){
  delete c.concentration;
  saveState();
  renderSession();
}

function toggleConcentration(c){
  const conc = getConcentration(c);
  if (conc){
    if (!confirm('Stop concentrating?')) return;
    clearConcentration(c);
  } else {
    // Start concentrating without asking for a spell name
    setConcentration(c);
  }
}

// ----- Multiclass & Pact magic spell slot calculation -----
// Compute slot distribution for an "effective caster level" following PHB multiclass rules.
// Use an explicit table to ensure accurate slot counts for each effective level (1..20).
function computeSlotsForEffectiveLevel(eff) {
  eff = Math.max(0, Math.floor(eff || 0));
  if (eff < 1) return [0,0,0,0,0,0,0,0,0];

  const table = {
    1:  [2,0,0,0,0,0,0,0,0],
    2:  [3,0,0,0,0,0,0,0,0],
    3:  [4,2,0,0,0,0,0,0,0],
    4:  [4,3,0,0,0,0,0,0,0],
    5:  [4,3,2,0,0,0,0,0,0],
    6:  [4,3,3,0,0,0,0,0,0],
    7:  [4,3,3,1,0,0,0,0,0],
    8:  [4,3,3,2,0,0,0,0,0],
    9:  [4,3,3,3,1,0,0,0,0],
    10: [4,3,3,3,2,0,0,0,0],
    11: [4,3,3,3,2,1,0,0,0],
    12: [4,3,3,3,2,1,0,0,0],
    13: [4,3,3,3,2,1,1,0,0],
    14: [4,3,3,3,2,1,1,0,0],
    15: [4,3,3,3,2,1,1,1,0],
    16: [4,3,3,3,2,1,1,1,0],
    17: [4,3,3,3,2,1,1,1,1],
    18: [4,3,3,3,3,1,1,1,1],
    19: [4,3,3,3,3,2,1,1,1],
    20: [4,3,3,3,3,2,2,1,1]
  };

  return (table[Math.max(1, Math.min(20, eff))] || new Array(9).fill(0)).slice();
}

// Build spell slot objects for a character given caster breakdown.
function computeHalfCasterSlots(level){
  // Paladin / Ranger single-class spell slot progression (PHB). Mapping by paladin/ranger level to slots per level (1..9).
  const map = {
    1:  [0,0,0,0,0,0,0,0,0],
    2:  [2,0,0,0,0,0,0,0,0],
    3:  [3,0,0,0,0,0,0,0,0],
    4:  [3,0,0,0,0,0,0,0,0],
    5:  [4,2,0,0,0,0,0,0,0],
    6:  [4,2,0,0,0,0,0,0,0],
    7:  [4,3,0,0,0,0,0,0,0],
    8:  [4,3,0,0,0,0,0,0,0],
    9:  [4,3,2,0,0,0,0,0,0],
    10: [4,3,2,0,0,0,0,0,0],
    11: [4,3,3,0,0,0,0,0,0],
    12: [4,3,3,0,0,0,0,0,0],
    13: [4,3,3,1,0,0,0,0,0],
    14: [4,3,3,1,0,0,0,0,0],
    15: [4,3,3,2,0,0,0,0,0],
    16: [4,3,3,2,0,0,0,0,0],
    17: [4,3,3,3,1,0,0,0,0],
    18: [4,3,3,3,1,0,0,0,0],
    19: [4,3,3,3,2,0,0,0,0],
    20: [4,3,3,3,2,0,0,0,0]
  };
  return map[Math.max(1, Math.min(20, level))] || [];
}

function buildSpellSlotsFromCasterInfo(fullCasterLevel, halfCasterLevel, pactLevel) {
  const full = Math.max(0, parseInt(fullCasterLevel || 0, 10));
  let half = Math.max(0, parseInt(halfCasterLevel || 0, 10));
  let pact = Math.max(0, parseInt(pactLevel || 0, 10));

  // Ensure the combined caster breakdown does not exceed 20 levels. If it does,
  // reduce pact first, then half if needed (preserves full caster levels).
  const total = full + half + pact;
  if (total > 20) {
    let over = total - 20;
    if (pact >= over) {
      pact -= over;
      over = 0;
    } else {
      over -= pact;
      pact = 0;
    }
    if (over > 0) {
      half = Math.max(0, half - over);
    }
    console.warn('Caster breakdown exceeded 20 and was adjusted to fit the 20-level maximum.');
  }

  // If this is a single-class half-caster (e.g., Paladin or Ranger), use the class table.
  // Note: Pact Magic (warlock) is a separate feature and should not prevent a single-class
  // half-caster from using its class progression — pact slots are added separately below.
  let slotsPerLevel = [];
  if (full === 0 && half > 0) {
    // Use the half-caster class table when there are half-caster levels and no full caster levels.
    slotsPerLevel = computeHalfCasterSlots(half);
  } else {
    const effective = Math.floor(full + 0.5 * half);
    slotsPerLevel = computeSlotsForEffectiveLevel(effective);
  }

  const out = [];
  slotsPerLevel.forEach((count, idx) => {
    const level = idx + 1;
    if (count > 0) out.push({ id: crypto.randomUUID(), level, max: count, used: 0, recoversOn: 'long', pact: false });
  });

  // Pact magic (warlock) - separate slot pool, recovers on short rest
  if (pact > 0) {
    const pactSlots = (pact === 1) ? 1 : 2;
    const slotLevel = Math.min(Math.ceil(pact / 2), 5); // warlock slot level progression
    out.push({ id: crypto.randomUUID(), level: slotLevel, max: pactSlots, used: 0, recoversOn: 'short', pact: true });
  }

  // Normalize: merge any slots that share the same level, recovery timing and pact flag
  const merged = {};
  out.forEach(s => {
    const key = `${s.level}-${s.recoversOn}-${s.pact ? 'p' : 'c'}`;
    if (!merged[key]) {
      merged[key] = { ...s };
    } else {
      merged[key].max = (merged[key].max || 0) + (s.max || 0);
      // preserve used count conservatively (sum of used if both have used slots)
      merged[key].used = Math.min(merged[key].max, (merged[key].used || 0) + (s.used || 0));
    }
  });

  // Return merged array sorted: pact slots first, then by level ascending
  const result = Object.values(merged).sort((a, b) => {
    // Pact slots first; within each group, order by level ascending
    if (a.pact && !b.pact) return -1;
    if (!a.pact && b.pact) return 1;
    return a.level - b.level;
  });

  return result;
}

// Expose helper for other scripts
window.buildSpellSlotsFromCasterInfo = buildSpellSlotsFromCasterInfo;

function renderStatuses(c) {
  const container = document.getElementById('status-container');
  container.innerHTML = '';

  // Render custom/active statuses
  c.statuses.forEach(st => {
    const div = document.createElement('div');
    div.className = 'status-item card small';
    div.textContent = `${st.name}${st.remaining ? ` (${st.remaining} ${st.durationType || ''})` : ''}`;

    const remove = document.createElement('button');
    remove.className = 'link-btn';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      c.statuses = c.statuses.filter(x => x.id !== st.id);
      saveState();
      renderSession();
    });

    div.appendChild(remove);
    container.appendChild(div);
  });

  // Render the quick condition grid
  const grid = document.getElementById('condition-grid');
  if (grid){
    grid.innerHTML = '';

    STANDARD_CONDITIONS.forEach(cond => {
      const btn = document.createElement('button');
      btn.className = 'condition-btn';
      btn.textContent = cond;
      if (hasCondition(c, cond)) btn.classList.add('active');
      btn.addEventListener('click', () => toggleCondition(c, cond));
      grid.appendChild(btn);
    });

    // Concentration controls
    const concBtn = document.getElementById('concentration-toggle');
    const conc = getConcentration(c);
    if (concBtn){
      concBtn.classList.toggle('active', !!conc);
      concBtn.setAttribute('aria-pressed', !!conc);
      concBtn.textContent = conc && conc.spell ? `Concentrating: ${conc.spell}` : 'Concentrate';
      concBtn.title = conc && conc.spell ? `Concentrating on ${conc.spell}` : 'Toggle concentration';
      concBtn.onclick = () => toggleConcentration(c);
    }

    // Concentration banner
    const banner = document.getElementById('concentration-banner');
    if (banner){
      if (conc){
        banner.hidden = false;
        banner.textContent = `${c.name} is concentrating${conc.spell ? ' on ' + conc.spell : ''} — if they take damage, they must make a CON save to maintain concentration.`;
      } else {
        banner.hidden = true;
      }
    }
  }
}

// Add handlers for add/remove
document.getElementById('add-resource-btn').addEventListener('click', () => {
  // Open the resource modal (preferred UI)
  const modal = document.getElementById('resource-modal');
  if (modal) {
    modal.hidden = false;
    const nameField = document.getElementById('resource-form-name');
    if (nameField) nameField.focus();
  }
});

document.getElementById('add-spellslot-btn').addEventListener('click', () => {
  // Open the spell slot modal (preferred UI)
  const modal = document.getElementById('spellslot-modal');
  if (modal) {
    modal.hidden = false;
    const field = document.getElementById('spellslot-form-level');
    if (field) field.focus();
  }
});



function shortRest() {
  const c = getSelectedCharacter();
  if (!c) return;

  // Restore resources/spellslots that recover on short rests
  c.resources.forEach(r => {
    if (r.recoversOn === 'short') r.current = r.max;
  });
  c.spellSlots.forEach(s => {
    if (s.recoversOn === 'short') s.used = 0;
  });

  // Optionally partially heal? Keep simple: do not change HP by default
  saveState();
  renderSession();
}

function longRest() {
  const c = getSelectedCharacter();
  if (!c) return;

  c.resources.forEach(r => {
    if (r.recoversOn === 'long' || r.recoversOn === 'short') r.current = r.max;
  });
  c.spellSlots.forEach(s => {
    if (s.recoversOn === 'long' || s.recoversOn === 'short') s.used = 0;
  });

  // Restore HP and reset death saves
  c.currentHP = c.maxHP;
  c.tempHP = 0;
  c.deathSaves = { success: 0, failure: 0 };

  saveState();
  renderSession();
}

// Expose for other scripts (modal UI) to access the same state and helpers
window.state = state;
window.saveState = saveState;
window.renderCharacterList = renderCharacterList;
window.renderSession = renderSession;
window.applyDamage = applyDamage;
window.heal = heal;

// Small runtime sanity checks to catch early syntax/runtime issues in production
function verifyAppIntegrity(){
  try {
    // Basic checks for core functions
    const eff20 = computeSlotsForEffectiveLevel(20);
    if (!Array.isArray(eff20) || eff20.length !== 9) throw new Error('computeSlotsForEffectiveLevel returned invalid table');
    const expected20 = [4,3,3,3,3,2,2,1,1];
    if (eff20.join(',') !== expected20.join(',')) console.warn('Warning: effective level table differs from expected', eff20);

    const sample = buildSpellSlotsFromCasterInfo(0,5,1);
    if (!Array.isArray(sample)) throw new Error('buildSpellSlotsFromCasterInfo did not return an array');

    console.info('App integrity checks passed');
    return true;
  } catch (err) {
    console.error('App integrity check failed:', err);
    return false;
  }
}

// Run with try/catch to avoid hard-breaking the app if something unexpected happens
try {
  renderCharacterList();
  if (state.selectedCharacterId) {
    renderSession();
    showSession();
  } else {
    showCharacterList();
  }

  // Run integrity checks in development mode (kept harmless in production)
  if (typeof window !== 'undefined') {
    setTimeout(verifyAppIntegrity, 120);
  }
} catch (err) {
  console.error('Error rendering initial UI:', err);
}
