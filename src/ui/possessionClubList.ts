import { legacyClubActionAttrs } from '@/features/legacyRuntime/legacyActionAttributes';
import { getActivePlayerRows } from '@/lib/playerRowsRuntime';

import { collator } from '../config/columns';
import { getProcessor } from '../lib/processorBridge';
import { escHtml as esc } from '../utils/escHtml';
import { normalizeDiacritics } from '../utils/helpers';

let currentSelectedClub: null | string = null;

export function getCurrentSelectedClub(): null | string {
  return currentSelectedClub;
}

export function setCurrentSelectedClub(val: null | string): void {
  currentSelectedClub = val;
}

export function renderPossessionClubList(filterText = ''): void {
  const listContainer = document.querySelector('#possession-club-list');
  if (!listContainer) return;
  const proc = getProcessor();

  if (!proc) {
    listContainer.textContent = 'Brak danych. Wgraj plik HTML.';
    return;
  }
  const source = getActivePlayerRows();
  if (source.length === 0) {
    listContainer.textContent = 'Brak danych. Wgraj plik HTML.';
    return;
  }

  const clubsSet = new Set<string>();
  source.forEach((p) => {
    const club = p.club || p.Club;
    if (club && typeof club === 'string') clubsSet.add(club);
  });

  let clubs = [...clubsSet].sort((a, b) => collator.compare(a, b));
  const normalizedFilter = filterText.trim()
    ? (normalizeDiacritics(filterText.trim().toLowerCase()) ?? '')
    : '';
  if (normalizedFilter)
    clubs = clubs.filter((club) =>
      (normalizeDiacritics(club.toLowerCase()) ?? club.toLowerCase()).includes(normalizedFilter)
    );

  if (clubs.length === 0) {
    listContainer.textContent = 'Nie znaleziono klubu.';
    return;
  }

  const parts = clubs.map((club) => {
    const savedPossession = proc.getTeamPossession(club);
    const hasValue = savedPossession !== null;
    const isSelected = currentSelectedClub === club;
    const safeClub = esc(club);
    const badgeHtml = hasValue
      ? `<span class="flex items-center gap-1"><span class="poss-badge">${savedPossession}%</span><i class="fas fa-times club-remove-icon" title="Resetuj warto&#347;&#263;" ${legacyClubActionAttrs('removeClubPossession', club)}></i></span>`
      : '';
    return `<div class="club-list-item ${isSelected ? 'selected' : ''}" ${legacyClubActionAttrs('selectPossessionClub', club)}><span>${safeClub}</span>${badgeHtml}</div>`;
  });

  // All club names are escaped via esc() before insertion
  listContainer.innerHTML = parts.join('');
}

export function selectPossessionClub(clubName: string): void {
  const proc = getProcessor();
  currentSelectedClub = clubName;
  renderPossessionClubList(
    document.querySelector<HTMLInputElement>('#possession-club-search')?.value ?? ''
  );
  const inputWrapper = document.querySelector('#possession-club-input-wrapper');
  const clubLabel = document.querySelector('#selected-club-label');
  const valueInput = document.querySelector<HTMLInputElement>('#possession-club-value');
  if (inputWrapper && clubLabel && valueInput) {
    inputWrapper.classList.remove('hidden');
    clubLabel.textContent = clubName;
    const currentVal = proc ? proc.getTeamPossession(clubName) : null;
    valueInput.value = currentVal === null ? '' : String(currentVal);
    valueInput.focus();
    valueInput.select();
  }
  const err = document.querySelector('#possession-modal-error');
  if (err) err.textContent = '';
}

export function removeClubPossession(e: Event, clubName: string): void {
  e.stopPropagation();
  const proc = getProcessor();
  if (!proc) return;
  proc.teamPossessionMap.delete(proc.normalizeClubName(clubName));
  if (currentSelectedClub === clubName) {
    const vi = document.querySelector<HTMLInputElement>('#possession-club-value');
    if (vi) vi.value = '';
  }
  renderPossessionClubList(
    document.querySelector<HTMLInputElement>('#possession-club-search')?.value ?? ''
  );
}

export function saveCurrentClubPossession(): void {
  const proc = getProcessor();
  const possValueInput = document.querySelector<HTMLInputElement>('#possession-club-value');
  if (!currentSelectedClub || !possValueInput || !proc) return;
  const raw = possValueInput.value;
  if (raw === '') {
    proc.teamPossessionMap.delete(proc.normalizeClubName(currentSelectedClub));
  } else {
    const val = parseInt(raw, 10);
    if (isNaN(val) || val < 0 || val > 100) return;
    proc.setTeamPossession(currentSelectedClub, val);
  }
  const filterVal =
    document.querySelector<HTMLInputElement>('#possession-club-search')?.value ?? '';
  renderPossessionClubList(filterVal);
  const saveClubPossessionBtn = document.querySelector('#save-club-possession');
  if (saveClubPossessionBtn) {
    // Hardcoded trusted icon – restores button to its own prior HTML snapshot
    const originalHTML = saveClubPossessionBtn.innerHTML;
    saveClubPossessionBtn.innerHTML = '<i class="fas fa-check-double"></i>';
    setTimeout(() => {
      saveClubPossessionBtn.innerHTML = originalHTML;
    }, 800);
  }
}
