import React, { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft, Check, Search, AlertTriangle, Loader2, Calendar, TrendingUp, TrendingDown, Minus, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { useRoom, useAvailableRooms } from '../hooks/useRooms';
import { useReassignRoom, useAddBookingRoom, useRemoveBookingRoom } from '../hooks/useBookings';
import { Room } from '../types';
import { formatCurrency as fmtAmount, nightsBetween, todayLocalStr as todayStr, resetDepartureIfInvalid } from '../lib/format';
import { getApiErrorMessage } from '../lib/apiError';
import { Modal } from './Modal';
import { CompareRow } from './CompareRow';
import { Delta } from './DeltaBadge';
import { ConfirmModal } from './ConfirmModal';
import { useAuth } from '../context/AuthContext';

export interface BookingRoomRef {
  roomId:    string;
  roomNumber: string;
  arrival:   string;
  departure: string;
}

interface ReassignRoomModalProps {
  isOpen:    boolean;
  onClose:   () => void;
  bookingId: string;
  rooms:     BookingRoomRef[];
}

function numDelta(oldN: number, newN: number): Delta {
  if (newN === oldN) return 'same';
  return newN > oldN ? 'up' : 'down';
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export const ReassignRoomModal: React.FC<ReassignRoomModalProps> = ({ isOpen, onClose, bookingId, rooms }) => {
  const { t } = useTranslation();
  const { can } = useAuth();
  const canManageRooms = can('bookings.manage_rooms');

  // 'pick'  : choisir quelle chambre de la réservation réassigner, ou ajouter une nouvelle chambre
  // 'form'  : recherche + sélection d'une chambre (réassignation si activeRoom, ajout sinon)
  const [mode,        setMode]        = useState<'pick' | 'form'>('pick');
  const [activeRoom,  setActiveRoom]  = useState<BookingRoomRef | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [manualRate,  setManualRate]  = useState('');
  const [search,       setSearch]       = useState('');
  const [serverError,  setServerError]  = useState<string | null>(null);
  const [showList,     setShowList]     = useState(true);
  const [newArrival,   setNewArrival]   = useState('');
  const [newDeparture, setNewDeparture] = useState('');
  const [removeTarget, setRemoveTarget] = useState<BookingRoomRef | null>(null);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);

  const envelopeArrival   = rooms.length ? rooms.reduce((min, r) => r.arrival < min ? r.arrival : min, rooms[0].arrival) : todayStr();
  const envelopeDeparture = rooms.length ? rooms.reduce((max, r) => r.departure > max ? r.departure : max, rooms[0].departure) : todayStr();

  // Reset à l'ouverture (nouvelle réservation ciblée, ou même réservation rouverte)
  useEffect(() => {
    if (isOpen) {
      setMode('pick');
      setActiveRoom(null);
      setSelectedRoom(null);
      setManualRate('');
      setSearch('');
      setServerError(null);
      setShowList(true);
      setRemoveTarget(null);
      setConfirmSubmitOpen(false);
    }
  }, [isOpen]);

  const { data: currentRoom }           = useRoom(activeRoom?.roomId ?? '');
  const { data: availableRooms = [], isLoading } = useAvailableRooms(newArrival, newDeparture, activeRoom ? bookingId : undefined);
  const reassign  = useReassignRoom();
  const addRoom   = useAddBookingRoom();
  const removeRoom = useRemoveBookingRoom();
  const isPending = reassign.isPending || addRoom.isPending;

  // La chambre actuelle reste sélectionnable en mode réassignation : ça permet de ne changer
  // que les dates en gardant la même chambre (elle apparaît car `bookingId` est exclu des
  // conflits par le backend dans ce cas précis).
  const candidates = availableRooms.filter(
    r => search === '' ||
         r.number.toLowerCase().includes(search.toLowerCase()) ||
         r.type.toLowerCase().includes(search.toLowerCase()),
  );

  const datesChanged = activeRoom ? (newArrival !== activeRoom.arrival || newDeparture !== activeRoom.departure) : false;
  const derivedRate = selectedRoom ? (selectedRoom.rateOverride ?? selectedRoom.rate) : 0;
  const rateChanged = selectedRoom ? Number(manualRate) !== derivedRate : false;
  const hasChanges = !!selectedRoom && (
    activeRoom ? (selectedRoom.id !== activeRoom.roomId || datesChanged || rateChanged) : true
  );

  const startReassign = (room: BookingRoomRef) => {
    setActiveRoom(room);
    setNewArrival(room.arrival);
    setNewDeparture(room.departure);
    setSelectedRoom(null);
    setManualRate('');
    setSearch('');
    setShowList(true);
    setMode('form');
  };

  const startAdd = () => {
    setActiveRoom(null);
    setNewArrival(envelopeArrival);
    setNewDeparture(envelopeDeparture);
    setSelectedRoom(null);
    setManualRate('');
    setSearch('');
    setShowList(true);
    setMode('form');
  };

  const backToPick = () => {
    setMode('pick');
    setActiveRoom(null);
    setSelectedRoom(null);
    setServerError(null);
  };

  const handleSelect = (room: Room) => {
    const next = selectedRoom?.id === room.id ? null : room;
    setSelectedRoom(next);
    setManualRate(next ? String(next.rateOverride ?? next.rate) : '');
    if (next) setShowList(false);
  };

  const handleConfirm = () => {
    if (!selectedRoom || !hasChanges) return;
    setServerError(null);
    const roomRate = manualRate ? Number(manualRate) : undefined;

    if (activeRoom) {
      reassign.mutate(
        {
          bookingId, oldRoomId: activeRoom.roomId, newRoomId: selectedRoom.id,
          arrival: datesChanged ? newArrival : undefined,
          departure: datesChanged ? newDeparture : undefined,
          roomRate,
        },
        {
          onSuccess: () => onClose(),
          onError:   (err: unknown) => setServerError(getApiErrorMessage(err, t('common.error'))),
        },
      );
    } else {
      addRoom.mutate(
        { bookingId, roomId: selectedRoom.id, arrival: newArrival, departure: newDeparture, roomRate },
        {
          onSuccess: () => onClose(),
          onError:   (err: unknown) => setServerError(getApiErrorMessage(err, t('common.error'))),
        },
      );
    }
  };

  const handleClose = () => {
    if (isPending) return;
    onClose();
  };

  // Delta helpers (mode réassignation uniquement)
  const oldRate = currentRoom?.rateOverride ?? currentRoom?.rate ?? 0;
  const newRate = selectedRoom ? derivedRate : 0;
  const rateDiff = (manualRate ? Number(manualRate) : newRate) - oldRate;
  const oldNights = activeRoom ? nightsBetween(activeRoom.arrival, activeRoom.departure) : 0;
  const newNights = nightsBetween(newArrival, newDeparture);
  const oldTotal = oldRate * oldNights;
  const effectiveRate = manualRate ? Number(manualRate) : newRate;
  const newTotal = effectiveRate * newNights;

  return (
    <>
    <Modal isOpen={isOpen} onClose={handleClose} title={t('reservations.reassign')} zIndexClassName="z-[120]"
      className="max-w-3xl bg-white rounded-[2.5rem] shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">

      {/* ═══════════════ Étape "pick" — choisir une chambre à gérer ═══════════════ */}
      {mode === 'pick' && (
        <>
          <div className="p-8 pb-6 border-b border-stone-100 bg-stone-50/50 shrink-0">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-display italic text-3xl text-on-surface">{t('reservations.reassign')}</h3>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mt-1">
                  {t('reservations.reassignHint')}
                </p>
              </div>
              <button onClick={handleClose} className="p-2 hover:bg-white rounded-full transition-colors border border-stone-200">
                <X className="w-5 h-5 text-on-surface-variant" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 no-scrollbar space-y-3">
            {rooms.map(room => (
              <div key={room.roomId}
                className="w-full flex items-center justify-between p-4 rounded-2xl border border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm transition-all">
                <button onClick={() => startReassign(room)} className="flex items-center gap-4 min-w-0 flex-1 text-left">
                  <div className="w-12 h-12 rounded-xl border border-stone-200 bg-stone-50 flex items-center justify-center font-display italic text-xl text-on-surface-variant/60 shrink-0">
                    {room.roomNumber}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface">{room.arrival} → {room.departure}</p>
                    <p className="text-[10px] text-on-surface-variant/50 mt-0.5">{t('reservations.reassignHint')}</p>
                  </div>
                </button>
                {canManageRooms && (
                  <button
                    onClick={() => setRemoveTarget(room)}
                    disabled={rooms.length <= 1}
                    title={rooms.length <= 1 ? t('reservations.cannotRemoveLastRoom') : undefined}
                    className="p-2 text-on-surface-variant/40 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-on-surface-variant/40 shrink-0 ml-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            {canManageRooms && (
              <button onClick={startAdd}
                className="w-full py-4 border-2 border-dashed border-stone-200 rounded-2xl flex items-center justify-center gap-3 text-on-surface-variant/60 hover:border-primary/40 hover:text-primary transition-all group">
                <Plus className="w-4 h-4 group-hover:scale-125 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-widest">{t('reservations.addRoomToBooking')}</span>
              </button>
            )}
          </div>
        </>
      )}

      {/* ═══════════════ Étape "form" — réassigner ou ajouter ═══════════════ */}
      {mode === 'form' && (
        <>
            {/* ── Header ── */}
            <div className="p-8 pb-6 border-b border-stone-100 bg-stone-50/50 shrink-0">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <button onClick={backToPick} className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-primary hover:underline mb-2">
                    <ArrowLeft className="w-3 h-3" /> {t('common.back')}
                  </button>
                  <h3 className="font-display italic text-3xl text-on-surface">
                    {activeRoom ? t('reservations.reassign') : t('reservations.addRoomToBooking')}
                  </h3>
                </div>
                <button onClick={handleClose} disabled={isPending}
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
                        setNewDeparture(d => resetDepartureIfInvalid(e.target.value, d));
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

              {/* Current → Target pill (réassignation uniquement) */}
              {activeRoom && (
                <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                  <div className="flex flex-col items-center shrink-0">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1">Current</span>
                    <div className="px-5 py-2 bg-white rounded-xl border border-amber-200 font-display italic text-xl text-amber-900">
                      {activeRoom.roomNumber}
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
                      {selectedRoom ? `${selectedRoom.number} — ${selectedRoom.type}` : 'Select a unit'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Comparison panel (réassignation, chambre choisie) ── */}
            <AnimatePresence initial={false}>
              {activeRoom && selectedRoom && currentRoom && !showList && (
                <motion.div
                  key="comparison"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="overflow-hidden shrink-0"
                >
                  <div className="px-8 py-5 border-b border-stone-100 bg-white max-h-[45vh] overflow-y-auto no-scrollbar">

                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40">
                        Unit Comparison
                      </span>
                      <button onClick={() => setShowList(true)} className="text-[9px] font-bold uppercase tracking-widest text-primary hover:underline">
                        ← Change selection
                      </button>
                    </div>

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
                      <CompareRow label="Dates"
                        oldVal={`${activeRoom.arrival} → ${activeRoom.departure}`}
                        newVal={`${newArrival} → ${newDeparture}`}
                        delta={datesChanged ? 'diff' : 'same'} highlight />

                      <CompareRow label="Nights"
                        oldVal={`${oldNights}n`} newVal={`${newNights}n`}
                        delta={numDelta(oldNights, newNights)}
                        deltaLbl={newNights !== oldNights ? `${newNights > oldNights ? '+' : ''}${newNights - oldNights}n` : ''} />

                      {/* Rate — éditable */}
                      <div className="grid grid-cols-[120px_1fr_1fr] gap-x-4 py-2.5 border-b border-stone-100 items-center">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40">Rate / night</span>
                        <span className="text-xs text-on-surface-variant/60 line-through decoration-stone-300">{fmtAmount(oldRate)}</span>
                        <input type="number" min={1} value={manualRate}
                          onChange={e => setManualRate(e.target.value)}
                          className="w-full h-9 px-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                      </div>

                      <CompareRow label="Total"
                        oldVal={fmtAmount(oldTotal)} newVal={fmtAmount(newTotal)}
                        delta={numDelta(oldTotal, newTotal)}
                        deltaLbl={newTotal !== oldTotal ? `${newTotal > oldTotal ? '+' : ''}${fmtAmount(Math.abs(newTotal - oldTotal))}` : ''}
                        highlight />

                      <CompareRow label="Area"
                        oldVal={`${currentRoom.area} m²`} newVal={`${selectedRoom.area} m²`}
                        delta={numDelta(currentRoom.area, selectedRoom.area)}
                        deltaLbl={selectedRoom.area !== currentRoom.area ? `${selectedRoom.area > currentRoom.area ? '+' : ''}${selectedRoom.area - currentRoom.area} m²` : ''} />

                      <CompareRow label="Capacity"
                        oldVal={`${currentRoom.capacity} guests`} newVal={`${selectedRoom.capacity} guests`}
                        delta={numDelta(currentRoom.capacity, selectedRoom.capacity)}
                        deltaLbl={selectedRoom.capacity !== currentRoom.capacity ? `${selectedRoom.capacity > currentRoom.capacity ? '+' : ''}${selectedRoom.capacity - currentRoom.capacity}` : ''} />

                      <CompareRow label="View" oldVal={currentRoom.view} newVal={selectedRoom.view}
                        delta={currentRoom.view !== selectedRoom.view ? 'diff' : 'same'} />

                      <CompareRow label="Bedding" oldVal={currentRoom.bedType} newVal={selectedRoom.bedType}
                        delta={currentRoom.bedType !== selectedRoom.bedType ? 'diff' : 'same'} />
                    </div>

                    {newTotal !== oldTotal && (
                      <div className={cn('mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold',
                        newTotal > oldTotal ? 'bg-rose-50 border border-rose-100 text-rose-700' : 'bg-teal-50 border border-teal-100 text-teal-700')}>
                        {newTotal > oldTotal ? <TrendingUp className="w-4 h-4 shrink-0" /> : <TrendingDown className="w-4 h-4 shrink-0" />}
                        {newTotal > oldTotal
                          ? `Total increase of ${fmtAmount(newTotal - oldTotal)}`
                          : `Total decrease of ${fmtAmount(Math.abs(newTotal - oldTotal))}`}
                        <span className="ml-auto text-[9px] font-bold uppercase tracking-widest opacity-60">{t('common.total')}</span>
                      </div>
                    )}

                    {newTotal === oldTotal && selectedRoom.id === activeRoom.roomId && !datesChanged && (
                      <div className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-stone-50 border border-stone-100 text-stone-500">
                        <Minus className="w-4 h-4 shrink-0" /> No changes yet
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Résumé (ajout d'une chambre, chambre choisie) ── */}
            <AnimatePresence initial={false}>
              {!activeRoom && selectedRoom && !showList && (
                <motion.div
                  key="add-summary"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="overflow-hidden shrink-0"
                >
                  <div className="px-8 py-5 border-b border-stone-100 bg-white space-y-1 max-h-[45vh] overflow-y-auto no-scrollbar">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40">Summary</span>
                      <button onClick={() => setShowList(true)} className="text-[9px] font-bold uppercase tracking-widest text-primary hover:underline">
                        ← Change selection
                      </button>
                    </div>
                    <CompareRow label="Unit" oldVal="—" newVal={`${selectedRoom.number} — ${selectedRoom.type}`} />
                    <CompareRow label="Dates" oldVal="—" newVal={`${newArrival} → ${newDeparture}`} />
                    <CompareRow label="Nights" oldVal="—" newVal={`${newNights}n`} />
                    <div className="grid grid-cols-[120px_1fr_1fr] gap-x-4 py-2.5 border-b border-stone-100 items-center">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40">Rate / night</span>
                      <span />
                      <input type="number" min={1} value={manualRate}
                        onChange={e => setManualRate(e.target.value)}
                        className="w-full h-9 px-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                    </div>
                    <CompareRow label="Total" oldVal="—" newVal={fmtAmount(newTotal)} />
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
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                      placeholder={t('reservations.searchRoomModal')}
                      className="w-full pl-11 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
                  </div>

                  {serverError && (
                    <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      {serverError}
                    </div>
                  )}

                  {isLoading && (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    </div>
                  )}

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

                  {!isLoading && candidates.map(room => {
                    const isSelected = selectedRoom?.id === room.id;
                    const rate       = room.rateOverride ?? room.rate;
                    const diff       = oldRate > 0 ? rate - oldRate : 0;

                    return (
                      <button key={room.id} onClick={() => handleSelect(room)}
                        className={cn(
                          'w-full flex items-center justify-between p-4 rounded-2xl border transition-all group text-left',
                          isSelected ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-100' : 'bg-white border-stone-200 hover:border-stone-300 hover:shadow-sm',
                        )}>
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={cn(
                            'w-12 h-12 rounded-xl border flex items-center justify-center font-display italic text-xl shrink-0 transition-all',
                            isSelected ? 'bg-teal-600 border-teal-600 text-white' : 'bg-stone-50 text-on-surface-variant/60 group-hover:bg-stone-100',
                          )}>
                            {room.number}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-on-surface">{room.type}</span>
                              {activeRoom && room.id === activeRoom.roomId && (
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
                            {activeRoom && diff !== 0 && oldRate > 0 && (
                              <p className={cn('text-[9px] font-bold', diff > 0 ? 'text-rose-500' : 'text-teal-600')}>
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
              <button onClick={backToPick} disabled={isPending}
                className="px-6 py-3.5 bg-white text-on-surface-variant border border-stone-200 rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-stone-50 transition-all disabled:opacity-40">
                {t('common.cancel')}
              </button>
              <button disabled={!hasChanges || isPending} onClick={() => setConfirmSubmitOpen(true)}
                className={cn(
                  'flex-1 py-3.5 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-3',
                  hasChanges && !isPending ? 'bg-zinc-900 text-white hover:bg-black shadow-xl shadow-black/10' : 'bg-stone-200 text-stone-400 cursor-not-allowed',
                )}>
                {isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {t('common.saving')}</>
                ) : activeRoom ? (
                  <><Check className="w-4 h-4" /> Confirm Reassignment</>
                ) : (
                  <><Plus className="w-4 h-4" /> {t('reservations.addRoomToBooking')}</>
                )}
              </button>
            </div>
        </>
      )}
    </Modal>

    <ConfirmModal
      isOpen={confirmSubmitOpen}
      onClose={() => setConfirmSubmitOpen(false)}
      onConfirm={() => { setConfirmSubmitOpen(false); handleConfirm(); }}
      title={t('reservations.confirmReassignTitle')}
      message={t('reservations.confirmReassignMessage')}
      confirmLabel={t('common.confirm')}
      variant="warning"
      isPending={isPending}
      zIndexClassName="z-[130]"
    />
    <ConfirmModal
      isOpen={!!removeTarget}
      onClose={() => setRemoveTarget(null)}
      onConfirm={() => {
        if (!removeTarget) return;
        removeRoom.mutate({ bookingId, roomId: removeTarget.roomId }, {
          onSuccess: () => setRemoveTarget(null),
          onError:   (err) => { setServerError(getApiErrorMessage(err, t('common.error'))); setRemoveTarget(null); },
        });
      }}
      title={t('reservations.removeRoomTitle')}
      message={t('reservations.removeRoomMessage')}
      confirmLabel={t('common.confirm')}
      isPending={removeRoom.isPending}
      zIndexClassName="z-[130]"
    />
    </>
  );
};
