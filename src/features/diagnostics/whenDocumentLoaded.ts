/**
 * Runs the callback once the window `load` event has fired. When it already fired
 * (the caller runs late, e.g. from a React effect), the callback runs immediately;
 * a `load` listener added after the event would never be called.
 */
export function whenDocumentLoaded(callback: () => void): void {
  if (document.readyState === 'complete') {
    callback();
    return;
  }
  window.addEventListener('load', callback, { once: true });
}
