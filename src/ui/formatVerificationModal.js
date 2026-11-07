/**
 * FormatVerificationModal - Modal for verifying detected formats
 * Exports to: window.FormatVerificationModal
 *
 * Features:
 * - List of detected formats with value preview
 * - Ability to change each format
 * - Preview of example values before/after parsing
 * - Bulk Action - option to apply settings to all files in queue
 * - Save user choices to localStorage as suggestions
 */
import { escapeHtmlAttribute as esc } from '../utils/escapeHtmlAttribute';

class FormatVerificationModal {
  fileQueueLength = 1;

  modalElement = null;

  resolveCallback = null;

  constructor() {}

  /**
   * Create modal HTML
   * @param formatContext - Format context
   * @param sampleValues - Sample values
   * @param optional - If true, show "Skip" button
   */
  _createModal(formatContext, sampleValues, optional = false) {
    // Remove existing modal if any (should not happen with queue, but safety check)
    const existing = document.querySelector('#format-verification-modal');
    if (existing) {
      console.warn(
        '[FormatVerificationModal] Found existing modal, removing it. This should not happen with ModalQueue.'
      );
      existing.remove();
    }

    // Get filename for display
    const displayFileName = formatContext.fileId
      ? formatContext.fileId.split('_').slice(0, -1).join('_')
      : 'nieznany plik';

    const modal = document.createElement('div');
    modal.id = 'format-verification-modal';
    modal.className =
      'fixed inset-0 bg-[#F5F5F0] bg-opacity-95 backdrop-blur-sm flex items-center justify-center';
    modal.style.zIndex = '10000'; // Higher than loading overlay (9999)
    modal.innerHTML = `
            <div class="bg-white border-2 border-ink shadow-[8px_8px_0px_black] p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <h2 class="text-xl font-black uppercase text-ink mb-4">Wykryto formaty danych: <span class="text-blue-600">${esc(displayFileName)}</span></h2>
                <p class="mb-4 text-sm text-gray-700">${optional ? 'System przeanalizował ten plik z średnią pewnością. Możesz zweryfikować formaty lub użyć wykrytych wartości:' : 'System przeanalizował ten plik. Potwierdź formaty:'}</p>
                
                ${
                  this.fileQueueLength > 1
                    ? `
                    <div id="bulk-action-section" class="mb-4 p-3 bg-yellow-50 border-2 border-ink">
                        <label class="flex items-center">
                            <input type="checkbox" id="apply-to-all-files" class="mr-2 accent-black">
                            <span class="text-sm font-semibold text-ink">Zastosuj te ustawienia do wszystkich obecnie wgrywanych plików</span>
                        </label>
                        <p class="text-xs text-gray-600 mt-1 font-mono">System wykrył podobne niejasności w innych plikach</p>
                    </div>
                `
                    : ''
                }
                
                <div class="space-y-4">
                    <div class="format-item">
                        <label class="block font-semibold mb-2 text-ink">Separator dziesiętny:</label>
                        <select id="decimal-separator" class="input-paper w-full p-2">
                            <option value="." ${formatContext.decimalSeparator === '.' ? 'selected' : ''}>Kropka (.)</option>
                            <option value="," ${formatContext.decimalSeparator === ',' ? 'selected' : ''}>Przecinek (,)</option>
                        </select>
                        <div class="text-xs text-gray-600 mt-1 font-mono">Przykład: 12${formatContext.decimalSeparator || '.'}50</div>
                    </div>
                    
                    <div class="format-item">
                        <label class="block font-semibold mb-2 text-ink">Separator tysięcy:</label>
                        <select id="thousand-separator" class="input-paper w-full p-2">
                            <option value="">Brak</option>
                            <option value="." ${formatContext.thousandSeparator === '.' ? 'selected' : ''}>Kropka (.)</option>
                            <option value="," ${formatContext.thousandSeparator === ',' ? 'selected' : ''}>Przecinek (,)</option>
                            <option value=" " ${formatContext.thousandSeparator === ' ' ? 'selected' : ''}>Spacja ( )</option>
                        </select>
                        <div class="text-xs text-gray-600 mt-1 font-mono">Przykład: 1${formatContext.thousandSeparator || '.'}000</div>
                    </div>
                    
                    <div class="format-item">
                        <label class="block font-semibold mb-2 text-ink">Format dat:</label>
                        <select id="date-format" class="input-paper w-full p-2">
                            <option value="DD/MM" ${formatContext.dateFormat?.format === 'DD/MM' ? 'selected' : ''}>DD/MM (dzień/miesiąc)</option>
                            <option value="MM/DD" ${formatContext.dateFormat?.format === 'MM/DD' ? 'selected' : ''}>MM/DD (miesiąc/dzień)</option>
                            <option value="YYYY/MM/DD" ${formatContext.dateFormat?.format === 'YYYY/MM/DD' ? 'selected' : ''}>YYYY/MM/DD</option>
                        </select>
                        <div class="text-xs text-gray-600 mt-1 font-mono">Przykład: 13/01/2000</div>
                    </div>
                    
                    ${
                      formatContext.wageFrequencies && formatContext.wageFrequencies.size > 0
                        ? `
                        <div class="format-item">
                            <label class="block font-semibold mb-2 text-ink">Normalizacja płac:</label>
                            <p class="text-xs text-gray-600 mb-2 font-mono">Wykryte częstotliwości: ${esc([...formatContext.wageFrequencies].join(', '))}</p>
                            <select id="target-wage-frequency" class="input-paper w-full p-2">
                                <option value="yearly">Rocznie</option>
                                <option value="monthly">Miesięcznie</option>
                                <option value="weekly">Tygodniowo</option>
                            </select>
                        </div>
                    `
                        : ''
                    }
                    
                    ${
                      formatContext.unknownUnits && formatContext.unknownUnits.length > 0
                        ? `
                        <div class="format-item">
                            <label class="block font-semibold mb-2 text-ink">Nieznane jednostki:</label>
                            <div class="space-y-2">
                                ${formatContext.unknownUnits
                                  .map(
                                    (unit, idx) => `
                                    <div class="p-2 border-2 border-ink">
                                        <div class="font-semibold text-ink">${esc(String(unit.unit))}</div>
                                        <div class="text-xs text-gray-600 font-mono">Przykład: ${esc(String(unit.example))}</div>
                                        <select id="unknown-unit-${idx}" class="input-paper w-full p-1 mt-1">
                                            <option value="ignore">Ignoruj</option>
                                            <option value="1000">Tysiące (x1000)</option>
                                            <option value="1000000">Miliony (x1000000)</option>
                                            <option value="custom">Ręczny mnożnik</option>
                                        </select>
                                    </div>
                                `
                                  )
                                  .join('')}
                            </div>
                        </div>
                    `
                        : ''
                    }
                </div>
                
                <div class="mt-6 flex justify-end space-x-3">
                    ${this.fileQueueLength > 1 ? `<button id="cancel-all-btn" class="btn-paper px-6 py-2 text-sm font-bold uppercase text-red-600 border-red-600 hover:bg-red-50 mr-auto">Anuluj wszystkie (${this.fileQueueLength})</button>` : ''}
                    ${optional ? `<button id="skip-btn" class="btn-paper px-6 py-2 text-sm font-bold uppercase">Pomiń</button>` : ''}
                    <button id="cancel-btn" class="btn-paper px-6 py-2 text-sm font-bold uppercase">Anuluj</button>
                    <button id="confirm-btn" class="btn-paper px-6 py-2 text-sm font-bold uppercase">Zatwierdź i Analizuj</button>
                </div>
            </div>
        `;

    document.body.append(modal);
    this.modalElement = modal;

    // Attach event listeners
    document.querySelector('#confirm-btn').addEventListener('click', () => this._onConfirm());
    document.querySelector('#cancel-btn').addEventListener('click', () => this._onCancel());

    if (this.fileQueueLength > 1) {
      const cancelAllBtn = document.querySelector('#cancel-all-btn');
      if (cancelAllBtn) {
        cancelAllBtn.addEventListener('click', () => this._onCancelAll());
      }
    }

    // Add skip button listener if optional modal
    if (optional) {
      const skipBtn = document.querySelector('#skip-btn');
      if (skipBtn) {
        skipBtn.addEventListener('click', () => this._onSkip());
      }
    }

    // Close on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this._onCancel();
      }
    });
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
      this.resolveCallback(null);
    }
  }

  /**
   * Handle cancel all button
   */
  _onCancelAll() {
    if (confirm('Czy na pewno chcesz anulować przetwarzanie wszystkich pozostałych plików?')) {
      this._hideModal();

      // Cancel pending queue if available
      if (window.ModalQueue !== undefined) {
        window.ModalQueue.cancelAll('User cancelled via Format Verification Modal');
      }

      if (this.resolveCallback) {
        // Return special object indicating full cancellation
        this.resolveCallback({ cancelAll: true, cancelled: true });
      }
    }
  }

  /**
   * Handle confirm button
   */
  _onConfirm() {
    const choices = {
      applyToAll:
        (this.fileQueueLength > 1 && document.querySelector('#apply-to-all-files')?.checked) ||
        false,
      dateFormat: {
        format: document.querySelector('#date-format').value,
        separator: '/'
      },
      decimalSeparator: document.querySelector('#decimal-separator').value,
      targetWageFrequency: document.querySelector('#target-wage-frequency')?.value || 'yearly',
      thousandSeparator: document.querySelector('#thousand-separator').value || null,
      unknownUnitMultipliers: {}
    };

    // Collect unknown unit multipliers
    const unknownUnits = this.modalElement.querySelectorAll('[id^="unknown-unit-"]');
    unknownUnits.forEach((select, idx) => {
      const value = select.value;
      if (value !== 'ignore') {
        const unit = this.modalElement
          .querySelector(`#unknown-unit-${idx}`)
          .closest('.p-2')
          .querySelector('.font-semibold').textContent;
        choices.unknownUnitMultipliers[unit] = value === 'custom' ? 1 : parseFloat(value);
      }
    });

    this._hideModal();
    if (this.resolveCallback) {
      this.resolveCallback(choices);
    }
  }
  /**
   * Handle skip button (for optional modal)
   */
  _onSkip() {
    this._hideModal();
    if (this.resolveCallback) {
      // Return null to indicate skip - use detected formats without changes
      this.resolveCallback(null);
    }
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
   * Show modal and return user choices
   * @param formatContext - Detected format context
   * @param sampleValues - Sample values for preview
   * @param fileQueueLength - Number of files in queue
   * @param fileName - Name of the file (for queue identification)
   * @param optional - If true, show "Skip" button (optional modal)
   * @returns User choices with applyToAll flag, or null if skipped/cancelled
   */
  async show(
    formatContext,
    sampleValues = [],
    fileQueueLength = 1,
    fileName = 'unknown',
    optional = false
  ) {
    this.fileQueueLength = fileQueueLength;
    this.isOptional = optional;

    // Use modal queue if available, otherwise show directly (backward compatibility)
    if (window.ModalQueue === undefined) {
      // Fallback for backward compatibility
      return new Promise((resolve) => {
        this.resolveCallback = resolve;
        this._createModal(formatContext, sampleValues, optional);
        this._showModal();
      });
    } else {
      return window.ModalQueue.enqueue(
        async () => {
          return new Promise((resolve) => {
            this.resolveCallback = resolve;
            this._createModal(formatContext, sampleValues, optional);
            this._showModal();
          });
        },
        'format-verification',
        fileName
      );
    }
  }
}

// Export to global scope
try {
  window.FormatVerificationModal = FormatVerificationModal;
  console.log('[FormatVerificationModal] Successfully exported to window.FormatVerificationModal');
} catch (error) {
  console.error('[FormatVerificationModal] Error exporting to window:', error);
  // Ensure it's at least defined, even if there was an error
  window.FormatVerificationModal = FormatVerificationModal;
}
