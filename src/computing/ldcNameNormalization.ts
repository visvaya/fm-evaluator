/* eslint-disable fp/no-let, fp/no-mutation, regexp/no-obscure-range, regexp/no-dupe-disjunctions, sonarjs/regex-complexity -- Extracted legacy normalization keeps the existing regex-heavy behavior intact. */

export function normalizeLeagueNameForGrouping(leagueName: string): string {
  if (!leagueName) return '';

  let normalized = leagueName.trim();

  const afPatternInName = /\s*-\s*AF\s[A-ZÀ-ÿ\s]+/i;
  normalized = normalized.replace(afPatternInName, '');

  const groupPattern =
    /\s*-\s*(grupa|group|série|serie|zone|zona|gr\.|strefa|groupe|grupo|grupo)\s*[0-9A-Z].*$/i;
  normalized = normalized.replace(groupPattern, '');

  const polishRegionPattern =
    /\s*-\s*(łódzka|wielkopolska|małopolska|śląska|mazowiecka|pomorska|zachodniopomorska|warmińsko-mazurska|podkarpacka|świętokrzyska|lubelska|dolnośląska|podlaska|kujawsko-pomorska|lubuskie|opolskie|zachodniopomorskie|wielkopolskie|mazowieckie|łódzkie|śląskie|małopolskie|pomorskie|warmińsko-mazurskie|podkarpackie|świętokrzyskie|lubelskie|dolnośląskie|podlaskie|kujawsko-pomorskie|lubuskie|opolskie).*$/i;
  normalized = normalized.replace(polishRegionPattern, '');

  const seriePattern = /\s+(Série|Serie|Series)\s+[A-Z0-9]+$/i;
  normalized = normalized.replace(seriePattern, '');

  const parenPattern =
    /\s*\([^)]*(grupa|group|groupe|grupo|série|serie|zone|zona|łódzka|wielkopolska|małopolska|śląska|mazowiecka|pomorska|zachodniopomorska|warmińsko-mazurska|podkarpacka|świętokrzyska|lubelska|dolnoslaska|podlaska|kujawsko-pomorska|lubuskie|opolskie|zachód|zachod|slaska|slaska 2)[^)]*\)/gi;
  normalized = normalized.replaceAll(parenPattern, '');

  const afPattern = /^AF\s[A-ZÀ-ÿ\s]+/i;
  if (afPattern.test(normalized)) {
    normalized = 'Divisões Regionais';
  }

  normalized = normalized.replaceAll(/\s+/g, ' ').trim();

  return normalized;
}
