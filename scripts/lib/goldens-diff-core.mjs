/** Pure structural diff of golden snapshot files for scripts/goldens-diff.mjs. */

/** Parse a snapshot: a JSON document, or JSON lines as an array. Absent file -> undefined. */
export const parseSnapshot = (text) => {
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text
      .split(/\r?\n/)
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line));
  }
};

const isContainer = (value) => value !== null && typeof value === 'object';

const joinKey = (path, key, isArray) =>
  isArray ? `${path}[${key}]` : path === '' ? String(key) : `${path}.${key}`;

const collapseIndices = (path) => path.replace(/\[\d+\]/g, '[]');

/** List leaf differences as { path, before, after }, in a stable order. */
const leafChanges = (before, after, path = '') => {
  const bothArrays = Array.isArray(before) && Array.isArray(after);
  const bothObjects =
    isContainer(before) && isContainer(after) && !Array.isArray(before) && !Array.isArray(after);
  if (!bothArrays && !bothObjects) {
    return JSON.stringify(before) === JSON.stringify(after) ? [] : [{ path, before, after }];
  }
  const keys = bothArrays
    ? Array.from({ length: Math.max(before.length, after.length) }, (_, index) => index)
    : [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return keys.flatMap((key) =>
    leafChanges(before[key], after[key], joinKey(path, key, bothArrays))
  );
};

/** Group leaf changes by path with array indices collapsed; keep the first as an example. */
export const diffSnapshots = (before, after) => {
  const groups = leafChanges(before, after).reduce((acc, change) => {
    const key = collapseIndices(change.path);
    const existing = acc.get(key);
    return new Map(acc).set(
      key,
      existing
        ? { ...existing, count: existing.count + 1 }
        : { path: key, count: 1, example: change }
    );
  }, new Map());
  return [...groups.values()];
};

const MAX_VALUE_CHARS = 80;

const show = (value) => {
  const text = value === undefined ? '(absent)' : JSON.stringify(value);
  return text.length > MAX_VALUE_CHARS ? `${text.slice(0, MAX_VALUE_CHARS)}...` : text;
};

/** Render one file's groups as indented text lines. */
export const formatDiff = (file, groups) => {
  const lines =
    groups.length === 0
      ? ['  (no leaf changes)']
      : groups.map(
          ({ path, count, example }) =>
            `  ${path}  x${count}  e.g. ${example.path}: ${show(example.before)} -> ${show(example.after)}`
        );
  return [file, ...lines].join('\n');
};
