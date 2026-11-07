import { useState } from 'react';

import { copyTextToClipboard } from '@/lib/clipboard';
import { useTableStore } from '@/store/useTableStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';

import { AttributeAnalysisSection } from './AttributeAnalysisSection';
import { DataQualitySection } from './DataQualitySection';
import { MarketValueSection } from './MarketValueSection';
import { getPlayerDetailsModel } from './models';
import { PlayerDetailsHeader } from './PlayerDetailsHeader';
import { PlayerDetailsScoreCards } from './PlayerDetailsScoreCards';
import { RoleRequirementsSection } from './RoleRequirementsSection';
import { StatisticsAnalysisSection } from './StatisticsAnalysisSection';

export const PlayerDetails = () => {
  const [copied, setCopied] = useState(false);
  const { comparisonRuntime, currentPosition, data, selectedPlayerId, setSelectedPlayerId } =
    useTableStore();
  const { graphicsEnabled, restoreFocus } = useWorkspaceStore();
  const player = data.find((candidate) => candidate.uid === selectedPlayerId);

  if (!player || comparisonRuntime === null) {
    return null;
  }

  const model = getPlayerDetailsModel(player);

  const handleClose = () => {
    setSelectedPlayerId(null);
    window.setTimeout(() => restoreFocus(), 0);
  };

  const handleCopy = async () => {
    const success = await copyTextToClipboard(model.name);
    if (!success) {
      return;
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <aside
      data-testid="player-details-drawer"
      className="fixed inset-0 z-[70] overflow-auto bg-background/92 backdrop-blur xl:static xl:w-[min(44rem,44vw)] xl:min-w-[34rem] xl:border-l xl:border-border xl:bg-background/95"
    >
      <div className="flex min-h-full flex-col">
        <div className="flex-1 space-y-4 px-4 py-4 md:px-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(14rem,0.9fr)]">
            <div>
              <PlayerDetailsHeader
                copied={copied}
                graphicsEnabled={graphicsEnabled}
                model={model}
                onClose={handleClose}
                onCopy={() => {
                  void handleCopy();
                }}
              />
            </div>
            <PlayerDetailsScoreCards
              attrScore={model.attrScore}
              statScore={model.statScore}
              totalScore={model.totalScore}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <RoleRequirementsSection
              comparisonRuntime={comparisonRuntime}
              currentPosition={currentPosition}
              model={model}
              player={player}
            />
            <MarketValueSection ratioCards={model.ratioCards} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <AttributeAnalysisSection
              comparisonRuntime={comparisonRuntime}
              currentPosition={currentPosition}
              model={model}
              player={player}
            />
            <StatisticsAnalysisSection
              comparisonRuntime={comparisonRuntime}
              currentPosition={currentPosition}
              model={model}
              player={player}
            />
          </div>

          <DataQualitySection attrWarnings={model.attrWarnings} statWarnings={model.statWarnings} />
        </div>
      </div>
    </aside>
  );
};
