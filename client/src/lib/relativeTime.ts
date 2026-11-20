import type { TFunction } from 'i18next';

export function formatRelativeTime(date: Date, now: Date, t: TFunction): string {
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t('relativeTime.justNow');
  if (mins < 60) return t('relativeTime.minutes', { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('relativeTime.hours', { count: hours });
  return t('relativeTime.days', { count: Math.floor(hours / 24) });
}
