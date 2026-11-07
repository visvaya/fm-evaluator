// Pure helpers for the bundle budget enforced by check:dist.
//
// Limits are about 10% above the size measured on 2026-10-01 (total of dist/assets/*.js:
// 1,139,635 B; largest chunk: 1,089,103 B). To raise them deliberately, rebuild, read the
// sizes check:dist prints, and change the values below in the same pull request that grows
// the bundle, with the reason in the commit body.
export const BUNDLE_BUDGET = Object.freeze({
  totalJsBytesMax: 1_254_400,
  largestChunkBytesMax: 1_198_080
});

export function evaluateBundleBudget({ chunks, budget }) {
  const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.bytes, 0);
  const largest = chunks.reduce(
    (best, chunk) => (best === null || chunk.bytes > best.bytes ? chunk : best),
    null
  );
  const totalViolation =
    totalBytes > budget.totalJsBytesMax
      ? [{ kind: 'total', bytes: totalBytes, limitBytes: budget.totalJsBytesMax }]
      : [];
  const largestViolation =
    largest !== null && largest.bytes > budget.largestChunkBytesMax
      ? [
          {
            kind: 'largest',
            name: largest.name,
            bytes: largest.bytes,
            limitBytes: budget.largestChunkBytesMax
          }
        ]
      : [];
  return { totalBytes, largest, violations: [...totalViolation, ...largestViolation] };
}

export function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}
