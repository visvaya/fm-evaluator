import { ScoreCard } from './uiPrimitives';

export function PlayerDetailsScoreCards({
  attrScore,
  statScore,
  totalScore
}: {
  attrScore: number;
  statScore: number;
  totalScore: number;
}) {
  return (
    <div data-testid="player-details-score-cards" className="grid gap-4">
      <ScoreCard label="TOTAL" value={totalScore} accentClass="text-text-primary" />
      <ScoreCard label="STAT" value={statScore} accentClass="text-positive" />
      <ScoreCard label="ATTR" value={attrScore} accentClass="text-accent" />
    </div>
  );
}
