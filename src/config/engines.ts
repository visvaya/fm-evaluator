export const ENGINE_OPTIONS = [
  { id: 'Default', translationKey: 'Default' },
  { id: 'AsianFusion', translationKey: 'AsianFusion' },
  { id: 'FMTweak', translationKey: 'FMTweak' }
] as const;

export type EngineId = (typeof ENGINE_OPTIONS)[number]['id'];

export type MergeMode = 'merge' | 'replace';
