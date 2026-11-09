// Pure parts of check:redos: find the patterns in a parsed file and judge the checker's verdicts
// against the accepted list. The I/O (files, parser, recheck) is in scripts/check-redos.mjs.

const isRegExpCall = (node) =>
  (node.type === 'NewExpression' || node.type === 'CallExpression') &&
  node.callee.type === 'Identifier' &&
  node.callee.name === 'RegExp';

const literalString = (node) => {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? undefined;
  }
  return undefined;
};

const lineAt = (text, offset) => text.slice(0, offset).split('\n').length;

const childNodes = (node) =>
  Object.entries(node)
    .filter(([key]) => key !== 'parent')
    .flatMap(([, value]) => (Array.isArray(value) ? value : [value]))
    .filter(
      (value) => value !== null && typeof value === 'object' && typeof value.type === 'string'
    );

const patternOf = (node, text) => {
  const line = lineAt(text, node.start);
  if (node.type === 'Literal' && node.regex) {
    return { source: node.regex.pattern, flags: node.regex.flags, line };
  }
  if (!isRegExpCall(node)) return undefined;
  const source = literalString(node.arguments[0]);
  const flags = node.arguments.length > 1 ? literalString(node.arguments[1]) : '';
  if (source === undefined || flags === undefined) return { dynamic: true, line };
  return { source, flags, line };
};

/**
 * Every regex literal and every `RegExp(...)` call in a parsed program. A call whose pattern or
 * flags are not plain strings is returned as `{ dynamic: true }`, because nothing can check it.
 * @param {object} program ESTree program with `start` offsets (oxc-parser)
 * @param {string} text the source the offsets refer to
 */
export function collectPatterns(program, text) {
  const found = [];
  const stack = [program];
  while (stack.length > 0) {
    const node = stack.pop();
    const pattern = patternOf(node, text);
    if (pattern) found.push(pattern);
    stack.push(...childNodes(node));
  }
  return found.toSorted((a, b) => a.line - b.line);
}

const keyOf = ({ file, source, flags }) => JSON.stringify([file, source, flags]);

/**
 * Splits the checked patterns into failures (a dynamic pattern, or a verdict other than safe
 * without an accepted entry) and stale accepted entries (no longer flagged or no longer present),
 * so the accepted list can only shrink.
 * @param {{ results: { file: string, line: number, source?: string, flags?: string,
 *   dynamic?: boolean, status?: string, complexity?: string }[],
 *   accepted: { file: string, source: string, flags: string, reason: string }[] }} input
 */
export function judgeResults({ results, accepted }) {
  const acceptedKeys = new Set(accepted.map(keyOf));
  const flagged = results.filter((result) => !result.dynamic && result.status !== 'safe');
  const flaggedKeys = new Set(flagged.map(keyOf));
  return {
    dynamic: results.filter((result) => result.dynamic),
    unaccepted: flagged.filter((result) => !acceptedKeys.has(keyOf(result))),
    stale: accepted.filter((entry) => !flaggedKeys.has(keyOf(entry)))
  };
}
