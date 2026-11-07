#!/usr/bin/env node
/**
 * Run Playwright against a FM Evaluator server started on a free port.
 * Usage: pnpm run e2e:local [--preview] [-- <playwright args>]
 * --preview serves the existing build (run `pnpm run build` first) with `vite preview`.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

import { findFreePort, hasCoopHeader, parseE2eArgs } from './lib/e2e-local-core.mjs';

const CONFIG = {
  firstPort: 5180,
  host: '127.0.0.1',
  readyTimeoutMs: 120000,
  pollIntervalMs: 500
};

const isWindows = process.platform === 'win32';

const isPortFree = (port) =>
  new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, CONFIG.host);
  });

const run = (args, env = process.env) =>
  spawn('pnpm', args, { stdio: 'inherit', env, shell: isWindows });

const waitForServer = async (url, server) => {
  const deadline = Date.now() + CONFIG.readyTimeoutMs;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Server exited with code ${server.exitCode}`);
    try {
      const response = await fetch(url);
      if (hasCoopHeader(response.headers)) return;
    } catch {
      // Not listening yet; keep polling.
    }
    await delay(CONFIG.pollIntervalMs);
  }
  throw new Error(`Server at ${url} did not answer with COOP within ${CONFIG.readyTimeoutMs} ms`);
};

const stopServer = (server) => {
  if (server.exitCode !== null || server.pid === undefined) return;
  if (isWindows) {
    spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    server.kill('SIGTERM');
  }
};

const main = async () => {
  const { preview, playwrightArgs } = parseE2eArgs(process.argv.slice(2));
  const port = await findFreePort({ start: CONFIG.firstPort, isFree: isPortFree });
  const url = `http://${CONFIG.host}:${port}/`;
  const server = run([
    'exec',
    'vite',
    ...(preview ? ['preview'] : []),
    '--host',
    CONFIG.host,
    '--port',
    String(port),
    '--strictPort'
  ]);
  const cleanup = () => stopServer(server);
  process.once('exit', cleanup);
  process.once('SIGINT', () => {
    cleanup();
    process.exit(130);
  });
  process.once('SIGTERM', () => {
    cleanup();
    process.exit(143);
  });

  try {
    await waitForServer(url, server);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  console.log(`e2e:local: ${preview ? 'preview' : 'dev'} server ready at ${url}`);
  const tests = run(['exec', 'playwright', 'test', ...playwrightArgs], {
    ...process.env,
    PLAYWRIGHT_BASE_URL: url
  });
  tests.once('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
