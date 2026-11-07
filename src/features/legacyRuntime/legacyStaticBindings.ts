type RunWindowAction = (name: string, ...args: unknown[]) => void;

function bindClick(selector: string, listener: () => void) {
  document.querySelector<HTMLElement>(selector)?.addEventListener('click', listener);
}

function bindToggle({
  contentSelector,
  toggleSelector,
  chevronSelector
}: {
  chevronSelector?: string;
  contentSelector: string;
  toggleSelector: string;
}) {
  const content = document.querySelector<HTMLElement>(contentSelector);
  const chevron = chevronSelector ? document.querySelector<HTMLElement>(chevronSelector) : null;

  bindClick(toggleSelector, () => {
    content?.classList.toggle('hidden');
    chevron?.classList.toggle('rotate-180');
  });
}

export function registerLegacyClipboardBridge(
  copyHandler: (event: Event, text: string) => Promise<void>
) {
  // This bridge remains global until the last inline clipboard hooks are removed.
  // eslint-disable-next-line fp/no-mutation
  (window as Window & { fmCopyToClipboard?: typeof copyHandler }).fmCopyToClipboard = copyHandler;
}

export function bindStaticLegacyInteractions(runWindowAction: RunWindowAction) {
  bindClick('#clear-all-filters', () => {
    runWindowAction('resetAllFilters');
  });

  bindClick('#reset-data-btn', () => {
    window.location.reload();
  });

  document.querySelector('#central-position-select')?.addEventListener('change', () => {
    runWindowAction('commitConfig');
  });

  bindToggle({
    contentSelector: '#club-config-content',
    toggleSelector: '#club-config-toggle'
  });

  bindToggle({
    contentSelector: '#ocr-content',
    toggleSelector: '#ocr-toggle'
  });
}
