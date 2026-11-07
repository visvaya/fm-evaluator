// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { store } from './store/tableStore';

// Mock storage/state – persist() calls saveUIState
vi.mock('./storage/state', () => ({
  saveUIState: vi.fn()
}));

// Mock window globals used by tableState
beforeEach(() => {
  (window as any).COLUMNS = [];
  (window as any).APP_SETTINGS = {};
  (window as any).processor = null;
  (window as any).scheduleTableRender = vi.fn();

  // Reset store
  store.hiddenColumns = [];
  store.pinnedColumns = [];
  store.currentSort = { col: '', dir: 'asc' };
  store.currentPage = 5;
});

// Dynamic import to avoid side-effect issues
let toggleHidden: (id: string) => void;
let togglePinned: (id: string) => void;
let setSort: (col: string) => void;

beforeEach(async () => {
  const mod = await import('./tableState');
  toggleHidden = mod.toggleHidden;
  togglePinned = mod.togglePinned;
  setSort = mod.setSort;
});

describe('tableState', () => {
  describe('toggleHidden', () => {
    it('should add column to hiddenColumns', () => {
      toggleHidden('basic_dob');
      expect(store.hiddenColumns).toContain('basic_dob');
    });

    it('should remove column from hiddenColumns if already hidden', () => {
      store.hiddenColumns = ['basic_dob'];
      toggleHidden('basic_dob');
      expect(store.hiddenColumns).not.toContain('basic_dob');
    });

    it('should reset currentPage to 1', () => {
      store.currentPage = 5;
      toggleHidden('basic_dob');
      expect(store.currentPage).toBe(1);
    });

    it('should call scheduleTableRender', () => {
      toggleHidden('basic_dob');
      expect((window as any).scheduleTableRender).toHaveBeenCalled();
    });
  });

  describe('togglePinned', () => {
    it('should add column to pinnedColumns', () => {
      togglePinned('basic_name');
      expect(store.pinnedColumns).toContain('basic_name');
    });

    it('should remove column from pinnedColumns if already pinned', () => {
      store.pinnedColumns = ['basic_name'];
      togglePinned('basic_name');
      expect(store.pinnedColumns).not.toContain('basic_name');
    });

    it('should reset currentPage to 1', () => {
      store.currentPage = 3;
      togglePinned('basic_name');
      expect(store.currentPage).toBe(1);
    });
  });

  describe('setSort', () => {
    it('should set sort column with desc direction on first click', () => {
      setSort('attribute_pace');
      expect(store.currentSort.col).toBe('attribute_pace');
      expect(store.currentSort.dir).toBe('desc');
    });

    it('should toggle direction when clicking same column', () => {
      store.currentSort = { col: 'attribute_pace', dir: 'desc' };
      setSort('attribute_pace');
      expect(store.currentSort.dir).toBe('asc');
    });

    it('should toggle back to desc on third click', () => {
      store.currentSort = { col: 'attribute_pace', dir: 'asc' };
      setSort('attribute_pace');
      expect(store.currentSort.dir).toBe('desc');
    });

    it('should reset to desc when switching to different column', () => {
      store.currentSort = { col: 'attribute_pace', dir: 'asc' };
      setSort('attribute_stamina');
      expect(store.currentSort.col).toBe('attribute_stamina');
      expect(store.currentSort.dir).toBe('desc');
    });

    it('should reset currentPage to 1', () => {
      store.currentPage = 5;
      setSort('attribute_pace');
      expect(store.currentPage).toBe(1);
    });
  });
});
