// Finds files under public/ that nothing references. knip follows imports only, and public/ files
// are loaded by URL, so an unused one would otherwise ship and be precached unnoticed.

// Files loaded by a path built at runtime (a language code, a locale), not written out anywhere.
export const RUNTIME_LOADED_PATTERNS = [
  /^i18n\/messages\/[a-z-]+\.json$/,
  /^config\/languages\/[a-z-]+\.json$/,
  /^vendor\/tesseract\/langs\/[a-z_]+\.traineddata$/
];

// Entry files the browser or the build looks up by a fixed name.
export const ENTRY_FILES = new Set(['manifest.webmanifest', 'service-worker.js']);

/**
 * @param {readonly string[]} publicFiles paths relative to public/, with forward slashes
 * @param {readonly string[]} referrerTexts contents of every file that may reference them
 * @returns {string[]} files referenced by neither their path, their file name nor a pattern
 */
export function findUnreferencedPublicFiles(publicFiles, referrerTexts) {
  const corpus = referrerTexts.join('\n');
  return publicFiles.filter((file) => {
    if (ENTRY_FILES.has(file)) return false;
    if (RUNTIME_LOADED_PATTERNS.some((pattern) => pattern.test(file))) return false;
    const fileName = file.slice(file.lastIndexOf('/') + 1);
    return !corpus.includes(file) && !corpus.includes(fileName);
  });
}
