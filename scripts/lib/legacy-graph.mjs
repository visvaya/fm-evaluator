/*
 * Dependency graph for the legacy-layer codemap. Pure functions over the
 * output of legacy-scan.mjs.
 *
 * Nodes are production files in src/. An edge A -> B means "A needs B at
 * runtime": A imports B, or A reads window.X and B writes window.X. Cycles are
 * collapsed into strongly connected components, so every file gets a finite
 * depth: 0 for a file that depends on nothing else in src/, otherwise one more
 * than its deepest dependency.
 */
import { posix } from 'node:path';

const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.jsx'];

/** Resolves a relative or `@/` specifier to a file in `files`, or null for packages and misses. */
export function resolveSpecifier(fromFile, specifier, files) {
  const bare = specifier.split('?')[0];
  let base;
  if (bare.startsWith('@/')) base = `src/${bare.slice(2)}`;
  else if (bare.startsWith('.')) base = posix.join(posix.dirname(fromFile), bare);
  else return null;

  const withoutJs = base.replace(/\.[cm]?jsx?$/, '');
  const candidates = [
    base,
    ...RESOLVE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...RESOLVE_EXTENSIONS.map((extension) => `${withoutJs}${extension}`),
    ...RESOLVE_EXTENSIONS.map((extension) => `${base}/index${extension}`),
    ...RESOLVE_EXTENSIONS.map((extension) => `${withoutJs}/index${extension}`)
  ];
  return candidates.find((candidate) => files.has(candidate)) ?? null;
}

/**
 * Builds adjacency lists. `globalsByName` is the output of collectGlobals();
 * only bridges (names written in src/) create window edges.
 */
export function buildGraph(scans, globalsByName) {
  const files = new Set(scans.map((scan) => scan.file));
  const edges = new Map(scans.map((scan) => [scan.file, []]));
  const fileOf = (site) => site.slice(0, site.lastIndexOf(':'));

  for (const scan of scans) {
    for (const { specifier } of scan.imports) {
      const target = resolveSpecifier(scan.file, specifier, files);
      if (target && target !== scan.file) edges.get(scan.file).push({ to: target, kind: 'import' });
    }
  }
  for (const entry of globalsByName) {
    if (entry.kind !== 'bridge') continue;
    const definers = new Set(entry.writes.map(fileOf));
    for (const reader of new Set(entry.reads.map(fileOf))) {
      for (const definer of definers) {
        if (definer !== reader) {
          edges.get(reader).push({ to: definer, kind: 'window', name: entry.name });
        }
      }
    }
  }
  return edges;
}

/** Tarjan's algorithm; returns components in reverse topological order. */
function stronglyConnected(nodes, successors) {
  const index = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const components = [];
  let counter = 0;

  const connect = (node) => {
    index.set(node, counter);
    low.set(node, counter);
    counter += 1;
    stack.push(node);
    onStack.add(node);
    for (const next of successors(node)) {
      if (!index.has(next)) {
        connect(next);
        low.set(node, Math.min(low.get(node), low.get(next)));
      } else if (onStack.has(next)) {
        low.set(node, Math.min(low.get(node), index.get(next)));
      }
    }
    if (low.get(node) === index.get(node)) {
      const component = [];
      let member;
      do {
        member = stack.pop();
        onStack.delete(member);
        component.push(member);
      } while (member !== node);
      components.push(component.sort());
    }
  };

  for (const node of nodes) if (!index.has(node)) connect(node);
  return components;
}

/**
 * Depth of every file over the edges accepted by `edgeFilter`.
 * Returns { depth: Map<file, number>, cycles: string[][] }.
 */
export function computeDepths(edges, edgeFilter = () => true) {
  const successors = (node) =>
    [
      ...new Set(
        edges
          .get(node)
          .filter(edgeFilter)
          .map((edge) => edge.to)
      )
    ].sort();
  const components = stronglyConnected([...edges.keys()].sort(), successors);
  const componentOf = new Map();
  components.forEach((component, id) => component.forEach((file) => componentOf.set(file, id)));

  // Tarjan emits a component only after everything it reaches, so one pass suffices.
  const componentDepth = [];
  components.forEach((component, id) => {
    let deepest = -1;
    for (const file of component) {
      for (const next of successors(file)) {
        const target = componentOf.get(next);
        if (target !== id) deepest = Math.max(deepest, componentDepth[target]);
      }
    }
    componentDepth[id] = deepest + 1;
  });

  const depth = new Map([...componentOf].map(([file, id]) => [file, componentDepth[id]]));
  const cycles = components.filter((component) => component.length > 1);
  return { depth, cycles };
}

/**
 * Orders bridges for extraction: shallowest definer first, then fewest reading
 * files. A bridge whose definer sits at depth 0 is a leaf: its module needs
 * nothing else from src/, so readers can import it without changing load order.
 */
export function orderBridges(globalsByName, depth) {
  const fileOf = (site) => site.slice(0, site.lastIndexOf(':'));
  return globalsByName
    .filter((entry) => entry.kind === 'bridge')
    .map((entry) => {
      const definers = [...new Set(entry.writes.map(fileOf))].sort();
      const readers = [...new Set(entry.reads.map(fileOf))]
        .filter((file) => !definers.includes(file))
        .sort();
      return {
        name: entry.name,
        definers,
        readers,
        reads: entry.reads.length,
        writes: entry.writes.length,
        depth: Math.max(...definers.map((file) => depth.get(file) ?? 0))
      };
    })
    .sort(
      (left, right) =>
        left.depth - right.depth ||
        left.readers.length - right.readers.length ||
        left.name.localeCompare(right.name)
    );
}
