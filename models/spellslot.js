export function createSpellSlot({
  level,
  max,
  used,
  recoversOn
}) {
  return {
    id: crypto.randomUUID(),
    level,
    max,
    used,
    recoversOn
  };
}
