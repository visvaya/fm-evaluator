export interface OpenColumnFilterRequest {
  anchorEl?: HTMLElement | null;
  columnId: string;
  focusInput?: boolean;
  returnFocusEl?: HTMLElement | null;
  type?: string;
}

export interface ColumnFilterController {
  close: (options?: { restoreFocus?: boolean }) => void;
  isOpen: () => boolean;
  open: (request: OpenColumnFilterRequest) => boolean;
}

let controller: ColumnFilterController | null = null;

export function registerColumnFilterController(nextController: ColumnFilterController): () => void {
  controller = nextController;
  return () => {
    if (controller === nextController) {
      controller = null;
    }
  };
}

export function getColumnFilterController(): ColumnFilterController | null {
  return controller;
}
