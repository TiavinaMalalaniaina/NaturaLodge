import { useTranslation } from 'react-i18next';
import { APP_ENV } from '../lib/appEnv';
import { cn } from '../lib/utils';

export function EnvBanner() {
  const { t } = useTranslation();
  if (APP_ENV === 'production') return null;

  return (
    <div
      role="status"
      className={cn(
        'no-print fixed bottom-3 left-3 z-[100] pointer-events-none rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider shadow-md',
        APP_ENV === 'preprod' ? 'bg-amber-400 text-amber-950' : 'bg-sky-500 text-white',
      )}
    >
      {t(`envBanner.${APP_ENV}`)}
    </div>
  );
}
