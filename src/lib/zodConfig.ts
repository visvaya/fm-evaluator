import * as z from 'zod';

/**
 * Zod 4 probes for JIT support with `Function('')` the first time it parses an object.
 * The strict CSP (ADR-004, no 'unsafe-eval') blocks that probe and reports a violation,
 * so the app opts into jitless mode before any schema runs.
 */
export function configureZodForStrictCsp(): void {
  z.config({ jitless: true });
}

configureZodForStrictCsp();
