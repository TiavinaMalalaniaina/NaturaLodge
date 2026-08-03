import React from 'react';
import { cn } from '../lib/utils';
import { DeltaBadge, Delta } from './DeltaBadge';

interface CompareRowProps {
  label:    string;
  oldVal:   string;
  newVal:   string;
  delta?:   Delta;
  deltaLbl?: string;
  highlight?: boolean;
}

export function CompareRow({ label, oldVal, newVal, delta = 'same', deltaLbl = '', highlight }: CompareRowProps) {
  const changed = oldVal !== newVal;
  return (
    <div className={cn(
      'grid grid-cols-[120px_1fr_1fr] gap-x-4 py-2.5 border-b border-stone-100 last:border-0 items-start',
      highlight && changed && 'bg-amber-50/50 -mx-4 px-4 rounded-lg',
    )}>
      <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 pt-0.5">{label}</span>
      <span className="text-xs text-on-surface-variant/60 line-through decoration-stone-300">{oldVal}</span>
      <span className={cn('text-xs font-semibold', changed ? 'text-on-surface' : 'text-on-surface-variant/50')}>
        {newVal}
        <DeltaBadge delta={delta} label={deltaLbl} />
      </span>
    </div>
  );
}
