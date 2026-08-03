import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../lib/utils';

export type Delta = 'up' | 'down' | 'same' | 'diff';

interface DeltaBadgeProps {
  delta: Delta;
  label: string;
}

export function DeltaBadge({ delta, label }: DeltaBadgeProps) {
  if (delta === 'same') return null;
  if (delta === 'diff') return (
    <span className="ml-1.5 text-[9px] font-bold text-amber-600 uppercase tracking-widest">≠</span>
  );
  const isUp = delta === 'up';
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 ml-1.5 text-[9px] font-bold',
      isUp ? 'text-rose-500' : 'text-teal-600',
    )}>
      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {label}
    </span>
  );
}
