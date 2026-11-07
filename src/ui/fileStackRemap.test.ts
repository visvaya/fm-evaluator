// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import {
  buildHeadersToMap,
  buildUpdatedColumnMap,
  extractHeadersForRemap,
  requestUserMappings
} from './fileStackRemap';

describe('fileStackRemap', () => {
  it('extracts normalized table headers from html', () => {
    const headers = extractHeadersForRemap(
      '<table><thead><tr><th> Name </th><th> Club </th></tr></thead></table>',
      (header) => (typeof header === 'string' ? header.trim().toLowerCase() : '')
    );

    expect(headers).toEqual(['name', 'club']);
  });

  it('builds modal rows from headers and current mapping', () => {
    expect(buildHeadersToMap(['name', 'club'], { 1: 'basic_club' })).toEqual([
      {
        autoMappedTo: null,
        header: 'name',
        index: 0,
        isAmbiguous: false,
        isAutoMapped: false
      },
      {
        autoMappedTo: 'basic_club',
        header: 'club',
        index: 1,
        isAmbiguous: false,
        isAutoMapped: true
      }
    ]);
  });

  it('requests mappings through HeaderMappingModal with constructed rows', async () => {
    const show = vi.fn().mockResolvedValue({ 0: 'basic_name' });
    class HeaderMappingModal {
      public show = show;
    }

    const result = await requestUserMappings({
      HeaderMappingModal,
      currentColumnMap: { 1: 'basic_club' },
      fileName: 'players.html',
      headers: ['name', 'club'],
      languageConfig: { locale: 'en' },
      schemaRegistry: { version: 1 }
    });

    expect(result).toEqual({ 0: 'basic_name' });
    expect(show).toHaveBeenCalledWith(
      [
        {
          autoMappedTo: null,
          header: 'name',
          index: 0,
          isAmbiguous: false,
          isAutoMapped: false
        },
        {
          autoMappedTo: 'basic_club',
          header: 'club',
          index: 1,
          isAmbiguous: false,
          isAutoMapped: true
        }
      ],
      { version: 1 },
      ['name', 'club'],
      { locale: 'en' },
      { 1: 'basic_club' },
      'players.html'
    );
  });

  it('builds updated column map by replacing and removing mappings', () => {
    expect(
      buildUpdatedColumnMap({ 0: 'basic_name', 1: 'basic_club' }, { 1: null, 2: 'basic_uid' })
    ).toEqual({
      0: 'basic_name',
      2: 'basic_uid'
    });
  });
});
