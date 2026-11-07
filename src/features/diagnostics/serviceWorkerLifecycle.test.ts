import { describe, expect, it, vi } from 'vitest';

import { attachServiceWorkerLifecycle } from './serviceWorkerLifecycle';

interface FakeWorker {
  postMessage: (message: unknown) => void;
}

function createHarness(waiting: FakeWorker | null = null) {
  const container = new EventTarget();
  const registration = Object.assign(new EventTarget(), { waiting });
  const reload = vi.fn();
  const lifecycle = attachServiceWorkerLifecycle({ container, registration, reload });
  return { container, lifecycle, registration, reload };
}

describe('attachServiceWorkerLifecycle', () => {
  it('does not reload when the first install claims the page', () => {
    const { container, reload } = createHarness();

    container.dispatchEvent(new Event('controllerchange'));

    expect(reload).not.toHaveBeenCalled();
  });

  it('does not activate or reload after a background update', () => {
    const waiting = { postMessage: vi.fn<(message: unknown) => void>() };
    const { container, registration, reload } = createHarness(waiting);

    registration.dispatchEvent(new Event('updatefound'));
    container.dispatchEvent(new Event('controllerchange'));

    expect(waiting.postMessage).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('activates the waiting worker and reloads once after a user-requested update', () => {
    const waiting = { postMessage: vi.fn<(message: unknown) => void>() };
    const { container, lifecycle, reload } = createHarness(waiting);

    expect(lifecycle.applyUpdate()).toBe(true);
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    container.dispatchEvent(new Event('controllerchange'));
    container.dispatchEvent(new Event('controllerchange'));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reports no update when nothing is waiting', () => {
    const { lifecycle } = createHarness();

    expect(lifecycle.applyUpdate()).toBe(false);
  });
});
