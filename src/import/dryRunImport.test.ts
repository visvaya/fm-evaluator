// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import {
  type DryRunIssue,
  DryRunIssueSchema,
  type DryRunReport,
  DryRunReportSchema,
  formatDryRunReport,
  renderDryRunReport,
  runDryImport
} from './dryRunImport';

/**
 * We test the pure/synchronous functions exported by dryRunImport.
 * runDryImport requires a real File object + async, better covered by E2E.
 * The internal helpers (extractHeaders, countRows, detectFileType, etc.)
 * are not directly exported, so we test them indirectly via formatDryRunReport
 * and by testing the Zod schemas.
 */

function makeReport(overrides: Partial<DryRunReport> = {}): DryRunReport {
  return {
    columnCount: 40,
    detectedType: 'attributes',
    fileName: 'test-squad.html',
    fileSize: 51200,
    headers: ['Name', 'Club', 'Acc', 'Wor'],
    issues: [],
    missingRequiredHeaders: [],
    rowCount: 25,
    success: true,
    timestamp: Date.now(),
    unmappedHeaders: [],
    wouldImport: true,
    ...overrides
  };
}

describe('DryRunIssueSchema', () => {
  it('should validate a correct issue', () => {
    const issue: DryRunIssue = {
      code: 'NO_HEADERS',
      message: 'No headers found',
      type: 'error'
    };
    expect(DryRunIssueSchema.safeParse(issue).success).toBe(true);
  });

  it('should validate issue with optional fields', () => {
    const issue: DryRunIssue = {
      code: 'INVALID_ATTRIBUTE_VALUE',
      column: 'Acc',
      message: 'Bad value',
      row: 5,
      suggestion: 'Check format',
      type: 'warning',
      value: 'abc'
    };
    expect(DryRunIssueSchema.safeParse(issue).success).toBe(true);
  });

  it('should reject invalid type', () => {
    const result = DryRunIssueSchema.safeParse({
      code: 'X',
      message: 'test',
      type: 'critical'
    });
    expect(result.success).toBe(false);
  });
});

describe('DryRunReportSchema', () => {
  it('should validate a complete report', () => {
    const report = makeReport();
    expect(DryRunReportSchema.safeParse(report).success).toBe(true);
  });

  it('should validate report with issues', () => {
    const report = makeReport({
      issues: [{ code: 'NO_HEADERS', message: 'No headers', type: 'error' }],
      wouldImport: false
    });
    expect(DryRunReportSchema.safeParse(report).success).toBe(true);
  });

  it('should reject report missing required fields', () => {
    const result = DryRunReportSchema.safeParse({ success: true });
    expect(result.success).toBe(false);
  });
});

describe('formatDryRunReport', () => {
  it('should include file name', () => {
    const output = formatDryRunReport(makeReport());
    expect(output).toContain('test-squad.html');
  });

  it('should include file size in KB', () => {
    const output = formatDryRunReport(makeReport({ fileSize: 102400 }));
    expect(output).toContain('100.0 KB');
  });

  it('should include row and column count', () => {
    const output = formatDryRunReport(makeReport());
    expect(output).toContain('25');
    expect(output).toContain('40');
  });

  it('should show GOTOWY DO IMPORTU for successful report', () => {
    const output = formatDryRunReport(makeReport({ wouldImport: true }));
    expect(output).toContain('GOTOWY DO IMPORTU');
  });

  it('should show BLOKADA IMPORTU for failed report', () => {
    const output = formatDryRunReport(makeReport({ wouldImport: false }));
    expect(output).toContain('BLOKADA IMPORTU');
  });

  it('should show no problems text when issues empty', () => {
    const output = formatDryRunReport(makeReport({ issues: [] }));
    expect(output).toContain('Brak problemów');
  });

  it('should list errors', () => {
    const output = formatDryRunReport(
      makeReport({
        issues: [{ code: 'NO_HEADERS', message: 'Nie znaleziono nagłówków', type: 'error' }]
      })
    );
    expect(output).toContain('Błędy (1)');
    expect(output).toContain('Nie znaleziono nagłówków');
  });

  it('should list warnings', () => {
    const output = formatDryRunReport(
      makeReport({
        issues: [{ code: 'W1', message: 'Some warning', type: 'warning' }]
      })
    );
    expect(output).toContain('Ostrzeżenia (1)');
  });

  it('should list info items', () => {
    const output = formatDryRunReport(
      makeReport({
        issues: [{ code: 'I1', message: 'Some info', type: 'info' }]
      })
    );
    expect(output).toContain('Informacje (1)');
  });

  it('should include estimated processing time', () => {
    const output = formatDryRunReport(makeReport({ estimatedProcessingTime: 1234 }));
    expect(output).toContain('1234ms');
  });

  it('should show detected type in uppercase', () => {
    const output = formatDryRunReport(makeReport({ detectedType: 'statistics' }));
    expect(output).toContain('STATISTICS');
  });

  it('should categorize mixed issues correctly', () => {
    const output = formatDryRunReport(
      makeReport({
        issues: [
          { code: 'E1', message: 'err', type: 'error' },
          { code: 'W1', message: 'warn', type: 'warning' },
          { code: 'I1', message: 'info', type: 'info' }
        ]
      })
    );
    expect(output).toContain('Błędy (1)');
    expect(output).toContain('Ostrzeżenia (1)');
    expect(output).toContain('Informacje (1)');
  });
});

describe('renderDryRunReport', () => {
  it('renders the file name and issues as text, not markup', () => {
    const hostile = '<img src=x data-injected="1">';
    const container = document.createElement('div');

    renderDryRunReport(
      makeReport({
        fileName: hostile,
        issues: [{ code: 'E1', message: hostile, type: 'error' }]
      }),
      container
    );

    expect(container.querySelector('[data-injected]')).toBeNull();
    expect(container.textContent).toContain(`Dry Run: ${hostile}`);
    expect(container.querySelector('.issue-message')?.textContent).toBe(hostile);
  });
});

describe('runDryImport', () => {
  it('reports headers in file order', async () => {
    const html =
      '<table><thead><tr><th>Name</th><th>Club</th><th>Acc</th></tr></thead>' +
      '<tbody><tr><td>A</td><td>B</td><td>10</td></tr></tbody></table>';
    const report = await runDryImport(new File([html], 'squad.html'));

    expect(report.headers).toEqual(['Name', 'Club', 'Acc']);
  });
});
