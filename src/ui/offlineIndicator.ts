/**
 * Offline Indicator - PWA offline/online status UI component
 * Shows visual feedback for network state changes
 */

export type NetworkState = 'offline' | 'online' | 'syncing';

export interface OfflineIndicatorConfig {
  bannerId?: string;
  offlineMessage?: string;
  onlineMessage?: string;
  onlineToastDuration?: number;
  onStateChange?: (online: boolean) => void;
  showOnlineToast?: boolean;
  syncingMessage?: string;
  textId?: string;
}

const DEFAULT_CONFIG: OfflineIndicatorConfig = {
  bannerId: 'network-banner',
  offlineMessage: 'Brak połączenia – tryb offline',
  onlineMessage: 'Połączenie przywrócone',
  onlineToastDuration: 3000,
  showOnlineToast: true,
  syncingMessage: 'Synchronizacja danych...',
  textId: 'network-banner-text'
};

class OfflineIndicator {
  private config: OfflineIndicatorConfig;
  private listeners = new Set<(state: NetworkState) => void>();
  private state: NetworkState = 'online';
  private toastTimeoutId: null | ReturnType<typeof setTimeout> = null;
  private wasOffline = false;

  constructor(config: Partial<OfflineIndicatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = navigator.onLine ? 'online' : 'offline';
    this.wasOffline = !navigator.onLine;
  }

  getState(): NetworkState {
    return this.state;
  }

  init(): void {
    this.updateUI();
    this.bindEvents();
  }

  isOffline(): boolean {
    return this.state === 'offline';
  }

  isOnline(): boolean {
    return this.state === 'online';
  }

  isSyncing(): boolean {
    return this.state === 'syncing';
  }

  setSyncing(syncing: boolean): void {
    if (syncing && this.state === 'online') {
      this.setState('syncing');
    } else if (!syncing && this.state === 'syncing') {
      this.setState('online');
    }
  }

  subscribe(listener: (state: NetworkState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private bindEvents(): void {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Listen for SW sync events if available
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SYNC_START') {
          this.setState('syncing');
        } else if (event.data?.type === 'SYNC_COMPLETE') {
          this.setState('online');
        }
      });
    }
  }

  private handleOffline(): void {
    this.wasOffline = true;
    this.setState('offline');
    this.config.onStateChange?.(false);
  }

  private handleOnline(): void {
    const wasOffline = this.wasOffline;
    this.wasOffline = false;
    this.setState('online');

    if (wasOffline && this.config.showOnlineToast) {
      this.showOnlineToast();
    }

    this.config.onStateChange?.(true);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (error) {
        console.error('[OfflineIndicator] Listener error:', error);
      }
    }
  }

  private setState(newState: NetworkState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.updateUI();
      this.notify();
    }
  }

  private showOnlineToast(): void {
    const banner = document.getElementById(this.config.bannerId);
    const text = document.getElementById(this.config.textId);

    if (!banner) return;

    // Clear any existing timeout
    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
    }

    banner.classList.remove('hidden');
    banner.classList.add('network-online');
    banner.classList.remove('network-offline', 'network-syncing');
    if (text) text.textContent = this.config.onlineMessage!;

    this.toastTimeoutId = setTimeout(() => {
      banner.classList.add('hidden');
      banner.classList.remove('network-online');
      this.toastTimeoutId = null;
    }, this.config.onlineToastDuration);
  }

  private updateUI(): void {
    const banner = document.getElementById(this.config.bannerId);
    const text = document.getElementById(this.config.textId);

    if (!banner) return;

    banner.dataset.networkState = this.state;

    if (this.state === 'offline') {
      banner.classList.remove('hidden');
      banner.classList.add('network-offline');
      banner.classList.remove('network-online', 'network-syncing');
      if (text) text.textContent = this.config.offlineMessage!;
    } else if (this.state === 'syncing') {
      banner.classList.remove('hidden');
      banner.classList.add('network-syncing');
      banner.classList.remove('network-online', 'network-offline');
      if (text) text.textContent = this.config.syncingMessage!;
    } else {
      // Online - hide unless showing toast
      if (!this.toastTimeoutId) {
        banner.classList.add('hidden');
      }
      banner.classList.remove('network-offline', 'network-syncing');
    }
  }
}

// Singleton instance
let instance: null | OfflineIndicator = null;

export function getNetworkState(): NetworkState {
  return getOfflineIndicator().getState();
}

export function getOfflineIndicator(config?: Partial<OfflineIndicatorConfig>): OfflineIndicator {
  if (!instance) {
    instance = new OfflineIndicator(config);
  }
  return instance;
}

export function initOfflineIndicator(config?: Partial<OfflineIndicatorConfig>): void {
  getOfflineIndicator(config).init();
}

export function isOffline(): boolean {
  return getOfflineIndicator().isOffline();
}

export function isOnline(): boolean {
  return getOfflineIndicator().isOnline();
}

// Utility: Check if action requires network
export function requiresNetwork(action: () => Promise<void>): Promise<void> {
  if (isOffline()) {
    return Promise.reject(new Error('Ta akcja wymaga połączenia z internetem'));
  }
  return action();
}

// Utility: Queue action for when online
const pendingActions: (() => Promise<void>)[] = [];

export function queueWhenOnline(action: () => Promise<void>): void {
  if (isOnline()) {
    action().catch(console.error);
    return;
  }

  pendingActions.push(action);

  // Set up one-time listener to execute pending actions
  const unsubscribe = getOfflineIndicator().subscribe((state) => {
    if (state === 'online' && pendingActions.length > 0) {
      const actions = [...pendingActions];
      pendingActions.length = 0;
      unsubscribe();

      Promise.allSettled(actions.map((a) => a())).then((results) => {
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed > 0) {
          console.warn(`[OfflineIndicator] ${failed} queued actions failed after coming online`);
        }
      });
    }
  });
}

// Export to window
if (typeof window !== 'undefined') {
  (window as any).offlineIndicator = {
    get: getOfflineIndicator,
    getState: getNetworkState,
    init: initOfflineIndicator,
    isOffline,
    isOnline,
    queueWhenOnline,
    requiresNetwork
  };
}

export { OfflineIndicator };
