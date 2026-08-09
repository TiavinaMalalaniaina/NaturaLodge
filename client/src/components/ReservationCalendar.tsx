import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X, LogIn, LogOut, Users, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { useBookings } from '../hooks/useBookings';
import { EFFECTIVE_STATUS_CLASS, EFFECTIVE_STATUS_LABEL } from '../lib/bookingStatus';
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

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

// ─── Bar styles by status ─────────────────────────────────────────

const BAR_CLS: Partial<Record<EffectiveStatus, string>> = {
  upcoming:    'bg-primary/15 text-primary border-primary/20',
  due_checkin: 'bg-amber-100  text-amber-800 border-amber-200',
  in_progress: 'bg-teal-700   text-white     border-teal-600',
  overdue:     'bg-red-100    text-red-700   border-red-200',
  awaiting:    'bg-amber-100  text-amber-800 border-amber-200',
  checked_out: 'bg-stone-100  text-stone-400 border-stone-200',
  cancelled:   'bg-stone-50   text-stone-300 border-stone-100',
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

// ─── Component ────────────────────────────────────────────────────

const LANE_H   = 26;  // px per lane
const HEADER_H = 36;  // day-number row height

export const ReservationCalendar: React.FC = () => {
  const navigate = useNavigate();
  const today    = new Date();

  const [month, setMonth] = useState(today.getMonth());
  const [year,  setYear]  = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const todayStr   = toStr(today);
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

  // Build week rows
  const weeks = useMemo<Date[][]>(() =>
    Array.from({ length: weeksNeeded }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => addDays(gridStart, w * 7 + d))
    ),
  [year, month]);

  const prevMonth = () => month === 0 ? (setMonth(11), setYear(y => y - 1)) : setMonth(m => m - 1);
  const nextMonth = () => month === 11 ? (setMonth(0), setYear(y => y + 1)) : setMonth(m => m + 1);

  // Selected day bookings
  const selArrivals   = selectedDay ? bookings.filter(b => b.arrival   === selectedDay && b.status !== 'cancelled') : [];
  const selDepartures = selectedDay ? bookings.filter(b => b.departure === selectedDay && b.status !== 'cancelled') : [];
  const selStaying    = selectedDay ? bookings.filter(b => b.arrival < selectedDay && b.departure > selectedDay && b.status !== 'cancelled') : [];

  return (
    <div className="space-y-5">

      {/* ── Month navigation ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-stone-200 hover:bg-stone-50 transition-colors">
            <ChevronLeft className="w-4 h-4 text-on-surface-variant" />
          </button>
          <h3 className="font-display italic text-2xl text-on-surface w-52 text-center">
            {MONTHS[month]} {year}
          </h3>
          <button onClick={nextMonth}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-stone-200 hover:bg-stone-50 transition-colors">
            <ChevronRight className="w-4 h-4 text-on-surface-variant" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          {isLoading && <span className="text-[10px] font-bold text-primary/50 uppercase tracking-widest animate-pulse">Loading…</span>}
          <button onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); setSelectedDay(todayStr); }}
            className="px-4 py-2 bg-stone-100 text-on-surface-variant rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-stone-200 transition-colors">
            Today
          </button>
        </div>
      </div>

      <div className="flex gap-5 items-start">

        {/* ── Calendar grid ── */}
        <div className="flex-1 bg-white rounded-3xl border border-stone-200/60 overflow-hidden organic-shadow">

          {/* Day-of-week header */}
          <div className="grid grid-cols-7 border-b border-stone-100 bg-stone-50/60">
            {DOW.map(d => (
              <div key={d} className="py-3 text-center text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                {d}
              </div>
            ))}
          </div>

          {/* Week rows */}
          {weeks.map((weekDates, wi) => {
            const wStart = weekDates[0];
            const bars   = computeBars(wStart, bookings);
            const lanes  = bars.length > 0 ? Math.max(...bars.map(b => b.lane)) + 1 : 0;
            const rowH   = HEADER_H + lanes * LANE_H + 8;

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
                        onClick={() => setSelectedDay(isSel ? null : ds)}
                        className={cn(
                          'border-r border-stone-50 last:border-0 px-2 pt-2 cursor-pointer transition-colors h-full',
                          isSel     ? 'bg-teal-50'       :
                          isToday   ? 'bg-primary/5'     :
                          !inMonth  ? 'bg-stone-50/50'   :
                          isWeekend ? 'bg-stone-50/30'   : 'hover:bg-stone-50/50',
                        )}>
                        <span className={cn(
                          'w-7 h-7 inline-flex items-center justify-center rounded-full text-sm font-bold leading-none',
                          isToday  ? 'bg-primary text-white'          :
                          !inMonth ? 'text-on-surface-variant/25'     :
                          isSel    ? 'text-primary'                   : 'text-on-surface-variant/70',
                        )}>
                          {date.getDate()}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Booking bars overlay */}
                <div className="absolute inset-0 pointer-events-none" style={{ top: HEADER_H }}>
                  {bars.map(bar => {
                    const cls = BAR_CLS[bar.booking.effectiveStatus] ?? 'bg-stone-100 text-stone-400 border-stone-200';
                    return (
                      <div
                        key={`${bar.booking.id}-${wi}`}
                        title={`${bar.booking.guestName} · ${EFFECTIVE_STATUS_LABEL[bar.booking.effectiveStatus]}`}
                        onClick={() => navigate(`/reservations/${bar.booking.id}`)}
                        className={cn(
                          'absolute flex items-center px-2 rounded-md border text-[9px] font-bold pointer-events-auto cursor-pointer hover:brightness-95 transition-all overflow-hidden select-none',
                          cls,
                        )}
                        style={{
                          top:    bar.lane * LANE_H + 2,
                          height: LANE_H - 4,
                          left:   `calc(${(bar.colStart / 7) * 100}% + 3px)`,
                          right:  `calc(${((7 - bar.colEnd) / 7) * 100}% + 3px)`,
                        }}
                      >
                        {(bar.showName || bar.colEnd - bar.colStart > 1) && (
                          <span className="truncate">{bar.booking.guestName}</span>
                        )}
                        {bar.booking.rooms.length > 1 && (
                          <span className="ml-1 opacity-60 shrink-0">+{bar.booking.rooms.length - 1}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Day detail panel ── */}
        <AnimatePresence>
          {selectedDay && (
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              className="w-72 shrink-0 bg-white rounded-3xl border border-stone-200/60 organic-shadow overflow-hidden"
            >
              <div className="flex items-start justify-between px-5 py-4 border-b border-stone-100 bg-stone-50/60">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                    {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' })}
                  </p>
                  <p className="font-display italic text-xl text-primary leading-none mt-0.5">
                    {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
                  </p>
                </div>
                <button onClick={() => setSelectedDay(null)}
                  className="p-1.5 rounded-full text-on-surface-variant/30 hover:bg-stone-100 transition-colors mt-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-4 space-y-4 max-h-[540px] overflow-y-auto no-scrollbar">
                {selArrivals.length > 0 && (
                  <PanelSection icon={<LogIn className="w-3 h-3" />} label={`Arrivals (${selArrivals.length})`} color="text-emerald-600">
                    {selArrivals.map(b => <MiniCard key={b.id} booking={b} onNav={() => navigate(`/reservations/${b.id}`)} />)}
                  </PanelSection>
                )}
                {selDepartures.length > 0 && (
                  <PanelSection icon={<LogOut className="w-3 h-3" />} label={`Departures (${selDepartures.length})`} color="text-stone-400">
                    {selDepartures.map(b => <MiniCard key={b.id} booking={b} onNav={() => navigate(`/reservations/${b.id}`)} />)}
                  </PanelSection>
                )}
                {selStaying.length > 0 && (
                  <PanelSection icon={<Users className="w-3 h-3" />} label={`In-house (${selStaying.length})`} color="text-teal-600">
                    {selStaying.map(b => <MiniCard key={b.id} booking={b} onNav={() => navigate(`/reservations/${b.id}`)} />)}
                  </PanelSection>
                )}
                {!selArrivals.length && !selDepartures.length && !selStaying.length && (
                  <div className="py-10 text-center text-on-surface-variant/25">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-display italic">No activity</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-5">
        {([
          { label: 'Upcoming',    cls: 'bg-primary/15 border-primary/20' },
          { label: 'Due check-in',cls: 'bg-amber-100 border-amber-200'   },
          { label: 'In progress', cls: 'bg-teal-700 border-teal-600'     },
          { label: 'Overdue',     cls: 'bg-red-100 border-red-200'       },
          { label: 'Checked out', cls: 'bg-stone-100 border-stone-200'   },
        ] as const).map(({ label, cls }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={cn('w-5 h-3 rounded border', cls)} />
            <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────

const PanelSection: React.FC<{ icon: React.ReactNode; label: string; color: string; children: React.ReactNode }> = ({ icon, label, color, children }) => (
  <section>
    <p className={cn('flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest mb-2', color)}>
      {icon} {label}
    </p>
    <div className="space-y-1.5">{children}</div>
  </section>
);

const MiniCard: React.FC<{ booking: RichBooking; onNav: () => void }> = ({ booking, onNav }) => (
  <div className="flex items-center justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-100 hover:border-stone-200 transition-colors">
    <div className="min-w-0">
      <p className="text-xs font-semibold text-on-surface truncate">{booking.guestName}</p>
      <p className="text-[9px] text-on-surface-variant/50 truncate">
        {booking.rooms.map(br => `#${br.room.number}`).join(' · ')} · {booking.nights}n
      </p>
      <span className={cn('inline-flex mt-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border', EFFECTIVE_STATUS_CLASS[booking.effectiveStatus])}>
        {EFFECTIVE_STATUS_LABEL[booking.effectiveStatus]}
      </span>
    </div>
    <button onClick={onNav} className="p-1.5 ml-2 text-on-surface-variant/30 hover:text-primary transition-colors shrink-0">
      <FileText className="w-3.5 h-3.5" />
    </button>
  </div>
);
