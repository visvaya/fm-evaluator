/**
 * Orders strings by UTF-16 code units, the order of `Array.prototype.sort()` without a
 * comparator. Use it where output must stay stable across locales (hashes, cache keys,
 * deterministic exports); use `localeCompare` for text shown to people.
 */
export function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
