import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { currentPushSubscription, disablePush, enablePush, pushSupported } from '../lib/push';

type State = 'loading' | 'unsupported' | 'dev' | 'off' | 'on' | 'denied';

// "Receive notifications on this device" switch in the bell dropdown.
export const PushToggle: React.FC = () => {
  const { t } = useTranslation();
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // vite-plugin-pwa only registers the service worker in the production build, never in `npm run dev`.
    if (import.meta.env.DEV) { setState('dev'); return; }
    if (!pushSupported()) { setState('unsupported'); return; }
    if (Notification.permission === 'denied') { setState('denied'); return; }
    currentPushSubscription().then(sub => setState(sub ? 'on' : 'off')).catch(() => setState('off'));
  }, []);

  const toggle = async () => {
    setBusy(true); setError('');
    try {
      if (state === 'on') { await disablePush(); setState('off'); }
      else { await enablePush(); setState('on'); }
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'permission-denied') setState(Notification.permission === 'denied' ? 'denied' : 'off');
      setError(t(`push.error_${['server-not-configured', 'no-service-worker', 'permission-denied'].includes(code) ? code : 'generic'}`));
    } finally { setBusy(false); }
  };

  if (state === 'loading') return null;
  const hint = 'text-[9px] text-on-surface-variant/60 tracking-wide normal-case';
  if (state === 'unsupported') return <p className={hint}>{t('push.unsupported')}</p>;
  if (state === 'dev') return <p className={hint}>{t('push.devMode')}</p>;
  if (state === 'denied') return <p className={hint}>{t('push.denied')}</p>;
  return <div className="mt-1 space-y-0.5">
    <button onClick={toggle} disabled={busy} className="text-[9px] font-bold text-primary hover:underline uppercase tracking-wider disabled:opacity-50">
      {state === 'on' ? t('push.disable') : t('push.enable')}
    </button>
    {state === 'on' && <p className={hint}>{t('push.enabled')}</p>}
    {error && <p className="text-[9px] text-red-700 normal-case">{error}</p>}
  </div>;
};
