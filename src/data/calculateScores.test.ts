import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock heavy dependencies ───────────────────────────────────────────────────

vi.mock('../computing/ldc', () => ({
  applyLDCToStats: vi.fn(),
  restoreOriginalStats: vi.fn()
}));

vi.mock('../config/scoreConfig', () => ({
  ATTRIBUTE_COEFFS: { FM: { GK: { Ref: 1 } } },
  POSITION_FILTERS: { GK: {} },
  STATS_CONFIG: { GK: [] }
}));

vi.mock('../config/settings', () => ({
  appSettings: {
    minMins: 0,
    adaptiveMinMins: 0,
    percentile: 50,
    normalizeAttr: false,
    normalizeStat: false,
    normalizeTotal: false
  }
}));

vi.mock('./bestRoleSelection', () => ({
  buildPlayerBestRoleDetails: vi.fn(() => ({})),
  inferMostCommonPrimaryRole: vi.fn(() => 'GK'),
  normalizeRoleScoresMap: vi.fn()
}));

vi.mock('./calculateMarketEfficiency', () => ({
  calculateMarketEfficiency: vi.fn(() => new Map())
}));

vi.mock('./computeAttributeScore', () => ({
  computeAttributeScore: vi.fn(() => ({
    aD: {},
    aScore: 10,
    missingAttrCount: 0,
    rangeAttrCount: 0,
    totalAttrWeight: 1
  }))
}));

vi.mock('./computeStatScore', () => ({
  computeStatScore: vi.fn(() => ({
    sD: {},
    sScore: 10,
    missingStatCount: 0,
    rangeStatCount: 0,
    totalStatWeight: 1
  }))
}));

vi.mock('./roleDistributions', () => ({
  ensureRoleDistributions: vi.fn(() => ({ statDist: {} }))
}));

vi.mock('./scorePostProcessing', () => ({
  buildCalculatedScoreEntry: vi.fn((params) => ({
    name: params.name,
    attrScore: params.attrScore,
    statScore: params.statScore,
    isLow: params.isLow,
    hasManyMissing: false,
    dataCategory: 'Pełne dane',
    totalScore: params.attrScore + params.statScore
  })),
  applyBestRoleViewScores: vi.fn(),
  applySelectedRoleBestScores: vi.fn()
}));

// ── Import SUT and mocked modules after mocks ─────────────────────────────────

import { applyLDCToStats, restoreOriginalStats } from '../computing/ldc';

import { calculateMarketEfficiency } from './calculateMarketEfficiency';
import { calculateScoresData } from './calculateScores';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeParams(overrides: Partial<Parameters<typeof calculateScoresData>[0]> = {}) {
  return {
    engine: 'FM',
    position: 'GK',
    mergedData: [],
    cleanValue: (v: unknown) => (typeof v === 'number' ? v : null),
    deriveStats: vi.fn(),
    calculateScoresForAllRoles: vi.fn(() => ({})),
    filterDistributionCache: new Map(),
    statDistributionCache: new Map(),
    isFirstCalculation: false,
    ...overrides
  };
}

function makePlayer(name: string, mins = 500) {
  return { Name: name, Mins: mins };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('calculateScoresData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── guard: empty position ─────────────────────────────────────────────────

  it('returns empty calculatedScores for empty position', () => {
    const { calculatedScores } = calculateScoresData(makeParams({ position: '' }));
    expect(calculatedScores).toHaveLength(0);
  });

  it('preserves isFirstCalculation when position is empty', () => {
    const { isFirstCalculation } = calculateScoresData(
      makeParams({ position: '', isFirstCalculation: true })
    );
    expect(isFirstCalculation).toBe(true);
  });

  // ── isFirstCalculation flip ───────────────────────────────────────────────

  it('flips isFirstCalculation to false after first run with players', () => {
    const { isFirstCalculation } = calculateScoresData(
      makeParams({
        isFirstCalculation: true,
        mergedData: [makePlayer('A', 1000)],
        cleanValue: (v: unknown) => (typeof v === 'number' ? v : null)
      })
    );
    expect(isFirstCalculation).toBe(false);
  });

  it('does not flip isFirstCalculation when mergedData is empty', () => {
    const { isFirstCalculation } = calculateScoresData(
      makeParams({ isFirstCalculation: true, mergedData: [] })
    );
    // No players with Mins > 0, so adaptive threshold branch is skipped
    expect(isFirstCalculation).toBe(false);
  });

  // ── output shape ──────────────────────────────────────────────────────────

  it('returns one entry per player', () => {
    const { calculatedScores } = calculateScoresData(
      makeParams({ mergedData: [makePlayer('A'), makePlayer('B'), makePlayer('C')] })
    );
    expect(calculatedScores).toHaveLength(3);
  });

  it('calls deriveStats once per player', () => {
    const deriveStats = vi.fn();
    calculateScoresData(
      makeParams({ mergedData: [makePlayer('A'), makePlayer('B')], deriveStats })
    );
    expect(deriveStats).toHaveBeenCalledTimes(2);
  });

  it('restores original stats before deriving and applying LDC for each player', () => {
    const calls: string[] = [];
    vi.mocked(restoreOriginalStats).mockImplementation(() => calls.push('restore'));
    vi.mocked(applyLDCToStats).mockImplementation(() => calls.push('apply'));
    const deriveStats = vi.fn(() => calls.push('derive'));

    calculateScoresData(
      makeParams({ mergedData: [makePlayer('A'), makePlayer('B')], deriveStats })
    );

    expect(calls).toEqual(['restore', 'derive', 'apply', 'restore', 'derive', 'apply']);
  });

  // ── suggestion logic (percentile-based) ──────────────────────────────────

  it('assigns suggestion field to every player', () => {
    const { calculatedScores } = calculateScoresData(
      makeParams({ mergedData: [makePlayer('A'), makePlayer('B')] })
    );
    for (const p of calculatedScores) {
      expect(['Kup', 'Scoutuj', 'Śledź', 'Pomiń']).toContain(p.suggestion);
    }
  });

  it('assigns Kup when both attrScore and statScore are above percentile', () => {
    // computeAttributeScore → attrScore 10, computeStatScore → statScore 10
    // All players equal → 50th percentile = first element → threshold = 10
    // 10 >= 10 and 10 >= 10 → Kup
    const { calculatedScores } = calculateScoresData(makeParams({ mergedData: [makePlayer('A')] }));
    expect(calculatedScores[0].suggestion).toBe('Kup');
  });

  // ── valueRating thresholds ────────────────────────────────────────────────

  it('assigns null valueRating when scorePerValue is null', () => {
    // calculateMarketEfficiency returns empty Map → scorePerValue = null
    const { calculatedScores } = calculateScoresData(makeParams({ mergedData: [makePlayer('A')] }));
    expect(calculatedScores[0].valueRating).toBeNull();
  });

  it('assigns null wageRating when scorePerWage is null', () => {
    const { calculatedScores } = calculateScoresData(makeParams({ mergedData: [makePlayer('A')] }));
    expect(calculatedScores[0].wageRating).toBeNull();
  });

  // ── scorePerValue/Wage rating boundaries (direct unit tests on logic) ─────

  it.each([
    [1.5, 'niedoceniony'],
    [2, 'niedoceniony'],
    [1, 'fair'],
    [0.61, 'fair'],
    [0.6, 'przeceniony'],
    [0.1, 'przeceniony']
  ])('scorePerValue %f → valueRating "%s"', (ratio, expected) => {
    vi.mocked(calculateMarketEfficiency).mockReturnValueOnce(
      new Map([[0, { expected: 1_000_000, ratio }]])
    );
    const { calculatedScores } = calculateScoresData(makeParams({ mergedData: [makePlayer('A')] }));
    expect(calculatedScores[0].valueRating).toBe(expected);
  });

  // ── BEST position ─────────────────────────────────────────────────────────

  it('calls calculateScoresForAllRoles once for BEST position', () => {
    const calculateScoresForAllRoles = vi.fn(() => ({}));
    calculateScoresData(
      makeParams({ position: 'BEST', calculateScoresForAllRoles, mergedData: [makePlayer('A')] })
    );
    // Called once for BEST branch, not the non-BEST branch
    expect(calculateScoresForAllRoles).toHaveBeenCalledTimes(1);
  });

  it('calls calculateScoresForAllRoles once for non-BEST position', () => {
    const calculateScoresForAllRoles = vi.fn(() => ({}));
    calculateScoresData(
      makeParams({ position: 'GK', calculateScoresForAllRoles, mergedData: [makePlayer('A')] })
    );
    expect(calculateScoresForAllRoles).toHaveBeenCalledTimes(1);
  });
});
