import { describe, expect, it } from 'vitest';

import { fileStackTypeLabels, renderFileStackCards } from './fileStackCards';

describe('fileStackCards', () => {
  it('renders incomplete file cards with remap and remove actions', () => {
    const html = renderFileStackCards([
      {
        detectedLanguage: 'pl',
        missingOptional: ['Caps'],
        missingRequired: ['Name'],
        name: 'players.html',
        rowCount: 42,
        type: 'both'
      }
    ]);

    expect(html).toContain('data-fm-action="remapFileHeaders"');
    expect(html).toContain('data-fm-action="removeFileFromStack"');
    expect(html).toContain('Brakuje kluczowych: Name');
    expect(html).toContain('Brakuje opcjonalnych: Caps');
    expect(html).toContain('Niekompletny');
  });

  it('supports alternate labels for modal rendering without changing payloads', () => {
    const html = renderFileStackCards(
      [
        {
          detectedLanguage: 'en-us',
          name: 'stats.html',
          rowCount: 10,
          type: 'complete'
        }
      ],
      { typeLabels: fileStackTypeLabels.modal }
    );

    expect(html).toContain('Komplet');
    expect(html).toContain('English (US)');
    expect(html).toContain('Sprawdź mapowanie');
    expect(html).toContain('data-fm-index="0"');
  });

  it('renders imported file names and header names as text, not markup', () => {
    const hostile = '<img src=x data-injected="1">';
    const html = renderFileStackCards([
      {
        detectedLanguage: hostile,
        missingOptional: [hostile],
        missingRequired: [hostile],
        name: hostile,
        rowCount: 1,
        type: hostile
      }
    ]);

    // The language name is upper-cased, so the check ignores letter case.
    expect(html.toLowerCase()).not.toContain('<img');
    expect(html).toContain('&lt;img src=x data-injected=&quot;1&quot;&gt;');
  });
});
