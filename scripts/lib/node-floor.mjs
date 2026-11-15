// The lowest Node.js release a local install accepts, read from engines.node in package.json.
// pnpm's engineStrict would enforce it too, but it also refuses the Dependabot npm updater, which
// runs an older Node, so no npm update could open. The preinstall script runs this check instead;
// the updater skips install scripts.

const FLOOR_PATTERN = /^>=(\d+)\.(\d+)\.(\d+)$/;
const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)/;

/**
 * Null when `nodeVersion` (as `process.version` gives it) meets the floor `range`, else the problem.
 * @param {{ nodeVersion: string, range: string }} input
 * @returns {string | null}
 */
export function nodeFloorProblem({ nodeVersion, range }) {
  const floor = FLOOR_PATTERN.exec(range);
  if (floor === null) {
    throw new Error(`engines.node "${range}": only ">=x.y.z" is supported`);
  }
  const current = VERSION_PATTERN.exec(nodeVersion);
  if (current === null) {
    throw new Error(`Node version "${nodeVersion}" is not x.y.z`);
  }
  const currentParts = current.slice(1, 4).map(Number);
  const floorParts = floor.slice(1, 4).map(Number);
  const index = currentParts.findIndex((part, i) => part !== floorParts[i]);
  const older = index !== -1 && currentParts[index] < floorParts[index];
  return older ? `Node ${currentParts.join('.')} is older than the required ${range}` : null;
}
