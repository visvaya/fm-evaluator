// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const renderLanguageDropdown = vi.fn();
const onLocaleChange = vi.fn();
const createFocusTrap = vi.fn();

vi.mock('@/i18n', () => ({
  default: {
    onLocaleChange,
    renderLanguageDropdown
  }
}));

vi.mock('@/ui/focusTrap', () => ({
  createFocusTrap
}));

describe('runtimeUiBindings', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = '';
    delete (window as any).toggleLanguageDropdown;
    delete (window as any).CURRENT_LANGUAGE;
    delete (window as any).updateUI;
  });

  it('installs language bindings and reacts to locale changes', async () => {
    (window as any).CURRENT_LANGUAGE = 'en';
    (window as any).updateUI = vi.fn();

    const { installLanguageBindings } = await import('./runtimeUiBindings');

    installLanguageBindings();

    expect(renderLanguageDropdown).toHaveBeenCalledWith('language-dropdown');
    expect(typeof (window as any).toggleLanguageDropdown).toBe('function');
    expect(onLocaleChange).toHaveBeenCalledOnce();

    const localeHandler = onLocaleChange.mock.calls[0][0] as (locale: string) => void;
    localeHandler('pl');

    expect((window as any).CURRENT_LANGUAGE).toBe('pl');
    expect((window as any).updateUI).toHaveBeenCalledOnce();
    expect(renderLanguageDropdown).toHaveBeenCalledTimes(2);
  });

  it('creates and clears the active focus trap for settings modal', async () => {
    document.body.innerHTML = `
      <button id="settings-btn" type="button">Open</button>
      <button id="close-settings" type="button">Close</button>
      <div id="settings-modal"></div>
    `;

    const trap = {
      activate: vi.fn(),
      deactivate: vi.fn()
    };
    createFocusTrap.mockReturnValue(trap);

    const { getActiveModalTrap, setupSettingsModalFocusTrap } = await import('./runtimeUiBindings');

    setupSettingsModalFocusTrap();
    document.querySelector<HTMLButtonElement>('#settings-btn')?.click();

    expect(createFocusTrap).toHaveBeenCalledOnce();
    expect(trap.activate).toHaveBeenCalledOnce();
    expect(getActiveModalTrap()).toBe(trap);

    const modal = document.querySelector<HTMLElement>('#settings-modal');
    modal?.classList.add('hidden');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(trap.deactivate).toHaveBeenCalled();
    expect(getActiveModalTrap()).toBeNull();
  });
});
