import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';
import { normalizeDiacritics } from '@/utils/helpers';

import type { LdcMappingTarget } from '@/config/ldcConfig';

export interface TargetLeagueOption {
  key: string;
  name: string;
  nation: string;
}

function normalizeSearchValue(value: string) {
  return normalizeDiacritics(value.toLowerCase().trim());
}

export function LdcMappingTargetPicker({
  currentTargetKey,
  onApply,
  onCancel,
  options,
  sources,
  type
}: {
  currentTargetKey: null | string;
  onApply: (target: LdcMappingTarget) => void;
  onCancel: () => void;
  options: TargetLeagueOption[];
  sources: string[];
  type: 'bulk' | 'single';
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTargetKey, setSelectedTargetKey] = useState<null | string>(currentTargetKey);

  useEffect(() => {
    setSelectedTargetKey(currentTargetKey);
  }, [currentTargetKey]);

  const filteredOptions = useMemo(() => {
    const query = normalizeSearchValue(searchTerm);
    if (query.length === 0) {
      return options.slice(0, 32);
    }

    return options.filter((option) =>
      normalizeSearchValue(`${option.name} ${option.nation}`).includes(query)
    );
  }, [options, searchTerm]);

  const selectedTarget = options.find((option) => option.key === selectedTargetKey) ?? null;
  const title =
    type === 'bulk'
      ? `Zmień ligę LDC dla ${sources.length} mapowań`
      : `Zmień ligę LDC dla "${sources[0]}"`;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-background/70 p-4">
      <div className="flex max-h-[75vh] w-full max-w-xl flex-col rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
            <p className="mt-1 text-xs text-text-muted">
              Wybierz ligę docelową z aktualnej listy LDC.
            </p>
          </div>
          <button
            aria-label="Anuluj wybór ligi"
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border text-text-secondary transition hover:bg-surface hover:text-text-primary"
            onClick={onCancel}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <input
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            id="ldc-mappings-target-search"
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Szukaj ligi LDC..."
            type="text"
            value={searchTerm}
          />
          <div className="custom-scroll max-h-[320px] space-y-1 overflow-y-auto rounded-xl border border-border bg-surface/15 p-2">
            {filteredOptions.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-text-muted">
                Brak lig pasujących do wyszukiwania.
              </p>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selectedTargetKey === option.key;
                return (
                  <button
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-surface',
                      isSelected ? 'bg-accent/10' : 'text-text-secondary'
                    )}
                    key={option.key}
                    onClick={() => setSelectedTargetKey(option.key)}
                    type="button"
                  >
                    <span>
                      <span className="block text-sm font-medium text-text-primary">
                        {option.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-text-muted">
                        {option.nation || 'Bez kraju'}
                      </span>
                    </span>
                    <input
                      checked={isSelected}
                      className="accent-accent"
                      onChange={() => setSelectedTargetKey(option.key)}
                      type="radio"
                    />
                  </button>
                );
              })
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-text-primary transition hover:bg-surface"
            onClick={onCancel}
            type="button"
          >
            Anuluj
          </button>
          <button
            className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={selectedTarget === null}
            id="ldc-mappings-target-apply"
            onClick={() => {
              if (selectedTarget) {
                onApply({ name: selectedTarget.name, nation: selectedTarget.nation });
              }
            }}
            type="button"
          >
            Zastosuj
          </button>
        </div>
      </div>
    </div>
  );
}
