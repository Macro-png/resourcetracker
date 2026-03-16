// ─── Resources ────────────────────────────────────────────────────────────────
// Renders the Resources section. Resources with max < 4 use a checkbox
// (slot-box) UI identical to spell slots; those with max ≥ 4 switch to a
// counter (−  n/max  +) layout automatically.

import { saveState }               from './state.js';
import { editMode, makeSwipeable } from './ui.js';

export function renderResources(c) {
  const container = document.getElementById('resources-container');
  const template  = document.getElementById('resource-template');
  container.innerHTML = '';

  c.resources.forEach(r => {
    const el = template.content.firstElementChild.cloneNode(true);
    el.querySelector('[data-key="label"]').textContent = r.name;

    const controls = el.querySelector('[data-key="controls"]');
    controls.innerHTML = '';

    // Shared helper — save and trigger a full re-render
    const rerender = () => {
      saveState();
      document.dispatchEvent(new CustomEvent('app:rerender'));
    };

    if (r.max < 4) {
      // ── Checkbox mode ──────────────────────────────────────────────────────
      controls.className = 'spellslot-controls resource-controls';

      for (let i = 0; i < r.max; i++) {
        const label = document.createElement('label');
        label.className = 'slot-toggle';
        label.title = `${r.name} use ${i + 1}`;

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'slot-checkbox';
        // Checked = spent (purple fills from left)
        cb.checked = i < (r.max - (r.current || 0));
        cb.setAttribute('aria-label', `${r.name} ${i + 1}`);
        cb.addEventListener('change', () => {
          if (editMode) {
            r.max--;
            r.current = Math.min(r.current || 0, r.max);
            if (r.max === 0) c.resources = c.resources.filter(x => x.id !== r.id);
          } else {
            r.current = cb.checked
              ? Math.max(0, (r.current || 0) - 1)
              : Math.min(r.max, (r.current || 0) + 1);
          }
          rerender();
        });

        const box = document.createElement('span');
        box.className = 'slot-box resource-slot-box';
        label.appendChild(cb);
        label.appendChild(box);
        controls.appendChild(label);
      }

      // + add box — clicking at max 3 pushes to 4 which triggers counter mode
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
        rerender();
      });
      controls.appendChild(addLabel);

    } else {
      // ── Counter mode ───────────────────────────────────────────────────────
      controls.className = 'spellslot-controls resource-controls';

      const flash = box => {
        box.classList.add('flash');
        setTimeout(() => box.classList.remove('flash'), 200);
      };

      const makeBox = text => {
        const label = document.createElement('label');
        label.className = 'slot-toggle';
        const box = document.createElement('span');
        box.className = 'slot-box resource-counter-box';
        box.textContent = text;
        label.appendChild(box);
        return { label, box };
      };

      const { label: decLabel, box: decBox } = makeBox('−');
      const { label: valLabel, box: valBox } = makeBox(`${r.current}/${r.max}`);
      const { label: incLabel, box: incBox } = makeBox('+');

      // Value display is not interactive
      valLabel.style.cursor = 'default';
      valLabel.style.pointerEvents = 'none';

      decLabel.addEventListener('click', () => {
        if (editMode) { if (r.max <= 1) return; r.max--; r.current = Math.min(r.current, r.max); }
        else          { if (r.current <= 0) return; r.current = Math.max(0, r.current - 1); }
        flash(decBox);
        valBox.textContent = `${r.current}/${r.max}`;
        setTimeout(rerender, 210);
      });

      incLabel.addEventListener('click', () => {
        if (editMode) { r.max++; r.current = Math.min(r.current, r.max); }
        else          { if (r.current >= r.max) return; r.current = Math.min(r.max, r.current + 1); }
        flash(incBox);
        valBox.textContent = `${r.current}/${r.max}`;
        setTimeout(rerender, 210);
      });

      controls.appendChild(decLabel);
      controls.appendChild(valLabel);
      controls.appendChild(incLabel);
    }

    makeSwipeable(el, () => {
      c.resources = c.resources.filter(x => x.id !== r.id);
      saveState();
      document.dispatchEvent(new CustomEvent('app:rerender'));
    });

    container.appendChild(el);
  });
}