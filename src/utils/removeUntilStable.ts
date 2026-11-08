/**
 * Removes every match of the patterns, repeating until nothing changes, so that one removal cannot
 * join the remaining text into a new match (`<sty<style></style>le>` becomes `<style>` after one
 * pass). Each pattern needs the global flag.
 */
export function removeUntilStable(text: string, patterns: readonly RegExp[]): string {
  let current = text;
  let previous: string;
  do {
    previous = current;
    for (const pattern of patterns) {
      current = current.replace(pattern, '');
    }
  } while (current !== previous);
  return current;
}
