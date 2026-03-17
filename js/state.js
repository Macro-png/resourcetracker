// ─── State ───────────────────────────────────────────────────────────────────
// Single source of truth. All other modules import from here.
// `state` is a live ES-module binding — reassigning it in loadState() is
// visible to every importer thanks to ES module live-binding semantics.

export const STORAGE_KEY = 'dndTrackerState';

export const state = { characters: [], selectedCharacterId: null, locked: false };

export function getSelectedCharacter() {
  return state.characters.find(c => c.id === state.selectedCharacterId);
}

export function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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