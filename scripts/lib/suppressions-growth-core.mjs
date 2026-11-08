// The oxlint suppressions baseline may only shrink. A count of a rule that the base already froze
// must not rise, in an existing file or a new one. Growth is allowed only for a rule whose
// configuration changed in the same change (switched on, new options, new override scope): its
// existing findings are frozen then, and the config diff shows the decision.

/**
 * @param {Record<string, Record<string, { count: number }>>} base suppressions of the base branch
 * @param {Record<string, Record<string, { count: number }>>} head suppressions of the change
 * @param {ReadonlySet<string>} [changedRules] rules whose configuration differs from the base
 * @returns {{ file: string, rule: string, from: number, to: number }[]} counts that grew
 */
export function findSuppressionGrowth(base, head, changedRules = new Set()) {
  const frozenRules = new Set(Object.values(base).flatMap((rules) => Object.keys(rules)));
  return Object.entries(head).flatMap(([file, rules]) =>
    Object.entries(rules)
      .filter(([rule]) => frozenRules.has(rule) && !changedRules.has(rule))
      .map(([rule, { count }]) => ({ file, rule, from: base[file]?.[rule]?.count ?? 0, to: count }))
      .filter(({ from, to }) => to > from)
  );
}

/** Parses JSON with line and block comments and trailing commas, as .oxlintrc.json allows. */
export function parseJsonWithComments(text) {
  // Strings come first in each pattern, so a comment marker or a comma inside a string stays.
  const withoutComments = text.replaceAll(
    /("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g,
    (_match, string) => string ?? ''
  );
  const withoutTrailingCommas = withoutComments.replaceAll(
    /("(?:\\.|[^"\\])*")|,(?=\s*[}\]])/g,
    (_match, string) => string ?? ''
  );
  return JSON.parse(withoutTrailingCommas);
}

/** Every setting of each rule in an oxlint config: the root and each override with its files. */
function ruleSettings(config) {
  const settings = new Map();
  const add = (scope, rules) => {
    for (const [rule, setting] of Object.entries(rules ?? {})) {
      settings.set(rule, [...(settings.get(rule) ?? []), { scope, setting }]);
    }
  };
  add('root', config.rules);
  for (const override of config.overrides ?? [])
    add(JSON.stringify(override.files), override.rules);
  return settings;
}

/** JSON with object keys sorted, so reordered options do not count as a change. */
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value)
      .toSorted((a, b) => a.localeCompare(b, 'en'))
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

/** Rules whose settings differ between two oxlint configs. */
export function findChangedRules(baseConfig, headConfig) {
  const before = ruleSettings(baseConfig);
  const after = ruleSettings(headConfig);
  const rules = new Set([...before.keys(), ...after.keys()]);
  return new Set(
    [...rules].filter((rule) => canonicalJson(before.get(rule)) !== canonicalJson(after.get(rule)))
  );
}
