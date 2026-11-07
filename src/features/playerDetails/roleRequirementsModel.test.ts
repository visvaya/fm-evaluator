import { describe, expect, it } from 'vitest';

import { formatRoleRequirements } from './roleRequirementsModel';

describe('formatRoleRequirements', () => {
  it('uses explicit player filters when present', () => {
    const requirements = formatRoleRequirements({
      filters: [{ limit: 'min: 2.54', name: 'AER A/90', passed: true, skipped: false, val: '6.96' }]
    } as never);

    expect(requirements).toEqual([
      {
        chartValue: 6.96,
        label: 'AER A/90',
        limit: 'min: 2.54',
        passed: true,
        skipped: false,
        sourceKey: 'AER A/90',
        value: '6.96'
      }
    ]);
  });

  it('falls back to role filters when bestRole is available', () => {
    const requirements = formatRoleRequirements({
      bestRole: { role: 'MC/Whatever' },
      filters: []
    } as never);

    expect(requirements.length).toBeGreaterThan(0);
    expect(requirements[0]).toMatchObject({
      chartValue: null,
      passed: false,
      value: '–'
    });
  });
});
