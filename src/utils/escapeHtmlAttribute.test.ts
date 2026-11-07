import { escapeHtmlAttribute } from './escapeHtmlAttribute';

describe('escapeHtmlAttribute', () => {
  it('escapes quotes, ampersands and angle brackets', () => {
    expect(escapeHtmlAttribute(`O'Brien "FC" <b>&</b>`)).toBe(
      'O&#39;Brien &quot;FC&quot; &lt;b&gt;&amp;&lt;/b&gt;'
    );
  });

  it('leaves plain text unchanged', () => {
    expect(escapeHtmlAttribute('Legia Warszawa')).toBe('Legia Warszawa');
  });
});
