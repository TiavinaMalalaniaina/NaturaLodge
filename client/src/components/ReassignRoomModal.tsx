import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Check, Search, AlertTriangle, Loader2, TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { useRoom, useAvailableRooms } from '../hooks/useRooms';
import { useReassignRoom } from '../hooks/useBookings';
import { Room } from '../types';

interface ReassignRoomModalProps {
  isOpen:            boolean;
  onClose:           () => void;
  bookingId:         string;
  currentRoomId:     string;
  currentRoomNumber: string;
  arrival:           string;
  departure:         string;
}

function fmtAmount(n: number) { return n.toLocaleString('fr-MG') + ' Ar'; }
function nightsBetween(a: string, b: string) {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}
// Date locale (pas toISOString — décale d'un jour dans un fuseau en avance sur UTC)
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Comparison row ────────────────────────────────────────────────────────────

type Delta = 'up' | 'down' | 'same' | 'diff';

function DeltaBadge({ delta, label }: { delta: Delta; label: string }) {
  if (delta === 'same') return null;
  if (delta === 'diff') return (
    <span className="ml-1.5 text-[9px] font-bold text-amber-600 uppercase tracking-widest">≠</span>
  );
  const isUp = delta === 'up';
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 ml-1.5 text-[9px] font-bold',
      isUp ? 'text-rose-500' : 'text-teal-600',
    )}>
      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {label}
    </span>
  );
}

interface CompareRowProps {
  label:    string;
  oldVal:   string;
  newVal:   string;
  delta?:   Delta;
  deltaLbl?: string;
  highlight?: boolean;
}

function CompareRow({ label, oldVal, newVal, delta = 'same', deltaLbl = '', highlight }: CompareRowProps) {
  const changed = oldVal !== newVal;
  return (
    <div className={cn(
      'grid grid-cols-[120px_1fr_1fr] gap-x-4 py-2.5 border-b border-stone-100 last:border-0 items-start',
      highlight && changed && 'bg-amber-50/50 -mx-4 px-4 rounded-lg',
    )}>
      <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 pt-0.5">{label}</span>
      <span className="text-xs text-on-surface-variant/60 line-through decoration-stone-300">{oldVal}</span>
      <span className={cn('text-xs font-semibold', changed ? 'text-on-surface' : 'text-on-surface-variant/50')}>
        {newVal}
        <DeltaBadge delta={delta} label={deltaLbl} />
      </span>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export const ReassignRoomModal: React.FC<ReassignRoomModalProps> = ({
  isOpen, onClose,
  bookingId, currentRoomId, currentRoomNumber,
  arrival, departure,
}) => {
  const { t } = useTranslation();
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [search,       setSearch]       = useState('');
  const [serverError,  setServerError]  = useState<string | null>(null);
  const [showList,     setShowList]     = useState(true);
  const [newArrival,   setNewArrival]   = useState(arrival);
  const [newDeparture, setNewDeparture] = useState(departure);

  // Reset au réouverture (nouvelle réservation ciblée, ou même réservation rouverte)
  useEffect(() => {
    if (isOpen) {
      setSelectedRoom(null);
      setSearch('');
      setServerError(null);
      setShowList(true);
      setNewArrival(arrival);
      setNewDeparture(departure);
    }
  }, [isOpen, arrival, departure]);

  const { data: currentRoom }           = useRoom(currentRoomId);
  const { data: rooms = [], isLoading } = useAvailableRooms(newArrival, newDeparture, bookingId);
  const reassign                        = useReassignRoom();

  // La chambre actuelle reste sélectionnable : ça permet de ne changer que les
  // dates en gardant la même chambre (elle apparaît car `bookingId` est exclu
  // des conflits par le backend).
  const candidates = rooms.filter(
    r => search === '' ||
         r.number.toLowerCase().includes(search.toLowerCase()) ||
         r.type.toLowerCase().includes(search.toLowerCase()),
  );

  const datesChanged = newArrival !== arrival || newDeparture !== departure;
  const hasChanges = !!selectedRoom && (selectedRoom.id !== currentRoomId || datesChanged);

  const handleSelect = (room: Room) => {
    const next = selectedRoom?.id === room.id ? null : room;
    setSelectedRoom(next);
    if (next) setShowList(false);
  };

  const handleConfirm = () => {
    if (!selectedRoom || !hasChanges) return;
    setServerError(null);
    reassign.mutate(
      {
        bookingId, oldRoomId: currentRoomId, newRoomId: selectedRoom.id,
        arrival: datesChanged ? newArrival : undefined,
        departure: datesChanged ? newDeparture : undefined,
      },
      {
        onSuccess: () => { setSelectedRoom(null); setSearch(''); onClose(); },
        onError:   (err: any) => {
          setServerError(err?.response?.data?.error ?? t('common.error'));
        },
      },
    );
  };

  const handleClose = () => {
    if (reassign.isPending) return;
    setSelectedRoom(null);
    setSearch('');
    setServerError(null);
    setShowList(true);
    onClose();
  };

  // Delta helpers
  const oldRate = currentRoom?.rateOverride ?? currentRoom?.rate ?? 0;
  const newRate = selectedRoom ? (selectedRoom.rateOverride ?? selectedRoom.rate) : 0;
  const rateDiff = newRate - oldRate;
  const oldNights = nightsBetween(arrival, departure);
  const newNights = nightsBetween(newArrival, newDeparture);
  const oldTotal = oldRate * oldNights;
  const newTotal = newRate * newNights;

  function numDelta(oldN: number, newN: number): Delta {
    if (newN === oldN) return 'same';
    return newN > oldN ? 'up' : 'down';
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]"
          >

            {/* ── Header ── */}
            <div className="p-8 pb-6 border-b border-stone-100 bg-stone-50/50 shrink-0">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-display italic text-3xl text-on-surface">{t('reservations.reassign')}</h3>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mt-1">
                    {t('reservations.reassignHint')}
                  </p>
                </div>
                <button onClick={handleClose} disabled={reassign.isPending}
                  className="p-2 hover:bg-white rounded-full transition-colors border border-stone-200 disabled:opacity-40">
                  <X className="w-5 h-5 text-on-surface-variant" />
                </button>
              </div>

              {/* Date fields — changing these re-checks availability for the new window */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 block mb-1.5">
                    {t('reservations.arrivalDate')}
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant/30" />
                    <input type="date" min={todayStr()} value={newArrival}
                      onChange={e => {
                        setNewArrival(e.target.value);
                        if (newDeparture && e.target.value >= newDeparture) setNewDeparture('');
                      }}
                      className="w-full h-11 pl-9 pr-3 bg-white border border-stone-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 block mb-1.5">
                    {t('reservations.departureDate')}
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant/30" />
                    <input type="date" min={newArrival || todayStr()} value={newDeparture}
                      onChange={e => setNewDeparture(e.target.value)}
                      className="w-full h-11 pl-9 pr-3 bg-white border border-stone-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                  </div>
                </div>
              </div>

              {/* Current → Target pill */}
              <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <div className="flex flex-col items-center shrink-0">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1">Current</span>
                  <div className="px-5 py-2 bg-white rounded-xl border border-amber-200 font-display italic text-xl text-amber-900">
                    {currentRoomNumber}
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-amber-300 shrink-0" />
                <div className="flex flex-col items-center flex-1 min-w-0">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1">New unit</span>
                  <button
                    onClick={() => selectedRoom && setShowList(v => !v)}
                    className={cn(
                      'w-full px-4 py-2 rounded-xl border font-display italic text-xl h-[44px] flex items-center justify-center transition-all truncate',
                      selectedRoom
                        ? 'bg-teal-600 border-teal-700 text-white shadow-lg shadow-teal-600/20 cursor-pointer hover:bg-teal-700'
                        : 'bg-stone-100 border-stone-200 border-dashed text-stone-300 cursor-default',
                    )}
                  >
                    {selectedRoom
                      ? `${selectedRoom.number} — ${selectedRoom.type}`
                      : 'Select a unit'}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Comparison panel (slides in when a room is selected) ── */}
            <AnimatePresence initial={false}>
              {selectedRoom && currentRoom && !showList && (
                <motion.div
                  key="comparison"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="overflow-hidden shrink-0"
                >
                  <div className="px-8 py-5 border-b border-stone-100 bg-white">

                    {/* Section title + back button */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40">
                        Unit Comparison
                      </span>
                      <button
                        onClick={() => setShowList(true)}
                        className="text-[9px] font-bold uppercase tracking-widest text-primary hover:underline"
                      >
                        ← Change selection
                      </button>
                    </div>

                    {/* Column headers */}
                    <div className="grid grid-cols-[120px_1fr_1fr] gap-x-4 mb-1">
                      <div />
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center font-display italic text-sm text-amber-700 shrink-0">
                          {currentRoom.number}
                        </div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40">Current</p>
                          <p className="text-xs font-semibold text-on-surface truncate max-w-[100px]">{currentRoom.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-teal-600 border border-teal-700 flex items-center justify-center font-display italic text-sm text-white shrink-0">
                          {selectedRoom.number}
                        </div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40">New</p>
                          <p className="text-xs font-semibold text-on-surface truncate max-w-[100px]">{selectedRoom.type}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      {/* Dates */}
                      <CompareRow
                        label="Dates"
                        oldVal={`${arrival} → ${departure}`}
                        newVal={`${newArrival} → ${newDeparture}`}
                        delta={datesChanged ? 'diff' : 'same'}
                        highlight
                      />

                      {/* Nights */}
                      <CompareRow
                        label="Nights"
                        oldVal={`${oldNights}n`}
                        newVal={`${newNights}n`}
                        delta={numDelta(oldNights, newNights)}
                        deltaLbl={newNights !== oldNights ? `${newNights > oldNights ? '+' : ''}${newNights - oldNights}n` : ''}
                      />

                      {/* Rate */}
                      <CompareRow
                        label="Rate / night"
                        oldVal={fmtAmount(oldRate)}
                        newVal={fmtAmount(newRate)}
                        delta={numDelta(oldRate, newRate)}
                        deltaLbl={rateDiff !== 0
                          ? `${rateDiff > 0 ? '+' : ''}${fmtAmount(Math.abs(rateDiff))}`
                          : ''}
                        highlight
                      />

                      {/* Total */}
                      <CompareRow
                        label="Total"
                        oldVal={fmtAmount(oldTotal)}
                        newVal={fmtAmount(newTotal)}
                        delta={numDelta(oldTotal, newTotal)}
                        deltaLbl={newTotal !== oldTotal
                          ? `${newTotal > oldTotal ? '+' : ''}${fmtAmount(Math.abs(newTotal - oldTotal))}`
                          : ''}
                        highlight
                      />

                      {/* Area */}
                      <CompareRow
                        label="Area"
                        oldVal={`${currentRoom.area} m²`}
                        newVal={`${selectedRoom.area} m²`}
                        delta={numDelta(currentRoom.area, selectedRoom.area)}
                        deltaLbl={selectedRoom.area !== currentRoom.area
                          ? `${selectedRoom.area > currentRoom.area ? '+' : ''}${selectedRoom.area - currentRoom.area} m²`
                          : ''}
                      />

                      {/* Capacity */}
                      <CompareRow
                        label="Capacity"
                        oldVal={`${currentRoom.capacity} guests`}
                        newVal={`${selectedRoom.capacity} guests`}
                        delta={numDelta(currentRoom.capacity, selectedRoom.capacity)}
                        deltaLbl={selectedRoom.capacity !== currentRoom.capacity
                          ? `${selectedRoom.capacity > currentRoom.capacity ? '+' : ''}${selectedRoom.capacity - currentRoom.capacity}`
                          : ''}
                      />

                      {/* View */}
                      <CompareRow
                        label="View"
                        oldVal={currentRoom.view}
                        newVal={selectedRoom.view}
                        delta={currentRoom.view !== selectedRoom.view ? 'diff' : 'same'}
                      />

                      {/* Bedding */}
                      <CompareRow
                        label="Bedding"
                        oldVal={currentRoom.bedType}
                        newVal={selectedRoom.bedType}
                        delta={currentRoom.bedType !== selectedRoom.bedType ? 'diff' : 'same'}
                      />
                    </div>

                    {/* Total delta summary — reflète l'impact combiné chambre + dates */}
                    {newTotal !== oldTotal && (
                      <div className={cn(
                        'mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold',
                        newTotal > oldTotal
                          ? 'bg-rose-50 border border-rose-100 text-rose-700'
                          : 'bg-teal-50 border border-teal-100 text-teal-700',
                      )}>
                        {newTotal > oldTotal
                          ? <TrendingUp className="w-4 h-4 shrink-0" />
                          : <TrendingDown className="w-4 h-4 shrink-0" />}
                        {newTotal > oldTotal
                          ? `Total increase of ${fmtAmount(newTotal - oldTotal)}`
                          : `Total decrease of ${fmtAmount(Math.abs(newTotal - oldTotal))}`}
                        <span className="ml-auto text-[9px] font-bold uppercase tracking-widest opacity-60">
                          {t('common.total')}
                        </span>
                      </div>
                    )}

                    {newTotal === oldTotal && selectedRoom.id === currentRoomId && !datesChanged && (
                      <div className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-stone-50 border border-stone-100 text-stone-500">
                        <Minus className="w-4 h-4 shrink-0" />
                        No changes yet
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Room list ── */}
            <AnimatePresence initial={false}>
              {showList && (
                <motion.div
                  key="list"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="flex-1 overflow-y-auto p-6 no-scrollbar space-y-3 min-h-0"
                >
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder={t('reservations.searchRoomModal')}
                      className="w-full pl-11 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    />
                  </div>

                  {/* Error */}
                  {serverError && (
                    <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      {serverError}
                    </div>
                  )}

                  {/* Loading */}
                  {isLoading && (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    </div>
                  )}

                  {/* Empty */}
                  {!isLoading && candidates.length === 0 && (
                    <div className="py-14 flex flex-col items-center justify-center text-on-surface-variant/40 bg-stone-50 rounded-[2rem] border border-dashed border-stone-200">
                      <AlertTriangle className="w-8 h-8 mb-4 opacity-20" />
                      <p className="font-display italic text-lg">
                        {search ? t('reservations.noMatch') : t('reservations.noRoomsAvailable')}
                      </p>
                      {search && (
                        <button onClick={() => setSearch('')} className="mt-2 text-[10px] font-bold uppercase tracking-widest text-primary hover:underline">
                          {t('reservations.clearFilters')}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Room cards */}
                  {!isLoading && candidates.map(room => {
                    const isSelected = selectedRoom?.id === room.id;
                    const rate       = room.rateOverride ?? room.rate;
                    const diff       = oldRate > 0 ? rate - oldRate : 0;

                    return (
                      <button
                        key={room.id}
                        onClick={() => handleSelect(room)}
                        className={cn(
                          'w-full flex items-center justify-between p-4 rounded-2xl border transition-all group text-left',
                          isSelected
                            ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-100'
                            : 'bg-white border-stone-200 hover:border-stone-300 hover:shadow-sm',
                        )}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={cn(
                            'w-12 h-12 rounded-xl border flex items-center justify-center font-display italic text-xl shrink-0 transition-all',
                            isSelected
                              ? 'bg-teal-600 border-teal-600 text-white'
                              : 'bg-stone-50 text-on-surface-variant/60 group-hover:bg-stone-100',
                          )}>
                            {room.number}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-on-surface">{room.type}</span>
                              {room.id === currentRoomId && (
                                <span className="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border bg-amber-50 text-amber-700 border-amber-200">
                                  Current
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-on-surface-variant/50 mt-0.5">
                              {room.view} · {room.bedType} · {room.capacity} {t('common.guests_count')} · {room.area}m²
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-bold text-primary">{fmtAmount(rate)}</p>
                            {diff !== 0 && oldRate > 0 && (
                              <p className={cn(
                                'text-[9px] font-bold',
                                diff > 0 ? 'text-rose-500' : 'text-teal-600',
                              )}>
                                {diff > 0 ? '+' : ''}{fmtAmount(diff)}
                              </p>
                            )}
                          </div>
                          <div className={cn(
                            'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
                            isSelected ? 'bg-teal-600 border-teal-600' : 'border-stone-300 group-hover:border-stone-400',
                          )}>
                            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Footer ── */}
            <div className="p-6 bg-stone-50 border-t border-stone-100 flex items-center gap-4 shrink-0">
              <button
                onClick={handleClose}
                disabled={reassign.isPending}
                className="px-6 py-3.5 bg-white text-on-surface-variant border border-stone-200 rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-stone-50 transition-all disabled:opacity-40"
              >
                {t('common.cancel')}
              </button>
              <button
                disabled={!hasChanges || reassign.isPending}
                onClick={handleConfirm}
                className={cn(
                  'flex-1 py-3.5 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-3',
                  hasChanges && !reassign.isPending
                    ? 'bg-zinc-900 text-white hover:bg-black shadow-xl shadow-black/10'
                    : 'bg-stone-200 text-stone-400 cursor-not-allowed',
                )}
              >
                {reassign.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</>
                ) : (
                  <><Check className="w-4 h-4" /> Confirm Reassignment</>
                )}
              </button>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
