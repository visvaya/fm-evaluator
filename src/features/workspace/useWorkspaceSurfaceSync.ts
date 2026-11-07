import { useEffect } from 'react';

import { useWorkspaceStore } from '@/store/useWorkspaceStore';

const noop = () => {
  // No legacy surface is mounted for this slot.
};

function syncModalState(id: string, onSync: (isOpen: boolean) => void) {
  const element = document.querySelector<HTMLElement>(`#${id}`);
  if (!element) {
    return noop;
  }

  const publish = () => onSync(!element.classList.contains('hidden'));
  publish();

  const observer = new MutationObserver(publish);
  observer.observe(element, {
    attributeFilter: ['class'],
    attributes: true
  });

  return () => observer.disconnect();
}

export function useWorkspaceSurfaceSync() {
  const syncSurfaceState = useWorkspaceStore((state) => state.syncSurfaceState);

  useEffect(() => {
    const cleanups = [
      syncModalState('settings-modal', (isSettingsOpen) =>
        syncSurfaceState({
          activeRailSection: isSettingsOpen ? 'settings' : 'none',
          isSettingsOpen
        })
      )
    ];

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [syncSurfaceState]);
}
