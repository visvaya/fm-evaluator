import { NormalizationConfig } from '../parsing/normalizationConfig.js';
import { compareCodeUnits } from '../utils/compareCodeUnits';

import { calculateMissingColumns } from './calculateMissingColumns';
import { computeStructureHash } from './computeStructureHash';
import { detectFileType } from './detectFileType';
import { extractAgeFromDob } from './extractAgeFromDob';
import { readImportedRows, type CutCellCount } from './importedCellText';
import { normalizeHeader } from './normalizeHeader';

export interface ParseSessionState {
  bulkFormatSettings: any;
  fileStack: any[];
  formatContexts: Map<string, any>;
}

export interface ParseHTMLWithNewSystemDeps {
  detectedLanguage: string;
  fileId: string;
  fileQueueLength?: number;
  formatInspector: any;
  html: string;
  languageConfigLoader: any;
  originalFile?: any;
  preMappedColumnMap?: any;
  progressCallback?: ((stage: string, details?: any) => void) | null;
  schemaRegistry: any;
  sessionState: ParseSessionState;
  smartHeaderMapper: any;
  universalParser: any;
}

export interface ParseHTMLWithNewSystemResult {
  columnMap: Record<string, any>;
  cutCells: CutCellCount[];
  data: any[];
  detectedLanguage: string;
  detectedType: string;
  formatContext: any;
  missingOptional: string[];
  missingRequired: string[];
}

export async function parseHTMLWithNewSystemData(
  deps: ParseHTMLWithNewSystemDeps
): Promise<ParseHTMLWithNewSystemResult> {
  const {
    html,
    detectedLanguage,
    fileId,
    fileQueueLength = 1,
    preMappedColumnMap = null,
    progressCallback = null,
    originalFile = null,
    languageConfigLoader,
    smartHeaderMapper,
    schemaRegistry,
    formatInspector,
    universalParser,
    sessionState
  } = deps;

  console.log(`[DataProcessor] Starting _parseHTMLWithNewSystem for fileId: ${fileId}`);
  const startTime = performance.now();

  const updateProgress = (stage: string, details: any = {}) => {
    if (progressCallback) {
      progressCallback(stage, details);
    }
  };

  updateProgress('detecting');
  const domParser = new DOMParser();
  const doc = domParser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table');

  if (!table) {
    throw new Error('Brak tabeli w pliku.');
  }

  console.log(`[DataProcessor] Table found, extracting headers...`);
  const headers = [...table.querySelectorAll('th')].map((th) => normalizeHeader(th.textContent));
  console.log(`[DataProcessor] Extracted ${headers.length} headers`);

  updateProgress('mapping', { stage: 'loading_config' });
  console.log(`[DataProcessor] Loading language config for: ${detectedLanguage}`);
  let languageConfig: any;
  try {
    languageConfig = await languageConfigLoader.loadLanguageConfig(detectedLanguage);
    console.log(`[DataProcessor] Language config loaded successfully`);
  } catch (error) {
    console.error('[DataProcessor] Failed to load language config for', detectedLanguage, error);
    throw new Error(
      `Nie można załadować konfiguracji języka ${detectedLanguage}. Sprawdź czy plik config/languages/${detectedLanguage}.json istnieje.`
    );
  }

  let columnMap: Record<string, any>;
  let unmappedHeaders: any[] = [];
  let ambiguousHeaders: any[] = [];

  if (preMappedColumnMap) {
    console.log(`[DataProcessor] Using pre-mapped columnMap`);
    updateProgress('mapping', { stage: 'using_premapped' });
    columnMap = preMappedColumnMap;

    const mappingResult = smartHeaderMapper.mapHeaders(headers, languageConfig, schemaRegistry);
    unmappedHeaders = mappingResult.unmappedHeaders || [];
    ambiguousHeaders = mappingResult.ambiguousHeaders || [];

    headers.forEach((header, index) => {
      if (
        !preMappedColumnMap[index] &&
        !unmappedHeaders.find((h: any) => (h.header || h) === header)
      ) {
        unmappedHeaders.push({ header, index });
      }
    });

    console.log(`[DataProcessor] Using pre-mapped columnMap, skipping modal`);
  } else {
    updateProgress('mapping', { stage: 'mapping_headers' });
    console.log(`[DataProcessor] Mapping headers to schema IDs...`);
    const mappingResult = smartHeaderMapper.mapHeaders(headers, languageConfig, schemaRegistry);
    columnMap = mappingResult.columnMap || mappingResult;
    unmappedHeaders = mappingResult.unmappedHeaders || [];
    ambiguousHeaders = mappingResult.ambiguousHeaders || [];
    console.log(
      `[DataProcessor] Header mapping complete. Mapped: ${Object.keys(columnMap).length}, Unmapped: ${unmappedHeaders.length}, Ambiguous (low confidence): ${ambiguousHeaders.length}`
    );
  }

  let detectedType = detectFileType(columnMap, schemaRegistry);
  console.log(
    `[DataProcessor] Detected file type: ${detectedType.type} (attributes: ${detectedType.attributeCount}, statistics: ${detectedType.statisticCount}, total: ${detectedType.totalCount})`
  );

  let missingColumns = calculateMissingColumns(
    detectedType.type,
    columnMap,
    schemaRegistry,
    headers,
    languageConfig
  );
  console.log(
    `[DataProcessor] Missing required: ${missingColumns.missingRequired.length}, Missing optional: ${missingColumns.missingOptional.length}`
  );
  if (missingColumns.missingRequired.length > 0) {
    console.log(
      `[DataProcessor] Missing required columns: ${missingColumns.missingRequired.join(', ')}`
    );
  }
  if (missingColumns.missingOptional.length > 0) {
    console.log(
      `[DataProcessor] Missing optional columns: ${missingColumns.missingOptional.join(', ')}`
    );
  }
  if (ambiguousHeaders.length > 0) {
    console.log(
      `[DataProcessor] Ambiguous headers that may need verification: ${ambiguousHeaders.map((h: any) => `${h.header} (col ${h.index + 1})`).join(', ')}`
    );
  }

  if (
    !preMappedColumnMap &&
    (unmappedHeaders.length > 0 || ambiguousHeaders.length > 0) &&
    (window as any).HeaderMappingModal !== undefined
  ) {
    const loadingOverlay = document.querySelector('#loading-overlay');
    if (loadingOverlay) (loadingOverlay as HTMLElement).style.display = 'none';

    const seenIndices = new Set();
    const allHeadersToMap: any[] = [];

    for (const h of ambiguousHeaders) {
      allHeadersToMap.push({ ...h, isAmbiguous: true, isAutoMapped: true });
      seenIndices.add(h.index);
    }
    for (const h of unmappedHeaders) {
      if (!seenIndices.has(h.index)) {
        allHeadersToMap.push({ ...h, isAmbiguous: false, isAutoMapped: false });
        seenIndices.add(h.index);
      }
    }

    console.log(
      `[DataProcessor] Showing header mapping modal for ${unmappedHeaders.length} unmapped headers and ${ambiguousHeaders.length} ambiguous headers (${allHeadersToMap.length} total after deduplication)`
    );

    if (
      window.HeaderMappingModal === undefined ||
      typeof window.HeaderMappingModal !== 'function'
    ) {
      console.error(
        'HeaderMappingModal is not available. Make sure src/ui/HeaderMappingModal.js is loaded.'
      );
      throw new Error(
        'Modal mapowania nagłówków nie jest dostępny. Odśwież stronę i spróbuj ponownie.'
      );
    }

    const headerModal = new window.HeaderMappingModal();
    const headerFileName = fileId ? fileId.split('_').slice(0, -1).join('_') : 'unknown';
    const modalPromise = headerModal.show(
      allHeadersToMap,
      schemaRegistry,
      headers,
      languageConfig,
      columnMap,
      headerFileName
    );
    const timeoutPromise = new Promise<any>((resolve) => {
      setTimeout(() => {
        console.warn('[DataProcessor] Header mapping modal timeout - using empty mappings');
        resolve({});
      }, 30000);
    });

    const userMappings = await Promise.race([modalPromise, timeoutPromise]);

    if (loadingOverlay) (loadingOverlay as HTMLElement).style.display = 'flex';

    if (userMappings === null) {
      console.log(
        '[DataProcessor] User cancelled modal. Removing low-confidence auto-mappings for ambiguous/unmapped headers.'
      );

      for (const ambiguousHeader of ambiguousHeaders) {
        if (columnMap[ambiguousHeader.index] === ambiguousHeader.autoMappedTo) {
          delete columnMap[ambiguousHeader.index];
          console.log(
            `[DataProcessor] Removed auto-mapping for ambiguous header "${ambiguousHeader.header}" at column ${ambiguousHeader.index + 1}`
          );
        }
      }
      for (const unmappedHeader of unmappedHeaders) {
        delete columnMap[unmappedHeader.index];
        console.log(
          `[DataProcessor] Removed mapping for unmapped header "${unmappedHeader.header}" at column ${unmappedHeader.index + 1}`
        );
      }

      detectedType = detectFileType(columnMap, schemaRegistry);
      missingColumns = calculateMissingColumns(
        detectedType.type,
        columnMap,
        schemaRegistry,
        headers,
        languageConfig
      );
      console.log(
        `[DataProcessor] Recalculated after cancel - File type: ${detectedType.type}, Missing required: ${missingColumns.missingRequired.length}, Missing optional: ${missingColumns.missingOptional.length}`
      );

      const hasRequiredColumns =
        columnMap &&
        Object.values(columnMap).includes('basic_uid') &&
        Object.values(columnMap).includes('basic_name');

      if (hasRequiredColumns) {
        console.log(
          '[DataProcessor] Required columns (UID, Name) still present after removing ambiguous mappings. Allowing file processing.'
        );
      } else {
        throw new Error(
          'Anulowano mapowanie nagłówków. Plik nie został wczytany. Wymagane kolumny (UID i Name) nie zostały zmapowane.'
        );
      }
    } else if (userMappings) {
      for (const [columnIndexStr, schemaId] of Object.entries(
        userMappings as Record<string, any>
      )) {
        const columnIndex = parseInt(columnIndexStr);
        if (isNaN(columnIndex) || columnIndex < 0 || columnIndex >= headers.length) {
          console.warn(`[DataProcessor] Invalid column index in userMappings: ${columnIndexStr}`);
          continue;
        }
        if (schemaId) {
          columnMap[columnIndex] = schemaId;
        } else {
          delete columnMap[columnIndex];
        }
      }

      console.log(
        `[DataProcessor] Recalculating file type and missing columns after user mappings...`
      );
      detectedType = detectFileType(columnMap, schemaRegistry);
      console.log(
        `[DataProcessor] Updated file type: ${detectedType.type} (attributes: ${detectedType.attributeCount}, statistics: ${detectedType.statisticCount}, total: ${detectedType.totalCount})`
      );

      missingColumns = calculateMissingColumns(
        detectedType.type,
        columnMap,
        schemaRegistry,
        headers,
        languageConfig
      );
      console.log(
        `[DataProcessor] Updated missing columns - Required: ${missingColumns.missingRequired.length}, Optional: ${missingColumns.missingOptional.length}`
      );
      if (missingColumns.missingRequired.length > 0) {
        console.log(
          `[DataProcessor] Missing required columns: ${missingColumns.missingRequired.join(', ')}`
        );
      }
      if (missingColumns.missingOptional.length > 0) {
        console.log(
          `[DataProcessor] Missing optional columns: ${missingColumns.missingOptional.join(', ')}`
        );
      }
    }
  }

  const { cutCells, rows: fileData } = readImportedRows({
    columnIndices: Object.keys(columnMap)
      .map((colIndexStr) => parseInt(colIndexStr, 10))
      .filter((colIdx) => !isNaN(colIdx)),
    headers,
    rows: [...table.querySelectorAll('tr')].slice(1)
  });

  let formatContext: any = null;
  let normalizationConfig: any = null;
  let skipFormatModal = false;

  if (sessionState.bulkFormatSettings) {
    formatContext = { fileId, ...sessionState.bulkFormatSettings };
    normalizationConfig = NormalizationConfig.fromSettings(sessionState.bulkFormatSettings);
    skipFormatModal = true;
    console.log('[DataProcessor] Using bulk format settings from instance');
  } else {
    try {
      const bulkSettingsStr = sessionStorage.getItem('bulkFormatSettings');
      if (bulkSettingsStr) {
        const bulkSettings = JSON.parse(bulkSettingsStr);
        formatContext = { fileId, ...bulkSettings };
        normalizationConfig = NormalizationConfig.fromSettings(bulkSettings);
        sessionState.bulkFormatSettings = bulkSettings;
        skipFormatModal = true;
        console.log('[DataProcessor] Using bulk format settings from sessionStorage');
      }
    } catch (error) {
      console.warn(
        '[DataProcessor] Failed to parse bulk format settings from sessionStorage:',
        error
      );
    }
  }

  if (formatContext) {
    if (!normalizationConfig) {
      normalizationConfig = new NormalizationConfig();
    }
  } else {
    updateProgress('analyzing', { rowCount: fileData.length, stage: 'format_analysis' });
    console.log(`[DataProcessor] Analyzing format for ${fileData.length} rows...`);
    formatContext = formatInspector.analyze(
      fileData,
      columnMap,
      schemaRegistry,
      fileId,
      languageConfig
    );
    console.log(
      `[DataProcessor] Format analysis complete. Confidence: ${formatContext.confidence}`
    );

    let shouldShowModal = false;
    let showOptionalModal = false;

    const structureHash = computeStructureHash(headers);
    if ((window as any).fileMetaHelper && originalFile) {
      (window as any).fileMetaHelper.recordFile(originalFile, structureHash).catch((error: any) => {
        console.warn('[FileMeta] Failed to record structureHash', error);
      });
    }

    if (formatContext.confidence < 0.9) {
      const savedSettings = localStorage.getItem(`structureHash_${structureHash}`);
      if (savedSettings) {
        try {
          const settings = JSON.parse(savedSettings);
          if (settings.formatSettings) {
            formatContext = { fileId, ...settings.formatSettings };
            normalizationConfig = NormalizationConfig.fromSettings(settings.formatSettings);
            skipFormatModal = true;
            console.log(
              `[DataProcessor] Using saved format settings for structure hash ${structureHash} (confidence < 0.9)`
            );
          }
        } catch (error) {
          console.warn('[DataProcessor] Failed to parse saved settings:', error);
        }
      }
    } else {
      console.log(
        `[DataProcessor] High confidence (>= 0.9), ignoring localStorage. File format takes priority.`
      );
    }

    if (formatContext.wageFrequencies && formatContext.wageFrequencies.size > 1) {
      shouldShowModal = true;
      skipFormatModal = false;
      console.log('[DataProcessor] Mixed wage frequencies detected - showing modal');
    }
    if (formatContext.unknownUnits && formatContext.unknownUnits.length > 0) {
      shouldShowModal = true;
      skipFormatModal = false;
      console.log('[DataProcessor] Unknown units detected - showing modal');
    }
    if (
      !shouldShowModal &&
      !skipFormatModal &&
      formatContext.confidence >= 0.8 &&
      formatContext.confidence < 0.9
    ) {
      showOptionalModal = true;
      console.log('[DataProcessor] Medium confidence (0.8-0.9) - showing optional modal');
    }
    if (!skipFormatModal && formatContext.confidence < 0.8) {
      shouldShowModal = true;
      console.log('[DataProcessor] Low confidence (< 0.8) - showing modal');
    }

    const FormatVerificationModal = (window as any).FormatVerificationModal;
    if ((shouldShowModal || showOptionalModal) && FormatVerificationModal !== undefined) {
      const loadingOverlay = document.querySelector('#loading-overlay');
      if (loadingOverlay) (loadingOverlay as HTMLElement).style.display = 'none';

      console.log(
        `[DataProcessor] Showing format verification modal (confidence: ${formatContext.confidence}, optional: ${showOptionalModal})`
      );

      if (typeof FormatVerificationModal !== 'function') {
        console.error(
          'FormatVerificationModal is not available. Make sure src/ui/FormatVerificationModal.js is loaded.'
        );
        throw new Error(
          'Modal weryfikacji formatu nie jest dostępny. Odśwież stronę i spróbuj ponownie.'
        );
      }

      const formatModal = new (window as any).FormatVerificationModal();
      const formatFileName = fileId ? fileId.split('_').slice(0, -1).join('_') : 'unknown';
      const modalPromise = formatModal.show(
        formatContext,
        fileData.slice(0, 10),
        fileQueueLength,
        formatFileName,
        showOptionalModal
      );
      const timeoutPromise = new Promise<any>((resolve) => {
        setTimeout(() => {
          console.warn('[DataProcessor] Format verification modal timeout - using defaults');
          resolve(null);
        }, 30000);
      });

      const userChoices = await Promise.race([modalPromise, timeoutPromise]);

      if (loadingOverlay) (loadingOverlay as HTMLElement).style.display = 'flex';

      if (userChoices?.cancelled && userChoices.cancelAll) {
        console.log('[DataProcessor] User cancelled all remaining files');
        sessionState.fileStack.splice(0);
        throw new Error('Przetwarzanie zostało anulowane przez użytkownika (Anuluj wszystkie).');
      }

      if (userChoices) {
        formatContext = { ...formatContext, ...userChoices };
        normalizationConfig = NormalizationConfig.fromSettings(userChoices);

        if (userChoices.applyToAll) {
          sessionState.bulkFormatSettings = userChoices;
          sessionStorage.setItem('bulkFormatSettings', JSON.stringify(userChoices));
        }

        const hashForSave = computeStructureHash(headers);
        const settingsToSave = {
          formatSettings: userChoices,
          hash: hashForSave,
          headers: headers.toSorted(compareCodeUnits),
          timestamp: Date.now()
        };
        localStorage.setItem(`structureHash_${hashForSave}`, JSON.stringify(settingsToSave));
      } else {
        if (showOptionalModal) {
          console.log('[DataProcessor] Optional modal skipped - using detected formats');
          normalizationConfig = new NormalizationConfig();
        } else {
          throw new Error('Anulowano weryfikację formatu. Plik nie został wczytany.');
        }
      }
    } else {
      if (!normalizationConfig) {
        normalizationConfig = new NormalizationConfig();
      }
    }
  }

  sessionState.formatContexts.set(fileId, formatContext);

  updateProgress('parsing', { stage: 'parsing_rows', totalRows: fileData.length });
  console.log(`[DataProcessor] Parsing ${fileData.length} rows (using WorkerParser)...`);

  const parsedColumns = new Map<string, any[]>();
  const parsingPromises: Promise<void>[] = [];

  for (const colIndexStr in columnMap) {
    const colIdx = parseInt(colIndexStr, 10);
    if (isNaN(colIdx)) continue;

    const schemaId = columnMap[colIdx];
    if (!schemaId) continue;

    const schemaInfo = schemaRegistry.get(schemaId);
    if (!schemaInfo) continue;

    const columnValues = fileData.map((row: any) => {
      const val = row[colIdx];
      return val !== undefined && val !== null ? val : '';
    });

    const parseTask = async () => {
      try {
        let results: any[];
        if ((window as any).WorkerParser) {
          results = await (window as any).WorkerParser.parseBatch(
            columnValues,
            schemaInfo,
            formatContext,
            normalizationConfig,
            languageConfig
          );
        } else {
          console.warn(
            '[DataProcessor] WorkerParser not found, falling back to synchronous parser'
          );
          results = columnValues.map((v: any) =>
            universalParser.parse(v, schemaInfo, formatContext, normalizationConfig, languageConfig)
          );
        }
        parsedColumns.set(schemaId, results);
      } catch (error) {
        console.error('[DataProcessor] Error parsing column', schemaId, error);
        parsedColumns.set(schemaId, Array.from<null>({ length: columnValues.length }).fill(null));
      }
    };
    parsingPromises.push(parseTask());
  }

  await Promise.all(parsingPromises);

  // English keys of the mapped columns. A localized header equal to one of them (Polish "Str" is
  // Long Shots, English "Str" is Strength) is not written, so it cannot overwrite that column.
  const legacyNames = new Map<string, null | string>(
    Object.values(columnMap).map((schemaId: string) => [
      schemaId,
      schemaRegistry.getLegacyHeaderName(schemaId) as null | string
    ])
  );
  const canonicalKeys = new Set([...legacyNames.values()].filter(Boolean));

  const data: any[] = [];
  for (const [i, row] of fileData.entries()) {
    const obj: Record<string, any> = {};

    for (const colIndexStr in columnMap) {
      const colIdx = parseInt(colIndexStr, 10);
      if (isNaN(colIdx)) continue;

      const schemaId = columnMap[colIdx];
      if (!schemaId) continue;

      const rawValue = row[colIdx];
      const colResults = parsedColumns.get(schemaId);
      const parsedValue = colResults ? colResults[i] : null;

      // Dates: the schema field gets the ISO string, displayed columns keep the FM text.
      const isDate = schemaRegistry.get(schemaId)?.type === 'date';
      const displayValue =
        !isDate && parsedValue !== null && parsedValue !== undefined ? parsedValue : rawValue;

      const originalHeader = headers[colIdx];
      const legacyName = legacyNames.get(String(schemaId)) ?? null;
      if (originalHeader && (originalHeader === legacyName || !canonicalKeys.has(originalHeader))) {
        obj[originalHeader] = displayValue;
      }
      if (legacyName && legacyName !== originalHeader) {
        obj[legacyName] = displayValue;
      }

      obj[schemaId] = parsedValue;

      if (
        typeof rawValue === 'string' &&
        (rawValue.includes('–') || rawValue.includes('-') || rawValue.includes('\u2014')) &&
        /\d/.test(rawValue)
      ) {
        obj[`${schemaId}_display`] = rawValue.trim();
      }

      if (schemaId === 'basic_dob' && rawValue && !obj.basic_age) {
        const age = extractAgeFromDob(rawValue);
        if (age !== null) {
          obj.basic_age = age;
          obj.Age = age;
        }
      }
    }

    data.push(obj);
  }

  updateProgress('complete');
  const endTime = performance.now();
  console.log(
    `[DataProcessor] _parseHTMLWithNewSystem complete. Parsed ${data.length} rows in ${(endTime - startTime).toFixed(2)}ms`
  );

  return {
    columnMap,
    cutCells,
    data,
    detectedLanguage,
    detectedType: detectedType.type,
    formatContext,
    missingOptional: missingColumns.missingOptional,
    missingRequired: missingColumns.missingRequired
  };
}
