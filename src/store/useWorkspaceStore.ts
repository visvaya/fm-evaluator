import { create } from 'zustand';

export type WorkspaceRailSection =
  | 'diagnostics'
  | 'files'
  | 'graphics'
  | 'language'
  | 'ldc'
  | 'none'
  | 'settings';

interface WorkspaceState {
  activeRailSection: WorkspaceRailSection;
  closeDiagnostics: () => void;
  closeFileManager: () => void;
  closeLdc: () => void;
  graphicsEnabled: boolean;
  isDiagnosticsOpen: boolean;
  isFileManagerOpen: boolean;
  isLdcOpen: boolean;
  isSettingsOpen: boolean;
  lastFocusedElement: HTMLElement | null;
  openDiagnostics: () => void;
  openFileManager: () => void;
  openLdc: () => void;
  rememberFocus: (element: HTMLElement | null) => void;
  restoreFocus: () => void;
  setActiveRailSection: (section: WorkspaceRailSection) => void;
  setGraphicsEnabled: (graphicsEnabled: boolean) => void;
  syncSurfaceState: (
    partial: Partial<
      Pick<
        WorkspaceState,
        | 'activeRailSection'
        | 'isDiagnosticsOpen'
        | 'isFileManagerOpen'
        | 'isLdcOpen'
        | 'isSettingsOpen'
      >
    >
  ) => void;
  toggleDiagnostics: () => void;
  toggleFileManager: () => void;
  toggleLdc: () => void;
}

function loadDiagnosticsPanelPreference() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return window.localStorage.getItem('fm.diagnosticsPanel.visible') === '1';
  } catch {
    return false;
  }
}

function persistDiagnosticsPanelPreference(isOpen: boolean) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem('fm.diagnosticsPanel.visible', isOpen ? '1' : '0');
  } catch {
    // Ignore storage failures in degraded environments.
  }
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  activeRailSection: 'none',
  graphicsEnabled: true,
  isDiagnosticsOpen: loadDiagnosticsPanelPreference(),
  isFileManagerOpen: false,
  isLdcOpen: false,
  isSettingsOpen: false,
  lastFocusedElement: null,
  openDiagnostics: () => {
    persistDiagnosticsPanelPreference(true);
    set({
      activeRailSection: 'diagnostics',
      isDiagnosticsOpen: true
    });
  },
  closeDiagnostics: () => {
    persistDiagnosticsPanelPreference(false);
    set((state) => ({
      activeRailSection:
        state.activeRailSection === 'diagnostics' ? 'none' : state.activeRailSection,
      isDiagnosticsOpen: false
    }));
  },
  toggleDiagnostics: () =>
    set((state) => {
      const isDiagnosticsOpen = !state.isDiagnosticsOpen;
      persistDiagnosticsPanelPreference(isDiagnosticsOpen);
      return {
        activeRailSection: isDiagnosticsOpen ? 'diagnostics' : 'none',
        isDiagnosticsOpen
      };
    }),
  openFileManager: () =>
    set({
      activeRailSection: 'files',
      isFileManagerOpen: true
    }),
  closeFileManager: () =>
    set((state) => ({
      activeRailSection: state.activeRailSection === 'files' ? 'none' : state.activeRailSection,
      isFileManagerOpen: false
    })),
  openLdc: () =>
    set({
      activeRailSection: 'ldc',
      isLdcOpen: true
    }),
  closeLdc: () =>
    set((state) => ({
      activeRailSection: state.activeRailSection === 'ldc' ? 'none' : state.activeRailSection,
      isLdcOpen: false
    })),
  toggleLdc: () =>
    set((state) => ({
      activeRailSection: state.isLdcOpen ? 'none' : 'ldc',
      isLdcOpen: !state.isLdcOpen
    })),
  toggleFileManager: () =>
    set((state) => ({
      activeRailSection: state.isFileManagerOpen ? 'none' : 'files',
      isFileManagerOpen: !state.isFileManagerOpen
    })),
  rememberFocus: (element) => set({ lastFocusedElement: element }),
  restoreFocus: () => {
    const element = get().lastFocusedElement;
    if (!element) {
      return;
    }

    try {
      element.focus();
    } catch {
      // Ignore focus failures from detached or disabled nodes.
    }
  },
  setActiveRailSection: (activeRailSection) => set({ activeRailSection }),
  setGraphicsEnabled: (graphicsEnabled) => set({ graphicsEnabled }),
  syncSurfaceState: (partial) =>
    set((state) => ({
      activeRailSection: partial.activeRailSection ?? state.activeRailSection,
      isDiagnosticsOpen: partial.isDiagnosticsOpen ?? state.isDiagnosticsOpen,
      isFileManagerOpen: partial.isFileManagerOpen ?? state.isFileManagerOpen,
      isLdcOpen: partial.isLdcOpen ?? state.isLdcOpen,
      isSettingsOpen: partial.isSettingsOpen ?? state.isSettingsOpen
    }))
}));
