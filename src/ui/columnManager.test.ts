// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { COLUMNS } from '../config/columns';

import { renderColumnList } from './columnManager';

function rows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('#columns-list [draggable="true"]')];
}

function query(root: ParentNode, selector: string): Element {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

function dragEvent(type: string): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: { dropEffect: '', effectAllowed: '' }
  });
  return event;
}

// getEls() caches its lookups on first use, so the modal must exist before any render.
document.body.innerHTML = `
  <div id="columns-modal" class="hidden"><div id="columns-list"></div></div>
`;

describe('renderColumnList delegated events (strict CSP, no inline handlers)', () => {
  beforeEach(() => {
    (window as any).tableState = { toggleHidden: vi.fn() };
    (window as any).scheduleTableRender = vi.fn();
    renderColumnList();
  });

  it('renders rows without on* attributes', () => {
    const withHandlers = [...query(document, '#columns-list').querySelectorAll('*')].filter(
      (element) => element.getAttributeNames().some((name) => name.startsWith('on'))
    );

    expect(rows()).toHaveLength(COLUMNS.length);
    expect(withHandlers).toEqual([]);
  });

  it('toggles a column from its checkbox', () => {
    query(rows()[1], 'input[type="checkbox"]').dispatchEvent(
      new Event('change', { bubbles: true })
    );

    expect((window as any).tableState.toggleHidden).toHaveBeenCalledWith(COLUMNS[1].id);
  });

  it('reorders columns by drag and drop and highlights the drop target', () => {
    const firstId = COLUMNS[0].id;
    rows()[0].dispatchEvent(dragEvent('dragstart'));
    expect(rows()[0].style.opacity).toBe('0.5');

    const target = rows()[2];
    query(target, 'span').dispatchEvent(dragEvent('dragenter'));
    expect(target.classList.contains('bg-blue-50')).toBe(true);

    const over = dragEvent('dragover');
    target.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);

    target.dispatchEvent(dragEvent('dragleave'));
    expect(target.classList.contains('bg-blue-50')).toBe(false);

    target.dispatchEvent(dragEvent('drop'));
    expect(COLUMNS[2].id).toBe(firstId);
  });

  it('binds the list once across re-renders', () => {
    renderColumnList();
    query(rows()[0], 'input').dispatchEvent(new Event('change', { bubbles: true }));

    expect((window as any).tableState.toggleHidden).toHaveBeenCalledTimes(1);
  });
});
