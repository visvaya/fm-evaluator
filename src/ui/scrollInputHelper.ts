export function setupScrollInputPercent(inputId: string, step = 1, fallback = 0): void {
  const input = document.getElementById(inputId) as HTMLInputElement | null;
  if (!input) return;

  if ((input as any)._scrollSetup) {
    if ((input as any)._scrollHandler)
      input.removeEventListener('wheel', (input as any)._scrollHandler, { passive: false } as any);
    if ((input as any)._scrollTimer) {
      clearTimeout((input as any)._scrollTimer);
      (input as any)._scrollTimer = null;
    }
  }

  const scrollHandler = (e: WheelEvent) => {
    if (document.activeElement !== input) return;
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    if ((input as any)._isScrolling) return;
    if ((input as any)._lastScrollTime && now - (input as any)._lastScrollTime < 100) return;
    (input as any)._isScrolling = true;
    (input as any)._lastScrollTime = now;
    let val = parseInt(input.value, 10);
    if (isNaN(val)) val = fallback;
    input.value = String(Math.max(0, Math.min(100, val + Math.sign(e.deltaY) * -1 * step)));
    if ((input as any)._scrollTimer) clearTimeout((input as any)._scrollTimer);
    (input as any)._scrollTimer = setTimeout(() => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      (input as any)._scrollTimer = null;
    }, 150);
    setTimeout(() => {
      (input as any)._isScrolling = false;
    }, 100);
  };

  (input as any)._scrollHandler = scrollHandler;
  (input as any)._scrollSetup = true;
  (input as any)._lastScrollTime = 0;
  (input as any)._isScrolling = false;
  input.addEventListener('wheel', scrollHandler, { passive: false });
}
