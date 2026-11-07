/**
 * ParserBridge - Bridge for communicating with ParserWorker
 * Provides a clean API for main thread to use parsing functionality
 */
import { type Remote, wrap } from 'comlink';

import type {
  BatchParseRequest,
  BatchParseResult,
  FormatContext,
  LanguageConfig,
  NormalizationConfig,
  ParseResult,
  SchemaInfo
} from '../parsing/parserTypes';
import type { ParserApi } from '../workers/parser.worker';

interface ParserBridgeOptions {
  onError?: (error: Error) => void;
  onStateChange?: (state: WorkerState) => void;
  timeout?: number;
}

type WorkerState = 'busy' | 'error' | 'idle' | 'terminated';
type WorkerFailureKind = 'error' | 'messageerror';

const DEFAULT_TIMEOUT = 30000;

class ParserBridge {
  private api: null | Remote<ParserApi> = null;
  private initPromise: null | Promise<void> = null;
  private isTerminating = false;
  private options: ParserBridgeOptions;
  private state: WorkerState = 'idle';
  private worker: null | Worker = null;

  constructor(options: ParserBridgeOptions = {}) {
    this.options = {
      onError: options.onError,
      onStateChange: options.onStateChange,
      timeout: options.timeout ?? DEFAULT_TIMEOUT
    };
  }

  getState(): WorkerState {
    return this.state;
  }

  async init(): Promise<void> {
    if (this.initPromise !== null) return this.initPromise;
    if (this.api !== null) return;

    this.initPromise = this.doInit();
    return this.initPromise;
  }

  async parse(
    value: string,
    schemaInfo: SchemaInfo,
    formatContext: Partial<FormatContext> = {},
    normalizationConfig: NormalizationConfig | null = null,
    languageConfig: LanguageConfig = {}
  ): Promise<ParseResult> {
    await this.init();
    if (!this.api) throw new Error('Worker not initialized');

    this.setState('busy');
    try {
      const result = await this.withTimeout(
        this.api.parse(value, schemaInfo, formatContext, normalizationConfig, languageConfig),
        this.options.timeout
      );
      this.setState('idle');
      return result;
    } catch (error) {
      this.setState('error');
      throw error;
    }
  }

  async parseBatch(request: BatchParseRequest): Promise<BatchParseResult> {
    await this.init();
    if (!this.api) throw new Error('Worker not initialized');

    this.setState('busy');
    try {
      const result = await this.withTimeout(this.api.parseBatch(request), this.options.timeout);
      this.setState('idle');
      return result;
    } catch (error) {
      this.setState('error');
      throw error;
    }
  }

  async restart(): Promise<void> {
    this.terminate();
    this.isTerminating = false;
    this.setState('idle');
    await this.init();
  }

  terminate(): void {
    this.isTerminating = true;
    if (this.worker) {
      this.worker.removeEventListener('error', this.handleErrorEvent);
      this.worker.removeEventListener('messageerror', this.handleMessageErrorEvent);
      this.worker.terminate();
      this.worker = null;
    }
    this.api = null;
    this.initPromise = null;
    this.setState('terminated');
  }

  private buildWorkerError(
    kind: WorkerFailureKind,
    event: ErrorEvent | Event
  ): { details: Record<string, unknown>; error: Error } {
    const errorEvent = event as ErrorEvent;
    const message = this.getWorkerFailureMessage(kind, errorEvent);
    const details = {
      colno: typeof errorEvent.colno === 'number' ? errorEvent.colno : undefined,
      filename: errorEvent.filename || undefined,
      isTrusted: event.isTrusted,
      kind,
      lineno: typeof errorEvent.lineno === 'number' ? errorEvent.lineno : undefined,
      message: errorEvent.message || undefined
    };
    const location = this.getWorkerFailureLocation(details);

    return {
      details,
      error: new Error(`${message}${location}`)
    };
  }

  private async doInit(): Promise<void> {
    try {
      this.isTerminating = false;
      if (!crossOriginIsolated) {
        console.warn(
          '[ParserBridge] crossOriginIsolated is false, worker may have limited functionality'
        );
      }

      this.worker = new Worker(new URL('../workers/parser.worker.ts', import.meta.url), {
        type: 'module'
      });

      this.worker.addEventListener('error', this.handleErrorEvent);
      this.worker.addEventListener('messageerror', this.handleMessageErrorEvent);

      this.api = wrap<ParserApi>(this.worker);

      const pong = await this.withTimeout(this.api.ping(), 5000);
      if (pong !== 'pong') {
        throw new Error('Worker ping failed');
      }

      this.setState('idle');
      console.log('[ParserBridge] Worker initialized successfully');
    } catch (error) {
      if (!this.isTerminating) {
        this.setState('error');
        this.options.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
      throw error;
    }
  }

  private getWorkerFailureLocation(details: Record<string, unknown>): string {
    const filename = typeof details.filename === 'string' ? details.filename : '';
    const lineno = typeof details.lineno === 'number' ? details.lineno : null;
    const colno = typeof details.colno === 'number' ? details.colno : null;

    if (!filename || lineno === null) {
      return '';
    }

    const columnSuffix = colno === null ? '' : `:${colno}`;
    return ` (${filename}:${lineno}${columnSuffix})`;
  }

  private getWorkerFailureMessage(kind: WorkerFailureKind, event: ErrorEvent): string {
    if (typeof event.message === 'string' && event.message.trim().length > 0) {
      return event.message;
    }

    return `Parser worker ${kind}`;
  }

  private readonly handleErrorEvent = (event: ErrorEvent) => {
    this.handleWorkerFailure('error', event);
  };

  private readonly handleMessageErrorEvent = (event: MessageEvent) => {
    this.handleWorkerFailure('messageerror', event);
  };

  private handleWorkerFailure(kind: WorkerFailureKind, event: ErrorEvent | Event): void {
    if (this.isTerminating || this.state === 'terminated') {
      return;
    }

    const { details, error } = this.buildWorkerError(kind, event);
    console.error(
      `[ParserBridge] Worker ${kind}:`,
      JSON.stringify(details, (_key, value) => (value === undefined ? null : value))
    );
    this.setState('error');
    this.options.onError?.(error);
  }

  private setState(newState: WorkerState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.options.onStateChange?.(newState);
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Operation timed out'));
      }, timeout);

      void promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
          return value;
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(String(error)));
        });
    });
  }
}

let defaultBridge: null | ParserBridge = null;

export function createParserBridge(options?: ParserBridgeOptions): ParserBridge {
  return new ParserBridge(options);
}

export function getParserBridge(options?: ParserBridgeOptions): ParserBridge {
  if (!defaultBridge) {
    defaultBridge = new ParserBridge(options);
  }
  return defaultBridge;
}

export { ParserBridge };
export type { ParserBridgeOptions, WorkerState };
