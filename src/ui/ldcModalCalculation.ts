import { computeLDC } from '@/computing/ldc';
import { checkOrderConsistency, findLeaguesWithSameLDC } from '@/computing/ldcUtils';
import { ldcSettings } from '@/config/ldcConfig';

export function calculateLDC(): void {
  computeLDC();
  if (ldcSettings.model === 'basket') {
    detectBasketModelProblems();
  }
  validateLeagueOrder();
}

export function detectBasketModelProblems(): void {
  const problems = findLeaguesWithSameLDC();
  (window as any).ldcBasketProblems = problems;
}

export function validateLeagueOrder(): void {
  const orderProblems = checkOrderConsistency(ldcSettings.leagues);
  (window as any).ldcOrderProblems = orderProblems;
}
