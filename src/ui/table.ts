// Table rendering logic extracted from main.js
// Phase 3A: Complete implementation with all column types
import {
  legacyCopyActionAttrs,
  legacyOpenDetailsActionAttrs
} from '@/features/legacyRuntime/legacyActionAttributes';
import { translatePosition, translateValue } from '../i18n/translate';
import { formatPlayerValue } from '../utils/helpers';

import { t } from '../lib/i18nBridge';
import { escapeHtmlAttribute as esc } from '../utils/escapeHtmlAttribute';
import type { Column, Player, VirtualState } from './types';

// Global references that need to be injected
declare global {
  interface Window {
    i18n: any;
    processor: any;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export interface BuildRowOptions {
  columns: Column[];
  isBestModeActive?: boolean;
  pinnedColumns: string[];
  player: Player;
  rowIndex: number;
}

/**
 * Build HTML for a single table row
 * Uses RORO pattern per project-rules.md
 */
export function buildRowHtml(options: BuildRowOptions): string {
  const {
    columns: activeCols,
    isBestModeActive = false,
    pinnedColumns,
    player: p,
    rowIndex
  } = options;
  const rowBg = rowIndex % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]';

  // Calculate leftOffset for sticky columns based on computed widths using reduce to avoid mutations
  const { map: stickyOffsets } = activeCols.reduce(
    (acc, c) => {
      if (pinnedColumns.includes(c.id)) {
        acc.map.set(c.id, acc.offset);
        const defaultWidth = c.w ? parseInt(c.w) : calculateColumnWidth(c.name, c.id);
        const savedWidth = c.savedWidth || defaultWidth;
        return { map: acc.map, offset: acc.offset + savedWidth };
      }
      return acc;
    },
    { map: new Map<string, number>(), offset: 0 }
  );

  return `<tr class="${rowBg} hover:bg-blue-50 transition group text-ink text-xs font-mono">${activeCols
    .map((c) => {
      const isPinned = pinnedColumns.includes(c.id);
      const stickyClass = isPinned ? 'sticky-col' : '';
      const stickyOffset = stickyOffsets.get(c.id) ?? 0;
      const stickyStyle = isPinned
        ? `position:sticky; left:${stickyOffset}px; background-color:${rowIndex % 2 === 0 ? 'white' : '#FAFAFA'};`
        : '';

      const content = renderCellContent(c, p, isBestModeActive);

      // Get column width
      const defaultWidth = c.w ? parseInt(c.w) : calculateColumnWidth(c.name, c.id);
      const columnWidth = c.savedWidth || defaultWidth;

      return `<td class="p-3 border-b border-gray-200 ${stickyClass}" data-col-id="${c.id}" style="min-width: ${columnWidth}px; width: ${columnWidth}px; overflow:hidden; text-align: left; vertical-align: middle; ${stickyStyle}">
                    <div style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; max-height: 3em; line-height: 1.5em; word-break: break-word;">${content}</div>
                </td>`;
    })
    .join('')}</tr>`;
}

/**
 * Get suggestion badge HTML
 * @param val Suggestion type ('Kup', 'Scoutuj', 'Śledź', 'Pomiń')
 */
export function getBadge(val?: null | string): string {
  if (!val) return '-';
  const style: Record<string, string> = {
    Kup: 'bg-green-600 text-white',
    Pomiń: 'bg-gray-200 text-gray-500',
    Scoutuj: 'bg-blue-600 text-white',
    Śledź: 'bg-yellow-400 text-black'
  };
  const explanations: Record<string, string> = {
    Kup: 'Zawodnik spełnia wymagania zarówno w zakresie statystyk, jak i atrybutów. Rekomendacja: zakup.',
    Pomiń:
      'Zawodnik nie spełnia wymagań statystycznych ani atrybutowych. Nie rekomendowany do zakupu.',
    Scoutuj:
      'Zawodnik spełnia wymagania statystyczne, ale dane atrybutowe są niepełne. Wymaga głębszego scoutingu.',
    Śledź:
      'Zawodnik spełnia wymagania atrybutowe, ale statystyki są poniżej wymagań. Warto śledzić jego dalsze występy.'
  };
  const styleClass = style[val] || 'bg-gray-200';
  const title = explanations[val] || val;
  return `<span class="${styleClass} px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border border-black/10 shadow-[1px_1px_0px_rgba(0,0,0,0.1)]" title="${title.replaceAll('"', '&quot;')}">${val}</span>`;
}

/**
 * Get data category badge HTML
 * @param c Data category type
 */
export function getDataBadge(c: null | string | undefined): string {
  if (!c) return '-';
  const styles: Record<string, string> = {
    'Brak/mało atrybutów': 'text-orange-600 font-bold',
    'Brak/niepełne statystyki': 'text-red-500 font-bold',
    'Brak danych': 'text-gray-400 italic',
    'Pełne dane': 'text-green-600 font-black',
    'Zakresy/niepełne atrybuty': 'text-yellow-600 font-bold'
  };
  const explanations: Record<string, string> = {
    'Brak/mało atrybutów':
      'Zawodnik ma niewiele lub brak danych atrybutowych. Dane mogą być niekompletne.',
    'Brak/niepełne statystyki':
      'Zawodnik ma niewiele lub brak danych statystycznych. Statystyki mogą być niekompletne.',
    'Brak danych': 'Zawodnik nie ma dostępnych danych atrybutowych ani statystycznych.',
    'Pełne dane':
      'Zawodnik ma kompletne dane atrybutowe i statystyczne. Wszystkie wymagane wartości są dostępne.',
    'Zakresy/niepełne atrybuty':
      'Zawodnik ma atrybuty w formie zakresów (np. 12-15) lub niektóre atrybuty są niepełne.'
  };
  const st = styles[c] || 'text-gray-500';
  const title = explanations[c] || c;
  return `<div class="text-[9px] uppercase tracking-tighter ${st}" title="${title.replaceAll('"', '&quot;')}">${c}</div>`;
}

/**
 * Get value rating badge (for xValue/xWage)
 * @param rating Rating type ('niedoceniony', 'przeceniony', 'fair')
 */
export function getValueRatingBadge(rating: null | string | undefined): string {
  if (!rating || rating === 'fair') return '';
  const style = rating === 'niedoceniony' ? 'bg-green-600 text-white' : 'bg-red-600 text-white';
  const text = rating === 'niedoceniony' ? '↓' : '↑';
  const title = rating === 'niedoceniony' ? 'Niedoceniony przez rynek' : 'Przeceniony przez rynek';
  return `<span class="${style} px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest border border-black/10 shadow-[1px_1px_0px_rgba(0,0,0,0.1)] ml-1" title="${title}">${text}</span>`;
}

/**
 * Render progress bar for score values (0-20 scale)
 * @param val Score value in 0-20 scale
 * @param isRange Whether the value is from a range (renders in italic)
 */
export function renderBar(val?: null | number, isRange = false): string {
  if (typeof val !== 'number') return `<span class="font-bold">${val ?? '-'}</span>`;
  // Convert 0-20 scale to percentage (0-100)
  const width = Math.min(100, (val / 20) * 100);
  const color = width < 50 ? '#ef4444' : width < 75 ? '#eab308' : '#22c55e';
  const italicClass = isRange ? 'italic' : '';
  return `<div class="flex items-center gap-2"><div class="w-10 h-2 bg-gray-200 border border-gray-300"><div class="h-full" style="width:${width}%; background:${color};"></div></div><span class="font-bold ${italicClass}">${val.toFixed(1)}</span></div>`;
}

/**
 * Render empty state when no data
 */
export function renderEmptyState(columns: Column[]): string {
  const colSpan = columns.length || 1;
  return `<tr><td colspan="${colSpan}" class="p-12 text-center text-gray-400 font-mono">${t('no_data_filters')}</td></tr>`;
}

/**
 * Render paged rows (non-virtual mode)
 */
export function renderPagedRows(
  sorted: Player[],
  activeCols: Column[],
  pinnedColumns: string[],
  currentPage: number,
  rowsPerPage: number,
  tableBody: HTMLElement,
  updatePageInfoFn: (current: number, max: number) => void
): void {
  if (sorted.length === 0) {
    tableBody.innerHTML = renderEmptyState(activeCols);
    updatePageInfoFn(0, 0);
    return;
  }

  const maxPage = Math.ceil(sorted.length / rowsPerPage);
  const actualPage = Math.max(1, Math.min(currentPage, maxPage));
  const start = (actualPage - 1) * rowsPerPage;
  const slice = sorted.slice(start, start + rowsPerPage);

  const positionSelect = document.querySelector('#position-select') as HTMLSelectElement | null;
  const isBestModeActive = positionSelect?.value === 'BEST';

  tableBody.innerHTML = slice
    .map((p, idx) =>
      buildRowHtml({
        columns: activeCols,
        isBestModeActive,
        pinnedColumns,
        player: p,
        rowIndex: start + idx
      })
    )
    .join('');

  updatePageInfoFn(actualPage, maxPage);
}

/**
 * Render ratio cell (for xValue/xWage columns)
 * @param ratio Ratio value (or null if not calculated)
 * @param rating Optional rating for badge
 * @param tooltip Tooltip text when ratio is null
 */
export function renderRatioCell(
  ratio: null | number,
  rating: null | string,
  tooltip: null | string = null
): string {
  if (ratio === null) {
    const tooltipText =
      tooltip || 'Ratio nie zostało obliczone - gracz nie spełnia wymagań dla tego typu porównania';
    return `<div class="flex items-center justify-center"><i class="fas fa-exclamation-triangle text-yellow-500 text-lg" title="${tooltipText}"></i></div>`;
  }
  const val = `${ratio.toFixed(2)}x`;
  let colorClass = 'text-ink';
  if (ratio >= 1.2) colorClass = 'text-green-600 font-black';
  else if (ratio <= 0.8) colorClass = 'text-red-600';

  const badge = rating ? getValueRatingBadge(rating) : '';
  return `<div class="flex items-center justify-between"><span class="font-mono ${colorClass}">${val}</span>${badge}</div>`;
}

// ============================================================================
// RORO INTERFACE
// ============================================================================

/**
 * Render virtual rows (virtual scrolling mode)
 */
export function renderVirtualRows(
  sortedRows: Player[],
  activeCols: Column[],
  pinnedColumns: string[],
  virtualState: VirtualState,
  virtualRowHeight: number,
  tableBody: HTMLElement
): void {
  const colSpan = activeCols?.length || 1;

  if (sortedRows.length === 0) {
    tableBody.innerHTML = renderEmptyState(activeCols);
    return;
  }

  const start = virtualState.start;
  const end = Math.min(virtualState.end, sortedRows.length);
  const beforeHeight = Math.max(0, start * virtualRowHeight);
  const afterHeight = Math.max(0, (sortedRows.length - end) * virtualRowHeight);

  const positionSelect = document.querySelector('#position-select') as HTMLSelectElement | null;
  const isBestModeActive = positionSelect?.value === 'BEST';

  const slice = sortedRows.slice(start, end);
  const rowsHtml = slice
    .map((p, idx) =>
      buildRowHtml({
        columns: activeCols,
        isBestModeActive,
        pinnedColumns,
        player: p,
        rowIndex: start + idx
      })
    )
    .join('');

  const spacerTop = `<tr class="virtual-spacer"><td colspan="${colSpan}" style="height:${beforeHeight}px;"></td></tr>`;
  const spacerBottom = `<tr class="virtual-spacer"><td colspan="${colSpan}" style="height:${afterHeight}px;"></td></tr>`;

  tableBody.innerHTML = spacerTop + rowsHtml + spacerBottom;
}

// ============================================================================
// MAIN ROW BUILDER
// ============================================================================

/**
 * Calculate column width based on name length
 */
function calculateColumnWidth(name: string, id: string): number {
  // Special cases
  if (id === 'name') return 250;
  if (id === 'club' || id === 'league') return 180;
  if (id === 'suggestion') return 120;

  // Default calculation based on character count
  const charWidth = 8;
  const padding = 24;
  return Math.max(80, Math.min(200, name.length * charWidth + padding));
}

/**
 * Helper to render best role column (bestRoleTotal, bestRoleStat, bestRoleAttr)
 */
function renderBestRoleColumn(best: null | undefined | { role: string; score: number }): string {
  if (!best) return '-';
  const scoreStr = best.score.toFixed(1);
  const roleStr = best.role;
  const fullText = `${scoreStr} (${roleStr})`;
  let displayText = fullText;
  if (fullText.length > 25) {
    const prefixLen = scoreStr.length + 3;
    const maxRoleLen = 25 - prefixLen - 3;
    if (maxRoleLen > 0 && roleStr.length > maxRoleLen) {
      displayText = `${scoreStr} (${roleStr.slice(0, Math.max(0, maxRoleLen))}...`;
    }
  }
  return `<span title="${fullText}">${displayText}</span>`;
}

// ============================================================================
// ROW RENDERING FUNCTIONS
// ============================================================================

/**
 * Render cell content based on column type
 */
function renderCellContent(c: Column, p: Player, isBestModeActive = false): string {
  const isBestMode = isBestModeActive && !!p.bestRole;

  switch (c.id) {
    case 'attrScore': {
      if (isBestMode) {
        const roleStr = p.bestRole?.attrRole || p.bestRole?.role || '';
        return renderScoreWithRole(p.attrScore, roleStr);
      }
      return renderBar(p.attrScore, p.shouldItalicizeAttrScore);
    }

    case 'bestRoleAttr': {
      return renderBestRoleColumn(p.bestRoleAttr);
    }

    case 'bestRoleStat': {
      return renderBestRoleColumn(p.bestRoleStat);
    }

    case 'bestRoleTotal': {
      return renderBestRoleColumn(p.bestRoleTotal);
    }

    case 'club': {
      const clubText = esc(p.club || '-');
      return `<div title="${clubText}" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; width: 100%; word-break: break-word;">${clubText}</div>`;
    }

    case 'dataCategory': {
      return getDataBadge(p.dataCategory);
    }

    case 'league': {
      const leagueText = esc(p.league || '-');
      return `<div title="${leagueText}" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; width: 100%; word-break: break-word;">${leagueText}</div>`;
    }

    case 'leftFootStars':
    case 'rightFootStars': {
      const starsValue = esc(String(p[c.id] ?? '-'));
      return `<span class="text-yellow-500 font-bold">${starsValue}</span>`;
    }

    case 'name': {
      const name = esc(p.name);
      const uid = esc(p.uid);
      return `<div class="flex justify-between items-start" style="min-height: 3em;" title="${name}\n${uid}">
                <div class="flex items-start gap-2 flex-1 min-w-0">
                    <i class="fas fa-eye text-gray-300 hover:text-blue-600 cursor-pointer mt-1 shrink-0" ${legacyOpenDetailsActionAttrs(p.uid)} title="Pokaż szczegóły"></i>
                    <div class="min-w-0 flex-1">
                        <div style="display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;"><b class="font-sans text-sm tracking-tight">${name}</b></div>
                        <div class="text-[10px] text-gray-400 font-mono">${uid}</div>
                    </div>
                </div>
                <i id="copy-${uid}" class="fas fa-copy text-gray-300 hover:text-blue-600 cursor-pointer ml-2 mt-1 shrink-0" ${legacyCopyActionAttrs(p.name, `copy-${p.uid}`)} title="Kopiuj"></i>
            </div>`;
    }

    case 'position': {
      // Calculate nominal position (Position minus Sec. Position)
      const pos2ArrayLower = new Set((p.pos2Array ?? []).map((pos: string) => pos.toLowerCase()));
      const nominalPositions = (p.positionArray ?? []).filter(
        (pos: string) => !pos2ArrayLower.has(pos.toLowerCase())
      );
      const nominalDisplayRaw =
        nominalPositions.length > 0 ? nominalPositions.join(', ') : (p.position ?? '-');
      const secPositions = (p.pos2Array ?? []).filter((pos: string) => pos?.trim());
      const secDisplayRaw = secPositions.length > 0 ? secPositions.join(', ') : '';

      // Translate positions for display (Phase 5A: direct import)
      const nominalDisplay = nominalDisplayRaw
        .split(', ')
        .map((pos: string) => translatePosition(pos.trim()) ?? pos.trim())
        .join(', ');
      const secDisplay = secDisplayRaw
        .split(', ')
        .map((pos: string) => translatePosition(pos.trim()) ?? pos.trim())
        .join(', ');

      const fullPositionText = esc(
        secDisplay ? `${nominalDisplay}\n${secDisplay}` : nominalDisplay
      );
      const secDisplayHtml = secDisplay
        ? `<div class="text-[9px] text-gray-500">${esc(secDisplay)}</div>`
        : '';
      return `<div title="${fullPositionText}" style="width: 100%; word-break: break-word;"><span class="font-bold">${esc(nominalDisplay)}</span>${secDisplayHtml}</div>`;
    }

    case 'scorePerValue': {
      return renderRatioCell(
        p.scorePerValue,
        p.valueRating,
        'xVal Ratio nie zostało obliczone - gracz nie spełnia wymagań (za mało minut lub zbyt wiele brakujących atrybutów)'
      );
    }

    case 'scorePerValueAtr': {
      return renderRatioCell(
        p.scorePerValueAtr,
        null,
        'xVal Ratio (Atr) nie zostało obliczone - gracz nie spełnia wymagań (zbyt wiele brakujących atrybutów)'
      );
    }

    case 'scorePerValueStat': {
      return renderRatioCell(
        p.scorePerValueStat,
        null,
        'xVal Ratio (Stat) nie zostało obliczone - gracz nie spełnia wymagań (za mało minut)'
      );
    }

    case 'scorePerWage': {
      return renderRatioCell(
        p.scorePerWage,
        p.wageRating,
        'xWage Ratio nie zostało obliczone - gracz nie spełnia wymagań (za mało minut lub zbyt wiele brakujących atrybutów)'
      );
    }

    case 'scorePerWageAtr': {
      return renderRatioCell(
        p.scorePerWageAtr,
        null,
        'xWage Ratio (Atr) nie zostało obliczone - gracz nie spełnia wymagań (zbyt wiele brakujących atrybutów)'
      );
    }

    case 'scorePerWageStat': {
      return renderRatioCell(
        p.scorePerWageStat,
        null,
        'xWage Ratio (Stat) nie zostało obliczone - gracz nie spełnia wymagań (za mało minut)'
      );
    }

    case 'statScore': {
      if (isBestMode) {
        const roleStr = p.bestRole?.statRole || p.bestRole?.role || '';
        return renderScoreWithRole(p.statScore, roleStr);
      }
      return renderBar(p.statScore, p.shouldItalicizeStatScore);
    }

    case 'suggestion': {
      return getBadge(p.suggestion);
    }
    case 'totalScore': {
      if (isBestMode) {
        const roleStr = p.bestRole?.role || p.bestRole?.totalRole || '';
        return renderScoreWithRole(p.totalScore, roleStr);
      }
      return renderBar(p.totalScore, p.hasAnyRange);
    }

    default: {
      // Default handling for other columns
      // Check if we have a special display value (like a range string)
      const initialContent = p[`${c.id}_display`] ?? p[c.id] ?? '-';

      // Format currency/value columns if they are numbers
      const formattedContent =
        c.id === 'value' ||
        c.id === 'wage' ||
        c.id === 'basic_transfer_value' ||
        c.id === 'basic_wage'
          ? formatPlayerValue(initialContent)
          : initialContent;

      // Translate value to user's language if it's a mappable column
      const translatedContent =
        formattedContent && formattedContent !== '-' && typeof formattedContent === 'string'
          ? translateValue(formattedContent, c.id) || formattedContent
          : formattedContent;

      const rawContent = String(translatedContent);
      const safeContent = esc(rawContent);

      // For regular text content, use same formatting as 'club' column
      if (rawContent && rawContent !== '-') {
        return `<div title="${safeContent}" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; width: 100%; word-break: break-word;">${safeContent}</div>`;
      }
      return safeContent;
    }
  }
}

/**
 * Helper to render score with best role (for totalScore, statScore, attrScore in BEST mode)
 */
function renderScoreWithRole(score: number, roleStr: string): string {
  const scoreStr = score.toFixed(1);
  if (Math.abs(score) < 0.001) {
    return '0.0 (-)';
  }
  const fullText = `${scoreStr} (${roleStr})`;

  const getDisplayText = (): string => {
    if (fullText.length > 25) {
      const prefixLen = scoreStr.length + 3; // "X.X ("
      const maxRoleLen = 25 - prefixLen - 3; // -3 for "..."
      if (maxRoleLen > 0 && roleStr.length > maxRoleLen) {
        return `${scoreStr} (${roleStr.slice(0, Math.max(0, maxRoleLen))}...`;
      }
    }
    return fullText;
  };

  const displayText = getDisplayText();
  return `<span title="${fullText}">${displayText}</span>`;
}
