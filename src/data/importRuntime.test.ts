import { describe, expect, it, vi } from 'vitest';

import {
  applyPostImportLanguageDecision,
  continueImportAfterParsing,
  getDominantDetectedLanguage,
  getRememberedFileLanguageChoice,
  hasParsedCollections,
  prepareImportedFiles,
  recordImportedFilesMetadata,
  processImportedFilesBatch,
  parseImportedHtml,
  resolvePostImportLanguageDecision,
  sanitizeImportedHtml,
  waitForParsedCollections
} from './importRuntime';

describe('importRuntime', () => {
  it('detects whether parsed collections are available', () => {
    expect(hasParsedCollections({ attributes: ['a'] })).toBe(true);
    expect(hasParsedCollections({ stats: ['s'] })).toBe(true);
    expect(hasParsedCollections({ attributes: [], stats: [] })).toBe(false);
  });

  it('waits until parsed collections are populated', async () => {
    const processor = { attributes: [], stats: [] as string[] };
    let attempts = 0;

    await waitForParsedCollections(processor, 200, async () => {
      attempts += 1;
      if (attempts === 2) {
        processor.stats = ['ready'];
      }
    });

    expect(processor.stats).toEqual(['ready']);
  });

  it('returns the dominant detected language', () => {
    expect(
      getDominantDetectedLanguage({
        detectedFileLanguages: ['pl', 'en', 'pl']
      })
    ).toBe('pl');
    expect(getDominantDetectedLanguage({ detectedFileLanguages: [] })).toBeNull();
  });

  it('prefers remembered localStorage language choice when enabled', () => {
    const localStorageLike = {
      getItem: vi.fn((key: string) => {
        if (key === 'fm24-evaluator-remember-language-choice') return 'true';
        if (key === 'fm24-evaluator-file-language-choice') return 'pl';
        return null;
      })
    };
    const sessionStorageLike = {
      getItem: vi.fn(() => 'en')
    };

    expect(getRememberedFileLanguageChoice(localStorageLike, sessionStorageLike)).toBe('pl');
  });

  it('falls back to sessionStorage when local remembered choice is absent', () => {
    const localStorageLike = {
      getItem: vi.fn((key: string) =>
        key === 'fm24-evaluator-remember-language-choice' ? 'false' : null
      )
    };
    const sessionStorageLike = {
      getItem: vi.fn(() => 'en')
    };

    expect(getRememberedFileLanguageChoice(localStorageLike, sessionStorageLike)).toBe('en');
  });

  it('continues when detected language matches current language or is missing', () => {
    const storageLike = { getItem: vi.fn(() => null) };

    expect(
      resolvePostImportLanguageDecision({
        currentLanguage: 'en',
        detectedLanguage: 'en',
        localStorageLike: storageLike,
        sessionStorageLike: storageLike
      })
    ).toEqual({ kind: 'continue' });

    expect(
      resolvePostImportLanguageDecision({
        currentLanguage: 'en',
        detectedLanguage: null,
        localStorageLike: storageLike,
        sessionStorageLike: storageLike
      })
    ).toEqual({ kind: 'continue' });
  });

  it('switches automatically when remembered language matches detected language', () => {
    const localStorageLike = {
      getItem: vi.fn((key: string) => {
        if (key === 'fm24-evaluator-remember-language-choice') return 'true';
        if (key === 'fm24-evaluator-file-language-choice') return 'pl';
        return null;
      })
    };
    const sessionStorageLike = { getItem: vi.fn(() => null) };

    expect(
      resolvePostImportLanguageDecision({
        currentLanguage: 'en',
        detectedLanguage: 'pl',
        localStorageLike,
        sessionStorageLike
      })
    ).toEqual({ kind: 'switch-and-continue', language: 'pl' });
  });

  it('shows language choice when remembered language does not resolve the mismatch', () => {
    const localStorageLike = {
      getItem: vi.fn((key: string) =>
        key === 'fm24-evaluator-remember-language-choice' ? 'false' : null
      )
    };
    const sessionStorageLike = { getItem: vi.fn(() => null) };

    expect(
      resolvePostImportLanguageDecision({
        currentLanguage: 'en',
        detectedLanguage: 'pl',
        localStorageLike,
        sessionStorageLike
      })
    ).toEqual({
      kind: 'show-choice',
      currentLanguage: 'en',
      detectedLanguage: 'pl'
    });
  });

  it('prepares imported files by separating duplicates and accepted files', async () => {
    const files = [
      new File(['a'], 'duplicate-name.html', { type: 'text/html' }),
      new File(['b'], 'duplicate-hash.html', { type: 'text/html' }),
      new File(['c'], 'accepted.html', { type: 'text/html' })
    ];
    const onFileAccepted = vi.fn();
    const onFileRejected = vi.fn();

    const result = await prepareImportedFiles({
      files,
      isKnownDuplicateHash: vi.fn(async (file: File) => file.name === 'duplicate-hash.html'),
      isKnownDuplicateName: (file) => file.name === 'duplicate-name.html',
      onFileAccepted,
      onFileRejected
    });

    expect(result.failedFiles).toEqual([files[0], files[1]]);
    expect(result.newFiles).toEqual([files[2]]);
    expect(onFileRejected).toHaveBeenCalledWith(files[0], 'duplicate-name');
    expect(onFileRejected).toHaveBeenCalledWith(files[1], 'duplicate-hash');
    expect(onFileAccepted).toHaveBeenCalledWith(files[2]);
  });

  it('keeps files when duplicate hash check fails', async () => {
    const file = new File(['a'], 'players.html', { type: 'text/html' });
    const onDuplicateHashCheckFailed = vi.fn();

    const result = await prepareImportedFiles({
      files: [file],
      isKnownDuplicateHash: vi.fn(async () => {
        throw new Error('hash check failed');
      }),
      isKnownDuplicateName: () => false,
      onDuplicateHashCheckFailed
    });

    expect(result.failedFiles).toEqual([]);
    expect(result.newFiles).toEqual([file]);
    expect(onDuplicateHashCheckFailed).toHaveBeenCalledWith(file, expect.any(Error));
  });

  it('records imported files metadata and tolerates per-file failures', async () => {
    const files = [
      new File(['a'], 'first.html', { type: 'text/html' }),
      new File(['b'], 'second.html', { type: 'text/html' })
    ];
    const onRecordError = vi.fn();
    const recordFile = vi
      .fn<(_: File) => Promise<void>>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('record failed'));

    await recordImportedFilesMetadata({
      files,
      onRecordError,
      recordFile
    });

    expect(recordFile).toHaveBeenCalledTimes(2);
    expect(recordFile).toHaveBeenNthCalledWith(1, files[0]);
    expect(recordFile).toHaveBeenNthCalledWith(2, files[1]);
    expect(onRecordError).toHaveBeenCalledWith(files[1], expect.any(Error));
  });

  it('waits for parsed collections before continuing import flow', async () => {
    const processor = { attributes: [], stats: [] };
    const onContinue = vi.fn();
    const waitForParsedCollectionsImpl = vi.fn(async () => undefined);

    await continueImportAfterParsing({
      onContinue,
      processor,
      waitForParsedCollectionsImpl
    });

    expect(waitForParsedCollectionsImpl).toHaveBeenCalledWith(processor);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('sanitizes imported html before parsing', () => {
    expect(sanitizeImportedHtml('<style>x</style><div onclick=test>Ok</div>')).toBe(
      '<div test>Ok</div>'
    );
  });

  it('removes style blocks and handlers that a first removal would join together', () => {
    expect(sanitizeImportedHtml('<sty<style></style>le>x</style><b oonx=nclick=y>Ok</b>')).toBe(
      '<b y>Ok</b>'
    );
  });

  it('parses imported html with batch info and progress callback', async () => {
    const parseHTML = vi.fn().mockResolvedValue({ type: 'stats' });
    const onStatus = vi.fn();
    const file = new File(['<style>x</style><table onclick=test></table>'], 'players.html', {
      type: 'text/html'
    });

    const result = await parseImportedHtml({
      file,
      fileNumber: 2,
      html: '<style>x</style><table onclick=test></table>',
      onStatus,
      parseHTML,
      shouldAppend: true,
      totalFiles: 4
    });

    expect(result).toEqual({ type: 'stats' });
    expect(parseHTML).toHaveBeenCalledWith(
      '<table test></table>',
      null,
      true,
      file,
      null,
      expect.any(Function),
      { current: 2, total: 4 }
    );

    const progressCallback = parseHTML.mock.calls[0][5] as (stage: string) => void;
    progressCallback('detecting');
    progressCallback('processing');

    expect(onStatus).toHaveBeenCalledWith('Wykrywam język: players.html...', 2, 4);
    expect(onStatus).toHaveBeenCalledWith('Przetwarzam: players.html...', 2, 4);
  });

  it('applyPostImportLanguageDecision: switch-and-continue calls setLanguage + continueImport', async () => {
    const setLanguage = vi.fn();
    const continueImport = vi.fn().mockResolvedValue(undefined);
    const showChoiceModal = vi.fn();

    const result = await applyPostImportLanguageDecision(
      { kind: 'switch-and-continue', language: 'pl' },
      { continueImport, setLanguage, showChoiceModal }
    );

    expect(result).toBe(true);
    expect(setLanguage).toHaveBeenCalledWith('pl');
    expect(continueImport).toHaveBeenCalledTimes(1);
    expect(showChoiceModal).not.toHaveBeenCalled();
  });

  it('applyPostImportLanguageDecision: show-choice calls showChoiceModal', async () => {
    const setLanguage = vi.fn();
    const continueImport = vi.fn();
    const showChoiceModal = vi.fn();

    const result = await applyPostImportLanguageDecision(
      { kind: 'show-choice', currentLanguage: 'en', detectedLanguage: 'pl' },
      { continueImport, setLanguage, showChoiceModal }
    );

    expect(result).toBe(true);
    expect(showChoiceModal).toHaveBeenCalledWith('pl', 'en');
    expect(setLanguage).not.toHaveBeenCalled();
    expect(continueImport).not.toHaveBeenCalled();
  });

  it('applyPostImportLanguageDecision: continue returns false without calling any callback', async () => {
    const setLanguage = vi.fn();
    const continueImport = vi.fn();
    const showChoiceModal = vi.fn();

    const result = await applyPostImportLanguageDecision(
      { kind: 'continue' },
      { continueImport, setLanguage, showChoiceModal }
    );

    expect(result).toBe(false);
    expect(setLanguage).not.toHaveBeenCalled();
    expect(continueImport).not.toHaveBeenCalled();
    expect(showChoiceModal).not.toHaveBeenCalled();
  });

  it('processes an imported file batch and collects parse failures', async () => {
    const files = [
      new File(['<table>a</table>'], 'a.html', { type: 'text/html' }),
      new File(['<table>b</table>'], 'b.html', { type: 'text/html' })
    ];
    const onStatus = vi.fn();
    const onParseError = vi.fn();
    const onReadError = vi.fn();
    const parseHTML = vi
      .fn()
      .mockResolvedValueOnce({ type: 'attr' })
      .mockRejectedValueOnce(new Error('parse failed'));
    const readText = vi
      .fn<(_: File) => Promise<string>>()
      .mockResolvedValueOnce('<table>a</table>')
      .mockResolvedValueOnce('<table>b</table>');

    const result = await processImportedFilesBatch({
      files,
      onParseError,
      onReadError,
      onStatus,
      parseHTML,
      readText,
      shouldAppendAtIndex: (index) => index > 0
    });

    expect(result.loadedTypes).toEqual(['attr']);
    expect(result.errors).toEqual(['b.html: parse failed']);
    expect(result.failedFiles).toEqual([files[1]]);
    expect(result.cancelled).toBe(false);
    expect(onParseError).toHaveBeenCalledWith(files[1], expect.any(Error));
    expect(onReadError).not.toHaveBeenCalled();
  });
});
