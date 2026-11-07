export type VitalName = 'cls' | 'fcp' | 'lcp' | 'ttfb';
interface RatingThreshold {
  good: number;
  poor: number;
}

type VitalRating = 'good' | 'needs-improvement' | 'poor';

const THRESHOLDS: Record<VitalName, RatingThreshold> = {
  cls: { good: 0.1, poor: 0.25 },
  fcp: { good: 1800, poor: 3000 },
  lcp: { good: 2500, poor: 4000 },
  ttfb: { good: 800, poor: 1800 }
};

export interface VitalSample {
  at: number;
  name: VitalName;
  rating: VitalRating;
  unit: '' | 'ms';
  value: number;
}

type LayoutShiftEntry = PerformanceEntry & {
  hadRecentInput?: boolean;
  value: number;
};

type SampleHandler = (sample: VitalSample) => void;

export function startWebVitalsSampler(handler: SampleHandler): () => void {
  if (typeof performance === 'undefined') {
    return () => {};
  }

  const observers: PerformanceObserver[] = [];
  let clsValue = 0;
  const disconnectAll = () => observers.forEach((observer) => observer.disconnect());

  const emit = (name: VitalName, value: number, unit: '' | 'ms' = 'ms') => {
    if (!isFinite(value)) return;
    const rating = getRating(name, value);
    handler({ at: Date.now(), name, rating, unit, value });
  };

  sampleTtfb(emit);
  sampleFcp(emit);

  if (typeof PerformanceObserver !== 'undefined') {
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      if (entries.length === 0) return;
      const lastEntry = entries.at(-1);
      emit('lcp', lastEntry.startTime, 'ms');
    });
    try {
      lcpObserver.observe({ buffered: true, type: 'largest-contentful-paint' });
      observers.push(lcpObserver);
    } catch {}

    const clsObserver = new PerformanceObserver((entryList) => {
      entryList.getEntries().forEach((entry) => {
        const shift = entry as LayoutShiftEntry;
        if (shift.hadRecentInput) return;
        clsValue += shift.value;
        emit('cls', Number(clsValue.toFixed(3)), '');
      });
    });
    try {
      clsObserver.observe({ buffered: true, type: 'layout-shift' });
      observers.push(clsObserver);
    } catch {}

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        disconnectAll();
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange, { once: true });
  }

  return () => {
    disconnectAll();
  };
}

function getRating(name: VitalName, value: number): VitalRating {
  const thresholds = THRESHOLDS[name];
  if (!thresholds) return 'good';
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.poor) return 'needs-improvement';
  return 'poor';
}

function sampleFcp(emit: (name: VitalName, value: number, unit?: '' | 'ms') => void) {
  const paintEntries = performance.getEntriesByName('first-contentful-paint');
  if (paintEntries && paintEntries.length > 0) {
    emit('fcp', paintEntries[0].startTime, 'ms');
    return;
  }
  if (typeof PerformanceObserver === 'undefined') return;
  try {
    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList
        .getEntries()
        .filter((entry) => entry.name === 'first-contentful-paint');
      if (entries.length > 0) {
        emit('fcp', entries[0].startTime, 'ms');
        observer.disconnect();
      }
    });
    observer.observe({ buffered: true, type: 'paint' });
  } catch {}
}

function sampleTtfb(emit: (name: VitalName, value: number, unit?: '' | 'ms') => void) {
  const navEntries = performance.getEntriesByType('navigation');
  if (navEntries && navEntries.length > 0) {
    const responseStart = (navEntries[0] as PerformanceNavigationTiming).responseStart;
    if (responseStart) {
      emit('ttfb', responseStart, 'ms');
      return;
    }
  }
  const timing = (performance as any).timing;
  if (timing?.responseStart && timing.requestStart) {
    emit('ttfb', timing.responseStart - timing.requestStart, 'ms');
  }
}
