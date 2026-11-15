// Refuses an install on a Node.js older than engines.node in package.json (the preinstall script).
import { readFileSync } from 'node:fs';

import { nodeFloorProblem } from './lib/node-floor.mjs';

// pnpm runs lifecycle scripts from the package root.
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const problem = nodeFloorProblem({ nodeVersion: process.version, range: manifest.engines.node });
if (problem !== null) {
  console.error(`check-node: ${problem}`);
  process.exitCode = 1;
}
