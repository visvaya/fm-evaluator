interface WaitingWorker {
  postMessage: (message: unknown) => void;
}

interface LifecycleOptions {
  container: EventTarget;
  registration: { waiting: null | WaitingWorker };
  reload: () => void;
}

/**
 * Service worker update policy: a new worker waits until the user asks for it. Imported
 * players live only in memory, so the page never reloads by itself, neither when the first
 * install claims it nor after a background update; `applyUpdate` (a user action) activates
 * the waiting worker and reloads once it takes control.
 */
export function attachServiceWorkerLifecycle({
  container,
  registration,
  reload
}: LifecycleOptions) {
  const applyUpdate = (): boolean => {
    const waiting = registration.waiting;
    if (!waiting) return false;
    container.addEventListener('controllerchange', () => reload(), { once: true });
    waiting.postMessage({ type: 'SKIP_WAITING' });
    return true;
  };
  return { applyUpdate };
}
