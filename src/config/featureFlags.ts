/**
 * Feature Flags & Kill-Switch System
 * Provides runtime control over heavy features (Pyodide, OCR, heavy visualizations)
 * Supports profile-based defaults, localStorage overrides, and remote config
 */

export interface FeatureConfig {
  defaultState: FeatureState;
  description: string;
  disableOnSaveData?: boolean;
  disableOnSlowConnection?: boolean;
  killSwitchPriority?: number;
  minHardwareConcurrency?: number;
  name: FeatureName;
  requiresCrossOriginIsolated?: boolean;
  requiresIndexedDb?: boolean;
}

export interface FeatureFlagsState {
  computed: Record<FeatureName, boolean>;
  flags: Record<FeatureName, FeatureState>;
  lastUpdated: number;
  overrides: Record<FeatureName, FeatureState>;
  profile: 'full' | 'lite' | 'ts-only';
}

export type FeatureName =
  | 'beeswarm'
  | 'heavyViz'
  | 'ocr'
  | 'pitch'
  | 'prefetchVendor'
  | 'pyodide'
  | 'radar'
  | 'structureHashCache'
  | 'webVitals'
  | 'workerParser';

export type FeatureState = 'auto' | 'disabled' | 'enabled';

const STORAGE_KEY = 'fm-feature-flags';

const FEATURE_DEFINITIONS: FeatureConfig[] = [
  {
    defaultState: 'auto',
    description: 'Python runtime for advanced parsing',
    killSwitchPriority: 1,
    name: 'pyodide',
    requiresCrossOriginIsolated: true
  },
  {
    defaultState: 'auto',
    description: 'Tesseract OCR for image processing',
    disableOnSaveData: true,
    killSwitchPriority: 2,
    name: 'ocr',
    requiresCrossOriginIsolated: true
  },
  {
    defaultState: 'auto',
    description: 'Heavy visualizations (beeswarm, radar, pitch)',
    disableOnSaveData: true,
    disableOnSlowConnection: true,
    killSwitchPriority: 3,
    minHardwareConcurrency: 4,
    name: 'heavyViz'
  },
  {
    defaultState: 'auto',
    description: 'Beeswarm chart visualization',
    disableOnSaveData: true,
    killSwitchPriority: 4,
    name: 'beeswarm'
  },
  {
    defaultState: 'auto',
    description: 'Radar chart visualization',
    disableOnSaveData: true,
    killSwitchPriority: 5,
    name: 'radar'
  },
  {
    defaultState: 'auto',
    description: 'Football pitch visualization',
    disableOnSaveData: true,
    killSwitchPriority: 6,
    name: 'pitch'
  },
  {
    defaultState: 'auto',
    description: 'Parser running in Web Worker',
    killSwitchPriority: 7,
    name: 'workerParser',
    requiresCrossOriginIsolated: true
  },
  {
    defaultState: 'enabled',
    description: 'Structure hash caching with TTL/LRU',
    killSwitchPriority: 10,
    name: 'structureHashCache'
  },
  {
    defaultState: 'disabled',
    description: 'Web Vitals sampling (local telemetry)',
    killSwitchPriority: 11,
    name: 'webVitals'
  },
  {
    defaultState: 'auto',
    description: 'Prefetch vendor assets via Service Worker',
    disableOnSaveData: true,
    disableOnSlowConnection: true,
    killSwitchPriority: 8,
    name: 'prefetchVendor'
  }
];

class FeatureFlags {
  private definitions: Map<FeatureName, FeatureConfig>;
  private listeners = new Set<(state: FeatureFlagsState) => void>();
  private state: FeatureFlagsState;

  constructor() {
    this.definitions = new Map(FEATURE_DEFINITIONS.map((d) => [d.name, d]));
    this.state = this.initState();
  }

  clearAllOverrides(): void {
    this.state.overrides = {} as any;
    this.state.computed = this.computeEffectiveFlags(
      this.state.flags,
      this.state.overrides,
      this.state.profile
    );
    this.state.lastUpdated = Date.now();

    this.saveToStorage();
    this.notify();

    console.log('[FeatureFlags] All overrides cleared');
  }

  clearOverride(name: FeatureName): void {
    this.setOverride(name, null);
  }

  getDefinition(name: FeatureName): FeatureConfig | undefined {
    return this.definitions.get(name);
  }

  getDefinitions(): FeatureConfig[] {
    return [...FEATURE_DEFINITIONS];
  }

  getProfile(): 'full' | 'lite' | 'ts-only' {
    return this.state.profile;
  }

  getSnapshot(): FeatureFlagsState {
    return { ...this.state };
  }

  getState(name: FeatureName): FeatureState {
    return this.state.overrides[name] || this.state.flags[name];
  }

  isEnabled(name: FeatureName): boolean {
    return this.state.computed[name] ?? false;
  }

  killSwitch(names: FeatureName[]): void {
    for (const name of names) {
      this.state.overrides[name] = 'disabled';
    }

    this.state.computed = this.computeEffectiveFlags(
      this.state.flags,
      this.state.overrides,
      this.state.profile
    );
    this.state.lastUpdated = Date.now();

    this.saveToStorage();
    this.notify();

    console.warn(`[FeatureFlags] Kill-switch activated for: ${names.join(', ')}`);
  }

  killSwitchHeavy(): void {
    this.killSwitch(['pyodide', 'ocr', 'heavyViz', 'beeswarm', 'radar', 'pitch']);
  }

  refresh(): void {
    const newProfile = this.detectProfile();
    if (newProfile !== this.state.profile) {
      this.state.profile = newProfile;
      this.state.computed = this.computeEffectiveFlags(
        this.state.flags,
        this.state.overrides,
        newProfile
      );
      this.state.lastUpdated = Date.now();
      this.notify();
    }
  }

  setOverride(name: FeatureName, state: FeatureState | null): void {
    if (state === null) {
      delete this.state.overrides[name];
    } else {
      this.state.overrides[name] = state;
    }

    this.state.computed = this.computeEffectiveFlags(
      this.state.flags,
      this.state.overrides,
      this.state.profile
    );
    this.state.lastUpdated = Date.now();

    this.saveToStorage();
    this.notify();

    console.log(`[FeatureFlags] ${name} set to ${state ?? 'auto (cleared)'}`);
  }

  subscribe(listener: (state: FeatureFlagsState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  toDebugString(): string {
    const lines = [`Profile: ${this.state.profile}`, '', 'Features:'];

    for (const def of FEATURE_DEFINITIONS) {
      const enabled = this.state.computed[def.name];
      const override = this.state.overrides[def.name];
      const status = enabled ? '✓' : '✗';
      const overrideInfo = override ? ` [override: ${override}]` : '';
      lines.push(`  ${status} ${def.name}: ${enabled}${overrideInfo}`);
    }

    return lines.join('\n');
  }

  private computeEffectiveFlags(
    flags: Record<FeatureName, FeatureState>,
    overrides: Record<FeatureName, FeatureState>,
    profile: 'full' | 'lite' | 'ts-only'
  ): Record<FeatureName, boolean> {
    const result: Record<FeatureName, boolean> = {} as any;
    const crossOrigin = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;
    const hasIdb = typeof indexedDB !== 'undefined';
    const connection = (navigator as any).connection;
    const saveData = connection?.saveData === true;
    const slowConnection = connection?.effectiveType
      ? ['2g', 'slow-2g'].includes(connection.effectiveType)
      : false;
    const hwConcurrency = navigator.hardwareConcurrency || 4;

    for (const def of FEATURE_DEFINITIONS) {
      const override = overrides[def.name];
      const base = flags[def.name];
      const state = override || base;

      if (state === 'disabled') {
        result[def.name] = false;
        continue;
      }

      if (state === 'enabled') {
        // Check hard requirements even for explicit enable
        if (def.requiresCrossOriginIsolated && !crossOrigin) {
          result[def.name] = false;
          continue;
        }
        if (def.requiresIndexedDb && !hasIdb) {
          result[def.name] = false;
          continue;
        }
        result[def.name] = true;
        continue;
      }

      // Auto mode - apply all conditions
      let enabled = true;

      if (def.requiresCrossOriginIsolated && !crossOrigin) {
        enabled = false;
      }
      if (def.requiresIndexedDb && !hasIdb) {
        enabled = false;
      }
      if (def.disableOnSaveData && saveData) {
        enabled = false;
      }
      if (def.disableOnSlowConnection && slowConnection) {
        enabled = false;
      }
      if (def.minHardwareConcurrency && hwConcurrency < def.minHardwareConcurrency) {
        enabled = false;
      }

      // Profile-based restrictions
      if (profile === 'ts-only' && def.requiresCrossOriginIsolated) {
        enabled = false;
      }
      if (profile === 'lite' && (def.disableOnSaveData || def.disableOnSlowConnection)) {
        enabled = false;
      }

      result[def.name] = enabled;
    }

    return result;
  }

  private detectProfile(): 'full' | 'lite' | 'ts-only' {
    const crossOrigin = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;
    const hasIdb = typeof indexedDB !== 'undefined';
    const connection = (navigator as any).connection;
    const saveData = connection?.saveData === true;
    const slowConnection = connection?.effectiveType
      ? ['2g', 'slow-2g'].includes(connection.effectiveType)
      : false;
    const lowHw =
      typeof navigator.hardwareConcurrency === 'number' &&
      navigator.hardwareConcurrency > 0 &&
      navigator.hardwareConcurrency <= 2;

    if (!crossOrigin || !hasIdb) {
      return 'ts-only';
    }
    if (saveData || slowConnection || lowHw) {
      return 'lite';
    }
    return 'full';
  }

  private initState(): FeatureFlagsState {
    const stored = this.loadFromStorage();
    const profile = this.detectProfile();
    const flags: Record<FeatureName, FeatureState> = {} as any;
    const overrides: Record<FeatureName, FeatureState> = stored?.overrides || ({} as any);

    for (const def of FEATURE_DEFINITIONS) {
      flags[def.name] = def.defaultState;
    }

    const computed = this.computeEffectiveFlags(flags, overrides, profile);

    return {
      computed,
      flags,
      lastUpdated: Date.now(),
      overrides,
      profile
    };
  }

  private loadFromStorage(): null | Partial<FeatureFlagsState> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (error) {
        console.error('[FeatureFlags] Listener error:', error);
      }
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          lastUpdated: this.state.lastUpdated,
          overrides: this.state.overrides
        })
      );
    } catch {
      console.warn('[FeatureFlags] Failed to save to localStorage');
    }
  }
}

// Singleton instance
let instance: FeatureFlags | null = null;

export function getFeatureFlags(): FeatureFlags {
  if (!instance) {
    instance = new FeatureFlags();
  }
  return instance;
}

export function isFeatureEnabled(name: FeatureName): boolean {
  return getFeatureFlags().isEnabled(name);
}

export function killSwitchFeatures(names: FeatureName[]): void {
  getFeatureFlags().killSwitch(names);
}

export function killSwitchHeavyFeatures(): void {
  getFeatureFlags().killSwitchHeavy();
}

export function setFeatureOverride(name: FeatureName, state: FeatureState | null): void {
  getFeatureFlags().setOverride(name, state);
}

// Export to window for debugging
if (typeof window !== 'undefined') {
  (window as any).featureFlags = {
    debug: () => console.log(getFeatureFlags().toDebugString()),
    get: getFeatureFlags,
    isEnabled: isFeatureEnabled,
    killSwitch: killSwitchFeatures,
    killSwitchHeavy: killSwitchHeavyFeatures,
    setOverride: setFeatureOverride
  };
}

export { FeatureFlags };
