import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  // index.html (src/main.tsx) is picked up by the Vite plugin; vite.shared.ts is imported
  // by both Vite configs, which knip does not follow on its own.
  entry: ['src/workers/*.worker.ts', 'vite.shared.ts'],
  ignoreDependencies: [
    // Planned streaming HTML parser; the lint rule against DOMParser points to it.
    'htmlparser2',
    // Source of the self-hosted OCR bundle copied into public/vendor/tesseract.
    'tesseract.js',
    'tesseract.js-core'
  ],
  ignoreExportsUsedInFile: true,
  ignore: [
    // Detached React controls kept for the redesign; not wired into the shell yet.
    'src/components/TableControls.tsx'
  ],
  // Node tooling in scripts/ is reached through package.json scripts.
  project: ['src/**/*.{ts,tsx,js,css}', 'scripts/**/*.mjs']
};

export default config;
