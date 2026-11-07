import { FEET_MAPPING } from '../config/constants';

export interface FeetResult {
  left: number;
  right: number;
}

export function parseFeet(player: null | Record<string, unknown> | undefined): FeetResult {
  if (!player) return { left: 0, right: 0 };

  const lKey = (player['Left Foot'] || player.basic_left_foot) as string | undefined;
  const rKey = (player['Right Foot'] || player.basic_right_foot) as string | undefined;

  let left: number = FEET_MAPPING[lKey] ?? 0;
  let right: number = FEET_MAPPING[rKey] ?? 0;

  if (left === 0 && right === 0) {
    const pref = (player['Preferred Foot'] || player.Noga || player.basic_preferred_foot) as
      | string
      | undefined;
    if (pref) {
      const p = pref.toString().trim();
      switch (p) {
        case 'Either':
        case 'Obie': {
          left = 5;
          right = 5;
          break;
        }
        case 'Left':
        case 'Lewa': {
          left = 5;
          right = 1;
          break;
        }
        case 'Left Only':
        case 'Tylko lewa': {
          left = 5;
          right = 0;
          break;
        }
        case 'Prawa':
        case 'Right': {
          left = 1;
          right = 5;
          break;
        }
        case 'Right Only':
        case 'Tylko prawa': {
          left = 0;
          right = 5;
          break;
        }
        // No default
      }
    }
  }

  return { left, right };
}
