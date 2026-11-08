// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTableStore } from '@/store/useTableStore';

import { ImportStatusBanner } from './ImportStatusBanner';

vi.mock('@/hooks/useUiText', () => ({
  useUiText: () => (key: string) => key
}));

describe('ImportStatusBanner', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('lists the details of a successful import under its message', () => {
    useTableStore.setState({
      importStatus: {
        canRetry: false,
        details: ['long.html: cells were cut'],
        kind: 'success',
        message: 'Imported 5 player rows.'
      }
    });

    act(() => {
      root.render(createElement(ImportStatusBanner));
    });

    const status = container.querySelector('#upload-status-text');
    expect(status?.querySelector('li')?.textContent).toBe('long.html: cells were cut');
    expect(container.querySelector('#error-log')?.className).toBe('hidden');
  });

  it('keeps the details of an error in the error log only', () => {
    useTableStore.setState({
      importStatus: {
        canRetry: false,
        details: ['broken.html: no table'],
        kind: 'error',
        message: 'Import completed with errors.'
      }
    });

    act(() => {
      root.render(createElement(ImportStatusBanner));
    });

    expect(container.querySelector('#upload-status-text li')).toBeNull();
    expect(container.querySelector('#error-log')?.textContent).toContain('broken.html: no table');
  });
});
