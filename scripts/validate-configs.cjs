#!/usr/bin/env node
/**
 * Configuration Validator
 * Validates all language config JSON files against Zod schema
 *
 * Usage:
 *   node scripts/validate-configs.cjs          # Validate all configs
 *   node scripts/validate-configs.cjs --check  # Exit with error code if invalid (for CI)
 */

const fs = require('fs');
const path = require('path');

const LANGUAGES_DIR = path.resolve(__dirname, '..', 'public', 'config', 'languages');
const SCHEMA_KEYS_FILE = path.resolve(__dirname, '..', 'src', 'schema', 'schemaRegistry.js');

const REQUIRED_FIELDS = ['id', 'headers'];

function extractSchemaIds() {
  const content = fs.readFileSync(SCHEMA_KEYS_FILE, 'utf-8');
  const ids = new Set();

  const matches = content.matchAll(/'([a-z_]+)':\s*\{/g);
  for (const match of matches) {
    if (
      match[1] &&
      (match[1].startsWith('basic_') ||
        match[1].startsWith('attribute_') ||
        match[1].startsWith('statistic_'))
    ) {
      ids.add(match[1]);
    }
  }

  return ids;
}

function validateLanguageConfig(filePath, schemaIds) {
  const fileName = path.basename(filePath);
  const errors = [];
  const warnings = [];

  let config;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    config = JSON.parse(content);
  } catch (err) {
    errors.push(`Failed to parse JSON: ${err.message}`);
    return { fileName, errors, warnings, valid: false };
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in config)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (typeof config.id !== 'string' || config.id.length === 0) {
    errors.push(`'id' must be a non-empty string`);
  }

  if (config.headers && typeof config.headers === 'object') {
    const headerIds = new Set(Object.keys(config.headers));

    for (const headerId of headerIds) {
      if (!schemaIds.has(headerId)) {
        warnings.push(`Orphan header: "${headerId}" not in SchemaRegistry`);
      }

      const translations = config.headers[headerId];
      if (!Array.isArray(translations)) {
        errors.push(`headers.${headerId} must be an array`);
      } else if (translations.length === 0) {
        warnings.push(`headers.${headerId} is empty`);
      } else {
        for (const translation of translations) {
          if (typeof translation !== 'string' || translation.length === 0) {
            errors.push(`headers.${headerId} contains invalid translation`);
          }
        }
      }
    }

    for (const schemaId of schemaIds) {
      if (!headerIds.has(schemaId)) {
        warnings.push(`Missing header for schema: "${schemaId}"`);
      }
    }
  } else {
    errors.push(`'headers' must be an object`);
  }

  if (config.multipliers !== undefined) {
    if (typeof config.multipliers !== 'object') {
      errors.push(`'multipliers' must be an object`);
    } else {
      for (const [key, value] of Object.entries(config.multipliers)) {
        if (typeof value !== 'number') {
          errors.push(`multipliers.${key} must be a number`);
        }
      }
    }
  }

  if (config.valueTranslations !== undefined) {
    if (typeof config.valueTranslations !== 'object') {
      errors.push(`'valueTranslations' must be an object`);
    } else {
      for (const [category, translations] of Object.entries(config.valueTranslations)) {
        if (typeof translations !== 'object') {
          errors.push(`valueTranslations.${category} must be an object`);
        }
      }
    }
  }

  return {
    fileName,
    errors,
    warnings,
    valid: errors.length === 0
  };
}

function main() {
  const args = process.argv.slice(2);
  const checkMode = args.includes('--check');
  const verbose = args.includes('--verbose') || args.includes('-v');

  console.log('Validating language configuration files...\n');

  const schemaIds = extractSchemaIds();
  console.log(`Found ${schemaIds.size} schema IDs in SchemaRegistry\n`);

  const files = fs
    .readdirSync(LANGUAGES_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'template.json' && f !== 'index.json');

  let totalErrors = 0;
  let totalWarnings = 0;
  const results = [];

  for (const file of files) {
    const filePath = path.join(LANGUAGES_DIR, file);
    const result = validateLanguageConfig(filePath, schemaIds);
    results.push(result);
    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;
  }

  for (const result of results) {
    const status = result.valid ? '[OK]' : '[FAIL]';
    const warningStatus =
      result.warnings.length > 0 ? ` [WARN] ${result.warnings.length} warnings` : '';
    console.log(`${status} ${result.fileName}${warningStatus}`);

    if (result.errors.length > 0) {
      result.errors.forEach((err) => console.log(`   [FAIL] ${err}`));
    }

    if (verbose && result.warnings.length > 0) {
      result.warnings.forEach((warn) => console.log(`   [WARN] ${warn}`));
    }
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Total: ${files.length} files, ${totalErrors} errors, ${totalWarnings} warnings`);

  if (totalErrors > 0) {
    console.log('\n[FAIL] Some configs have validation errors.');
    if (checkMode) {
      process.exitCode = 1;
    }
  } else {
    console.log('\n[PASS] All configs are valid.');
  }
}

main();
