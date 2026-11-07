/* eslint-disable sonarjs/no-nested-functions -- Dialog form updates intentionally keep row-edit handlers local to the modal component. */

import { useMemo, useState } from 'react';

import { addLeagueMapping } from '@/computing/ldcMappings';
import { ldcSettings } from '@/config/ldcConfig';
import { useLdcMissingStore } from '@/features/ldc/useLdcMissingStore';
import { checkMissingLeagues, addLeagueWithValues } from '@/ui/ldcMissing';

function buildSelectableLeagues() {
  return ldcSettings.leagues
    .map((league) => ({
      key: `${league.name}||${league.nation}`,
      name: league.name,
      nation: league.nation
    }))
    .toSorted((left, right) =>
      `${left.name} ${left.nation}`.localeCompare(`${right.name} ${right.nation}`)
    );
}

function getDefaultBasketStars() {
  const lastLeague = ldcSettings.leagues.at(-1);
  if (lastLeague?.stars !== null && lastLeague?.stars !== undefined && lastLeague.stars >= 0.5) {
    return String(lastLeague.stars);
  }

  return '0.5';
}

function AddLeagueDialog() {
  const closeDialog = useLdcMissingStore((state) => state.closeDialog);
  const payload = useLdcMissingStore((state) => state.activeDialog);

  if (payload?.mode !== 'add') {
    return null;
  }

  const { league } = payload;
  const [name, setName] = useState(league.name);
  const [nameError, setNameError] = useState<null | string>(null);
  const [nation, setNation] = useState(league.nation || '');
  const [rank, setRank] = useState(String(league.suggestedRank || ldcSettings.leagues.length + 1));
  const [stars, setStars] = useState(
    league.suggestedStars === null ? getDefaultBasketStars() : String(league.suggestedStars)
  );

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-2xl">
        <h3 className="mb-4 text-lg font-semibold text-text-primary">Dodaj ligę: {league.name}</h3>
        <p className="mb-4 text-sm text-text-muted">
          Dodaj nową ligę do LDC, jeśli nie chcesz tworzyć mapowania do już istniejącej ligi.
        </p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
              Nazwa ligi
            </label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              onChange={(event) => {
                setName(event.target.value);
                if (nameError !== null) {
                  setNameError(null);
                }
              }}
              value={name}
            />
            {nameError === null ? null : <p className="mt-1 text-xs text-negative">{nameError}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
              Kraj
            </label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              onChange={(event) => setNation(event.target.value)}
              value={nation}
            />
          </div>
          {ldcSettings.model === 'basket' ? (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                Gwiazdki
              </label>
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                max="5"
                min="0.5"
                onChange={(event) => setStars(event.target.value)}
                step="0.5"
                type="number"
                value={stars}
              />
            </div>
          ) : null}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
              Rank
            </label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              min="1"
              onChange={(event) => setRank(event.target.value)}
              type="number"
              value={rank}
            />
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <button
            className="flex-1 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white"
            onClick={() => {
              const trimmedName = name.trim();
              if (!trimmedName) {
                setNameError('Nazwa ligi jest wymagana.');
                return;
              }

              addLeagueWithValues(
                trimmedName,
                nation.trim(),
                ldcSettings.model === 'basket' && stars.trim() !== ''
                  ? Number.parseFloat(stars)
                  : null,
                Number.parseInt(rank, 10) || ldcSettings.leagues.length + 1
              );
              closeDialog();
            }}
            type="button"
          >
            Dodaj
          </button>
          <button
            className="flex-1 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-text-primary"
            onClick={closeDialog}
            type="button"
          >
            Anuluj
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkAddDialog() {
  const closeDialog = useLdcMissingStore((state) => state.closeDialog);
  const payload = useLdcMissingStore((state) => state.activeDialog);

  if (payload?.mode !== 'bulk-add') {
    return null;
  }

  const [linkValues, setLinkValues] = useState(true);
  const [linkedRank, setLinkedRank] = useState('');
  const [linkedStars, setLinkedStars] = useState('');
  const [rows, setRows] = useState(() =>
    payload.leagues.map((league, index) => ({
      name: league.name,
      nation: league.nation || payload.country || '',
      rank: String(league.suggestedRank || ldcSettings.leagues.length + index + 1),
      stars: league.suggestedStars == null ? getDefaultBasketStars() : String(league.suggestedStars)
    }))
  );

  const resolveRowStarsValue = (rowStars: string) => {
    if (linkValues && linkedStars !== '') {
      return linkedStars;
    }

    return rowStars;
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[80vh] w-full max-w-4xl flex-col rounded-2xl border border-border bg-background p-4 shadow-2xl">
        <h3 className="mb-3 text-lg font-semibold text-text-primary">{payload.title}</h3>
        <div className="mb-3 rounded-xl border border-border bg-surface/35 p-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-text-primary">
            <input
              checked={linkValues}
              onChange={(event) => setLinkValues(event.target.checked)}
              type="checkbox"
            />
            Użyj tych samych wartości dla wszystkich
          </label>
          <p className="mt-2 text-xs text-text-muted">
            Po włączeniu wszystkie dodawane ligi dostaną ten sam rank i, w modelu koszykowym, tę
            samą liczbę gwiazdek.
          </p>
          <div className="mt-2 flex gap-2">
            {ldcSettings.model === 'basket' ? (
              <input
                className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                max="5"
                min="0.5"
                onChange={(event) => setLinkedStars(event.target.value)}
                placeholder="Gwiazdki"
                step="0.5"
                type="number"
                value={linkedStars}
              />
            ) : null}
            <input
              className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-xs"
              onChange={(event) => setLinkedRank(event.target.value)}
              placeholder="Rank"
              type="number"
              value={linkedRank}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto rounded-xl border border-border">
          <div className="grid grid-cols-4 gap-2 border-b border-border bg-surface px-3 py-2 text-xs font-semibold text-text-muted">
            <span className="col-span-2">Liga</span>
            <span>Kraj</span>
            <span>{ldcSettings.model === 'basket' ? 'Gwiazdki / Rank' : 'Rank'}</span>
          </div>
          {rows.map((row, index) => (
            <div
              key={row.name}
              className="grid grid-cols-4 gap-2 border-b border-border px-3 py-2 text-xs"
            >
              <span className="col-span-2 self-center font-mono">{row.name}</span>
              <input
                className="rounded border border-border bg-background px-2 py-1"
                onChange={(event) =>
                  setRows((current) =>
                    current.map((entry, currentIndex) =>
                      currentIndex === index ? { ...entry, nation: event.target.value } : entry
                    )
                  )
                }
                value={row.nation}
              />
              <div className="flex gap-2">
                {ldcSettings.model === 'basket' ? (
                  <input
                    className="w-16 rounded border border-border bg-background px-2 py-1"
                    disabled={linkValues}
                    max="5"
                    min="0.5"
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((entry, currentIndex) =>
                          currentIndex === index ? { ...entry, stars: event.target.value } : entry
                        )
                      )
                    }
                    step="0.5"
                    type="number"
                    value={resolveRowStarsValue(row.stars)}
                  />
                ) : null}
                <input
                  className="w-16 rounded border border-border bg-background px-2 py-1"
                  disabled={linkValues}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((entry, currentIndex) =>
                        currentIndex === index ? { ...entry, rank: event.target.value } : entry
                      )
                    )
                  }
                  type="number"
                  value={linkValues && linkedRank !== '' ? linkedRank : row.rank}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            className="flex-1 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white"
            onClick={() => {
              rows.forEach((row, index) => {
                addLeagueWithValues(
                  row.name,
                  row.nation.trim(),
                  ldcSettings.model === 'basket'
                    ? Number.parseFloat(resolveRowStarsValue(row.stars)) || null
                    : null,
                  Number.parseInt(linkValues && linkedRank !== '' ? linkedRank : row.rank, 10) ||
                    ldcSettings.leagues.length + index + 1
                );
              });
              closeDialog();
            }}
            type="button"
          >
            Dodaj wszystkie
          </button>
          <button
            className="flex-1 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-text-primary"
            onClick={closeDialog}
            type="button"
          >
            Anuluj
          </button>
        </div>
      </div>
    </div>
  );
}

function MatchDialog() {
  const closeDialog = useLdcMissingStore((state) => state.closeDialog);
  const payload = useLdcMissingStore((state) => state.activeDialog);
  const selectableLeagues = useMemo(() => buildSelectableLeagues(), []);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeagueKey, setSelectedLeagueKey] = useState<null | string>(null);

  if (payload?.mode !== 'match') {
    return null;
  }

  const normalizedQuery = searchTerm.trim().toLowerCase();
  const matches = selectableLeagues.filter(
    (league) =>
      league.name.toLowerCase().includes(normalizedQuery) ||
      league.nation.toLowerCase().includes(normalizedQuery)
  );
  const selectedLeague =
    selectableLeagues.find((league) => league.key === selectedLeagueKey) ?? null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-background p-4 shadow-2xl">
        <h3 className="mb-3 text-lg font-semibold text-text-primary">{payload.title}</h3>
        <p className="mb-3 text-sm text-text-muted">
          Wybierz istniejącą ligę z LDC. Ta operacja utworzy mapowanie dla wskazanych brakujących
          lig.
        </p>
        <input
          autoFocus
          className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Wyszukaj ligę..."
          value={searchTerm}
        />
        <div className="max-h-72 overflow-y-auto rounded-xl border border-border">
          {matches.length === 0 ? (
            <p className="p-3 text-xs text-text-muted">
              Nie znaleziono lig zawierających &quot;{searchTerm}&quot;
            </p>
          ) : (
            matches.map((league) => {
              return (
                <label
                  key={league.key}
                  className={`flex cursor-pointer items-center gap-2 border-b border-border px-3 py-2 text-sm ${
                    selectedLeagueKey === league.key ? 'bg-surface' : ''
                  }`}
                >
                  <input
                    checked={selectedLeagueKey === league.key}
                    name="ldc-match-selection"
                    onChange={() => setSelectedLeagueKey(league.key)}
                    type="radio"
                  />
                  <span>
                    {league.name}
                    {league.nation ? ` (${league.nation})` : ''}
                  </span>
                </label>
              );
            })
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            className="flex-1 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
            disabled={selectedLeague === null}
            onClick={() => {
              if (!selectedLeague) {
                return;
              }

              payload.leagues.forEach((league) => {
                addLeagueMapping(
                  { name: league.name, nation: league.nation },
                  {
                    name: selectedLeague.name,
                    nation: selectedLeague.nation
                  }
                );
              });
              closeDialog();
              checkMissingLeagues();
            }}
            type="button"
          >
            Wybierz
          </button>
          <button
            className="flex-1 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-text-primary"
            onClick={closeDialog}
            type="button"
          >
            Anuluj
          </button>
        </div>
      </div>
    </div>
  );
}

export function LdcMissingDialogs() {
  const activeDialog = useLdcMissingStore((state) => state.activeDialog);

  if (!activeDialog) {
    return null;
  }

  if (activeDialog.mode === 'add') {
    return <AddLeagueDialog />;
  }

  if (activeDialog.mode === 'bulk-add') {
    return <BulkAddDialog />;
  }

  return <MatchDialog />;
}
