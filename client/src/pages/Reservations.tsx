import React, { useState, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Users, Calendar, Filter,
  Download, Info, Construction, RefreshCw, LayoutGrid, List,
  Search, MoreVertical, CreditCard, Clock, FileText, X,
  LogIn, LogOut, AlertTriangle, RotateCcw, Ban,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '../hooks/useDebounce';
import { AddReservationModal } from '../components/AddReservationModal';
import { ReassignRoomModal } from '../components/ReassignRoomModal';
import { InvoiceModal } from '../components/InvoiceModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { ReservationCalendar } from '../components/ReservationCalendar';
import { useBookings, useUpdateBookingStatus } from '../hooks/useBookings';
import { useRooms } from '../hooks/useRooms';
import { PageLoader, PageError } from '../components/QueryLoader';
import { EFFECTIVE_STATUS_CLASS, EFFECTIVE_STATUS_I18N_KEY } from '../lib/bookingStatus';
import { RichBooking, EffectiveStatus } from '../api/bookings';

// ── Date helpers ──────────────────────────────────────────────────

function getMondayOf(d: Date): Date {
  const date = new Date(d);
  const day  = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function toStr(d: Date): string { return d.toISOString().split('T')[0]; }
function dayDiff(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Block styles by effectiveStatus ──────────────────────────────

const BLOCK_CLS: Partial<Record<EffectiveStatus, string>> = {
  upcoming:    'bg-primary-container/90 text-on-primary-container border-primary/20',
  due_checkin: 'bg-amber-100 text-amber-900 border-amber-300',
  in_progress: 'bg-teal-800 text-white border-teal-700',
  overdue:     'bg-red-100 text-red-900 border-red-300',
  checked_in:  'bg-teal-800 text-white border-teal-700',
  checked_out: 'bg-stone-100 text-stone-400 border-stone-200',
};

// ── Constants ─────────────────────────────────────────────────────

const LIMIT          = 20;
const BOOKING_STATUS = ['ALL', 'CONFIRMED', 'CHECKED_IN', 'AWAITING', 'CANCELLED', 'CHECKED_OUT'];
const ROOM_STATUS    = ['ALL', 'AVAILABLE', 'OCCUPIED', 'MAINTENANCE'];
const CATEGORIES     = ['ALL', 'Suite', 'Deluxe', 'Superior', 'Penthouse', 'Villa', 'Luxury'];

// ── Main component ────────────────────────────────────────────────

export const Reservations: React.FC = () => {
  const { t } = useTranslation();

  // Week day labels localised
  const WEEK_LABELS = [
    t('calendar.mon', 'Lun'), t('calendar.tue', 'Mar'), t('calendar.wed', 'Mer'),
    t('calendar.thu', 'Jeu'), t('calendar.fri', 'Ven'), t('calendar.sat', 'Sam'), t('calendar.sun', 'Dim'),
  ];

  // View
  const [viewMode, setViewMode]         = useState<'grid' | 'list' | 'calendar'>('grid');

  // Filters (shared)
  const [searchQuery, setSearchQuery]   = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // List pagination
  const [page, setPage] = useState(1);

  // Grid week
  const [weekStart, setWeekStart] = useState(() => getMondayOf(new Date()));
  const weekEnd   = addDays(weekStart, 7);
  const todayStr  = toStr(new Date());
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen]     = useState(false);
  const [addModalRoom, setAddModalRoom]         = useState<string | null>(null);
  const [addModalDate, setAddModalDate]         = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking]   = useState<RichBooking | null>(null);
  const [invoiceBooking, setInvoiceBooking]     = useState<RichBooking | null>(null);
  const [reassignBooking, setReassignBooking]   = useState<{ id: string; room: string } | null>(null);
  const [cancelBookingId, setCancelBookingId]   = useState<string | null>(null);

  const navigate     = useNavigate();
  const updateStatus = useUpdateBookingStatus();

  const debouncedSearch = useDebounce(searchQuery);

  // ── Data ─────────────────────────────────────────────────────────

  const apiStatus = statusFilter === 'ALL' ? undefined : statusFilter;

  const { data: listPage, isLoading: listLoading, isError: listError } = useBookings(
    viewMode === 'list'
      ? { page, limit: LIMIT, search: debouncedSearch || undefined, status: apiStatus }
      : { limit: 1 }
  );

  const { data: gridPage, isLoading: gridLoading } = useBookings(
    viewMode === 'grid'
      ? { startDate: toStr(weekStart), endDate: toStr(weekEnd), limit: 500 }
      : { limit: 1 }
  );
  const gridBookings = gridPage?.data ?? [];

  // Grid : toutes les chambres chargées une fois, filtrées côté client
  const { data: allGridRooms = [], isLoading: roomsLoading } = useRooms(
    viewMode === 'grid' ? {} : undefined
  );

  const gridRooms = useMemo(() => {
    if (viewMode !== 'grid') return [];
    const q = searchQuery.toLowerCase();
    return allGridRooms.filter(room => {
      if (q && !room.number.toLowerCase().includes(q) && !room.type.toLowerCase().includes(q)) return false;
      if (statusFilter !== 'ALL' && room.status.toUpperCase() !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && room.category !== categoryFilter) return false;
      return true;
    });
  }, [allGridRooms, searchQuery, statusFilter, categoryFilter, viewMode]);

  // ── Grid helpers ──────────────────────────────────────────────────

  const getRoomBookings = (roomId: string) =>
    gridBookings.filter(b => b.status !== 'cancelled' && b.rooms.some(br => br.room.id === roomId));

  function getBlockStyle(b: RichBooking): React.CSSProperties | null {
    const start = Math.max(0, dayDiff(weekStart, new Date(b.arrival)));
    const end   = Math.min(7, dayDiff(weekStart, new Date(b.departure)));
    if (end <= start) return null;
    return {
      left:  `calc(${(start / 7) * 100}% + 4px)`,
      width: `calc(${((end - start) / 7) * 100}% - 8px)`,
    };
  }

  // ── Filters reset ─────────────────────────────────────────────────

  const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v); setPage(1);
  };

  // ── Render ────────────────────────────────────────────────────────

  const isGridLoading = viewMode === 'grid' && (gridLoading || roomsLoading);
  const isListLoading = viewMode === 'list' && listLoading;

  if (isGridLoading || isListLoading) return <PageLoader />;
  if (viewMode === 'list' && listError) return <PageError />;

  const listBookings = listPage?.data ?? [];
  const meta         = listPage?.meta;

  const viewLabel = viewMode === 'grid'
    ? t('reservations.planningGrid')
    : viewMode === 'calendar'
    ? t('reservations.calendar')
    : t('reservations.bookingsRegistry');

  return (
    <div className="space-y-8 h-full">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 sm:gap-0">
        <div>
          <h2 className="font-display italic text-3xl md:text-4xl text-on-surface mb-3 leading-none">
            {viewLabel}
          </h2>

          <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
            {/* View toggle */}
            <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200 w-fit">
              {([
                { v: 'grid',     icon: <LayoutGrid className="w-4 h-4" />, label: t('reservations.viewGrid')    },
                { v: 'list',     icon: <List className="w-4 h-4" />,       label: t('reservations.viewList')    },
                { v: 'calendar', icon: <Calendar className="w-4 h-4" />,   label: t('reservations.calendar')   },
              ] as const).map(({ v, icon, label }) => (
                <button key={v} onClick={() => setViewMode(v)}
                  className={cn('p-2 rounded-lg transition-all flex items-center gap-2',
                    viewMode === v ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant/40 hover:text-on-surface-variant/60')}>
                  {icon}
                  <span className="text-[9px] font-bold uppercase tracking-widest hidden md:block">{label}</span>
                </button>
              ))}
            </div>

            {/* Week navigation */}
            {viewMode === 'grid' && (
              <div className="flex items-center gap-3 text-on-surface-variant/60">
                <button onClick={() => setWeekStart(d => addDays(d, -7))}
                  className="flex items-center justify-center w-8 h-8 rounded-full border border-stone-200 hover:bg-stone-50 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setWeekStart(getMondayOf(new Date()))}
                  className="font-mono text-xs font-bold tracking-wide hover:text-primary transition-colors">
                  {fmtDate(weekStart)} — {fmtDate(addDays(weekStart, 6))}
                </button>
                <button onClick={() => setWeekStart(d => addDays(d, 7))}
                  className="flex items-center justify-center w-8 h-8 rounded-full border border-stone-200 hover:bg-stone-50 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-4 w-full sm:w-auto">
          <button onClick={() => { setAddModalRoom(null); setIsAddModalOpen(true); }}
            className="w-full sm:w-auto bg-primary text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-sans text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase hover:bg-primary-container transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/10 shrink-0">
            <Plus className="w-4 h-4" /> {t('reservations.addReservation')}
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
              <input type="text" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={viewMode === 'grid' ? t('reservations.searchRoom') : t('reservations.searchGuestOrRoom')}
                className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-[10px] uppercase font-bold tracking-widest focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all" />
            </div>
            <button className="p-2 border border-outline-variant/60 rounded-xl hover:bg-stone-50 text-on-surface-variant transition-colors">
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-6 py-2 border-b border-stone-100">
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40">{t('reservations.filterCategory')}</span>
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => handleFilterChange(setCategoryFilter)(cat)}
                className={cn('px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all border',
                  categoryFilter === cat ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant/60 border-stone-200 hover:border-stone-400')}>
                {cat === 'ALL' ? t('common.all') : cat}
              </button>
            ))}
          </div>
        </div>
        <div className="h-4 w-px bg-stone-200 hidden md:block" />
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40">{t('reservations.filterStatus')}</span>
          <div className="flex gap-1.5 flex-wrap">
            {(viewMode === 'list' ? BOOKING_STATUS : ROOM_STATUS).map(s => (
              <button key={s} onClick={() => handleFilterChange(setStatusFilter)(s)}
                className={cn('px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all border',
                  statusFilter === s ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-on-surface-variant/60 border-stone-200 hover:border-stone-400')}>
                {s === 'ALL' ? t('common.all') : s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Views ── */}
      <AnimatePresence mode="wait">

        {/* ─────────────────── GRID VIEW ─────────────────── */}
        {viewMode === 'grid' && (
          <motion.div key="grid" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-3xl border border-outline-variant/40 overflow-hidden organic-shadow flex flex-col"
            style={{ height: 'calc(100vh - 380px)', minHeight: 400 }}>

            <div className="min-w-[900px] flex flex-col h-full">

              {/* Grid header — days */}
              <div className="flex border-b border-outline-variant/40 bg-stone-50/50 sticky top-0 z-30">
                <div className="w-44 flex-shrink-0 border-r border-outline-variant/40 p-4 flex items-center">
                  <span className="text-[9px] font-bold tracking-[0.2em] text-on-surface-variant/50 uppercase">{t('reservations.unit')}</span>
                </div>
                <div className="flex-1 flex">
                  {weekDates.map((date: Date, i: number) => {
                    const isToday = toStr(date) === todayStr;
                    return (
                      <div key={i} className={cn('flex-1 p-3 border-r border-stone-100 last:border-0 text-center', isToday && 'bg-teal-50/60')}>
                        <p className={cn('text-[9px] font-bold tracking-widest uppercase mb-0.5', isToday ? 'text-primary' : 'text-on-surface-variant/40')}>
                          {WEEK_LABELS[i]}
                        </p>
                        <p className={cn('font-mono text-lg leading-none', isToday ? 'text-primary font-bold' : 'text-on-surface')}>
                          {date.getDate()}
                        </p>
                        <p className="text-[8px] text-on-surface-variant/30 font-mono mt-0.5">
                          {date.toLocaleString('en', { month: 'short' }).toUpperCase()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Grid body — rooms */}
              <div className="flex-1 overflow-y-auto no-scrollbar relative min-h-0">
                {gridRooms.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center p-20 text-on-surface-variant/40">
                    <Filter className="w-12 h-12 mb-4 opacity-10" />
                    <p className="font-display italic text-2xl">{t('reservations.noUnitsMatch')}</p>
                    <button onClick={() => { setStatusFilter('ALL'); setCategoryFilter('ALL'); setSearchQuery(''); }}
                      className="mt-4 text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">
                      {t('reservations.clearAllFilters')}
                    </button>
                  </div>
                )}

                {gridRooms.map(room => {
                  const bookings = getRoomBookings(room.id);
                  const isMaint  = room.status === 'maintenance';

                  return (
                    <div key={room.id} className="flex border-b border-stone-50 last:border-0 relative group" style={{ height: 72 }}>

                      {/* Room label */}
                      <div className="w-44 flex-shrink-0 border-r border-outline-variant/40 px-4 flex flex-col justify-center bg-white group-hover:bg-stone-50/60 transition-colors z-10">
                        <p className="font-display italic text-xl text-primary leading-none">{room.type}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0',
                            room.status === 'available'    ? 'bg-status-available' :
                            room.status === 'occupied'     ? 'bg-status-occupied' :
                            room.status === 'reserved'     ? 'bg-status-reserved' : 'bg-status-maintenance')} />
                          <span className="text-[9px] font-bold tracking-widest text-on-surface-variant/50 uppercase truncate">
                            #{room.number} · {t(`status.${room.status}`, room.status)}
                          </span>
                        </div>
                      </div>

                      {/* Day cells grid */}
                      <div className="flex-1 flex relative">
                        {weekDates.map((date, i) => {
                          const isToday = toStr(date) === todayStr;
                          return (
                            <div key={i}
                              onClick={() => { if (!isMaint) { setAddModalRoom(room.id); setAddModalDate(toStr(date)); setIsAddModalOpen(true); } }}
                              className={cn(
                                'flex-1 border-r border-stone-50 last:border-0 h-full transition-colors',
                                isToday && 'bg-teal-50/30',
                                !isMaint && 'hover:bg-stone-50/80 cursor-pointer',
                              )} />
                          );
                        })}

                        {/* Maintenance overlay */}
                        {isMaint && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
                            style={{ background: 'repeating-linear-gradient(-45deg, transparent, transparent 8px, rgba(0,0,0,0.03) 8px, rgba(0,0,0,0.03) 16px)' }}>
                            <div className="flex items-center gap-2 text-status-maintenance/40">
                              <Construction className="w-4 h-4" />
                              <span className="text-[9px] font-bold uppercase tracking-widest">{t('status.maintenance')}</span>
                            </div>
                          </div>
                        )}

                        {/* Booking blocks */}
                        {bookings.map(b => {
                          const style = getBlockStyle(b);
                          if (!style) return null;
                          const cls = BLOCK_CLS[b.effectiveStatus] ?? 'bg-stone-100 text-stone-400 border-stone-200';
                          const isVip = b.guest.status === 'VIP_ELITE' || b.guest.status === 'PLATINUM_TIER';

                          return (
                            <motion.div
                              key={b.id}
                              initial={{ scaleX: 0, originX: 0 }}
                              animate={{ scaleX: 1 }}
                              transition={{ duration: 0.25 }}
                              style={{ ...style, top: 8, height: 56, position: 'absolute' }}
                              onClick={e => { e.stopPropagation(); setSelectedBooking(b); }}
                              className={cn(
                                'rounded-xl border flex flex-col justify-center px-3 cursor-pointer z-20 group/block overflow-hidden',
                                'hover:brightness-105 transition-all shadow-sm',
                                cls,
                                isVip && b.effectiveStatus === 'upcoming' && 'bg-gradient-to-r from-gold-400 to-gold-500 text-white border-gold-400',
                              )}>
                              <div className="flex items-center justify-between gap-1">
                                <p className="text-[10px] font-bold truncate leading-tight">{b.guestName}</p>
                                <div className="opacity-0 group-hover/block:opacity-100 transition-opacity shrink-0 flex gap-1">
                                  <button
                                    onClick={e => { e.stopPropagation(); setReassignBooking({ id: b.id, room: b.rooms[0]?.room.number ?? '' }); }}
                                    className="p-0.5 hover:bg-white/20 rounded" title={t('reservations.reassign')}>
                                    <RefreshCw className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-[8px] opacity-60 font-medium leading-tight mt-0.5">
                                {t(EFFECTIVE_STATUS_I18N_KEY[b.effectiveStatus])} · {b.nights}n
                              </p>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer legend */}
              <div className="p-4 border-t border-outline-variant/40 bg-stone-50/50 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-6">
                  {([
                    { key: 'status.upcoming',    cls: 'bg-primary-container border-primary/20' },
                    { key: 'status.dueCheckin',  cls: 'bg-amber-100 border-amber-300' },
                    { key: 'status.inProgress',  cls: 'bg-teal-800 border-teal-700' },
                    { key: 'status.overdue',     cls: 'bg-red-100 border-red-300' },
                    { key: 'legend.vip',         cls: 'bg-gradient-to-r from-gold-400 to-gold-500 border-gold-400' },
                    { key: 'status.maintenance', cls: 'bg-stone-100 border-stone-200' },
                  ] as const).map(item => (
                    <div key={item.key} className="flex items-center gap-2">
                      <span className={cn('w-3 h-3 rounded border', item.cls)} />
                      <span className="text-[9px] font-bold tracking-widest text-on-surface-variant/60 uppercase">
                        {item.key === 'legend.vip' ? 'VIP Stay' : t(item.key)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-bold tracking-[0.2em] text-on-surface-variant/40 uppercase">
                  <Info className="w-3 h-3" />
                  {t('reservations.clickHint')}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─────────────────── LIST VIEW ─────────────────── */}
        {viewMode === 'list' && (
          <motion.div key="list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-3xl border border-stone-200/60 overflow-hidden organic-shadow">

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50/50 border-b border-stone-100">
                    {[t('guests.title'), t('reservations.stayWindow'), t('rooms.title'), t('common.view'), t('common.total'), ''].map(h => (
                      <th key={h} className={cn('px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40', h === t('common.total') && 'text-right')}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {listBookings.map(b => (
                    <tr key={b.id} onClick={() => navigate(`/reservations/${b.id}`)} className="group hover:bg-stone-50/30 transition-colors cursor-pointer">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center">
                            <Users className="w-5 h-5 text-stone-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors">{b.guestName}</p>
                            <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-tighter font-mono">{b.guestId.slice(-8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3 text-primary opacity-40" />
                            <span className="text-xs font-medium">{b.arrival}</span>
                            <span className="text-on-surface-variant/40">→</span>
                            <span className="text-xs font-medium">{b.departure}</span>
                          </div>
                          <p className="text-[10px] text-on-surface-variant/40 font-mono pl-5">
                            {b.nights} {b.nights > 1 ? t('common.nights') : t('common.night')}
                          </p>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-xs font-bold text-primary">
                          {b.rooms.map(br => br.room.type).join(', ') || '—'}
                        </p>
                        <p className="text-[10px] font-mono text-on-surface-variant tracking-wider uppercase">
                          {b.rooms.map(br => `#${br.room.number}`).join(' · ') || '—'}
                        </p>
                      </td>
                      <td className="px-8 py-6">
                        <span className={cn('px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border', EFFECTIVE_STATUS_CLASS[b.effectiveStatus])}>
                          {t(EFFECTIVE_STATUS_I18N_KEY[b.effectiveStatus])}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <p className="text-sm font-display italic text-on-surface">{b.totalAmount.toLocaleString()} Ar</p>
                        <div className="flex gap-1.5 opacity-40 justify-end mt-1">
                          <CreditCard className="w-3 h-3" /><Clock className="w-3 h-3" />
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setInvoiceBooking(b)}
                            className="p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-stone-200 text-stone-400 hover:text-primary group/btn" title={t('invoice.title')}>
                            <FileText className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                          </button>
                          <button onClick={() => setSelectedBooking(b)}
                            className="p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-stone-200">
                            <MoreVertical className="w-5 h-5 text-on-surface-variant/40" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {listBookings.length === 0 && (
                    <tr><td colSpan={6} className="py-32 text-center">
                      <div className="flex flex-col items-center text-on-surface-variant/40">
                        <Search className="w-12 h-12 mb-4 opacity-10" />
                        <p className="font-display italic text-2xl">{t('reservations.noMatchingReservations')}</p>
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-8 py-5 bg-stone-50/50 border-t border-stone-100 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                {t('reservations.pageInfo', { page: meta?.page ?? 1, total: meta?.totalPages ?? 1, count: meta?.total ?? listBookings.length })}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => p - 1)} disabled={!meta?.hasPrevPage}
                  className="p-2 border border-stone-200 rounded-lg text-on-surface-variant/40 disabled:opacity-30 hover:bg-stone-50 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {meta && Array.from({ length: meta.totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === meta.totalPages || Math.abs(p - meta.page) <= 1)
                  .reduce<(number | '…')[]>((acc, p, i, arr) => {
                    if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('…');
                    acc.push(p); return acc;
                  }, [])
                  .map((p, i) => p === '…'
                    ? <span key={`e${i}`} className="px-1 text-on-surface-variant/30 text-xs">…</span>
                    : <button key={p} onClick={() => setPage(p as number)}
                        className={cn('w-8 h-8 rounded-lg text-[10px] font-bold border transition-colors',
                          meta.page === p ? 'bg-primary text-white border-primary' : 'border-stone-200 text-on-surface-variant/60 hover:bg-stone-50')}>
                        {p}
                      </button>
                  )}
                <button onClick={() => setPage(p => p + 1)} disabled={!meta?.hasNextPage}
                  className="p-2 border border-stone-200 rounded-lg text-on-surface-variant/40 disabled:opacity-30 hover:bg-stone-50 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─────────────────── CALENDAR VIEW ─────────────────── */}
        {viewMode === 'calendar' && (
          <motion.div key="calendar" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <ReservationCalendar />
          </motion.div>
        )}

      </AnimatePresence>

      {/* ── Booking detail / quick actions panel ── */}
      <AnimatePresence>
        {selectedBooking && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] w-full max-w-xl px-4"
          >
            <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl p-5 flex items-start gap-5">
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn('px-2.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border',
                    EFFECTIVE_STATUS_CLASS[selectedBooking.effectiveStatus])}>
                    {t(EFFECTIVE_STATUS_I18N_KEY[selectedBooking.effectiveStatus])}
                  </span>
                  <span className="text-[9px] font-mono text-on-surface-variant/40">#{selectedBooking.id.slice(-8)}</span>
                </div>
                <p className="font-semibold text-on-surface truncate">{selectedBooking.guestName}</p>
                <p className="text-xs text-on-surface-variant/60 mt-0.5">
                  {selectedBooking.rooms.map(br => br.room.type).join(', ')} · {selectedBooking.rooms.map(br => `#${br.room.number}`).join(' · ')} · {selectedBooking.arrival} → {selectedBooking.departure} ({selectedBooking.nights}n)
                </p>
                <p className="text-xs font-bold text-primary mt-1">{selectedBooking.totalAmount.toLocaleString()} Ar</p>
              </div>

              {/* Quick actions */}
              <div className="flex items-center gap-2 shrink-0">
                {selectedBooking.effectiveStatus === 'due_checkin' && (
                  <button
                    onClick={() => { updateStatus.mutate({ id: selectedBooking.id, status: 'CHECKED_IN' }); setSelectedBooking(null); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-teal-800 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-teal-900 transition-colors">
                    <LogIn className="w-3.5 h-3.5" /> {t('reservations.checkin')}
                  </button>
                )}
                {selectedBooking.effectiveStatus === 'in_progress' && (
                  <button
                    onClick={() => { updateStatus.mutate({ id: selectedBooking.id, status: 'CHECKED_OUT' }); setSelectedBooking(null); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-colors">
                    <LogOut className="w-3.5 h-3.5" /> {t('reservations.checkout')}
                  </button>
                )}
                {selectedBooking.effectiveStatus === 'in_progress' && (
                  <button
                    onClick={() => { updateStatus.mutate({ id: selectedBooking.id, status: 'CONFIRMED' }); setSelectedBooking(null); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-amber-100 transition-colors">
                    <RotateCcw className="w-3.5 h-3.5" /> {t('reservations.revert')}
                  </button>
                )}
                {selectedBooking.effectiveStatus === 'overdue' && (
                  <button
                    onClick={() => { updateStatus.mutate({ id: selectedBooking.id, status: 'CHECKED_OUT' }); setSelectedBooking(null); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-red-700 transition-colors">
                    <AlertTriangle className="w-3.5 h-3.5" /> {t('reservations.forceOut')}
                  </button>
                )}
                {(selectedBooking.effectiveStatus === 'upcoming' || selectedBooking.effectiveStatus === 'due_checkin') && (
                  <button
                    onClick={() => setCancelBookingId(selectedBooking.id)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-500 border border-red-200 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-red-100 transition-colors">
                    <Ban className="w-3.5 h-3.5" /> {t('common.cancel')}
                  </button>
                )}
                <button
                  onClick={() => { setReassignBooking({ id: selectedBooking.id, room: selectedBooking.rooms[0]?.room.number ?? '' }); setSelectedBooking(null); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-stone-100 text-on-surface-variant rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-stone-200 transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" /> {t('reservations.reassign')}
                </button>
                <button
                  onClick={() => { setInvoiceBooking(selectedBooking); setSelectedBooking(null); }}
                  className="p-2 bg-stone-100 text-on-surface-variant rounded-lg hover:bg-stone-200 transition-colors" title={t('invoice.title')}>
                  <FileText className="w-4 h-4" />
                </button>
                <button onClick={() => navigate(`/reservations/${selectedBooking.id}`)}
                  className="p-2 bg-stone-100 text-on-surface-variant rounded-lg hover:bg-stone-200 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button onClick={() => setSelectedBooking(null)}
                  className="p-2 text-on-surface-variant/40 hover:text-on-surface transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modals ── */}
      <AddReservationModal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); setAddModalRoom(null); setAddModalDate(null); }}
        initialRoomId={addModalRoom}
        initialArrival={addModalDate}
      />
      <ReassignRoomModal
        isOpen={!!reassignBooking}
        onClose={() => setReassignBooking(null)}
        bookingId={reassignBooking?.id ?? ''}
        currentRoomNumber={reassignBooking?.room ?? ''}
      />
      <InvoiceModal
        isOpen={!!invoiceBooking}
        onClose={() => setInvoiceBooking(null)}
        booking={invoiceBooking}
      />
      <ConfirmModal
        isOpen={!!cancelBookingId}
        onClose={() => setCancelBookingId(null)}
        onConfirm={() => {
          updateStatus.mutate({ id: cancelBookingId!, status: 'CANCELLED' });
          setCancelBookingId(null);
          setSelectedBooking(null);
        }}
        title={t('reservations.cancelTitle')}
        message={t('reservations.cancelMessage')}
        confirmLabel={t('reservations.confirmCancel')}
        isPending={updateStatus.isPending}
      />
    </div>
  );
};
