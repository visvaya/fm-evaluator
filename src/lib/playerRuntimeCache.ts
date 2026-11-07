export type PlayerRuntimeRow = Record<string, any>;

let currentPlayerRuntimeRows: readonly PlayerRuntimeRow[] = [];

export function clearPlayerRuntimeRows(): void {
  currentPlayerRuntimeRows = [];
}

export function getPlayerRuntimeRows(): readonly PlayerRuntimeRow[] {
  return currentPlayerRuntimeRows;
}

export function setPlayerRuntimeRows(rows: readonly PlayerRuntimeRow[]): void {
  currentPlayerRuntimeRows = rows;
}
