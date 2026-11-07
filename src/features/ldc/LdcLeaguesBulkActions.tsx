interface LdcLeaguesBulkActionsProps {
  onBulkChangeRank: () => void;
  onBulkChangeStars: () => void;
  onBulkDelete: () => void;
  onBulkMoveDown: () => void;
  onBulkMoveUp: () => void;
  selectedCount: number;
}

export function LdcLeaguesBulkActions({
  onBulkChangeRank,
  onBulkChangeStars,
  onBulkDelete,
  onBulkMoveDown,
  onBulkMoveUp,
  selectedCount
}: Readonly<LdcLeaguesBulkActionsProps>) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border px-3 py-2">
      <span id="ldc-selected-leagues-count" className="mr-1 text-xs text-text-muted">
        {selectedCount} zaznaczonych
      </span>
      <button
        id="ldc-bulk-delete"
        type="button"
        onClick={onBulkDelete}
        className="rounded-xl border border-border px-2.5 py-1 text-xs font-semibold text-negative transition hover:bg-negative/10"
      >
        Usuń zaznaczone
      </button>
      <button
        id="ldc-bulk-change-stars"
        type="button"
        onClick={onBulkChangeStars}
        className="rounded-xl border border-border px-2.5 py-1 text-xs font-medium text-text-secondary transition hover:bg-surface"
      >
        Zmień gwiazdki
      </button>
      <button
        id="ldc-bulk-change-rank"
        type="button"
        onClick={onBulkChangeRank}
        className="rounded-xl border border-border px-2.5 py-1 text-xs font-medium text-text-secondary transition hover:bg-surface"
      >
        Zmień rank
      </button>
      <button
        id="ldc-bulk-move-up"
        type="button"
        onClick={onBulkMoveUp}
        className="rounded-xl border border-border px-2.5 py-1 text-xs font-medium text-text-secondary transition hover:bg-surface"
      >
        ↑ Przenieś w górę
      </button>
      <button
        id="ldc-bulk-move-down"
        type="button"
        onClick={onBulkMoveDown}
        className="rounded-xl border border-border px-2.5 py-1 text-xs font-medium text-text-secondary transition hover:bg-surface"
      >
        ↓ Przenieś w dół
      </button>
    </div>
  );
}
