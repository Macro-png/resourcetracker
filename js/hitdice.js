// ─── Hit Dice ─────────────────────────────────────────────────────────────────

import { saveState, getSelectedCharacter } from "./state.js";
import { editMode, showToast, makeSwipeable } from "./ui.js";

export const HD_SIZES = ["d12", "d10", "d8", "d6"];

export function hdTotalAll(c) {
  return (c.hitDice || []).reduce((sum, hd) => sum + hd.total, 0);
}

export function mergeHitDicePools(c) {
  if (!c.hitDice) return;
  const merged = {};
  c.hitDice.forEach((hd) => {
    if (!merged[hd.dieType])
      merged[hd.dieType] = {
        id: hd.id,
        dieType: hd.dieType,
        total: 0,
        spent: 0,
      };
    merged[hd.dieType].total += hd.total;
    merged[hd.dieType].spent += hd.spent;
  });
  c.hitDice = HD_SIZES.map((d) => merged[d])
    .filter(Boolean)
    .concat(
      Object.values(merged).filter((hd) => !HD_SIZES.includes(hd.dieType)),
    );
}

// ─── Render ───────────────────────────────────────────────────────────────────

export function renderHitDice(c) {
  if (!c.hitDice) c.hitDice = [];
  mergeHitDicePools(c);

  const container = document.getElementById("hitdice-container");
  container.innerHTML = "";

  if (c.hitDice.length === 0) {
    const msg = document.createElement("p");
    msg.className = "empty-state";
    msg.textContent = "No hit dice — tap ✎ then + Add Pool";
    container.appendChild(msg);
    return;
  }

  c.hitDice.forEach((hd) => {
    const el = document.createElement("div");
    el.className = "spellslot-item card small";

    const slotRow = document.createElement("div");
    slotRow.className = "slot-row";

    const slotLeft = document.createElement("div");
    slotLeft.className = "slot-left";
    const labelEl = document.createElement("div");
    labelEl.className = "spellslot-label";
    labelEl.textContent = hd.dieType;
    slotLeft.appendChild(labelEl);
    slotRow.appendChild(slotLeft);

    const slotCenter = document.createElement("div");
    slotCenter.className = "slot-center";
    const controls = document.createElement("div");
    controls.className = "spellslot-controls hitdice-controls";

    for (let i = 0; i < hd.total; i++) {
      const lbl = document.createElement("label");
      lbl.className = "slot-toggle";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "slot-checkbox";
      cb.checked = i < hd.spent;
      cb.setAttribute("aria-label", `${hd.dieType} die ${i + 1}`);
      cb.addEventListener("change", () => {
        if (c.locked) {
          cb.checked = i < hd.spent;
          return;
        }
        if (editMode) {
          hd.total--;
          hd.spent = Math.min(hd.spent, hd.total);
          if (hd.total === 0)
            c.hitDice = c.hitDice.filter((x) => x.id !== hd.id);
          saveState();
          document.dispatchEvent(new CustomEvent("app:rerender"));
        } else {
          // Toggle spent directly — no heal prompt
          hd.spent = cb.checked
            ? Math.min(hd.total, hd.spent + 1)
            : Math.max(0, hd.spent - 1);
          saveState();
          document.dispatchEvent(new CustomEvent("app:rerender"));
        }
      });
      const box = document.createElement("span");
      box.className = "slot-box hitdice-box";
      lbl.appendChild(cb);
      lbl.appendChild(box);
      controls.appendChild(lbl);
    }

    if (hd.total < 20 && hdTotalAll(c) < 20) {
      const addLbl = document.createElement("label");
      addLbl.className = "slot-toggle slot-add-toggle";
      const addBox = document.createElement("span");
      addBox.className = "slot-box hitdice-box slot-add-box";
      addBox.textContent = "+";
      addLbl.appendChild(addBox);
      addLbl.addEventListener("click", () => {
        if (!editMode) return;
        if (hdTotalAll(c) >= 20) return;
        hd.total++;
        saveState();
        document.dispatchEvent(new CustomEvent("app:rerender"));
      });
      controls.appendChild(addLbl);
    }

    slotCenter.appendChild(controls);
    slotRow.appendChild(slotCenter);
    el.appendChild(slotRow);

    makeSwipeable(el, () => {
      c.hitDice = c.hitDice.filter((x) => x.id !== hd.id);
      saveState();
      document.dispatchEvent(new CustomEvent("app:rerender"));
    });

    container.appendChild(el);
  });
}

// ─── Short rest: counter per die size ─────────────────────────────────────────

export function promptHitDiceUse(c, onDone) {
  const modal = document.getElementById("hitdice-use-modal");
  const countersEl = document.getElementById("hitdice-use-counters");
  const healInput = document.getElementById("hitdice-use-healed");
  const errEl = document.getElementById("hitdice-use-error");
  const confirmBtn = document.getElementById("hitdice-use-confirm");
  const skipBtn = document.getElementById("hitdice-use-skip");

  const available = (c.hitDice || []).filter((hd) => hd.spent < hd.total);
  if (available.length === 0) {
    onDone(0);
    return;
  }

  countersEl.innerHTML = "";
  const selections = {};

  available.forEach((hd) => {
    const avail = hd.total - hd.spent;
    selections[hd.dieType] = { count: 0, max: avail, countEl: null };

    const row = document.createElement("div");
    row.className = "hd-counter-row";

    const left = document.createElement("div");
    left.className = "hd-counter-left";

    const label = document.createElement("span");
    label.className = "hd-counter-label";
    label.textContent = hd.dieType;

    const availEl = document.createElement("span");
    availEl.className = "hd-counter-avail";
    availEl.textContent = `${avail} left`;

    left.appendChild(label);
    left.appendChild(availEl);

    const right = document.createElement("div");
    right.className = "hd-counter-controls";

    const dec = document.createElement("button");
    dec.type = "button";
    dec.className = "hd-counter-btn";
    dec.textContent = "−";

    const countEl = document.createElement("span");
    countEl.className = "hd-counter-val";
    countEl.textContent = "0";
    selections[hd.dieType].countEl = countEl;

    const inc = document.createElement("button");
    inc.type = "button";
    inc.className = "hd-counter-btn";
    inc.textContent = "+";

    dec.addEventListener("click", () => {
      const s = selections[hd.dieType];
      if (s.count <= 0) return;
      s.count--;
      countEl.textContent = s.count;
    });

    inc.addEventListener("click", () => {
      const s = selections[hd.dieType];
      if (s.count >= s.max) return;
      s.count++;
      countEl.textContent = s.count;
    });

    right.appendChild(dec);
    right.appendChild(countEl);
    right.appendChild(inc);
    row.appendChild(left);
    row.appendChild(right);
    countersEl.appendChild(row);
  });

  healInput.value = "";
  errEl.hidden = true;
  modal.hidden = false;
  setTimeout(() => healInput.focus(), 50);

  const close = () => {
    modal.hidden = true;
  };

  const onConfirm = () => {
    const totalUsed = Object.values(selections).reduce(
      (s, v) => s + v.count,
      0,
    );
    const healed = parseInt(healInput.value, 10) || 0;

    if (totalUsed === 0 && healed > 0) {
      errEl.textContent = "Select at least one die to use, or skip.";
      errEl.hidden = false;
      return;
    }

    Object.entries(selections).forEach(([dieType, s]) => {
      if (s.count === 0) return;
      const pool = c.hitDice.find((hd) => hd.dieType === dieType);
      if (pool) pool.spent += s.count;
    });

    saveState();
    modal.removeEventListener("keydown", keyHandler); // FIX: always clean up
    close();
    onDone(healed);
  };

  const newConfirm = confirmBtn.cloneNode(true);
  const newSkip = skipBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
  skipBtn.parentNode.replaceChild(newSkip, skipBtn);

  newConfirm.addEventListener("click", onConfirm);
  newSkip.addEventListener("click", () => {
    modal.removeEventListener("keydown", keyHandler); // FIX: clean up on skip too
    close();
    onDone(0);
  });

  const keyHandler = (e) => {
    if (e.key === "Escape") {
      modal.removeEventListener("keydown", keyHandler);
      close();
      onDone(0);
    }
    if (e.key === "Enter") {
      modal.removeEventListener("keydown", keyHandler);
      onConfirm();
    } // FIX: remove on Enter
  };
  modal.addEventListener("keydown", keyHandler);
}

// ─── Event listener wiring ────────────────────────────────────────────────────

export function initHitDiceControls() {
  const modal = document.getElementById("hitdice-modal");
  const form = document.getElementById("hitdice-form");
  const openBtn = document.getElementById("add-hitdice-btn");
  const cancel = document.getElementById("hitdice-cancel");
  const typeIn = document.getElementById("hitdice-form-type");
  const totalIn = document.getElementById("hitdice-form-total");
  const errEl = document.getElementById("hitdice-form-error");

  const open = () => {
    form.reset();
    typeIn.value = "d8";
    totalIn.value = 1;
    errEl.hidden = true;
    modal.hidden = false;
    totalIn.focus();
  };
  const close = () => {
    modal.hidden = true;
  };

  openBtn.addEventListener("click", open);
  cancel.addEventListener("click", close);
  modal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    errEl.hidden = true;
    const total = parseInt(totalIn.value, 10) || 0;
    const c = getSelectedCharacter();
    if (!c) return;
    if (!c.hitDice) c.hitDice = [];

    const remaining = 20 - hdTotalAll(c);
    if (total < 1) {
      errEl.textContent = "Enter at least 1.";
      errEl.hidden = false;
      return;
    }
    if (total > remaining) {
      errEl.textContent = `Only ${remaining} dice slots left (max 20 total).`;
      errEl.hidden = false;
      return;
    }

    const existing = c.hitDice.find((hd) => hd.dieType === typeIn.value);
    if (existing) existing.total += total;
    else
      c.hitDice.push({
        id: crypto.randomUUID(),
        dieType: typeIn.value,
        total,
        spent: 0,
      });

    saveState();
    document.dispatchEvent(new CustomEvent("app:rerender"));
    close();
    showToast(`Added ${total}${typeIn.value} hit dice`);
  });
}
