export function persistUIState(): void {
  (window as any).persistUIState?.();
}

export function scheduleTableRender(): void {
  (window as any).scheduleTableRender?.();
}
