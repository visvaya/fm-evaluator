// Test support for importPipeline.golden.test.ts: registers the legacy window.*
// parsing and mapping classes in the same order as src/lib/legacyBootstrap.ts,
// without the storage, worker and runtime-bridge side effects. Imported
// dynamically after vi.resetModules() so every golden case starts clean.
import '../config/languageConfigLoader.js';
import '../schema/schemaRegistry.js';
import '../mapping/contextResolver.js';
import '../mapping/smartHeaderMapper.js';

import '../parsing/formatInspector.js';
