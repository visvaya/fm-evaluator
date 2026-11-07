/**
 * ModalQueue - Singleton queue manager for modals
 * Ensures modals are shown one at a time, in order
 * Exports to: window.ModalQueue
 */
class ModalQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.currentModal = null;
    this.activeFocusTrap = null;
  }

  /**
   * Process the queue sequentially
   */
  async _processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`[ModalQueue] Starting queue processing. Queue length: ${this.queue.length}`);

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      this.currentModal = item;

      try {
        console.log(`[ModalQueue] Showing ${item.modalType} modal for file: ${item.fileName}`);

        // Wait for the modal to be shown and user to interact
        const result = await item.modalFunction();

        console.log(`[ModalQueue] ${item.modalType} modal completed for file: ${item.fileName}`);

        // Resolve the promise with the result
        item.resolve(result);
      } catch (error) {
        console.error(
          `[ModalQueue] Error in ${item.modalType} modal for file: ${item.fileName}:`,
          error
        );
        item.reject(error);
      } finally {
        // Deactivate focus trap when modal closes
        this.deactivateFocusTrap();
        this.currentModal = null;

        // Small delay between modals to ensure smooth transition
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    this.isProcessing = false;
    console.log(`[ModalQueue] Queue processing completed`);
  }

  /**
   * Activate focus trap for a modal element
   * @param modalElement - The modal container element
   * @param options - Focus trap options
   */
  activateFocusTrap(modalElement, options = {}) {
    // Check if FocusTrap is available from runtime
    const FocusTrap = window.fmFocusTrap || window.FocusTrap;
    if (!FocusTrap || !FocusTrap.create) {
      console.warn('[ModalQueue] FocusTrap not available');
      return null;
    }

    // Deactivate any existing trap
    this.deactivateFocusTrap();

    try {
      this.activeFocusTrap = FocusTrap.create(modalElement, {
        escapeDeactivates: options.escapeDeactivates !== false,
        initialFocus: options.initialFocus || null,
        onDeactivate: () => {
          this.activeFocusTrap = null;
          if (options.onDeactivate) options.onDeactivate();
        },
        onEscape: options.onEscape,
        returnFocus: true
      });
      this.activeFocusTrap.activate();
      console.log('[ModalQueue] Focus trap activated for modal');
      return this.activeFocusTrap;
    } catch (error) {
      console.warn('[ModalQueue] Failed to activate focus trap:', error);
      return null;
    }
  }

  /**
   * Clear the queue and cancel all pending modals
   * @param reason - Reason for cancellation
   */
  cancelAll(reason = 'User cancelled all operations') {
    console.log(`[ModalQueue] Cancelling all tasks. Reason: ${reason}`);

    // Reject all pending items
    this.queue.forEach((item) => {
      item.reject(new Error(reason));
    });

    this.queue = [];
    // Note: We don't change isProcessing here because the current modal
    // still needs to finish/resolve on its own.
    // The loop in _processQueue will exit naturally when queue is empty.
  }

  /**
   * Deactivate the current focus trap
   */
  deactivateFocusTrap() {
    if (this.activeFocusTrap) {
      try {
        this.activeFocusTrap.deactivate();
      } catch (error) {
        console.warn('[ModalQueue] Failed to deactivate focus trap:', error);
      }
      this.activeFocusTrap = null;
    }
  }

  /**
   * Add a modal to the queue
   * @param modalFunction - Async function that shows the modal and returns a Promise
   * @param modalType - Type identifier for the modal (e.g., 'header-mapping', 'format-verification')
   * @param fileName - Name of the file this modal is for (for debugging)
   * @param options - Options object
   * @param options.priority - 'normal' (default) or 'immediate' (skips queue, ideal for nested modals)
   * @returns Promise that resolves when the modal is shown and user interacts with it
   */
  async enqueue(modalFunction, modalType = 'unknown', fileName = 'unknown', options = {}) {
    const priority = options.priority || 'normal';

    if (priority === 'immediate') {
      console.log(`[ModalQueue] Processing IMMEDIATE ${modalType} modal for file: ${fileName}`);
      // Execute immediately, bypassing the queue
      // This allows nested modals (modal calling another modal)
      try {
        return await modalFunction();
      } catch (error) {
        console.error(`[ModalQueue] Error in immediate ${modalType} modal:`, error);
        throw error;
      }
    }

    return new Promise((resolve, reject) => {
      this.queue.push({
        fileName,
        modalFunction,
        modalType,
        reject,
        resolve
      });

      console.log(
        `[ModalQueue] Enqueued ${modalType} modal for file: ${fileName}. Queue length: ${this.queue.length}`
      );

      // Start processing if not already processing
      if (!this.isProcessing) {
        this._processQueue();
      }
    });
  }

  /**
   * Get pending items count (excluding current)
   * @returns
   */
  getPendingCount() {
    return this.queue.length;
  }

  /**
   * Get current queue length
   * @returns
   */
  getQueueLength() {
    return this.queue.length;
  }

  /**
   * Check if queue is processing
   * @returns
   */
  isQueueProcessing() {
    return this.isProcessing;
  }
}

// Create singleton instance
window.ModalQueue = new ModalQueue();
