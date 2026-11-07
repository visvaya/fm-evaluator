// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { clearPlayerRuntimeRows, setPlayerRuntimeRows } from '@/lib/playerRuntimeCache';
import { useTableStore } from '@/store/useTableStore';

import {
  getCurrentSelectedClub,
  removeClubPossession,
  renderPossessionClubList,
  saveCurrentClubPossession,
  selectPossessionClub,
  setCurrentSelectedClub
} from './possessionClubList';

function makeProcessor(overrides: Record<string, any> = {}) {
  const map = new Map<string, number>();
  return {
    getTeamPossession: (club: string) => map.get(club) ?? null,
    normalizeClubName: (club: string) => club,
    removeTeamPossession: (club: string) => map.delete(club),
    setTeamPossession: (club: string, val: number) => map.set(club, val),
    teamPossessionMap: map,
    ...overrides
  };
}

describe('possessionClubList', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    const list = document.createElement('div');
    list.id = 'possession-club-list';
    document.body.appendChild(list);

    (window as any).collator = new Intl.Collator('pl', { numeric: true, sensitivity: 'base' });
    (window as any).normalizeDiacritics = (s: string) => s;
    (window as any).processor = makeProcessor();

    clearPlayerRuntimeRows();
    setCurrentSelectedClub(null);
    useTableStore.setState({ analysisReady: false, data: [] });
  });

  describe('renderPossessionClubList', () => {
    it('shows placeholder when no processor', () => {
      (window as any).processor = null;
      renderPossessionClubList('');
      expect(document.querySelector('#possession-club-list')?.textContent).toContain('Brak danych');
    });

    it('shows placeholder when source is empty', () => {
      renderPossessionClubList('');
      expect(document.querySelector('#possession-club-list')?.textContent).toContain('Brak danych');
    });

    it('renders clubs from runtime rows', () => {
      setPlayerRuntimeRows([
        { club: 'Legia', uid: '1' },
        { club: 'Lech', uid: '2' }
      ] as any[]);
      renderPossessionClubList('');
      const content = document.querySelector('#possession-club-list')?.textContent ?? '';
      expect(content).toContain('Legia');
      expect(content).toContain('Lech');
    });

    it('shows possession badge when club has saved value', () => {
      const proc = makeProcessor();
      proc.setTeamPossession('Legia', 60);
      (window as any).processor = proc;
      setPlayerRuntimeRows([{ club: 'Legia', uid: '1' }] as any[]);
      renderPossessionClubList('');
      expect(document.querySelector('#possession-club-list')?.textContent).toContain('60%');
    });

    it('filters clubs by filterText', () => {
      setPlayerRuntimeRows([
        { club: 'Legia Warszawa', uid: '1' },
        { club: 'Lech Poznan', uid: '2' },
        { club: 'Cracovia', uid: '3' }
      ] as any[]);
      renderPossessionClubList('leg');
      const content = document.querySelector('#possession-club-list')?.textContent ?? '';
      expect(content).toContain('Legia');
      expect(content).not.toContain('Cracovia');
    });

    it('shows not-found message when filter matches nothing', () => {
      setPlayerRuntimeRows([{ club: 'Legia', uid: '1' }] as any[]);
      renderPossessionClubList('xyz-nonexistent');
      expect(document.querySelector('#possession-club-list')?.textContent).toContain(
        'Nie znaleziono'
      );
    });

    it('marks selected club with selected class', () => {
      setPlayerRuntimeRows([{ club: 'Legia', uid: '1' }] as any[]);
      setCurrentSelectedClub('Legia');
      renderPossessionClubList('');
      expect(document.querySelector('.club-list-item.selected')).not.toBeNull();
    });

    it('keeps the raw club name in the action payload and shows it as text', () => {
      const club = 'Brighton & Hove <Albion>';
      setPlayerRuntimeRows([{ club, uid: '1' }] as any[]);
      renderPossessionClubList('');

      const item = document.querySelector<HTMLElement>('.club-list-item');
      expect(item?.dataset.fmClub).toBe(club);
      expect(item?.textContent).toBe(club);
    });
  });

  describe('setCurrentSelectedClub / getCurrentSelectedClub', () => {
    it('stores and retrieves selected club', () => {
      setCurrentSelectedClub('Cracovia');
      expect(getCurrentSelectedClub()).toBe('Cracovia');
    });

    it('can be reset to null', () => {
      setCurrentSelectedClub('Cracovia');
      setCurrentSelectedClub(null);
      expect(getCurrentSelectedClub()).toBeNull();
    });
  });

  describe('selectPossessionClub', () => {
    beforeEach(() => {
      const wrapper = document.createElement('div');
      wrapper.id = 'possession-club-input-wrapper';
      wrapper.className = 'hidden';
      const label = document.createElement('span');
      label.id = 'selected-club-label';
      const input = document.createElement('input');
      input.id = 'possession-club-value';
      const err = document.createElement('div');
      err.id = 'possession-modal-error';
      err.textContent = 'old error';
      const search = document.createElement('input');
      search.id = 'possession-club-search';
      document.body.appendChild(wrapper);
      document.body.appendChild(label);
      document.body.appendChild(input);
      document.body.appendChild(err);
      document.body.appendChild(search);
    });

    it('sets currentSelectedClub', () => {
      selectPossessionClub('Wisla');
      expect(getCurrentSelectedClub()).toBe('Wisla');
    });

    it('reveals input wrapper', () => {
      selectPossessionClub('Wisla');
      expect(
        document.querySelector('#possession-club-input-wrapper')?.classList.contains('hidden')
      ).toBe(false);
    });

    it('sets label text', () => {
      selectPossessionClub('Wisla');
      expect(document.querySelector('#selected-club-label')?.textContent).toBe('Wisla');
    });

    it('clears error message', () => {
      selectPossessionClub('Wisla');
      expect(document.querySelector('#possession-modal-error')?.textContent).toBe('');
    });
  });

  describe('removeClubPossession', () => {
    it('deletes from processor teamPossessionMap', () => {
      const proc = makeProcessor();
      proc.setTeamPossession('Legia', 55);
      (window as any).processor = proc;
      setPlayerRuntimeRows([{ club: 'Legia', uid: '1' }] as any[]);

      const e = new Event('click');
      vi.spyOn(e, 'stopPropagation');
      removeClubPossession(e, 'Legia');

      expect(proc.getTeamPossession('Legia')).toBeNull();
      expect(e.stopPropagation).toHaveBeenCalled();
    });

    it('clears value input when removed club was selected', () => {
      const proc = makeProcessor();
      proc.setTeamPossession('Legia', 55);
      (window as any).processor = proc;
      setCurrentSelectedClub('Legia');
      const vi2 = document.createElement('input');
      vi2.id = 'possession-club-value';
      vi2.value = '55';
      document.body.appendChild(vi2);
      setPlayerRuntimeRows([{ club: 'Legia', uid: '1' }] as any[]);

      removeClubPossession(new Event('click'), 'Legia');

      expect(vi2.value).toBe('');
    });
  });

  describe('saveCurrentClubPossession', () => {
    beforeEach(() => {
      const input = document.createElement('input');
      input.id = 'possession-club-value';
      input.value = '70';
      const search = document.createElement('input');
      search.id = 'possession-club-search';
      document.body.appendChild(input);
      document.body.appendChild(search);
      setPlayerRuntimeRows([{ club: 'Legia', uid: '1' }] as any[]);
    });

    it('saves possession value to processor', () => {
      const proc = makeProcessor();
      (window as any).processor = proc;
      setCurrentSelectedClub('Legia');
      saveCurrentClubPossession();
      expect(proc.getTeamPossession('Legia')).toBe(70);
    });

    it('deletes possession when value is empty', () => {
      const proc = makeProcessor();
      proc.setTeamPossession('Legia', 70);
      (window as any).processor = proc;
      setCurrentSelectedClub('Legia');
      document.querySelector<HTMLInputElement>('#possession-club-value')!.value = '';
      saveCurrentClubPossession();
      expect(proc.getTeamPossession('Legia')).toBeNull();
    });

    it('does nothing when no club is selected', () => {
      const proc = makeProcessor();
      (window as any).processor = proc;
      setCurrentSelectedClub(null);
      saveCurrentClubPossession();
      expect(proc.getTeamPossession('Legia')).toBeNull();
    });

    it('rejects value outside 0-100', () => {
      const proc = makeProcessor();
      (window as any).processor = proc;
      setCurrentSelectedClub('Legia');
      document.querySelector<HTMLInputElement>('#possession-club-value')!.value = '150';
      saveCurrentClubPossession();
      expect(proc.getTeamPossession('Legia')).toBeNull();
    });
  });
});
