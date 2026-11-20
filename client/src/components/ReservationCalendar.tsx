import React, { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, X, LogIn, LogOut, Users, FileText, BedDouble } from 'lucide-react';
import { useRooms } from '../hooks/useRooms';
import { useIsMobile } from '../hooks/useMediaQuery';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { useBookings } from '../hooks/useBookings';
import { EFFECTIVE_STATUS_CLASS, EFFECTIVE_STATUS_I18N_KEY } from '../lib/bookingStatus';
import { RichBooking, EffectiveStatus } from '../api/bookings';

// ─── Helpers ──────────────────────────────────────────────────────

// Date locale, pas UTC (toISOString décale d'un jour dans un fuseau en
// avance sur UTC — ex. UTC+3 à Madagascar — pour des dates construites en
// minuit local comme ici).
function toStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

// 1er janvier 2024 = lundi : sert de référence pour nommer les jours dans la langue courante.
const MONDAY = new Date(2024, 0, 1);
const LEGEND: { status: EffectiveStatus; cls: string }[] = [
  { status: 'upcoming',           cls: 'bg-primary/15 border-primary/20' },
  { status: 'due_checkin',        cls: 'bg-amber-100 border-amber-200' },
  { status: 'in_progress',        cls: 'bg-teal-700 border-teal-600' },
  { status: 'overdue',            cls: 'bg-red-100 border-red-200' },
  { status: 'checked_out_unpaid', cls: 'bg-rose-50 border-rose-100' },
  { status: 'checked_out_paid',   cls: 'bg-stone-100 border-stone-200' },
];
const DEFAULT_BAR_CLS = 'bg-stone-100 text-stone-400 border-stone-200';
const NOON = 'T12:00:00';

// ─── Bar styles by status ─────────────────────────────────────────

const BAR_CLS: Partial<Record<EffectiveStatus, string>> = {
  upcoming:           'bg-primary/15 text-primary border-primary/20',
  due_checkin:        'bg-amber-100  text-amber-800 border-amber-200',
  in_progress:        'bg-teal-700   text-white     border-teal-600',
  due_checkout:       'bg-orange-100 text-orange-800 border-orange-200',
  overdue:             'bg-red-100    text-red-700   border-red-200',
  awaiting:            'bg-amber-100  text-amber-800 border-amber-200',
  checked_out_unpaid: 'bg-rose-50    text-rose-500  border-rose-100',
  checked_out_paid:   'bg-stone-100  text-stone-400 border-stone-200',
  closed:             'bg-stone-100  text-stone-400 border-stone-200',
  cancelled:           'bg-stone-50   text-stone-300 border-stone-100',
};

// ─── Bar data ─────────────────────────────────────────────────────

interface Bar {
  booking:   RichBooking;
  colStart:  number; // 0-6 within the week
  colEnd:    number; // 1-7
  showName:  boolean; // arrival falls in this week → show name
  lane:      number;
}

function computeBars(weekStart: Date, bookings: RichBooking[]): Bar[] {
  const wEnd = addDays(weekStart, 7);

  const overlapping = bookings.filter(b =>
    b.arrival < toStr(wEnd) && b.departure > toStr(weekStart) && b.status !== 'cancelled'
  );

  const unsorted: Omit<Bar, 'lane'>[] = overlapping.map(b => {
    const arr = new Date(b.arrival  + 'T12:00:00');
    const dep = new Date(b.departure + 'T12:00:00');
    const raw = Math.round((arr.getTime() - weekStart.getTime()) / 86_400_000);
    const rawE = Math.round((dep.getTime() - weekStart.getTime()) / 86_400_000);
    const colStart = Math.max(0, raw);
    const colEnd   = Math.min(7, rawE);
    return { booking: b, colStart, colEnd, showName: raw >= 0 };
  }).filter(b => b.colEnd > b.colStart);

  // Sort: earlier start first, then longer duration first
  unsorted.sort((a, b) => a.colStart - b.colStart || (b.colEnd - b.colStart) - (a.colEnd - a.colStart));

  // Greedy lane assignment
  const laneEnds: number[] = [];
  const bars: Bar[] = unsorted.map(b => {
    let lane = laneEnds.findIndex(end => end <= b.colStart);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
    laneEnds[lane] = b.colEnd;
    return { ...b, lane };
  });

  return bars;
}

// ─── Day stats ────────────────────────────────────────────────────

interface DayStats { occupied: number; arrivals: number; departures: number }
const EMPTY_STATS: DayStats = { occupied: 0, arrivals: 0, departures: 0 };

// Compté par chambre (BookingRoom), pas par réservation : une réservation de 2 chambres
// occupe 2 chambres. Une chambre est occupée la nuit du jour J si arrivée <= J < départ.
function computeDayStats(bookings: RichBooking[], startStr: string, endStr: string): Map<string, DayStats> {
  const stats = new Map<string, DayStats>();
  const occupiedRooms = new Map<string, Set<string>>();
  const get = (ds: string) => {
    let st = stats.get(ds);
    if (!st) { st = { ...EMPTY_STATS }; stats.set(ds, st); }
    return st;
  };

  for (const b of bookings) {
    if (b.status === 'cancelled') continue;
    for (const br of b.rooms) {
      if (br.arrival >= startStr && br.arrival < endStr) get(br.arrival).arrivals += 1;
      if (br.departure >= startStr && br.departure < endStr) get(br.departure).departures += 1;

      const from = br.arrival > startStr ? br.arrival : startStr;
      const to   = br.departure < endStr ? br.departure : endStr;
      for (let d = new Date(from + NOON); toStr(d) < to; d = addDays(d, 1)) {
        const ds = toStr(d);
        let set = occupiedRooms.get(ds);
        if (!set) { set = new Set(); occupiedRooms.set(ds, set); }
        set.add(br.roomId);
      }
    }
  }
  for (const [ds, set] of occupiedRooms) get(ds).occupied = set.size;
  return stats;
}

// ─── Component ────────────────────────────────────────────────────

const LANE_H   = 26;  // px per lane
const HEADER_H = 52;  // day number + occupied/arrivals/departures counts

// Mobile : barres fines sans texte, plafonnées ; le détail se lit dans l'agenda du jour.
const M_LANE_H    = 7;
const M_HEADER_H  = 48;
const M_MAX_LANES = 3;
const M_MORE_H    = 12;
const M_MIN_ROW_H = 64;
const SWIPE_PX    = 50;

export const ReservationCalendar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language;
  const navigate = useNavigate();
  const today    = new Date();

  const [month, setMonth] = useState(today.getMonth());
  const [year,  setYear]  = useState(today.getFullYear());
  const isMobile = useIsMobile();
  const todayStr   = toStr(today);
  const [selectedDay, setSelectedDay] = useState<string | null>(() => isMobile ? todayStr : null);
  const touchStartX = useRef<number | null>(null);

  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month + 1, 0);

  // First Monday on or before the 1st of the month
  const startDow  = (monthStart.getDay() + 6) % 7;
  const gridStart = addDays(monthStart, -startDow);

  // How many weeks needed (4, 5 or 6)
  const weeksNeeded = Math.ceil((startDow + monthEnd.getDate()) / 7);

  // Fetch bookings overlapping the full calendar grid (including padding days)
  const gridEnd = addDays(gridStart, weeksNeeded * 7);
  const { data: page, isLoading } = useBookings({
    startDate: toStr(gridStart),
    endDate:   toStr(gridEnd),
    limit:     2000,
  });
  const bookings = page?.data ?? [];
  const { data: rooms } = useRooms();
  const totalRooms = rooms?.length ?? 0;

  const gridStartStr = toStr(gridStart);
  const gridEndStr   = toStr(gridEnd);
  const dayStats = useMemo(
    () => computeDayStats(bookings, gridStartStr, gridEndStr),
    [bookings, gridStartStr, gridEndStr],
  );
  const statsOf = (ds: string) => dayStats.get(ds) ?? EMPTY_STATS;

  // Build week rows
  const weeks = useMemo<Date[][]>(() =>
    Array.from({ length: weeksNeeded }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => addDays(gridStart, w * 7 + d))
    ),
  [year, month]);

  // Sur mobile l'agenda du jour est le seul accès au détail : il reste toujours alimenté.
  const goToMonth = (y: number, m: number) => {
    const d = new Date(y, m, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    if (isMobile) {
      const isCurrent = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
      setSelectedDay(isCurrent ? todayStr : toStr(d));
    }
  };
  const prevMonth = () => goToMonth(year, month - 1);
  const nextMonth = () => goToMonth(year, month + 1);

  const selectDay = (ds: string) => {
    const d = new Date(ds + NOON);
    setSelectedDay(ds);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };
  const shiftSelectedDay = (n: number) => {
    if (selectedDay) selectDay(toStr(addDays(new Date(selectedDay + NOON), n)));
  };

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < SWIPE_PX) return;
    if (dx < 0) nextMonth(); else prevMonth();
  };

  // Selected day bookings
  const selArrivals   = selectedDay ? bookings.filter(b => b.arrival   === selectedDay && b.status !== 'cancelled') : [];
  const selDepartures = selectedDay ? bookings.filter(b => b.departure === selectedDay && b.status !== 'cancelled') : [];
  const selStaying    = selectedDay ? bookings.filter(b => b.arrival < selectedDay && b.departure > selectedDay && b.status !== 'cancelled') : [];

  return (
    <div className="space-y-5">

      {/* ── Month navigation ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-none">
          <button onClick={prevMonth}
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full border border-stone-200 hover:bg-stone-50 transition-colors">
            <ChevronLeft className="w-4 h-4 text-on-surface-variant" />
          </button>
          <h3 className="font-display italic text-lg sm:text-2xl text-on-surface flex-1 min-w-0 truncate sm:flex-none sm:w-52 text-center">
            {new Date(year, month, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
          </h3>
          <button onClick={nextMonth}
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full border border-stone-200 hover:bg-stone-50 transition-colors">
            <ChevronRight className="w-4 h-4 text-on-surface-variant" />
          </button>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {isLoading && <span className="hidden sm:inline text-[10px] font-bold text-primary/50 uppercase tracking-widest animate-pulse">{t('common.loading')}</span>}
          <button onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); setSelectedDay(todayStr); }}
            className="px-3 sm:px-4 py-2 bg-stone-100 text-on-surface-variant rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-stone-200 transition-colors">
            {t('calendar.today')}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 lg:items-start">

        {/* ── Calendar grid ── */}
        <div className="w-full lg:flex-1 min-w-0 bg-white rounded-2xl sm:rounded-3xl border border-stone-200/60 overflow-hidden organic-shadow touch-pan-y"
          onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

          {/* Day-of-week header */}
          <div className="grid grid-cols-7 border-b border-stone-100 bg-stone-50/60">
            {Array.from({ length: 7 }, (_, i) => addDays(MONDAY, i)).map(d => (
              <div key={d.getDay()} className="py-2 sm:py-3 text-center text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                {d.toLocaleDateString(locale, { weekday: isMobile ? 'narrow' : 'short' })}
              </div>
            ))}
          </div>

          {/* Week rows */}
          {weeks.map((weekDates, wi) => {
            const wStart = weekDates[0];
            const bars   = computeBars(wStart, bookings);
            const lanes  = bars.length > 0 ? Math.max(...bars.map(b => b.lane)) + 1 : 0;
            const visibleBars = isMobile ? bars.filter(b => b.lane < M_MAX_LANES) : bars;
            const hiddenPerDay = isMobile
              ? Array.from({ length: 7 }, (_, di) =>
                  bars.filter(b => b.lane >= M_MAX_LANES && b.colStart <= di && b.colEnd > di).length)
              : [];
            const hasHidden = hiddenPerDay.some(n => n > 0);
            const laneH   = isMobile ? M_LANE_H : LANE_H;
            const headerH = isMobile ? M_HEADER_H : HEADER_H;
            const rowH = isMobile
              ? Math.max(M_MIN_ROW_H, M_HEADER_H + Math.min(lanes, M_MAX_LANES) * M_LANE_H + (hasHidden ? M_MORE_H : 0) + 6)
              : HEADER_H + lanes * LANE_H + 8;

            return (
              <div key={wi} className="relative border-b border-stone-50 last:border-0" style={{ height: rowH }}>

                {/* Day cells (background + day numbers) */}
                <div className="grid grid-cols-7 h-full absolute inset-0">
                  {weekDates.map((date, di) => {
                    const ds       = toStr(date);
                    const inMonth  = date.getMonth() === month;
                    const isToday  = ds === todayStr;
                    const isSel    = ds === selectedDay;
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                    return (
                      <div key={di}
                        onClick={() => isMobile ? selectDay(ds) : setSelectedDay(isSel ? null : ds)}
                        className={cn(
                          'border-r border-stone-50 last:border-0 px-0.5 sm:px-2 pt-1 sm:pt-2 cursor-pointer transition-colors h-full',
                          'text-center sm:text-left',
                          isSel     ? 'bg-teal-50'       :
                          isToday   ? 'bg-primary/5'     :
                          !inMonth  ? 'bg-stone-50/50'   :
                          isWeekend ? 'bg-stone-50/30'   : 'hover:bg-stone-50/50',
                        )}>
                        <div className="flex items-start justify-center sm:justify-between gap-1">
                        <span className={cn(
                          'w-6 h-6 sm:w-7 sm:h-7 shrink-0 inline-flex items-center justify-center rounded-full text-xs sm:text-sm font-bold leading-none',
                          isToday  ? 'bg-primary text-white'          :
                          isSel && isMobile ? 'bg-teal-100 text-primary' :
                          !inMonth ? 'text-on-surface-variant/25'     :
                          isSel    ? 'text-primary'                   : 'text-on-surface-variant/70',
                        )}>
                          {date.getDate()}
                        </span>
                          {!isMobile && <OccupiedCount stats={statsOf(ds)} dim={!inMonth} />}
                        </div>
                        {isMobile && (
                          <div className="flex justify-center mt-0.5">
                            <OccupiedCount stats={statsOf(ds)} dim={!inMonth} />
                          </div>
                        )}
                        <MovementCounts stats={statsOf(ds)} dim={!inMonth} />
                      </div>
                    );
                  })}
                </div>

                {/* Booking bars overlay */}
                <div className="absolute inset-0 pointer-events-none" style={{ top: headerH }}>
                  {visibleBars.map(bar => {
                    const cls = BAR_CLS[bar.booking.effectiveStatus] ?? DEFAULT_BAR_CLS;
                    return (
                      <div
                        key={`${bar.booking.id}-${wi}`}
                        title={`${bar.booking.guestName} · ${t(EFFECTIVE_STATUS_I18N_KEY[bar.booking.effectiveStatus])}`}
                        onClick={isMobile ? undefined : () => navigate(`/reservations/${bar.booking.id}`)}
                        className={cn(
                          'absolute flex items-center border overflow-hidden select-none',
                          isMobile
                            ? 'rounded-full'
                            : 'px-2 rounded-md text-[9px] font-bold pointer-events-auto cursor-pointer hover:brightness-95 transition-all',
                          cls,
                        )}
                        style={{
                          top:    bar.lane * laneH + (isMobile ? 1 : 2),
                          height: laneH - (isMobile ? 2 : 4),
                          left:   `calc(${(bar.colStart / 7) * 100}% + ${isMobile ? 2 : 3}px)`,
                          right:  `calc(${((7 - bar.colEnd) / 7) * 100}% + ${isMobile ? 2 : 3}px)`,
                        }}
                      >
                        {!isMobile && (bar.showName || bar.colEnd - bar.colStart > 1) && (
                          <span className="truncate">{bar.booking.guestName}</span>
                        )}
                        {!isMobile && bar.booking.rooms.length > 1 && (
                          <span className="ml-1 opacity-60 shrink-0">+{bar.booking.rooms.length - 1}</span>
                        )}
                      </div>
                    );
                  })}
                  {hasHidden && (
                    <div className="absolute inset-x-0 grid grid-cols-7" style={{ top: M_MAX_LANES * M_LANE_H }}>
                      {hiddenPerDay.map((n, di) => (
                        <span key={di} className="text-center text-[8px] font-bold text-on-surface-variant/50 leading-3">
                          {n > 0 ? `+${n}` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Day detail panel ── */}
        <AnimatePresence>
          {selectedDay && (
            <motion.div
              initial={isMobile ? { opacity: 0 } : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={isMobile ? { opacity: 0 } : { opacity: 0, x: 12 }}
              className="w-full lg:w-72 shrink-0 bg-white rounded-2xl sm:rounded-3xl border border-stone-200/60 organic-shadow overflow-hidden"
            >
              <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 sm:py-4 border-b border-stone-100 bg-stone-50/60">
                <button onClick={() => shiftSelectedDay(-1)} aria-label={t('calendar.previousDay')}
                  className="sm:hidden w-9 h-9 shrink-0 flex items-center justify-center rounded-full border border-stone-200 bg-white">
                  <ChevronLeft className="w-4 h-4 text-on-surface-variant" />
                </button>
                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                    {new Date(selectedDay + NOON).toLocaleDateString(locale, { weekday: 'long' })}
                  </p>
                  <p className="font-display italic text-xl text-primary leading-none mt-0.5">
                    {new Date(selectedDay + NOON).toLocaleDateString(locale, { day: 'numeric', month: 'long' })}
                  </p>
                </div>
                <button onClick={() => shiftSelectedDay(1)} aria-label={t('calendar.nextDay')}
                  className="sm:hidden w-9 h-9 shrink-0 flex items-center justify-center rounded-full border border-stone-200 bg-white">
                  <ChevronRight className="w-4 h-4 text-on-surface-variant" />
                </button>
                <button onClick={() => setSelectedDay(null)} aria-label={t('common.close')}
                  className="hidden sm:block p-1.5 rounded-full text-on-surface-variant/30 hover:bg-stone-100 transition-colors mt-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-4 space-y-4 sm:max-h-[540px] sm:overflow-y-auto no-scrollbar">
                <div className="grid grid-cols-3 gap-2">
                  <StatTile icon={<BedDouble className="w-3.5 h-3.5" />} label={t('calendar.occupied')} color="text-teal-700"
                    value={totalRooms > 0 ? `${statsOf(selectedDay).occupied}/${totalRooms}` : String(statsOf(selectedDay).occupied)} />
                  <StatTile icon={<LogIn className="w-3.5 h-3.5" />} label={t('calendar.arrivalsShort')} color="text-emerald-600"
                    value={String(statsOf(selectedDay).arrivals)} />
                  <StatTile icon={<LogOut className="w-3.5 h-3.5" />} label={t('calendar.departuresShort')} color="text-amber-600"
                    value={String(statsOf(selectedDay).departures)} />
                </div>
                {selArrivals.length > 0 && (
                  <PanelSection icon={<LogIn className="w-3 h-3" />} label={t('calendar.arrivals', { count: selArrivals.length })} color="text-emerald-600">
                    {selArrivals.map(b => <MiniCard key={b.id} booking={b} onNav={() => navigate(`/reservations/${b.id}`)} />)}
                  </PanelSection>
                )}
                {selDepartures.length > 0 && (
                  <PanelSection icon={<LogOut className="w-3 h-3" />} label={t('calendar.departures', { count: selDepartures.length })} color="text-stone-400">
                    {selDepartures.map(b => <MiniCard key={b.id} booking={b} onNav={() => navigate(`/reservations/${b.id}`)} />)}
                  </PanelSection>
                )}
                {selStaying.length > 0 && (
                  <PanelSection icon={<Users className="w-3 h-3" />} label={t('calendar.inHouse', { count: selStaying.length })} color="text-teal-600">
                    {selStaying.map(b => <MiniCard key={b.id} booking={b} onNav={() => navigate(`/reservations/${b.id}`)} />)}
                  </PanelSection>
                )}
                {!selArrivals.length && !selDepartures.length && !selStaying.length && (
                  <div className="py-10 text-center text-on-surface-variant/25">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-display italic">{t('calendar.noActivity')}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-5">
        <div className="flex items-center gap-3 pr-1 sm:pr-3 sm:border-r border-stone-200">
          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-teal-700/70">
            <BedDouble className="w-3 h-3" /> {t('calendar.occupied')}
          </span>
          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-emerald-600/70">
            <LogIn className="w-3 h-3" /> {t('calendar.arrivalsShort')}
          </span>
          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-amber-600/70">
            <LogOut className="w-3 h-3" /> {t('calendar.departuresShort')}
          </span>
        </div>
        {LEGEND.map(({ status, cls }) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={cn('w-4 h-2.5 sm:w-5 sm:h-3 rounded border shrink-0', cls)} />
            <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40">{t(EFFECTIVE_STATUS_I18N_KEY[status])}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────

const Count: React.FC<{ icon: React.ReactNode; value: number; className: string; title: string }> = ({ icon, value, className, title }) => (
  <span title={title} aria-label={title}
    className={cn('inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-bold leading-none tabular-nums whitespace-nowrap', className)}>
    {icon}{value}
  </span>
);

const OccupiedCount: React.FC<{ stats: DayStats; dim: boolean }> = ({ stats, dim }) => {
  const { t } = useTranslation();
  if (stats.occupied === 0) return null;
  return (
    <Count icon={<BedDouble className="w-2.5 h-2.5 sm:w-3 sm:h-3" />} value={stats.occupied}
      title={t('calendar.occupiedCount', { count: stats.occupied })}
      className={cn('text-teal-700 sm:mt-1.5', dim && 'opacity-40')} />
  );
};

const MovementCounts: React.FC<{ stats: DayStats; dim: boolean }> = ({ stats, dim }) => {
  const { t } = useTranslation();
  if (stats.arrivals === 0 && stats.departures === 0) return null;
  return (
    <div className={cn('flex items-center justify-center sm:justify-start gap-1 sm:gap-2 mt-0.5 sm:mt-1', dim && 'opacity-40')}>
      {stats.arrivals > 0 && (
        <Count icon={<LogIn className="w-2.5 h-2.5 sm:w-3 sm:h-3" />} value={stats.arrivals}
          title={t('calendar.arrivalsCount', { count: stats.arrivals })} className="text-emerald-600" />
      )}
      {stats.departures > 0 && (
        <Count icon={<LogOut className="w-2.5 h-2.5 sm:w-3 sm:h-3" />} value={stats.departures}
          title={t('calendar.departuresCount', { count: stats.departures })} className="text-amber-600" />
      )}
    </div>
  );
};

const StatTile: React.FC<{ icon: React.ReactNode; label: string; value: string; color: string }> = ({ icon, label, value, color }) => (
  <div className="rounded-xl bg-stone-50 border border-stone-100 px-2 py-2.5 text-center min-w-0">
    <p className={cn('flex items-center justify-center gap-1 font-mono text-base font-bold leading-none tabular-nums', color)}>
      {icon}{value}
    </p>
    <p className="mt-1.5 text-[8px] font-bold uppercase tracking-widest text-on-surface-variant/50 truncate">{label}</p>
  </div>
);

const PanelSection: React.FC<{ icon: React.ReactNode; label: string; color: string; children: React.ReactNode }> = ({ icon, label, color, children }) => (
  <section>
    <p className={cn('flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest mb-2', color)}>
      {icon} {label}
    </p>
    <div className="space-y-1.5">{children}</div>
  </section>
);

const MiniCard: React.FC<{ booking: RichBooking; onNav: () => void }> = ({ booking, onNav }) => {
  const { t } = useTranslation();
  return (
  <div onClick={onNav} role="link" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') onNav(); }}
    className="flex items-center justify-between p-3 sm:p-2.5 bg-stone-50 rounded-xl border border-stone-100 hover:border-stone-200 active:bg-stone-100 transition-colors cursor-pointer">
    <div className="min-w-0">
      <p className="text-xs font-semibold text-on-surface truncate">{booking.guestName}</p>
      <p className="text-[9px] text-on-surface-variant/50 truncate">
        {t('calendar.miniCard', { rooms: booking.rooms.map(br => `#${br.room.number}`).join(' · '), nights: booking.nights })}
      </p>
      <span className={cn('inline-flex mt-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border', EFFECTIVE_STATUS_CLASS[booking.effectiveStatus])}>
        {t(EFFECTIVE_STATUS_I18N_KEY[booking.effectiveStatus])}
      </span>
    </div>
    <FileText aria-hidden className="w-3.5 h-3.5 ml-2 text-on-surface-variant/30 shrink-0" />
  </div>
  );
};
