import {
  BarChart3,
  FolderKanban,
  Globe,
  RefreshCcw,
  Settings,
  Sparkles,
  Stethoscope,
  Volleyball
} from 'lucide-react';

import { ENGINE_OPTIONS, type EngineId } from '@/config/engines';
import { ALL_ROLES } from '@/config/scoreConfig';
import { runHardReset, useDiagnosticsStore } from '@/features/diagnostics/runtimeDiagnostics';
import { useUiText } from '@/hooks/useUiText';
import { cn } from '@/lib/utils';
import { useTableStore } from '@/store/useTableStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';

import { Button } from './ui/button';

const Header = () => {
  const t = useUiText();
  const { currentEngine, currentPosition, setEngine, setPosition } = useTableStore();
  const { graphicsEnabled, openLdc, setGraphicsEnabled, toggleDiagnostics, toggleFileManager } =
    useWorkspaceStore();
  const tabRole = useDiagnosticsStore((state) => state.tabRole);

  return (
    <header className="border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:px-6">
      <div className="flex flex-wrap items-center gap-3 xl:flex-nowrap xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-surface text-accent shadow-sm">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-muted">
              {t('offline_scouting')}
            </div>
            <div className="truncate text-lg font-semibold tracking-tight text-text-primary">
              {t('app_name')}
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-2 xl:justify-center">
          <Button
            id="manage-files-btn"
            type="button"
            variant="outline"
            size="default"
            className="min-w-[11rem] justify-start gap-2 rounded-2xl px-4"
            onClick={toggleFileManager}
          >
            <FolderKanban className="h-4 w-4" />
            <span>{t('manage_files')}</span>
          </Button>

          <label className="flex min-w-[10rem] flex-col gap-1 rounded-2xl border border-border bg-surface/70 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              {t('scoring_engine')}
            </span>
            <select
              id="engine-select"
              value={currentEngine}
              onChange={(event) => setEngine(event.target.value as EngineId)}
              className="bg-transparent text-sm font-semibold text-text-primary outline-none"
            >
              {ENGINE_OPTIONS.map((engine) => (
                <option key={engine.id} value={engine.id}>
                  {t(engine.id, 'engines')}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-[11rem] flex-col gap-1 rounded-2xl border border-border bg-surface/70 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              {t('select_role_label')}
            </span>
            <select
              id="position-select"
              value={currentPosition}
              onChange={(event) => setPosition(event.target.value)}
              className="bg-transparent text-sm font-semibold text-text-primary outline-none"
            >
              <option value="">{t('choose_role')}</option>
              {ALL_ROLES.map((role) => (
                <option key={role} value={role}>
                  {t(role, 'positions')}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={() => setGraphicsEnabled(!graphicsEnabled)}
            className={cn(
              'gap-2 rounded-2xl px-4',
              graphicsEnabled &&
                'border-positive/20 bg-positive/10 text-positive hover:bg-positive/15 hover:text-positive'
            )}
            aria-pressed={graphicsEnabled}
          >
            <Sparkles className="h-4 w-4" />
            <span>{graphicsEnabled ? t('graphics_enabled') : t('graphics_disabled')}</span>
          </Button>

          <Button
            id="hard-reset-button"
            type="button"
            variant="outline"
            size="default"
            className="gap-2 rounded-2xl px-4 text-warning hover:bg-warning/5 hover:text-warning"
            aria-label={t('hard_reset')}
            disabled={tabRole !== 'primary'}
            onClick={() => {
              void runHardReset();
            }}
          >
            <RefreshCcw className="h-4 w-4" />
            <span>{t('hard_reset')}</span>
          </Button>

          <Button
            id="possession-btn"
            type="button"
            variant="outline"
            size="icon"
            className="rounded-2xl"
            aria-label="Konfiguracja Posiadania"
            title="Konfiguracja Posiadania"
          >
            <Volleyball className="h-4 w-4" />
          </Button>

          <Button
            id="ldc-btn"
            type="button"
            variant="outline"
            size="icon"
            className="rounded-2xl"
            aria-label={t('ldc_title')}
            title={t('ldc_title')}
            onClick={openLdc}
          >
            <BarChart3 className="h-4 w-4" />
          </Button>

          <Button
            id="language-btn-header"
            type="button"
            variant="outline"
            size="icon"
            className="rounded-2xl"
            aria-label={t('language')}
            title={t('language')}
          >
            <Globe className="h-4 w-4" />
          </Button>

          <Button
            id="toggle-diagnostics-panel"
            type="button"
            variant="outline"
            size="icon"
            className="rounded-2xl"
            aria-label={t('diagnostics')}
            title={t('diagnostics')}
            onClick={toggleDiagnostics}
          >
            <Stethoscope className="h-4 w-4" />
          </Button>

          <Button
            id="settings-btn"
            type="button"
            variant="outline"
            size="icon"
            className="rounded-2xl"
            aria-label={t('settings')}
            title={t('settings')}
            onClick={() => document.querySelector('#settings-modal')?.classList.remove('hidden')}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
