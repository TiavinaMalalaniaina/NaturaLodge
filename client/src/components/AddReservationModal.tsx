import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X, Calendar, User, Home, ChevronDown, Check, UserPlus,
  Search, AlertCircle, Plus, Minus, Trash2, SlidersHorizontal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useGuests } from '../hooks/useGuests';
import { useAvailableRooms } from '../hooks/useRooms';
import { useCreateBooking } from '../hooks/useBookings';
import { useNotifications } from '../context/NotificationContext';
import { AddGuestModal } from './AddGuestModal';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '../hooks/useDebounce';

interface AddReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRoomId?: string | null;
  initialArrival?: string | null;
}

interface RoomDates { arrival: string; departure: string }

function roomNights(sel: RoomDates) {
  return Math.max(0, Math.round(
    (new Date(sel.departure).getTime() - new Date(sel.arrival).getTime()) / 86_400_000,
  ));
}

function nextDay(date: string): string {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export const AddReservationModal: React.FC<AddReservationModalProps> = ({ isOpen, onClose, initialRoomId, initialArrival }) => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();
  const createBooking = useCreateBooking();

  // ─── State ────────────────────────────────────────────────────
  const [step, setStep]       = useState(1);
  const [guestId, setGuestId] = useState('');
  const [arrival, setArrival]     = useState('');
  const [departure, setDeparture] = useState('');
  const [apiError, setApiError]   = useState('');

  // Empêche l'effet [arrival, departure] d'effacer les chambres à l'ouverture initiale
  const skipRoomReset = useRef(false);

  const [roomSelections, setRoomSelections] = useState<Map<string, RoomDates>>(new Map());

  const [isGuestDropdownOpen, setIsGuestDropdownOpen] = useState(false);
  const [guestSearch, setGuestSearch]                 = useState('');
  const [isAddGuestModalOpen, setIsAddGuestModalOpen] = useState(false);
  const [pendingGuest, setPendingGuest]               = useState<{ id: string; name: string; city: string; status: string } | null>(null);
  const guestDropdownRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(guestSearch);
  const { data: guestsPage }                                    = useGuests(debouncedSearch ? { search: debouncedSearch } : undefined);
  const guests = guestsPage?.data ?? [];
  const { data: availableRooms = [], isLoading: roomsLoading }  = useAvailableRooms(arrival, departure);

  // ─── Room filters (step 2) ────────────────────────────────────
  const [roomSearch,   setRoomSearch]   = useState('');
  const [roomCategory, setRoomCategory] = useState('ALL');
  const [roomCapacity, setRoomCapacity] = useState(0);

  const filteredRooms = useMemo(() => availableRooms.filter(r => {
    const s = roomSearch.toLowerCase();
    if (s && !r.number.toLowerCase().includes(s) && !r.type.toLowerCase().includes(s)) return false;
    if (roomCategory !== 'ALL' && r.category !== roomCategory) return false;
    if (roomCapacity > 0 && r.capacity < roomCapacity) return false;
    return true;
  }), [availableRooms, roomSearch, roomCategory, roomCapacity]);

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

  useEffect(() => {
    if (isOpen) {
      const a = initialArrival ?? '';
      const d = a ? nextDay(a) : '';

      skipRoomReset.current = true;
      setStep(1);
      setGuestId('');
      setArrival(a);
      setDeparture(d);
      setApiError('');
      setGuestSearch('');
      setRoomSelections(
        initialRoomId
          ? new Map([[initialRoomId, { arrival: a, departure: d }]])
          : new Map(),
      );
      setRoomSearch(''); setRoomCategory('ALL'); setRoomCapacity(0);
      setPendingGuest(null);
    }
  }, [isOpen, initialRoomId, initialArrival]);

  useEffect(() => {
    if (skipRoomReset.current) { skipRoomReset.current = false; return; }
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

  const today      = new Date().toISOString().split('T')[0];
  const step1Valid = !!guestId && !!arrival && !!departure && globalNights > 0;
  const step2Valid = roomSelections.size > 0 &&
    [...roomSelections.values()].every(s => s.arrival && s.departure && roomNights(s) > 0);

  const toggleRoom = (id: string) => {
    setRoomSelections(prev => {
      const next = new Map(prev);
      next.has(id) ? next.delete(id) : next.set(id, { arrival, departure });
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
        amount:   `${totalAmount.toLocaleString()} Ar`,
      });

      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error;
      setApiError(typeof msg === 'string' ? msg : t('common.error'));
    }
  };

  // ─── Render ───────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-4xl h-[680px] bg-stone-50 rounded-[2.5rem] shadow-2xl border border-white overflow-hidden flex flex-col md:flex-row"
          >
            {/* ── Sidebar ── */}
            <div className="w-full md:w-72 bg-primary p-8 text-white flex flex-col shrink-0">
              <div className="mb-8">
                <h3 className="font-display italic text-3xl mb-1">{t('reservations.newStay')}</h3>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">{t('reservations.reservationEntry')}</p>
              </div>

              <div className="space-y-5 flex-1">
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
                                {sel.arrival} → {sel.departure} · {n}n · {(r.rate * n).toLocaleString()} Ar
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
              <div className="mt-auto pt-6 border-t border-white/10">
                <p className="text-[8px] font-bold uppercase tracking-widest opacity-40 mb-1">{t('reservations.estimatedTotal')}</p>
                <span className="text-2xl font-display italic">{totalAmount.toLocaleString()} Ar</span>
                {roomSelections.size > 1 && (
                  <p className="text-[9px] opacity-50 mt-0.5">
                    {t('reservations.roomsSelected', { count: roomSelections.size })}
                  </p>
                )}
              </div>
            </div>

            {/* ── Form ── */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex justify-between items-center px-10 pt-8 shrink-0">
                <div className="flex gap-2">
                  {[1, 2].map(s => (
                    <div key={s} className={cn('w-8 h-1 rounded-full transition-all', step >= s ? 'bg-primary' : 'bg-stone-100')} />
                  ))}
                </div>
                <button onClick={onClose} className="p-2 hover:bg-stone-50 rounded-full transition-colors">
                  <X className="w-5 h-5 text-on-surface-variant" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar px-10 py-6">
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
                                className="absolute left-0 right-0 mt-2 bg-white border border-stone-200 rounded-2xl shadow-xl z-[160] overflow-hidden flex flex-col max-h-[280px]"
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
                              onChange={e => { setArrival(e.target.value); if (departure && e.target.value >= departure) setDeparture(''); }}
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

                      {/* Category filter */}
                      <div className="flex gap-1.5 flex-wrap">
                        {['ALL','Superior','Deluxe','Suite','Penthouse','Villa','Luxury'].map(cat => (
                          <button key={cat} type="button" onClick={() => setRoomCategory(cat)}
                            className={cn('px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border transition-all',
                              roomCategory === cat
                                ? 'bg-primary text-white border-primary'
                                : 'bg-white text-on-surface-variant/60 border-stone-200 hover:border-stone-400')}>
                            {cat === 'ALL' ? t('common.all') : cat}
                          </button>
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

                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
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
                              onClick={() => { setRoomSearch(''); setRoomCategory('ALL'); setRoomCapacity(0); }}
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
                              <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => toggleRoom(room.id)}>
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
                                    {room.category} · {room.capacity} {t('common.guests_count')}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className={cn('text-sm font-display italic', selected ? 'text-primary' : 'text-on-surface-variant/50')}>
                                    {(room.rate * Math.max(n, 1)).toLocaleString()} Ar
                                  </p>
                                  <p className="text-[9px] text-on-surface-variant/30 font-mono">
                                    {room.rate.toLocaleString()} Ar/n · {n}n
                                  </p>
                                </div>
                              </div>

                              {/* Per-room date pickers */}
                              {selected && sel && (
                                <div className="px-4 pb-4 pt-0" onClick={e => e.stopPropagation()}>
                                  <div className="grid grid-cols-2 gap-3 p-3 bg-white/70 rounded-xl border border-primary/10">
                                    <div>
                                      <label className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 block mb-1.5">
                                        {t('reservations.arrivalDate')}
                                      </label>
                                      <input type="date"
                                        min={today}
                                        value={sel.arrival}
                                        onChange={e => {
                                          updateRoomDate(room.id, 'arrival', e.target.value);
                                          if (sel.departure && e.target.value >= sel.departure)
                                            updateRoomDate(room.id, 'departure', '');
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
                          <span className="text-sm font-display italic text-primary">{totalAmount.toLocaleString()} Ar</span>
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
          </motion.div>
        </div>
      )}
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
    </AnimatePresence>
  );
};
