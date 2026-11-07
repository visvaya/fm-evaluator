// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFocusTrap, deactivateAllTraps, hasActiveTrap } from './focusTrap';

describe('focusTrap', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    container.innerHTML = `
            <button id="btn1">Button 1</button>
            <input id="input1" type="text" />
            <button id="btn2">Button 2</button>
            <a id="link1" href="#">Link</a>
        `;
    document.body.append(container);
    deactivateAllTraps();
  });

  afterEach(() => {
    deactivateAllTraps();
    document.body.innerHTML = '';
  });

  describe('createFocusTrap', () => {
    it('should create a trap with correct API', () => {
      const trap = createFocusTrap(container);
      expect(trap.activate).toBeDefined();
      expect(trap.deactivate).toBeDefined();
      expect(trap.pause).toBeDefined();
      expect(trap.unpause).toBeDefined();
      expect(trap.isActive).toBeDefined();
      expect(trap.isPaused).toBeDefined();
      expect(trap.updateContainerElements).toBeDefined();
    });

    it('should start inactive', () => {
      const trap = createFocusTrap(container);
      expect(trap.isActive()).toBe(false);
      expect(trap.isPaused()).toBe(false);
    });
  });

  describe('activate', () => {
    it('should mark trap as active', () => {
      const trap = createFocusTrap(container);
      trap.activate();
      expect(trap.isActive()).toBe(true);
    });

    it('should set aria-modal on container', () => {
      const trap = createFocusTrap(container);
      trap.activate();
      expect(container.getAttribute('aria-modal')).toBe('true');
    });

    it('should set role=dialog on container', () => {
      const trap = createFocusTrap(container);
      trap.activate();
      expect(container.getAttribute('role')).toBe('dialog');
    });

    it('should register in active traps', () => {
      const trap = createFocusTrap(container);
      trap.activate();
      expect(hasActiveTrap()).toBe(true);
    });

    it('should not double-activate', () => {
      const trap = createFocusTrap(container);
      trap.activate();
      trap.activate(); // Should not throw
      expect(trap.isActive()).toBe(true);
    });
  });

  describe('deactivate', () => {
    it('should mark trap as inactive', () => {
      const trap = createFocusTrap(container);
      trap.activate();
      trap.deactivate();
      expect(trap.isActive()).toBe(false);
    });

    it('should remove aria-modal from container', () => {
      const trap = createFocusTrap(container);
      trap.activate();
      trap.deactivate();
      expect(container.getAttribute('aria-modal')).toBeNull();
    });

    it('should remove from active traps', () => {
      const trap = createFocusTrap(container);
      trap.activate();
      trap.deactivate();
      expect(hasActiveTrap()).toBe(false);
    });

    it('should call onDeactivate callback', () => {
      const onDeactivate = vi.fn();
      const trap = createFocusTrap(container, { onDeactivate });
      trap.activate();
      trap.deactivate();
      expect(onDeactivate).toHaveBeenCalledOnce();
    });

    it('should not throw when deactivating inactive trap', () => {
      const trap = createFocusTrap(container);
      expect(() => trap.deactivate()).not.toThrow();
    });
  });

  describe('pause/unpause', () => {
    it('should mark trap as paused', () => {
      const trap = createFocusTrap(container);
      trap.activate();
      trap.pause();
      expect(trap.isPaused()).toBe(true);
    });

    it('should unpause trap', () => {
      const trap = createFocusTrap(container);
      trap.activate();
      trap.pause();
      trap.unpause();
      expect(trap.isPaused()).toBe(false);
    });
  });

  describe('keyboard handling', () => {
    it('should handle Escape key when escapeDeactivates is false', () => {
      const onEscape = vi.fn();
      const trap = createFocusTrap(container, {
        escapeDeactivates: true,
        onEscape
      });
      trap.activate();

      const event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'Escape'
      });
      document.dispatchEvent(event);

      expect(onEscape).toHaveBeenCalled();
      trap.deactivate();
    });

    it('should not handle keys when paused', () => {
      const onEscape = vi.fn();
      const trap = createFocusTrap(container, {
        escapeDeactivates: true,
        onEscape
      });
      trap.activate();
      trap.pause();

      const event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'Escape'
      });
      document.dispatchEvent(event);

      expect(onEscape).not.toHaveBeenCalled();
      trap.deactivate();
    });
  });

  describe('deactivateAllTraps', () => {
    it('should deactivate all active traps', () => {
      const container2 = document.createElement('div');
      container2.innerHTML = '<button>B</button>';
      document.body.append(container2);

      const trap1 = createFocusTrap(container);
      const trap2 = createFocusTrap(container2);
      trap1.activate();
      trap2.activate();

      expect(hasActiveTrap()).toBe(true);

      deactivateAllTraps();

      expect(hasActiveTrap()).toBe(false);
    });
  });

  describe('hasActiveTrap', () => {
    it('should return false when no traps active', () => {
      expect(hasActiveTrap()).toBe(false);
    });

    it('should return true when a trap is active', () => {
      const trap = createFocusTrap(container);
      trap.activate();
      expect(hasActiveTrap()).toBe(true);
      trap.deactivate();
    });
  });
});
