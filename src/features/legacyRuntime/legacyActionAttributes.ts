import { escapeHtmlAttribute } from '@/utils/escapeHtmlAttribute';

type LegacyIdActionName =
  'applyFilter' | 'resetColumnFilter' | 'toggleAllVisible' | 'toggleShowActiveInFilter';

type LegacyIndexActionName = 'remapFileHeaders' | 'removeFileFromStack';
type LegacyResultActionName = 'editOCRResult' | 'removeOCRResult';
type LegacyClubActionName = 'removeClubPossession' | 'selectPossessionClub';

/** Values are raw text: this function escapes them, so callers must not escape them first. */
function renderLegacyActionAttributes(attributes: Record<string, number | string | undefined>) {
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}="${escapeHtmlAttribute(String(value))}"`)
    .join(' ');
}

export function legacyIndexActionAttrs(action: LegacyIndexActionName, index: number) {
  return renderLegacyActionAttributes({
    'data-fm-action': action,
    'data-fm-index': index
  });
}

export function legacyIdActionAttrs(action: LegacyIdActionName, id: string, type?: string) {
  return renderLegacyActionAttributes({
    'data-fm-action': action,
    'data-fm-id': id,
    'data-fm-type': type
  });
}

export function legacyResultActionAttrs(action: LegacyResultActionName, resultId: string) {
  return renderLegacyActionAttributes({
    'data-fm-action': action,
    'data-fm-result-id': resultId
  });
}

export function legacyClubActionAttrs(action: LegacyClubActionName, club: string) {
  return renderLegacyActionAttributes({
    'data-fm-action': action,
    'data-fm-club': club
  });
}

export function legacyOpenDetailsActionAttrs(uid: string) {
  return renderLegacyActionAttributes({
    'data-fm-action': 'openDetails',
    'data-fm-uid': uid
  });
}

export function legacyCopyActionAttrs(text: string, iconId: string) {
  return renderLegacyActionAttributes({
    'data-fm-action': 'copyToClipboard',
    'data-fm-icon-id': iconId,
    'data-fm-text': text
  });
}
