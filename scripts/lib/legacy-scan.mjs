/*
 * Shared AST scan for the legacy-layer tools (legacy-metrics, legacy-codemap).
 *
 * Finds every access to a property of `window` or `globalThis`, every
 * `innerHTML` write and every runtime import in the application sources. Matching is syntactic, not
 * scope-aware: a local variable named `window` would be counted too. That
 * trade-off keeps the tool dependency-free apart from the parser and is fine
 * for a ratchet, whose job is to show direction, not exact semantics.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import { parse } from '@typescript-eslint/typescript-estree';
import globals from 'globals';

const GLOBAL_OBJECTS = new Set(['window', 'globalThis']);
const SOURCE_EXTENSIONS = /\.(?:[cm]?[jt]sx?)$/;
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
const WRAPPER_TYPES = new Set([
  'TSAsExpression',
  'TSNonNullExpression',
  'TSSatisfiesExpression',
  'TSTypeAssertion'
]);
const SKIPPED_KEYS = new Set(['loc', 'range', 'parent']);

// Names that exist on `window` in every browser. Accessing them is platform
// use, not a legacy bridge.
const PLATFORM_NAMES = new Set([
  ...Object.keys(globals.browser),
  ...Object.keys(globals.builtin),
  ...Object.keys(globals.worker)
]);

export const toPosix = (path) => path.split(sep).join('/');

export const countLines = (source) => {
  const lines = source.split(/\r?\n/);
  return lines.at(-1) === '' ? lines.length - 1 : lines.length;
};

export const isPlatformName = (name) => PLATFORM_NAMES.has(name);

async function listFiles(dir, keep) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return listFiles(path, keep);
      return SOURCE_EXTENSIONS.test(entry.name) && !entry.name.endsWith('.d.ts') && keep(entry.name)
        ? [path]
        : [];
    })
  );
  // Sort by the POSIX form so Windows and Linux list files in the same order.
  return nested.flat().sort((left, right) => toPosix(left).localeCompare(toPosix(right)));
}

/** Lists production source files under `dir`: no tests, no declaration files. */
export const listSourceFiles = (dir) => listFiles(dir, (name) => !TEST_FILE.test(name));

/** Lists unit test files under `dir`. */
export const listTestFiles = (dir) => listFiles(dir, (name) => TEST_FILE.test(name));

/** Lists every script under `dir` (for directories that hold only tests, such as e2e/). */
export const listAllFiles = (dir) => listFiles(dir, () => true);

const unwrap = (node) => {
  let current = node;
  while (current && WRAPPER_TYPES.has(current.type)) current = current.expression;
  return current;
};

const walk = (node, visit) => {
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit);
    return;
  }
  if (typeof node.type === 'string') visit(node);
  for (const key of Object.keys(node)) {
    if (!SKIPPED_KEYS.has(key)) walk(node[key], visit);
  }
};

const propertyName = (member) => {
  if (!member.computed && member.property.type === 'Identifier') return member.property.name;
  if (member.computed && member.property.type === 'Literal') {
    return typeof member.property.value === 'string' ? member.property.value : null;
  }
  return null;
};

const objectKeyName = (property) => {
  if (property.type !== 'Property') return null;
  if (property.key.type === 'Identifier' && !property.computed) return property.key.name;
  if (property.key.type === 'Literal' && typeof property.key.value === 'string') {
    return property.key.value;
  }
  return null;
};

export function parseSource(source, filePath) {
  try {
    return parse(source, { filePath, jsx: /x$/.test(filePath), loc: true, comment: false });
  } catch (error) {
    throw new Error(`Cannot parse ${filePath}: ${error.message}`, { cause: error });
  }
}

/**
 * Collects global accesses, innerHTML writes and module imports of one file.
 * Aliases such as `const w: any = window as any` are followed by name.
 */
export function scanAst(ast) {
  const nodes = [];
  walk(ast, (node) => nodes.push(node));

  const aliases = new Set(GLOBAL_OBJECTS);
  for (const node of nodes) {
    if (
      node.type === 'VariableDeclarator' &&
      node.id.type === 'Identifier' &&
      unwrap(node.init)?.type === 'Identifier' &&
      GLOBAL_OBJECTS.has(unwrap(node.init).name)
    ) {
      aliases.add(node.id.name);
    }
  }
  const isGlobalObject = (node) => {
    const inner = unwrap(node);
    return inner?.type === 'Identifier' && aliases.has(inner.name);
  };

  const writeTargets = new Set();
  const accesses = [];
  const innerHtmlWrites = [];
  const record = (name, kind, node) => {
    if (name) accesses.push({ name, kind, line: node.loc.start.line });
  };

  for (const node of nodes) {
    if (node.type === 'AssignmentExpression') {
      const target = unwrap(node.left);
      if (target.type === 'MemberExpression') {
        writeTargets.add(target);
        // `window.x += 1` reads the old value too.
        if (node.operator !== '=' && isGlobalObject(target.object)) {
          record(propertyName(target), 'read', node);
        }
        if (propertyName(target) === 'innerHTML') innerHtmlWrites.push(node.loc.start.line);
      }
    } else if (node.type === 'UpdateExpression') {
      writeTargets.add(unwrap(node.argument));
    } else if (node.type === 'UnaryExpression' && node.operator === 'delete') {
      writeTargets.add(unwrap(node.argument));
    } else if (
      node.type === 'CallExpression' &&
      node.callee.type === 'MemberExpression' &&
      unwrap(node.callee.object)?.type === 'Identifier' &&
      unwrap(node.callee.object).name === 'Object' &&
      isGlobalObject(node.arguments[0])
    ) {
      // Object.assign(window, { a, b }) and Object.defineProperty(window, 'a', ...)
      const method = propertyName(node.callee);
      if (method === 'assign') {
        // Only object literals name their keys; Object.assign(window, someVariable)
        // cannot be resolved syntactically and is not counted.
        for (const source of node.arguments.slice(1)) {
          if (source.type !== 'ObjectExpression') continue;
          for (const property of source.properties) record(objectKeyName(property), 'write', node);
        }
      } else if (method === 'defineProperty' && node.arguments[1]?.type === 'Literal') {
        record(String(node.arguments[1].value), 'write', node);
      }
    } else if (
      node.type === 'VariableDeclarator' &&
      node.id.type === 'ObjectPattern' &&
      isGlobalObject(node.init)
    ) {
      // const { processor } = window
      for (const property of node.id.properties) record(objectKeyName(property), 'read', node);
    }
  }

  for (const node of nodes) {
    if (node.type === 'MemberExpression' && isGlobalObject(node.object)) {
      record(propertyName(node), writeTargets.has(node) ? 'write' : 'read', node);
    }
  }

  return { accesses, innerHtmlWrites, imports: collectImports(nodes) };
}

const MODULE_SOURCE_TYPES = new Set([
  'ExportAllDeclaration',
  'ExportNamedDeclaration',
  'ImportDeclaration',
  'ImportExpression'
]);

const isImportMetaUrl = (node) =>
  node?.type === 'MemberExpression' &&
  node.object.type === 'MetaProperty' &&
  propertyName(node) === 'url';

// Runtime module edges: static and dynamic imports, re-exports and
// `new URL('./x.worker.ts', import.meta.url)`. Type-only imports are skipped
// because they vanish at build time.
function collectImports(nodes) {
  const imports = [];
  for (const node of nodes) {
    if (MODULE_SOURCE_TYPES.has(node.type)) {
      const typeOnly = node.importKind === 'type' || node.exportKind === 'type';
      const specifier = node.source?.type === 'Literal' ? node.source.value : null;
      if (!typeOnly && typeof specifier === 'string') {
        imports.push({ specifier, line: node.loc.start.line });
      }
    } else if (
      node.type === 'NewExpression' &&
      node.callee.type === 'Identifier' &&
      node.callee.name === 'URL' &&
      node.arguments[0]?.type === 'Literal' &&
      typeof node.arguments[0].value === 'string' &&
      isImportMetaUrl(node.arguments[1])
    ) {
      imports.push({ specifier: node.arguments[0].value, line: node.loc.start.line });
    }
  }
  return imports;
}

/** Scans the given files; paths in the result are relative to `rootDir`. */
export function scanFiles(rootDir, paths) {
  return Promise.all(
    paths.map(async (path) => {
      const source = await readFile(path, 'utf8');
      const file = toPosix(relative(rootDir, path));
      return { file, source, lines: countLines(source), ...scanAst(parseSource(source, file)) };
    })
  );
}

/** Scans every production source file under `srcDir`. */
export async function scanSources(rootDir, srcDir) {
  return scanFiles(rootDir, await listSourceFiles(srcDir));
}

/**
 * Groups non-platform global names across files.
 * A name written somewhere in the sources is a bridge; a name that is only
 * read is external (a vendor script global, or a read of something no longer
 * defined).
 */
export function collectGlobals(scans) {
  const byName = new Map();
  for (const { file, accesses } of scans) {
    for (const { name, kind, line } of accesses) {
      if (isPlatformName(name)) continue;
      const entry = byName.get(name) ?? { name, writes: [], reads: [] };
      entry[kind === 'write' ? 'writes' : 'reads'].push(`${file}:${line}`);
      byName.set(name, entry);
    }
  }
  return [...byName.values()]
    .map((entry) => ({ ...entry, kind: entry.writes.length > 0 ? 'bridge' : 'external' }))
    .sort((left, right) => left.name.localeCompare(right.name));
}
