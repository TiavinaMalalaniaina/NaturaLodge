import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dateToLocalStr as toStr } from '../lib/format';

const COL_W = 52; // px per day column, must match the grid's rendered column width

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function dayDiff(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export interface MonthMarker {
  year: number;
  month: number;
  label: string;
  startDay: number;
  isNewYear: boolean;
}

/**
 * Consolidated horizontal virtualization + scroll-sync for the reservations planning grid.
 * Fenêtre : 1 an avant aujourd'hui → 4 ans après. Seules les colonnes visibles ± 50 jours de
 * marge sont rendues (`virtualDates`). Ne pas revenir à un rendu de toutes les colonnes —
 * voir CLAUDE.md.
 */
export function useVirtualDayGrid(active: boolean) {
  const bodyRef     = useRef<HTMLDivElement>(null);
  const headerRef   = useRef<HTMLDivElement>(null);
  const monthBarRef = useRef<HTMLDivElement>(null);

  const windowStart = useMemo(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1); d.setHours(0, 0, 0, 0); return d;
  }, []);
  const windowEnd = useMemo(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() + 4); d.setHours(23, 59, 59, 999); return d;
  }, []);
  const totalDays = useMemo(
    () => Math.ceil((windowEnd.getTime() - windowStart.getTime()) / 86_400_000),
    [windowStart, windowEnd],
  );
  const gridDates = useMemo(
    () => Array.from({ length: totalDays }, (_, i) => addDays(windowStart, i)),
    [windowStart, totalDays],
  );

  // Visible date (leftmost visible day, updated on scroll)
  const [visibleDate, setVisibleDate] = useState<Date>(() => new Date());

  // All months in the window, for the month navigator
  const allMonths = useMemo(() => {
    const months: MonthMarker[] = [];
    let d = new Date(windowStart.getFullYear(), windowStart.getMonth(), 1);
    while (d <= windowEnd) {
      const startDay = Math.max(0, dayDiff(windowStart, d));
      months.push({
        year:      d.getFullYear(),
        month:     d.getMonth(),
        label:     d.toLocaleString('en', { month: 'short' }).toUpperCase(),
        startDay,
        isNewYear: d.getMonth() === 0,
      });
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
    return months;
  }, [windowStart, windowEnd]);

  const visibleDayCount = useMemo(
    () => Math.round((bodyRef.current?.clientWidth ?? 800) / COL_W),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleDate],
  );

  // Horizontal virtualization — only render visible columns + 50-day buffer on each side
  const virtualStartIdx = useMemo(() => {
    const offset = Math.max(0, dayDiff(windowStart, visibleDate));
    return Math.max(0, offset - 50);
  }, [windowStart, visibleDate]);
  const virtualEndIdx = useMemo(() => {
    const offset = Math.max(0, dayDiff(windowStart, visibleDate));
    return Math.min(totalDays, offset + visibleDayCount + 50);
  }, [windowStart, visibleDate, visibleDayCount, totalDays]);
  const virtualDates = useMemo(
    () => gridDates.slice(virtualStartIdx, virtualEndIdx),
    [gridDates, virtualStartIdx, virtualEndIdx],
  );

  // Sync frozen headers on every scroll frame — update visible date only on month change
  const handleBodyScroll = useCallback(() => {
    const sl = bodyRef.current?.scrollLeft ?? 0;
    if (headerRef.current)   headerRef.current.scrollLeft   = sl;
    if (monthBarRef.current) monthBarRef.current.scrollLeft = sl;
    setVisibleDate(prev => {
      const next = addDays(windowStart, Math.round(sl / COL_W));
      return prev.getFullYear() === next.getFullYear() && prev.getMonth() === next.getMonth()
        ? prev   // same month → skip re-render
        : next;  // new month → update
    });
  }, [windowStart]);

  const syncScrollTo = useCallback((target: number) => {
    const clamped = Math.max(0, Math.min(target, (totalDays - 1) * COL_W));
    if (bodyRef.current)     bodyRef.current.scrollLeft     = clamped;
    if (headerRef.current)   headerRef.current.scrollLeft   = clamped;
    if (monthBarRef.current) monthBarRef.current.scrollLeft = clamped;
    setVisibleDate(addDays(windowStart, Math.round(clamped / COL_W)));
  }, [windowStart, totalDays]);

  const scrollToToday = useCallback(() => {
    const offset = Math.max(0, dayDiff(windowStart, new Date()) - 1) * COL_W;
    syncScrollTo(offset);
  }, [windowStart, syncScrollTo]);

  const scrollByDays = useCallback((days: number) => {
    const current = bodyRef.current?.scrollLeft ?? 0;
    syncScrollTo(Math.max(0, current + days * COL_W));
  }, [syncScrollTo]);

  const scrollToMonth = useCallback((startDay: number) => {
    syncScrollTo(startDay * COL_W);
  }, [syncScrollTo]);

  // Scroll to today the moment the scrollable grid body actually mounts.
  // Les colonnes virtualisées sont déjà centrées sur `visibleDate` (= aujourd'hui
  // au montage) dès le premier rendu — le vrai problème était que `scrollLeft`
  // restait à 0 pendant ce temps, donc le viewport montrait le spacer vide avant
  // ces colonnes. Un useEffect basé sur isLoading n'est pas fiable ici (les hooks
  // useBookings/useRooms utilisent `placeholderData`, donc `isLoading` peut déjà
  // être false avec des données d'une requête précédente). On synchronise plutôt
  // directement sur le montage du DOM via une ref-callback.
  const hasScrolledToTodayRef = useRef(false);
  useEffect(() => {
    if (!active) hasScrolledToTodayRef.current = false;
  }, [active]);

  const setBodyRef = useCallback((el: HTMLDivElement | null) => {
    bodyRef.current = el;
    if (el && active && !hasScrolledToTodayRef.current) {
      hasScrolledToTodayRef.current = true;
      scrollToToday();
    }
  }, [active, scrollToToday]);

  return {
    COL_W,
    windowStart, windowEnd, totalDays, gridDates,
    visibleDate, allMonths,
    visibleDayCount, virtualStartIdx, virtualEndIdx, virtualDates,
    bodyRef, headerRef, monthBarRef, setBodyRef,
    handleBodyScroll, scrollToToday, scrollByDays, scrollToMonth,
    toStr, addDays, dayDiff,
  };
}
