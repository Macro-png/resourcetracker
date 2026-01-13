export function createCharacter({
  name,
  maxHP
}) {
  return {
    id: crypto.randomUUID(),
    name,

    maxHP,
    currentHP: maxHP,
    tempHP: 0,

    deathSaves: {
      success: 0,
      failure: 0
    },

    spellSlots: [],
    resources: [],
    statuses: []
  };
}
