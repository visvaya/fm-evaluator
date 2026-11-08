// Phase 5E: DataProcessor migrated from app/main.js
import {
  ATTRIBUTE_COEFFS,
  NEGATIVE_STATS,
  PER90_TO_SOURCE,
  PERCENTAGE_TO_SOURCE,
  POSITION_FILTERS,
  SKIPPABLE_STATS,
  STATS_CONFIG,
  ZERO_SKIPPABLE_STATS
} from '../config/scoreConfig';
import { UniversalParser } from '../parsing/universalParser.js';
import { useSettingsStore } from '../store/useSettingsStore';

import { calculateMarketEfficiency } from './calculateMarketEfficiency';
import { calculateMissingColumns } from './calculateMissingColumns';
import { calculateScoresData } from './calculateScores';
import { calculateScoresForAllRolesData } from './calculateScoresForAllRoles';
import { createCleanValue, type CleanValueFn } from './cleanValue';
import { deriveProcessorStats } from './deriveStats';
import { detectFileType } from './detectFileType';
import { getNumericValue } from './getNumericValue';
import { mergeProcessorData } from './mergeData';
import { normalizeHeader } from './normalizeHeader';
import { parseFeet } from './parseFeet';
import { parseHTMLWithNewSystemData } from './parseHTMLWithNewSystem';
import { parsePositions } from './parsePositions';
import {
  normalizeClubName,
  getTeamPossession,
  setTeamPossession,
  removeTeamPossession,
  resetTeamPossession,
  updatePossessionMapFromText
} from './possessionUtils';

const getSettings = () => useSettingsStore.getState().settings;

export class DataProcessor {
  attributes: any[];
  bulkFormatSettings: any;
  calculatedScores: any[];
  defaultPossession: number;
  detectedFileLanguages: any[];
  fileStack: any[];
  filterDistributionCache: Map<any, any>;
  formatContexts: Map<string, any>;
  formatInspector: any;
  isFirstCalculation: boolean;
  languageConfigLoader: any;

  mergedData: any[];
  schemaRegistry: any;
  smartHeaderMapper: any;
  statDistributionCache: Map<any, any>;
  stats: any[];
  teamPossessionMap: Map<string, number>;
  universalParser: any;
  // New system modules
  useNewSystem: boolean;
  valueCache: Map<any, any>;
  private _cleanValueFn: CleanValueFn;

  constructor() {
    this.attributes = [];
    this.stats = [];
    this.mergedData = [];
    this.calculatedScores = [];
    this.valueCache = new Map();
    this._cleanValueFn = createCleanValue(this.valueCache);
    this.statDistributionCache = new Map();
    this.filterDistributionCache = new Map();
    this.isFirstCalculation = true;
    // Map: normalized club name -> average possession in %
    this.teamPossessionMap = new Map();
    // Local fallback (usually consistent with settings.defaultPossession)
    this.defaultPossession = 50;
    // File stack: array of { file: File, name: string, type: string, rowCount: number, html: string, missingRequired: [], missingOptional: [] }
    this.fileStack = [];

    // New system: module initialization
    this._initNewSystem();
  }

  _calculateMissingColumns(
    fileType,
    columnMap,
    schemaRegistry,
    headers = [],
    languageConfig = null
  ) {
    return calculateMissingColumns(fileType, columnMap, schemaRegistry, headers, languageConfig);
  }

  _detectFileType(columnMap, schemaRegistry) {
    return detectFileType(columnMap, schemaRegistry);
  }

  /**
   * Initialize new mapping system modules
   */
  _initNewSystem() {
    // Check if new system modules are available
    const missing = [];
    if ((window as any).LanguageConfigLoader === undefined) missing.push('LanguageConfigLoader');
    if ((window as any).SchemaRegistry === undefined) missing.push('SchemaRegistry');
    if ((window as any).SmartHeaderMapper === undefined) missing.push('SmartHeaderMapper');
    if ((window as any).FormatInspector === undefined) missing.push('FormatInspector');

    if (missing.length > 0) {
      // Only warn once to avoid console noise, but don't set useNewSystem=false permanently
      if (this.isFirstCalculation) {
        console.warn(
          `[DataProcessor] New mapping system modules not loaded yet: ${missing.join(', ')}. Will retry on next access.`
        );
      }
      return;
    }

    if (this.useNewSystem && this.smartHeaderMapper) {
      return;
    }

    console.log('[DataProcessor] Initializing new mapping system modules...');
    this.useNewSystem = true;
    this.languageConfigLoader = new (window as any).LanguageConfigLoader();
    this.schemaRegistry = new (window as any).SchemaRegistry();
    this.smartHeaderMapper = new (window as any).SmartHeaderMapper();
    this.formatInspector = new (window as any).FormatInspector();
    this.universalParser = new UniversalParser();

    // Per-file format contexts
    if (!this.formatContexts) this.formatContexts = new Map();

    // Session storage for Bulk Action
    this.bulkFormatSettings = null;
  }

  async _parseHTMLWithNewSystem(
    html,
    detectedLanguage,
    fileId,
    fileQueueLength = 1,
    preMappedColumnMap = null,
    progressCallback = null,
    originalFile = null
  ) {
    const sessionState = {
      bulkFormatSettings: this.bulkFormatSettings,
      formatContexts: this.formatContexts,
      fileStack: this.fileStack
    };
    const result = await parseHTMLWithNewSystemData({
      html,
      detectedLanguage,
      fileId,
      fileQueueLength,
      preMappedColumnMap,
      progressCallback,
      originalFile,
      languageConfigLoader: this.languageConfigLoader,
      smartHeaderMapper: this.smartHeaderMapper,
      schemaRegistry: this.schemaRegistry,
      formatInspector: this.formatInspector,
      universalParser: this.universalParser,
      sessionState
    });
    this.bulkFormatSettings = sessionState.bulkFormatSettings;
    return result;
  }

  // Helper to safely parse numbers from PL/EN strings
  calculateMarketEfficiency(
    sortedPlayers,
    valueKey,
    windowSize = 40,
    scoreKey = 'totalScore',
    filterFn = null
  ) {
    return calculateMarketEfficiency(sortedPlayers, valueKey, windowSize, scoreKey, filterFn);
  }

  calculateScores(engine, position) {
    const result = calculateScoresData({
      engine,
      position,
      mergedData: this.mergedData,
      cleanValue: (value) => this.cleanValue(value),
      deriveStats: (player) => this.deriveStats(player),
      calculateScoresForAllRoles: (eng) => this.calculateScoresForAllRoles(eng),
      filterDistributionCache: this.filterDistributionCache,
      statDistributionCache: this.statDistributionCache,
      isFirstCalculation: this.isFirstCalculation
    });
    this.calculatedScores = result.calculatedScores;
    this.isFirstCalculation = result.isFirstCalculation;
  }

  // Calculate scores for all roles for all players (without normalization)
  calculateScoresForAllRoles(engine) {
    return calculateScoresForAllRolesData({
      cleanValue: (value) => this.cleanValue(value),
      engine,
      mergedData: this.mergedData,
      statDistributionCache: this.statDistributionCache,
      threshold: this.getMinMins()
    });
  }

  cleanValue(val, isWage = false) {
    return this._cleanValueFn(val, isWage);
  }

  deriveStats(player) {
    deriveProcessorStats({
      cleanValue: (value) => this.cleanValue(value),
      defaultPossession: this.defaultPossession,
      getTeamPossession: (clubName) => this.getTeamPossession(clubName),
      player
    });
  }

  detectFileLanguage(headers) {
    // Try to initialize if not yet done
    if (!this.useNewSystem || !this.smartHeaderMapper) {
      this._initNewSystem();
    }

    // Use new system (required)
    if (!this.useNewSystem || !this.smartHeaderMapper) {
      throw new Error(
        'Nowy system mapowania jest wymagany. Upewnij się, że wszystkie moduły są załadowane. Sprawdź konsolę (F12) pod kątem błędów ładowania plików .js.'
      );
    }
    return this.smartHeaderMapper.detectLanguage(headers);
  }

  // Helper function to get minimum minutes threshold
  // Returns user-set minMins if available, otherwise adaptiveMinMins
  getMinMins() {
    const s = getSettings();
    return s.minMins === null ? s.adaptiveMinMins || null : s.minMins;
  }

  getNumericValue(val, useAverageForRanges = false, isWage = false) {
    return getNumericValue(val, useAverageForRanges, isWage);
  }

  getTeamPossession(clubName) {
    return getTeamPossession(this.teamPossessionMap, clubName);
  }

  mergeData(mergeMode = false) {
    this.isFirstCalculation = true;
    this.mergedData = mergeProcessorData(
      {
        attributes: this.attributes,
        cleanValue: (value) => this.cleanValue(value),
        fileStack: this.fileStack,
        parseFeet: (player) => this.parseFeet(player),
        parsePositions: (position) => this.parsePositions(position),
        stats: this.stats
      },
      mergeMode
    );
    this.statDistributionCache.clear();
    this.filterDistributionCache.clear();
    this.valueCache.clear();
  }

  normalizeClubName(name) {
    return normalizeClubName(name);
  }

  normalizeHeader(header) {
    return normalizeHeader(header);
  }
  parseFeet(player) {
    return parseFeet(player);
  }
  async parseHTML(
    html,
    forceType = null,
    append = false,
    file = null,
    preMappedColumnMap = null,
    progressCallback = null,
    batchInfo = null
  ) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const table = doc.querySelector('table');
    if (!table) throw new Error('Brak tabeli w pliku.');
    // Normalize headers: remove extra spaces, normalize Unicode
    const headers = [...table.querySelectorAll('th')].map((th) =>
      this.normalizeHeader(th.textContent)
    );

    // Detect file language automatically
    const detectedLanguage = this.detectFileLanguage(headers);

    // Store detected language in processor for later use
    if (!this.detectedFileLanguages) {
      this.detectedFileLanguages = [];
    }
    this.detectedFileLanguages.push(detectedLanguage);

    // Use new system (required)
    if (!this.useNewSystem || !file) {
      throw new Error(
        'Nowy system mapowania jest wymagany. Upewnij się, że wszystkie moduły są załadowane.'
      );
    }

    const fileId = `${file.name}_${Date.now()}`;
    // Calculate queue length for UI purposes
    // If batchInfo is provided, use it. Otherwise assume single file or use fileStack length as fallback
    const fileQueueLength = batchInfo
      ? batchInfo.total - batchInfo.current + 1
      : this.fileStack.length + 1;

    const result = await this._parseHTMLWithNewSystem(
      html,
      detectedLanguage,
      fileId,
      fileQueueLength,
      preMappedColumnMap,
      progressCallback,
      file
    );

    // Use detected type from result, or fallback to forceType if provided, or 'both' as default
    const type = result.detectedType || forceType || 'both';
    // Don't convert 'complete' to 'both' - complete files should stay complete

    // Store data based on type
    if (type === 'both' || type === 'complete') {
      if (append) {
        this.attributes.push(...result.data);
        this.stats.push(...result.data);
      } else {
        this.attributes = result.data;
        this.stats = result.data;
      }
    } else if (type === 'attr') {
      if (append) {
        this.attributes.push(...result.data);
      } else {
        this.attributes = result.data;
      }
    } else {
      if (append) {
        this.stats.push(...result.data);
      } else {
        this.stats = result.data;
      }
    }

    // Create file metadata
    const fileName = file ? file.name : 'unknown';
    const fileMetadata = {
      columnMap: result.columnMap,
      detectedLanguage: detectedLanguage,
      file: file,
      formatContext: result.formatContext,
      html: html,
      missingOptional: result.missingOptional || [],
      missingRequired: result.missingRequired || [],
      name: fileName,
      parsedData: result.data,
      rowCount: result.data.length,
      type: type, // Keep original type (complete, both, attr, stats)
      valid: true
    };

    // Add to file stack
    if (!append || file) {
      this.fileStack.unshift(fileMetadata);
    }

    // Clear bulk settings after processing all files
    if (sessionStorage.getItem('bulkFormatSettings')) {
      sessionStorage.removeItem('bulkFormatSettings');
      this.bulkFormatSettings = null;
    }

    // Return metadata
    if (file) {
      const typeLabels = {
        attr: 'Atrybuty',
        both: 'Niekompletny',
        complete: 'Kompletny',
        stats: 'Statystyki',
        unknown: 'Nieznany'
      };
      return {
        missingOptional: result.missingOptional || [],
        missingRequired: result.missingRequired || [],
        rowCount: result.data.length,
        type: typeLabels[type] || 'Nieznany',
        typeCode: type,
        valid: true
      };
    } else {
      if (type === 'both') return 'Niekompletny (Atrybuty + Statystyki)';
      if (type === 'attr') return 'Atrybuty';
      return 'Statystyki';
    }
  }

  parsePositions(str) {
    return parsePositions(str);
  }
  removeTeamPossession(clubName) {
    removeTeamPossession(this.teamPossessionMap, clubName);
  }

  resetTeamPossession() {
    resetTeamPossession(this.teamPossessionMap);
  }

  setTeamPossession(clubName, possession) {
    setTeamPossession(this.teamPossessionMap, clubName, possession);
  }

  updatePossessionMapFromText(textData) {
    updatePossessionMapFromText(this.teamPossessionMap, textData);
  }
}

export const processor = new DataProcessor();
