// ─── Entry Point ──────────────────────────────────────────────────────────────
// app.js is now a thin bootstrap. All domain logic lives in js/*.
//
// Load order matters:
//   1. Load state from localStorage
//   2. Wire up all event listeners (PWA, HP, hitdice, inventory, session, modals)
//   3. Render the initial screen

import { loadState, state }                    from './js/state.js';
import { initPWA, initExportImport }           from './js/pwa.js';
import { initHPControls }                      from './js/hp.js';
import { initHitDiceControls }                 from './js/hitdice.js';
import { initInventoryControls }               from './js/inventory.js';
import { renderCharacterList, renderSession,
         showCharacterList, showSession,
         initSessionControls, applyLockUI }   from './js/session.js';
import { initModals }                          from './js/modals.js';

// 1. Hydrate state
loadState();

// 2. Wire listeners
initPWA();
initExportImport();
initHPControls();
initHitDiceControls();
initInventoryControls();
initSessionControls(); // registers the 'app:rerender' listener — must come before modals
initModals();

// 3. Render initial screen
try {
  renderCharacterList();
  applyLockUI();
  if (state.selectedCharacterId) { renderSession(); showSession(); }
  else showCharacterList();
} catch (err) {
  console.error('Init error:', err);
}