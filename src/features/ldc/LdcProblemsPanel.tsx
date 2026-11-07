import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { LdcIssue, LdcIssueGroup } from './ldcIssues';

interface LdcProblemsPanelProps {
  issueGroups: LdcIssueGroup[];
  onAlignRankToStars: () => void;
  onAlignStarsToRank: () => void;
  onFixIssue: (issue: LdcIssue) => void;
  onFocusIssue: (issue: LdcIssue) => void;
  onRepairTieringConflicts: () => void;
}

function formatProblemsCount(totalIssues: number) {
  if (totalIssues === 1) {
    return '1 problem';
  }

  return `${totalIssues} problemów`;
}

function getIssueActionLabel(issue: LdcIssue) {
  switch (issue.kind) {
    case 'configuration': {
      return '';
    }
    case 'consistency-conflict': {
      return 'Napraw spójność';
    }
    case 'duplicate-ldc': {
      return 'Rozbij konflikt';
    }
    case 'order-conflict': {
      return 'Napraw kolejność';
    }
    case 'tiering-conflict': {
      return 'Napraw tiering';
    }
    default: {
      return 'Napraw';
    }
  }
}

export function LdcProblemsPanel({
  issueGroups,
  onAlignRankToStars,
  onAlignStarsToRank,
  onFixIssue,
  onFocusIssue,
  onRepairTieringConflicts
}: Readonly<LdcProblemsPanelProps>) {
  const [isExpanded, setIsExpanded] = useState(false);
  const totalIssues = issueGroups.reduce((sum, group) => sum + group.issues.length, 0);
  const hasComputationalIssues = issueGroups.some((group) => group.id !== 'configuration');

  useEffect(() => {
    setIsExpanded(totalIssues > 0 && totalIssues <= 3);
  }, [totalIssues]);

  if (totalIssues === 0) {
    return null;
  }

  return (
    <div
      id="ldc-problems-section"
      className="rounded-xl border border-yellow-300/80 bg-yellow-50/70 p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-yellow-900">
            <AlertTriangle className="h-4 w-4" />
            <span>Wykryto {formatProblemsCount(totalIssues)} LDC</span>
          </div>
          <p className="text-xs text-yellow-800">
            Problemy konfiguracji, LDC_raw oraz niespójności rankingu i tieringu są zebrane w jednym
            miejscu.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {issueGroups.map((group) => (
              <span
                key={group.id}
                className="rounded-full border border-yellow-300 bg-background/80 px-2 py-0.5 text-[11px] font-medium text-yellow-900"
              >
                {group.issues.length} {group.label}
              </span>
            ))}
          </div>
        </div>
        <button
          id="ldc-problems-toggle"
          type="button"
          onClick={() => {
            setIsExpanded((current) => !current);
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-yellow-300 bg-background/70 px-2.5 py-1 text-xs font-medium text-yellow-900 transition hover:bg-background"
        >
          {isExpanded ? 'Ukryj szczegóły' : 'Pokaż szczegóły'}
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {hasComputationalIssues ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            id="ldc-align-stars-to-rank"
            type="button"
            onClick={onAlignStarsToRank}
            className="rounded-lg border border-border/40 bg-background px-2.5 py-1 text-xs font-medium text-text-primary transition hover:bg-surface"
          >
            Wyrównaj gwiazdki do rankingu
          </button>
          <button
            id="ldc-align-rank-to-stars"
            type="button"
            onClick={onAlignRankToStars}
            className="rounded-lg border border-border/40 bg-background px-2.5 py-1 text-xs font-medium text-text-primary transition hover:bg-surface"
          >
            Wyrównaj ranking do gwiazdek
          </button>
          <button
            id="ldc-repair-tiering"
            type="button"
            onClick={onRepairTieringConflicts}
            className="rounded-lg border border-border/40 bg-background px-2.5 py-1 text-xs font-medium text-text-primary transition hover:bg-surface"
          >
            Napraw niespójny tiering
          </button>
        </div>
      ) : null}

      {isExpanded ? (
        <div id="ldc-problems-list" className="mt-3 space-y-3">
          {issueGroups.map((group) => (
            <section
              key={group.id}
              className="space-y-2 rounded-xl border border-yellow-200 bg-background/65 p-3"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-yellow-900">
                {group.label}
              </div>
              <div className="space-y-2">
                {group.issues.map((issue) => (
                  <div
                    key={issue.id}
                    className="rounded-lg border border-yellow-200/80 bg-yellow-50/60 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-text-primary">{issue.title}</div>
                        <div className="text-xs text-text-secondary">{issue.summary}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {issue.affectedLeagueIds.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              onFocusIssue(issue);
                            }}
                            className="rounded-lg border border-border/40 bg-background px-2.5 py-1 text-xs font-medium text-text-primary transition hover:bg-surface"
                          >
                            Pokaż w tabeli
                          </button>
                        ) : null}
                        {issue.kind === 'configuration' ? null : (
                          <button
                            type="button"
                            onClick={() => {
                              onFixIssue(issue);
                            }}
                            className="rounded-lg border border-yellow-300 bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-900 transition hover:bg-yellow-200"
                          >
                            {getIssueActionLabel(issue)}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
