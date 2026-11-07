/**
 * ContextResolver - Resolves ambiguous headers using context and Global Anchors
 * Exports to: window.ContextResolver
 *
 * Key principle: For sparse views (views with few columns, e.g., only 5-10),
 * an algorithm based solely on neighbors may fail. Global Anchors check for
 * the presence of headers from the same category in the entire file, even if far away.
 */
class ContextResolver {
  constructor() {
    // Check dependencies
    if (window.SchemaRegistry === undefined) {
      throw new TypeError('SchemaRegistry must be loaded before ContextResolver');
    }
  }

  /**
   * Krok 2: Calculate confidence based on score, score difference, and duplicate status
   * @param bestScore - Best score achieved
   * @param scoreDifference - Difference between best and second best score
   * @param alreadyMapped - Whether the best match is already mapped
   * @returns 'high'|'medium'|'low'
   */
  _calculateConfidence(bestScore, scoreDifference, alreadyMapped) {
    let confidence = 'low';

    // Confidence thresholds:
    // High: bestScore >= 4 AND scoreDifference >= 2 (clear winner with good score)
    // Medium: bestScore >= 2 AND scoreDifference >= 1 (decent score with some separation)
    // Low: everything else
    if (bestScore >= 4 && scoreDifference >= 2) {
      confidence = 'high';
    } else if (bestScore >= 2 && scoreDifference >= 1) {
      confidence = 'medium';
    }

    // If already mapped, reduce confidence but don't force to 'low' if score is high
    // This handles cases where duplicate detection correctly identifies the right mapping
    if (alreadyMapped) {
      if (bestScore >= 4 && scoreDifference >= 2) {
        // High score even with duplicate - keep medium confidence
        confidence = 'medium';
      } else {
        // Medium or low score with duplicate - force low confidence
        confidence = 'low';
      }
    }

    return confidence;
  }

  /**
   * Krok 3 & 8: Handle duplicate mapping - find alternative or require user verification
   * @param bestMatch - Best matching schemaId
   * @param alreadyMapped - Whether bestMatch is already mapped
   * @param scores - Array of {schemaId, score} objects
   * @param mappedSchemaIds - Set of already mapped schemaIds
   * @param header - Header name (for logging)
   * @param index - Header index (for logging)
   * @param bestScore - Best score (for logging)
   * @returns Resolution result or null if should continue with bestMatch
   */
  _handleDuplicateMapping(
    bestMatch,
    alreadyMapped,
    scores,
    mappedSchemaIds,
    header,
    index,
    bestScore
  ) {
    // If already mapped and we have alternatives, prefer the best alternative
    if (alreadyMapped && scores.length > 1) {
      // Sort scores and find the best unmapped alternative
      const sortedScores = scores.sort((a, b) => b.score - a.score);
      for (const scoreEntry of sortedScores) {
        if (!mappedSchemaIds.has(scoreEntry.schemaId)) {
          // Found an unmapped alternative - use it but with lower confidence
          const scoreDifference = sortedScores[0].score - scoreEntry.score;
          const confidence = this._calculateConfidence(scoreEntry.score, scoreDifference, false);

          console.log(
            `[ContextResolver] Duplicate detected for "${header}" at column ${index + 1}. Best match ${bestMatch} already mapped. Using alternative ${scoreEntry.schemaId} instead.`
          );

          return {
            alternatives: sortedScores
              .filter((s) => s.schemaId !== scoreEntry.schemaId)
              .map((s) => s.schemaId),
            confidence,
            schemaId: scoreEntry.schemaId,
            score: scoreEntry.score
          };
        }
      }

      // Krok 8: All alternatives also mapped - require user verification
      console.warn(
        `[ContextResolver] All possible mappings for "${header}" at column ${index + 1} are already mapped. Requiring user verification.`
      );
      return {
        alternatives: sortedScores.slice(1).map((s) => s.schemaId),
        confidence: 'low',
        requiresUserVerification: true,
        schemaId: bestMatch,
        score: bestScore
      };
    }

    return null; // No duplicate or no alternatives - continue with bestMatch
  }

  /**
   * Resolve ambiguous header by category-based context when no explicit config exists
   * @param header - Header name to resolve
   * @param index - Index of header in headers array
   * @param allHeaders - All headers in the file
   * @param config - Language configuration object
   * @param schemaRegistry - Schema registry instance
   * @param existingColumnMap - Map of already mapped column indices to schemaIds (for duplicate detection)
   * @returns or null
   */
  _resolveByCategory(header, index, allHeaders, config, schemaRegistry, existingColumnMap = {}) {
    // Normalize header by removing zero-width spaces (common in Chinese/Japanese/Korean files)
    // This ensures consistent matching with language config which has normalized headers
    const normalizedHeader = header.replaceAll('\u200B', '');
    const normalizedAllHeaders = allHeaders.map((h) => h.replaceAll('\u200B', ''));

    // Krok 7: Use Set for O(1) duplicate checking
    const mappedSchemaIds = new Set(Object.values(existingColumnMap));

    // Krok 4: Build category cache once at the beginning
    const categoryCache = new Map(); // category -> array of schemaIds
    // Find all schemaIds that have this header
    // Use normalized header for comparison with config.headers (which are normalized)
    const possibleSchemaIds = [];
    if (config.headers) {
      for (const [schemaId, headerVariants] of Object.entries(config.headers)) {
        const variants = Array.isArray(headerVariants) ? headerVariants : [headerVariants];
        if (variants.includes(normalizedHeader)) {
          possibleSchemaIds.push(schemaId);
        }
      }
    }

    // If only one possibility, return it with high confidence
    if (possibleSchemaIds.length === 1) {
      return {
        alternatives: [],
        confidence: 'high',
        schemaId: possibleSchemaIds[0],
        score: 10 // High score for single possibility
      };
    }

    // If no possibilities, return null
    if (possibleSchemaIds.length === 0) {
      return null;
    }

    // Multiple possibilities - use category-based scoring
    // Use normalized headers for consistent comparison with config.headers (which are normalized)
    const neighbors = normalizedAllHeaders.slice(
      Math.max(0, index - 5),
      Math.min(normalizedAllHeaders.length, index + 6)
    );
    const neighborsSet = new Set(neighbors); // Krok 4: Use Set for faster lookups
    const allHeadersSet = new Set(normalizedAllHeaders); // Krok 4: Use Set for faster lookups

    let bestMatch = null;
    let bestScore = 0;
    const scores = []; // Track all scores for comparison

    for (const schemaId of possibleSchemaIds) {
      const schemaInfo = schemaRegistry.get(schemaId);
      if (!schemaInfo || !schemaInfo.category) {
        continue;
      }

      let score = 0;
      const category = schemaInfo.category;

      // Krok 4: Use cached category headers
      let categoryHeaders = categoryCache.get(category);
      if (!categoryHeaders) {
        categoryHeaders = schemaRegistry.getByCategory(category);
        categoryCache.set(category, categoryHeaders);
      }

      // Check for other headers from the same category in the file
      for (const catHeaderId of categoryHeaders) {
        const catHeaderVariants = (config.headers && config.headers[catHeaderId]) || [];
        if (catHeaderVariants.some((v) => allHeadersSet.has(v))) {
          score += 1; // Global anchor bonus
        }
        // Check neighbors for higher score
        if (catHeaderVariants.some((v) => neighborsSet.has(v))) {
          score += 2; // Local neighbor bonus
        }
      }

      // Check for competing categories (negative scoring)
      // For example: if "Prz" could be attribute_leadership (mental) or statistic_interceptions (statistic)
      // and we see other statistic headers but no mental headers, prefer statistic_interceptions
      for (const otherSchemaId of possibleSchemaIds) {
        if (otherSchemaId === schemaId) continue;

        const otherSchemaInfo = schemaRegistry.get(otherSchemaId);
        if (!otherSchemaInfo || !otherSchemaInfo.category) continue;

        const competingCategory = otherSchemaInfo.category;
        // Krok 4: Use cached competing headers
        let competingHeaders = categoryCache.get(competingCategory);
        if (!competingHeaders) {
          competingHeaders = schemaRegistry.getByCategory(competingCategory);
          categoryCache.set(competingCategory, competingHeaders);
        }

        const hasCompeting = competingHeaders.some((id) => {
          const variants = (config.headers && config.headers[id]) || [];
          return variants.some((v) => allHeadersSet.has(v));
        });

        if (!hasCompeting) {
          score += 3; // High bonus if competing category is absent
        }
      }

      scores.push({ schemaId, score });

      if (score > bestScore) {
        bestScore = score;
        bestMatch = schemaId;
      }
    }

    if (!bestMatch) return null;

    // Krok 7: Check if bestMatch is already mapped using Set (O(1) instead of O(n))
    const alreadyMapped = mappedSchemaIds.has(bestMatch);

    // Krok 3 & 8: Use shared method for handling duplicates
    const duplicateResult = this._handleDuplicateMapping(
      bestMatch,
      alreadyMapped,
      scores,
      mappedSchemaIds,
      header,
      index,
      bestScore
    );

    if (duplicateResult) {
      return duplicateResult;
    }

    // Krok 2: Use shared method for calculating confidence
    const sortedScores = scores.sort((a, b) => b.score - a.score);
    const scoreDifference =
      sortedScores.length > 1 ? sortedScores[0].score - sortedScores[1].score : bestScore;

    const confidence = this._calculateConfidence(bestScore, scoreDifference, alreadyMapped);

    return {
      alternatives: sortedScores.slice(1).map((s) => s.schemaId),
      confidence,
      schemaId: bestMatch,
      score: bestScore
    };
  }

  /**
   * Check Global Anchors for a header
   * @param header - Header name
   * @param allHeaders - All headers in the file
   * @param config - Language configuration object
   * @param schemaRegistry - Schema registry instance
   * @returns Global anchor information or null
   */
  checkGlobalAnchors(header, allHeaders, config, schemaRegistry) {
    // This method can be used for additional global anchor checks
    // Currently, the logic is integrated into resolveAmbiguous
    return null;
  }

  /**
   * Resolve ambiguous header using context scoring with Global Anchors
   * @param header - Header name to resolve
   * @param index - Index of header in headers array
   * @param allHeaders - All headers in the file
   * @param config - Language configuration object
   * @param schemaRegistry - Schema registry instance
   * @param existingColumnMap - Map of already mapped column indices to schemaIds (for duplicate detection)
   * @returns or null
   */
  resolveAmbiguous(header, index, allHeaders, config, schemaRegistry, existingColumnMap = {}) {
    // Normalize header by removing zero-width spaces (common in Chinese/Japanese/Korean files)
    // This ensures consistent matching with language config which has normalized headers
    const normalizedHeader = header.replaceAll('\u200B', '');
    const normalizedAllHeaders = allHeaders.map((h) => h.replaceAll('\u200B', ''));

    // Krok 5: Validate ambiguous config exists and has correct structure
    if (!config || !config.ambiguous) {
      return this._resolveByCategory(
        normalizedHeader,
        index,
        normalizedAllHeaders,
        config,
        schemaRegistry,
        existingColumnMap
      );
    }

    const ambiguousConfig = config.ambiguous[normalizedHeader];

    // If no explicit ambiguous config, try to resolve by finding all possible schemaIds
    if (
      !ambiguousConfig ||
      !ambiguousConfig.context ||
      typeof ambiguousConfig.context !== 'object'
    ) {
      return this._resolveByCategory(
        normalizedHeader,
        index,
        normalizedAllHeaders,
        config,
        schemaRegistry,
        existingColumnMap
      );
    }

    // Krok 7: Use Set for O(1) duplicate checking
    const mappedSchemaIds = new Set(Object.values(existingColumnMap));

    // Krok 4: Build category cache once at the beginning
    const categoryCache = new Map(); // category -> Set of schemaIds

    // 1. Local Context (neighbors within 5 columns radius)
    // Use normalized headers for consistent comparison with config.neighbors (which are normalized)
    const neighbors = normalizedAllHeaders.slice(
      Math.max(0, index - 5),
      Math.min(normalizedAllHeaders.length, index + 6)
    );

    // 2. Global Context (all headers in file for sparse views)
    // Use normalized headers for consistent comparison with config.headers (which are normalized)
    const globalHeaders = normalizedAllHeaders;
    const globalHeadersSet = new Set(globalHeaders); // Krok 4: Use Set for faster lookups

    let bestMatch = null;
    let bestScore = 0;
    const scores = []; // Track all scores for comparison

    for (const [contextType, contextConfig] of Object.entries(ambiguousConfig.context)) {
      let score = 0;

      // Local neighbors scoring (works great in full views)
      for (const neighbor of neighbors) {
        if (contextConfig.neighbors && contextConfig.neighbors.includes(neighbor)) {
          score += 2; // Higher weight for local neighbors
        }
      }

      // Global anchors scoring (for sparse views - critical!)
      const targetSchemaId = contextConfig.target;
      const schemaInfo = schemaRegistry.get(targetSchemaId);

      if (schemaInfo && schemaInfo.category) {
        // Krok 4: Use cached category headers
        let categoryHeaders = categoryCache.get(schemaInfo.category);
        if (!categoryHeaders) {
          categoryHeaders = schemaRegistry.getByCategory(schemaInfo.category);
          categoryCache.set(schemaInfo.category, categoryHeaders);
        }

        // Krok 4: Build category headers set once per category
        for (const catHeaderId of categoryHeaders) {
          const catHeaderVariants = (config.headers && config.headers[catHeaderId]) || [];
          if (catHeaderVariants.some((v) => globalHeadersSet.has(v))) {
            score += 1; // Lower weight for global anchors
          }
        }

        // Negative scoring: check both local neighbors and global context
        // Local neighbors are more important for distinguishing similar headers in the same file
        // (e.g., "Nat" in column 6 should not have physical headers nearby)
        // (e.g., "Nat" in column 100 should not have basic headers nearby)
        // Global check is still useful for sparse views where categories don't overlap
        if (contextConfig.excludesCategory) {
          // Krok 4: Use cached excluded headers
          let excludedHeaders = categoryCache.get(contextConfig.excludesCategory);
          if (!excludedHeaders) {
            excludedHeaders = schemaRegistry.getByCategory(contextConfig.excludesCategory);
            categoryCache.set(contextConfig.excludesCategory, excludedHeaders);
          }

          // Check local neighbors first (more important for dense views)
          const neighborsSet = new Set(neighbors); // Krok 4: Use Set for faster lookups
          const hasExcludedInNeighbors = excludedHeaders.some((id) => {
            const variants = (config.headers && config.headers[id]) || [];
            return variants.some((v) => neighborsSet.has(v));
          });

          // Check global context (for sparse views)
          const hasExcludedGlobally = excludedHeaders.some((id) => {
            const variants = (config.headers && config.headers[id]) || [];
            return variants.some((v) => globalHeadersSet.has(v));
          });

          // Higher bonus if excluded category is not in local neighbors
          if (!hasExcludedInNeighbors) {
            score += 4; // High bonus for absence of competing category in local context
          } else if (!hasExcludedGlobally) {
            // Lower bonus if excluded category exists locally but not globally
            // (useful for sparse views where categories are separated)
            score += 2;
          }
        }
      }

      scores.push({ schemaId: contextConfig.target, score });

      if (score > bestScore) {
        bestScore = score;
        bestMatch = contextConfig.target;
      }
    }

    if (!bestMatch) return null;

    // Krok 7: Check if bestMatch is already mapped using Set (O(1) instead of O(n))
    const alreadyMapped = mappedSchemaIds.has(bestMatch);

    // Krok 8: Handle case when all alternatives are mapped
    // Krok 3: Use shared method for handling duplicates
    const duplicateResult = this._handleDuplicateMapping(
      bestMatch,
      alreadyMapped,
      scores,
      mappedSchemaIds,
      header,
      index,
      bestScore
    );

    if (duplicateResult) {
      return duplicateResult;
    }

    // Krok 2: Use shared method for calculating confidence
    const sortedScores = scores.sort((a, b) => b.score - a.score);
    const scoreDifference =
      sortedScores.length > 1 ? sortedScores[0].score - sortedScores[1].score : bestScore;

    const confidence = this._calculateConfidence(bestScore, scoreDifference, alreadyMapped);

    return {
      alternatives: sortedScores.slice(1).map((s) => s.schemaId),
      confidence,
      schemaId: bestMatch,
      score: bestScore
    };
  }
}

// Export to global scope
window.ContextResolver = ContextResolver;
