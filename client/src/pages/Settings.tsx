import React from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export const Settings: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-10 pb-20">
      <div>
        <h2 className="font-display italic text-3xl md:text-4xl text-on-surface mb-1 leading-none">{t('settings.title')}</h2>
        <p className="text-[10px] font-sans font-bold uppercase tracking-[0.3em] text-on-surface-variant/40">{t('settings.configure')}</p>
      </div>

      <section className="bg-white rounded-[2.5rem] border border-stone-200/60 organic-shadow p-8 md:p-12 space-y-8 max-w-3xl">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" /> {t('settings.language')}
        </h3>
        <div className="flex items-center gap-6">
          <p className="text-sm text-on-surface-variant font-light">{t('settings.language')}</p>
          <LanguageSwitcher />
        </div>
      </section>
    </div>
  );
};
