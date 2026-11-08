/**
 * Focus Trap - A11y utility for trapping keyboard focus within modals
 * Prevents tab navigation from escaping modal boundaries
 */

const FOCUSABLE_SELECTORS = [
  'a[href]:not([disabled]):not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"]):not([disabled])',
  '[contenteditable="true"]:not([tabindex="-1"])'
].join(', ');

export interface FocusTrap {
  activate: () => void;
  deactivate: () => void;
  isActive: () => boolean;
  isPaused: () => boolean;
  pause: () => void;
  unpause: () => void;
  updateContainerElements: () => void;
}

export interface FocusTrapOptions {
  escapeDeactivates?: boolean;
  initialFocus?: HTMLElement | null | string;
  onDeactivate?: () => void;
  onEscape?: () => void;
  returnFocus?: boolean;
}

interface TrapState {
  active: boolean;
  container: HTMLElement;
  focusinHandler: ((e: FocusEvent) => void) | null;
  keydownHandler: ((e: KeyboardEvent) => void) | null;
  options: FocusTrapOptions;
  paused: boolean;
  previouslyFocused: HTMLElement | null;
}

const activeTraps = new Map<HTMLElement, TrapState>();

export function createFocusTrap(container: HTMLElement, options: FocusTrapOptions = {}): FocusTrap {
  const defaultOptions: FocusTrapOptions = {
    escapeDeactivates: true,
    initialFocus: null,
    onDeactivate: undefined,
    onEscape: undefined,
    returnFocus: true
  };

  const mergedOptions = { ...defaultOptions, ...options };

  const state: TrapState = {
    active: false,
    container,
    focusinHandler: null,
    keydownHandler: null,
    options: mergedOptions,
    paused: false,
    previouslyFocused: null
  };

  function handleKeyDown(event: KeyboardEvent): void {
    if (state.paused) return;

    // Handle Escape key
    if (event.key === 'Escape' && mergedOptions.escapeDeactivates) {
      event.preventDefault();
      event.stopPropagation();

      if (mergedOptions.onEscape) {
        mergedOptions.onEscape();
      }
      return;
    }

    // Handle Tab key
    if (event.key === 'Tab') {
      const focusables = getFocusableElements(container);

      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables.at(-1);
      const active = document.activeElement as HTMLElement;

      if (event.shiftKey) {
        // Shift + Tab: go backwards
        if (active === first || !container.contains(active)) {
          event.preventDefault();
          focusElement(last);
        }
      } else {
        // Tab: go forwards
        if (active === last || !container.contains(active)) {
          event.preventDefault();
          focusElement(first);
        }
      }
    }
  }

  function handleFocusIn(event: FocusEvent): void {
    if (state.paused) return;

    const target = event.target as HTMLElement;

    // If focus moved outside the container, bring it back
    if (!container.contains(target)) {
      event.preventDefault();
      event.stopPropagation();
      focusElement(getFirstFocusable(container));
    }
  }

  function activate(): void {
    if (state.active) return;

    // Store currently focused element for later restoration
    state.previouslyFocused = document.activeElement as HTMLElement;

    // Set up event listeners
    state.keydownHandler = handleKeyDown;
    state.focusinHandler = handleFocusIn;

    document.addEventListener('keydown', state.keydownHandler, true);
    document.addEventListener('focusin', state.focusinHandler, true);

    // Focus initial element
    const initialElement = resolveInitialFocus(container, mergedOptions.initialFocus);

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      focusElement(initialElement);
    });

    // Set ARIA attributes
    container.setAttribute('aria-modal', 'true');
    container.setAttribute('role', 'dialog');

    state.active = true;
    activeTraps.set(container, state);

    // Announce to screen readers
    announceToScreenReader('Dialog opened');
  }

  function deactivate(): void {
    if (!state.active) return;

    // Remove event listeners
    if (state.keydownHandler) {
      document.removeEventListener('keydown', state.keydownHandler, true);
    }
    if (state.focusinHandler) {
      document.removeEventListener('focusin', state.focusinHandler, true);
    }

    state.keydownHandler = null;
    state.focusinHandler = null;

    // Restore focus
    if (mergedOptions.returnFocus && state.previouslyFocused) {
      requestAnimationFrame(() => {
        focusElement(state.previouslyFocused);
      });
    }

    // Remove ARIA attributes
    container.removeAttribute('aria-modal');

    state.active = false;
    state.paused = false;
    activeTraps.delete(container);

    if (mergedOptions.onDeactivate) {
      mergedOptions.onDeactivate();
    }

    announceToScreenReader('Dialog closed');
  }

  function pause(): void {
    state.paused = true;
  }

  function unpause(): void {
    state.paused = false;
  }

  function isActive(): boolean {
    return state.active;
  }

  function isPaused(): boolean {
    return state.paused;
  }

  function updateContainerElements(): void {
    // Force re-query of focusable elements
    // Useful after dynamic content changes
    if (state.active && !state.paused) {
      const focusables = getFocusableElements(container);
      const active = document.activeElement as HTMLElement;

      // If current focus is not in focusables, refocus first element
      if (!focusables.includes(active)) {
        focusElement(focusables[0] || null);
      }
    }
  }

  return {
    activate,
    deactivate,
    isActive,
    isPaused,
    pause,
    unpause,
    updateContainerElements
  };
}

function focusElement(element: HTMLElement | null): void {
  if (!element) return;

  try {
    element.focus({ preventScroll: false });
  } catch {
    // Some elements may throw on focus
  }
}

function getFirstFocusable(container: HTMLElement): HTMLElement | null {
  const elements = getFocusableElements(container);
  return elements[0] || null;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)];

  return elements.filter((el) => {
    // Check visibility
    if (el.offsetParent === null && el.style.position !== 'fixed') {
      return false;
    }
    // Check if hidden
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') {
      return false;
    }
    return true;
  });
}

function resolveInitialFocus(
  container: HTMLElement,
  initialFocus: HTMLElement | null | string | undefined
): HTMLElement | null {
  if (!initialFocus) {
    return getFirstFocusable(container);
  }

  if (typeof initialFocus === 'string') {
    const el = container.querySelector<HTMLElement>(initialFocus);
    return el || getFirstFocusable(container);
  }

  if (initialFocus instanceof HTMLElement) {
    return initialFocus;
  }

  return getFirstFocusable(container);
}

// Live region for screen reader announcements
let liveRegion: HTMLElement | null = null;

// Deactivate all active traps
export function deactivateAllTraps(): void {
  for (const [, state] of activeTraps) {
    if (state.active) {
      // Manually deactivate
      if (state.keydownHandler) {
        document.removeEventListener('keydown', state.keydownHandler, true);
      }
      if (state.focusinHandler) {
        document.removeEventListener('focusin', state.focusinHandler, true);
      }
      state.active = false;
      state.container.removeAttribute('aria-modal');
    }
  }
  activeTraps.clear();
}

// Utility to get active trap for a container
export function getActiveTrap(container: HTMLElement): TrapState | undefined {
  return activeTraps.get(container);
}

// Utility to check if any trap is active
export function hasActiveTrap(): boolean {
  return activeTraps.size > 0;
}

function announceToScreenReader(message: string): void {
  const region = ensureLiveRegion();
  region.textContent = '';

  // Use setTimeout to ensure the change is detected
  setTimeout(() => {
    region.textContent = message;
  }, 50);
}

function ensureLiveRegion(): HTMLElement {
  if (liveRegion && document.body.contains(liveRegion)) {
    return liveRegion;
  }

  liveRegion = document.createElement('div');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.setAttribute('role', 'status');
  liveRegion.className = 'sr-only';
  liveRegion.style.cssText = `
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  `;

  document.body.append(liveRegion);
  return liveRegion;
}

// Export for window access
if (typeof window !== 'undefined') {
  (window as any).FocusTrap = {
    create: createFocusTrap,
    deactivateAll: deactivateAllTraps,
    getActive: getActiveTrap,
    hasActive: hasActiveTrap
  };
}
