import { useEffect } from 'react';

import { useTableStore } from '@/store/useTableStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { closeFilters, focusNameColumnFilter, isAnyColumnFilterOpen } from '@/ui/filters';

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    target.isContentEditable ||
    target.getAttribute('role') === 'textbox'
  );
}

export function useAppShortcuts() {
  const selectedPlayerId = useTableStore((state) => state.selectedPlayerId);
  const setSelectedPlayerId = useTableStore((state) => state.setSelectedPlayerId);
  const restoreFocus = useWorkspaceStore((state) => state.restoreFocus);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMetaSearchShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isMetaSearchShortcut) {
        if (isTextEntryTarget(event.target)) {
          return;
        }

        event.preventDefault();
        focusNameColumnFilter();
        return;
      }

      if (event.key !== 'Escape') {
        return;
      }

      if (isAnyColumnFilterOpen()) {
        closeFilters({ restoreFocus: true });
        return;
      }

      if (selectedPlayerId) {
        setSelectedPlayerId(null);
        window.setTimeout(() => restoreFocus(), 0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [restoreFocus, selectedPlayerId, setSelectedPlayerId]);
}
