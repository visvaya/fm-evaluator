// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { PossessionShell } from './PossessionShell';

describe('PossessionShell', () => {
  it('renders the crop image without a source and without a React warning', () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(<PossessionShell />);
    });
    // The cropper sets the source when a screenshot is chosen.
    expect(container.querySelector('#imageToCrop')?.hasAttribute('src')).toBe(false);
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('empty string');
    act(() => {
      root.unmount();
    });
  });
});
