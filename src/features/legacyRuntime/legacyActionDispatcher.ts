import { parseInlineCopyToClipboard } from './inlineOnclickBridges';

type IdActionName =
  | 'applyFilter'
  | 'resetColumnFilter'
  | 'toggleAllVisible'
  | 'toggleShowActiveInFilter';
type IndexActionName = 'remapFileHeaders' | 'removeFileFromStack';

type RunWindowAction = (name: string, ...args: unknown[]) => void;

interface ActionHandlerContext {
  event: MouseEvent;
  runWindowAction: RunWindowAction;
  safeCopyToClipboard: (event: Event, text: string) => Promise<void>;
  target: HTMLElement;
}

type ActionHandler = (context: ActionHandlerContext) => void;

function stopEvent(event: Event, stopPropagation = true) {
  event.preventDefault();
  if (stopPropagation) {
    event.stopPropagation();
  }
}

function readAttribute(target: HTMLElement, name: string) {
  return target.getAttribute(name) ?? '';
}

function readRequiredAttribute(target: HTMLElement, name: string) {
  const value = target.getAttribute(name);
  return value && value.length > 0 ? value : null;
}

function readIntegerAttribute(target: HTMLElement, name: string) {
  const value = readRequiredAttribute(target, name);
  if (!value) return null;

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function createIndexActionHandler(action: IndexActionName): ActionHandler {
  return ({ event, runWindowAction, target }) => {
    const index = readIntegerAttribute(target, 'data-fm-index');
    if (index === null) return;

    stopEvent(event);
    runWindowAction(action, index);
  };
}

function createIdActionHandler(action: IdActionName): ActionHandler {
  return ({ event, runWindowAction, target }) => {
    const id = readRequiredAttribute(target, 'data-fm-id');
    if (!id) return;

    stopEvent(event);
    if (action === 'applyFilter') {
      runWindowAction(action, id, readAttribute(target, 'data-fm-type'));
      return;
    }

    runWindowAction(action, id);
  };
}

const actionHandlers: Record<string, ActionHandler> = {
  applyFilter: createIdActionHandler('applyFilter'),
  copyToClipboard: ({ event, runWindowAction, target }) => {
    const text = readRequiredAttribute(target, 'data-fm-text');
    if (!text) return;

    event.preventDefault();
    runWindowAction('copyToClipboard', event, text, readAttribute(target, 'data-fm-icon-id'));
  },
  editOCRResult: ({ event, runWindowAction, target }) => {
    const resultId = readRequiredAttribute(target, 'data-fm-result-id');
    if (!resultId) return;

    stopEvent(event);
    runWindowAction('editOCRResult', resultId);
  },
  openDetails: ({ event, runWindowAction, target }) => {
    const uid = readRequiredAttribute(target, 'data-fm-uid');
    if (!uid) return;

    event.preventDefault();
    runWindowAction('openDetails', uid);
  },
  remapFileHeaders: createIndexActionHandler('remapFileHeaders'),
  removeClubPossession: ({ event, runWindowAction, target }) => {
    const club = readRequiredAttribute(target, 'data-fm-club');
    if (!club) return;

    stopEvent(event);
    runWindowAction('removeClubPossession', event, club);
  },
  removeFileFromStack: createIndexActionHandler('removeFileFromStack'),
  removeOCRResult: ({ event, runWindowAction, target }) => {
    const resultId = readRequiredAttribute(target, 'data-fm-result-id');
    if (!resultId) return;

    stopEvent(event);
    runWindowAction('removeOCRResult', resultId);
  },
  resetColumnFilter: createIdActionHandler('resetColumnFilter'),
  selectPossessionClub: ({ event, runWindowAction, target }) => {
    const club = readRequiredAttribute(target, 'data-fm-club');
    if (!club) return;

    event.preventDefault();
    runWindowAction('selectPossessionClub', club);
  },
  stopPropagation: ({ event }) => {
    event.stopPropagation();
  },
  toggleAllVisible: createIdActionHandler('toggleAllVisible'),
  toggleCollapsible: ({ event, target }) => {
    const contentId = readRequiredAttribute(target, 'data-fm-content-id');
    if (!contentId) return;

    event.preventDefault();

    const content = document.querySelector<HTMLElement>(`#${contentId}`);
    const chevronId = readRequiredAttribute(target, 'data-fm-chevron-id');
    const chevron = chevronId ? document.querySelector<HTMLElement>(`#${chevronId}`) : null;

    content?.classList.toggle('hidden');
    chevron?.classList.toggle('fa-chevron-down');
    chevron?.classList.toggle('fa-chevron-up');
  },
  toggleShowActiveInFilter: createIdActionHandler('toggleShowActiveInFilter')
};

function handleInlineCopyClick({
  event,
  safeCopyToClipboard,
  target
}: {
  event: MouseEvent;
  safeCopyToClipboard: (event: Event, text: string) => Promise<void>;
  target: HTMLElement | null;
}) {
  const copyTarget = target?.closest<HTMLElement>(
    '[data-fm-copy-text], i[onclick*="copyToClipboard"], button[onclick*="copyToClipboard"]'
  );
  if (!copyTarget) return false;

  const normalizedText = copyTarget.dataset.fmCopyText;
  if (normalizedText) {
    void safeCopyToClipboard(event, normalizedText);
    return true;
  }

  const parsed = parseInlineCopyToClipboard(copyTarget.getAttribute('onclick') ?? '');
  if (!parsed) return false;

  // Legacy normalization has to rewrite DOM-owned attributes in place.
  // eslint-disable-next-line fp/no-mutation
  copyTarget.dataset.fmCopyText = parsed;
  copyTarget.removeAttribute('onclick');
  void safeCopyToClipboard(event, parsed);
  return true;
}

export function createLegacyClickHandler({
  runWindowAction,
  safeCopyToClipboard
}: {
  runWindowAction: RunWindowAction;
  safeCopyToClipboard: (event: Event, text: string) => Promise<void>;
}) {
  return (event: MouseEvent) => {
    const target = event.target instanceof HTMLElement ? event.target : null;

    if (handleInlineCopyClick({ event, safeCopyToClipboard, target })) {
      return;
    }

    const actionTarget = target?.closest<HTMLElement>('[data-fm-action]');
    const action = actionTarget?.dataset.fmAction;
    if (!actionTarget || !action) return;

    const handler = actionHandlers[action];
    if (!handler) return;

    handler({
      event,
      runWindowAction,
      safeCopyToClipboard,
      target: actionTarget
    });
  };
}
