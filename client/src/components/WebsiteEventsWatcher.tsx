import React, { useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchWebsiteEvents, WebsiteEvent } from '../api/websiteRequests';
import { useAuth } from '../context/AuthContext';
import { AppNotification, useNotifications } from '../context/NotificationContext';
import { formatCurrency, formatDate } from '../lib/format';

const CURSOR_KEY = 'website_events_cursor';
const tone: Record<WebsiteEvent['kind'], AppNotification['source']> = {
  REQUEST_RECEIVED: 'direct', PROOF_UPLOADED: 'member', DEPOSIT_CONFIRMED: 'member', CANCELLED_BY_GUEST: 'ota', EXPIRED: 'ota',
};
const withAmount: WebsiteEvent['kind'][] = ['REQUEST_RECEIVED', 'PROOF_UPLOADED', 'DEPOSIT_CONFIRMED'];

const readCursor = () => { try { return localStorage.getItem(CURSOR_KEY); } catch { return null; } };
const writeCursor = (value: string) => { try { localStorage.setItem(CURSOR_KEY, value); } catch { /* private mode: events may be shown again, the bell dedupes them */ } };

// Polls website events (new request, proof uploaded, cancellation…) and turns them into bell
// notifications on every open staff console. Renders nothing.
export const WebsiteEventsWatcher: React.FC = () => {
  const { can } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { addNotification } = useNotifications();
  const mountedAt = useRef(Date.now());

  useQuery({
    queryKey: ['website-events'],
    enabled: can('websiteRequests.view'),
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      // First run on this browser: the last 24 hours, not the whole retention window.
      const after = readCursor() ?? new Date(Date.now() - 86400000).toISOString();
      const events = await fetchWebsiteEvents(after);
      for (const event of events) {
        const title = t(`websiteEvents.${event.kind}`);
        const subtitle = t('websiteEvents.subtitle', { name: event.request.name, arrival: formatDate(event.request.arrival), departure: formatDate(event.request.departure) });
        addNotification({
          externalId: event.id, source: tone[event.kind], title, subtitle, link: '/website-requests',
          amount: withAmount.includes(event.kind) ? formatCurrency(event.request.depositAmount) : '--',
          createdAt: new Date(event.createdAt),
        });
        // Desktop alert only for what happens while the console is open and not in front of the user.
        if (document.hidden && new Date(event.createdAt).getTime() > mountedAt.current && 'Notification' in window && Notification.permission === 'granted') {
          // Android Chrome only allows notifications through a service worker: the bell still works.
          try { new Notification(title, { body: subtitle, tag: event.id, icon: '/pwa-192x192.png' }); } catch { /* unsupported here */ }
        }
      }
      if (events.length) {
        writeCursor(events[events.length - 1].createdAt);
        await qc.invalidateQueries({ queryKey: ['website-requests'] });
      }
      return events.length;
    },
  });
  return null;
};
