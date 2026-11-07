// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getProcessor } from './processorBridge';

describe('getProcessor', () => {
  const originalProcessor = (window as any).processor;

  beforeEach(() => {
    delete (window as any).processor;
  });

  afterEach(() => {
    (window as any).processor = originalProcessor;
  });

  it('returns window.processor when set', () => {
    const fakeProcessor = { mergedData: [] };
    (window as any).processor = fakeProcessor;
    expect(getProcessor()).toBe(fakeProcessor);
  });

  it('returns undefined when window.processor is not set', () => {
    expect(getProcessor()).toBeUndefined();
  });
});
