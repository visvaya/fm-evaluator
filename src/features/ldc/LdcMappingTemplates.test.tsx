// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  failRead: false,
  stored: null as unknown,
  writes: [] as unknown[]
}));

vi.mock('@/storage/db', () => ({
  loadLdcMappingTemplatesDb: () =>
    storage.failRead ? Promise.reject(new Error('blocked')) : Promise.resolve(storage.stored),
  saveLdcMappingTemplatesDb: (templates: unknown) => {
    storage.stored = templates;
    storage.writes.push(templates);
    return Promise.resolve();
  }
}));

const confirms = vi.hoisted(() => ({ titles: [] as string[] }));
vi.mock('@/ui/ldcModalHelpers', () => ({
  showConfirmModal: (title: string, _message: string, onConfirm: () => void) => {
    confirms.titles.push(title);
    onConfirm();
  }
}));

import { LdcMappingTemplates } from './LdcMappingTemplates';

import type { LegacyLeagueMappings } from '@/config/ldcConfig';

const DRAFT = { 'Liga A||Polska': { name: 'Ekstraklasa', nation: 'Polska' } };
const SAVED = { 'Liga B': 'I liga' };

const query = <T extends Element>(container: HTMLElement, selector: string): T => {
  const element = container.querySelector<T>(selector);
  if (!element) throw new Error(`${selector} not rendered`);
  return element;
};

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const setValue = (element: HTMLInputElement | HTMLSelectElement, value: string) => {
  act(() => {
    // The prototype's setter, so React's value tracker on the element sees a change.
    const prototype =
      element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    Reflect.set(prototype, 'value', value, element);
    element.dispatchEvent(
      new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })
    );
  });
};

const optionValues = (select: HTMLSelectElement) =>
  [...select.options].map((option) => option.value);

const click = async (button: HTMLButtonElement) => {
  act(() => {
    button.click();
  });
  await flush();
};

describe('LdcMappingTemplates', () => {
  let container: HTMLDivElement;
  let root: Root;
  let loaded: LegacyLeagueMappings[];

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    Object.assign(storage, { failRead: false, stored: { Sezon: SAVED }, writes: [] });
    confirms.titles = [];
    loaded = [];
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

  const render = async (hasDraftMappings = true) => {
    act(() => {
      root.render(
        <LdcMappingTemplates
          getDraftMappings={() => DRAFT}
          hasDraftMappings={hasDraftMappings}
          onLoadTemplate={(mappings) => {
            loaded.push(mappings);
          }}
        />
      );
    });
    await flush();
    return {
      deleteButton: query<HTMLButtonElement>(container, '#ldc-delete-template-btn'),
      loadButton: query<HTMLButtonElement>(container, '#ldc-load-template-btn'),
      nameInput: query<HTMLInputElement>(container, '#ldc-template-name'),
      saveButton: query<HTMLButtonElement>(container, '#ldc-save-template-btn'),
      select: query<HTMLSelectElement>(container, '#ldc-load-template'),
      status: query<HTMLOutputElement>(container, 'output')
    };
  };

  it('lists the saved templates and loads the chosen one into the draft', async () => {
    const { loadButton, select } = await render();
    expect(optionValues(select)).toEqual(['', 'Sezon']);
    expect(loadButton.disabled).toBe(true);
    setValue(select, 'Sezon');
    await click(loadButton);
    expect(loaded).toEqual([SAVED]);
    expect(storage.writes).toEqual([]);
  });

  it('saves the draft under a trimmed name and selects it', async () => {
    const { nameInput, saveButton, select, status } = await render();
    expect(saveButton.disabled).toBe(true);
    setValue(nameInput, '  Lato ');
    await click(saveButton);
    expect(storage.stored).toEqual({ Lato: DRAFT, Sezon: SAVED });
    expect(optionValues(select)).toEqual(['', 'Lato', 'Sezon']);
    expect(select.value).toBe('Lato');
    expect(nameInput.value).toBe('');
    expect(status.textContent).toBe('ldc_template_saved');
    expect(status.className).not.toContain('text-negative');
    expect(confirms.titles).toEqual([]);
  });

  it('asks before replacing a template of the same name', async () => {
    const { nameInput, saveButton } = await render();
    setValue(nameInput, 'Sezon');
    await click(saveButton);
    expect(confirms.titles).toHaveLength(1);
    expect(storage.stored).toEqual({ Sezon: DRAFT });
  });

  it('asks before deleting and removes only the chosen template', async () => {
    storage.stored = { Lato: DRAFT, Sezon: SAVED };
    const { deleteButton, select } = await render();
    setValue(select, 'Sezon');
    await click(deleteButton);
    expect(confirms.titles).toHaveLength(1);
    expect(storage.stored).toEqual({ Lato: DRAFT });
    expect(optionValues(select)).toEqual(['', 'Lato']);
  });

  it('does not save an empty draft', async () => {
    const { nameInput, saveButton } = await render(false);
    setValue(nameInput, 'Pusty');
    expect(saveButton.disabled).toBe(true);
  });

  it('shows a read error and never overwrites templates it could not read', async () => {
    storage.failRead = true;
    const { nameInput, saveButton, status } = await render();
    setValue(nameInput, 'Lato');
    expect(saveButton.disabled).toBe(true);
    expect(status.textContent).not.toBe('');
    expect(storage.writes).toEqual([]);
  });
});
