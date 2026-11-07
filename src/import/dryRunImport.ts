/**
 * Dry-Run Import - Simulates import without persisting data
 * Provides detailed report of what would happen, including errors and warnings
 */

import * as z from 'zod';

import { escapeHtmlAttribute } from '@/utils/escapeHtmlAttribute';

export const DryRunIssueSchema = z.object({
  code: z.string().trim(),
  column: z.string().trim().optional(),
  message: z.string().trim(),
  row: z.int().optional(),
  suggestion: z.string().trim().optional(),
  type: z.enum(['error', 'warning', 'info']),
  value: z.string().trim().optional()
});

export type DryRunIssue = z.infer<typeof DryRunIssueSchema>;

export const DryRunReportSchema = z.object({
  columnCount: z.int().nonnegative(),
  detectedLanguage: z.string().trim().optional(),
  detectedType: z.enum(['attributes', 'statistics', 'complete', 'unknown']),
  duplicateCheck: z
    .object({
      existingFileName: z.string().trim().optional(),
      isDuplicate: z.boolean(),
      reason: z.string().trim().optional()
    })
    .optional(),
  estimatedProcessingTime: z.number().optional(),
  fileName: z.string().trim(),
  fileSize: z.int().nonnegative(),
  headers: z.array(z.string().trim()),
  issues: z.array(DryRunIssueSchema),
  mappedHeaders: z.record(z.string(), z.string().trim()).optional(),
  missingRequiredHeaders: z.array(z.string().trim()),
  rowCount: z.int().nonnegative(),
  sampleData: z.array(z.record(z.string(), z.unknown())).optional(),
  structureHash: z.string().trim().optional(),
  success: z.boolean(),
  timestamp: z.int().positive(),
  unmappedHeaders: z.array(z.string().trim()),
  wouldImport: z.boolean()
});

export interface DryRunOptions {
  checkDuplicates?: boolean;
  languageHint?: string;
  sampleSize?: number;
  validateValues?: boolean;
}

export type DryRunReport = z.infer<typeof DryRunReportSchema>;

const REQUIRED_HEADERS_ATTRIBUTES = ['Name'];
const REQUIRED_HEADERS_STATISTICS = ['Name'];
const KNOWN_ATTRIBUTE_HEADERS = [
  'Acc',
  'Wor',
  'Vis',
  'Tec',
  'Tea',
  'Str',
  'Sta',
  'TRO',
  'Ref',
  'Pun',
  'Pos',
  'Pen',
  'Pas',
  'Pac',
  'OtB',
  'Nat',
  'Mar',
  'L Th',
  'Lon',
  'Ldr',
  'Kic',
  'Jum',
  'Hea',
  'Han',
  'Fre',
  'Fla',
  'Fir',
  'Fin',
  'Ecc',
  'Dri',
  'Det',
  'Dec',
  'Cro',
  'Cor',
  'Con',
  'Cnt',
  'Cmd',
  'Com',
  'Cmp',
  'Bra',
  'Bal',
  'Ant',
  'Agi',
  'Agg',
  'Aer',
  '1v1'
];
const KNOWN_STATISTIC_HEADERS = [
  'Gls',
  'xG',
  'xA',
  'Ast',
  'Mins',
  'Apps',
  'PoM',
  'Av Rat',
  'Tck',
  'Int',
  'Hdr',
  'K Ps',
  'Cr C',
  'Ps C',
  'Drb',
  'Shot',
  'ShT',
  'CCC',
  'Svs',
  'Svp',
  'xSv',
  'Pens S',
  'Pens F'
];

export function formatDryRunReport(report: DryRunReport): string {
  const lines: string[] = [
    '=== DRY RUN IMPORT REPORT ===',
    '',
    `Plik: ${report.fileName} (${(report.fileSize / 1024).toFixed(1)} KB)`,
    `Typ: ${report.detectedType.toUpperCase()}`,
    `Wiersze: ${report.rowCount}`,
    `Kolumny: ${report.columnCount}`,
    `Hash struktury: ${report.structureHash}`,
    '',
    `Status: ${report.wouldImport ? '✓ GOTOWY DO IMPORTU' : '✗ BLOKADA IMPORTU'}`,
    ''
  ];

  if (report.issues.length > 0) {
    lines.push('--- PROBLEMY ---');
    const errors = report.issues.filter((i) => i.type === 'error');
    const warnings = report.issues.filter((i) => i.type === 'warning');
    const infos = report.issues.filter((i) => i.type === 'info');

    if (errors.length > 0) {
      lines.push(`\nBłędy (${errors.length}):`);
      errors.forEach((e) => lines.push(`  ✗ ${e.message}`));
    }
    if (warnings.length > 0) {
      lines.push(`\nOstrzeżenia (${warnings.length}):`);
      warnings.forEach((w) => lines.push(`  ! ${w.message}`));
    }
    if (infos.length > 0) {
      lines.push(`\nInformacje (${infos.length}):`);
      infos.forEach((i) => lines.push(`  ℹ ${i.message}`));
    }
  } else {
    lines.push('Brak problemów.');
  }

  lines.push('', `Szacowany czas przetwarzania: ${Math.round(report.estimatedProcessingTime)}ms`);

  return lines.join('\n');
}

export function renderDryRunReport(report: DryRunReport, container: HTMLElement): void {
  container.innerHTML = '';
  container.className = 'dry-run-report';
  container.dataset.wouldImport = String(report.wouldImport);

  const header = document.createElement('div');
  header.className = 'dry-run-header';
  header.innerHTML = `
    <span class="dry-run-icon">${report.wouldImport ? '✓' : '✗'}</span>
    <span class="dry-run-title">Dry Run: ${escapeHtmlAttribute(report.fileName)}</span>
  `;
  container.append(header);

  const stats = document.createElement('div');
  stats.className = 'dry-run-stats';
  stats.innerHTML = `
    <div><strong>Typ:</strong> ${report.detectedType}</div>
    <div><strong>Wiersze:</strong> ${report.rowCount}</div>
    <div><strong>Kolumny:</strong> ${report.columnCount}</div>
    <div><strong>Rozmiar:</strong> ${(report.fileSize / 1024).toFixed(1)} KB</div>
  `;
  container.append(stats);

  if (report.issues.length > 0) {
    const issuesList = document.createElement('ul');
    issuesList.className = 'dry-run-issues';

    for (const issue of report.issues) {
      const li = document.createElement('li');
      li.className = `dry-run-issue dry-run-issue--${issue.type}`;
      li.innerHTML = `
        <span class="issue-icon">${issue.type === 'error' ? '✗' : issue.type === 'warning' ? '!' : 'ℹ'}</span>
        <span class="issue-message">${escapeHtmlAttribute(issue.message)}</span>
      `;
      issuesList.append(li);
    }

    container.append(issuesList);
  }
}

export async function runDryImport(file: File, options: DryRunOptions = {}): Promise<DryRunReport> {
  const startTime = performance.now();
  const issues: DryRunIssue[] = [];

  // Read file content
  const content = await file.text();
  const fileSize = file.size;

  // Extract structure
  const headers = extractHeaders(content);
  const rowCount = countRows(content);

  if (headers.length === 0) {
    issues.push({
      code: 'NO_HEADERS',
      message: 'Nie znaleziono nagłówków tabeli',
      suggestion: 'Upewnij się, że plik zawiera tabelę HTML z <thead>',
      type: 'error'
    });
  }

  if (rowCount === 0) {
    issues.push({
      code: 'NO_DATA',
      message: 'Nie znaleziono danych w tabeli',
      suggestion: 'Upewnij się, że plik zawiera wiersze danych w <tbody>',
      type: 'error'
    });
  }

  // Detect file type
  const detectedType = detectFileType(headers);
  if (detectedType === 'unknown') {
    issues.push({
      code: 'UNKNOWN_FORMAT',
      message: 'Nie rozpoznano formatu pliku',
      suggestion:
        'Plik powinien zawierać kolumny atrybutowe (Acc, Wor, Vis...) lub statystyczne (Gls, xG, xA...)',
      type: 'warning'
    });
  }

  // Find unmapped and missing headers
  const unmappedHeaders = findUnmappedHeaders(headers);
  const missingRequiredHeaders = findMissingRequiredHeaders(headers, detectedType);

  if (missingRequiredHeaders.length > 0) {
    issues.push({
      code: 'MISSING_REQUIRED_HEADERS',
      message: `Brakuje wymaganych kolumn: ${missingRequiredHeaders.join(', ')}`,
      suggestion: 'Wyeksportuj plik ponownie z FM lub dodaj brakujące kolumny',
      type: 'error'
    });
  }

  if (unmappedHeaders.length > 0) {
    issues.push({
      code: 'UNMAPPED_HEADERS',
      message: `Nieznane kolumny (${unmappedHeaders.length}): ${unmappedHeaders.slice(0, 5).join(', ')}${unmappedHeaders.length > 5 ? '...' : ''}`,
      suggestion: 'Te kolumny zostaną zignorowane lub będą wymagać ręcznego mapowania',
      type: 'info'
    });
  }

  // Extract sample data
  const sampleSize = options.sampleSize ?? 5;
  const sampleData = extractSampleData(content, headers, sampleSize);

  // Validate sample values
  if (options.validateValues !== false && sampleData.length > 0) {
    const valueIssues = validateSampleValues(sampleData, headers);
    issues.push(...valueIssues);
  }

  // Compute structure hash
  const structureHash = computeSimpleHash(headers.sort().join('|'));

  // Check for duplicates
  let duplicateCheck: DryRunReport['duplicateCheck'];
  if (options.checkDuplicates) {
    // This would normally check against Dexie - simplified here
    duplicateCheck = {
      existingFileName: undefined,
      isDuplicate: false,
      reason: undefined
    };
  }

  // Estimate processing time (rough estimate based on file size and row count)
  const estimatedProcessingTime = Math.max(500, rowCount * 2 + fileSize / 1000);

  // Determine if import would succeed
  const hasErrors = issues.some((i) => i.type === 'error');
  const wouldImport = !hasErrors && headers.length > 0 && rowCount > 0;

  const report: DryRunReport = {
    columnCount: headers.length,
    detectedLanguage: options.languageHint,
    detectedType,
    duplicateCheck,
    estimatedProcessingTime,
    fileName: file.name,
    fileSize,
    headers,
    issues,
    missingRequiredHeaders,
    rowCount,
    sampleData,
    structureHash,
    success: true,
    timestamp: Date.now(),
    unmappedHeaders,
    wouldImport
  };

  return report;
}

function computeSimpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < Math.min(content.length, 10000); i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `hash-${Math.abs(hash).toString(16)}`;
}

function countRows(html: string): number {
  const tbodyMatch = /<tbody[^>]*>([\s\S]*?)<\/tbody>/i.exec(html);
  if (!tbodyMatch) return 0;

  const rowMatches = tbodyMatch[1].match(/<tr[^>]*>/gi);
  return rowMatches ? rowMatches.length : 0;
}

function detectFileType(headers: string[]): 'attributes' | 'complete' | 'statistics' | 'unknown' {
  const headerSet = new Set(headers.map((h) => h.toLowerCase()));

  const hasAttributes = KNOWN_ATTRIBUTE_HEADERS.some((h) => headerSet.has(h.toLowerCase()));
  const hasStatistics = KNOWN_STATISTIC_HEADERS.some((h) => headerSet.has(h.toLowerCase()));

  if (hasAttributes && hasStatistics) return 'complete';
  if (hasAttributes) return 'attributes';
  if (hasStatistics) return 'statistics';
  return 'unknown';
}

function extractHeaders(html: string): string[] {
  const headerMatch = /<thead[^>]*>([\s\S]*?)<\/thead>/i.exec(html);
  if (!headerMatch) return [];

  const thMatches = headerMatch[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi);
  const headers: string[] = [];

  for (const match of thMatches) {
    const text = match[1]
      .replaceAll(/<[^>]+>/g, '')
      .replaceAll('&nbsp;', ' ')
      .trim();
    headers.push(text);
  }

  return headers;
}

function extractSampleData(
  html: string,
  headers: string[],
  sampleSize: number
): Record<string, unknown>[] {
  const tbodyMatch = /<tbody[^>]*>([\s\S]*?)<\/tbody>/i.exec(html);
  if (!tbodyMatch) return [];

  const rowMatches = tbodyMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  const samples: Record<string, unknown>[] = [];

  for (const rowMatch of rowMatches) {
    if (samples.length >= sampleSize) break;

    const tdMatches = rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi);
    const row: Record<string, unknown> = {};
    let colIndex = 0;

    for (const tdMatch of tdMatches) {
      if (colIndex < headers.length) {
        const value = tdMatch[1]
          .replaceAll(/<[^>]+>/g, '')
          .replaceAll('&nbsp;', ' ')
          .trim();
        row[headers[colIndex]] = value;
      }
      colIndex++;
    }

    if (Object.keys(row).length > 0) {
      samples.push(row);
    }
  }

  return samples;
}

function findMissingRequiredHeaders(headers: string[], fileType: string): string[] {
  const headerSet = new Set(headers.map((h) => h.toLowerCase()));
  const required =
    fileType === 'statistics' ? REQUIRED_HEADERS_STATISTICS : REQUIRED_HEADERS_ATTRIBUTES;

  return required.filter((h) => !headerSet.has(h.toLowerCase()));
}

function findUnmappedHeaders(headers: string[]): string[] {
  const knownHeaders = new Set([
    ...KNOWN_ATTRIBUTE_HEADERS.map((h) => h.toLowerCase()),
    ...KNOWN_STATISTIC_HEADERS.map((h) => h.toLowerCase()),
    'age',
    'club',
    'foot',
    'height',
    'league',
    'name',
    'nat',
    'nationality',
    'position',
    'uid',
    'value',
    'wage',
    'weight'
  ]);

  return headers.filter((h) => !knownHeaders.has(h.toLowerCase()));
}

function validateSampleValues(
  samples: Record<string, unknown>[],
  headers: string[]
): DryRunIssue[] {
  const issues: DryRunIssue[] = [];

  samples.forEach((row, rowIndex) => {
    headers.forEach((header) => {
      const value = row[header];
      if (value === undefined || value === '') return;

      const strValue = String(value);

      // Check for common issues
      if (KNOWN_ATTRIBUTE_HEADERS.includes(header)) {
        // Attributes should be numbers 1-20
        const num = parseInt(strValue, 10);
        if (isNaN(num)) {
          issues.push({
            code: 'INVALID_ATTRIBUTE_VALUE',
            column: header,
            message: `Wartość atrybutu "${header}" nie jest liczbą`,
            row: rowIndex + 1,
            suggestion: 'Sprawdź czy format pliku jest poprawny',
            type: 'warning',
            value: strValue
          });
        } else if (num < 1 || num > 20) {
          issues.push({
            code: 'ATTRIBUTE_OUT_OF_RANGE',
            column: header,
            message: `Atrybut "${header}" poza standardowym zakresem 1-20`,
            row: rowIndex + 1,
            type: 'info',
            value: strValue
          });
        }
      }

      // Check for encoding issues
      if (strValue.includes('�')) {
        issues.push({
          code: 'ENCODING_ISSUE',
          column: header,
          message: `Znaki specjalne w "${header}" mogą być źle zakodowane`,
          row: rowIndex + 1,
          type: 'warning',
          value: strValue.slice(0, 50)
        });
      }
    });
  });

  return issues;
}

// Export to window
if (typeof window !== 'undefined') {
  (window as any).dryRunImport = {
    format: formatDryRunReport,
    render: renderDryRunReport,
    run: runDryImport
  };
}
