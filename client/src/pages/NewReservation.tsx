import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Calendar, User, Home, ChevronDown, Check, UserPlus,
  Search, AlertCircle, Plus, Minus, Trash2, SlidersHorizontal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useGuests } from '../hooks/useGuests';
import { useAvailableRooms } from '../hooks/useRooms';
import { useRoomTypes } from '../hooks/useRoomTypes';
import { useCreateBooking } from '../hooks/useBookings';
import { useNotifications } from '../context/NotificationContext';
import { AddGuestModal } from '../components/AddGuestModal';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '../hooks/useDebounce';
import { getApiErrorMessage } from '../lib/apiError';
import { formatCurrency, resetDepartureIfInvalid, todayLocalStr, addDaysToLocalStr } from '../lib/format';
import { FilterChip } from '../components/FilterChip';

interface RoomDates { arrival: string; departure: string }

function roomNights(sel: RoomDates) {
  return Math.max(0, Math.round(
    (new Date(sel.departure).getTime() - new Date(sel.arrival).getTime()) / 86_400_000,
  ));
}


export const NewReservation: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRoomId   = searchParams.get('roomId');
  const initialArrival  = searchParams.get('arrival');
  const { addNotification } = useNotifications();
  const createBooking = useCreateBooking();

  // ─── State ────────────────────────────────────────────────────
  const [step, setStep]       = useState(1);
  const [guestId, setGuestId] = useState('');
  const [arrival, setArrival]     = useState(() => initialArrival ?? '');
  const [departure, setDeparture] = useState(() => initialArrival ? addDaysToLocalStr(initialArrival, 1) : '');
  const [apiError, setApiError]   = useState('');

  const [roomSelections, setRoomSelections] = useState<Map<string, RoomDates>>(() =>
    initialRoomId
      ? new Map([[initialRoomId, { arrival: initialArrival ?? '', departure: initialArrival ? addDaysToLocalStr(initialArrival, 1) : '' }]])
      : new Map(),
  );

  const [isGuestDropdownOpen, setIsGuestDropdownOpen] = useState(false);
  const [guestSearch, setGuestSearch]                 = useState('');
  const [isAddGuestModalOpen, setIsAddGuestModalOpen] = useState(false);
  const [pendingGuest, setPendingGuest]               = useState<{ id: string; name: string; city: string; status: string } | null>(null);
  const guestDropdownRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(guestSearch);
  const { data: guestsPage }                                    = useGuests(debouncedSearch ? { search: debouncedSearch } : undefined);
  const guests = guestsPage?.data ?? [];
  const { data: availableRooms = [], isLoading: roomsLoading }  = useAvailableRooms(arrival, departure);
  const { data: roomTypes = [] } = useRoomTypes();

  // ─── Room filters (step 2) ────────────────────────────────────
  const [roomSearch,   setRoomSearch]   = useState('');
  const [roomTypeFilter, setRoomTypeFilter] = useState('ALL');
  const [roomCapacity, setRoomCapacity] = useState(0);
  const [dateEditRoomIds, setDateEditRoomIds] = useState<Set<string>>(new Set());

  const filteredRooms = useMemo(() => availableRooms.filter(r => {
    const s = roomSearch.toLowerCase();
    if (s && !r.number.toLowerCase().includes(s) && !r.type.toLowerCase().includes(s)) return false;
    if (roomTypeFilter !== 'ALL' && r.type !== roomTypeFilter) return false;
    if (roomCapacity > 0 && r.capacity < roomCapacity) return false;
    return true;
  }), [availableRooms, roomSearch, roomTypeFilter, roomCapacity]);

  const selectedGuest = guests.find(g => g.id === guestId) ?? (pendingGuest?.id === guestId ? pendingGuest : null);
  const selectedRooms = useMemo(
    () => availableRooms.filter(r => roomSelections.has(r.id)),
    [availableRooms, roomSelections],
  );

  const globalNights = arrival && departure
    ? Math.max(0, Math.round((new Date(departure).getTime() - new Date(arrival).getTime()) / 86_400_000))
    : 0;

  const totalAmount = useMemo(() => selectedRooms.reduce((sum, r) => {
    const sel = roomSelections.get(r.id)!;
    return sum + r.rate * Math.max(roomNights(sel), 1);
  }, 0), [selectedRooms, roomSelections]);

  const overallArrival   = [...roomSelections.values()].map(s => s.arrival).sort()[0]       ?? arrival;
  const overallDeparture = [...roomSelections.values()].map(s => s.departure).sort().at(-1) ?? departure;

  // ─── Effects ──────────────────────────────────────────────────

  // Vide la sélection de chambres seulement quand la fenêtre change réellement
  // (comparaison de valeurs, pas un compteur d'appels — résiste au double-invoke de StrictMode)
  const lastWindow = useRef({ arrival, departure });
  useEffect(() => {
    if (lastWindow.current.arrival === arrival && lastWindow.current.departure === departure) return;
    lastWindow.current = { arrival, departure };
    setRoomSelections(new Map());
  }, [arrival, departure]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (guestDropdownRef.current && !guestDropdownRef.current.contains(e.target as Node))
        setIsGuestDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ─── Helpers ──────────────────────────────────────────────────

  const today      = todayLocalStr();
  const step1Valid = !!guestId && !!arrival && !!departure && globalNights > 0;
  const step2Valid = roomSelections.size > 0 &&
    [...roomSelections.values()].every(s => s.arrival && s.departure && roomNights(s) > 0);

  const toggleRoom = (id: string) => {
    setRoomSelections(prev => {
      const next = new Map(prev);
      next.has(id) ? next.delete(id) : next.set(id, { arrival, departure });
      return next;
    });
    setDateEditRoomIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleDateEdit = (id: string) => {
    setDateEditRoomIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const updateRoomDate = (id: string, field: 'arrival' | 'departure', value: string) => {
    setRoomSelections(prev => {
      const next    = new Map(prev);
      const current = next.get(id)!;
      next.set(id, { ...current, [field]: value });
      return next;
    });
  };

  // ─── Submit ───────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');
    try {
      await createBooking.mutateAsync({
        guestId,
        arrival:   `${overallArrival}T00:00:00.000Z`,
        departure: `${overallDeparture}T00:00:00.000Z`,
        rooms: [...roomSelections.entries()].map(([roomId, sel]) => {
          const room = availableRooms.find(r => r.id === roomId)!;
          return {
            roomId,
            roomRate: room.rate,
            arrival:  `${sel.arrival}T00:00:00.000Z`,
            departure: `${sel.departure}T00:00:00.000Z`,
          };
        }),
        totalAmount,
      });

      addNotification({
        source:   'direct',
        title:    'New Direct Stay',
        subtitle: `${selectedGuest?.name ?? 'Guest'} • ${selectedRooms.length} unit${selectedRooms.length > 1 ? 's' : ''}`,
        amount:   formatCurrency(totalAmount),
      });

      navigate('/reservations');
    } catch (err) {
      setApiError(getApiErrorMessage(err, t('common.error')));
    }
  };

  // ─── Render ───────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-20 max-w-5xl mx-auto"
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)}
          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full border border-stone-200 bg-white hover:bg-stone-50 transition-colors">
          <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
        </button>
        <div>
          <h2 className="font-display italic text-2xl md:text-3xl text-on-surface leading-none">{t('reservations.newStay')}</h2>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mt-2">{t('reservations.reservationEntry')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ── Summary sidebar ── */}
        <div className="lg:col-span-1 lg:order-2">
          <div className="bg-primary rounded-3xl p-8 text-white flex flex-col lg:sticky lg:top-6">
            <div className="space-y-5">
              {[
                { icon: User,     label: t('reservations.guestLabel'),  value: selectedGuest?.name ?? t('common.unassigned') },
                { icon: Calendar, label: t('reservations.windowLabel'), value: arrival ? `${arrival} → ${departure}` : t('common.notSet') },
              ].map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-2 opacity-40">
                    <item.icon className="w-3 h-3" />
                    <span className="text-[8px] font-bold uppercase tracking-widest">{item.label}</span>
                  </div>
                  <p className="text-xs font-medium">{item.value}</p>
                </div>
              ))}

              {roomSelections.size > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 opacity-40">
                    <Home className="w-3 h-3" />
                    <span className="text-[8px] font-bold uppercase tracking-widest">
                      {t('reservations.unitsLabel', { count: roomSelections.size })}
                    </span>
                  </div>
                  <div className="space-y-2 mt-1">
                    {selectedRooms.map(r => {
                      const sel = roomSelections.get(r.id)!;
                      const n   = roomNights(sel);
                      return (
                        <div key={r.id} className="bg-white/10 rounded-xl px-3 py-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">#{r.number} — {r.type}</span>
                            <button type="button" onClick={() => toggleRoom(r.id)}
                              className="opacity-50 hover:opacity-100 transition-opacity">
                              <Minus className="w-3 h-3" />
                            </button>
                          </div>
                          {sel.arrival && sel.departure && n > 0 && (
                            <p className="text-[9px] opacity-50 mt-0.5">
                              {sel.arrival} → {sel.departure} · {n}n · {formatCurrency(r.rate * n)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Total */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-[8px] font-bold uppercase tracking-widest opacity-40 mb-1">{t('reservations.estimatedTotal')}</p>
              <span className="text-2xl font-display italic">{formatCurrency(totalAmount)}</span>
              {roomSelections.size > 1 && (
                <p className="text-[9px] opacity-50 mt-0.5">
                  {t('reservations.roomsSelected', { count: roomSelections.size })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Form ── */}
        <div className="lg:col-span-2 lg:order-1 bg-white rounded-3xl border border-stone-200/60 organic-shadow p-8 md:p-10">
          <div className="flex justify-between items-center mb-6">
            <div className="flex gap-2">
              {[1, 2].map(s => (
                <div key={s} className={cn('w-8 h-1 rounded-full transition-all', step >= s ? 'bg-primary' : 'bg-stone-100')} />
              ))}
            </div>
          </div>

          {apiError && (
            <div className="flex items-center gap-3 p-3 mb-5 bg-red-50 border border-red-100 rounded-xl text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p className="text-xs font-medium">{apiError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* ── Step 1 ── */}
            {step === 1 ? (
              <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">

                {/* Guest */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">{t('reservations.selectGuest')}</label>
                    <button type="button" onClick={() => setIsAddGuestModalOpen(true)}
                      className="text-[10px] font-bold text-primary hover:underline tracking-widest uppercase flex items-center gap-1.5">
                      <UserPlus className="w-3 h-3" /> {t('reservations.newGuestBtn')}
                    </button>
                  </div>

                  <div className="relative" ref={guestDropdownRef}>
                    <button type="button"
                      onClick={() => { setIsGuestDropdownOpen(v => !v); if (!isGuestDropdownOpen) setGuestSearch(''); }}
                      className={cn(
                        'w-full h-14 pl-5 pr-12 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between text-left hover:border-stone-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all select-none',
                        isGuestDropdownOpen && 'border-primary ring-2 ring-primary/20 bg-white',
                      )}>
                      {selectedGuest ? (
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-teal-50 text-xs font-bold text-primary flex items-center justify-center shrink-0">
                            {selectedGuest.name.charAt(0)}
                          </div>
                          <div className="truncate">
                            <p className="font-semibold text-on-surface leading-tight text-xs">{selectedGuest.name}</p>
                            <p className="text-[9px] text-on-surface-variant/60 leading-none mt-0.5 truncate">
                              {selectedGuest.city || '—'} • {selectedGuest.status}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-on-surface-variant/40">{t('reservations.searchGuest')}</span>
                      )}
                      <ChevronDown className={cn('w-4 h-4 text-on-surface-variant/40 transition-transform shrink-0', isGuestDropdownOpen && 'rotate-180')} />
                    </button>

                    <AnimatePresence>
                      {isGuestDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.98 }}
                          transition={{ duration: 0.15 }}
                          className="absolute left-0 right-0 mt-2 bg-white border border-stone-200 rounded-2xl shadow-xl z-[60] overflow-hidden flex flex-col max-h-[280px]"
                        >
                          <div className="p-3 border-b border-stone-100 relative flex items-center">
                            <Search className="absolute left-6 w-4 h-4 text-on-surface-variant/40" />
                            <input type="text" autoFocus
                              placeholder={t('reservations.searchGuest')}
                              value={guestSearch}
                              onChange={e => setGuestSearch(e.target.value)}
                              onClick={e => e.stopPropagation()}
                              className="w-full h-10 pl-10 pr-10 bg-stone-50 border border-stone-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/50 transition-all font-sans"
                            />
                            {guestSearch && (
                              <button type="button" onClick={e => { e.stopPropagation(); setGuestSearch(''); }}
                                className="absolute right-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/40 hover:text-on-surface">
                                {t('common.clear')}
                              </button>
                            )}
                          </div>
                          <div className="overflow-y-auto max-h-[200px] divide-y divide-stone-50 no-scrollbar">
                            {guests.length === 0 ? (
                              <div className="p-8 text-center text-xs text-on-surface-variant/50 bg-stone-50/30">
                                {debouncedSearch ? t('guests.noGuests') : t('common.loading')}
                              </div>
                            ) : guests.map(guest => (
                              <button key={guest.id} type="button"
                                onClick={() => { setGuestId(guest.id); setIsGuestDropdownOpen(false); }}
                                className={cn(
                                  'w-full p-3 hover:bg-stone-50 cursor-pointer flex items-center justify-between transition-colors text-left',
                                  guestId === guest.id && 'bg-teal-50/50 hover:bg-teal-50',
                                )}>
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-8 h-8 rounded-lg bg-teal-50/75 text-xs font-bold text-primary flex items-center justify-center shrink-0">
                                    {guest.name.charAt(0)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-on-surface leading-tight truncate">{guest.name}</p>
                                    <p className="text-[10px] text-on-surface-variant/60 leading-none mt-1 truncate">
                                      {guest.city || '—'} • {guest.status}
                                    </p>
                                  </div>
                                </div>
                                {guestId === guest.id && <Check className="w-4 h-4 text-primary shrink-0 ml-2" />}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Global dates */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">
                    {t('reservations.defaultWindow')}
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 block mb-2">{t('reservations.arrivalDate')}</label>
                      <input type="date" min={today} value={arrival}
                        onChange={e => { setArrival(e.target.value); setDeparture(d => resetDepartureIfInvalid(e.target.value, d)); }}
                        className="w-full h-12 px-4 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all"
                        required />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 block mb-2">{t('reservations.departureDate')}</label>
                      <input type="date" min={arrival || today} value={departure}
                        onChange={e => setDeparture(e.target.value)}
                        className="w-full h-12 px-4 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all"
                        required />
                    </div>
                  </div>
                  {arrival && departure && globalNights <= 0 && (
                    <p className="text-[10px] text-red-500 font-bold mt-2">{t('reservations.departureAfterArrival')}</p>
                  )}
                  {globalNights > 0 && (
                    <p className="text-[10px] text-on-surface-variant/40 mt-2 font-mono">
                      {globalNights} {globalNights > 1 ? t('common.nights') : t('common.night')} — {t('reservations.roomsInheritDates')}
                    </p>
                  )}
                </div>

                <button type="button" onClick={() => setStep(2)} disabled={!step1Valid}
                  className="w-full py-4 bg-primary text-white rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-primary-container disabled:opacity-40 transition-all shadow-lg shadow-primary/10">
                  {t('reservations.chooseRooms')}
                </button>
              </motion.div>

            ) : (
              /* ── Step 2 : rooms + per-room dates ── */
              <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">

                {/* Header */}
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 flex items-center gap-2">
                    <SlidersHorizontal className="w-3.5 h-3.5" /> {t('rooms.availableRooms')}
                    {!roomsLoading && (
                      <span className="text-primary">
                        ({filteredRooms.length}{filteredRooms.length !== availableRooms.length && `/${availableRooms.length}`})
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-3">
                    {roomSelections.size > 0 && (
                      <button type="button" onClick={() => setRoomSelections(new Map())}
                        className="flex items-center gap-1 text-[9px] font-bold text-red-400 hover:text-red-600 uppercase tracking-widest transition-colors">
                        <Trash2 className="w-3 h-3" /> {t('common.clear')}
                      </button>
                    )}
                    <span className="text-[9px] font-mono text-on-surface-variant/40">{arrival} → {departure}</span>
                  </div>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant/30" />
                  <input type="text" value={roomSearch}
                    onChange={e => setRoomSearch(e.target.value)}
                    placeholder={t('reservations.searchRoomModal')}
                    className="w-full h-9 pl-9 pr-4 bg-stone-50 border border-stone-200 rounded-xl text-xs outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all font-sans"
                  />
                </div>

                {/* Room type filter */}
                <div className="flex gap-1.5 flex-wrap">
                  {['ALL', ...roomTypes.map(rt => rt.name)].map(rt => (
                    <FilterChip key={rt} active={roomTypeFilter === rt} onClick={() => setRoomTypeFilter(rt)}>
                      {rt === 'ALL' ? t('common.all') : rt}
                    </FilterChip>
                  ))}
                </div>

                {/* Capacity filter */}
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 shrink-0">{t('reservations.minGuests')}</span>
                  <div className="flex gap-1.5">
                    {[0,1,2,3,4].map(n => (
                      <button key={n} type="button" onClick={() => setRoomCapacity(n)}
                        className={cn('w-8 h-7 rounded-lg text-[9px] font-bold border transition-all',
                          roomCapacity === n
                            ? 'bg-zinc-900 text-white border-zinc-900'
                            : 'bg-white text-on-surface-variant/60 border-stone-200 hover:border-stone-400')}>
                        {n === 0 ? t('common.all') : `${n}+`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 no-scrollbar">
                  {roomsLoading ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-3 text-on-surface-variant/40">
                      <div className="w-6 h-6 bg-primary rotate-45 rounded-md animate-pulse" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">{t('reservations.checkingAvailability')}</p>
                    </div>
                  ) : availableRooms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 text-on-surface-variant/40">
                      <p className="text-sm font-display italic">{t('reservations.noRoomsAvailable')}</p>
                      <button type="button" onClick={() => setStep(1)}
                        className="mt-2 text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">
                        ← {t('reservations.changeDates')}
                      </button>
                    </div>
                  ) : filteredRooms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 text-on-surface-variant/40">
                      <p className="text-sm font-display italic">{t('reservations.noMatch')}</p>
                      <button type="button"
                        onClick={() => { setRoomSearch(''); setRoomTypeFilter('ALL'); setRoomCapacity(0); }}
                        className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">
                        {t('reservations.clearFilters')}
                      </button>
                    </div>
                  ) : filteredRooms.map(room => {
                    const sel      = roomSelections.get(room.id);
                    const selected = !!sel;
                    const n        = sel ? roomNights(sel) : globalNights;
                    const dateErr  = sel && sel.arrival && sel.departure && n <= 0;

                    return (
                      <div key={room.id}
                        className={cn(
                          'rounded-xl border transition-all',
                          selected ? 'bg-teal-50 border-primary shadow-sm' : 'bg-stone-50 border-stone-100',
                        )}>
                        {/* Room row */}
                        <div className="flex items-center gap-3 p-4 cursor-pointer"
                          role="checkbox"
                          aria-checked={selected}
                          tabIndex={0}
                          onClick={() => toggleRoom(room.id)}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleRoom(room.id); } }}
                        >
                          <div className={cn(
                            'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all',
                            selected ? 'bg-primary border-primary' : 'border-stone-300 hover:border-stone-400',
                          )}>
                            {selected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div className="w-10 h-10 rounded-lg bg-white border border-stone-200 flex items-center justify-center font-display italic text-xl text-primary shrink-0">
                            {room.number}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-on-surface">{room.type}</p>
                            <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest mt-0.5">
                              {room.capacity} {t('common.guests_count')}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={cn('text-sm font-display italic', selected ? 'text-primary' : 'text-on-surface-variant/50')}>
                              {formatCurrency(room.rate * Math.max(n, 1))}
                            </p>
                            <p className="text-[9px] text-on-surface-variant/30 font-mono">
                              {formatCurrency(room.rate)}/n · {n}n
                            </p>
                          </div>
                        </div>

                        {/* Per-room date override — collapsed by default, opens on click */}
                        {selected && sel && (
                          <div className="px-4 pb-4 pt-0" onClick={e => e.stopPropagation()}>
                            <button type="button" onClick={() => toggleDateEdit(room.id)}
                              className="flex items-center gap-1.5 text-[9px] font-bold text-primary hover:underline uppercase tracking-widest">
                              <Calendar className="w-3 h-3" /> {t('reservations.changeDates')}
                            </button>

                            {dateEditRoomIds.has(room.id) && (
                              <>
                                <div className="grid grid-cols-2 gap-3 p-3 mt-2 bg-white/70 rounded-xl border border-primary/10">
                                  <div>
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 block mb-1.5">
                                      {t('reservations.arrivalDate')}
                                    </label>
                                    <input type="date"
                                      min={today}
                                      value={sel.arrival}
                                      onChange={e => {
                                        updateRoomDate(room.id, 'arrival', e.target.value);
                                        updateRoomDate(room.id, 'departure', resetDepartureIfInvalid(e.target.value, sel.departure));
                                      }}
                                      className="w-full h-10 px-3 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 block mb-1.5">
                                      {t('reservations.departureDate')}
                                    </label>
                                    <input type="date"
                                      min={sel.arrival || today}
                                      value={sel.departure}
                                      onChange={e => updateRoomDate(room.id, 'departure', e.target.value)}
                                      className="w-full h-10 px-3 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all"
                                    />
                                  </div>
                                </div>
                                {dateErr && (
                                  <p className="text-[10px] text-red-500 font-bold mt-1.5">
                                    {t('reservations.departureAfterArrival')}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Multi-room summary bar */}
                {roomSelections.size > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border border-primary/10 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Plus className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                        {t('reservations.roomsSelected', { count: roomSelections.size })}
                      </span>
                    </div>
                    <span className="text-sm font-display italic text-primary">{formatCurrency(totalAmount)}</span>
                  </div>
                )}

                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={() => { setStep(1); setApiError(''); }}
                    className="px-8 py-4 bg-stone-100 text-on-surface-variant rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-stone-200 transition-all">
                    {t('common.back')}
                  </button>
                  <button type="submit" disabled={!step2Valid || createBooking.isPending}
                    className="flex-1 py-4 bg-primary text-white rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-primary-container disabled:opacity-40 transition-all shadow-lg shadow-primary/10">
                    {createBooking.isPending
                      ? t('common.creating')
                      : roomSelections.size > 1
                        ? t('reservations.confirmRooms', { count: roomSelections.size })
                        : t('reservations.confirmReservation')}
                  </button>
                </div>
              </motion.div>
            )}
          </form>
        </div>
      </div>

      <AddGuestModal
        isOpen={isAddGuestModalOpen}
        onClose={() => setIsAddGuestModalOpen(false)}
        onCreated={g => {
          setGuestId(g.id);
          setPendingGuest(g);
          setGuestSearch('');
          setIsAddGuestModalOpen(false);
        }}
      />
    </motion.div>
  );
};
