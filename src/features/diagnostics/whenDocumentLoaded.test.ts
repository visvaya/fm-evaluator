// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { whenDocumentLoaded } from './whenDocumentLoaded';

function stubReadyState(state: DocumentReadyState) {
  vi.spyOn(document, 'readyState', 'get').mockReturnValue(state);
}

describe('whenDocumentLoaded', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs the callback immediately when the load event already fired', () => {
    stubReadyState('complete');
    const callback = vi.fn();

    whenDocumentLoaded(callback);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('waits for the load event while the document is still loading', () => {
    stubReadyState('interactive');
    const callback = vi.fn();

    whenDocumentLoaded(callback);
    expect(callback).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('load'));
    window.dispatchEvent(new Event('load'));
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
