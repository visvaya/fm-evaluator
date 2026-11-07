import fs from 'node:fs';
import path from 'node:path';

// Guard for the strict CSP (ADR-004, script-src-attr 'none'): the browser blocks inline
// event-handler attributes in generated markup, so they must not come back under src/.
const SRC_DIR = path.resolve(__dirname, '..');
const INLINE_HANDLER = /<[a-z][^<>]*\son[a-z]+\s*=\s*["']/i;
const SOURCE_FILE = /\.(?:js|ts|tsx)$/;
const TEST_FILE = /\.(?:test|spec)\.(?:js|ts|tsx)$/;

function listSourceFiles(directory: string): string[] {
  // Test-time walk of the repository's own src/ tree.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(fullPath);
    return SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name) ? [fullPath] : [];
  });
}

function findInlineHandlers(file: string): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- src/ file list
  const lines = fs.readFileSync(file, 'utf-8').split('\n');
  return lines.flatMap((line, index) =>
    INLINE_HANDLER.test(line) ? [`${path.relative(SRC_DIR, file)}:${index + 1}`] : []
  );
}

describe('no inline event handlers in generated markup', () => {
  it('finds no on*="..." attributes inside HTML tags under src/', () => {
    expect(listSourceFiles(SRC_DIR).flatMap(findInlineHandlers)).toEqual([]);
  });

  it('recognises handler attributes in template strings', () => {
    expect(INLINE_HANDLER.test('`<input type="text" oninput="run()">`')).toBe(true);
    expect(INLINE_HANDLER.test(`<div draggable="true" ondragstart='go(event)'>`)).toBe(true);
    expect(INLINE_HANDLER.test('<input data-fm-change="toggle">')).toBe(false);
    expect(INLINE_HANDLER.test('<Button onClick={handle}>')).toBe(false);
  });
});
