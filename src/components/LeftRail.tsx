import { Sparkles } from 'lucide-react';

import { getRailItemsModel } from '@/features/workspace/railModel';
import { useUiText } from '@/hooks/useUiText';
import { cn } from '@/lib/utils';
import { useWorkspaceStore, type WorkspaceRailSection } from '@/store/useWorkspaceStore';

const clickButton = (selector: string) => {
  document.querySelector<HTMLButtonElement>(selector)?.click();
};

export function LeftRail() {
  const t = useUiText();
  const {
    activeRailSection,
    graphicsEnabled,
    isDiagnosticsOpen,
    isFileManagerOpen,
    isLdcOpen,
    isSettingsOpen,
    openLdc,
    setActiveRailSection,
    setGraphicsEnabled,
    toggleDiagnostics,
    toggleFileManager
  } = useWorkspaceStore();
  const items = getRailItemsModel(t);

  const runRailAction = (section: WorkspaceRailSection) => {
    switch (section) {
      case 'diagnostics': {
        toggleDiagnostics();
        break;
      }
      case 'files': {
        toggleFileManager();
        break;
      }
      case 'language': {
        clickButton('#language-btn-header');
        break;
      }
      case 'ldc': {
        openLdc();
        break;
      }
      case 'settings': {
        clickButton('#settings-btn');
        break;
      }
      case 'graphics':
      case 'none': {
        // Not rail items: the graphics toggle below has its own handler.
        break;
      }
    }
  };

  return (
    <aside className="hidden w-[4.5rem] shrink-0 border-r border-border bg-background/95 px-3 py-4 backdrop-blur lg:flex lg:flex-col lg:items-center lg:gap-3">
      {items.map((item) => {
        const isOpen =
          (item.id === 'files' && isFileManagerOpen) ||
          (item.id === 'diagnostics' && isDiagnosticsOpen) ||
          (item.id === 'ldc' && isLdcOpen) ||
          (item.id === 'settings' && isSettingsOpen);
        const isActive = activeRailSection === item.id || isOpen;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setActiveRailSection(item.id);
              runRailAction(item.id);
            }}
            className={cn(
              'inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-transparent text-text-muted transition',
              'hover:border-border hover:bg-surface hover:text-text-primary',
              isActive && 'border-accent/20 bg-accent-subtle text-accent shadow-sm'
            )}
            aria-label={item.label}
            title={item.label}
          >
            <item.icon className="h-4 w-4" />
          </button>
        );
      })}

      <div className="my-2 h-px w-8 bg-border" />

      <button
        type="button"
        onClick={() => {
          setActiveRailSection('graphics');
          setGraphicsEnabled(!graphicsEnabled);
        }}
        className={cn(
          'inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-transparent text-text-muted transition',
          'hover:border-border hover:bg-surface hover:text-text-primary',
          graphicsEnabled && 'border-positive/20 bg-positive/10 text-positive shadow-sm'
        )}
        aria-label={t('graphics')}
        title={t('graphics')}
      >
        <Sparkles className="h-4 w-4" />
      </button>
    </aside>
  );
}
