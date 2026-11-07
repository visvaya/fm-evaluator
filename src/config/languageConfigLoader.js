/**
 * LanguageConfigLoader - Asynchronous loading of language configuration JSON files
 * Exports to: window.LanguageConfigLoader
 */
import { formatValidationErrors, validateLanguageConfig } from '../schema/contracts';

class LanguageConfigLoader {
  constructor() {
    this.cache = new Map();
    this.loadingPromises = new Map(); // Track ongoing loads to prevent duplicate requests
  }

  /**
   * Fetch configuration from JSON file
   * @param languageId - Language identifier
   * @returns Configuration object
   */
  async _fetchConfig(languageId) {
    const url = `/config/languages/${languageId}.json`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Failed to load language config for ${languageId}: ${response.status} ${response.statusText}`
        );
      }

      const config = await response.json();
      const validationResult = validateLanguageConfig(config);

      if (!validationResult.success) {
        const errorSummary = formatValidationErrors(validationResult.errors).join(', ');
        throw new Error(`Invalid language config for ${languageId}: ${errorSummary}`);
      }

      return validationResult.data;
    } catch (error) {
      // Enhanced error message for CORS issues
      if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
        throw new Error(
          `Cannot load language config for ${languageId}. ` +
            `If running locally (file://), use a local HTTP server (e.g., 'python -m http.server 8000'). ` +
            `Original error: ${error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Clear cache for a specific language or all languages
   * @param languageId - Language identifier or null to clear all
   */
  clearCache(languageId = null) {
    if (languageId) {
      this.cache.delete(languageId);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cached configuration without loading
   * @param languageId - Language identifier
   * @returns Cached configuration or null
   */
  getCachedConfig(languageId) {
    return this.cache.get(languageId) || null;
  }

  /**
   * Load language configuration from JSON file
   * @param languageId - Language identifier (pl, en, en-us, de, fr, es, it, pt, nl, ru, da, sv, no, ja, ko, zh, tr, el)
   * @returns Language configuration object
   */
  async loadLanguageConfig(languageId) {
    // Check cache first
    if (this.cache.has(languageId)) {
      return this.cache.get(languageId);
    }

    // Check if already loading
    if (this.loadingPromises.has(languageId)) {
      return this.loadingPromises.get(languageId);
    }

    // Start loading
    const loadPromise = this._fetchConfig(languageId);
    this.loadingPromises.set(languageId, loadPromise);

    try {
      const config = await loadPromise;
      this.cache.set(languageId, config);
      return config;
    } catch (error) {
      this.loadingPromises.delete(languageId);
      throw error;
    } finally {
      this.loadingPromises.delete(languageId);
    }
  }

  /**
   * Preload multiple language configurations
   * @param languageIds - Array of language identifiers
   * @returns Object mapping languageId to config
   */
  async preloadConfigs(languageIds) {
    const promises = languageIds.map((id) =>
      this.loadLanguageConfig(id).then((config) => ({ config, id }))
    );

    const results = await Promise.all(promises);
    const configMap = {};

    results.forEach(({ config, id }) => {
      configMap[id] = config;
    });

    return configMap;
  }
}

// Export to global scope
window.LanguageConfigLoader = LanguageConfigLoader;
