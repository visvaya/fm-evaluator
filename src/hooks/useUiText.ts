import { useEffect, useState } from 'react';

import { onLocaleChange, t } from '@/i18n';

import type { TranslationCategory } from '@/i18n';

const translateUiText = (
  key: string,
  category: TranslationCategory = 'ui',
  params?: Record<string, number | string>
) => t(key, category, params);

export function useUiText() {
  const [, setVersion] = useState(0);

  useEffect(() => onLocaleChange(() => setVersion((version) => version + 1)), []);

  return translateUiText;
}
