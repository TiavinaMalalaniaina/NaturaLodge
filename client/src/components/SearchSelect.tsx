import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useOutsideClick } from '../hooks/useOutsideClick';

export interface SearchSelectOption {
  value:  string;
  label:  string;
  /** Regroupe les options sous un intitulé (ex. la catégorie). */
  group?: string;
  /** Texte secondaire aligné à droite (ex. la quantité disponible). */
  hint?:  string;
}

interface SearchSelectProps {
  id?:          string;
  options:      SearchSelectOption[];
  value:        string;
  onChange:     (value: string) => void;
  placeholder?: string;
  /** Message quand la recherche ne trouve rien. */
  emptyText:    string;
  /** Libellé du bouton qui vide la sélection ; absent : pas de bouton. */
  clearLabel?:  string;
  disabled?:    boolean;
  className?:   string;
  'aria-label'?:      string;
  'aria-labelledby'?: string;
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Liste déroulante avec recherche en un seul champ (modèle ARIA « combobox » + « listbox ») :
// on tape pour filtrer, flèches pour parcourir, Entrée pour choisir, Échap pour refermer la
// liste sans fermer la fenêtre qui la contient.
export const SearchSelect: React.FC<SearchSelectProps> = ({
  id, options, value, onChange, placeholder, emptyText, clearLabel, disabled, className, ...aria
}) => {
  const generatedId = useId();
  const inputId = id ?? `${generatedId}-input`;
  const listId = `${generatedId}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find(o => o.value === value) ?? null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    return needle ? options.filter(o => normalize(o.label).includes(needle) || normalize(o.group ?? '').includes(needle)) : options;
  }, [options, query]);

  const close = useCallback(() => { setOpen(false); setQuery(''); }, []);
  useOutsideClick(rootRef, close, open);

  // Garde l'option active visible pendant la navigation au clavier.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const openList = () => {
    if (disabled) return;
    setOpen(true);
    setActive(Math.max(0, filtered.findIndex(o => o.value === value)));
  };

  const choose = (option: SearchSelectOption) => {
    onChange(option.value);
    close();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) { openList(); return; }
        setActive(i => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (open) setActive(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        if (open && filtered[active]) { e.preventDefault(); choose(filtered[active]); }
        break;
      case 'Escape':
        if (open) { e.stopPropagation(); close(); }
        break;
      case 'Tab':
        close();
        break;
    }
  };

  // Liste à plat, intitulés de groupe insérés au changement de groupe.
  let lastGroup: string | undefined;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          disabled={disabled}
          value={open ? query : (selected?.label ?? '')}
          placeholder={selected && open ? selected.label : placeholder}
          onChange={e => { setQuery(e.target.value); setActive(0); if (!open) setOpen(true); }}
          onFocus={openList}
          onClick={() => { if (!open) openList(); }}
          onKeyDown={handleKeyDown}
          className="w-full pl-4 pr-16 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:opacity-50"
          {...aria}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
          {clearLabel && selected && !disabled && (
            <button type="button" onClick={() => { onChange(''); inputRef.current?.focus(); }} aria-label={clearLabel}
              className="p-1.5 text-on-surface-variant/50 hover:text-on-surface rounded-lg">
              <X className="w-4 h-4" />
            </button>
          )}
          <ChevronDown aria-hidden className={cn('w-4 h-4 mx-1.5 text-on-surface-variant/50 transition-transform pointer-events-none', open && 'rotate-180')} />
        </div>
      </div>

      {open && (
        <ul ref={listRef} id={listId} role="listbox" aria-label={aria['aria-label']} aria-labelledby={aria['aria-labelledby']}
          className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-stone-200 rounded-xl shadow-xl py-1">
          {filtered.length === 0 ? (
            <li role="presentation" className="px-4 py-3 text-sm text-on-surface-variant/60">{emptyText}</li>
          ) : filtered.map((option, index) => {
            const header = option.group && option.group !== lastGroup ? option.group : null;
            lastGroup = option.group;
            return (
              <React.Fragment key={option.value}>
                {header && (
                  <li role="presentation" className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">{header}</li>
                )}
                <li
                  id={`${listId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={option.value === value}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => choose(option)}
                  onMouseMove={() => setActive(index)}
                  className={cn(
                    'px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between gap-3',
                    index === active && 'bg-stone-100',
                    option.value === value && 'font-bold text-primary',
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {option.hint && <span className="shrink-0 text-xs text-on-surface-variant/60 tabular-nums">{option.hint}</span>}
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      )}
    </div>
  );
};
