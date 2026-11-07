#!/usr/bin/env node
/**
 * SRI Hash Generator
 * Generates SHA-384 integrity hashes for vendor files and optionally updates index.html
 *
 * Usage:
 *   node scripts/generate-sri.js          # Generate hashes only
 *   node scripts/generate-sri.js --check  # Verify existing hashes in index.html
 *   node scripts/generate-sri.js --update # Update index.html with new hashes
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX_HTML = path.join(ROOT, 'index.html');

const VENDOR_FILES = [
  'vendor/cropper/cropper.min.css',
  'vendor/fontawesome/css/all.css',
  'vendor/fonts.css',
  'vendor/tesseract/tesseract.min.js',
  'vendor/cropper/cropper.min.js',
  'vendor/tesseract/worker.min.js'
];

function generateSriHash(filePath) {
  const fullPath = resolveAssetPath(filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }
  const content = fs.readFileSync(fullPath);
  const hash = crypto.createHash('sha384').update(content).digest('base64');
  return `sha384-${hash}`;
}

function resolveAssetPath(filePath) {
  const directPath = path.join(ROOT, filePath);
  if (fs.existsSync(directPath)) {
    return directPath;
  }

  const publicPath = path.join(ROOT, 'public', filePath);
  if (fs.existsSync(publicPath)) {
    return publicPath;
  }

  return directPath;
}

function generateAllHashes() {
  const hashes = {};
  for (const file of VENDOR_FILES) {
    try {
      hashes[file] = generateSriHash(file);
    } catch (err) {
      console.error(`[ERROR] ${file}: ${err.message}`);
      process.exitCode = 1;
    }
  }
  return hashes;
}

function extractHashesFromHtml() {
  const html = fs.readFileSync(INDEX_HTML, 'utf-8');
  const hashes = {};

  const patterns = [
    /<link[^>]+href="\/([^"]+)"[^>]+integrity="([^"]+)"/g,
    /<script[^>]+src="\/([^"]+)"[^>]+integrity="([^"]+)"/g,
    /integrity="([^"]+)"[^>]+href="\/([^"]+)"/g,
    /integrity="([^"]+)"[^>]+src="\/([^"]+)"/g
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const [, first, second] = match;
      if (first.startsWith('sha')) {
        hashes[second] = first;
      } else {
        hashes[first] = second;
      }
    }
  }

  return hashes;
}

function checkHashes() {
  console.log('Checking SRI hashes in index.html...\n');
  const expected = generateAllHashes();
  const actual = extractHashesFromHtml();
  let allMatch = true;

  for (const [file, expectedHash] of Object.entries(expected)) {
    const actualHash = actual[file];
    if (!actualHash) {
      console.log(`[FAIL] ${file}: MISSING integrity attribute`);
      allMatch = false;
    } else if (actualHash !== expectedHash) {
      console.log(`[FAIL] ${file}: MISMATCH`);
      console.log(`   Expected: ${expectedHash}`);
      console.log(`   Actual:   ${actualHash}`);
      allMatch = false;
    } else {
      console.log(`[OK] ${file}: OK`);
    }
  }

  if (!allMatch) {
    console.log('\n[FAIL] SRI hash verification failed. Run with --update to fix.');
    process.exitCode = 1;
  } else {
    console.log('\n[PASS] All SRI hashes are correct.');
  }
}

function updateHtml() {
  console.log('Updating SRI hashes in index.html...\n');
  const hashes = generateAllHashes();
  let html = fs.readFileSync(INDEX_HTML, 'utf-8');

  for (const [file, hash] of Object.entries(hashes)) {
    const urlPath = `/${file}`;

    // Update link tags
    const linkRegex = new RegExp(
      `(<link[^>]+href="${urlPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*)integrity="[^"]*"`,
      'g'
    );
    html = html.replace(linkRegex, `$1integrity="${hash}"`);

    // Update script tags
    const scriptRegex = new RegExp(
      `(<script[^>]+src="${urlPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*)integrity="[^"]*"`,
      'g'
    );
    html = html.replace(scriptRegex, `$1integrity="${hash}"`);

    console.log(`Updated: ${file}`);
  }

  fs.writeFileSync(INDEX_HTML, html);
  console.log('\n[DONE] index.html updated with new SRI hashes.');
}

function printHashes() {
  console.log('SRI Hashes for vendor files:\n');
  const hashes = generateAllHashes();
  for (const [file, hash] of Object.entries(hashes)) {
    console.log(`${file}`);
    console.log(`  ${hash}\n`);
  }
}

// Main
const args = process.argv.slice(2);

if (args.includes('--check')) {
  checkHashes();
} else if (args.includes('--update')) {
  updateHtml();
} else {
  printHashes();
}
