// Phase 5D: LDC persistence and UI sync
// Extracted from main.js L11043-11149

import { useLdcStore } from '@/features/ldc/useLdcStore';

export async function loadLDCSettings(): Promise<void> {
  await useLdcStore.getState().hydrateFromPersistence();
}

export async function saveLDCSettings(): Promise<void> {
  await useLdcStore.getState().persistSettings();
}

export function updateLDCUI(): void {
  void useLdcStore.getState().syncFromLegacy({ pushHistory: false });
}
