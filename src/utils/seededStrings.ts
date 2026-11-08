// Inputs for equivalence tests of rewritten patterns: every short string over an alphabet,
// and reproducible random strings from a seed.

/** Every string over `alphabet` with length 0 to `maxLength`. */
export function allStrings(alphabet: readonly string[], maxLength: number): string[] {
  const result: string[] = [''];
  let previous: string[] = [''];
  for (let length = 1; length <= maxLength; length++) {
    previous = previous.flatMap((prefix) => alphabet.map((letter) => prefix + letter));
    result.push(...previous);
  }
  return result;
}

/** `count` strings over `alphabet` with length 0 to `maxLength`, the same for the same seed. */
export function seededStrings({
  alphabet,
  count,
  maxLength,
  seed
}: {
  alphabet: readonly string[];
  count: number;
  maxLength: number;
  seed: number;
}): string[] {
  const random = mulberry32(seed);
  const pick = (): string => alphabet[Math.floor(random() * alphabet.length)] ?? '';
  return Array.from({ length: count }, () =>
    Array.from({ length: Math.floor(random() * (maxLength + 1)) }, pick).join('')
  );
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}
