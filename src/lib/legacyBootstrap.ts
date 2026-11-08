import '../config/languageConfigLoader.js';
import '../schema/schemaRegistry.js';
import '../mapping/contextResolver.js';
import '../mapping/smartHeaderMapper.js';
import '../parsing/formatInspector.js';
import '../parsing/workerParser';
import '../storage/db';
import '../storage/state';
import { processor } from '../data/dataProcessor';

import { initializeLegacyRuntimeBridge } from './legacyRuntimeBridge';

let bootstrapPromise: null | Promise<void> = null;

export function initializeLegacyBootstrap(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      if (typeof (processor as any)._initNewSystem === 'function') {
        (processor as any)._initNewSystem();
      }

      await initializeLegacyRuntimeBridge();
    })();
  }

  return bootstrapPromise;
}
