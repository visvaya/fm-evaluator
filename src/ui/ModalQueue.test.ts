// @vitest-environment jsdom
/**
 * Tests for ModalQueue
 *
 * ModalQueue is a singleton queue manager ensuring modals are shown
 * one at a time, in order. It also manages focus traps.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import './modalQueue.js';

let queue: any;

beforeEach(() => {
  // Create a fresh instance for each test (don't use the singleton)
  queue = new (window as any).ModalQueue.constructor();
});

describe('ModalQueue', () => {
  describe('initial state', () => {
    it('should start with empty queue', () => {
      expect(queue.getQueueLength()).toBe(0);
    });

    it('should not be processing initially', () => {
      expect(queue.isQueueProcessing()).toBe(false);
    });

    it('should have zero pending count', () => {
      expect(queue.getPendingCount()).toBe(0);
    });
  });

  describe('enqueue (normal priority)', () => {
    it('should resolve with modal function result', async () => {
      const modalFn = vi.fn().mockResolvedValue('user-confirmed');
      const result = await queue.enqueue(modalFn, 'test', 'file.html');
      expect(result).toBe('user-confirmed');
      expect(modalFn).toHaveBeenCalledOnce();
    });

    it('should process modals sequentially', async () => {
      const order: number[] = [];

      const modal1 = async () => {
        order.push(1);
        await new Promise((r) => setTimeout(r, 10));
        order.push(2);
        return 'first';
      };

      const modal2 = async () => {
        order.push(3);
        return 'second';
      };

      const [r1, r2] = await Promise.all([
        queue.enqueue(modal1, 'type-a', 'file1.html'),
        queue.enqueue(modal2, 'type-b', 'file2.html')
      ]);

      expect(r1).toBe('first');
      expect(r2).toBe('second');
      // modal1 must fully complete before modal2 starts
      expect(order[0]).toBe(1);
      expect(order[1]).toBe(2);
      expect(order[2]).toBe(3);
    });

    it('should reject when modal function throws', async () => {
      const modalFn = vi.fn().mockRejectedValue(new Error('modal error'));
      await expect(queue.enqueue(modalFn, 'err', 'fail.html')).rejects.toThrow('modal error');
    });

    it('should continue processing after error', async () => {
      const failModal = vi.fn().mockRejectedValue(new Error('fail'));
      const okModal = vi.fn().mockResolvedValue('ok');

      const results = await Promise.allSettled([
        queue.enqueue(failModal, 'fail', 'f.html'),
        queue.enqueue(okModal, 'ok', 'ok.html')
      ]);

      expect(results[0].status).toBe('rejected');
      expect(results[1].status).toBe('fulfilled');
      expect((results[1] as PromiseFulfilledResult<string>).value).toBe('ok');
    });
  });

  describe('enqueue (immediate priority)', () => {
    it('should execute immediately without queuing', async () => {
      const modalFn = vi.fn().mockResolvedValue('immediate-result');
      const result = await queue.enqueue(modalFn, 'test', 'file.html', { priority: 'immediate' });
      expect(result).toBe('immediate-result');
      expect(modalFn).toHaveBeenCalledOnce();
      // Queue should remain empty (immediate bypasses queue)
      expect(queue.getQueueLength()).toBe(0);
    });

    it('should propagate errors from immediate modals', async () => {
      const modalFn = vi.fn().mockRejectedValue(new Error('immediate fail'));
      await expect(
        queue.enqueue(modalFn, 'test', 'file.html', { priority: 'immediate' })
      ).rejects.toThrow('immediate fail');
    });
  });

  describe('cancelAll', () => {
    it('should reject all pending items', async () => {
      // Enqueue a long modal + 2 pending ones
      let resolveLong!: () => void;
      const longModal = () =>
        new Promise<void>((r) => {
          resolveLong = r;
        });
      const pending1 = vi.fn().mockResolvedValue('p1');
      const pending2 = vi.fn().mockResolvedValue('p2');

      const p0 = queue.enqueue(longModal, 'long', 'f0.html');
      const p1 = queue.enqueue(pending1, 'pend', 'f1.html');
      const p2 = queue.enqueue(pending2, 'pend', 'f2.html');

      // Wait a tick for processing to start
      await new Promise((r) => setTimeout(r, 10));

      // Cancel while longModal is still running
      queue.cancelAll('test cancellation');

      // Pending items should reject
      await expect(p1).rejects.toThrow('test cancellation');
      await expect(p2).rejects.toThrow('test cancellation');

      // Pending modals should never have been called
      expect(pending1).not.toHaveBeenCalled();
      expect(pending2).not.toHaveBeenCalled();

      // Resolve the long modal to cleanup
      resolveLong();
      await p0;
    });

    it('should clear queue length', async () => {
      let resolve!: () => void;
      const blockingModal = () =>
        new Promise<void>((r) => {
          resolve = r;
        });
      const pendingModal = vi.fn().mockResolvedValue('x');

      queue.enqueue(blockingModal, 'block', 'f.html');
      queue.enqueue(pendingModal, 'pend', 'f.html').catch(() => {});

      await new Promise((r) => setTimeout(r, 10));

      queue.cancelAll('clear test');
      expect(queue.getQueueLength()).toBe(0);

      resolve();
    });
  });

  describe('focus trap management', () => {
    it('should handle missing FocusTrap gracefully', () => {
      // Without window.fmFocusTrap / window.FocusTrap
      delete (window as any).fmFocusTrap;
      delete (window as any).FocusTrap;
      const result = queue.activateFocusTrap(document.createElement('div'));
      expect(result).toBeNull();
    });

    it('should activate focus trap when available', () => {
      const mockTrap = {
        activate: vi.fn(),
        deactivate: vi.fn()
      };

      (window as any).fmFocusTrap = {
        create: vi.fn().mockReturnValue(mockTrap)
      };

      const el = document.createElement('div');
      const result = queue.activateFocusTrap(el);
      expect(result).toBe(mockTrap);
      expect(mockTrap.activate).toHaveBeenCalled();

      // Cleanup
      delete (window as any).fmFocusTrap;
    });

    it('should deactivate existing trap before activating new one', () => {
      const trap1 = { activate: vi.fn(), deactivate: vi.fn() };
      const trap2 = { activate: vi.fn(), deactivate: vi.fn() };

      (window as any).fmFocusTrap = {
        create: vi.fn().mockReturnValueOnce(trap1).mockReturnValueOnce(trap2)
      };

      const el = document.createElement('div');
      queue.activateFocusTrap(el);
      queue.activateFocusTrap(el);

      expect(trap1.deactivate).toHaveBeenCalled();
      expect(trap2.activate).toHaveBeenCalled();

      delete (window as any).fmFocusTrap;
    });

    it('should handle deactivateFocusTrap when no trap is active', () => {
      // Should not throw
      expect(() => queue.deactivateFocusTrap()).not.toThrow();
    });
  });
});
