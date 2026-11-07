import type { Player } from '@/ui/types';

export interface PlayerRowModel {
  displayName: string;
  subtitle: string;
  uid: string;
}

export function getPlayerRowModel(player: Player): PlayerRowModel {
  return {
    displayName: String(player.name ?? '–'),
    subtitle: String(player.position ?? '–'),
    uid: String(player.uid ?? '–')
  };
}
