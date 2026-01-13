export function createResource({
  name,
  current,
  max,
  recoversOn // "short", "long", "none"
}) {
  return {
    id: crypto.randomUUID(),
    name,
    current,
    max,
    recoversOn
  };
}
