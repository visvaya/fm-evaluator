import Fuse from 'fuse.js';

/**
 * SmartHeaderMapper - Intelligent header mapping with matching hierarchy
 * Exports to: window.SmartHeaderMapper
 *
 * Matching hierarchy for performance:
 * 1. Exact Match (Hash Map) - O(1) direct mapping check
 * 2. Fuzzy Match (Fuse.js) - only for headers without Exact Match
 *
 * Features:
 * - Context-aware mapping for duplicates
 * - Global Anchors for sparse views
 * - Anchor-based positioning
 */
class SmartHeaderMapper {
  constructor() {
    // Check dependencies
    if (window.ContextResolver === undefined) {
      throw new TypeError('ContextResolver must be loaded before SmartHeaderMapper');
    }
    if (window.SchemaRegistry === undefined) {
      throw new TypeError('SchemaRegistry must be loaded before SmartHeaderMapper');
    }

    this.contextResolver = new window.ContextResolver();
    this.fuseInstances = new Map(); // Cache Fuse instances per language
  }

  /**
   * Build header to schema ID map from language config
   * Detects duplicate headers (same header name for multiple schema IDs)
   * @param languageConfig - Language configuration
   * @returns
   */
  _buildHeaderToSchemaMap(languageConfig) {
    const map = new Map();
    const duplicateHeaders = new Set();
    const headerCounts = new Map(); // Track how many times each header appears

    if (!languageConfig.headers) {
      return { duplicateHeaders, map };
    }

    // First pass: count occurrences of each header variant
    for (const headerVariants of Object.values(languageConfig.headers)) {
      const variants = Array.isArray(headerVariants) ? headerVariants : [headerVariants];
      for (const variant of variants) {
        headerCounts.set(variant, (headerCounts.get(variant) || 0) + 1);
      }
    }

    // Second pass: build map, but skip duplicates (they will be handled by ContextResolver)
    for (const [schemaId, headerVariants] of Object.entries(languageConfig.headers)) {
      const variants = Array.isArray(headerVariants) ? headerVariants : [headerVariants];
      for (const variant of variants) {
        if (headerCounts.get(variant) > 1) {
          // This header appears multiple times - mark as duplicate
          duplicateHeaders.add(variant);
          // Don't add to exact match map if it's a duplicate
        } else {
          // Unique header - safe to add to exact match map
          map.set(variant, schemaId);
        }
      }
    }

    return { duplicateHeaders, map };
  }

  /**
   * Fuzzy match using Fuse.js
   * @param header - Header to match
   * @param languageConfig - Language configuration
   * @returns Schema ID or null
   */
  _fuzzyMatch(header, languageConfig) {
    // Get or create Fuse instance for this language
    const langId = languageConfig.id;
    if (!this.fuseInstances.has(langId)) {
      const searchableHeaders = [];

      // Build searchable array from language config
      if (languageConfig.headers) {
        for (const [schemaId, headerVariants] of Object.entries(languageConfig.headers)) {
          const variants = Array.isArray(headerVariants) ? headerVariants : [headerVariants];
          for (const variant of variants) {
            searchableHeaders.push({
              header: variant,
              schemaId: schemaId
            });
          }
        }
      }

      const fuse = new Fuse(searchableHeaders, {
        includeScore: true,
        keys: ['header'],
        threshold: 0.4 // 0 = exact match, 1 = match anything
      });

      this.fuseInstances.set(langId, fuse);
    }

    const fuse = this.fuseInstances.get(langId);
    const results = fuse.search(header);

    if (results.length > 0 && results[0].score < 0.3) {
      return results[0].item.schemaId;
    }

    return null;
  }

  /**
   * Detect language based on unique headers
   * @param headers - Array of header names
   * @returns Detected language code (pl, en, en-us, de, fr, es, it, pt, nl, ru, da, sv, no, ja, ko, zh, tr, el)
   */
  detectLanguage(headers) {
    // Normalize headers by removing zero-width spaces (common in Chinese/Japanese/Korean files)
    const normalizedHeaders = new Set(headers.map((h) => h.replaceAll('\u200B', '')));

    // Language detection signatures (unique headers per language)
    const signatures = {
      da: ['Navn', 'UID', 'Acc', 'Det', 'Vis', 'Klub', 'Løn', 'Alder'],
      de: ['Name', 'UID', 'Ace', 'Esf', 'Übs', 'Verein', 'Gehalt', 'Alter'],
      el: ['Όνομα', 'ΜID', 'Acc', 'Det', 'Vis', 'Σύλλογος', 'Μισθός', 'Ηλικία'],
      en: [
        'Name',
        'UID',
        'Acc',
        'Wor',
        'Vis',
        'Club',
        'Wage',
        'DoB',
        'Clean Sheets',
        'Home-Grown Status'
      ],
      'en-us': [
        'Name',
        'UID',
        'Acc',
        'Wor',
        'Vis',
        'Club',
        'Salary',
        'DOB',
        'Shutouts',
        'Home Grown Status'
      ],
      es: ['Nombre', 'UID', 'Ace', 'Sac', 'Vis', 'Club', 'Sueldo', 'Edad'],
      fr: ['Nom', 'UID', 'Acc', 'Vol', 'Vis', 'Club', 'Salaire', 'Âge'],
      it: ['Nome', 'IDu', 'Acc', 'Det', 'Vis', 'Club', 'Stipendio', 'Età'],
      ja: ['名前', 'UID', 'Acc', 'Det', 'Vis', 'クラブ', '給与', '年齢'],
      ko: ['이름', 'ID', 'Acc', 'Det', 'Vis', '클럽', '급여', '나이'],
      nl: ['Naam', 'UID', 'Acc', 'Det', 'Vis', 'Club', 'Salaris', 'Leeftijd'],
      no: ['Navn', 'UID', 'Acc', 'Det', 'Vis', 'Klubb', 'Lønn', 'Alder'],
      pl: ['Nazwisko', 'Szb', 'Psp', 'Pra', 'Przg', 'Klub', 'Płaca', 'Wiek'],
      pt: ['Nome', 'IDU', 'Acc', 'Det', 'Vis', 'Clube', 'Salário', 'Idade'],
      ru: ['Имя', 'УИН', 'Acc', 'Det', 'Vis', 'Клуб', 'Зарплата', 'Возраст'],
      sv: ['Namn', 'UID', 'Acc', 'Det', 'Vis', 'Klubb', 'Lön', 'Ålder'],
      tr: ['İsim', 'ÖID', 'Acc', 'Det', 'Vis', 'Kulüp', 'Maaş', 'Yaş'],
      zh: ['姓名', '编号', 'Acc', 'Det', 'Vis', '俱乐部', '工资', '年龄']
    };

    const scores = {};

    for (const [lang, sigHeaders] of Object.entries(signatures)) {
      scores[lang] = 0;
      for (const sig of sigHeaders) {
        if (normalizedHeaders.has(sig)) {
          scores[lang]++;
        }
      }
    }

    // Find language with highest score
    let bestLang = 'en'; // Default to English
    let bestScore = scores['en'] || 0;

    for (const [lang, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestLang = lang;
      }
    }

    return bestLang;
  }

  /**
   * Find anchor headers (unique, easy to recognize)
   * @param headers - Array of headers
   * @returns Map of anchor type to index
   */
  findAnchors(headers) {
    const anchors = {
      name: null,
      uid: null
    };

    // Common anchor headers across languages
    const uidVariants = new Set([
      'EID',
      'ID',
      'IDU',
      'IDu',
      'IU',
      'ÖID',
      'UID',
      'ΜID',
      'УИН',
      '编号'
    ]);
    const nameVariants = new Set([
      'İsim',
      'Naam',
      'Name',
      'Namn',
      'Navn',
      'Nazwisko',
      'Nom',
      'Nombre',
      'Nome',
      'Όνομα',
      'Имя',
      '이름',
      '名前',
      '姓名'
    ]);

    for (const [i, header] of headers.entries()) {
      if (uidVariants.has(header) && anchors.uid === null) {
        anchors.uid = i;
      }

      if (nameVariants.has(header) && anchors.name === null) {
        anchors.name = i;
      }
    }

    return anchors;
  }

  /**
   * Map headers to Schema IDs using matching hierarchy
   * @param headers - Array of header names
   * @param languageConfig - Language configuration object
   * @param schemaRegistry - Schema registry instance
   * @returns Map of column index to schema ID, and unmapped headers
   */
  mapHeaders(headers, languageConfig, schemaRegistry) {
    // Normalize headers by removing zero-width spaces (common in Chinese/Japanese/Korean files)
    // Keep original headers for context/logging, but use normalized for matching
    const normalizedHeaders = headers.map((h) => h.replaceAll('\u200B', ''));

    const columnMap = {}; // columnIndex -> schemaId
    const unmappedHeaders = [];
    const ambiguousHeaders = []; // Headers that need user verification due to low confidence
    const { duplicateHeaders, map: headerToSchemaMap } =
      this._buildHeaderToSchemaMap(languageConfig);

    // Krok 1: Detect duplicates in actual file headers (not just in config)
    // Build Map<string, number[]> tracking positions of each header in the file
    // Use normalized headers for duplicate detection
    const headerPositions = new Map();
    for (const [i, header] of normalizedHeaders.entries()) {
      if (!headerPositions.has(header)) {
        headerPositions.set(header, []);
      }
      headerPositions.get(header).push(i);
    }

    // Unify duplicate detection: combine config duplicates and file duplicates
    const allDuplicateHeaders = new Set(duplicateHeaders);
    for (const [header, positions] of headerPositions.entries()) {
      if (positions.length > 1) {
        allDuplicateHeaders.add(header);
      }
    }

    // Krok 7: Use Set for O(1) duplicate checking instead of O(n) Object.keys().find()
    const mappedSchemaIds = new Set();

    // Confidence threshold - if below this, ask user
    // 'high' = only ask if low confidence, 'medium' = ask if low/medium confidence
    // Changed to 'high' to only ask for low confidence mappings (medium/high are usually correct)
    const CONFIDENCE_THRESHOLD = 'high';

    for (const [i, normalizedHeader] of normalizedHeaders.entries()) {
      const originalHeader = headers[i]; // Keep original for logging/context
      let schemaId = null;
      let resolutionInfo = null;

      // Krok 6: Order of checking optimization
      // 1. Check if header is ambiguous (duplicate or in ambiguous config)
      //    This must be checked FIRST, before exact match, to handle duplicates correctly.
      //    For non-duplicate headers without ambiguous config, we skip to exact match (faster).
      // Krok 1: Use unified duplicate detection (config + file duplicates)
      // Check both normalized and original header in ambiguous config
      if (
        allDuplicateHeaders.has(normalizedHeader) ||
        (languageConfig.ambiguous && languageConfig.ambiguous[normalizedHeader])
      ) {
        resolutionInfo = this.contextResolver.resolveAmbiguous(
          originalHeader, // Pass original header for context
          i,
          headers, // Pass original headers array for context
          languageConfig,
          schemaRegistry,
          columnMap // Pass existing columnMap to avoid duplicates
        );

        if (resolutionInfo) {
          schemaId = resolutionInfo.schemaId;

          // Krok 8: If requiresUserVerification is set, always add to ambiguousHeaders
          // Check confidence - if low/medium, add to ambiguousHeaders for user verification
          if (
            resolutionInfo.requiresUserVerification ||
            resolutionInfo.confidence === 'low' ||
            (CONFIDENCE_THRESHOLD === 'medium' && resolutionInfo.confidence === 'medium')
          ) {
            ambiguousHeaders.push({
              alternatives: resolutionInfo.alternatives || [],
              autoMappedTo: resolutionInfo.requiresUserVerification ? null : schemaId,
              confidence: resolutionInfo.confidence,
              header: originalHeader, // Use original header for display
              index: i,
              requiresUserVerification: resolutionInfo.requiresUserVerification || false,
              score: resolutionInfo.score
            });
            // Don't auto-map if user verification is required
            if (resolutionInfo.requiresUserVerification) {
              schemaId = null;
            }
          }
        }
      }
      // 2. Exact Match (Hash Map) - only if not ambiguous
      // Use normalized header for matching
      else if (headerToSchemaMap.has(normalizedHeader)) {
        schemaId = headerToSchemaMap.get(normalizedHeader);
      }
      // 3. Fuzzy Match (Fuse.js) - only if no exact match
      else {
        schemaId = this._fuzzyMatch(normalizedHeader, languageConfig);
      }

      if (schemaId && schemaRegistry.has(schemaId)) {
        // Krok 7: Check if this schemaId is already mapped using Set (O(1) instead of O(n))
        const alreadyMapped = mappedSchemaIds.has(schemaId);

        if (alreadyMapped) {
          // SchemaId already mapped - this is a duplicate
          // Find the existing column index for logging
          const existingColumnIndex = Object.keys(columnMap).find(
            (colIdx) => columnMap[colIdx] === schemaId
          );
          // If header is ambiguous, require user verification instead of auto-mapping
          const isAmbiguous =
            allDuplicateHeaders.has(normalizedHeader) ||
            (languageConfig.ambiguous && languageConfig.ambiguous[normalizedHeader]);

          if (isAmbiguous && resolutionInfo) {
            // Check if this header is already in ambiguousHeaders (to avoid duplicates)
            const existingAmbiguousIndex = ambiguousHeaders.findIndex(
              (h) => h.index === i && h.header === originalHeader
            );

            if (existingAmbiguousIndex === -1) {
              // Add to ambiguousHeaders for user verification
              // Don't auto-map duplicates for ambiguous headers
              ambiguousHeaders.push({
                alternatives: resolutionInfo.alternatives || [],
                autoMappedTo: null, // Don't suggest auto-mapping for duplicates
                confidence: 'low', // Force low confidence for duplicates
                duplicateOf: parseInt(existingColumnIndex),
                header: originalHeader, // Use original header for display
                index: i,
                isDuplicate: true,
                score: resolutionInfo.score
              });
              console.log(
                `[SmartHeaderMapper] Duplicate ambiguous header "${originalHeader}" at column ${i + 1} - already mapped at column ${parseInt(existingColumnIndex) + 1} to ${schemaId}. Requiring user verification.`
              );
            } else {
              // Update existing entry instead of adding duplicate
              ambiguousHeaders[existingAmbiguousIndex] = {
                alternatives: resolutionInfo.alternatives || [],
                autoMappedTo: null, // Don't suggest auto-mapping for duplicates
                confidence: 'low', // Force low confidence for duplicates
                duplicateOf: parseInt(existingColumnIndex),
                header: originalHeader, // Use original header for display
                index: i,
                isDuplicate: true,
                score: resolutionInfo.score
              };
              console.log(
                `[SmartHeaderMapper] Updated ambiguous header "${originalHeader}" at column ${i + 1} - duplicate detected (already mapped at column ${parseInt(existingColumnIndex) + 1} to ${schemaId}).`
              );
            }
          } else {
            // For non-ambiguous duplicates, still map but log warning
            console.warn(
              `[SmartHeaderMapper] Duplicate mapping: header "${originalHeader}" at column ${i + 1} maps to ${schemaId} which is already mapped at column ${parseInt(existingColumnIndex) + 1}`
            );
            columnMap[i] = schemaId;
          }
        } else {
          // No duplicate - safe to map
          columnMap[i] = schemaId;
          mappedSchemaIds.add(schemaId); // Krok 7: Track mapped schemaIds in Set
        }
      } else if (schemaId && !schemaRegistry.has(schemaId)) {
        // Schema ID exists in language config but not in SchemaRegistry
        // This means it's a deprecated/removed column - skip it silently
        console.log(
          `[SmartHeaderMapper] Skipping header "${originalHeader}" - schema ID "${schemaId}" not in SchemaRegistry`
        );
        // Don't add to unmappedHeaders - just skip it
      } else {
        // No mapping found - add to unmappedHeaders for user mapping
        unmappedHeaders.push({ header: originalHeader, index: i }); // Use original header
      }
    }

    return {
      ambiguousHeaders, // Return ambiguous headers for user verification
      columnMap,
      unmappedHeaders
    };
  }
}

// Export to global scope
window.SmartHeaderMapper = SmartHeaderMapper;
