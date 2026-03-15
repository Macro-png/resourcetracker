// ─── State ───────────────────────────────────────────────────────────────────

let state = { characters: [], selectedCharacterId: null };
let editMode = false;
let activeTab = 'stats';

function getSelectedCharacter() {
  return state.characters.find(c => c.id === state.selectedCharacterId);
}

function saveState() {
  localStorage.setItem('dndTrackerState', JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem('dndTrackerState');
  if (saved) state = JSON.parse(saved);
}

loadState();

// ─── Screens ─────────────────────────────────────────────────────────────────

function showCharacterList() {
  document.getElementById('session-screen').hidden = true;
  document.getElementById('character-list-screen').hidden = false;
  document.getElementById('app-header').hidden = false;
}

function showSession() {
  document.getElementById('character-list-screen').hidden = true;
  document.getElementById('session-screen').hidden = false;
  document.getElementById('app-header').hidden = true;
  switchTab('stats');
}

function switchTab(tab) {
  activeTab = tab;
  const statsPanel = document.getElementById('stats-panel');
  const invPanel   = document.getElementById('inventory-panel');
  const statsBtn   = document.getElementById('tab-stats');
  const invBtn     = document.getElementById('tab-inventory');
  const isStats    = tab === 'stats';
  statsPanel.hidden = !isStats;
  invPanel.hidden   = isStats;
  statsBtn.classList.toggle('active', isStats);
  invBtn.classList.toggle('active', !isStats);
  const c = getSelectedCharacter();
  if (!c) return;
  if (isStats) {
    document.getElementById('add-spellslot-btn').hidden = !editMode;
    document.getElementById('add-resource-btn').hidden = !editMode;
    document.getElementById('edit-character-btn').hidden = !editMode;
  } else {
    renderInventory(c);
  }
}

document.getElementById('tab-stats').addEventListener('click', () => switchTab('stats'));
document.getElementById('tab-inventory').addEventListener('click', () => switchTab('inventory'));

// ─── Swipe to delete ─────────────────────────────────────────────────────────

function makeSwipeable(el, onDelete) {
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

  content.addEventListener('touchstart', e => {
    if (!editMode) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = false;
  }, { passive: true });

  const SWIPE_WIDTH = 56;
  const SWIPE_THRESHOLD = 20;

  content.addEventListener('touchmove', e => {
    if (!editMode) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (!tracking && Math.abs(dy) > Math.abs(dx)) return;
    tracking = true;
    const clamped = Math.max(-SWIPE_WIDTH, Math.min(0, dx));
    content.style.transition = 'none';
    content.style.transform = `translateX(${clamped}px)`;
    bg.style.transition = 'none';
    bg.style.opacity = String(Math.min(1, Math.abs(clamped) / SWIPE_WIDTH));
  }, { passive: true });

  content.addEventListener('touchend', () => {
    if (!editMode) return;
    content.style.transition = 'transform 0.2s ease';
    bg.style.transition = 'opacity 0.15s ease';
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
    el.style.overflow = 'hidden';
    el.style.maxHeight = el.offsetHeight + 'px';
    el.style.opacity = '1';
    requestAnimationFrame(() => {
      el.style.maxHeight = '0';
      el.style.opacity = '0';
    });
    setTimeout(onDelete, 260);
  });

  // Tap elsewhere to close swipe
  document.addEventListener('touchstart', e => {
    if (!editMode) return;
    if (!el.contains(e.target) && el.classList.contains('swiped')) {
      el.classList.remove('swiped');
      content.style.transition = 'transform 0.2s ease';
      content.style.transform = '';
    }
  }, { passive: true });
}

// ─── Character List ───────────────────────────────────────────────────────────

function renderCharacterList() {
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
      saveState();
      renderCharacterList();
    });

    li.addEventListener('click', () => {
      state.selectedCharacterId = character.id;
      saveState();
      renderSession();
      showSession();
      li.classList.add('highlight');
      setTimeout(() => li.classList.remove('highlight'), 600);
    });

    li.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.click(); }
    });

    li.appendChild(avatar);
    li.appendChild(nameSpan);
    li.appendChild(deleteBtn);
    list.appendChild(li);
  });
}

// ─── Session ──────────────────────────────────────────────────────────────────

function renderSession() {
  const c = getSelectedCharacter();
  if (!c) return;

  // Reset visibility
  ['hp-card','spellslots-section','resources-section',
   'conditions-section','rest-section'].forEach(id => {
    document.getElementById(id).hidden = false;
  });
  document.getElementById('dead-card').hidden = true;
  document.getElementById('death-saves-card').hidden = true;
  document.getElementById('concentration-banner').hidden = true;
  document.getElementById('concentration-toggle').hidden = false;

  document.getElementById('character-name').textContent = c.name;

  // HP display
  document.getElementById('hp-current').textContent = c.currentHP;
  document.getElementById('hp-max').textContent = c.maxHP;

  const tempEl = document.getElementById('hp-temp-inline');
  if (tempEl) tempEl.value = c.tempHP > 0 ? c.tempHP : '';

  const fill = document.getElementById('hp-bar-fill');
  if (fill) {
    const pct = c.maxHP > 0 ? Math.max(0, Math.min(100, Math.round(c.currentHP / c.maxHP * 100))) : 0;
    fill.style.width = pct + '%';
  }

  // Dead state
  if (c.dead) {
    ['hp-card','spellslots-section','resources-section',
     'conditions-section','rest-section','death-saves-card'].forEach(id => {
      document.getElementById(id).hidden = true;
    });
    document.getElementById('concentration-toggle').hidden = true;
    document.getElementById('dead-card').hidden = false;
    document.getElementById('dead-name').textContent = `${c.name} has fallen`;
    return;
  }

  // At 0 HP: hide spells/resources, show death saves
  if (c.currentHP === 0) {
    document.getElementById('spellslots-section').hidden = true;
    document.getElementById('resources-section').hidden = true;
  }

  renderDeathSaves(c);
  renderSpellSlots(c);
  renderResources(c);
  renderStatuses(c);

  // Sync edit mode state
  document.getElementById('session-screen').classList.toggle('edit-mode', editMode);
  document.getElementById('add-spellslot-btn').hidden = !editMode;
  document.getElementById('add-resource-btn').hidden = !editMode;
  document.getElementById('edit-character-btn').hidden = !editMode;
}

// ─── HP ───────────────────────────────────────────────────────────────────────

function applyDamage(amount) {
  const c = getSelectedCharacter();
  if (!c || amount <= 0) return;

  // Absorb temp HP first
  if (c.tempHP > 0) {
    const absorbed = Math.min(c.tempHP, amount);
    c.tempHP -= absorbed;
    amount -= absorbed;
  }

  if (amount <= 0) { saveState(); renderSession(); return; }

  const hpBefore = c.currentHP;
  c.currentHP = Math.max(0, c.currentHP - amount);

  // Massive damage = instant death
  if (c.currentHP === 0 && amount >= hpBefore + c.maxHP) {
    c.dead = true;
    c.deathSaves = { success: 0, failure: 0 };
    delete c.concentration;
    saveState(); renderSession();
    showToast(`${c.name} died from massive damage!`);
    return;
  }

  // Dropped to 0
  if (c.currentHP === 0) {
    delete c.concentration;
    if (!hasCondition(c, 'Unconscious')) {
      c.statuses.push({ id: crypto.randomUUID(), name: 'Unconscious', remaining: 0, durationType: 'rest' });
      ['Incapacitated', 'Prone'].forEach(imp => {
        const existing = c.statuses.find(s => s.name === imp);
        if (!existing) {
          c.statuses.push({ id: crypto.randomUUID(), name: imp, remaining: 0, durationType: 'rest', implied: true });
        } else { existing.implied = true; }
      });
    }
  }

  saveState();
  renderSession();

  // Concentration check
  if (getConcentration(c)) {
    const dc = Math.max(10, Math.floor(amount / 2));
    document.getElementById('concentration-modal-text').textContent =
      `${c.name} must make a DC ${dc} CON save to maintain concentration.`;
    document.getElementById('concentration-modal').hidden = false;
  }
}

function heal(amount) {
  const c = getSelectedCharacter();
  if (!c || amount <= 0) return;
  c.currentHP = Math.min(c.maxHP, c.currentHP + amount);

  // Remove Unconscious if healed above 0
  if (c.currentHP > 0 && hasCondition(c, 'Unconscious')) {
    c.statuses = c.statuses.filter(s => s.name !== 'Unconscious');
    const stillImplied = new Set(c.statuses.flatMap(s => IMPLIED_CONDITIONS[s.name] || []));
    c.statuses.forEach(s => {
      if (s.implied && STICKY_IMPLIED.has(s.name) && !stillImplied.has(s.name)) s.implied = false;
    });
    c.statuses = c.statuses.filter(s => !s.implied || stillImplied.has(s.name) || STICKY_IMPLIED.has(s.name));
  }

  saveState(); renderSession();
}

// ─── Death Saves ──────────────────────────────────────────────────────────────

function renderDeathSaves(c) {
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
        saveState(); renderSession();
      });

      const span = document.createElement('span');
      span.className = 'slot-box';
      label.appendChild(cb);
      label.appendChild(span);
      box.appendChild(label);
    }
  });
}

document.getElementById('revive-btn').addEventListener('click', () => {
  const c = getSelectedCharacter();
  if (!c) return;
  c.dead = false;
  c.currentHP = 1;
  c.deathSaves = { success: 0, failure: 0 };
  c.statuses = [];
  c.exhaustion = Math.min(5, (c.exhaustion || 0) + 1);
  saveState(); renderSession();
  showToast(`${c.name} has been revived!`);
});

// ─── Resources ────────────────────────────────────────────────────────────────

function renderResources(c) {
  const container = document.getElementById('resources-container');
  const template  = document.getElementById('resource-template');
  container.innerHTML = '';

  c.resources.forEach(r => {
    const el = template.content.firstElementChild.cloneNode(true);
    el.querySelector('[data-key="label"]').textContent = r.name;

    // Edit mode: show inline max input below the name
    const controls = el.querySelector('[data-key="controls"]');
    controls.innerHTML = '';

    if (r.max < 4) {
      // ── Checkbox mode (like spell slots) ──
      controls.className = 'spellslot-controls resource-controls';
      for (let i = 0; i < r.max; i++) {
        const label = document.createElement('label');
        label.className = 'slot-toggle';
        label.title = `${r.name} use ${i + 1}`;

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'slot-checkbox';
        // purple = used/spent, fills from the left
        cb.checked = i < (r.max - (r.current || 0));
        cb.setAttribute('aria-label', `${r.name} ${i + 1}`);
        cb.addEventListener('change', () => {
          if (editMode) {
            r.max--;
            r.current = Math.min(r.current || 0, r.max);
            if (r.max === 0) c.resources = c.resources.filter(x => x.id !== r.id);
          } else {
            // checked = used (purple) → decrement current
            if (cb.checked) {
              r.current = Math.max(0, (r.current || 0) - 1);
            } else {
              r.current = Math.min(r.max, (r.current || 0) + 1);
            }
          }
          saveState();
          renderSession();
        });

        const box = document.createElement('span');
        box.className = 'slot-box resource-slot-box';
        label.appendChild(cb);
        label.appendChild(box);
        controls.appendChild(label);
      }

      // + add box — at max 3 clicking it pushes to 4 which switches to counter mode
      const addLabel = document.createElement('label');
      addLabel.className = 'slot-toggle slot-add-toggle';
      addLabel.title = 'Add one more';
      const addBox = document.createElement('span');
      addBox.className = 'slot-box slot-add-box';
      addBox.textContent = '+';
      addLabel.appendChild(addBox);
      addLabel.addEventListener('click', () => {
        if (!editMode) return;
        r.max++;
        r.current = Math.min(r.max, (r.current || 0) + 1);
        saveState();
        renderSession();
      });
      controls.appendChild(addLabel);
    } else {
      // ── Counter mode (styled large) ──
      controls.className = 'resource-counter-controls';

      const flash = btn => {
        btn.classList.add('flash');
        setTimeout(() => btn.classList.remove('flash'), 200);
      };

      controls.className = 'spellslot-controls resource-controls';

      const makeBox = (text) => {
        const label = document.createElement('label');
        label.className = 'slot-toggle';
        const box = document.createElement('span');
        box.className = 'slot-box resource-counter-box';
        box.textContent = text;
        label.appendChild(box);
        return { label, box };
      };

      const { label: decLabel, box: decBox } = makeBox('−');
      decLabel.addEventListener('click', () => {
        if (editMode) {
          if (r.max <= 1) return;
          r.max--;
          r.current = Math.min(r.current, r.max);
        } else {
          if (r.current <= 0) return;
          r.current = Math.max(0, r.current - 1);
        }
        saveState();
        flash(decBox);
        valBox.textContent = `${r.current}/${r.max}`;
        setTimeout(() => renderSession(), 210);
      });

      const { label: valLabel, box: valBox } = makeBox(`${r.current}/${r.max}`);
      valLabel.style.cursor = 'default';
      valLabel.style.pointerEvents = 'none';

      const { label: incLabel, box: incBox } = makeBox('+');
      incLabel.addEventListener('click', () => {
        if (editMode) {
          r.max++;
          r.current = Math.min(r.current, r.max);
        } else {
          if (r.current >= r.max) return;
          r.current = Math.min(r.max, r.current + 1);
        }
        saveState();
        flash(incBox);
        valBox.textContent = `${r.current}/${r.max}`;
        setTimeout(() => renderSession(), 210);
      });

      controls.appendChild(decLabel);
      controls.appendChild(valLabel);
      controls.appendChild(incLabel);
    }

    makeSwipeable(el, () => {
      c.resources = c.resources.filter(x => x.id !== r.id);
      saveState(); renderSession();
    });

    container.appendChild(el);
  });
}

// ─── Spell Slots ──────────────────────────────────────────────────────────────

function renderSpellSlots(c) {
  const container = document.getElementById('spellslots-container');
  const template  = document.getElementById('spellslot-template');
  container.innerHTML = '';

  // Sync pact flag
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
        if (editMode) {
          if (s.max > 0) {
            s.max--;
            s.used = Math.min(s.used || 0, s.max);
            if (s.max === 0) c.spellSlots = c.spellSlots.filter(x => x.id !== s.id);
          }
        } else {
          if (cb.checked) {
            s.used = Math.min(s.max, (s.used || 0) + 1);
          } else {
            s.used = Math.max(0, (s.used || 0) - 1);
          }
        }
        saveState();
        renderSession();
      });

      const box = document.createElement('span');
      box.className = 'slot-box';
      label.appendChild(cb);
      label.appendChild(box);
      controls.appendChild(label);
    }

    // + add box when below the allowed max
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
        renderSession();
      });
      controls.appendChild(addLabel);
    }

    makeSwipeable(el, () => {
      c.spellSlots = c.spellSlots.filter(x => x.id !== s.id);
      saveState(); renderSession();
    });

    container.appendChild(el);
  });
}

// ─── Spell Slot Calculation ───────────────────────────────────────────────────

function computeSlotsForEffectiveLevel(eff) {
  eff = Math.max(0, Math.floor(eff || 0));
  if (eff < 1) return [0,0,0,0,0,0,0,0,0];
  const table = {
    1:[2,0,0,0,0,0,0,0,0],2:[3,0,0,0,0,0,0,0,0],3:[4,2,0,0,0,0,0,0,0],
    4:[4,3,0,0,0,0,0,0,0],5:[4,3,2,0,0,0,0,0,0],6:[4,3,3,0,0,0,0,0,0],
    7:[4,3,3,1,0,0,0,0,0],8:[4,3,3,2,0,0,0,0,0],9:[4,3,3,3,1,0,0,0,0],
    10:[4,3,3,3,2,0,0,0,0],11:[4,3,3,3,2,1,0,0,0],12:[4,3,3,3,2,1,0,0,0],
    13:[4,3,3,3,2,1,1,0,0],14:[4,3,3,3,2,1,1,0,0],15:[4,3,3,3,2,1,1,1,0],
    16:[4,3,3,3,2,1,1,1,0],17:[4,3,3,3,2,1,1,1,1],18:[4,3,3,3,3,1,1,1,1],
    19:[4,3,3,3,3,2,1,1,1],20:[4,3,3,3,3,2,2,1,1]
  };
  return (table[Math.max(1, Math.min(20, eff))] || new Array(9).fill(0)).slice();
}

function computeHalfCasterSlots(level) {
  const map = {
    1:[0,0,0,0,0,0,0,0,0],2:[2,0,0,0,0,0,0,0,0],3:[3,0,0,0,0,0,0,0,0],
    4:[3,0,0,0,0,0,0,0,0],5:[4,2,0,0,0,0,0,0,0],6:[4,2,0,0,0,0,0,0,0],
    7:[4,3,0,0,0,0,0,0,0],8:[4,3,0,0,0,0,0,0,0],9:[4,3,2,0,0,0,0,0,0],
    10:[4,3,2,0,0,0,0,0,0],11:[4,3,3,0,0,0,0,0,0],12:[4,3,3,0,0,0,0,0,0],
    13:[4,3,3,1,0,0,0,0,0],14:[4,3,3,1,0,0,0,0,0],15:[4,3,3,2,0,0,0,0,0],
    16:[4,3,3,2,0,0,0,0,0],17:[4,3,3,3,1,0,0,0,0],18:[4,3,3,3,1,0,0,0,0],
    19:[4,3,3,3,2,0,0,0,0],20:[4,3,3,3,2,0,0,0,0]
  };
  return map[Math.max(1, Math.min(20, level))] || [];
}

function buildSpellSlotsFromCasterInfo(full, half, pact) {
  full = Math.max(0, parseInt(full || 0, 10));
  half = Math.max(0, parseInt(half || 0, 10));
  pact = Math.max(0, parseInt(pact || 0, 10));

  const total = full + half + pact;
  if (total > 20) {
    let over = total - 20;
    if (pact >= over) { pact -= over; over = 0; }
    else { over -= pact; pact = 0; }
    if (over > 0) half = Math.max(0, half - over);
  }

  const slotsPerLevel = (full === 0 && half > 0)
    ? computeHalfCasterSlots(half)
    : computeSlotsForEffectiveLevel(Math.floor(full + 0.5 * half));

  const out = [];
  slotsPerLevel.forEach((count, idx) => {
    if (count > 0) out.push({ id: crypto.randomUUID(), level: idx + 1, max: count, used: 0, recoversOn: 'long', pact: false });
  });

  if (pact > 0) {
    out.push({ id: crypto.randomUUID(), level: Math.min(Math.ceil(pact / 2), 5), max: pact === 1 ? 1 : 2, used: 0, recoversOn: 'short', pact: true });
  }

  const merged = {};
  out.forEach(s => {
    const key = `${s.level}-${s.recoversOn}-${s.pact ? 'p' : 'c'}`;
    if (!merged[key]) merged[key] = { ...s };
    else { merged[key].max += s.max; }
  });

  return Object.values(merged).sort((a, b) => {
    if (a.pact && !b.pact) return -1;
    if (!a.pact && b.pact) return 1;
    return a.level - b.level;
  });
}

// ─── Conditions ───────────────────────────────────────────────────────────────

const STANDARD_CONDITIONS = [
  'Prone','Unconscious',
  'Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated',
  'Invisible','Paralyzed','Petrified','Poisoned','Restrained','Stunned'
];

const IMPLIED_CONDITIONS = {
  'Paralyzed':  ['Incapacitated'],
  'Stunned':    ['Incapacitated'],
  'Petrified':  ['Incapacitated'],
  'Unconscious':['Incapacitated','Prone'],
};

const STICKY_IMPLIED = new Set(['Prone']);

function hasCondition(c, name) { return c.statuses.some(s => s.name === name); }

function toggleCondition(c, name) {
  if (hasCondition(c, name)) {
    c.statuses = c.statuses.filter(s => s.name !== name);
    const stillImplied = new Set(c.statuses.flatMap(s => IMPLIED_CONDITIONS[s.name] || []));
    c.statuses.forEach(s => {
      if (s.implied && STICKY_IMPLIED.has(s.name) && !stillImplied.has(s.name)) s.implied = false;
    });
    c.statuses = c.statuses.filter(s => !s.implied || stillImplied.has(s.name) || STICKY_IMPLIED.has(s.name));
  } else {
    c.statuses.push({ id: crypto.randomUUID(), name, remaining: 0, durationType: 'rest' });
    (IMPLIED_CONDITIONS[name] || []).forEach(imp => {
      const existing = c.statuses.find(s => s.name === imp);
      if (!existing) c.statuses.push({ id: crypto.randomUUID(), name: imp, remaining: 0, durationType: 'rest', implied: true });
      else existing.implied = true;
    });
  }
  saveState(); renderSession();
}

function getConcentration(c) { return c.concentration || null; }

function toggleConcentration(c) {
  if (getConcentration(c)) {
    if (!confirm('Stop concentrating?')) return;
    delete c.concentration;
  } else {
    c.concentration = { since: Date.now() };
  }
  saveState(); renderSession();
}

function renderStatuses(c) {
  if (!('exhaustion' in c)) c.exhaustion = 0;

  if (c.exhaustion >= 6) {
    c.dead = true;
    c.deathSaves = { success: 0, failure: 0 };
    delete c.concentration;
    saveState(); renderSession();
    showToast(`${c.name} has succumbed to exhaustion!`);
    return;
  }

  const grid = document.getElementById('condition-grid');
  if (!grid) return;
  grid.innerHTML = '';

  STANDARD_CONDITIONS.forEach(cond => {
    const btn = document.createElement('button');
    btn.className = 'condition-btn';
    btn.textContent = cond;
    const active = hasCondition(c, cond);
    const implied = active && c.statuses.find(s => s.name === cond)?.implied;
    if (active) btn.classList.add('active');
    if (implied) { btn.classList.add('implied'); btn.title = 'Applied by another condition'; }
    btn.addEventListener('click', () => {
      if (implied) {
        const stillNeeded = Object.entries(IMPLIED_CONDITIONS).some(([src, imps]) => imps.includes(cond) && hasCondition(c, src));
        if (stillNeeded) return;
      }
      toggleCondition(c, cond);
    });
    grid.appendChild(btn);
  });

  // Concentration button
  const conc = getConcentration(c);
  const concBtn = document.getElementById('concentration-toggle');
  if (concBtn) {
    concBtn.classList.toggle('active', !!conc);
    concBtn.setAttribute('aria-pressed', String(!!conc));
    concBtn.textContent = conc ? 'Concentrating ✓' : 'Concentrate';
    concBtn.onclick = () => toggleConcentration(c);
  }

  // Banner
  const banner = document.getElementById('concentration-banner');
  if (banner) {
    banner.hidden = !conc;
    if (conc) banner.textContent = `${c.name} is concentrating — taking damage requires a CON save to maintain it.`;
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
      c.exhaustion = cb.checked ? Math.min(6, c.exhaustion + 1) : Math.max(0, c.exhaustion - 1);
      saveState(); renderSession();
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

// ─── Concentration modal ──────────────────────────────────────────────────────

document.getElementById('concentration-modal-fail').addEventListener('click', () => {
  const c = getSelectedCharacter();
  if (c) { delete c.concentration; saveState(); renderSession(); }
  document.getElementById('concentration-modal').hidden = true;
});

document.getElementById('concentration-modal-success').addEventListener('click', () => {
  document.getElementById('concentration-modal').hidden = true;
});

// ─── Rests ────────────────────────────────────────────────────────────────────

function shortRest() {
  const c = getSelectedCharacter();
  if (!c) return;
  c.resources.forEach(r => { if (r.recoversOn === 'short') r.current = r.max; });
  c.spellSlots.forEach(s => { if (s.recoversOn === 'short') s.used = 0; });
  saveState(); renderSession();
}

function longRest() {
  const c = getSelectedCharacter();
  if (!c) return;
  c.resources.forEach(r => { if (r.recoversOn !== 'none') r.current = r.max; });
  c.spellSlots.forEach(s => { s.used = 0; });
  c.currentHP = c.maxHP;
  c.tempHP = 0;
  c.exhaustion = Math.max(0, (c.exhaustion || 0) - 1);
  c.deathSaves = { success: 0, failure: 0 };
  saveState(); renderSession();
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(msg, ms = 1800) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  t.classList.add('show');
  setTimeout(() => { t.classList.remove('show'); t.hidden = true; }, ms);
}

// ─── PWA ──────────────────────────────────────────────────────────────────────

(function initPWA() {
  let deferred;
  const installBtn = document.getElementById('pwa-install-btn');

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); deferred = e;
    installBtn.hidden = false;
    installBtn.removeAttribute('aria-hidden');
  });

  installBtn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    installBtn.hidden = true;
    installBtn.setAttribute('aria-hidden', 'true');
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('pwa/service-worker.js').catch(() => {});
  }
})();

// ─── Export / Import ─────────────────────────────────────────────────────────

document.getElementById('export-btn').addEventListener('click', () => {
  try {
    const blob = new Blob([localStorage.getItem('dndTrackerState') || '{}'], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'dnd-tracker-export.json' });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  } catch (err) { alert('Export failed: ' + err.message); }
});

document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file').click());

document.getElementById('import-file').addEventListener('change', async ev => {
  const file = ev.target.files[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed.characters)) throw new Error('Invalid format');
    localStorage.setItem('dndTrackerState', JSON.stringify(parsed));
    location.reload();
  } catch (err) { alert('Import failed: ' + err.message); }
});

// ─── Edit Mode ───────────────────────────────────────────────────────────────

document.getElementById('edit-btn').addEventListener('click', () => {
  editMode = !editMode;
  document.getElementById('edit-btn').textContent = editMode ? '✓' : '✎';
  document.getElementById('session-screen').classList.toggle('edit-mode', editMode);
  document.getElementById('add-spellslot-btn').hidden = !editMode;
  document.getElementById('add-resource-btn').hidden = !editMode;
  document.getElementById('edit-character-btn').hidden = !editMode;
  const c = getSelectedCharacter();
  if (c) renderInventory(c);

  if (!editMode) {
    document.querySelectorAll('.swipe-item.swiped').forEach(el => {
      el.classList.remove('swiped');
      const content = el.querySelector('.swipe-content');
      if (content) { content.style.transition = 'transform 0.2s ease'; content.style.transform = ''; }
    });
  }
});

// ─── Back button ─────────────────────────────────────────────────────────────

document.getElementById('back-btn').addEventListener('click', () => {
  editMode = false;
  document.getElementById('edit-btn').textContent = '✎';
  document.getElementById('session-screen').classList.remove('edit-mode');
  document.querySelectorAll('.swipe-item.swiped').forEach(el => {
    el.classList.remove('swiped');
    const content = el.querySelector('.swipe-content');
    if (content) { content.style.transition = 'transform 0.2s ease'; content.style.transform = ''; }
  });
  state.selectedCharacterId = null;
  saveState();
  showCharacterList();
  renderCharacterList();
});

// ─── HP controls ─────────────────────────────────────────────────────────────

(function initHP() {
  const amountInput = document.getElementById('hp-update-amount');

  document.getElementById('hp-add').addEventListener('click', () => {
    const v = Math.max(0, parseInt(amountInput.value, 10) || 0);
    if (!v) return;
    heal(v); amountInput.value = '';
  });

  document.getElementById('hp-subtract').addEventListener('click', () => {
    const v = Math.max(0, parseInt(amountInput.value, 10) || 0);
    if (!v) return;
    applyDamage(v); amountInput.value = '';
  });

  const temp = document.getElementById('hp-temp-inline');
  temp.addEventListener('change', () => {
    const c = getSelectedCharacter(); if (!c) return;
    c.tempHP = Math.max(0, parseInt(temp.value, 10) || 0);
    saveState(); renderSession();
  });
  temp.addEventListener('keydown', e => { if (e.key === 'Enter') temp.blur(); });
})();

// ─── Rest buttons ─────────────────────────────────────────────────────────────

function flashBar() {
  const fill = document.getElementById('hp-bar-fill'); if (!fill) return;
  fill.classList.add('hp-bar-flash');
  setTimeout(() => fill.classList.remove('hp-bar-flash'), 900);
}

document.getElementById('short-rest').addEventListener('click', () => {
  if (!confirm('Take a short rest?')) return;
  shortRest(); showToast('Short rest taken'); flashBar();
});

document.getElementById('long-rest').addEventListener('click', () => {
  if (!confirm('Take a long rest? This will restore HP and all resources.')) return;
  longRest(); showToast('Long rest taken — HP and resources restored'); flashBar();
});

// ─── Character modal ──────────────────────────────────────────────────────────

(function initCharacterModal() {
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
    if (!name)                                   return fail('Please enter a name.');
    if (!Number.isInteger(max) || max < 1)       return fail('Max HP must be a positive number.');
    if (!Number.isInteger(full)||full<0||full>20) return fail('Full caster level must be 0–20.');
    if (!Number.isInteger(half)||half<0||half>20) return fail('Half caster level must be 0–20.');
    if (!Number.isInteger(pact)||pact<0||pact>20) return fail('Pact magic level must be 0–20.');
    if (full + half + pact > 20)                 return fail('Total level cannot exceed 20.');
    saveBtn.disabled = false;
    return true;
  }

  ['character-form-name','character-form-maxhp','character-form-fullcaster',
   'character-form-halfcaster','character-form-pactlevel'].forEach(id =>
    document.getElementById(id).addEventListener('input', validate));

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
      coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
      items: [],
      components: [],
    };

    state.characters.push(ch);
    saveState();
    renderCharacterList();
    close();

    setTimeout(() => {
      const li = document.querySelector(`[data-id="${ch.id}"]`);
      if (li) { li.scrollIntoView({ behavior: 'smooth', block: 'center' }); li.click(); }
    }, 50);

    showToast(`Added ${name}`);
  });
})();

// ─── Edit character modal ─────────────────────────────────────────────────────

(function initEditCharacterModal() {
  const modal   = document.getElementById('edit-character-modal');
  const form    = document.getElementById('edit-character-form');
  const openBtn = document.getElementById('edit-character-btn');
  const cancel  = document.getElementById('edit-character-cancel');
  const nameIn  = document.getElementById('edit-character-form-name');
  const maxIn   = document.getElementById('edit-character-form-maxhp');
  const saveBtn = document.getElementById('edit-character-save');
  const errEl   = document.getElementById('edit-character-form-error');

  const open = () => {
    const c = getSelectedCharacter();
    if (!c) return;
    nameIn.value = c.name;
    maxIn.value  = c.maxHP;
    errEl.hidden = true;
    saveBtn.disabled = false;
    modal.hidden = false;
    nameIn.focus();
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

    const c = getSelectedCharacter();
    if (!c) return;

    const hpDiff = max - c.maxHP;
    c.name  = name;
    c.maxHP = max;
    // If max HP increased, also increase current HP by the same amount
    if (hpDiff > 0) c.currentHP = Math.min(max, c.currentHP + hpDiff);
    // If max HP decreased, clamp current HP
    c.currentHP = Math.min(c.currentHP, c.maxHP);

    saveState();
    renderSession();
    close();
    showToast(`Updated ${name}`);
  });
})();

// ─── Resource modal ───────────────────────────────────────────────────────────

(function initResourceModal() {
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
    e.preventDefault();
    errEl.hidden = true;
    const name = nameIn.value.trim();
    const max  = parseInt(maxIn.value, 10) || 1;
    const rec  = recIn.value || 'none';
    if (!name) { errEl.textContent = 'Please enter a name.'; errEl.hidden = false; return; }
    const c = getSelectedCharacter();
    if (!c)    { errEl.textContent = 'No character selected.'; errEl.hidden = false; return; }
    c.resources.push({ id: crypto.randomUUID(), name, current: max, max, recoversOn: rec });
    saveState(); renderSession();
    close(); form.reset();
    showToast(`Added resource '${name}'`);
  });
})();

// ─── Spell slot modal ─────────────────────────────────────────────────────────

(function initSpellSlotModal() {
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
    e.preventDefault();
    errEl.hidden = true;
    const level = parseInt(lvlIn.value, 10) || 1;
    const max   = parseInt(maxIn.value, 10) || 0;
    const rec   = recIn.value || 'long';
    if (level < 1 || level > 9) { errEl.textContent = 'Level must be 1–9.'; errEl.hidden = false; return; }
    const c = getSelectedCharacter();
    if (!c) { errEl.textContent = 'No character selected.'; errEl.hidden = false; return; }
    c.spellSlots.push({ id: crypto.randomUUID(), level, max, used: 0, recoversOn: rec, pact: rec === 'short' });
    saveState(); renderSession();
    close(); form.reset();
    showToast(`Added level ${level} spell slots`);
  });
})();

// ─── Coin helper ──────────────────────────────────────────────────────────────

// Spend `spendCP` copper from c.coins using minimal downward conversion.
// Never converts up. EP is never used for giving change.
function spendCoins(c, gpAmount) {
  if (!c.coins) c.coins = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
  const spendCP = Math.round(gpAmount * COIN_IN_CP['gp']);
  return _spendCP(c, spendCP);
}

function _spendCP(c, spendCP) {
  if (coinsToCP(c.coins) < spendCP) {
    showToast(`Not enough coins!`);
    return false;
  }

  const coins = { ...c.coins };
  let remaining = spendCP;

  // Step 1: pay from existing coins, lowest first (including EP), no conversion
  for (const d of ['cp', 'sp', 'ep', 'gp', 'pp']) {
    if (remaining <= 0) break;
    const val = COIN_IN_CP[d];
    const canUse = Math.min(coins[d] || 0, Math.floor(remaining / val));
    coins[d] -= canUse;
    remaining -= canUse * val;
  }

  // Step 2: if remainder, break the smallest coin that covers it
  if (remaining > 0) {
    for (const d of ['cp', 'sp', 'ep', 'gp', 'pp']) {
      if (COIN_IN_CP[d] >= remaining && (coins[d] || 0) > 0) {
        coins[d]--;
        const change = COIN_IN_CP[d] - remaining;
        remaining = 0;
        // Give change back downward, no EP
        let changeRem = change;
        for (const cd of ['gp', 'sp', 'cp']) {
          const cv = COIN_IN_CP[cd];
          const give = Math.floor(changeRem / cv);
          if (give > 0) { coins[cd] = (coins[cd] || 0) + give; changeRem -= give * cv; }
        }
        break;
      }
    }
  }

  if (remaining > 0) { showToast(`Not enough coins!`); return false; }
  c.coins = coins;
  return true;
}

// ─── Inventory ────────────────────────────────────────────────────────────────

// Coin values in CP: PP=1000, GP=100, EP=50, SP=10, CP=1
const COIN_ORDER  = ['cp', 'sp', 'ep', 'gp', 'pp'];
const COIN_IN_CP  = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };

function coinsToCP(coins) {
  return COIN_ORDER.reduce((sum, d) => sum + (coins[d] || 0) * COIN_IN_CP[d], 0);
}

function cpToCoins(totalCP) {
  const result = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
  let rem = Math.floor(totalCP);
  // Never auto-convert into EP or PP — only use GP, SP, CP
  for (const d of ['gp', 'sp', 'cp']) {
    result[d] = Math.floor(rem / COIN_IN_CP[d]);
    rem -= result[d] * COIN_IN_CP[d];
  }
  return result;
}

function renderInventory(c) {
  if (!c.coins) c.coins = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
  if (!c.items) c.items = [];
  if (!c.components) c.components = [];
  if (!('attunement' in c)) c.attunement = 0;
  if (!('attunementMax' in c)) c.attunementMax = 3;

  // Coins
  COIN_ORDER.forEach(denom => {
    const input = document.querySelector(`.coin-box[data-coin="${denom}"] .coin-input`);
    if (input) input.value = c.coins[denom] || 0;
  });

  // Attunement boxes
  const boxesEl = document.getElementById('attunement-boxes');
  boxesEl.innerHTML = '';
  for (let i = 0; i < c.attunementMax; i++) {
    const label = document.createElement('label');
    label.className = 'slot-toggle';
    label.title = `Attunement slot ${i + 1}`;
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'slot-checkbox';
    cb.checked = c.attunement > i;
    cb.setAttribute('aria-label', `Attunement slot ${i + 1}`);
    cb.addEventListener('change', () => {
      if (editMode) {
        if (c.attunementMax > 3) {
          c.attunementMax--;
          c.attunement = Math.min(c.attunement, c.attunementMax);
        }
      } else {
        c.attunement = cb.checked
          ? Math.min(c.attunementMax, c.attunement + 1)
          : Math.max(0, c.attunement - 1);
      }
      saveState(); renderInventory(c);
    });
    const box = document.createElement('span');
    box.className = 'slot-box attunement-box';
    label.appendChild(cb);
    label.appendChild(box);
    boxesEl.appendChild(label);
  }

  // + add box (edit mode only, max 6)
  if (c.attunementMax < 6) {
    const addLabel = document.createElement('label');
    addLabel.className = 'slot-toggle slot-add-toggle';
    addLabel.title = 'Add attunement slot';
    const addBox = document.createElement('span');
    addBox.className = 'slot-box attunement-box slot-add-box';
    addBox.textContent = '+';
    addLabel.appendChild(addBox);
    addLabel.addEventListener('click', () => {
      if (!editMode) return;
      c.attunementMax++;
      saveState(); renderInventory(c);
    });
    boxesEl.appendChild(addLabel);
  }

  // Items list
  renderItemList(c, c.items, document.getElementById('items-container'), (item) => {
    c.items = c.items.filter(x => x.id !== item.id);
  });

  // Components list
  renderItemList(c, c.components, document.getElementById('components-container'), (item) => {
    c.components = c.components.filter(x => x.id !== item.id);
  }, true);

  document.getElementById('add-item-btn').hidden = !editMode;
  document.getElementById('add-component-btn').hidden = !editMode;
}

function renderItemList(c, list, container, onDelete, isComponent = false) {
  container.innerHTML = '';
  list.forEach(item => {
    const el = document.createElement('div');
    el.className = 'item-row card small';

    const left = document.createElement('div');
    left.className = 'item-left';

    const right = document.createElement('div');
    right.className = 'item-right';

    if (isComponent) {
      el.className = 'component-card card small';

      // ── TOP ROW: name + remaining/price ──
      const topRow = document.createElement('div');
      topRow.className = 'component-top-row';

      const nameEl = document.createElement('span');
      nameEl.className = 'item-name';
      nameEl.textContent = item.name;
      topRow.appendChild(nameEl);

      if (!editMode) {
        if (item.qty === null) {
          const remEl = document.createElement('span');
          remEl.className = 'component-meta component-remaining';
          remEl.textContent = `${item.gpAmount} gp`;
          topRow.appendChild(remEl);
        } else {
          // Group name + price on the left
          const leftGroup = document.createElement('div');
          leftGroup.className = 'component-name-group';
          leftGroup.appendChild(nameEl);
          const priceEl = document.createElement('span');
          priceEl.className = 'component-meta';
          priceEl.textContent = `${item.price} gp`;
          leftGroup.appendChild(priceEl);
          topRow.insertBefore(leftGroup, topRow.firstChild);

          const qtyEl = document.createElement('span');
          qtyEl.className = 'component-meta component-remaining';
          qtyEl.textContent = `${item.qty} left`;
          topRow.appendChild(qtyEl);
        }
      }

      el.appendChild(topRow);

      // ── BOTTOM ROW: actions ──
      if (editMode) {
        const editBtn = document.createElement('button');
        editBtn.className = 'item-use-btn';
        editBtn.textContent = '✎ Edit';
        editBtn.style.cssText = 'border-color:var(--muted);color:var(--muted);width:100%;margin-top:0.4rem;';
        editBtn.addEventListener('click', () => openComponentEditModal(item, c));
        el.appendChild(editBtn);
      } else if (item.qty === null) {
        // Pool mode: Use | [amount] | Buy  (HP-card style)
        const actionRow = document.createElement('div');
        actionRow.className = 'component-action-row';

        const useBtn = document.createElement('button');
        useBtn.className = 'hp-action-pill damage component-action-pill';
        useBtn.textContent = 'Use';

        const amtInput = document.createElement('input');
        amtInput.type = 'number'; amtInput.min = '0';
        amtInput.className = 'hp-amount-input component-amount-input';
        amtInput.setAttribute('aria-label', 'GP amount');

        const buyBtn = document.createElement('button');
        buyBtn.className = 'hp-action-pill heal component-action-pill';
        buyBtn.textContent = 'Buy';

        useBtn.addEventListener('click', () => {
          const amount = parseFloat(amtInput.value) || 0;
          if (amount <= 0) { amtInput.focus(); return; }
          if (amount > item.gpAmount) { showToast(`Only ${item.gpAmount} gp left`); return; }
          item.gpAmount = Math.max(0, item.gpAmount - amount);
          amtInput.value = '';
          saveState(); renderInventory(c);
          showToast(`Used ${amount} gp — ${item.name} (${item.gpAmount} gp left)`);
        });

        buyBtn.addEventListener('click', () => {
          const amount = parseFloat(amtInput.value) || 0;
          if (amount <= 0) { amtInput.focus(); return; }
          if (!spendCoins(c, amount)) return;
          item.gpAmount = (item.gpAmount || 0) + amount;
          amtInput.value = '';
          saveState(); renderInventory(c);
          showToast(`Bought ${amount} gp of ${item.name}`);
        });

        actionRow.appendChild(useBtn);
        actionRow.appendChild(amtInput);
        actionRow.appendChild(buyBtn);
        el.appendChild(actionRow);
      } else {
        // Qty mode: Use | qty | Buy
        const actionRow = document.createElement('div');
        actionRow.className = 'component-action-row';

        const useBtn = document.createElement('button');
        useBtn.className = 'hp-action-pill damage component-action-pill';
        useBtn.textContent = 'Use';
        useBtn.addEventListener('click', () => {
          if (item.qty <= 0) { showToast(`No ${item.name} remaining`); return; }
          item.qty--;
          saveState(); renderInventory(c);
          showToast(`Used 1 ${item.name} (${item.qty} left)`);
        });

        const buyBtn = document.createElement('button');
        buyBtn.className = 'hp-action-pill heal component-action-pill';
        buyBtn.textContent = 'Buy';
        buyBtn.addEventListener('click', () => {
          const cost = item.price || 0;
          if (cost > 0 && !spendCoins(c, cost)) return;
          item.qty++;
          saveState(); renderInventory(c);
          showToast(cost > 0 ? `Bought 1 ${item.name} for ${cost} gp` : `Added 1 ${item.name}`);
        });

        actionRow.appendChild(useBtn);
        actionRow.appendChild(buyBtn);
        el.appendChild(actionRow);
      }

      makeSwipeable(el, () => { onDelete(item); saveState(); renderInventory(c); });
      container.appendChild(el);
      return; // skip generic left/right append below

    } else {
      // ── Regular item ──
      const nameEl = document.createElement('div');
      nameEl.className = 'item-name';
      nameEl.textContent = item.name;
      left.appendChild(nameEl);

      if (item.attuned) {
        const badgesEl = document.createElement('div');
        badgesEl.className = 'item-badges';
        const b = document.createElement('span');
        b.className = 'item-badge attuned-badge';
        b.textContent = '⟳ Attuned';
        badgesEl.appendChild(b);
        left.appendChild(badgesEl);
      }

      const dec = document.createElement('button');
      dec.className = 'item-qty-btn';
      dec.textContent = '−';
      dec.addEventListener('click', () => {
        if (item.qty <= 1) {
          if (editMode) { onDelete(item); saveState(); renderInventory(c); }
          return;
        }
        item.qty--;
        saveState(); renderInventory(c);
      });

      const qtyEl = document.createElement('span');
      qtyEl.className = 'item-qty';
      qtyEl.textContent = item.qty;

      const inc = document.createElement('button');
      inc.className = 'item-qty-btn';
      inc.textContent = '+';
      inc.addEventListener('click', () => { item.qty++; saveState(); renderInventory(c); });

      right.appendChild(dec);
      right.appendChild(qtyEl);
      right.appendChild(inc);
    }

    el.appendChild(left);
    el.appendChild(right);

    makeSwipeable(el, () => { onDelete(item); saveState(); renderInventory(c); });
    container.appendChild(el);
  });
}

// ─── Coin inline edits ────────────────────────────────────────────────────────

document.querySelectorAll('.coin-input').forEach(input => {
  const denom = input.closest('.coin-box').dataset.coin;
  input.addEventListener('change', () => {
    const c = getSelectedCharacter(); if (!c) return;
    if (!c.coins) c.coins = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
    c.coins[denom] = Math.max(0, parseInt(input.value, 10) || 0);
    input.value = c.coins[denom];
    saveState();
  });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
});

document.getElementById('coin-add').addEventListener('click', () => {
  const c = getSelectedCharacter(); if (!c) return;
  if (!c.coins) c.coins = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
  const amount = parseInt(document.getElementById('coin-amount').value, 10) || 0;
  const denom  = document.getElementById('coin-denom').value;
  if (amount <= 0) return;
  c.coins[denom] = (c.coins[denom] || 0) + amount;
  document.getElementById('coin-amount').value = '';
  saveState(); renderInventory(c);
  showToast(`+${amount} ${denom.toUpperCase()}`);
});

document.getElementById('coin-spend').addEventListener('click', () => {
  const c = getSelectedCharacter(); if (!c) return;
  if (!c.coins) c.coins = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
  const amount = parseInt(document.getElementById('coin-amount').value, 10) || 0;
  const denom  = document.getElementById('coin-denom').value;
  if (amount <= 0) return;
  const spendCP = amount * COIN_IN_CP[denom];
  if (!_spendCP(c, spendCP)) return;
  document.getElementById('coin-amount').value = '';
  saveState(); renderInventory(c);
  showToast(`−${amount} ${denom.toUpperCase()}`);
});

document.getElementById('coin-convert').addEventListener('click', () => {
  const c = getSelectedCharacter(); if (!c) return;
  if (!c.coins) c.coins = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

  // Convert cp → sp → gp → pp, never touching ep
  let rem = (c.coins.cp || 0);
  c.coins.sp = (c.coins.sp || 0) + Math.floor(rem / 10);
  c.coins.cp = rem % 10;

  rem = c.coins.sp;
  c.coins.gp = (c.coins.gp || 0) + Math.floor(rem / 10);
  c.coins.sp = rem % 10;

  rem = c.coins.gp;
  c.coins.pp = (c.coins.pp || 0) + Math.floor(rem / 10);
  c.coins.gp = rem % 10;

  saveState(); renderInventory(c);
  showToast('Coins converted');
});

// ─── Item modal ───────────────────────────────────────────────────────────────

(function initItemModal() {
  const modal   = document.getElementById('item-modal');
  const form    = document.getElementById('item-form');
  const openBtn = document.getElementById('add-item-btn');
  const cancel  = document.getElementById('item-cancel');
  const nameIn  = document.getElementById('item-form-name');
  const qtyIn   = document.getElementById('item-form-qty');
  const attIn   = document.getElementById('item-form-attuned');
  const errEl   = document.getElementById('item-form-error');

  const open  = () => { form.reset(); qtyIn.value = 1; errEl.hidden = true; modal.hidden = false; nameIn.focus(); };
  const close = () => { modal.hidden = true; };

  openBtn.addEventListener('click', open);
  cancel.addEventListener('click', close);
  modal.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  form.addEventListener('submit', e => {
    e.preventDefault();
    errEl.hidden = true;
    const name = nameIn.value.trim();
    if (!name) { errEl.textContent = 'Please enter a name.'; errEl.hidden = false; return; }
    const c = getSelectedCharacter(); if (!c) return;
    if (!c.items) c.items = [];
    if (attIn.checked && c.items.filter(i => i.attuned).length >= 3) {
      errEl.textContent = 'Already at 3 attuned items (max).'; errEl.hidden = false; return;
    }
    c.items.push({
      id: crypto.randomUUID(), name,
      qty: Math.max(1, parseInt(qtyIn.value, 10) || 1),
      attuned: attIn.checked,
    });
    saveState(); renderInventory(c);
    close(); showToast(`Added '${name}'`);
  });
})();

// ─── Component modal ──────────────────────────────────────────────────────────

(function initComponentModal() {
  const modal   = document.getElementById('component-modal');
  const form    = document.getElementById('component-form');
  const openBtn = document.getElementById('add-component-btn');
  const cancel  = document.getElementById('component-cancel');
  const nameIn  = document.getElementById('component-form-name');
  const gpIn    = document.getElementById('component-form-gp');
  const qtyIn   = document.getElementById('component-form-qty');
  const errEl   = document.getElementById('component-form-error');

  const open  = () => { form.reset(); errEl.hidden = true; modal.hidden = false; nameIn.focus(); };
  const close = () => { modal.hidden = true; };

  openBtn.addEventListener('click', open);
  cancel.addEventListener('click', close);
  modal.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  form.addEventListener('submit', e => {
    e.preventDefault();
    errEl.hidden = true;
    const name = nameIn.value.trim();
    const gp   = parseFloat(gpIn.value);
    if (!name) { errEl.textContent = 'Please enter a name.'; errEl.hidden = false; return; }
    if (isNaN(gp) || gp < 0) { errEl.textContent = 'Please enter a valid GP amount.'; errEl.hidden = false; return; }
    const c = getSelectedCharacter(); if (!c) return;
    if (!c.components) c.components = [];

    const qtyVal = qtyIn.value.trim();
    const hasQty = qtyVal !== '' && parseInt(qtyVal, 10) >= 1;

    c.components.push(hasQty ? {
      // qty mode: gp = worth per item, qty = count
      id: crypto.randomUUID(), name,
      qty: parseInt(qtyVal, 10),
      price: gp,
      gpAmount: null,
    } : {
      // pool mode: gp = total pool, no qty
      id: crypto.randomUUID(), name,
      qty: null,
      price: null,
      gpAmount: gp,
    });

    saveState(); renderInventory(c);
    close(); showToast(`Added component '${name}'`);
  });
})();

// ─── Component edit modal ─────────────────────────────────────────────────────

let _compEditItem = null;
let _compEditChar = null;

function openComponentEditModal(item, c) {
  _compEditItem = item;
  _compEditChar = c;

  const isPool = item.qty === null;
  document.getElementById('component-edit-modal-title').textContent = `Edit: ${item.name}`;
  document.getElementById('component-edit-mode-pool').hidden = !isPool;
  document.getElementById('component-edit-mode-qty').hidden  = isPool;

  if (isPool) {
    document.getElementById('component-edit-gp').value = item.gpAmount;
  } else {
    document.getElementById('component-edit-price').value = item.price;
    document.getElementById('component-edit-qty').value   = item.qty;
  }

  document.getElementById('component-edit-error').hidden = true;
  document.getElementById('component-edit-modal').hidden = false;
}

(function initComponentEditModal() {
  const modal  = document.getElementById('component-edit-modal');
  const form   = document.getElementById('component-edit-form');
  const cancel = document.getElementById('component-edit-cancel');
  const close  = () => { modal.hidden = true; };

  cancel.addEventListener('click', close);
  modal.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const item = _compEditItem;
    const c    = _compEditChar;
    if (!item || !c) return;

    if (item.qty === null) {
      const gp = parseFloat(document.getElementById('component-edit-gp').value);
      if (isNaN(gp) || gp < 0) { document.getElementById('component-edit-error').textContent = 'Enter a valid GP amount.'; document.getElementById('component-edit-error').hidden = false; return; }
      item.gpAmount = gp;
    } else {
      const price = parseFloat(document.getElementById('component-edit-price').value) || 0;
      const qty   = parseInt(document.getElementById('component-edit-qty').value, 10) || 0;
      item.price = Math.max(0, price);
      item.qty   = Math.max(0, qty);
    }

    saveState(); renderInventory(c);
    close();
    showToast(`Updated ${item.name}`);
  });
})();

// ─── Init ─────────────────────────────────────────────────────────────────────

try {
  renderCharacterList();
  if (state.selectedCharacterId) { renderSession(); showSession(); }
  else showCharacterList();
} catch (err) {
  console.error('Init error:', err);
}