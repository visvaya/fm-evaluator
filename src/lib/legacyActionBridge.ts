/* eslint-disable fp/no-let, fp/no-mutation */

type ContinueImportFlowCallback = () => void;
type RunAnalysisCallback = (selectedEngine?: string, selectedPosition?: string) => any[];

let continueImportFlowCallback: ContinueImportFlowCallback | null = null;
let runAnalysisCallback: null | RunAnalysisCallback = null;

export function registerLegacyActionBridge(callbacks: {
  continueImportFlow?: ContinueImportFlowCallback;
  runAnalysis?: RunAnalysisCallback;
}): void {
  if (callbacks.continueImportFlow) {
    continueImportFlowCallback = callbacks.continueImportFlow;
  }

  if (callbacks.runAnalysis) {
    runAnalysisCallback = callbacks.runAnalysis;
  }
}

export function continueImportFlowProcessing(): void {
  continueImportFlowCallback?.();
}

export function rerunCurrentAnalysis(selectedEngine?: string, selectedPosition?: string): any[] {
  return runAnalysisCallback?.(selectedEngine, selectedPosition) ?? [];
}
