export function normalizeHeader(header: unknown): string {
  if (!header || typeof header !== 'string') return header as string;
  return header.normalize('NFC').replaceAll(/\s+/g, ' ').trim();
}
