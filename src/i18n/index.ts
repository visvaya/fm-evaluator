/**
 * i18n Module - Internationalization for FM Evaluator UI
 *
 * Provides:
 * - Dynamic language detection from browser/localStorage
 * - Live UI updates without page reload
 * - Interpolation and simple pluralization
 * - Integration with DOM via data-i18n attributes
 */

export type LocaleId = string;
export interface LocaleIndex {
  defaultLocale: LocaleId;
  fallbackLocale: LocaleId;
  locales: LocaleInfo[];
}

export interface LocaleInfo {
  aliases?: string[];
  id: LocaleId;
  nativeName: string;
}

export type TranslationCategory = 'columns' | 'engines' | 'positions' | 'stats' | 'ui' | 'values';

export interface TranslationMessages {
  columns: Record<string, string>;
  engines: Record<string, string>;
  positions: Record<string, string>;
  stats: Record<string, string>;
  ui: Record<string, Record<string, string> | string>;
  values: Record<string, string>;
}

interface I18nState {
  currentLocale: LocaleId;
  initialized: boolean;
  localeIndex: LocaleIndex | null;
  messages: Map<LocaleId, TranslationMessages>;
}

const STORAGE_KEY = 'fm-evaluator-ui-locale';
const LEGACY_STORAGE_KEY = 'fm24-evaluator-ui-locale';

const state: I18nState = {
  currentLocale: 'en',
  initialized: false,
  localeIndex: {
    defaultLocale: 'en',
    fallbackLocale: 'en',
    locales: [
      { id: 'en', nativeName: 'English' },
      { id: 'pl', nativeName: 'Polski' }
    ]
  },
  messages: new Map()
};

const changeListeners = new Set<(locale: LocaleId) => void>();

/**
 * Apply translations to DOM elements with data-i18n attributes
 */
export function applyToDom(root: ParentNode = document): void {
  // data-i18n for textContent
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    const category = (el.dataset.i18nCategory as TranslationCategory) || 'ui';
    if (key) {
      el.textContent = t(key, category);
    }
  });

  // data-i18n-title for title attribute
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    const key = el.dataset.i18nTitle;
    const category = (el.dataset.i18nCategory as TranslationCategory) || 'ui';
    if (key) {
      el.title = t(key, category);
    }
  });

  // data-i18n-placeholder for placeholder attribute
  root.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    const category = (el.dataset.i18nCategory as TranslationCategory) || 'ui';
    if (key && 'placeholder' in el) {
      (el as HTMLInputElement).placeholder = t(key, category);
    }
  });
}

/**
 * Get all available locales
 */
export function getAvailableLocales(): LocaleInfo[] {
  return state.localeIndex?.locales || [];
}

/**
 * Get the current locale
 */
export function getLocale(): LocaleId {
  return state.currentLocale;
}

/**
 * Get native name for a locale
 */
export function getNativeName(locale: LocaleId): string {
  if (!state.localeIndex) return locale;
  const info = state.localeIndex.locales.find(
    (l) => l.id === locale || l.aliases?.includes(locale)
  );
  return info?.nativeName || locale;
}

/**
 * Initialize the i18n system
 * Loads locale index and detects/applies initial language
 */
export async function init(): Promise<void> {
  if (state.initialized) return;

  // Always bind to window immediately to ensure early availability
  if (typeof window !== 'undefined') {
    (window as any).i18n = i18n;
    console.info('[i18n] Module exposed to window.i18n');
  }

  try {
    // Load locale index
    const indexPath = '/i18n/messages/index.json';
    const indexResponse = await fetch(indexPath);
    if (!indexResponse.ok) {
      throw new Error(
        `Failed to load locale index from ${indexPath}: ${indexResponse.status} ${indexResponse.statusText}`
      );
    }
    state.localeIndex = await indexResponse.json();
    console.info(`[i18n] Loaded locale index with ${state.localeIndex?.locales.length} languages`);

    // Detect initial locale
    const detectedLocale = detectLocale();

    // Load messages for detected locale and fallback
    await loadMessages(detectedLocale);
    if (detectedLocale !== state.localeIndex.fallbackLocale) {
      await loadMessages(state.localeIndex.fallbackLocale);
    }

    state.currentLocale = detectedLocale;
    state.initialized = true;

    // Set document lang attribute
    document.documentElement.lang = detectedLocale;

    console.log(`[i18n] Initialized with locale: ${detectedLocale}`);
  } catch (error) {
    console.error('[i18n] Initialization failed, using built-in defaults:', error);
    // Fallback localeIndex is already set in state initialization
    state.currentLocale = 'en';
    state.initialized = true;
    document.documentElement.lang = 'en';
  }
}

/**
 * Check if i18n is initialized
 */
export function isInitialized(): boolean {
  return state.initialized;
}

/**
 * Subscribe to locale changes
 */
export function onLocaleChange(callback: (locale: LocaleId) => void): () => void {
  changeListeners.add(callback);
  return () => changeListeners.delete(callback);
}

/**
 * Render the language dropdown dynamically
 */
export function renderLanguageDropdown(containerId = 'language-dropdown'): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  const locales = getAvailableLocales();
  const currentLocale = getLocale();

  const html = locales
    .map((locale) => {
      const isActive = locale.id === currentLocale;
      const activeClasses = isActive
        ? 'bg-accent/10 text-accent font-semibold'
        : 'text-text-primary';
      return `<button
      class="w-full px-3 py-2 text-left text-sm transition hover:bg-surface ${activeClasses}"
      data-lang="${locale.id}"
    >${locale.nativeName}</button>`;
    })
    .join('');

  if (!html) {
    container.innerHTML =
      '<div class="p-3 text-xs italic text-text-muted">No languages available</div>';
    return;
  }
  container.innerHTML = html;

  // Bind click handlers
  container.querySelectorAll<HTMLButtonElement>('button[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      if (lang) {
        setLocale(lang);
        container.classList.add('hidden');
      }
    });
  });
}

/**
 * Set the current locale and update UI
 */
export async function setLocale(locale: LocaleId): Promise<void> {
  if (!state.localeIndex) return;

  // Normalize locale
  let normalizedLocale = locale.toLowerCase();
  const localeInfo = state.localeIndex.locales.find(
    (l) => l.id === normalizedLocale || l.aliases?.includes(normalizedLocale)
  );

  if (!localeInfo) {
    console.warn(`[i18n] Locale not found: ${locale}`);
    return;
  }

  normalizedLocale = localeInfo.id;

  // Load messages if needed
  await loadMessages(normalizedLocale);

  // Update state
  state.currentLocale = normalizedLocale;
  document.documentElement.lang = normalizedLocale;

  // Persist
  try {
    localStorage.setItem(STORAGE_KEY, normalizedLocale);
  } catch {
    // localStorage unavailable
  }

  // Notify listeners
  for (const listener of changeListeners) {
    try {
      listener(normalizedLocale);
    } catch (error) {
      console.error('[i18n] Listener error:', error);
    }
  }

  // Update DOM
  applyToDom();

  console.log(`[i18n] Locale changed to: ${normalizedLocale}`);
}

/**
 * Get a translation by key
 * @param key - Translation key
 * @param category - Translation category (default: 'ui')
 * @param params - Interpolation parameters
 */
export function t(
  key: string,
  category: TranslationCategory = 'ui',
  params: Record<string, number | string> = {}
): string {
  const messages = state.messages.get(state.currentLocale);
  const fallbackMessages = state.messages.get(state.localeIndex?.fallbackLocale || 'en');

  let translation: string | undefined;

  // Try current locale
  if (messages) {
    const categoryMessages = messages[category];
    if (categoryMessages) {
      const value = categoryMessages[key];
      if (typeof value === 'string') {
        translation = value;
      } else if (typeof value === 'object' && value !== null) {
        // Nested object (e.g., language_names)
        translation = JSON.stringify(value);
      }
    }
  }

  // Fallback to default locale
  if (!translation && fallbackMessages && fallbackMessages !== messages) {
    const categoryMessages = fallbackMessages[category];
    if (categoryMessages) {
      const value = categoryMessages[key];
      if (typeof value === 'string') {
        translation = value;
      }
    }
  }

  // Fallback to key
  if (!translation) {
    console.warn(`[i18n] Missing translation: ${category}.${key}`);
    return key;
  }

  // Interpolate parameters
  if (Object.keys(params).length > 0) {
    translation = translation.replaceAll(/\{(\w+)\}/g, (match, param) => {
      return params[param] === undefined ? match : String(params[param]);
    });
  }

  return translation;
}

/**
 * Get a nested translation value (e.g., language_names.en)
 */
export function tNested(
  key: string,
  nestedKey: string,
  category: TranslationCategory = 'ui'
): string {
  const messages = state.messages.get(state.currentLocale);
  const fallbackMessages = state.messages.get(state.localeIndex?.fallbackLocale || 'en');

  const tryGet = (msgs: TranslationMessages | undefined): string | undefined => {
    if (!msgs) return undefined;
    const categoryMessages = msgs[category];
    if (!categoryMessages) return undefined;
    const value = categoryMessages[key];
    if (typeof value === 'object' && value !== null) {
      return value[nestedKey];
    }
    return undefined;
  };

  return tryGet(messages) || tryGet(fallbackMessages) || nestedKey;
}

/**
 * Detect the best locale based on storage and browser preferences
 */
function detectLocale(): LocaleId {
  if (!state.localeIndex) return 'en';

  const availableIds = new Set<string>();
  const aliasMap = new Map<string, string>();

  for (const locale of state.localeIndex.locales) {
    availableIds.add(locale.id);
    if (locale.aliases) {
      for (const alias of locale.aliases) {
        aliasMap.set(alias.toLowerCase(), locale.id);
      }
    }
  }

  const normalize = (lang: string): LocaleId | null => {
    const lower = lang.toLowerCase();
    if (availableIds.has(lower)) return lower;
    if (aliasMap.has(lower)) return aliasMap.get(lower);
    // Try base language (e.g., 'en' from 'en-GB')
    const base = lower.split('-')[0];
    if (availableIds.has(base)) return base;
    if (aliasMap.has(base)) return aliasMap.get(base);
    return null;
  };

  // 1. Check localStorage (new key)
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const normalized = normalize(stored);
      if (normalized) return normalized;
    }
    // Check legacy key
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const normalized = normalize(legacy);
      if (normalized) return normalized;
    }
  } catch {
    // localStorage unavailable
  }

  // 2. Check browser preferences
  const browserLangs = navigator.languages || [navigator.language];
  for (const lang of browserLangs) {
    const normalized = normalize(lang);
    if (normalized) return normalized;
  }

  // 3. Fallback
  return state.localeIndex.defaultLocale;
}

/**
 * Load translation messages for a locale
 */
async function loadMessages(locale: LocaleId): Promise<void> {
  if (state.messages.has(locale)) return;

  try {
    const response = await fetch(`/i18n/messages/${locale}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load messages for ${locale}: ${response.status}`);
    }
    const messages: TranslationMessages = await response.json();
    state.messages.set(locale, messages);
  } catch (error) {
    console.warn(`[i18n] Failed to load messages for ${locale}:`, error);
  }
}

const i18n = {
  applyToDom,
  get availableLocales() {
    return getAvailableLocales();
  },
  get currentLanguage() {
    return state.currentLocale;
  },
  getAvailableLocales,
  getLocale,
  getNativeName,
  init,
  isInitialized: () => state.initialized,
  onLocaleChange,
  renderLanguageDropdown,
  setLanguage: setLocale, // Alias for legacy main.js
  setLocale,
  t,
  tNested
};

// Bind to window for legacy code compatibility
if (typeof window !== 'undefined') {
  (window as any).i18n = i18n;
  (window as any).__I18N_MODULE_LOADED__ = true;
}

export default i18n;
