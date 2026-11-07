import { UserRound } from 'lucide-react';

import { cn } from '@/lib/utils';

interface PlayerAvatarProps {
  className?: string;
  label: string;
  size?: 'lg' | 'md' | 'sm';
}

const SIZE_CLASSES = {
  lg: 'h-20 w-20 rounded-[1.75rem] text-2xl',
  md: 'h-14 w-14 rounded-2xl text-lg',
  sm: 'h-11 w-11 rounded-xl text-sm'
} as const;

export function PlayerAvatar({ className, label, size = 'md' }: PlayerAvatarProps) {
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center border border-border bg-surface/80 text-accent shadow-sm',
        SIZE_CLASSES[size],
        className
      )}
      aria-hidden="true"
    >
      {initials ? (
        <span className="font-semibold">{initials}</span>
      ) : (
        <UserRound className="h-5 w-5" />
      )}
    </div>
  );
}
