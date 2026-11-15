// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/ui/ldcMissing', () => ({
  addLeagueWithValues: vi.fn(),
  checkMissingLeagues: vi.fn()
}));

import { useLdcMissingStore } from '@/features/ldc/useLdcMissingStore';

import { LdcMissingDialogs } from './LdcMissingDialogs';

import type { MissingLeagueCandidate } from './missingLeaguesModel';

const candidate = (name: string): MissingLeagueCandidate => ({
  countryCode: 'POL',
  matchScore: null,
  matchType: 'none',
  name,
  nation: 'Polska',
  normalized: name,
  suggestedMatch: null,
  suggestedRank: 3,
  suggestedStars: 1.5
});

const nameInputValue = (container: HTMLElement): string | undefined =>
  container.querySelector('input')?.value;

describe('LdcMissingDialogs', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    useLdcMissingStore.setState({ activeDialog: null });
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

  it('starts the add dialog from the newly opened league, not the previous one', () => {
    act(() => {
      root.render(<LdcMissingDialogs />);
      useLdcMissingStore.getState().openAddDialog(candidate('Liga A'));
    });
    expect(nameInputValue(container)).toBe('Liga A');

    act(() => {
      useLdcMissingStore.getState().openAddDialog(candidate('Liga B'));
    });

    expect(nameInputValue(container)).toBe('Liga B');
  });

  it('starts the bulk dialog from the newly opened leagues', () => {
    act(() => {
      root.render(<LdcMissingDialogs />);
      useLdcMissingStore.getState().openBulkAddDialog([candidate('Liga A')], 'Polska', 'Polska');
    });
    act(() => {
      useLdcMissingStore.getState().openBulkAddDialog([candidate('Liga C')], 'Polska', 'Polska');
    });

    expect(container.textContent).toContain('Liga C');
    expect(container.textContent).not.toContain('Liga A');
  });
});
