import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

const LANGUAGES = [
  { code: 'fr', label: 'Français', short: 'FR', flag: '🇫🇷' },
  { code: 'en', label: 'English',  short: 'EN', flag: '🇬🇧' },
  { code: 'mg', label: 'Malagasy', short: 'MG', flag: '🇲🇬' },
] as const;

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find(l => l.code === i18n.language) ?? LANGUAGES[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-widest transition-all',
          open
            ? 'bg-teal-50 border-primary/30 text-primary'
            : 'bg-stone-50 border-stone-200 text-on-surface-variant hover:border-stone-300',
        )}
      >
        <span>{current.flag}</span>
        <span>{current.short}</span>
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 mt-2 w-36 bg-white rounded-2xl border border-stone-200 shadow-xl overflow-hidden z-50"
          >
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => { i18n.changeLanguage(lang.code); setOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-left text-xs font-semibold transition-colors',
                  i18n.language === lang.code
                    ? 'bg-teal-50 text-primary'
                    : 'text-on-surface-variant hover:bg-stone-50',
                )}
              >
                <span className="text-base">{lang.flag}</span>
                <span>{lang.label}</span>
                {i18n.language === lang.code && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
