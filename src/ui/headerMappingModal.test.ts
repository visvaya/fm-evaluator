// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import './headerMappingModal.js';

const HOSTILE = '<img src=x data-injected="1">';

const schemaRegistry = {
  getAllIds: () => ['name', 'club'],
  getLegacyHeaderName: (id: string) => (id === 'name' ? 'Name' : 'Club')
};

describe('HeaderMappingModal', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('ModalQueue', undefined);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('renders imported header names as text, not markup', async () => {
    const modal = new window.HeaderMappingModal();
    const allHeaders = [`left ${HOSTILE}`, HOSTILE, `right ${HOSTILE}`];

    const mappings = modal.show(
      [
        {
          alternatives: ['club'],
          autoMappedTo: 'name',
          confidence: 'low',
          header: HOSTILE,
          index: 1,
          isAmbiguous: true,
          isAutoMapped: true
        }
      ],
      schemaRegistry,
      allHeaders,
      { headers: { club: [HOSTILE], name: [`"><img src=y data-injected="2">`] } }
    );

    const root = document.querySelector('#header-mapping-modal');
    expect(root).not.toBeNull();
    expect(root?.querySelector('[data-injected]')).toBeNull();
    expect(root?.textContent).toContain(HOSTILE);
    expect(root?.textContent).toContain(`left ${HOSTILE}`);
    expect(root?.querySelector('select')?.value).toBe('name');

    document.querySelector<HTMLButtonElement>('#confirm-header-btn')?.click();
    await expect(mappings).resolves.toEqual({ 1: 'name' });
  });
});
