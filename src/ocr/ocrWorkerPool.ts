// Phase 5F: Tesseract worker pool – migrated from main.js
import { ocrSettings } from './ocrSettings';

declare const Tesseract: any;

const MULTILINGUAL_WHITELIST =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,-()/'&% " +
  'ąęćłńóśźżĄĘĆŁŃÓŚŹŻáàâãäåçéèêëíìîïñóòôõöúùûüýÿÁÀÂÃÄÅÇÉÈÊËÍÌÎÏÑÓÒÔÕÖÚÙÛÜÝÄÖÜäöüßęóąśłżźćńĘÓĄŚŁŻŹĆŃčćšžČĆŠŽşğŞĞİı' +
  'ãõÃÕçÇâêôÂÊÔ';

export interface OCRWorkerResult {
  confidence: number;
  data: { confidence: number; lines: any[]; text: string; words: any[] };
  lineConfidences: { confidence: number; text: string }[];
  wordConfidences: { confidence: number; text: string }[];
}

function getTesseractPaths() {
  const origin = window.location.origin;
  return {
    corePath: `${origin}/vendor/tesseract/tesseract-core.wasm.js`,
    gzip: false,
    langPath: `${origin}/vendor/tesseract/langs`,
    workerPath: `${origin}/vendor/tesseract/worker.min.js`
  };
}

const pool = {
  async acquireWorker(): Promise<any> {
    await this.initialize();
    if (this.availableWorkers.length > 0) return this.availableWorkers.pop();
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (this.availableWorkers.length > 0) return this.availableWorkers.pop();

    if ((window as any).addAudit) (window as any).addAudit('ocr_worker_temp_created', {}, 'warn');
    const paths = getTesseractPaths();
    const safePsmMode = ocrSettings.psmMode || '6';
    const tempWorker = await Tesseract.createWorker('pol+eng+por', 1, paths);
    await tempWorker.setParameters({
      tessedit_char_whitelist: MULTILINGUAL_WHITELIST,
      tessedit_pageseg_mode: safePsmMode
    });
    return { isTemporary: true, worker: tempWorker };
  },
  availableWorkers: [] as any[],
  detectLanguageFromLeague(leagueName: null | string): string {
    if (!leagueName) return 'pol+eng';
    const lower = leagueName.toLowerCase();
    if (
      lower.includes('portugal') ||
      lower.includes('campeonato') ||
      lower.includes('liga portuguesa') ||
      lower.includes('primeira liga')
    ) {
      return 'por+eng';
    }
    return 'pol+eng';
  },
  initializationPromise: null as null | Promise<void>,

  async initialize(): Promise<void> {
    if (this.initializationPromise !== null) return this.initializationPromise;
    this.initializationPromise = (async () => {
      const paths = getTesseractPaths();
      const initPromises = [];
      for (let i = 0; i < this.maxWorkers; i++) {
        initPromises.push(
          Tesseract.createWorker('pol+eng+por', 1, paths)
            .then((worker: any) =>
              worker
                .setParameters({
                  tessedit_char_whitelist: MULTILINGUAL_WHITELIST,
                  tessedit_pageseg_mode: '6'
                })
                .then(() => {
                  this.workers.push(worker);
                  this.availableWorkers.push(worker);
                })
            )
            .catch((error: unknown) => {
              if ((window as any).addAudit)
                (window as any).addAudit(
                  'ocr_worker_init_error',
                  { error: String(error) },
                  'error'
                );
            })
        );
      }
      await Promise.all(initPromises);
      if ((window as any).addAudit)
        (window as any).addAudit('ocr_worker_pool_ready', { workers: this.workers.length }, 'info');
    })();
    return this.initializationPromise;
  },

  maxWorkers: 3,

  async recognize(
    canvas: HTMLCanvasElement,
    _progressCallback?: any,
    _language?: null | string
  ): Promise<OCRWorkerResult> {
    const workerOrObj = await this.acquireWorker();
    const worker = workerOrObj.isTemporary ? workerOrObj.worker : workerOrObj;
    const isTemporary = workerOrObj.isTemporary || false;
    try {
      const result = await worker.recognize(canvas);
      const confidence = result.data.confidence || 0;
      const words = result.data.words || [];
      const lines = result.data.lines || [];
      return {
        ...result,
        confidence,
        lineConfidences: lines.map((l: any) => ({ confidence: l.confidence || 0, text: l.text })),
        wordConfidences: words.map((w: any) => ({ confidence: w.confidence || 0, text: w.text }))
      };
    } catch (error) {
      if ((window as any).addAudit)
        (window as any).addAudit(
          'ocr_recognize_error',
          { error: String(error), temporary: isTemporary },
          'error'
        );
      throw error;
    } finally {
      this.releaseWorker(workerOrObj);
    }
  },

  releaseWorker(workerOrObj: any): void {
    const worker = workerOrObj.isTemporary ? workerOrObj.worker : workerOrObj;
    if (workerOrObj.isTemporary) {
      worker.terminate().catch((error: unknown) => {
        if ((window as any).addAudit)
          (window as any).addAudit(
            'ocr_worker_terminate_error',
            { error: String(error), temporary: true },
            'warn'
          );
      });
    } else {
      if (!this.availableWorkers.includes(worker) && this.workers.includes(worker)) {
        this.availableWorkers.push(worker);
      }
    }
  },

  async terminate(): Promise<void> {
    const terminatePromises = this.workers.map((worker: any) =>
      worker.terminate().catch((error: unknown) => {
        if ((window as any).addAudit)
          (window as any).addAudit(
            'ocr_worker_terminate_error',
            { error: String(error), temporary: false },
            'warn'
          );
      })
    );
    await Promise.all(terminatePromises);
    this.workers = [];
    this.availableWorkers = [];
    this.initializationPromise = null;
  },

  workers: [] as any[]
};

export const ocrWorkerPool = pool;
