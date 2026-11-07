/**
 * Circuit Breaker & Watchdog for Worker Management
 * Provides resilience patterns for worker failures
 */

export interface CircuitBreakerConfig {
  failureThreshold: number;
  onFallback?: () => void;
  onStateChange?: (state: CircuitState, reason: string) => void;
  resetTimeout: number;
  successThreshold: number;
  timeout: number;
}

export interface CircuitBreakerStats {
  failures: number;
  lastFailure: null | number;
  lastSuccess: null | number;
  openedAt: null | number;
  state: CircuitState;
  successes: number;
  totalCalls: number;
  totalFailures: number;
  totalSuccesses: number;
}

export type CircuitState = 'closed' | 'half-open' | 'open';

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 60000,
  successThreshold: 2,
  timeout: 30000
};

export interface WatchdogConfig {
  heartbeatInterval: number;
  heartbeatTimeout: number;
  maxMissedHeartbeats: number;
  onRecovered?: () => void;
  onUnresponsive?: () => void;
}

export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private failures = 0;
  private lastFailure: null | number = null;
  private lastSuccess: null | number = null;
  private openedAt: null | number = null;
  private resetTimeoutId: null | ReturnType<typeof setTimeout> = null;
  private state: CircuitState = 'closed';
  private successes = 0;
  private totalCalls = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  canExecute(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'half-open') return true;

    // Check if enough time has passed to try again
    if (this.state === 'open' && this.openedAt) {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed >= this.config.resetTimeout) {
        this.setState('half-open', 'Reset timeout elapsed (manual check)');
        return true;
      }
    }

    return false;
  }

  async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T> | T): Promise<T> {
    if (!this.canExecute()) {
      console.warn('[CircuitBreaker] Circuit is open, executing fallback');
      this.config.onFallback?.();

      if (fallback) {
        return fallback();
      }
      throw new Error('Circuit breaker is open and no fallback provided');
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): CircuitBreakerStats {
    return {
      failures: this.failures,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      openedAt: this.openedAt,
      state: this.state,
      successes: this.successes,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses
    };
  }

  recordFailure(error?: Error): void {
    this.totalCalls++;
    this.totalFailures++;
    this.failures++;
    this.lastFailure = Date.now();

    const errorMsg = error?.message || 'Unknown error';

    if (this.state === 'half-open') {
      this.setState('open', `Failed during half-open: ${errorMsg}`);
      this.successes = 0;
    } else if (this.state === 'closed' && this.failures >= this.config.failureThreshold) {
      this.setState('open', `${this.failures} consecutive failures`);
    }
  }

  recordSuccess(): void {
    this.totalCalls++;
    this.totalSuccesses++;
    this.lastSuccess = Date.now();

    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.setState('closed', `${this.successes} consecutive successes`);
      }
    } else if (this.state === 'closed') {
      // Reset failure count on success
      this.failures = 0;
    }
  }

  reset(): void {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.openedAt = null;
  }

  private scheduleReset(): void {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.resetTimeoutId = setTimeout(() => {
      if (this.state === 'open') {
        this.setState('half-open', 'Reset timeout elapsed');
      }
    }, this.config.resetTimeout);
  }

  private setState(newState: CircuitState, reason: string): void {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;

      if (newState === 'open') {
        this.openedAt = Date.now();
        this.scheduleReset();
      } else if (newState === 'closed') {
        this.openedAt = null;
        this.failures = 0;
        this.successes = 0;
      }

      console.log(`[CircuitBreaker] State: ${oldState} → ${newState} (${reason})`);
      this.config.onStateChange?.(newState, reason);
    }
  }
}

const DEFAULT_WATCHDOG_CONFIG: WatchdogConfig = {
  heartbeatInterval: 5000,
  heartbeatTimeout: 3000,
  maxMissedHeartbeats: 3
};

export interface RetryConfig {
  backoffMultiplier: number;
  baseDelay: number;
  maxDelay: number;
  maxRetries: number;
  retryableErrors?: string[];
}

export class Watchdog {
  private config: WatchdogConfig;
  private intervalId: null | ReturnType<typeof setInterval> = null;
  private isResponsive = true;
  private lastHeartbeat: null | number = null;
  private missedHeartbeats = 0;
  private pingFn: (() => Promise<boolean>) | null = null;

  constructor(config: Partial<WatchdogConfig> = {}) {
    this.config = { ...DEFAULT_WATCHDOG_CONFIG, ...config };
  }

  getLastHeartbeat(): null | number {
    return this.lastHeartbeat;
  }

  getMissedHeartbeats(): number {
    return this.missedHeartbeats;
  }

  isWorkerResponsive(): boolean {
    return this.isResponsive;
  }

  manualHeartbeat(): void {
    this.lastHeartbeat = Date.now();
    this.missedHeartbeats = 0;
    if (!this.isResponsive) {
      this.isResponsive = true;
      this.config.onRecovered?.();
    }
  }

  start(pingFn: () => Promise<boolean>): void {
    if (this.intervalId) {
      this.stop();
    }

    this.pingFn = pingFn;
    this.missedHeartbeats = 0;
    this.isResponsive = true;

    this.intervalId = setInterval(() => this.checkHeartbeat(), this.config.heartbeatInterval);
    console.log('[Watchdog] Started monitoring');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.pingFn = null;
    console.log('[Watchdog] Stopped monitoring');
  }

  private async checkHeartbeat(): Promise<void> {
    if (!this.pingFn) return;

    try {
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error('Heartbeat timeout')), this.config.heartbeatTimeout);
      });

      const alive = await Promise.race([this.pingFn(), timeoutPromise]);

      if (alive) {
        this.lastHeartbeat = Date.now();
        this.missedHeartbeats = 0;

        if (!this.isResponsive) {
          this.isResponsive = true;
          console.log('[Watchdog] Worker recovered');
          this.config.onRecovered?.();
        }
      } else {
        this.handleMissedHeartbeat();
      }
    } catch {
      this.handleMissedHeartbeat();
    }
  }

  private handleMissedHeartbeat(): void {
    this.missedHeartbeats++;
    console.warn(
      `[Watchdog] Missed heartbeat (${this.missedHeartbeats}/${this.config.maxMissedHeartbeats})`
    );

    if (this.missedHeartbeats >= this.config.maxMissedHeartbeats && this.isResponsive) {
      this.isResponsive = false;
      console.error('[Watchdog] Worker unresponsive');
      this.config.onUnresponsive?.();
    }
  }
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  backoffMultiplier: 2,
  baseDelay: 1000,
  maxDelay: 30000,
  maxRetries: 3
};

/**
 * Worker resilience wrapper. Unused today; kept until the React/TS migration decides its fate.
 * @public
 */
export function createResilientWorkerWrapper<T extends object>(
  createWorker: () => Promise<T>,
  options: {
    circuitBreaker?: Partial<CircuitBreakerConfig>;
    pingMethod?: keyof T;
    retry?: Partial<RetryConfig>;
    watchdog?: Partial<WatchdogConfig>;
  } = {}
): {
  circuitBreaker: CircuitBreaker;
  getStats: () => { circuit: CircuitBreakerStats; watchdogResponsive: boolean };
  init: () => Promise<T>;
  restart: () => Promise<T>;
  watchdog: Watchdog;
  worker: null | T;
} {
  let worker: null | T = null;
  const circuitBreaker = new CircuitBreaker(options.circuitBreaker);
  const watchdog = new Watchdog({
    ...options.watchdog,
    onUnresponsive: () => {
      console.error('[ResilientWorker] Worker unresponsive, triggering restart');
      restart().catch(console.error);
    }
  });

  const init = async (): Promise<T> => {
    return circuitBreaker.execute(async () => {
      worker = await withRetry(createWorker, options.retry);

      // Start watchdog if ping method is available
      if (options.pingMethod && worker) {
        const pingFn = (worker as any)[options.pingMethod];
        if (typeof pingFn === 'function') {
          watchdog.start(async () => {
            try {
              await pingFn.call(worker);
              return true;
            } catch {
              return false;
            }
          });
        }
      }

      return worker;
    });
  };

  const restart = async (): Promise<T> => {
    watchdog.stop();
    worker = null;
    return init();
  };

  const getStats = () => ({
    circuit: circuitBreaker.getStats(),
    watchdogResponsive: watchdog.isWorkerResponsive()
  });

  return {
    circuitBreaker,
    getStats,
    init,
    restart,
    watchdog,
    get worker() {
      return worker;
    }
  };
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;
  let delay = cfg.baseDelay;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (cfg.retryableErrors && cfg.retryableErrors.length > 0) {
        const isRetryable = cfg.retryableErrors.some((msg) =>
          lastError.message.toLowerCase().includes(msg.toLowerCase())
        );
        if (!isRetryable) {
          throw lastError;
        }
      }

      if (attempt < cfg.maxRetries) {
        console.warn(
          `[Retry] Attempt ${attempt + 1}/${cfg.maxRetries + 1} failed, retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * cfg.backoffMultiplier, cfg.maxDelay);
      }
    }
  }

  throw lastError || new Error('All retries exhausted');
}
