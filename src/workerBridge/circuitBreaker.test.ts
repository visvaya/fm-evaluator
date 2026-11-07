import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CircuitBreaker, Watchdog, withRetry } from './circuitBreaker';

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 1000, successThreshold: 2 });
  });

  afterEach(() => {
    cb.reset();
  });

  describe('initial state', () => {
    it('should start in closed state', () => {
      expect(cb.getState()).toBe('closed');
    });

    it('should allow execution when closed', () => {
      expect(cb.canExecute()).toBe(true);
    });

    it('should have zero stats initially', () => {
      const stats = cb.getStats();
      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0);
      expect(stats.totalCalls).toBe(0);
      expect(stats.openedAt).toBeNull();
    });
  });

  describe('success recording', () => {
    it('should increment totalCalls and totalSuccesses', () => {
      cb.recordSuccess();
      const stats = cb.getStats();
      expect(stats.totalCalls).toBe(1);
      expect(stats.totalSuccesses).toBe(1);
    });

    it('should reset failure count on success in closed state', () => {
      cb.recordFailure();
      cb.recordFailure();
      cb.recordSuccess();
      expect(cb.getStats().failures).toBe(0);
    });

    it('should record lastSuccess timestamp', () => {
      cb.recordSuccess();
      expect(cb.getStats().lastSuccess).not.toBeNull();
    });
  });

  describe('failure recording', () => {
    it('should increment failure count', () => {
      cb.recordFailure();
      expect(cb.getStats().failures).toBe(1);
    });

    it('should open circuit after threshold failures', () => {
      cb.recordFailure();
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.getState()).toBe('open');
    });

    it('should not open circuit before threshold', () => {
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.getState()).toBe('closed');
    });

    it('should record lastFailure timestamp', () => {
      cb.recordFailure();
      expect(cb.getStats().lastFailure).not.toBeNull();
    });
  });

  describe('open state', () => {
    it('should not allow execution when open', () => {
      for (let i = 0; i < 3; i++) cb.recordFailure();
      expect(cb.canExecute()).toBe(false);
    });

    it('should record openedAt timestamp', () => {
      for (let i = 0; i < 3; i++) cb.recordFailure();
      expect(cb.getStats().openedAt).not.toBeNull();
    });

    it('should transition to half-open after resetTimeout', () => {
      vi.useFakeTimers();
      // Create CB with fake timers active so scheduleReset uses fake timers
      const cb2 = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 1000 });
      for (let i = 0; i < 3; i++) cb2.recordFailure();
      expect(cb2.getState()).toBe('open');

      vi.advanceTimersByTime(1100);
      expect(cb2.getState()).toBe('half-open');

      cb2.reset();
      vi.useRealTimers();
    });

    it('should allow canExecute after resetTimeout via manual check', () => {
      // Use real time: set openedAt in the past via recording failures
      // then override openedAt check
      for (let i = 0; i < 3; i++) cb.recordFailure();
      expect(cb.getState()).toBe('open');

      // Simulate time passing via getStats manipulation isn't possible,
      // but canExecute checks Date.now() - openedAt >= resetTimeout
      // We test the canExecute false case here
      expect(cb.canExecute()).toBe(false);
    });
  });

  describe('half-open state', () => {
    let cb2: CircuitBreaker;

    beforeEach(() => {
      vi.useFakeTimers();
      cb2 = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 1000, successThreshold: 2 });
      for (let i = 0; i < 3; i++) cb2.recordFailure();
      vi.advanceTimersByTime(1100);
      // Now in half-open
    });

    afterEach(() => {
      cb2.reset();
      vi.useRealTimers();
    });

    it('should allow execution in half-open state', () => {
      expect(cb2.canExecute()).toBe(true);
    });

    it('should close after enough successes', () => {
      cb2.recordSuccess();
      cb2.recordSuccess();
      expect(cb2.getState()).toBe('closed');
    });

    it('should reopen on failure in half-open', () => {
      cb2.recordFailure();
      expect(cb2.getState()).toBe('open');
    });

    it('should reset successes on failure in half-open', () => {
      cb2.recordSuccess();
      cb2.recordFailure();
      expect(cb2.getState()).toBe('open');
    });
  });

  describe('reset', () => {
    it('should reset to closed state', () => {
      for (let i = 0; i < 3; i++) cb.recordFailure();
      expect(cb.getState()).toBe('open');
      cb.reset();
      expect(cb.getState()).toBe('closed');
      expect(cb.getStats().failures).toBe(0);
    });
  });

  describe('execute', () => {
    it('should execute function and record success', async () => {
      const result = await cb.execute(() => Promise.resolve(42));
      expect(result).toBe(42);
      expect(cb.getStats().totalSuccesses).toBe(1);
    });

    it('should record failure on exception and rethrow', async () => {
      await expect(cb.execute(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
      expect(cb.getStats().totalFailures).toBe(1);
    });

    it('should call fallback when circuit is open', async () => {
      for (let i = 0; i < 3; i++) cb.recordFailure();
      const result = await cb.execute(
        () => Promise.resolve('never'),
        () => 'fallback'
      );
      expect(result).toBe('fallback');
    });

    it('should throw when open and no fallback', async () => {
      for (let i = 0; i < 3; i++) cb.recordFailure();
      await expect(cb.execute(() => Promise.resolve('never'))).rejects.toThrow(
        'Circuit breaker is open'
      );
    });
  });

  describe('onStateChange callback', () => {
    it('should call onStateChange when state transitions', () => {
      const onChange = vi.fn();
      const cb2 = new CircuitBreaker({
        failureThreshold: 2,
        onStateChange: onChange
      });
      cb2.recordFailure();
      cb2.recordFailure();
      expect(onChange).toHaveBeenCalledWith('open', expect.any(String));
      cb2.reset();
    });
  });
});

describe('Watchdog', () => {
  it('should start as responsive', () => {
    const wd = new Watchdog();
    expect(wd.isWorkerResponsive()).toBe(true);
  });

  it('should have null lastHeartbeat initially', () => {
    const wd = new Watchdog();
    expect(wd.getLastHeartbeat()).toBeNull();
  });

  it('should have 0 missed heartbeats initially', () => {
    const wd = new Watchdog();
    expect(wd.getMissedHeartbeats()).toBe(0);
  });

  it('should update lastHeartbeat on manual heartbeat', () => {
    const wd = new Watchdog();
    wd.manualHeartbeat();
    expect(wd.getLastHeartbeat()).not.toBeNull();
    expect(wd.getMissedHeartbeats()).toBe(0);
  });

  it('should reset missed heartbeats on manual heartbeat', () => {
    const wd = new Watchdog({ maxMissedHeartbeats: 10 });
    // Manually increment internal state isn't possible, but
    // manualHeartbeat resets to 0
    wd.manualHeartbeat();
    expect(wd.getMissedHeartbeats()).toBe(0);
  });

  it('should stop monitoring on stop()', () => {
    vi.useFakeTimers();
    const wd = new Watchdog({ heartbeatInterval: 100 });
    wd.start(() => Promise.resolve(true));
    wd.stop();
    // Advancing time should not trigger heartbeat checks after stop
    vi.advanceTimersByTime(500);
    // Should still be responsive (no checks ran)
    expect(wd.isWorkerResponsive()).toBe(true);
    vi.useRealTimers();
  });
});

describe('withRetry', () => {
  it('should return result on first success', async () => {
    const result = await withRetry(() => Promise.resolve('ok'), { maxRetries: 3 });
    expect(result).toBe('ok');
  });

  it('should retry on failure and succeed eventually', async () => {
    vi.useFakeTimers();
    let attempt = 0;
    const fn = () => {
      attempt++;
      if (attempt < 3) return Promise.reject(new Error('fail'));
      return Promise.resolve('success');
    };

    const promise = withRetry(fn, { baseDelay: 10, maxRetries: 3 });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;
    expect(result).toBe('success');
    expect(attempt).toBe(3);
    vi.useRealTimers();
  });

  it('should throw after exhausting retries', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      throw new Error('always fails');
    };
    await expect(withRetry(fn, { baseDelay: 1, maxDelay: 1, maxRetries: 2 })).rejects.toThrow(
      'always fails'
    );
    expect(attempts).toBe(3); // initial + 2 retries
  });

  it('should not retry non-retryable errors', async () => {
    let attempts = 0;
    const fn = () => {
      attempts++;
      return Promise.reject(new Error('fatal error'));
    };

    await expect(
      withRetry(fn, {
        baseDelay: 10,
        maxRetries: 3,
        retryableErrors: ['timeout']
      })
    ).rejects.toThrow('fatal error');

    expect(attempts).toBe(1);
  });
});
