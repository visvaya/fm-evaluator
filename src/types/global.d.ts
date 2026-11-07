// Global augmentations for legacy scripts that attach to window.
declare global {
  interface Window {
    computeStructureHash: (headers: string[]) => string;
    ContextResolver: any;
    fileMetaHelper?: {
      checkDuplicate: (
        file: File,
        structureHash?: string
      ) => Promise<{
        contentHash?: string;
        existingFile?: {
          id: string;
          importedAt: number;
          name: string;
          size?: number;
          structureHash?: string;
        };
        isDuplicate: boolean;
        reason?: 'content_hash' | 'name' | 'structure_hash';
      }>;
      clearFileRecord: (fileId: string) => Promise<void>;
      getImportedFiles: () => Promise<
        {
          id: string;
          importedAt: number;
          name: string;
          size?: number;
          structureHash?: string;
        }[]
      >;
      isDuplicate: (file: File) => Promise<boolean>;
      recordFile: (file: File, structureHash?: string) => Promise<void>;
    };
    FormatInspector: any;
    FormatVerificationModal: any;
    HeaderMappingModal: any;
    ModalQueue: any;
    persistUIState?: () => void;
    processor: any;
    scheduleTableRender?: () => void;
    SchemaRegistry: any;
    SmartHeaderMapper: any;
  }
}
