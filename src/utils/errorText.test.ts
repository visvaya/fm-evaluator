import { describe, expect, it } from 'vitest';

import { errorText } from './errorText';

describe('errorText', () => {
  it('uses the message of an Error', () => {
    expect(errorText(new TypeError('bad input'))).toBe('bad input');
  });

  it('keeps a string as it is', () => {
    expect(errorText('quota exceeded')).toBe('quota exceeded');
  });

  it('serialises other values instead of printing [object Object]', () => {
    expect(errorText({ code: 'E1' })).toBe('{"code":"E1"}');
    expect(errorText(undefined)).toBe('undefined');
  });

  it('survives a value that cannot be serialised', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(errorText(cyclic)).toBe('Unserializable error value');
  });
});
