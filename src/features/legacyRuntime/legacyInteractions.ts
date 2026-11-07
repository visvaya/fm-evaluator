import {
  installInlineCopyObserver,
  installInlineLegacyActionObserver
} from './inlineOnclickBridges';
import { createLegacyClickHandler } from './legacyActionDispatcher';
import {
  bindStaticLegacyInteractions,
  registerLegacyClipboardBridge
} from './legacyStaticBindings';

interface LegacyInteractionsOptions {
  copyTextToClipboard: (text: string) => Promise<void>;
}

function runWindowAction(name: string, ...args: unknown[]) {
  const windowRecord = window as unknown as Record<string, unknown>;
  const action = windowRecord[name];
  if (typeof action === 'function') {
    action(...args);
  }
}

function createSafeCopyToClipboard(copyTextToClipboard: (text: string) => Promise<void>) {
  return async (event: Event, text: string) => {
    event.preventDefault?.();
    event.stopPropagation?.();

    try {
      await copyTextToClipboard(text);
    } catch (error) {
      console.warn('[Clipboard] Copy failed', error);
    }
  };
}

export function installLegacyInteractions({ copyTextToClipboard }: LegacyInteractionsOptions) {
  const safeCopyToClipboard = createSafeCopyToClipboard(copyTextToClipboard);

  registerLegacyClipboardBridge(safeCopyToClipboard);
  document.addEventListener(
    'click',
    createLegacyClickHandler({
      runWindowAction,
      safeCopyToClipboard
    }),
    true
  );

  bindStaticLegacyInteractions(runWindowAction);
  installInlineCopyObserver();
  installInlineLegacyActionObserver();
}
