import { describe, expect, it } from 'vitest';

import { sanitizeHtmlForParsing } from './runtimePatches';

describe('sanitizeHtmlForParsing', () => {
  it('strips style blocks, handlers and style attributes, including ones a removal joins', () => {
    expect(
      sanitizeHtmlForParsing(
        '<sty<style></style>le>p{}</style><p onclick="x()" style="color:red">Text</p>'
      )
    ).toBe('<p>Text</p>');
  });
});
