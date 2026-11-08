import { firstParenthesised, withoutTrailingParenthesis } from '../utils/parenthesised';

export function parsePositions(str: unknown): string[] {
  if (!str || typeof str !== 'string') return [];
  const positions = new Set<string>();
  const parts = str
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  for (const part of parts) {
    const parenthesesMatch = firstParenthesised(part);
    if (part.includes('/')) {
      const parentheses = parenthesesMatch ?? '';
      const slashParts = part
        .split('/')
        .map((p) => p.trim())
        .filter(Boolean);
      for (const slashPart of slashParts) {
        let pos = slashPart.trim();
        pos = withoutTrailingParenthesis(pos).trim();
        if (parentheses && pos) {
          const letters = parentheses.replaceAll(/[()]/g, '');
          if (letters.length > 1) {
            for (const letter of letters) {
              positions.add(`${pos} (${letter})`);
            }
          } else {
            pos = `${pos} ${parentheses}`;
            positions.add(pos);
          }
        } else if (pos) {
          positions.add(pos);
        }
      }
    } else if (parenthesesMatch) {
      const parentheses = parenthesesMatch;
      const basePos = withoutTrailingParenthesis(part).trim();
      const letters = parentheses.replaceAll(/[()]/g, '');
      if (letters.length > 1) {
        for (const letter of letters) {
          positions.add(`${basePos} (${letter})`);
        }
      } else {
        positions.add(part);
      }
    } else {
      positions.add(part);
    }
  }
  return [...positions];
}
