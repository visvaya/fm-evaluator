export interface PlayerMetricBreakdownRow {
  chartValue: null | number;
  isLow?: boolean;
  isMissing?: boolean;
  isRange?: boolean;
  label: string;
  percentile: null | number;
  rawValue: string;
  score: null | number;
  sourceKey: string;
  weight: string;
}

export interface PlayerRatioCardModel {
  badgeText: null | string;
  helper: string;
  label: string;
  tone: 'negative' | 'neutral' | 'positive' | 'warning';
  value: string;
}

export interface RoleRequirementItem {
  chartValue: null | number;
  label: string;
  limit: string;
  passed: boolean;
  skipped?: boolean;
  sourceKey: string;
  value: string;
}

export interface PlayerDetailsModel {
  age: string;
  attrRows: PlayerMetricBreakdownRow[];
  attrScore: number;
  attrWarnings: string[];
  bestRoleSummary: string[];
  club: string;
  footSummary: string;
  graphicsLabel: string;
  league: string;
  mins: string;
  name: string;
  positionSummary: string;
  ratioCards: PlayerRatioCardModel[];
  roleRequirements: RoleRequirementItem[];
  secondaryPositionSummary: null | string;
  statRows: PlayerMetricBreakdownRow[];
  statScore: number;
  statWarnings: string[];
  suggestion: string;
  totalScore: number;
  uid: string;
  value: string;
  wage: string;
}
