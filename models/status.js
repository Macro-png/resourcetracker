export function createStatus({
  name,
  remaining,
  durationType // "rounds", "minutes", "rest"
}) {
  return {
    id: crypto.randomUUID(),
    name,
    remaining,
    durationType
  };
}
