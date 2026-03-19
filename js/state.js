// ─── State ───────────────────────────────────────────────────────────────────
// Single source of truth. All other modules import from here.
// `state` is a live ES-module binding — reassigning it in loadState() is
// visible to every importer thanks to ES module live-binding semantics.

export const STORAGE_KEY = 'dndTrackerState';

export const state = { characters: [], selectedCharacterId: null, locked: false };

export function getSelectedCharacter() {
  return state.characters.find(c => c.id === state.selectedCharacterId);
}

// ── Debounced save ────────────────────────────────────────────────────────────
// localStorage.setItem blocks the main thread. Debouncing to the next idle
// period means rapid taps (spell slots, hit dice) only trigger one write
// instead of one per tap, which is the primary cause of poor INP on Safari.
let _saveTimer = null;

export function saveState() {
  if (_saveTimer) return;
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('saveState failed:', e);
    }
  }, 300);
}

// Synchronous save for cases where we need the data persisted immediately
// (e.g. before location.reload() in the import flow).
export function saveStateNow() {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('saveStateNow failed:', e);
  }
}

export function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.assign(state, parsed);
    }
  } catch (e) {
    console.warn('Failed to load state:', e);
  }
}