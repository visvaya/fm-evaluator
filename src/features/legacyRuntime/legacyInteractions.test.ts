// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  installInlineCopyObserver,
  normalizeInlineCopyHandlers,
  normalizeInlineLegacyActionHandlers,
  parseInlineCopyToClipboard,
  parseInlineLegacyAction
} from './inlineOnclickBridges';
import { createLegacyClickHandler } from './legacyActionDispatcher';
import { bindStaticLegacyInteractions } from './legacyStaticBindings';

function getWindowRecord() {
  return window as unknown as Record<string, unknown>;
}

function click(selector: string) {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) {
    throw new Error(`Missing test element for selector: ${selector}`);
  }

  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

describe('legacyInteractions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    Object.assign(getWindowRecord(), {
      commitConfig: undefined,
      copyToClipboard: undefined,
      fmCopyToClipboard: undefined,
      remapFileHeaders: undefined,
      removeFileFromStack: undefined,
      resetAllFilters: undefined,
      toggleAllVisible: undefined
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('parses inline copy payloads with escaped quotes', () => {
    expect(parseInlineCopyToClipboard(String.raw`copyToClipboard(event, 'O\\'Brien')`)).toBe(
      "O'Brien"
    );
  });

  it('keeps an escaped backslash before the closing quote', () => {
    const backslash = String.fromCodePoint(92);
    const escapedBackslash = backslash.repeat(4);
    expect(parseInlineCopyToClipboard(`copyToClipboard(event, 'a${escapedBackslash}')`)).toBe(
      `a${backslash}`
    );
  });

  it('rejects an unterminated payload of many backslashes in linear time', () => {
    const payload = String.fromCodePoint(92).repeat(5000);
    expect(parseInlineCopyToClipboard(`copyToClipboard(event, '${payload}x`)).toBeNull();
  });

  it('parses inline index actions', () => {
    expect(parseInlineLegacyAction('removeFileFromStack(12)')).toEqual({
      action: 'removeFileFromStack',
      index: 12
    });
  });

  it('normalizes inline onclick handlers into data attributes', () => {
    document.body.innerHTML = `
      <button id="copy" onclick="copyToClipboard(event, 'Legia')"></button>
      <button id="remove" onclick="removeFileFromStack(3)"></button>
    `;

    normalizeInlineCopyHandlers(document);
    normalizeInlineLegacyActionHandlers(document);

    expect(document.querySelector<HTMLElement>('#copy')?.dataset.fmCopyText).toBe('Legia');
    expect(document.querySelector('#copy')?.hasAttribute('onclick')).toBe(false);
    expect(document.querySelector<HTMLElement>('#remove')?.dataset.fmAction).toBe(
      'removeFileFromStack'
    );
    expect(document.querySelector<HTMLElement>('#remove')?.dataset.fmIndex).toBe('3');
  });

  it('dispatches normalized index and id actions through the window bridge', () => {
    const removeFileFromStack = vi.fn();
    const toggleAllVisible = vi.fn();

    document.body.innerHTML = `
      <button id="remove" data-fm-action="removeFileFromStack" data-fm-index="4"></button>
      <button id="toggle" data-fm-action="toggleAllVisible" data-fm-id="club"></button>
    `;

    getWindowRecord().removeFileFromStack = removeFileFromStack;
    getWindowRecord().toggleAllVisible = toggleAllVisible;

    const handler = createLegacyClickHandler({
      runWindowAction: (name, ...args) => {
        const action = getWindowRecord()[name];
        if (typeof action === 'function') {
          action(...args);
        }
      },
      safeCopyToClipboard: vi.fn().mockResolvedValue(void 0)
    });

    document
      .querySelector('#remove')
      ?.addEventListener('click', (event) => handler(event as MouseEvent), true);
    document
      .querySelector('#toggle')
      ?.addEventListener('click', (event) => handler(event as MouseEvent), true);

    click('#remove');
    click('#toggle');

    expect(removeFileFromStack).toHaveBeenCalledWith(4);
    expect(toggleAllVisible).toHaveBeenCalledWith('club');
  });

  it('handles inline copy clicks through the safe clipboard bridge', async () => {
    const copyTextToClipboard = vi.fn().mockResolvedValue(void 0);

    document.body.innerHTML = `<button id="copy" onclick="copyToClipboard(event, 'Lech')"></button>`;

    installInlineCopyObserver();
    const handler = createLegacyClickHandler({
      runWindowAction: vi.fn(),
      safeCopyToClipboard: async (event, text) => {
        event.preventDefault();
        event.stopPropagation();
        await copyTextToClipboard(text);
      }
    });

    document
      .querySelector('#copy')
      ?.addEventListener('click', (event) => handler(event as MouseEvent), true);
    click('#copy');

    await vi.waitFor(() => {
      expect(copyTextToClipboard).toHaveBeenCalledWith('Lech');
    });

    expect(document.querySelector<HTMLElement>('#copy')?.dataset.fmCopyText).toBe('Lech');
  });

  it('delegates copyToClipboard data actions to the existing window bridge', () => {
    const copyToClipboard = vi.fn();

    document.body.innerHTML = `
      <i id="copy-action" data-fm-action="copyToClipboard" data-fm-text="Rakow" data-fm-icon-id="copy-1"></i>
    `;
    getWindowRecord().copyToClipboard = copyToClipboard;

    const handler = createLegacyClickHandler({
      runWindowAction: (name, ...args) => {
        const action = getWindowRecord()[name];
        if (typeof action === 'function') {
          action(...args);
        }
      },
      safeCopyToClipboard: vi.fn().mockResolvedValue(void 0)
    });

    document
      .querySelector('#copy-action')
      ?.addEventListener('click', (event) => handler(event as MouseEvent), true);

    click('#copy-action');
    expect(copyToClipboard).toHaveBeenCalledTimes(1);
    expect(copyToClipboard.mock.calls[0]?.[1]).toBe('Rakow');
    expect(copyToClipboard.mock.calls[0]?.[2]).toBe('copy-1');
  });

  it('toggles collapsible sections and chevrons locally', () => {
    document.body.innerHTML = `
      <button
        id="toggle-collapsible"
        data-fm-action="toggleCollapsible"
        data-fm-content-id="content"
        data-fm-chevron-id="chevron"
      ></button>
      <div id="content" class="hidden"></div>
      <i id="chevron" class="fa-chevron-down"></i>
    `;

    const handler = createLegacyClickHandler({
      runWindowAction: vi.fn(),
      safeCopyToClipboard: vi.fn().mockResolvedValue(void 0)
    });

    document
      .querySelector('#toggle-collapsible')
      ?.addEventListener('click', (event) => handler(event as MouseEvent), true);

    click('#toggle-collapsible');
    expect(document.querySelector('#content')?.classList.contains('hidden')).toBe(false);
    expect(document.querySelector('#chevron')?.classList.contains('fa-chevron-up')).toBe(true);
  });

  it('binds static reset and commit actions', () => {
    const resetAllFilters = vi.fn();
    const commitConfig = vi.fn();

    document.body.innerHTML = `
      <button id="clear-all-filters"></button>
      <select id="central-position-select"><option value="cb">cb</option></select>
    `;
    getWindowRecord().resetAllFilters = resetAllFilters;
    getWindowRecord().commitConfig = commitConfig;

    bindStaticLegacyInteractions((name, ...args) => {
      const action = getWindowRecord()[name];
      if (typeof action === 'function') {
        action(...args);
      }
    });

    click('#clear-all-filters');
    document
      .querySelector('#central-position-select')
      ?.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

    expect(resetAllFilters).toHaveBeenCalledTimes(1);
    expect(commitConfig).toHaveBeenCalledTimes(1);
  });

  it('does not block bubbling clicks for React-owned LDC controls', () => {
    document.body.innerHTML = `
      <button id="ldc-add-league-btn"></button>
      <input id="ldc-league-search" />
      <select id="ldc-league-filter"><option value="all">all</option></select>
    `;

    const bubbledClicks: string[] = [];
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        bubbledClicks.push(target.id);
      }
    });

    bindStaticLegacyInteractions(vi.fn());

    click('#ldc-add-league-btn');

    expect(bubbledClicks).toContain('ldc-add-league-btn');
  });

  it('normalizes future inline copy handlers via MutationObserver', async () => {
    document.body.innerHTML = '<div id="host"></div>';
    installInlineCopyObserver();

    document
      .querySelector('#host')
      ?.insertAdjacentHTML(
        'beforeend',
        `<button id="late-copy" onclick="copyToClipboard(event, 'Wisla')"></button>`
      );

    await vi.waitFor(() => {
      expect(document.querySelector<HTMLElement>('#late-copy')?.dataset.fmCopyText).toBe('Wisla');
    });
  });
});
