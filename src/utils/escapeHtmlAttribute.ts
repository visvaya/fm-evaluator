const HTML_ESCAPES: Record<string, string> = {
  '"': '&quot;',
  '&': '&amp;',
  "'": '&#39;',
  '<': '&lt;',
  '>': '&gt;'
};

/** Escapes text for use inside a quoted HTML attribute or as element text in markup strings. */
export function escapeHtmlAttribute(value: string): string {
  return value.replaceAll(/["&'<>]/g, (char) => HTML_ESCAPES[char]);
}
