// Phase 5A: Utility functions migrated from main.js

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function formatPlayerValue(val: any): string {
  if (val === null || val === undefined || val === '-') return '-';
  if (
    typeof val === 'string' && // Already a formatted string or range: return it as is
    (val.includes('–') ||
      val.includes('-') ||
      val.includes('\u2014') ||
      /[KkM]/.test(val) ||
      val.includes('€') ||
      val.includes('$'))
  ) {
    return val;
  }
  const num = Number(val);
  if (isNaN(num)) return String(val);
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function getFeetStars(value: null | number | undefined): string {
  if (value === null || value === undefined || value === 0) return '-';
  return '★'.repeat(value);
}

export function normalizeDiacritics(str: null | string | undefined): null | string | undefined {
  if (!str || typeof str !== 'string') return str;
  return str.normalize('NFD').replaceAll(/[\u0300-\u036F]/g, '');
}

export function translateHeaderToInterfaceLang(
  englishHeader: null | string | undefined
): null | string | undefined {
  if (!englishHeader || ((window as any).i18n?.currentLanguage || 'en') === 'en') {
    return englishHeader;
  }
  // New system handles translations via language config files
  return englishHeader;
}
