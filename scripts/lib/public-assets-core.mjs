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

// Characters that may precede a file name in a URL, an import, a CSS url() or a string.
const NAME_BOUNDARY = new Set(['/', '"', "'", '`', '(', ' ', '\t', '\n', '\r', '=']);

function mentionsName(text, name) {
  for (let index = text.indexOf(name); index !== -1; index = text.indexOf(name, index + 1)) {
    if (index === 0 || NAME_BOUNDARY.has(text[index - 1])) return true;
  }
  return false;
}

/**
 * @param {readonly string[]} publicFiles paths relative to public/, with forward slashes
 * @param {readonly { file: string, text: string }[]} referrers every file that may reference
 *   them, with its path relative to the app (public/ files start with "public/")
 * @returns {string[]} files referenced by neither their path, their file name nor a pattern; a
 *   file's own content does not count
 */
export function findUnreferencedPublicFiles(publicFiles, referrers) {
  return publicFiles.filter((file) => {
    if (ENTRY_FILES.has(file)) return false;
    if (RUNTIME_LOADED_PATTERNS.some((pattern) => pattern.test(file))) return false;
    const fileName = file.slice(file.lastIndexOf('/') + 1);
    const others = referrers.filter((referrer) => referrer.file !== `public/${file}`);
    return !others.some(({ text }) => text.includes(file) || mentionsName(text, fileName));
  });
}
