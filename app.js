// ─── State ───────────────────────────────────────────────────────────────────

let state = {
  characters: [],
  selectedCharacterId: null
};

function getSelectedCharacter() {
  return state.characters.find(c => c.id === state.selectedCharacterId);
}

function saveState() {
  localStorage.setItem("dndTrackerState", JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem("dndTrackerState");
  if (saved) state = JSON.parse(saved);
}

loadState();

// ─── Screens ─────────────────────────────────────────────────────────────────

function showCharacterList() {
  document.getElementById("session-screen").hidden = true;
  document.getElementById("character-list-screen").hidden = false;
}

function showSession() {
  document.getElementById("character-list-screen").hidden = true;
  document.getElementById("session-screen").hidden = false;
}

// ─── Character List ───────────────────────────────────────────────────────────

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
    li.tabIndex = 0;
    li.setAttribute('role', 'button');
    li.style.cssText = "display:flex; align-items:center; gap:0.75rem; cursor:pointer;";

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = (character.name || '')
      .split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

    const nameSpan = document.createElement("span");
    nameSpan.textContent = character.name;
    nameSpan.style.flex = "1";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = 'delete-btn';
    deleteBtn.setAttribute('aria-label', `Delete ${character.name}`);
    deleteBtn.textContent = "✕";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!confirm(`Delete "${character.name}"?\nThis cannot be undone.`)) return;
      state.characters = state.characters.filter(c => c.id !== character.id);
      if (state.selectedCharacterId === character.id) {
        state.selectedCharacterId = null;
        showCharacterList();
      }
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

    li.addEventListener('keydown', (e) => {
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

  document.body.classList.toggle('concentrating', !!getConcentration(c));
  document.getElementById("character-name").textContent = c.name;

  const curEl = document.getElementById('hp-current');
  const maxEl = document.getElementById('hp-max');
  if (curEl) curEl.textContent = c.currentHP;
  if (maxEl) maxEl.textContent = c.maxHP;

  const tempInline = document.getElementById('hp-temp-inline');
  if (tempInline) tempInline.value = c.tempHP > 0 ? c.tempHP : '';

  const fill = document.getElementById('hp-bar-fill');
  if (fill) {
    const pct = c.maxHP > 0
      ? Math.max(0, Math.min(100, Math.round((c.currentHP / c.maxHP) * 100)))
      : 0;
    fill.style.width = pct + '%';
  }

  renderResources(c);
  renderSpellSlots(c);
  renderStatuses(c);
}

// ─── HP ───────────────────────────────────────────────────────────────────────

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
  if (amount > 0 && getConcentration(c)) {
    const dc = Math.max(10, Math.floor(amount / 2));
    document.getElementById('concentration-modal-text').textContent =
      `${c.name} must make a DC ${dc} CON save to maintain concentration.`;
    document.getElementById('concentration-modal').hidden = false;
  }
}

function heal(amount) {
  const c = getSelectedCharacter();
  if (!c) return;
  c.currentHP = Math.min(c.maxHP, c.currentHP + amount);
  saveState();
  renderSession();
}

// ─── Resources ────────────────────────────────────────────────────────────────

function renderResources(c) {
  const container = document.getElementById('resources-container');
  const template = document.getElementById('resource-template');
  container.innerHTML = '';

  c.resources.forEach(r => {
    const el = template.content.firstElementChild.cloneNode(true);
    el.querySelector('[data-key="label"]').textContent = r.name;

    const controls = el.querySelector('[data-key="controls"]');
    controls.innerHTML = '';

    const dec = document.createElement('button');
    dec.className = 'decrement small-btn slot-decr';
    dec.textContent = '-';
    dec.addEventListener('click', () => {
      r.current = Math.max(0, r.current - 1);
      saveState(); renderSession();
    });

    const val = document.createElement('div');
    val.className = 'resource-value';
    val.textContent = `${r.current} / ${r.max}`;

    const inc = document.createElement('button');
    inc.className = 'increment small-btn slot-incr';
    inc.textContent = '+';
    inc.addEventListener('click', () => {
      r.current = Math.min(r.max, r.current + 1);
      saveState(); renderSession();
    });

    controls.appendChild(dec);
    controls.appendChild(val);
    controls.appendChild(inc);

    const removeBtn = el.querySelector('.slot-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        if (!confirm(`Remove resource "${r.name}"?`)) return;
        c.resources = c.resources.filter(x => x.id !== r.id);
        saveState(); renderSession();
      });
    }

    container.appendChild(el);
  });
}

// ─── Spell Slots ──────────────────────────────────────────────────────────────

function renderSpellSlots(c) {
  const container = document.getElementById('spellslots-container');
  const template = document.getElementById('spellslot-template');
  container.innerHTML = '';

  if (Array.isArray(c.spellSlots)) {
    let changed = false;
    c.spellSlots.forEach(s => {
      const shouldBePact = s.recoversOn === 'short';
      if (!!s.pact !== shouldBePact) { s.pact = shouldBePact; changed = true; }
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
      const span = document.createElement('span');
      span.className = 'pact-badge';
      span.textContent = 'Pact';
      labelEl.appendChild(span);
    }

    const controls = el.querySelector('[data-key="controls"]');
    controls.innerHTML = '';

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
      cb.addEventListener('change', () => {
        s.used = Array.from(controls.querySelectorAll('input[type="checkbox"]'))
          .filter(x => x.checked).length;
        saveState();
      });

      const box = document.createElement('span');
      box.className = 'slot-box';

      wrapper.appendChild(cb);
      wrapper.appendChild(box);
      controls.appendChild(wrapper);
    }

    const removeBtn = el.querySelector('.slot-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        if (!confirm(`Remove spell slots level ${s.level}${s.pact ? ' (pact)' : ''}?`)) return;
        c.spellSlots = c.spellSlots.filter(x => x.id !== s.id);
        saveState(); renderSession();
      });
    }

    container.appendChild(el);
  });
}

// ─── Spell Slot Calculation ───────────────────────────────────────────────────

function computeSlotsForEffectiveLevel(eff) {
  eff = Math.max(0, Math.floor(eff || 0));
  if (eff < 1) return [0,0,0,0,0,0,0,0,0];
  const table = {
    1:[2,0,0,0,0,0,0,0,0], 2:[3,0,0,0,0,0,0,0,0], 3:[4,2,0,0,0,0,0,0,0],
    4:[4,3,0,0,0,0,0,0,0], 5:[4,3,2,0,0,0,0,0,0], 6:[4,3,3,0,0,0,0,0,0],
    7:[4,3,3,1,0,0,0,0,0], 8:[4,3,3,2,0,0,0,0,0], 9:[4,3,3,3,1,0,0,0,0],
    10:[4,3,3,3,2,0,0,0,0],11:[4,3,3,3,2,1,0,0,0],12:[4,3,3,3,2,1,0,0,0],
    13:[4,3,3,3,2,1,1,0,0],14:[4,3,3,3,2,1,1,0,0],15:[4,3,3,3,2,1,1,1,0],
    16:[4,3,3,3,2,1,1,1,0],17:[4,3,3,3,2,1,1,1,1],18:[4,3,3,3,3,1,1,1,1],
    19:[4,3,3,3,3,2,1,1,1],20:[4,3,3,3,3,2,2,1,1]
  };
  return (table[Math.max(1, Math.min(20, eff))] || new Array(9).fill(0)).slice();
}

function computeHalfCasterSlots(level) {
  const map = {
    1:[0,0,0,0,0,0,0,0,0], 2:[2,0,0,0,0,0,0,0,0], 3:[3,0,0,0,0,0,0,0,0],
    4:[3,0,0,0,0,0,0,0,0], 5:[4,2,0,0,0,0,0,0,0], 6:[4,2,0,0,0,0,0,0,0],
    7:[4,3,0,0,0,0,0,0,0], 8:[4,3,0,0,0,0,0,0,0], 9:[4,3,2,0,0,0,0,0,0],
    10:[4,3,2,0,0,0,0,0,0],11:[4,3,3,0,0,0,0,0,0],12:[4,3,3,0,0,0,0,0,0],
    13:[4,3,3,1,0,0,0,0,0],14:[4,3,3,1,0,0,0,0,0],15:[4,3,3,2,0,0,0,0,0],
    16:[4,3,3,2,0,0,0,0,0],17:[4,3,3,3,1,0,0,0,0],18:[4,3,3,3,1,0,0,0,0],
    19:[4,3,3,3,2,0,0,0,0],20:[4,3,3,3,2,0,0,0,0]
  };
  return map[Math.max(1, Math.min(20, level))] || [];
}

function buildSpellSlotsFromCasterInfo(fullCasterLevel, halfCasterLevel, pactLevel) {
  const full = Math.max(0, parseInt(fullCasterLevel || 0, 10));
  let half = Math.max(0, parseInt(halfCasterLevel || 0, 10));
  let pact = Math.max(0, parseInt(pactLevel || 0, 10));

  const total = full + half + pact;
  if (total > 20) {
    let over = total - 20;
    if (pact >= over) { pact -= over; over = 0; }
    else { over -= pact; pact = 0; }
    if (over > 0) half = Math.max(0, half - over);
    console.warn('Caster levels exceeded 20 and were adjusted.');
  }

  const slotsPerLevel = (full === 0 && half > 0)
    ? computeHalfCasterSlots(half)
    : computeSlotsForEffectiveLevel(Math.floor(full + 0.5 * half));

  const out = [];
  slotsPerLevel.forEach((count, idx) => {
    if (count > 0) out.push({ id: crypto.randomUUID(), level: idx + 1, max: count, used: 0, recoversOn: 'long', pact: false });
  });

  if (pact > 0) {
    out.push({
      id: crypto.randomUUID(),
      level: Math.min(Math.ceil(pact / 2), 5),
      max: pact === 1 ? 1 : 2,
      used: 0,
      recoversOn: 'short',
      pact: true
    });
  }

  const merged = {};
  out.forEach(s => {
    const key = `${s.level}-${s.recoversOn}-${s.pact ? 'p' : 'c'}`;
    if (!merged[key]) merged[key] = { ...s };
    else {
      merged[key].max += s.max;
      merged[key].used = Math.min(merged[key].max, merged[key].used + s.used);
    }
  });

  return Object.values(merged).sort((a, b) => {
    if (a.pact && !b.pact) return -1;
    if (!a.pact && b.pact) return 1;
    return a.level - b.level;
  });
}

// ─── Conditions & Concentration ───────────────────────────────────────────────

const STANDARD_CONDITIONS = [
  'Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated',
  'Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious'
];

function hasCondition(c, name) {
  return c.statuses.some(s => s.name === name);
}

function toggleCondition(c, name) {
  if (hasCondition(c, name)) {
    c.statuses = c.statuses.filter(s => s.name !== name);
  } else {
    c.statuses.push({ id: crypto.randomUUID(), name, remaining: 0, durationType: 'rest' });
  }
  saveState();
  renderSession();
}

function getConcentration(c) { return c.concentration || null; }

function toggleConcentration(c) {
  if (getConcentration(c)) {
    if (!confirm('Stop concentrating?')) return;
    delete c.concentration;
  } else {
    c.concentration = { since: Date.now() };
  }
  saveState();
  renderSession();
}

function renderStatuses(c) {
  const container = document.getElementById('status-container');
  container.innerHTML = '';

  c.statuses.forEach(st => {
    const div = document.createElement('div');
    div.className = 'status-item card small';
    div.textContent = `${st.name}${st.remaining ? ` (${st.remaining} ${st.durationType || ''})` : ''}`;

    const remove = document.createElement('button');
    remove.className = 'link-btn';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      c.statuses = c.statuses.filter(x => x.id !== st.id);
      saveState(); renderSession();
    });

    div.appendChild(remove);
    container.appendChild(div);
  });

  const grid = document.getElementById('condition-grid');
  if (!grid) return;
  grid.innerHTML = '';

  STANDARD_CONDITIONS.forEach(cond => {
    const btn = document.createElement('button');
    btn.className = 'condition-btn';
    btn.textContent = cond;
    if (hasCondition(c, cond)) btn.classList.add('active');
    btn.addEventListener('click', () => toggleCondition(c, cond));
    grid.appendChild(btn);
  });

  const conc = getConcentration(c);
  const concBtn = document.getElementById('concentration-toggle');
  if (concBtn) {
    concBtn.classList.toggle('active', !!conc);
    concBtn.setAttribute('aria-pressed', !!conc);
    concBtn.textContent = conc && conc.spell ? `Concentrating: ${conc.spell}` : 'Concentrate';
    concBtn.onclick = () => toggleConcentration(c);
  }

  const banner = document.getElementById('concentration-banner');
  if (banner) {
    banner.hidden = !conc;
    if (conc) banner.textContent = `${c.name} is concentrating. Damage while concentrating requires a CON save to maintain it, with a separate save for each damage source.`;
  }
}

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
  c.resources.forEach(r => { if (r.recoversOn === 'long' || r.recoversOn === 'short') r.current = r.max; });
  c.spellSlots.forEach(s => { if (s.recoversOn === 'long' || s.recoversOn === 'short') s.used = 0; });
  c.currentHP = c.maxHP;
  c.tempHP = 0;
  c.deathSaves = { success: 0, failure: 0 };
  saveState(); renderSession();
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(msg, ms = 1200) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  t.classList.add('show');
  setTimeout(() => { t.classList.remove('show'); t.hidden = true; }, ms);
}

// ─── PWA ──────────────────────────────────────────────────────────────────────

(function initPWA() {
  let deferredPrompt;
  const installBtn = document.getElementById('pwa-install-btn');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
    installBtn.removeAttribute('aria-hidden');
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
    installBtn.setAttribute('aria-hidden', 'true');
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('pwa/service-worker.js')
      .then(() => console.log('SW registered'))
      .catch(err => console.warn('SW failed', err));
  }
})();

// ─── Export / Import ─────────────────────────────────────────────────────────

document.getElementById('export-btn').addEventListener('click', () => {
  try {
    const blob = new Blob([localStorage.getItem('dndTrackerState') || '{}'], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: 'dnd-tracker-export.json'
    });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  } catch (err) { alert('Export failed: ' + err.message); }
});

document.getElementById('import-btn').addEventListener('click', () => {
  document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed || !Array.isArray(parsed.characters)) throw new Error('Invalid file format');
    localStorage.setItem('dndTrackerState', JSON.stringify(parsed));
    location.reload();
  } catch (err) { alert('Import failed: ' + err.message); }
});

// ─── Character Modal ──────────────────────────────────────────────────────────

(function initCharacterModal() {
  const modal = document.getElementById('character-modal');
  const form = document.getElementById('character-form');
  const addBtn = document.getElementById('add-character-btn');
  const cancelBtn = document.getElementById('character-cancel');
  const nameInput = document.getElementById('character-form-name');
  const maxInput = document.getElementById('character-form-maxhp');
  const saveBtn = document.getElementById('character-save');
  const errorEl = document.getElementById('character-form-error');

  const open = () => { modal.hidden = false; nameInput.focus(); };
  const close = () => { modal.hidden = true; addBtn.focus(); };

  addBtn.addEventListener('click', open);
  cancelBtn.addEventListener('click', close);
  modal.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  function getFields() {
    return {
      name: nameInput.value.trim(),
      max: parseInt(maxInput.value, 10),
      full: parseInt(document.getElementById('character-form-fullcaster').value, 10),
      half: parseInt(document.getElementById('character-form-halfcaster').value, 10),
      pact: parseInt(document.getElementById('character-form-pactlevel').value, 10)
    };
  }

  function validate() {
    errorEl.hidden = true;
    const { name, max, full, half, pact } = getFields();
    const fail = (msg) => { errorEl.textContent = msg; errorEl.hidden = false; saveBtn.disabled = true; return false; };
    if (!name) return fail('Please enter a character name.');
    if (!Number.isInteger(max) || max < 1) return fail('Max HP must be a positive number.');
    if (!Number.isInteger(full) || full < 0 || full > 20) return fail('Full caster level must be 0–20.');
    if (!Number.isInteger(half) || half < 0 || half > 20) return fail('Half caster level must be 0–20.');
    if (!Number.isInteger(pact) || pact < 0 || pact > 20) return fail('Pact magic level must be 0–20.');
    if (full + half + pact > 20) return fail('Total character level cannot exceed 20.');
    saveBtn.disabled = false;
    return true;
  }

  ['character-form-name','character-form-maxhp','character-form-fullcaster',
   'character-form-halfcaster','character-form-pactlevel'].forEach(id => {
    document.getElementById(id).addEventListener('input', validate);
  });
  validate();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate()) return;
    const { name, max, full, half, pact } = getFields();

    const newCharacter = {
      id: crypto.randomUUID(),
      name,
      maxHP: max,
      currentHP: max,
      tempHP: 0,
      deathSaves: { success: 0, failure: 0 },
      spellSlots: buildSpellSlotsFromCasterInfo(full, half, pact),
      resources: [],
      statuses: []
    };

    state.characters.push(newCharacter);
    saveState();
    renderCharacterList();
    close();
    form.reset();
    saveBtn.disabled = true;

    setTimeout(() => {
      const li = document.querySelector(`[data-id="${newCharacter.id}"]`);
      if (li) { li.scrollIntoView({ behavior: 'smooth', block: 'center' }); li.click(); }
    }, 50);

    const slotSummary = newCharacter.spellSlots.length
      ? newCharacter.spellSlots.map(s => `${s.level}L:${s.max}${s.pact ? '(pact)' : ''}`).join(', ')
      : 'No spell slots';
    showToast(`Added '${name}' — ${slotSummary}`);
  });
})();

// ─── Back Button ─────────────────────────────────────────────────────────────

document.getElementById("back-btn").addEventListener("click", () => {
  state.selectedCharacterId = null;
  saveState();
  showCharacterList();
  renderCharacterList();
});

// ─── HP Controls ─────────────────────────────────────────────────────────────

(function initHPControls() {
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

  const tempInline = document.getElementById('hp-temp-inline');
  tempInline.addEventListener('change', () => {
    const c = getSelectedCharacter();
    if (!c) return;
    c.tempHP = Math.max(0, parseInt(tempInline.value, 10) || 0);
    saveState(); renderSession();
  });
  tempInline.addEventListener('keydown', e => { if (e.key === 'Enter') tempInline.blur(); });
})();

// ─── Rest Buttons ────────────────────────────────────────────────────────────

document.getElementById('short-rest').addEventListener('click', () => {
  if (!confirm('Take a short rest? This will restore short-rest resources and slots.')) return;
  shortRest();
  showToast('Short rest: short-rest resources restored');
  flashBar();
});

document.getElementById('long-rest').addEventListener('click', () => {
  if (!confirm('Take a long rest? This will restore HP and all resources.')) return;
  longRest();
  showToast('Long rest: HP and all resources restored');
  flashBar();
});

function flashBar() {
  const fill = document.getElementById('hp-bar-fill');
  if (!fill) return;
  fill.classList.add('hp-bar-flash');
  setTimeout(() => fill.classList.remove('hp-bar-flash'), 900);
}

// ─── Resource Modal ───────────────────────────────────────────────────────────

(function initResourceModal() {
  const modal = document.getElementById('resource-modal');
  const form = document.getElementById('resource-form');
  const openBtn = document.getElementById('add-resource-btn');
  const cancelBtn = document.getElementById('resource-cancel');
  const nameInput = document.getElementById('resource-form-name');
  const maxInput = document.getElementById('resource-form-max');
  const recoversInput = document.getElementById('resource-form-recoversOn');
  const errorEl = document.getElementById('resource-form-error');

  const open = () => { modal.hidden = false; nameInput.focus(); };
  const close = () => { modal.hidden = true; openBtn.focus(); };

  openBtn.addEventListener('click', open);
  cancelBtn.addEventListener('click', close);
  modal.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    const name = nameInput.value.trim();
    const max = parseInt(maxInput.value, 10) || 1;
    const recoversOn = recoversInput.value || 'none';
    if (!name) { errorEl.textContent = 'Please enter a name.'; errorEl.hidden = false; return; }
    if (!Number.isInteger(max) || max < 1) { errorEl.textContent = 'Max must be 1 or more.'; errorEl.hidden = false; return; }
    const c = getSelectedCharacter();
    if (!c) { errorEl.textContent = 'No character selected.'; errorEl.hidden = false; return; }
    c.resources.push({ id: crypto.randomUUID(), name, current: max, max, recoversOn });
    saveState(); renderSession();
    close(); form.reset();
    showToast(`Added resource '${name}'`);
  });
})();

// ─── Spell Slot Modal ─────────────────────────────────────────────────────────

(function initSpellSlotModal() {
  const modal = document.getElementById('spellslot-modal');
  const form = document.getElementById('spellslot-form');
  const openBtn = document.getElementById('add-spellslot-btn');
  const cancelBtn = document.getElementById('spellslot-cancel');
  const levelInput = document.getElementById('spellslot-form-level');
  const maxInput = document.getElementById('spellslot-form-max');
  const recoversInput = document.getElementById('spellslot-form-recoversOn');
  const errorEl = document.getElementById('spellslot-form-error');

  const open = () => { modal.hidden = false; levelInput.focus(); };
  const close = () => { modal.hidden = true; openBtn.focus(); };

  openBtn.addEventListener('click', open);
  cancelBtn.addEventListener('click', close);
  modal.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    const level = parseInt(levelInput.value, 10) || 1;
    const max = parseInt(maxInput.value, 10) || 0;
    const recoversOn = recoversInput.value || 'long';
    if (level < 1 || level > 9) { errorEl.textContent = 'Level must be 1–9.'; errorEl.hidden = false; return; }
    if (max < 0) { errorEl.textContent = 'Max must be 0 or more.'; errorEl.hidden = false; return; }
    const c = getSelectedCharacter();
    if (!c) { errorEl.textContent = 'No character selected.'; errorEl.hidden = false; return; }
    c.spellSlots.push({ id: crypto.randomUUID(), level, max, used: 0, recoversOn, pact: recoversOn === 'short' });
    saveState(); renderSession();
    close(); form.reset();
    showToast(`Added level ${level} spell slots`);
  });
})();

// ─── Init ─────────────────────────────────────────────────────────────────────

try {
  renderCharacterList();
  if (state.selectedCharacterId) {
    renderSession();
    showSession();
  } else {
    showCharacterList();
  }
} catch (err) {
  console.error('Error rendering initial UI:', err);
}

document.getElementById('concentration-modal-dismiss').addEventListener('click', () => {
  document.getElementById('concentration-modal').hidden = true;
});