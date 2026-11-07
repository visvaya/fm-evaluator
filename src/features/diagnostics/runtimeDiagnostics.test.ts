import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildDiagnosticsSnapshot,
  resetDiagnosticsStore,
  useDiagnosticsStore
} from './runtimeDiagnostics';

describe('runtimeDiagnostics', () => {
  beforeEach(() => {
    resetDiagnosticsStore();
  });

  it('builds diagnostics snapshots from the store state', () => {
    useDiagnosticsStore.setState({
      dbHealth: {
        backups: 2,
        lastAudit: 1234567890,
        tables: {
          audit: 1,
          files: 2,
          ldcMappings: 3,
          ldcSettings: 4,
          settings: 5,
          uiState: 6
        },
        version: 5
      },
      profileReport: {
        crossOriginIsolated: true,
        effectiveType: '4g',
        hasIndexedDb: true,
        lowHardware: false,
        profile: 'full',
        reasons: [],
        saveData: false
      },
      serviceWorkerHealth: {
        backupAvailable: true,
        cachedEntries: 8,
        cacheName: 'fm-cache',
        profile: null,
        swVersion: '1.2.3'
      },
      tabRole: 'primary',
      webVitalsLog: ['[12:00:00] CLS: 0.04'],
      webVitalsSamples: {
        cls: {
          at: 123,
          name: 'cls',
          rating: 'good',
          unit: '',
          value: 0.04
        }
      }
    });

    const snapshot = buildDiagnosticsSnapshot();

    expect(snapshot.profile?.profile).toBe('full');
    expect(snapshot.serviceWorker?.version).toBe('1.2.3');
    expect(snapshot.dexie?.tables.files).toBe(2);
    expect(snapshot.webVitals.cls?.value).toBe(0.04);
    expect(snapshot.webVitalsLog).toEqual(['[12:00:00] CLS: 0.04']);
  });
});
