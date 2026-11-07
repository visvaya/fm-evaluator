// eslint.config.mjs – ESLint 9 Flat Config for fm-evaluator
// React-first TypeScript + Vite app with some legacy-compatible modules.

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import promisePlugin from 'eslint-plugin-promise';
import securityPlugin from 'eslint-plugin-security';
import perfectionist from 'eslint-plugin-perfectionist';
import checkFile from 'eslint-plugin-check-file';
import boundaries from 'eslint-plugin-boundaries';
import regexp from 'eslint-plugin-regexp';
import playwrightPlugin from 'eslint-plugin-playwright';
import importX from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import jsdoc from 'eslint-plugin-jsdoc';
import fp from 'eslint-plugin-fp';
import noOnlyTests from 'eslint-plugin-no-only-tests';
import vitestPlugin from '@vitest/eslint-plugin';
import betterTailwind from 'eslint-plugin-better-tailwindcss';
import zodPlugin from 'eslint-plugin-zod';
import htmlPlugin from '@html-eslint/eslint-plugin';
import htmlParser from '@html-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import i18next from 'eslint-plugin-i18next';
import { fixupPluginRules } from '@eslint/compat';
import { createRequire } from 'module';
import path from 'node:path';

const require = createRequire(import.meta.url);
// eslint-plugin-i18n-json uses deprecated ESLint 9 context.getFilename() –
// fixupPluginRules adds the legacy shim needed for ESLint 10 compatibility.
const i18nJson = fixupPluginRules(require('eslint-plugin-i18n-json'));
// eslint-plugin-jsx-a11y 6.10 declares peers only up to ESLint 9; the same
// compatibility shim keeps it working on ESLint 10.
const jsxA11y = fixupPluginRules(require('eslint-plugin-jsx-a11y'));
const jsxA11yRecommended = require('eslint-plugin-jsx-a11y').flatConfigs.recommended;

export default tseslint.config(
  // ─── 0. GLOBAL IGNORES ────────────────────────────────────────────────────
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'vendor/**',
      'public/vendor/**',
      // public/i18n/messages/*.json are linted separately via i18n-json (section 22)
      'public/i18n/!(messages)/**',
      'public/config/**',
      'fm-data/**',
      'reports/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'eslint.config.mjs',
      'commitlint.config.mjs',
      'scripts/**',
      'playwright.config.ts',
      // HTML linting disabled: @html-eslint/parser is incompatible with
      // @typescript-eslint rules that try to access type services even when off.
      // Re-enable once the two ecosystems are compatible.
      '*.html'
    ]
  },

  // ─── 1. LINTER OPTIONS ────────────────────────────────────────────────────
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error'
    }
  },

  // ─── 2. JS RECOMMENDED ────────────────────────────────────────────────────
  eslint.configs.recommended,

  // ─── 3–4. TYPESCRIPT (pragmatic – recommendedTypeChecked, not strict) ─────
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // ─── 5. LANGUAGE OPTIONS (browser globals + TS project service) ───────────
  {
    languageOptions: {
      globals: {
        ...globals.browser
      },
      parserOptions: {
        projectService: {
          // Allow linting of config files that are outside tsconfig includes
          allowDefaultProject: ['*.mjs', '*.cjs', 'knip.config.ts']
        },
        tsconfigRootDir: import.meta.dirname
      }
    }
  },

  // ─── 6. SONARJS ───────────────────────────────────────────────────────────
  sonarjs.configs.recommended,

  // ─── 7. UNICORN ───────────────────────────────────────────────────────────
  unicorn.configs['flat/recommended'],

  // ─── 8. PROMISE ───────────────────────────────────────────────────────────
  promisePlugin.configs['flat/recommended'],

  // ─── 9. SECURITY ──────────────────────────────────────────────────────────
  securityPlugin.configs.recommended,

  // ─── 10. PERFECTIONIST ────────────────────────────────────────────────────
  perfectionist.configs['recommended-natural'],

  // ─── 11. REGEXP ───────────────────────────────────────────────────────────
  regexp.configs['flat/recommended'],

  // ─── 12. IMPORT-X ─────────────────────────────────────────────────────────
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,

  // ─── 13. JSDOC ────────────────────────────────────────────────────────────
  jsdoc.configs['flat/recommended-typescript'],

  // ─── 14. MAIN RULES BLOCK ─────────────────────────────────────────────────
  {
    plugins: {
      'check-file': checkFile,
      boundaries,
      fp,
      'no-only-tests': noOnlyTests,
      'better-tailwindcss': betterTailwind
    },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
          project: './tsconfig.json'
        })
      ],
      'boundaries/elements': [
        { type: 'computing', pattern: 'computing/*' },
        { type: 'ui', pattern: 'ui/*' },
        { type: 'storage', pattern: 'storage/*' },
        { type: 'config', pattern: 'config/*' },
        { type: 'workers', pattern: 'workers/*' }
      ],
      'boundaries/ignore': ['**/*.test.ts'],
      'better-tailwindcss': {
        tailwindStylesheet: './tailwind.input.css'
      }
    },
    rules: {
      // ── Unicorn overrides ──────────────────────────────────────────────────
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/no-null': 'off',
      'unicorn/prefer-module': 'off',
      'unicorn/no-array-for-each': 'off',
      'unicorn/no-array-callback-reference': 'off',
      'unicorn/prefer-number-properties': 'off',
      'unicorn/numeric-separators-style': 'off',
      'unicorn/no-await-expression-member': 'off',
      'unicorn/text-encoding-identifier-case': 'off',
      // window.* still exists intentionally for selected compatibility bridges
      'unicorn/prefer-global-this': 'off',
      // Source files use a pragmatic mixed convention:
      // - PascalCase for React component files
      // - camelCase for regular modules
      // - worker files and declaration files remain exempted as needed
      'unicorn/filename-case': [
        'error',
        {
          cases: { camelCase: true, pascalCase: true },
          ignore: [
            /\.d\.ts$/,
            /\.worker\.ts$/,
            /service-worker/,
            /\.spec\.ts$/,
            /\.spec\.tsx$/,
            /\.test\.ts$/,
            /\.test\.tsx$/
          ]
        }
      ],

      // ── TypeScript overrides (pragmatic mode – upgrade to strict later) ────
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      // Dexie async safety – always await IndexedDB operations
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' }
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['UPPER_CASE', 'PascalCase'] },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          leadingUnderscore: 'allow'
        },
        { selector: 'variable', modifiers: ['destructured'], format: null },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        {
          selector: 'parameter',
          format: ['camelCase', 'PascalCase'],
          leadingUnderscore: 'allow'
        },
        { selector: 'import', format: null },
        { selector: 'objectLiteralProperty', format: null }
      ],

      // ── Security overrides ────────────────────────────────────────────────
      // obj[key] is a normal pattern in parsers and mappers – not an injection risk
      'security/detect-object-injection': 'off',
      // ReDoS is covered by regexp/no-super-linear-backtracking, which is more precise.
      'security/detect-unsafe-regex': 'off',

      // ── Rule diet (2026-09-28) ─────────────────────────────────────────────
      // Duplicates of stronger rules: each problem was reported two or three times.
      'sonarjs/no-unused-vars': 'off', // @typescript-eslint/no-unused-vars
      'sonarjs/slow-regex': 'off', // regexp/no-super-linear-backtracking
      'sonarjs/unused-import': 'off', // @typescript-eslint/no-unused-vars
      // tsc already checks argument types; this one misfires on generics.
      'sonarjs/argument-type': 'off',
      // Union return types are ordinary TypeScript, not a defect.
      'sonarjs/function-return-type': 'off',
      // Style rules whose autofix changes types or return values and broke typecheck.
      'unicorn/no-useless-undefined': 'off',
      'unicorn/prefer-dom-node-append': 'off',
      'unicorn/prefer-query-selector': 'off',

      // ── SonarJS overrides ──────────────────────────────────────────────────
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/max-lines-per-function': ['error', { maximum: 150 }],
      // Files longer than 800 lines should be split
      'sonarjs/max-lines': ['warn', { maximum: 800 }],

      // ── General best practices ─────────────────────────────────────────────
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-template': 'error',

      // ── Functional programming (warn – existing code may need migration) ───
      'fp/no-mutating-methods': 'warn',
      'fp/no-mutation': ['warn', { commonjs: false, allowThis: false, exceptions: [] }],
      'fp/no-let': 'warn',
      'fp/no-delete': 'warn',

      // ── Test isolation guard ───────────────────────────────────────────────
      'no-only-tests/no-only-tests': 'error',

      // ── JsDoc (relaxed – TS types already document the API) ───────────────
      // @public marks exports kept on purpose; knip skips them.
      'jsdoc/check-tag-names': ['warn', { definedTags: ['public'] }],
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-returns-description': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/require-param': 'off',

      // ── Import order and safety ────────────────────────────────────────────
      // Disable perfectionist's sort-imports in favor of import-x/order
      'perfectionist/sort-imports': 'off',
      'perfectionist/sort-jsx-props': 'off',
      'perfectionist/sort-modules': 'off',
      'perfectionist/sort-named-imports': 'off',
      'perfectionist/sort-objects': 'off',
      'import-x/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
            'type'
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true }
        }
      ],
      'import-x/no-cycle': ['error', { maxDepth: 5, ignoreExternal: true }],
      // Enforce explicit imports – no wildcard imports
      // Zod v4 documents `import * as z from 'zod'`; the autofix would emit `import { enum }`.
      'import-x/no-namespace': ['error', { ignore: ['zod'] }],
      'import-x/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            '**/*.test.ts',
            '**/*.spec.ts',
            '**/*.test.tsx',
            '**/*.spec.tsx',
            'vite.config.ts',
            'vite.shared.ts',
            'vitest.config.ts',
            'knip.config.ts',
            'eslint.config.mjs',
            'commitlint.config.mjs'
          ]
        }
      ],

      // Directory naming remains transitional in this repo.
      // Avoid introducing new inconsistent patterns, but do not force mass renames
      // while hybrid legacy structure still exists.

      // ── Architectural boundaries (warn – migration to modular TS in progress)
      'boundaries/element-types': [
        'warn',
        {
          default: 'allow',
          rules: [
            {
              from: 'computing',
              disallow: ['ui'],
              message: 'Computing modules must not import from the UI layer.'
            },
            {
              from: 'config',
              disallow: ['computing', 'ui', 'storage'],
              message: 'Config modules must not depend on project-specific layers.'
            }
          ]
        }
      ],

      // ── fm-evaluator project-specific rules ───────────────────────────────
      'no-restricted-syntax': [
        'warn',
        {
          // Data processing parses HTML with htmlparser2, never DOMParser
          selector: "NewExpression[callee.name='DOMParser']",
          message: 'Use htmlparser2 (streaming parser) instead of DOMParser.'
        },
        {
          // Functional over OOP: avoid classes, prefer pure functions
          selector: 'ClassDeclaration',
          message: 'Prefer pure functions over classes (functional over OOP).'
        },
        {
          selector:
            'Literal[value=/((unpkg\\.com)|(cdn\\.jsdelivr\\.net)|(cdnjs\\.cloudflare\\.com)|(fonts\\.googleapis\\.com)|(fonts\\.gstatic\\.com))/]',
          message:
            'External CDN reference detected. Self-host assets instead of using unpkg, jsDelivr, cdnjs or Google Fonts.'
        },
        {
          selector:
            'TemplateElement[value.raw=/((unpkg\\.com)|(cdn\\.jsdelivr\\.net)|(cdnjs\\.cloudflare\\.com)|(fonts\\.googleapis\\.com)|(fonts\\.gstatic\\.com))/]',
          message:
            'External CDN reference detected. Self-host assets instead of using unpkg, jsDelivr, cdnjs or Google Fonts.'
        }
      ]
    }
  },

  // ─── 15. VITEST (test files) ──────────────────────────────────────────────
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.tsx', '**/*.spec.tsx'],
    plugins: { vitest: vitestPlugin },
    rules: {
      ...vitestPlugin.configs.recommended.rules,
      'vitest/expect-expect': 'error',
      'vitest/no-disabled-tests': 'warn',
      'vitest/no-focused-tests': 'error',
      'vitest/valid-title': 'error',
      'vitest/consistent-test-it': ['error', { fn: 'it', withinDescribe: 'it' }],
      'vitest/no-duplicate-hooks': 'error',
      'vitest/prefer-to-be': 'error',
      'vitest/prefer-to-have-length': 'error',
      'vitest/no-conditional-expect': 'error',
      'vitest/no-import-node-test': 'error',
      // Relax strict rules for test files
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'sonarjs/max-lines-per-function': 'off',
      'sonarjs/max-lines': 'off',
      'fp/no-let': 'off',
      'fp/no-mutation': 'off',
      'fp/no-mutating-methods': 'off',
      // Class-based test patterns (e.g., mocks, stubs) are acceptable
      'no-restricted-syntax': 'off'
    }
  },

  // ─── 16. PLAYWRIGHT (e2e test files) ─────────────────────────────────────
  {
    files: ['e2e/**/*.ts'],
    plugins: { playwright: playwrightPlugin },
    rules: {
      ...playwrightPlugin.configs['flat/recommended'].rules,
      // Warn instead of error for scraper-common patterns
      'playwright/no-wait-for-timeout': 'warn',
      'playwright/no-networkidle': 'warn',
      'playwright/no-force-option': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      'fp/no-let': 'off',
      'fp/no-mutation': 'off',
      'fp/no-mutating-methods': 'off',
      'no-restricted-syntax': 'off'
    }
  },

  // ─── 16A. IMPERATIVE AND LEGACY LAYERS ────────────────────────────────────
  // fp/* stays enforced in the React/TS layers (features, store, computing, lib, schema,
  // hooks, components, workerBridge). The directories below are imperative DOM, parsing
  // and storage code slated for migration: rewriting their mutations adds no value and
  // buried every other finding under ~1000 warnings.
  {
    files: [
      'src/*.{ts,js}',
      'src/cache/**/*.{ts,js}',
      'src/config/**/*.{ts,js}',
      'src/data/**/*.{ts,js}',
      'src/export/**/*.{ts,js}',
      'src/i18n/**/*.{ts,js}',
      'src/import/**/*.{ts,js}',
      'src/mapping/**/*.{ts,js}',
      'src/ocr/**/*.{ts,js}',
      'src/parsing/**/*.{ts,js}',
      'src/processing/**/*.{ts,js}',
      'src/storage/**/*.{ts,js}',
      'src/telemetry/**/*.{ts,js}',
      'src/ui/**/*.{ts,js}',
      'src/utils/**/*.{ts,js}',
      'src/workers/**/*.{ts,js}'
    ],
    rules: {
      'fp/no-delete': 'off',
      'fp/no-let': 'off',
      'fp/no-mutating-methods': 'off',
      'fp/no-mutation': 'off'
    }
  },

  // ─── 16B. TRANSITIONAL COMPATIBILITY FILES ────────────────────────────────
  {
    files: [
      'src/App.tsx',
      'src/components/**/*.tsx',
      'src/hooks/**/*.tsx',
      'src/lib/importFlowBridge.ts',
      'src/lib/importStatusDom.ts',
      'src/components/CompatibilityHost.tsx',
      'src/data/handleFiles.ts',
      'src/lib/legacyBootstrap.ts',
      'src/lib/legacyRuntimeBridge.ts',
      'src/ui/languageModal.ts'
    ],
    rules: {
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/require-await': 'off',
      'fp/no-let': 'off',
      'fp/no-mutation': 'off',
      'fp/no-mutating-methods': 'off',
      'import-x/no-namespace': 'off',
      'import-x/no-named-as-default-member': 'off',
      'import-x/order': 'off',
      'no-async-promise-executor': 'off',
      'no-console': 'off',
      'perfectionist/sort-union-types': 'off',
      'promise/always-return': 'off',
      'sonarjs/cognitive-complexity': 'off',
      'sonarjs/max-lines-per-function': 'off',
      'sonarjs/no-nested-conditional': 'off',
      'sonarjs/no-nested-functions': 'off',
      'sonarjs/no-unused-collection': 'off',
      'sonarjs/prefer-read-only-props': 'off',
      'unicorn/no-array-sort': 'off',
      'unicorn/prefer-add-event-listener': 'off',
      'unicorn/prefer-blob-reading-methods': 'off'
    }
  },

  // ─── 17. LEGACY JS FILES – disable all type-aware rules ──────────────────
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.commonjs
      }
    },
    rules: {
      'sonarjs/max-lines-per-function': 'off',
      'fp/no-let': 'off',
      'fp/no-mutation': 'off'
    }
  },

  // ─── 18. WEB WORKER FILES – add worker globals ────────────────────────────
  {
    files: ['src/workers/*.ts', 'src/processing/*.worker.ts'],
    languageOptions: {
      globals: {
        self: 'readonly',
        postMessage: 'readonly',
        WorkerGlobalScope: 'readonly'
      }
    }
  },

  // ─── 19. SERVICE WORKER – SW globals + relaxed FP rules ──────────────────
  {
    files: ['public/service-worker.js'],
    languageOptions: {
      globals: {
        caches: 'readonly',
        clients: 'readonly',
        skipWaiting: 'readonly',
        registration: 'readonly'
      }
    },
    rules: {
      'fp/no-let': 'off',
      'fp/no-mutation': 'off',
      'fp/no-mutating-methods': 'off',
      'sonarjs/max-lines': 'off'
    }
  },

  // ─── 20. ZOD PLUGIN ───────────────────────────────────────────────────────
  {
    plugins: { zod: zodPlugin },
    rules: zodPlugin.configs?.recommended?.rules ?? {}
  },

  // ─── 21. HTML LINTING (index.html only – accessibility + security) ────────
  // Must: (1) disable all type-aware TS rules and (2) reset projectService
  // since @html-eslint/parser provides no TypeScript type information.
  {
    files: ['index.html'],
    extends: [tseslint.configs.disableTypeChecked],
    plugins: { '@html-eslint': htmlPlugin },
    languageOptions: {
      parser: htmlParser,
      parserOptions: { projectService: false }
    },
    rules: {
      ...htmlPlugin.configs['flat/recommended'].rules,
      '@html-eslint/no-script-style-type': 'error',
      '@html-eslint/require-closing-tags': 'error',
      '@html-eslint/no-duplicate-id': 'error',
      '@html-eslint/require-img-alt': 'warn',
      '@html-eslint/no-inline-styles': 'warn'
    }
  },

  // ─── 22. I18N JSON VALIDATION ─────────────────────────────────────────────
  // eslint-plugin-i18n-json uses a processor that converts JSON to a JS comment,
  // so no separate JSON parser is needed. TypeScript type-aware rules are disabled
  // since the virtual JS output has no type information.
  {
    files: ['public/i18n/messages/*.json'],
    extends: [tseslint.configs.disableTypeChecked],
    plugins: { 'i18n-json': i18nJson },
    processor: i18nJson.processors['.json'],
    languageOptions: { parserOptions: { projectService: false } },
    rules: {
      'i18n-json/valid-json': 'error',
      'i18n-json/sorted-keys': ['warn', { order: 'asc' }],
      'i18n-json/identical-keys': [
        'error',
        { filePath: path.resolve(import.meta.dirname, 'public/i18n/messages/en.json') }
      ]
    }
  },

  // ─── 23. REACT HOOKS ──────────────────────────────────────────────────────
  // Rules of Hooks plus the React Compiler checks (recommended-latest).
  // Warning-level rules are raised to errors so existing hits stay frozen in
  // eslint-suppressions.json instead of raising the warning limit.
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.flat['recommended-latest'].rules,
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/incompatible-library': 'error',
      'react-hooks/unsupported-syntax': 'error'
    }
  },

  // ─── 24. JSX ACCESSIBILITY ────────────────────────────────────────────────
  // jsx-a11y recommended on TSX; existing hits are frozen in the baseline.
  {
    files: ['src/**/*.tsx'],
    plugins: { 'jsx-a11y': jsxA11y },
    rules: { ...jsxA11yRecommended.rules }
  },

  // ─── 25. HARD-CODED UI STRINGS ────────────────────────────────────────────
  // UI text goes through i18n (public/i18n/messages). The rule checks JSX text
  // and the user-visible attributes below; existing hits are frozen.
  {
    files: ['src/**/*.tsx'],
    ignores: ['**/*.test.tsx', '**/*.spec.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          'jsx-attributes': { include: ['aria-label', 'title', 'placeholder', 'alt'] }
        }
      ]
    }
  },

  // ─── ALWAYS LAST – disable rules that conflict with Prettier ─────────────
  prettierConfig
);
