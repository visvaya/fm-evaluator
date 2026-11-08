import { removeUntilStable } from '@/utils/removeUntilStable';

export function sanitizeHtmlForParsing(input: string): string {
  return removeUntilStable(String(input), [
    /<style[^>]*>[\s\S]*?<\/style>/gi,
    /\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
    /\sstyle\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi
  ]);
}

export function patchDomParserForCsp() {
  const parserCtor: any = (window as any).DOMParser;
  const parserProto: any = parserCtor?.prototype;
  if (!parserProto || typeof parserProto.parseFromString !== 'function') return;
  const originalParse: any = parserProto.parseFromString;
  if (parserProto.parseFromString.__fm_patched) return;

  parserProto.parseFromString = function (
    this: DOMParser,
    html: string,
    type: DOMParserSupportedType
  ) {
    try {
      if (type === 'text/html' && typeof html === 'string') {
        return originalParse.call(this, sanitizeHtmlForParsing(html), type);
      }
    } catch {
      // Fall through to the unmodified parser.
    }

    return originalParse.call(this, html, type);
  };

  parserProto.parseFromString.__fm_patched = true;
}

export function patchTesseractSelfHosted() {
  const tesseract = (window as any).Tesseract;
  if (!tesseract || typeof tesseract.createWorker !== 'function') return;
  if (tesseract.__fmSelfHostedPatched) return;

  const originalCreateWorker = tesseract.createWorker.bind(tesseract);
  const selfHosted = {
    corePath: '/vendor/tesseract/tesseract-core.wasm',
    langPath: '/vendor/tesseract/langs',
    workerPath: '/vendor/tesseract/worker.min.js'
  };
  const configuredLangs = (window as any).FM_TESSERACT_LANGS as string[] | undefined;
  const availableLangs = new Set(
    (configuredLangs && configuredLangs.length > 0 ? configuredLangs : ['eng', 'pol', 'por'])
      .map((language) => language.trim())
      .filter(Boolean)
  );

  tesseract.createWorker = (...args: any[]) => {
    if (typeof args[0] === 'string') {
      const requested = args[0]
        .split('+')
        .map((language: string) => language.trim())
        .filter(Boolean);
      const filtered = requested.filter((language: string) => availableLangs.has(language));

      if (filtered.length !== requested.length) {
        console.warn(
          '[Tesseract] Missing traineddata in /vendor/tesseract/langs:',
          requested.filter((language: string) => !availableLangs.has(language)).join(', ')
        );
      }

      args[0] = (filtered.length > 0 ? filtered : ['eng']).join('+');
    }

    const tail = args.at(-1);
    if (tail && typeof tail === 'object' && !Array.isArray(tail)) {
      args[args.length - 1] = { ...selfHosted, ...tail };
    } else {
      args.push(selfHosted);
    }

    return originalCreateWorker(...args);
  };

  tesseract.__fmSelfHostedPatched = true;
}
