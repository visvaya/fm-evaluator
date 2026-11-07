import { describe, expect, it, vi } from 'vitest';

import {
  removeFileStackItem,
  rebuildFileStackCollections,
  rebuildFileStackCollectionsWithFallback,
  reorderFileStackItems,
  reparseFileStackItem
} from './fileStackState';

describe('fileStackState', () => {
  it('rebuilds attributes and stats from cached parsed data in reverse stack order', () => {
    const processor = {
      attributes: ['stale'],
      fileStack: [
        { parsedData: ['a1'], type: 'attr' },
        { parsedData: ['b1'], type: 'both' },
        { parsedData: ['s1'], type: 'stats' }
      ],
      parseHTML: vi.fn(),
      stats: ['stale']
    };

    rebuildFileStackCollections(processor);

    expect(processor.attributes).toEqual(['b1', 'a1']);
    expect(processor.stats).toEqual(['s1', 'b1']);
  });

  it('reparses a file with normalized complete type and optional column map', async () => {
    const parseHTML = vi.fn().mockResolvedValue(void 0);
    const processor = {
      attributes: [],
      fileStack: [],
      parseHTML,
      stats: []
    };

    await reparseFileStackItem(
      processor,
      {
        file: null,
        html: '<table></table>',
        type: 'complete'
      },
      { 0: 'Name' }
    );

    expect(parseHTML).toHaveBeenCalledWith('<table></table>', 'both', false, null, { 0: 'Name' });
  });

  it('invokes fallback reparsing only for items missing parsed data', async () => {
    const processor = {
      attributes: [],
      fileStack: [
        { html: '<table>a</table>', parsedData: ['a'], type: 'attr' },
        { html: '<table>b</table>', type: 'stats' }
      ],
      parseHTML: vi.fn(),
      stats: []
    };
    const onMissingParsedData = vi.fn().mockResolvedValue(void 0);

    await rebuildFileStackCollectionsWithFallback(processor, onMissingParsedData);

    expect(processor.attributes).toEqual(['a']);
    expect(processor.stats).toEqual([]);
    expect(onMissingParsedData).toHaveBeenCalledTimes(1);
    expect(onMissingParsedData).toHaveBeenCalledWith(processor.fileStack[1]);
  });

  it('removes a file-stack item by index without mutating the original array reference', () => {
    const originalFileStack = [
      { name: 'a', parsedData: ['a'], type: 'attr' },
      { name: 'b', parsedData: ['b'], type: 'stats' }
    ];
    const processor = {
      attributes: [],
      fileStack: originalFileStack,
      parseHTML: vi.fn(),
      stats: []
    };

    removeFileStackItem(processor, 0);

    expect(processor.fileStack).toEqual([{ name: 'b', parsedData: ['b'], type: 'stats' }]);
    expect(processor.fileStack).not.toBe(originalFileStack);
  });

  it('reorders file-stack items by replacing the collection with a moved copy', () => {
    const originalFileStack = [
      { name: 'a', parsedData: ['a'], type: 'attr' },
      { name: 'b', parsedData: ['b'], type: 'stats' },
      { name: 'c', parsedData: ['c'], type: 'both' }
    ];
    const processor = {
      attributes: [],
      fileStack: originalFileStack,
      parseHTML: vi.fn(),
      stats: []
    };

    reorderFileStackItems(processor, 0, 2);

    expect(processor.fileStack.map((item) => item.name)).toEqual(['b', 'c', 'a']);
    expect(processor.fileStack).not.toBe(originalFileStack);
  });
});
