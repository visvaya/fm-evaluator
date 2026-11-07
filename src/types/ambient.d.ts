/// <reference types="vite/client" />

declare module 'vite' {
  export interface ConfigEnv {
    command: 'build' | 'serve';
    mode: string;
  }

  export interface UserConfig {
    [key: string]: any;
    build?: Record<string, any>;
    plugins?: any[];
    preview?: Record<string, any>;
    publicDir?: string;
    root?: string;
    server?: Record<string, any>;
    test?: Record<string, any>;
  }

  export function defineConfig(config: ((env: ConfigEnv) => UserConfig) | UserConfig): UserConfig;
  export function mergeConfig(a: UserConfig, b: UserConfig): UserConfig;
}

declare module 'path' {
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
  export const sep: string;
  export const delimiter: string;
}

declare module 'dexie' {
  export interface Table<T, Key> {
    add(item: T): Promise<Key>;
    bulkPut(items: T[]): Promise<void>;
    clear(): Promise<void>;
    count(): Promise<number>;
    get(key: Key): Promise<T | undefined>;
    orderBy(index: string): {
      last(): Promise<T | undefined>;
      limit(count: number): { toArray(): Promise<T[]> };
      reverse(): { limit(count: number): { toArray(): Promise<T[]> } };
    };
    put(item: T): Promise<Key>;
    toArray(): Promise<T[]>;
  }

  export default class Dexie {
    [key: string]: any;
    constructor(name: string);
    delete(): Promise<void>;
    table<T, Key>(name: string): Table<T, Key>;
    transaction(mode: 'r' | 'rw', ...tables: Table<any, any>[]): Promise<void>;
    version(versionNumber: number): {
      stores(schema: Record<string, string>): Dexie;
    };
  }
}

declare interface MinimalBuffer {
  toString(encoding?: string): string;
}

declare const Buffer: {
  from(data: ArrayBuffer | ArrayBufferView | string, encoding?: string): MinimalBuffer;
};
