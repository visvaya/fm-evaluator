import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import { defineConfig, mergeConfig } from 'vite';

import { buildPrecacheManifest, injectPrecacheManifest } from './scripts/lib/sw-precache.mjs';
import { createSharedViteConfig } from './vite.shared';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const SECURITY_HEADERS = JSON.parse(
  fs.readFileSync(path.resolve(currentDirectory, 'security_headers.json'), 'utf-8')
) as Record<string, string>;

// Dev-server-only relaxation of the strict CSP from security_headers.json (ADR-004).
// Vite serve injects inline scripts (React refresh preamble), inline <style> tags for
// CSS modules and HMR, and talks to the HMR websocket. Preview and production never
// get these allowances: they send security_headers.json unchanged.
const DEV_CSP_RELAXATIONS: Record<string, string> = {
  'connect-src': 'ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:*',
  'script-src': "'unsafe-inline'",
  'style-src': "'unsafe-inline'"
};

function relaxCspForDevServer(policy: string): string {
  return policy
    .split(';')
    .map((directive) => directive.trim())
    .filter((directive) => directive.length > 0)
    .map((directive) => {
      const name = directive.split(/\s+/)[0];
      const extra = DEV_CSP_RELAXATIONS[name];
      return extra ? `${directive} ${extra}` : directive;
    })
    .join('; ');
}

const DEV_SERVER_HEADERS: Record<string, string> = {
  ...SECURITY_HEADERS,
  'Content-Security-Policy': relaxCspForDevServer(SECURITY_HEADERS['Content-Security-Policy'])
};

function removeAttributeFromHtmlTag(html: string, attributeName: string) {
  const attributePrefix = ` ${attributeName}="`;
  const attributeIndex = html.indexOf(attributePrefix);

  if (attributeIndex === -1) {
    return html;
  }

  const valueStart = attributeIndex + attributePrefix.length;
  const valueEnd = html.indexOf('"', valueStart);

  if (valueEnd === -1) {
    return html;
  }

  return removeAttributeFromHtmlTag(
    html.slice(0, attributeIndex) + html.slice(valueEnd + 1),
    attributeName
  );
}

function stripSriInDevPlugin() {
  return {
    apply: 'serve',
    name: 'fm-strip-sri-in-dev',
    transformIndexHtml(html: string) {
      // Keep SRI in the source file for production & validation,
      // but strip it from the dev-served HTML to avoid mismatches caused by dev serving.
      return removeAttributeFromHtmlTag(
        removeAttributeFromHtmlTag(html, 'integrity'),
        'crossorigin'
      );
    }
  } as const;
}

function listFiles(directory: string, prefix = ''): string[] {
  // Build-time walk of dist/; paths come from the build output, not from user input.
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? listFiles(path.join(directory, entry.name), relative) : [relative];
  });
}

function serviceWorkerPrecachePlugin() {
  return {
    apply: 'build',
    name: 'fm-sw-precache',
    closeBundle() {
      // Runs after Vite has written assets/ and copied public/, so dist/ is final.
      const distDirectory = path.resolve(currentDirectory, 'dist');
      const files = listFiles(distDirectory).map((file) => ({
        content: fs.readFileSync(path.join(distDirectory, file)),
        path: file
      }));
      const serviceWorkerPath = path.join(distDirectory, 'service-worker.js');
      const source = fs.readFileSync(serviceWorkerPath, 'utf-8');
      const output = injectPrecacheManifest(source, buildPrecacheManifest(files));
      fs.writeFileSync(serviceWorkerPath, output);
    }
  } as const;
}

export default defineConfig(
  mergeConfig(createSharedViteConfig(), {
    build: {
      emptyOutDir: true,
      outDir: 'dist',
      rollupOptions: {
        input: path.resolve(currentDirectory, 'index.html')
      },
      target: 'es2020'
    },
    plugins: [tailwindcss(), stripSriInDevPlugin(), serviceWorkerPrecachePlugin()],
    preview: {
      headers: SECURITY_HEADERS
    },
    root: '.',
    server: {
      headers: DEV_SERVER_HEADERS
    }
  })
);
