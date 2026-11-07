import { BarChart3, Globe, PanelLeft, Settings2, Stethoscope, type LucideIcon } from 'lucide-react';

import type { WorkspaceRailSection } from '@/store/useWorkspaceStore';

export interface RailItemModel {
  icon: LucideIcon;
  id: WorkspaceRailSection;
  label: string;
}

export function getRailItemsModel(t: (key: string) => string): RailItemModel[] {
  return [
    { icon: PanelLeft, id: 'files', label: t('manage_files') },
    { icon: BarChart3, id: 'ldc', label: t('ldc_title') },
    { icon: Stethoscope, id: 'diagnostics', label: t('diagnostics') },
    { icon: Settings2, id: 'settings', label: t('settings') },
    { icon: Globe, id: 'language', label: t('language') }
  ];
}
