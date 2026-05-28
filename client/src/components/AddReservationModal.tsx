import React, { useState, useRef, useEffect } from 'react';
import { X, Calendar, User, Home, ChevronDown, Check, UserPlus, Search, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useGuests } from '../hooks/useGuests';
import { useAvailableRooms } from '../hooks/useRooms';
import { useCreateBooking } from '../hooks/useBookings';
import { useNotifications } from '../context/NotificationContext';
import { AddGuestModal } from './AddGuestModal';

interface AddReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRoomId?: string | null;
}

function useDebounce(value: string, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export const AddReservationModal: React.FC<AddReservationModalProps> = ({ isOpen, onClose, initialRoomId }) => {
  const { addNotification } = useNotifications();
  const createBooking = useCreateBooking();

  const [step, setStep] = useState(1);
  const [guestId, setGuestId] = useState('');
  const [roomId, setRoomId] = useState(initialRoomId ?? '');
  const [arrival, setArrival] = useState('');
  const [departure, setDeparture] = useState('');
  const [apiError, setApiError] = useState('');

  const [isGuestDropdownOpen, setIsGuestDropdownOpen] = useState(false);
  const [guestSearch, setGuestSearch] = useState('');
  const [isAddGuestModalOpen, setIsAddGuestModalOpen] = useState(false);
  const guestDropdownRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(guestSearch);
  const { data: guests = [] } = useGuests(debouncedSearch || undefined);

  // Chambres disponibles pour la période saisie — uniquement appelé quand les dates sont valides
  const { data: availableRooms = [], isLoading: roomsLoading } = useAvailableRooms(arrival, departure);

  const selectedGuest = guests.find(g => g.id === guestId) ?? null;
  const selectedRoom  = availableRooms.find(r => r.id === roomId) ?? null;

  // Calcul des nuits et du montant
  const nights = arrival && departure
    ? Math.max(0, Math.round((new Date(departure).getTime() - new Date(arrival).getTime()) / 86_400_000))
    : 0;
  const totalAmount = selectedRoom ? selectedRoom.rate * Math.max(nights, 1) : 0;

  // Reset à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setGuestId('');
      setRoomId(initialRoomId ?? '');
      setArrival('');
      setDeparture('');
      setApiError('');
      setGuestSearch('');
    }
  }, [isOpen, initialRoomId]);

  // Désélectionner la chambre si les dates changent (elle n'est peut-être plus dispo)
  useEffect(() => {
    setRoomId('');
  }, [arrival, departure]);

  // Fermer le dropdown au clic extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (guestDropdownRef.current && !guestDropdownRef.current.contains(e.target as Node)) {
        setIsGuestDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const step1Valid = !!guestId && !!arrival && !!departure && nights > 0;
  const step2Valid = !!roomId;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setApiError('');

    try {
      await createBooking.mutateAsync({
        guestId,
        roomId,
        arrival:     `${arrival}T00:00:00.000Z`,
        departure:   `${departure}T00:00:00.000Z`,
        totalAmount,
      });

      addNotification({
        source: 'direct',
        title:    'New Direct Stay',
        subtitle: `${selectedGuest?.name ?? 'Guest'} • ${nights} night${nights > 1 ? 's' : ''} • Unit ${selectedRoom?.number ?? '—'}`,
        amount:   `${totalAmount.toLocaleString()} Ar`,
      });

      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error;
      setApiError(typeof msg === 'string' ? msg : 'Erreur lors de la création. Veuillez réessayer.');
    }
  };

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
            className="relative w-full max-w-2xl bg-stone-50 rounded-[2.5rem] shadow-2xl border border-white overflow-hidden flex flex-col md:flex-row"
          >
            {/* ── Sidebar ── */}
            <div className="w-full md:w-64 bg-primary p-8 text-white flex flex-col">
              <div className="mb-10">
                <h3 className="font-display italic text-3xl mb-2">New Stay</h3>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Reservation Entry</p>
              </div>

              <div className="space-y-6 flex-1">
                {[
                  { icon: User,     label: 'Guest', value: selectedGuest?.name ?? 'Unassigned' },
                  { icon: Calendar, label: 'Dates', value: arrival ? `${arrival} → ${departure}` : 'Not set' },
                  { icon: Home,     label: 'Unit',  value: selectedRoom ? `Suite ${selectedRoom.number}` : 'Not selected' },
                ].map((item, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center gap-2 opacity-40">
                      <item.icon className="w-3 h-3" />
                      <span className="text-[8px] font-bold uppercase tracking-widest">{item.label}</span>
                    </div>
                    <p className="text-xs font-medium">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-auto pt-10">
                <p className="text-[8px] font-bold uppercase tracking-widest opacity-40 mb-1">
                  Estimated Total {nights > 0 ? `(${nights} night${nights > 1 ? 's' : ''})` : ''}
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-display italic">{totalAmount.toLocaleString()} Ar</span>
                </div>
              </div>
            </div>

            {/* ── Form ── */}
            <div className="flex-1 p-8 md:p-10 bg-white">
              <div className="flex justify-between items-center mb-8">
                <div className="flex gap-2">
                  {[1, 2].map(s => (
                    <div key={s} className={cn("w-8 h-1 rounded-full transition-all", step >= s ? "bg-primary" : "bg-stone-100")} />
                  ))}
                </div>
                <button onClick={onClose} className="p-2 hover:bg-stone-50 rounded-full transition-colors">
                  <X className="w-5 h-5 text-on-surface-variant" />
                </button>
              </div>

              {apiError && (
                <div className="flex items-center gap-3 p-3 mb-6 bg-red-50 border border-red-100 rounded-xl text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p className="text-xs font-medium">{apiError}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-8">
                {/* ── Step 1 : Guest + Dates ── */}
                {step === 1 ? (
                  <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    {/* Guest selector */}
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">Select Guest Profile</label>
                        <button type="button" onClick={() => setIsAddGuestModalOpen(true)}
                          className="text-[10px] font-bold text-primary hover:underline tracking-widest uppercase flex items-center gap-1.5">
                          <UserPlus className="w-3 h-3" /> New Guest
                        </button>
                      </div>

                      <div className="relative" ref={guestDropdownRef}>
                        <button
                          type="button"
                          onClick={() => { setIsGuestDropdownOpen(v => !v); if (!isGuestDropdownOpen) setGuestSearch(''); }}
                          className={cn(
                            "w-full h-14 pl-5 pr-12 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between text-left hover:border-stone-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all select-none",
                            isGuestDropdownOpen && "border-primary ring-2 ring-primary/20 bg-white"
                          )}
                        >
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
                            <span className="text-on-surface-variant/40">Search or select guest...</span>
                          )}
                          <ChevronDown className={cn("w-4 h-4 text-on-surface-variant/40 transition-transform shrink-0", isGuestDropdownOpen && "rotate-180")} />
                        </button>

                        <AnimatePresence>
                          {isGuestDropdownOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: -4, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -4, scale: 0.98 }}
                              transition={{ duration: 0.15 }}
                              className="absolute left-0 right-0 mt-2 bg-white border border-stone-200 rounded-2xl shadow-xl z-[160] overflow-hidden flex flex-col max-h-[300px]"
                            >
                              <div className="p-3 border-b border-stone-100 relative flex items-center">
                                <Search className="absolute left-6 w-4 h-4 text-on-surface-variant/40" />
                                <input
                                  type="text" autoFocus
                                  placeholder="Search by name, email, city..."
                                  value={guestSearch}
                                  onChange={e => setGuestSearch(e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                  className="w-full h-10 pl-10 pr-10 bg-stone-50 border border-stone-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/50 transition-all font-sans"
                                />
                                {guestSearch && (
                                  <button type="button" onClick={e => { e.stopPropagation(); setGuestSearch(''); }}
                                    className="absolute right-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/40 hover:text-on-surface">
                                    Clear
                                  </button>
                                )}
                              </div>

                              <div className="overflow-y-auto max-h-[220px] divide-y divide-stone-50 no-scrollbar">
                                {guests.length === 0 ? (
                                  <div className="p-8 text-center text-xs text-on-surface-variant/50 bg-stone-50/30">
                                    {debouncedSearch ? 'Aucun client trouvé.' : 'Chargement...'}
                                  </div>
                                ) : guests.map(guest => (
                                  <button
                                    key={guest.id} type="button"
                                    onClick={() => { setGuestId(guest.id); setIsGuestDropdownOpen(false); }}
                                    className={cn(
                                      "w-full p-3 hover:bg-stone-50 cursor-pointer flex items-center justify-between transition-colors text-left",
                                      guestId === guest.id && "bg-teal-50/50 hover:bg-teal-50"
                                    )}
                                  >
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

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">Arrival Date</label>
                        <input type="date" min={today} value={arrival}
                          onChange={e => { setArrival(e.target.value); if (departure && e.target.value >= departure) setDeparture(''); }}
                          className="w-full h-14 px-5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">Departure Date</label>
                        <input type="date" min={arrival || today} value={departure}
                          onChange={e => setDeparture(e.target.value)}
                          className="w-full h-14 px-5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all"
                          required
                        />
                      </div>
                    </div>
                    {arrival && departure && nights <= 0 && (
                      <p className="text-[10px] text-red-500 font-bold -mt-4">La date de départ doit être après l'arrivée.</p>
                    )}

                    <div className="pt-4">
                      <button type="button" onClick={() => setStep(2)} disabled={!step1Valid}
                        className="w-full py-4 bg-primary text-white rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-primary-container disabled:opacity-40 transition-all shadow-lg shadow-primary/10">
                        Choose Room & Unit
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  /* ── Step 2 : Room ── */
                  <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">
                          Available Units
                          {!roomsLoading && (
                            <span className="ml-2 text-primary">({availableRooms.length})</span>
                          )}
                        </label>
                        <span className="text-[9px] font-mono text-on-surface-variant/40">
                          {arrival} → {departure} · {nights} night{nights > 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="space-y-3 max-h-[240px] overflow-y-auto pr-2 no-scrollbar">
                        {roomsLoading ? (
                          <div className="flex flex-col items-center justify-center py-10 gap-3 text-on-surface-variant/40">
                            <div className="w-6 h-6 bg-primary rotate-45 rounded-md animate-pulse" />
                            <p className="text-[10px] font-bold uppercase tracking-widest">Checking availability...</p>
                          </div>
                        ) : availableRooms.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 gap-2 text-on-surface-variant/40">
                            <p className="text-sm font-display italic">No rooms available</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest">for this period</p>
                            <button type="button" onClick={() => setStep(1)}
                              className="mt-3 text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">
                              ← Change dates
                            </button>
                          </div>
                        ) : availableRooms.map(room => (
                          <div key={room.id} onClick={() => setRoomId(room.id)}
                            className={cn(
                              "p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between",
                              roomId === room.id ? "bg-teal-50 border-primary" : "bg-stone-50 border-stone-100 hover:border-stone-300"
                            )}
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-lg bg-white border border-stone-100 flex items-center justify-center text-primary font-display italic text-xl">
                                {room.number}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-on-surface uppercase tracking-tight">{room.type}</p>
                                <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest">
                                  {room.category} · {room.rate.toLocaleString()} Ar / nuit
                                  {nights > 0 && (
                                    <span className="ml-2 text-primary font-bold">
                                      = {(room.rate * nights).toLocaleString()} Ar
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            {roomId === room.id && <Check className="w-4 h-4 text-primary" />}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button type="button" onClick={() => { setStep(1); setApiError(''); }}
                        className="px-8 py-4 bg-stone-100 text-on-surface-variant rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-stone-200 transition-all">
                        Back
                      </button>
                      <button type="submit" disabled={!step2Valid || createBooking.isPending}
                        className="flex-1 py-4 bg-primary text-white rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-primary-container disabled:opacity-40 transition-all shadow-lg shadow-primary/10">
                        {createBooking.isPending ? 'Création...' : 'Finalize Reservation'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </form>
            </div>
          </motion.div>
        </div>
      )}
      <AddGuestModal isOpen={isAddGuestModalOpen} onClose={() => setIsAddGuestModalOpen(false)} />
    </AnimatePresence>
  );
};
