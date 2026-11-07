export function t(key: string, category?: string, params?: Record<string, unknown>): string {
  return (window as any).i18n?.t(key, category, params) ?? key;
}

export function getCurrentLanguage(): string | null {
  return (window as any).i18n?.currentLanguage ?? null;
}

export function tNested(key: string, nestedKey: string, category?: string): string {
  return (window as any).i18n?.tNested(key, nestedKey, category) ?? nestedKey;
}
