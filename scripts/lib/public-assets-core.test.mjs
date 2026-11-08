import { describe, expect, it } from 'vitest';

import { findUnreferencedPublicFiles } from './public-assets-core.mjs';

describe('findUnreferencedPublicFiles', () => {
  it('reports a file that nothing references', () => {
    expect(
      findUnreferencedPublicFiles(
        ['vendor/old.css', 'vendor/used.css'],
        ['<link href="/vendor/used.css">']
      )
    ).toEqual(['vendor/old.css']);
  });

  it('accepts a reference by file name alone, as a stylesheet uses for its fonts', () => {
    expect(
      findUnreferencedPublicFiles(
        ['vendor/fonts/Inter-Bold.woff2'],
        ["src: url('fonts/Inter-Bold.woff2')"]
      )
    ).toEqual([]);
  });

  it('accepts files loaded by a runtime path and the fixed entry files', () => {
    expect(
      findUnreferencedPublicFiles(
        [
          'i18n/messages/pl.json',
          'config/languages/en-us.json',
          'vendor/tesseract/langs/pol.traineddata',
          'manifest.webmanifest',
          'service-worker.js'
        ],
        []
      )
    ).toEqual([]);
  });

  it('does not let a runtime pattern cover other files in the same folder', () => {
    expect(findUnreferencedPublicFiles(['i18n/messages/notes.txt'], [])).toEqual([
      'i18n/messages/notes.txt'
    ]);
  });
});
