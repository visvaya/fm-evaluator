import { t } from '../lib/i18nBridge';

// Pagination logic extracted from main.js

/**
 * Update pagination UI
 * @param page Current page number
 * @param maxPage Maximum page number
 */
export function updatePageInfo(page: number, maxPage: number): void {
  const normalizedMax = Math.max(0, maxPage || 0);
  const normalizedPage = normalizedMax === 0 ? 0 : Math.min(Math.max(page || 1, 1), normalizedMax);

  const pageNumberInput = document.querySelector<HTMLInputElement>('#page-number');
  const pageTotalDisplay = document.querySelector('#page-total-display');

  if (pageNumberInput) {
    pageNumberInput.value = normalizedPage.toString();
    pageNumberInput.max = normalizedMax > 0 ? normalizedMax.toString() : '1';
  }

  if (pageTotalDisplay) {
    pageTotalDisplay.textContent = ` ${t('of')} ${normalizedMax}`;
  }

  const disablePrev = normalizedMax === 0 || normalizedPage <= 1;
  const disableNext = normalizedMax === 0 || normalizedPage >= normalizedMax;

  const pageFirst = document.querySelector<HTMLButtonElement>('#page-first');
  const pagePrev = document.querySelector<HTMLButtonElement>('#page-prev');
  const pageNext = document.querySelector<HTMLButtonElement>('#page-next');
  const pageLast = document.querySelector<HTMLButtonElement>('#page-last');

  if (pageFirst) pageFirst.disabled = disablePrev;
  if (pagePrev) pagePrev.disabled = disablePrev;
  if (pageNext) pageNext.disabled = disableNext;
  if (pageLast) pageLast.disabled = disableNext;
}
