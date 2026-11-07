import { describe, expect, it } from 'vitest';

import {
  buildMappingsFromRecords,
  buildRecordsFromMappings,
  compareMappingRecords
} from './ldcMappingsModel';

describe('ldcMappingsModel', () => {
  it('round-trips same-name source mappings from different nations', () => {
    const records = buildRecordsFromMappings({
      ['Premier League\u001FAnglia']: { name: 'Premier League', nation: 'Anglia' },
      ['Premier League\u001FEgipt']: { name: 'Premier League', nation: 'Egipt' }
    });

    expect(records.map(({ sourceName, sourceNation }) => ({ sourceName, sourceNation }))).toEqual([
      { sourceName: 'Premier League', sourceNation: 'Anglia' },
      { sourceName: 'Premier League', sourceNation: 'Egipt' }
    ]);
    expect(buildMappingsFromRecords(records)).toEqual({
      ['Premier League\u001FAnglia']: { name: 'Premier League', nation: 'Anglia' },
      ['Premier League\u001FEgipt']: { name: 'Premier League', nation: 'Egipt' }
    });
  });

  it('sorts source mappings by readable name and nation instead of the storage key', () => {
    const [england, egypt] = buildRecordsFromMappings({
      ['Premier League\u001FEgipt']: { name: 'Egyptian Target', nation: 'Egipt' },
      ['Premier League\u001FAnglia']: { name: 'English Target', nation: 'Anglia' }
    });

    expect(compareMappingRecords(england, egypt, 'source')).toBeLessThan(0);
  });
});
