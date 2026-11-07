const inlineCopySelector = '[onclick*="copyToClipboard"]';
const normalizedCopyAttribute = 'data-fm-copy-text';

const legacyActionSelector = '[onclick*="removeFileFromStack"], [onclick*="remapFileHeaders"]';

type IndexActionName = 'remapFileHeaders' | 'removeFileFromStack';

function getParentRoot(node: HTMLElement): ParentNode {
  return node.parentNode ?? document;
}

function shouldNormalizeAddedNode(node: HTMLElement, selector: string) {
  return node.matches(selector) || Boolean(node.querySelector(selector));
}

function observeInlineOnclick({
  normalizeRoot,
  normalizeTarget,
  shouldHandleOnclick,
  selector
}: {
  normalizeRoot: (root: ParentNode) => void;
  normalizeTarget: (target: HTMLElement, onclick: string) => void;
  selector: string;
  shouldHandleOnclick: (onclick: string) => boolean;
}) {
  if (!document.body) return;

  normalizeRoot(document);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        const target = mutation.target;
        if (!(target instanceof HTMLElement)) continue;
        const onclick = target.getAttribute('onclick');
        if (onclick?.length && shouldHandleOnclick(onclick)) {
          normalizeTarget(target, onclick);
        }
        continue;
      }

      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (!shouldNormalizeAddedNode(node, selector)) return;
        normalizeRoot(node.matches(selector) ? getParentRoot(node) : node);
      });
    }
  });

  observer.observe(document.body, {
    attributeFilter: ['onclick'],
    attributes: true,
    childList: true,
    subtree: true
  });
}

export function parseInlineCopyToClipboard(onclick: string): null | string {
  const match = /copyToClipboard\(\s*event\s*,\s*'((?:\\\\'|\\\\\\\\|[^'])*)'/.exec(onclick);
  if (!match) return null;

  return match[1].replaceAll(String.raw`\\'`, "'").replaceAll('\\\\\\\\', '\\');
}

export function parseInlineLegacyAction(
  onclick: string
): null | { action: IndexActionName; index: number } {
  const removeMatch = /removeFileFromStack\(\s*(\d+)\s*\)/.exec(onclick);
  if (removeMatch) {
    return { action: 'removeFileFromStack', index: Number.parseInt(removeMatch[1], 10) };
  }

  const remapMatch = /remapFileHeaders\(\s*(\d+)\s*\)/.exec(onclick);
  if (remapMatch) {
    return { action: 'remapFileHeaders', index: Number.parseInt(remapMatch[1], 10) };
  }

  return null;
}

export function normalizeInlineCopyHandlers(root: ParentNode) {
  const nodes = root.querySelectorAll<HTMLElement>(inlineCopySelector);
  nodes.forEach((node) => {
    if (node.hasAttribute(normalizedCopyAttribute)) return;

    const parsed = parseInlineCopyToClipboard(node.getAttribute('onclick') ?? '');
    if (!parsed) return;

    // Legacy normalization has to rewrite DOM-owned attributes in place.
    // eslint-disable-next-line fp/no-mutation
    node.dataset.fmCopyText = parsed;
    node.removeAttribute('onclick');
  });
}

export function normalizeInlineLegacyActionHandlers(root: ParentNode) {
  const nodes = root.querySelectorAll<HTMLElement>(legacyActionSelector);
  nodes.forEach((node) => {
    const parsed = parseInlineLegacyAction(node.getAttribute('onclick') ?? '');
    if (!parsed) return;

    // Legacy normalization has to rewrite DOM-owned attributes in place.
    // eslint-disable-next-line fp/no-mutation
    node.dataset.fmAction = parsed.action;
    // eslint-disable-next-line fp/no-mutation
    node.dataset.fmIndex = String(parsed.index);
    node.removeAttribute('onclick');
  });
}

export function installInlineCopyObserver() {
  observeInlineOnclick({
    normalizeRoot: normalizeInlineCopyHandlers,
    normalizeTarget: (target, onclick) => {
      if (target.hasAttribute(normalizedCopyAttribute)) {
        target.removeAttribute('onclick');
        return;
      }

      const parsed = parseInlineCopyToClipboard(onclick);
      if (!parsed) return;

      // Legacy normalization has to rewrite DOM-owned attributes in place.
      // eslint-disable-next-line fp/no-mutation
      target.dataset.fmCopyText = parsed;
      target.removeAttribute('onclick');
    },
    selector: inlineCopySelector,
    shouldHandleOnclick: (onclick) => onclick.includes('copyToClipboard')
  });
}

export function installInlineLegacyActionObserver() {
  observeInlineOnclick({
    normalizeRoot: normalizeInlineLegacyActionHandlers,
    normalizeTarget: (target) => {
      normalizeInlineLegacyActionHandlers(getParentRoot(target));
    },
    selector: legacyActionSelector,
    shouldHandleOnclick: (onclick) =>
      onclick.includes('removeFileFromStack') || onclick.includes('remapFileHeaders')
  });
}
