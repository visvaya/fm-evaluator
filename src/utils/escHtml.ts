export function escHtml(s: null | string | undefined): string {
  if (!s) return '';
  const node = document.createElement('div');
  node.textContent = s;
  return node.innerHTML;
}
