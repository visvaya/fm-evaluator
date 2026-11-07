import { cn } from '@/lib/utils';

import type { ReactNode } from 'react';

export function ScoreCard({
  accentClass,
  label,
  value
}: Readonly<{
  accentClass: string;
  label: string;
  value: number;
}>) {
  const normalizedWidth = Math.min(100, Math.max(0, (value / 20) * 100));

  return (
    <div className="rounded-2xl border border-border bg-surface/80 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        {label}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <div className={cn('text-4xl font-semibold tracking-tight', accentClass)}>
          {value.toFixed(1)}
        </div>
        <div className="pb-1 text-sm text-text-muted">/ 20.0</div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
        <div
          className={cn('h-full rounded-full', accentClass.replace('text-', 'bg-'))}
          style={{ width: `${normalizedWidth}%` }}
        />
      </div>
    </div>
  );
}

export function WarningBlock({
  children,
  tone = 'warning'
}: Readonly<{
  children: string;
  tone?: 'negative' | 'warning';
}>) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-3 py-2 text-sm',
        tone === 'negative'
          ? 'border-negative/20 bg-negative/5 text-negative'
          : 'border-warning/25 bg-warning/10 text-text-primary'
      )}
    >
      {children}
    </div>
  );
}

export function DetailSection({
  children,
  testId,
  title
}: Readonly<{
  children: ReactNode;
  testId?: string;
  title: string;
}>) {
  return (
    <section
      data-testid={testId}
      className="rounded-3xl border border-border bg-surface/70 p-4 shadow-sm"
    >
      <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}
