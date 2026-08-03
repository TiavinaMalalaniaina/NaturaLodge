import React from 'react';
import { cn } from '../lib/utils';

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  activeClassName?: string;
  children: React.ReactNode;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  active, onClick, activeClassName = 'bg-primary text-white border-primary', children,
}) => (
  <button type="button" onClick={onClick} aria-pressed={active}
    className={cn(
      'px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border transition-all whitespace-nowrap',
      active ? activeClassName : 'bg-white text-on-surface-variant/60 border-stone-200 hover:border-stone-400',
    )}>
    {children}
  </button>
);
