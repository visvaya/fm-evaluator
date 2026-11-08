/**
 * HeaderMappingModal - Modal for mapping unmapped headers
 * Exports to: window.HeaderMappingModal
 */
import { escapeHtmlAttribute as esc } from '../utils/escapeHtmlAttribute';

class HeaderMappingModal {
  isCheckMappingScenario = false;

  modalElement = null;

  resolveCallback = null;

  constructor() {
    // Flag to indicate if showing all headers (check mapping)
    this.headersToMap = []; // Store headers to map for change detection
  }

  /**
   * Create modal HTML
   * @param headersToMap - Headers to map (unmapped + ambiguous)
   * @param schemaRegistry - Schema registry
   * @param allHeaders - All headers in the file
   * @param languageConfig - Language configuration
   * @param columnMap - Map of column index to schema ID
   */
  _createModal(
    headersToMap,
    schemaRegistry,
    allHeaders = [],
    languageConfig = null,
    columnMap = {}
  ) {
    // Remove existing modal if any (should not happen with queue, but safety check)
    const existing = document.querySelector('#header-mapping-modal');
    if (existing) {
      console.warn(
        '[HeaderMappingModal] Found existing modal, removing it. This should not happen with ModalQueue.'
      );
      existing.remove();
    }

    // Get schema IDs in the order they appear in language config
    const getOrderedSchemaIds = () => {
      if (!languageConfig || !languageConfig.headers) {
        return schemaRegistry.getAllIds();
      }

      // Get order from language config
      const orderedIds = Object.keys(languageConfig.headers);
      const allIds = schemaRegistry.getAllIds();

      // Combine: ordered first, then any remaining
      const orderedSet = new Set(orderedIds);
      const remaining = allIds.filter((id) => !orderedSet.has(id));

      return [...orderedIds, ...remaining];
    };

    const allSchemaIds = getOrderedSchemaIds();
    const hasAmbiguous = headersToMap.some((h) => h.isAmbiguous && h.isAutoMapped);

    // Helper to get neighbors (one from each side) for a header
    const getNeighbors = (headerIndex) => {
      const neighbors = {
        left: null,
        right: null
      };

      if (headerIndex > 0 && allHeaders[headerIndex - 1]) {
        neighbors.left = allHeaders[headerIndex - 1];
      }

      if (headerIndex < allHeaders.length - 1 && allHeaders[headerIndex + 1]) {
        neighbors.right = allHeaders[headerIndex + 1];
      }

      return neighbors;
    };

    // Helper to get display name in user's language
    const getDisplayName = (schemaId) => {
      // First try to get name from language config (user's language)
      if (languageConfig && languageConfig.headers && languageConfig.headers[schemaId]) {
        const headerVariants = languageConfig.headers[schemaId];
        const headerName = Array.isArray(headerVariants) ? headerVariants[0] : headerVariants;
        if (headerName) {
          return esc(headerName);
        }
      }

      // Fallback to legacy name (English)
      const legacyName = schemaRegistry.getLegacyHeaderName
        ? schemaRegistry.getLegacyHeaderName(schemaId)
        : null;
      return esc(legacyName || schemaId);
    };

    // Helper to get column number for a schema ID (if already mapped)
    const getColumnNumber = (schemaId) => {
      for (const [colIndex, mappedSchemaId] of Object.entries(columnMap)) {
        if (mappedSchemaId === schemaId) {
          return parseInt(colIndex) + 1; // 1-based for user display
        }
      }
      return null;
    };

    const modal = document.createElement('div');
    modal.id = 'header-mapping-modal';
    modal.className =
      'fixed inset-0 bg-[#F5F5F0] bg-opacity-95 backdrop-blur-sm flex items-center justify-center';
    modal.style.zIndex = '10000'; // Higher than loading overlay (9999)

    // Create modal structure first (without select options for performance)
    modal.innerHTML = `
            <div class="bg-white border-2 border-ink shadow-[8px_8px_0px_black] p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <h2 class="text-xl font-black uppercase text-ink mb-4">Mapowanie nagłówków</h2>
                <p class="mb-4 text-sm text-gray-700">
                    ${
                      hasAmbiguous
                        ? 'Niektóre nagłówki zostały automatycznie zmapowane z niskim stopniem pewności. Sprawdź i popraw mapowanie jeśli potrzeba:'
                        : 'Niektóre nagłówki nie zostały automatycznie zmapowane. Wybierz odpowiednie mapowanie:'
                    }
                </p>
                
                <div id="headers-container" class="space-y-3">
                    <!-- Headers will be rendered here incrementally -->
                </div>
                
                <div class="mt-6 flex justify-end space-x-3">
                    <button id="cancel-header-btn" class="btn-paper px-6 py-2 text-sm font-bold uppercase">Anuluj</button>
                    <button id="confirm-header-btn" class="btn-paper px-6 py-2 text-sm font-bold uppercase">Zatwierdź</button>
                </div>
            </div>
        `;

    document.body.append(modal);
    this.modalElement = modal;

    // Render headers incrementally using requestAnimationFrame for better performance
    const container = modal.querySelector('#headers-container');
    const BATCH_SIZE = 5; // Render 5 headers at a time
    let currentIndex = 0;

    const renderBatch = () => {
      const endIndex = Math.min(currentIndex + BATCH_SIZE, headersToMap.length);

      for (let idx = currentIndex; idx < endIndex; idx++) {
        const item = headersToMap[idx];
        const isAmbiguous = item.isAmbiguous || false;
        const isAutoMapped = item.isAutoMapped || false;
        const autoMappedTo = item.autoMappedTo || null;
        const confidence = item.confidence || null;
        const alternatives = item.alternatives || [];

        // Get neighbors for ambiguous headers
        const neighbors = isAmbiguous ? getNeighbors(item.index) : { left: null, right: null };

        // Build select options efficiently
        const selectOptions = ['<option value="">-- Pomiń --</option>'];

        if (isAutoMapped) {
          const colNum = getColumnNumber(autoMappedTo);
          const colInfo = colNum ? `${colNum}. ` : '';
          selectOptions.push(
            `<option value="${esc(autoMappedTo)}" selected>${colInfo}${getDisplayName(autoMappedTo)} (obecne)</option>`
          );
        }

        // Add other options
        for (const schemaId of allSchemaIds) {
          if (isAutoMapped && schemaId === autoMappedTo) continue;
          const colNum = getColumnNumber(schemaId);
          const colInfo = colNum ? `${colNum}. ` : '';
          selectOptions.push(
            `<option value="${esc(schemaId)}">${colInfo}${getDisplayName(schemaId)}</option>`
          );
        }

        const headerDiv = document.createElement('div');
        headerDiv.className = `flex items-center space-x-3 p-3 border-2 ${isAmbiguous ? 'border-yellow-500 bg-yellow-50' : 'border-ink'}`;
        headerDiv.innerHTML = `
                    <div class="flex-1">
                        <div class="font-semibold text-ink">${esc(String(item.header))}</div>
                        <div class="text-xs text-gray-600 font-mono">Kolumna ${item.index + 1}</div>
                        ${
                          isAmbiguous && (neighbors.left || neighbors.right)
                            ? `
                            <div class="text-xs text-blue-600 mt-1">
                                <i class="fas fa-info-circle"></i> W okolicy: 
                                ${neighbors.left ? `<span class="font-mono">${esc(String(neighbors.left))}</span>` : ''}
                                ${neighbors.left && neighbors.right ? ' | ' : ''}
                                ${neighbors.right ? `<span class="font-mono">${esc(String(neighbors.right))}</span>` : ''}
                            </div>
                        `
                            : ''
                        }
                        ${
                          isAutoMapped
                            ? `
                            <div class="text-xs text-yellow-700 mt-1">
                                <i class="fas fa-info-circle"></i> Automatycznie zmapowane do: <code>${getDisplayName(autoMappedTo)}</code>
                                ${confidence ? ` (pewność: ${confidence === 'high' ? 'wysoka' : confidence === 'medium' ? 'średnia' : 'niska'})` : ''}
                            </div>
                            ${
                              alternatives.length > 0
                                ? `
                                <div class="text-xs text-gray-600 mt-1">
                                    Alternatywy: ${alternatives
                                      .map((alt) => {
                                        const colNum = getColumnNumber(alt);
                                        const colInfo = colNum ? ` (kolumna ${colNum})` : '';
                                        return `${getDisplayName(alt)}${colInfo}`;
                                      })
                                      .join(', ')}
                                </div>
                            `
                                : ''
                            }
                        `
                            : ''
                        }
                    </div>
                    <select id="header-mapping-${idx}" class="input-paper flex-1 p-2">
                        ${selectOptions.join('')}
                    </select>
                `;

        container.append(headerDiv);
      }

      currentIndex = endIndex;

      if (currentIndex < headersToMap.length) {
        // Continue rendering next batch
        requestAnimationFrame(renderBatch);
      }
    };

    // Start rendering
    requestAnimationFrame(renderBatch);

    // Store headersToMap for change detection
    this.headersToMap = headersToMap;

    // Attach event listeners
    document
      .querySelector('#confirm-header-btn')
      .addEventListener('click', () => this._onConfirm(headersToMap));
    document.querySelector('#cancel-header-btn').addEventListener('click', () => this._onCancel());

    // Close on outside click - check for unsaved changes first
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this._onOutsideClick();
      }
    });
  }

  /**
   * Check if there are unsaved changes in the modal
   * @returns True if there are unsaved changes
   */
  _hasUnsavedChanges() {
    if (!this.headersToMap || this.headersToMap.length === 0) {
      return false;
    }

    for (let idx = 0; idx < this.headersToMap.length; idx++) {
      const item = this.headersToMap[idx];
      const select = document.getElementById(`header-mapping-${idx}`);
      if (!select) continue;

      const schemaId = select.value;
      const previousSchemaId = item.autoMappedTo || null;

      // Check if current selection differs from initial state
      if (schemaId !== previousSchemaId) {
        return true;
      }
    }

    return false;
  }

  /**
   * Hide modal and remove from DOM
   */
  _hideModal() {
    if (this.modalElement) {
      this.modalElement.remove();
      this.modalElement = null;
    }
  }

  /**
   * Handle cancel button
   */
  _onCancel() {
    this._hideModal();
    if (this.resolveCallback) {
      // Return null to indicate cancellation (distinct from empty object which means "save without changes")
      this.resolveCallback(null);
    }
  }

  /**
   * Handle confirm button
   * @param headersToMap - Headers to map
   */
  _onConfirm(headersToMap) {
    // Return mappings by column index instead of header name to handle duplicate headers correctly
    // In "check mapping" scenario (all headers shown), return ALL mappings to ensure they are saved
    // In initial mapping scenario (only unmapped/ambiguous), return ALL mappings to confirm auto-mapped ones
    const mappings = {};

    headersToMap.forEach((item, idx) => {
      const select = document.getElementById(`header-mapping-${idx}`);
      const schemaId = select.value;

      if (this.isCheckMappingScenario) {
        // In "check mapping" scenario, return ALL mappings to ensure they are saved
        // This ensures that even if user doesn't change anything, all mappings are preserved
        if (schemaId) {
          mappings[item.index] = schemaId;
        } else {
          // User selected "skip" - mark as null to remove mapping
          mappings[item.index] = null;
        }
      } else {
        // In initial mapping scenario, return ALL mappings to confirm auto-mapped headers
        // This ensures that when user clicks "Save" without changes, auto-mapped headers are preserved
        if (schemaId) {
          // User confirmed the mapping (either kept existing or selected new one)
          mappings[item.index] = schemaId;
        } else {
          // User selected "skip" - mark as null to remove mapping
          mappings[item.index] = null;
        }
      }
    });

    this._hideModal();
    if (this.resolveCallback) {
      this.resolveCallback(mappings);
    }
  }
  /**
   * Handle outside click - always ask for confirmation before closing
   */
  _onOutsideClick() {
    // Always ask user if they want to close the modal
    const hasChanges = this._hasUnsavedChanges();
    const message = hasChanges
      ? 'Masz niezapisane zmiany w mapowaniu nagłówków. Czy na pewno chcesz zamknąć bez zapisywania zmian?'
      : 'Czy na pewno chcesz zamknąć modal mapowania nagłówków?';

    if (confirm(message)) {
      this._onCancel();
    }
    // If user clicks "Cancel" in confirm dialog, do nothing (keep modal open)
  }
  /**
   * Show modal
   */
  _showModal() {
    if (this.modalElement) {
      this.modalElement.style.display = 'flex';
    }
  }
  /**
   * Show modal for unmapped headers and ambiguous headers
   * @param headersToMap - Array of {index, header, isAmbiguous?, isAutoMapped?, autoMappedTo?, score?, confidence?, alternatives?} objects
   * @param schemaRegistry - Schema registry instance
   * @param allHeaders - All headers in the file (for showing neighbors)
   * @param languageConfig - Language configuration (for sorting schema IDs and showing names in user's language)
   * @param columnMap - Map of column index to schema ID (for showing column numbers)
   * @param fileName - Name of the file (for queue identification)
   * @returns Map of header to schema ID
   */
  async show(
    headersToMap,
    schemaRegistry,
    allHeaders = [],
    languageConfig = null,
    columnMap = {},
    fileName = 'unknown'
  ) {
    // Check if this is a "check mapping" scenario (all headers shown)
    // In "check mapping", we show ALL headers, so headersToMap.length === allHeaders.length
    this.isCheckMappingScenario =
      allHeaders.length > 0 && headersToMap.length === allHeaders.length;

    // Use modal queue if available, otherwise show directly (backward compatibility)
    if (window.ModalQueue === undefined) {
      // Fallback for backward compatibility
      return new Promise((resolve) => {
        this.resolveCallback = resolve;
        this._createModal(headersToMap, schemaRegistry, allHeaders, languageConfig, columnMap);
        this._showModal();
      });
    } else {
      return window.ModalQueue.enqueue(
        async () => {
          return new Promise((resolve) => {
            this.resolveCallback = resolve;
            this._createModal(headersToMap, schemaRegistry, allHeaders, languageConfig, columnMap);
            this._showModal();
          });
        },
        'header-mapping',
        fileName
      );
    }
  }
}

// Export to global scope
try {
  window.HeaderMappingModal = HeaderMappingModal;
  console.log('[HeaderMappingModal] Successfully exported to window.HeaderMappingModal');
} catch (error) {
  console.error('[HeaderMappingModal] Error exporting to window:', error);
  // Ensure it's at least defined, even if there was an error
  window.HeaderMappingModal = HeaderMappingModal;
}
