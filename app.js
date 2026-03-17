// ─── Entry Point ──────────────────────────────────────────────────────────────

import { loadState, state }                    from './js/state.js';
import { initPWA, initExportImport }           from './js/pwa.js';
import { initHPControls }                      from './js/hp.js';
import { initHitDiceControls }                 from './js/hitdice.js';
import { initInventoryControls }               from './js/inventory.js';
import { renderCharacterList, renderSession,
         showCharacterList, showSession,
         initSessionControls }                 from './js/session.js';
import { initModals }                          from './js/modals.js';

// 1. Hydrate state
loadState();

// 2. Wire listeners
initPWA();
initExportImport();
initHPControls();
initHitDiceControls();
initInventoryControls();
initSessionControls();
initModals();

// 3. Render initial screen
try {
  renderCharacterList();
  if (state.selectedCharacterId) { renderSession(); showSession(); }
  else showCharacterList();
} catch (err) {
  console.error('Init error:', err);
}