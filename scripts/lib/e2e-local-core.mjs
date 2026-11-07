/** Pure helpers for scripts/e2e-local.mjs. */

const DEFAULT_PORT_ATTEMPTS = 50;

/**
 * Split CLI args into the script's own flag and the args for Playwright.
 * Everything after a `--` separator goes to Playwright untouched.
 */
export const parseE2eArgs = (argv) => {
  const separator = argv.indexOf('--');
  const own = separator === -1 ? argv : argv.slice(0, separator);
  const passthrough = separator === -1 ? [] : argv.slice(separator + 1);
  return {
    preview: own.includes('--preview'),
    playwrightArgs: [...own.filter((arg) => arg !== '--preview'), ...passthrough]
  };
};

/** Probe ports from `start` upwards and return the first free one. */
export const findFreePort = async ({ start, isFree, attempts = DEFAULT_PORT_ATTEMPTS }) => {
  const candidates = Array.from({ length: attempts }, (_, offset) => start + offset);
  for (const port of candidates) {
    if (await isFree(port)) return port;
  }
  throw new Error(`No free port in ${start}-${start + attempts - 1}`);
};

/** True when a response carries the cross-origin isolation header of FM Evaluator. */
export const hasCoopHeader = (headers) =>
  (headers.get('cross-origin-opener-policy') ?? '').toLowerCase() === 'same-origin';
