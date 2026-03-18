// ─── Inventory ────────────────────────────────────────────────────────────────
import { saveState, getSelectedCharacter } from './state.js';
import { editMode, showToast, makeSwipeable } from './ui.js';

export const COIN_ORDER = ['cp', 'sp', 'ep', 'gp', 'pp'];
export const COIN_IN_CP = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };

export function coinsToCP(coins) {
  return COIN_ORDER.reduce((sum, d) => sum + (coins[d] || 0) * COIN_IN_CP[d], 0);
}

export function spendCoins(c, gpAmount) {
  if (!c.coins) c.coins = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
  return _spendCP(c, Math.round(gpAmount * COIN_IN_CP.gp), 'gp');
}

function _spendCP(c, spendCP, preferDenom) {
  if (coinsToCP(c.coins) < spendCP) { showToast('Not enough coins!'); return false; }

  const coins     = { ...c.coins };
  const prefVal   = COIN_IN_CP[preferDenom];
  let   remaining = spendCP; // in CP

  // Step 1: drain preferred denom (whole units)
  if ((coins[preferDenom] || 0) > 0) {
    const canUse        = Math.min(coins[preferDenom], Math.floor(remaining / prefVal));
    coins[preferDenom] -= canUse;
    remaining          -= canUse * prefVal;
  }

  if (remaining <= 0) { c.coins = coins; return true; }

  const ORDER = ['cp', 'sp', 'ep', 'gp', 'pp'];
  const prefIdx = ORDER.indexOf(preferDenom);

  let smallCP = 0;
  for (let i = 0; i < prefIdx; i++) {
    const d = ORDER[i];
    smallCP += (coins[d] || 0) * COIN_IN_CP[d];
  }

  const fromSmall = Math.floor(smallCP / prefVal);
  if (fromSmall > 0) {
    let toConsume = fromSmall * prefVal;
    for (let i = prefIdx - 1; i >= 0; i--) {
      if (toConsume <= 0) break;
      const d    = ORDER[i];
      const val  = COIN_IN_CP[d];
      const have = coins[d] || 0;
      if (have <= 0) continue;
      const use  = Math.min(have, Math.floor(toConsume / val));
      coins[d]  -= use;
      toConsume -= use * val;
    }
    coins[preferDenom] = (coins[preferDenom] || 0) + fromSmall;
  }

  if ((coins[preferDenom] || 0) > 0) {
    const canUse        = Math.min(coins[preferDenom], Math.floor(remaining / prefVal));
    coins[preferDenom] -= canUse;
    remaining          -= canUse * prefVal;
  }

  if (remaining <= 0) { c.coins = coins; return true; }

  for (let i = prefIdx + 1; i < ORDER.length; i++) {
    if (remaining <= 0) break;
    const d   = ORDER[i];
    const val = COIN_IN_CP[d];
    if ((coins[d] || 0) <= 0) continue;

    coins[d]--;
    const change = val - remaining;
    remaining = 0;
    coins[preferDenom] = (coins[preferDenom] || 0) + Math.floor(change / prefVal);
  }

  if (remaining > 0) { showToast('Not enough coins!'); return false; }
  c.coins = coins;
  return true;
}

export function renderInventory(c) {
  if (!c.coins)      c.coins = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
  if (!c.items)      c.items = [];
  if (!c.components) c.components = [];
  if (!('attunement'    in c)) c.attunement    = 0;
  if (!('attunementMax' in c)) c.attunementMax = 3;

  COIN_ORDER.forEach(denom => {
    const input = document.querySelector(`.coin-box[data-coin="${denom}"] .coin-input`);
    if (input) input.value = c.coins[denom] || 0;
  });

  const boxesEl = document.getElementById('attunement-boxes');
  boxesEl.innerHTML = '';

  for (let i = 0; i < c.attunementMax; i++) {
    const label = document.createElement('label');
    label.className = 'slot-toggle';
    label.title = `Attunement slot ${i + 1}`;
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.className = 'slot-checkbox'; cb.checked = c.attunement > i;
    cb.setAttribute('aria-label', `Attunement slot ${i + 1}`);
    cb.addEventListener('change', () => {
      if (c.locked) { cb.checked = c.attunement > i; return; }
      if (editMode) {
        if (c.attunementMax > 3) { c.attunementMax--; c.attunement = Math.min(c.attunement, c.attunementMax); }
      } else {
        c.attunement = cb.checked ? Math.min(c.attunementMax, c.attunement + 1) : Math.max(0, c.attunement - 1);
      }
      saveState(); renderInventory(c);
    });
    const box = document.createElement('span'); box.className = 'slot-box attunement-box';
    label.appendChild(cb); label.appendChild(box); boxesEl.appendChild(label);
  }

  if (c.attunementMax < 6) {
    const addLabel = document.createElement('label');
    addLabel.className = 'slot-toggle slot-add-toggle'; addLabel.title = 'Add attunement slot';
    const addBox = document.createElement('span');
    addBox.className = 'slot-box attunement-box slot-add-box'; addBox.textContent = '+';
    addLabel.appendChild(addBox);
    addLabel.addEventListener('click', () => { if (!editMode) return; c.attunementMax++; saveState(); renderInventory(c); });
    boxesEl.appendChild(addLabel);
  }

  renderItemList(c, c.items,      document.getElementById('items-container'),      item => { c.items      = c.items.filter(x => x.id !== item.id); });
  renderItemList(c, c.components, document.getElementById('components-container'), item => { c.components = c.components.filter(x => x.id !== item.id); }, true);

  document.getElementById('add-item-btn').hidden      = !editMode;
  document.getElementById('add-component-btn').hidden = !editMode;
}

function renderItemList(c, list, container, onDelete, isComponent = false) {
  container.innerHTML = '';
  if (!list || list.length === 0) {
    const msg = document.createElement('p'); msg.className = 'empty-state';
    msg.textContent = isComponent ? 'No components — tap ✎ then + Add Component' : 'No items — tap ✎ then + Add Item';
    container.appendChild(msg); return;
  }
  list.forEach(item => {
    const el = document.createElement('div');
    if (isComponent) { el.className = 'component-card card small'; _buildComponentCard(el, item, c, onDelete); }
    else             { el.className = 'item-row card small';        _buildItemCard(el, item, c, onDelete); }
    container.appendChild(el);
  });
}

function _buildItemCard(el, item, c, onDelete) {
  const left = document.createElement('div'); left.className = 'item-left';
  const right = document.createElement('div'); right.className = 'item-right';
  const nameEl = document.createElement('div'); nameEl.className = 'item-name'; nameEl.textContent = item.name;
  left.appendChild(nameEl);
  if (item.attuned) {
    const badgesEl = document.createElement('div'); badgesEl.className = 'item-badges';
    const b = document.createElement('span'); b.className = 'item-badge attuned-badge'; b.textContent = '⟳ Attuned';
    badgesEl.appendChild(b); left.appendChild(badgesEl);
  }
  const dec = document.createElement('button'); dec.className = 'item-qty-btn'; dec.textContent = '−';
  dec.addEventListener('click', () => {
    if (c.locked) return;
    if (item.qty <= 1) { if (editMode) { onDelete(item); saveState(); renderInventory(c); } return; }
    item.qty--; saveState(); renderInventory(c);
  });
  const qtyEl = document.createElement('span'); qtyEl.className = 'item-qty'; qtyEl.textContent = item.qty;
  const inc = document.createElement('button'); inc.className = 'item-qty-btn'; inc.textContent = '+';
  inc.addEventListener('click', () => { if (c.locked) return; item.qty++; saveState(); renderInventory(c); });
  right.appendChild(dec); right.appendChild(qtyEl); right.appendChild(inc);
  el.appendChild(left); el.appendChild(right);
  makeSwipeable(el, () => { onDelete(item); saveState(); renderInventory(c); });
}

function _buildComponentCard(el, item, c, onDelete) {
  const topRow = document.createElement('div'); topRow.className = 'component-top-row';
  const nameEl = document.createElement('span'); nameEl.className = 'item-name'; nameEl.textContent = item.name;
  topRow.appendChild(nameEl);

  if (!editMode) {
    if (item.qty === null) {
      const remEl = document.createElement('span'); remEl.className = 'component-meta component-remaining'; remEl.textContent = `${item.gpAmount} gp`;
      topRow.appendChild(remEl);
    } else {
      const leftGroup = document.createElement('div'); leftGroup.className = 'component-name-group';
      leftGroup.appendChild(nameEl);
      const priceEl = document.createElement('span'); priceEl.className = 'component-meta'; priceEl.textContent = `${item.price} gp`;
      leftGroup.appendChild(priceEl);
      topRow.insertBefore(leftGroup, topRow.firstChild);
      const qtyEl = document.createElement('span'); qtyEl.className = 'component-meta component-remaining'; qtyEl.textContent = `${item.qty} left`;
      topRow.appendChild(qtyEl);
    }
  }
  el.appendChild(topRow);

  if (editMode) {
    const editBtn = document.createElement('button'); editBtn.className = 'item-use-btn'; editBtn.textContent = '✎ Edit';
    editBtn.style.cssText = 'border-color:var(--muted);color:var(--muted);width:100%;margin-top:0.4rem;';
    editBtn.addEventListener('click', () => _openComponentEditModal(item, c));
    el.appendChild(editBtn);
  } else if (item.qty === null) {
    const actionRow = document.createElement('div'); actionRow.className = 'component-action-row';
    const useBtn = document.createElement('button'); useBtn.className = 'hp-action-pill damage component-action-pill'; useBtn.textContent = 'Use';
    const amtInput = document.createElement('input'); amtInput.type = 'number'; amtInput.min = '0'; amtInput.placeholder = '0'; amtInput.className = 'hp-amount-input component-amount-input'; amtInput.setAttribute('aria-label', 'GP amount');
    const buyBtn = document.createElement('button'); buyBtn.className = 'hp-action-pill heal component-action-pill'; buyBtn.textContent = 'Buy';
    useBtn.addEventListener('click', () => {
      if (c.locked) return;
      const amount = parseFloat(amtInput.value) || 0;
      if (amount <= 0) { amtInput.focus(); return; }
      if (amount > item.gpAmount) { showToast(`Only ${item.gpAmount} gp left`); return; }
      item.gpAmount = Math.max(0, item.gpAmount - amount);
      amtInput.value = ''; saveState(); renderInventory(c);
      showToast(`Used ${amount} gp — ${item.name} (${item.gpAmount} gp left)`);
    });
    buyBtn.addEventListener('click', () => {
      if (c.locked) return;
      const amount = parseFloat(amtInput.value) || 0;
      if (amount <= 0) { amtInput.focus(); return; }
      if (!spendCoins(c, amount)) return;
      item.gpAmount = (item.gpAmount || 0) + amount;
      amtInput.value = ''; saveState(); renderInventory(c);
      showToast(`Bought ${amount} gp of ${item.name}`);
    });
    actionRow.appendChild(useBtn); actionRow.appendChild(amtInput); actionRow.appendChild(buyBtn);
    el.appendChild(actionRow);
  } else {
    const actionRow = document.createElement('div'); actionRow.className = 'component-action-row';
    const useBtn = document.createElement('button'); useBtn.className = 'hp-action-pill damage component-action-pill'; useBtn.textContent = 'Use';
    const buyBtn = document.createElement('button'); buyBtn.className = 'hp-action-pill heal component-action-pill'; buyBtn.textContent = 'Buy';
    useBtn.addEventListener('click', () => {
      if (c.locked) return;
      if (item.qty <= 0) { showToast(`No ${item.name} remaining`); return; }
      item.qty--; saveState(); renderInventory(c);
      showToast(`Used 1 ${item.name} (${item.qty} left)`);
    });
    buyBtn.addEventListener('click', () => {
      if (c.locked) return;
      const cost = item.price || 0;
      if (cost > 0 && !spendCoins(c, cost)) return;
      item.qty++; saveState(); renderInventory(c);
      showToast(cost > 0 ? `Bought 1 ${item.name} for ${cost} gp` : `Added 1 ${item.name}`);
    });
    actionRow.appendChild(useBtn); actionRow.appendChild(buyBtn);
    el.appendChild(actionRow);
  }
  makeSwipeable(el, () => { onDelete(item); saveState(); renderInventory(c); });
}

let _compEditItem = null;
let _compEditChar = null;

function _openComponentEditModal(item, c) {
  _compEditItem = item; _compEditChar = c;
  const isPool = item.qty === null;
  document.getElementById('component-edit-modal-title').textContent = `Edit: ${item.name}`;
  document.getElementById('component-edit-mode-pool').hidden = !isPool;
  document.getElementById('component-edit-mode-qty').hidden  =  isPool;
  if (isPool) document.getElementById('component-edit-gp').value = item.gpAmount;
  else { document.getElementById('component-edit-price').value = item.price; document.getElementById('component-edit-qty').value = item.qty; }
  document.getElementById('component-edit-error').hidden = true;
  document.getElementById('component-edit-modal').hidden = false;
}

export function initInventoryControls() {
  document.querySelectorAll('.coin-input').forEach(input => {
    const denom = input.closest('.coin-box').dataset.coin;
    input.addEventListener('change', () => {
      const c = getSelectedCharacter(); if (!c || c.locked) { renderInventory(c); return; }
      if (!c.coins) c.coins = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
      c.coins[denom] = Math.max(0, parseInt(input.value, 10) || 0);
      input.value = c.coins[denom]; saveState();
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
  });

  document.getElementById('coin-add').addEventListener('click', () => {
    const c = getSelectedCharacter(); if (!c || c.locked) return;
    if (!c.coins) c.coins = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
    const amount = parseInt(document.getElementById('coin-amount').value, 10) || 0;
    const denom  = document.getElementById('coin-denom').value;
    if (amount <= 0) return;
    c.coins[denom] = (c.coins[denom] || 0) + amount;
    document.getElementById('coin-amount').value = '';
    saveState(); renderInventory(c); showToast(`+${amount} ${denom.toUpperCase()}`);
  });

  document.getElementById('coin-spend').addEventListener('click', () => {
    const c = getSelectedCharacter(); if (!c || c.locked) return;
    if (!c.coins) c.coins = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
    const amount = parseInt(document.getElementById('coin-amount').value, 10) || 0;
    const denom  = document.getElementById('coin-denom').value;
    if (amount <= 0) return;
    if (!_spendCP(c, amount * COIN_IN_CP[denom], denom)) return;
    document.getElementById('coin-amount').value = '';
    saveState(); renderInventory(c); showToast(`−${amount} ${denom.toUpperCase()}`);
  });

  document.getElementById('coin-convert').addEventListener('click', () => {
    const c = getSelectedCharacter(); if (!c || c.locked) return;
    if (!c.coins) c.coins = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
    let rem = c.coins.cp || 0; c.coins.sp = (c.coins.sp||0) + Math.floor(rem/10); c.coins.cp = rem%10;
    rem = c.coins.sp;          c.coins.gp = (c.coins.gp||0) + Math.floor(rem/10); c.coins.sp = rem%10;
    rem = c.coins.gp;          c.coins.pp = (c.coins.pp||0) + Math.floor(rem/10); c.coins.gp = rem%10;
    saveState(); renderInventory(c); showToast('Coins converted');
  });

  (function() {
    const modal = document.getElementById('item-modal'), form = document.getElementById('item-form'),
          openBtn = document.getElementById('add-item-btn'), cancel = document.getElementById('item-cancel'),
          nameIn = document.getElementById('item-form-name'), qtyIn = document.getElementById('item-form-qty'),
          attIn = document.getElementById('item-form-attuned'), errEl = document.getElementById('item-form-error');
    const open = () => { form.reset(); qtyIn.value = 1; errEl.hidden = true; modal.hidden = false; nameIn.focus(); };
    const close = () => { modal.hidden = true; };
    openBtn.addEventListener('click', open); cancel.addEventListener('click', close);
    modal.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    form.addEventListener('submit', e => {
      e.preventDefault(); errEl.hidden = true;
      const name = nameIn.value.trim();
      if (!name) { errEl.textContent = 'Please enter a name.'; errEl.hidden = false; return; }
      const c = getSelectedCharacter(); if (!c) return;
      if (!c.items) c.items = [];
      if (attIn.checked && c.items.filter(i => i.attuned).length >= 3) {
        errEl.textContent = 'Already at 3 attuned items (max).'; errEl.hidden = false; return;
      }
      c.items.push({ id: crypto.randomUUID(), name, qty: Math.max(1, parseInt(qtyIn.value,10)||1), attuned: attIn.checked });
      saveState(); renderInventory(c); close(); showToast(`Added '${name}'`);
    });
  })();

  (function() {
    const modal = document.getElementById('component-modal'), form = document.getElementById('component-form'),
          openBtn = document.getElementById('add-component-btn'), cancel = document.getElementById('component-cancel'),
          nameIn = document.getElementById('component-form-name'), gpIn = document.getElementById('component-form-gp'),
          qtyIn = document.getElementById('component-form-qty'), errEl = document.getElementById('component-form-error');
    const open = () => { form.reset(); errEl.hidden = true; modal.hidden = false; nameIn.focus(); };
    const close = () => { modal.hidden = true; };
    openBtn.addEventListener('click', open); cancel.addEventListener('click', close);
    modal.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    form.addEventListener('submit', e => {
      e.preventDefault(); errEl.hidden = true;
      const name = nameIn.value.trim(), gp = parseFloat(gpIn.value);
      if (!name)              { errEl.textContent = 'Please enter a name.'; errEl.hidden = false; return; }
      if (isNaN(gp) || gp<0) { errEl.textContent = 'Please enter a valid GP amount.'; errEl.hidden = false; return; }
      const c = getSelectedCharacter(); if (!c) return;
      if (!c.components) c.components = [];
      const qtyVal = qtyIn.value.trim(), hasQty = qtyVal !== '' && parseInt(qtyVal,10) >= 1;
      c.components.push(hasQty
        ? { id: crypto.randomUUID(), name, qty: parseInt(qtyVal,10), price: gp, gpAmount: null }
        : { id: crypto.randomUUID(), name, qty: null, price: null, gpAmount: gp }
      );
      saveState(); renderInventory(c); close(); showToast(`Added component '${name}'`);
    });
  })();

  (function() {
    const modal = document.getElementById('component-edit-modal'), form = document.getElementById('component-edit-form'),
          cancel = document.getElementById('component-edit-cancel');
    const close = () => { modal.hidden = true; };
    cancel.addEventListener('click', close);
    modal.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const item = _compEditItem, c = _compEditChar; if (!item || !c) return;
      if (item.qty === null) {
        const gp = parseFloat(document.getElementById('component-edit-gp').value);
        if (isNaN(gp)||gp<0) { document.getElementById('component-edit-error').textContent='Enter a valid GP amount.'; document.getElementById('component-edit-error').hidden=false; return; }
        item.gpAmount = gp;
      } else {
        item.price = Math.max(0, parseFloat(document.getElementById('component-edit-price').value)||0);
        item.qty   = Math.max(0, parseInt(document.getElementById('component-edit-qty').value,10)||0);
      }
      saveState(); renderInventory(c); close(); showToast(`Updated ${item.name}`);
    });
  })();
}