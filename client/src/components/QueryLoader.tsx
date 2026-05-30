import React from 'react';
import { useTranslation } from 'react-i18next';

const isDev = import.meta.env.DEV;

export const PageLoader: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-32 text-on-surface-variant/40">
      <div className="w-10 h-10 bg-primary rotate-45 rounded-xl animate-pulse mb-6" />
      <p className="text-[10px] font-sans font-bold uppercase tracking-[0.3em]">{t('queryLoader.loading')}</p>
    </div>
  );
};

export const PageError: React.FC<{ message?: string }> = ({ message }) => {
  const { t } = useTranslation();

  if (isDev) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-red-400">
        <p className="font-display italic text-2xl mb-2">{t('queryLoader.loadingError')}</p>
        <p className="text-xs">{message ?? t('queryLoader.checkBackend')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-32 text-on-surface-variant/20">
      <div className="w-10 h-10 bg-stone-200 rotate-45 rounded-xl mb-6" />
      <p className="text-[10px] font-sans font-bold uppercase tracking-[0.3em]">{t('queryLoader.noData')}</p>
    </div>
  );
};
