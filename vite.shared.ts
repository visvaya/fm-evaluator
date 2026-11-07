import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';

import type { UserConfig } from 'vite';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export function createSharedViteConfig(): UserConfig {
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(currentDirectory, 'src')
      }
    }
  };
}
