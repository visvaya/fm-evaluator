// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LdcLeaguesToolbar } from './LdcLeaguesToolbar';

import type { LdcGroupBy } from '@/config/ldcConfig';

const choose = (select: HTMLSelectElement, value: string) => {
  act(() => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

describe('LdcLeaguesToolbar grouping', () => {
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

  const renderToolbar = (groupBy: LdcGroupBy | null, onGroupByChange = vi.fn()) => {
    act(() => {
      root.render(
        <LdcLeaguesToolbar
          groupBy={groupBy}
          isExpanded
          leagueFilter="all"
          onAddLeague={vi.fn()}
          onGroupByChange={onGroupByChange}
          onLeagueFilterChange={vi.fn()}
          onSearchTermChange={vi.fn()}
          onToggleExpanded={vi.fn()}
          searchTerm=""
        />
      );
    });
    const select = container.querySelector<HTMLSelectElement>('#ldc-group-by');
    if (!select) throw new Error('group-by select not rendered');
    return { onGroupByChange, select };
  };

  it('shows the current grouping and offers country and stars', () => {
    const { select } = renderToolbar('stars');
    expect(select.value).toBe('stars');
    expect([...select.options].map((option) => option.value)).toEqual(['', 'nation', 'stars']);
  });

  it('reports the chosen grouping, and null for none', () => {
    const { onGroupByChange, select } = renderToolbar(null);
    choose(select, 'nation');
    choose(select, '');
    expect(onGroupByChange.mock.calls).toEqual([['nation'], [null]]);
  });
});
