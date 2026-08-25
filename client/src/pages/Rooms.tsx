import React, { useState, useMemo } from 'react';
import { Plus, Filter, Layers, MoreVertical, Users, Maximize, Building2, Zap, Search, X, Construction, CheckCircle, Eye, AlertTriangle, ChevronRight, Sparkles, Tags } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useRooms, useUpdateRoomStatus } from '../hooks/useRooms';
import { useRoomTypes } from '../hooks/useRoomTypes';
import { AddRoomModal } from '../components/AddRoomModal';
import { FeatureManagerModal } from '../components/FeatureManagerModal';
import { ExtraManagerModal } from '../components/ExtraManagerModal';
import { PageLoader, PageError } from '../components/QueryLoader';
import { Room } from '../types';
import { useTranslation } from 'react-i18next';
import { ConflictBooking } from '../api/rooms';
import { formatCurrency, todayLocalStr } from '../lib/format';
import { ROOM_STATUS_BORDER_CLASS, ROOM_STATUS_BADGE_CLASS } from '../lib/statusColors';
import { FilterChip } from '../components/FilterChip';
import { useNotifications } from '../context/NotificationContext';
import { getApiErrorMessage } from '../lib/apiError';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';

type StatusTab = 'all' | 'available' | 'occupied' | 'maintenance';

export const Rooms: React.FC = () => {
  const navigate  = useNavigate();
  const { t }     = useTranslation();
  const { can }   = useAuth();
  const { data: apiRooms, isLoading, isError } = useRooms(undefined, { refetchInterval: 60_000 });
  const { data: roomTypes = [] } = useRoomTypes();

  const updateStatus = useUpdateRoomStatus();
  const { addNotification } = useNotifications();

  const [isAddModalOpen, setIsAddModalOpen]                 = useState(false);
  const [isFeatureModalOpen, setIsFeatureModalOpen]         = useState(false);
  const [isExtraModalOpen, setIsExtraModalOpen]             = useState(false);
  const [activeDropdown, setActiveDropdown]                 = useState<string | null>(null);
  const [conflictsInfo, setConflictsInfo]                   = useState<{ roomNumber: string; list: ConflictBooking[] } | null>(null);
  const [maintenanceTarget, setMaintenanceTarget]           = useState<Room | null>(null);

  const [statusTab,       setStatusTab]       = useState<StatusTab>('all');
  const [roomTypeFilter,  setRoomTypeFilter]  = useState('ALL');
  const [search,          setSearch]          = useState('');
  const [showFilters,     setShowFilters]     = useState(false);

  // Fermer le dropdown sur clic extérieur
  React.useEffect(() => {
    const close = () => setActiveDropdown(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const handleMaintenanceToggle = (room: Room) => {
    const newStatus = room.status === 'maintenance' ? 'AVAILABLE' : 'MAINTENANCE';
    updateStatus.mutate({ id: room.id, status: newStatus }, {
      onSuccess: ({ conflicts }) => {
        if (conflicts.length > 0) setConflictsInfo({ roomNumber: room.number, list: conflicts });
      },
      onError: (err) => addNotification({
        source: 'system', title: 'Action failed',
        subtitle: getApiErrorMessage(err), amount: '--',
      }),
    });
  };

  const allRooms: Room[] = apiRooms ?? [];

  const filteredRooms = useMemo(() => {
    const q = search.toLowerCase();
    return allRooms.filter(room => {
      if (statusTab !== 'all' && room.status !== statusTab) return false;
      if (roomTypeFilter !== 'ALL' && room.type !== roomTypeFilter) return false;
      if (q && !room.number.toLowerCase().includes(q) && !room.type.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allRooms, statusTab, roomTypeFilter, search]);

  const STATUS_TABS: { key: StatusTab; label: string }[] = [
    { key: 'all',         label: t('common.all') },
    { key: 'available',   label: t('status.available') },
    { key: 'occupied',    label: t('status.occupied') },
    { key: 'maintenance', label: t('status.maintenance') },
  ];

  const activeFiltersCount = (statusTab !== 'all' ? 1 : 0) + (roomTypeFilter !== 'ALL' ? 1 : 0) + (search ? 1 : 0);

  if (isLoading) return <PageLoader />;
  if (isError)   return <PageError />;

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 sm:gap-0">
        <div>
          <h2 className="font-display italic text-3xl md:text-4xl text-on-surface mb-1 leading-none">{t('rooms.title')}</h2>
          <p className="text-[10px] font-sans font-bold uppercase tracking-[0.3em] text-on-surface-variant/40">
            {filteredRooms.length} / {allRooms.length} {t('rooms.availableRooms').toLowerCase()}
          </p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={() => navigate('/rooms/types')}
            className="w-full sm:w-auto bg-stone-100 text-on-surface-variant px-6 py-3 rounded-xl font-sans text-xs font-bold tracking-[0.2em] uppercase hover:bg-stone-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Tags className="w-4 h-4" /> {t('roomTypes.title')}
          </button>
          {can('rooms.view') && (
            <button
              onClick={() => setIsFeatureModalOpen(true)}
              className="w-full sm:w-auto bg-stone-100 text-on-surface-variant px-6 py-3 rounded-xl font-sans text-xs font-bold tracking-[0.2em] uppercase hover:bg-stone-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Layers className="w-4 h-4" /> Attributes
            </button>
          )}
          {can('extras.manage') && (
            <button
              onClick={() => setIsExtraModalOpen(true)}
              className="w-full sm:w-auto bg-stone-100 text-on-surface-variant px-6 py-3 rounded-xl font-sans text-xs font-bold tracking-[0.2em] uppercase hover:bg-stone-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" /> Suppléments
            </button>
          )}
          {can('rooms.create') && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="w-full sm:w-auto bg-primary text-white px-6 py-3 rounded-xl font-sans text-xs font-bold tracking-[0.2em] uppercase hover:bg-primary-container transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/10 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> {t('rooms.addRoom')}
            </button>
          )}
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-stone-200 pb-3">

          {/* Status tabs */}
          <div className="flex gap-6 md:gap-8 overflow-x-auto no-scrollbar font-sans">
            {STATUS_TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusTab(key)}
                className={cn(
                  'pb-3 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] transition-all relative px-1 whitespace-nowrap cursor-pointer',
                  statusTab === key ? 'text-primary' : 'text-on-surface-variant/40 hover:text-on-surface-variant',
                )}
              >
                {label}
                {statusTab === key && (
                  <motion.div layoutId="room-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            ))}
          </div>

          {/* Search + filter toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`${t('rooms.roomNumber')}, ${t('rooms.typeName')}…`}
                className="h-9 pl-9 pr-8 w-44 bg-white border border-stone-200 rounded-xl text-[10px] uppercase font-bold tracking-widest focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              onClick={() => setShowFilters(v => !v)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl border text-[9px] font-bold uppercase tracking-[0.2em] transition-all cursor-pointer',
                showFilters || roomTypeFilter !== 'ALL'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white border-stone-200 text-on-surface-variant hover:bg-stone-50',
              )}
            >
              <Filter className="w-3.5 h-3.5" />
              {t('rooms.typeName')}
              {roomTypeFilter !== 'ALL' && (
                <span className="w-4 h-4 rounded-full bg-white/30 text-[8px] font-bold flex items-center justify-center">1</span>
              )}
            </button>

            {activeFiltersCount > 0 && (
              <button
                onClick={() => { setStatusTab('all'); setRoomTypeFilter('ALL'); setSearch(''); }}
                className="text-[9px] font-bold text-red-400 hover:text-red-600 uppercase tracking-widest transition-colors whitespace-nowrap"
              >
                {t('reservations.clearAllFilters')}
              </button>
            )}
          </div>
        </div>

        {/* Room type chips */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 flex-wrap py-1">
                {['ALL', ...roomTypes.map(rt => rt.name)].map(rt => (
                  <FilterChip key={rt} active={roomTypeFilter === rt} onClick={() => setRoomTypeFilter(rt)}>
                    {rt === 'ALL' ? t('common.all') : rt}
                  </FilterChip>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Room grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
        {filteredRooms.map((room, i) => (
          <motion.div
            key={room.id}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: Math.min(i * 0.05, 0.3) }}
            onClick={() => navigate(`/rooms/${room.id}`)}
            className={cn(
              'bg-white rounded-3xl border border-stone-200/60 p-6 organic-shadow group cursor-pointer hover:border-primary/20 transition-all flex flex-col relative overflow-hidden border-l-[6px]',
              ROOM_STATUS_BORDER_CLASS[room.status] ?? 'border-l-status-maintenance',
            )}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className={cn(
                  'px-2.5 py-1 rounded-lg text-[8px] font-bold uppercase tracking-widest shadow-sm border font-sans',
                  ROOM_STATUS_BADGE_CLASS[room.status] ?? 'bg-stone-50 text-status-maintenance border-stone-200',
                )}>
                  {t(`status.${room.status}`, room.status)}
                </span>
                <h3 className="font-display italic text-3xl text-primary mt-4 leading-none">Suite {room.number}</h3>
                <p className="font-mono text-[9px] text-on-surface-variant/60 uppercase tracking-widest mt-2 truncate max-w-[210px]">{room.type}</p>
              </div>
              <div className="relative" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setActiveDropdown(activeDropdown === room.id ? null : room.id)}
                  className="text-on-surface-variant/40 hover:text-primary transition-colors cursor-pointer"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                <AnimatePresence>
                  {activeDropdown === room.id && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.1 }}
                      className="absolute right-0 top-7 z-20 w-48 bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden"
                    >
                      {can('rooms.update') && (
                        <>
                          <button
                            onClick={() => {
                              if (room.status === 'maintenance') handleMaintenanceToggle(room);
                              else setMaintenanceTarget(room);
                              setActiveDropdown(null);
                            }}
                            disabled={updateStatus.isPending}
                            className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest hover:bg-stone-50 transition-colors disabled:opacity-40"
                          >
                            {room.status === 'maintenance'
                              ? <><CheckCircle className="w-3.5 h-3.5 text-teal-500" /> {t('rooms.readyForService')}</>
                              : <><Construction className="w-3.5 h-3.5 text-amber-500" /> {t('rooms.flagForMaintenance')}</>
                            }
                          </button>
                          <div className="h-px bg-stone-100" />
                        </>
                      )}
                      <button
                        onClick={() => { navigate(`/rooms/${room.id}`); setActiveDropdown(null); }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest hover:bg-stone-50 transition-colors text-on-surface-variant"
                      >
                        <Eye className="w-3.5 h-3.5" /> {t('common.view')}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex items-center gap-6 py-6 border-y border-stone-50 mb-6 font-sans">
              <div className="flex items-center gap-2 text-on-surface-variant/60">
                <Users className="w-4 h-4" />
                <span className="text-[10px] font-bold tracking-widest uppercase">{room.capacity} {t('common.guests_count')}</span>
              </div>
              <div className="flex items-center gap-2 text-on-surface-variant/60">
                <Maximize className="w-4 h-4" />
                <span className="text-[10px] font-bold tracking-widest uppercase">{room.area}m²</span>
              </div>
            </div>

            <div className="flex justify-between items-center mt-auto font-sans">
              <div className="flex items-center gap-3">
                <p className="font-display text-2xl text-gold-500">
                  {formatCurrency(room.rate)}
                  {room.rateOverride && <span className="text-[10px] text-on-surface-variant/40 font-sans ml-1">(spécifique)</span>}
                </p>
                {room.status === 'available' && can('bookings.create') && (
                  <button
                    onClick={e => { e.stopPropagation(); navigate(`/reservations/new?roomId=${room.id}&arrival=${todayLocalStr()}`); }}
                    className="p-2 bg-teal-50 text-status-available rounded-lg hover:bg-teal-600 hover:text-white transition-all border border-teal-100 cursor-pointer"
                    title={t('rooms.instantBook')}
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                  </button>
                )}
              </div>
              <button className="text-[9px] font-bold text-primary tracking-[0.2em] uppercase hover:underline underline-offset-4 cursor-pointer">
                {t('common.view')}
              </button>
            </div>

            {(!room.images || !room.images[0]) && (
              <div className="absolute -bottom-6 -right-6 w-24 h-24 text-primary/5 pointer-events-none transition-transform group-hover:-rotate-6">
                <Building2 className="w-full h-full" />
              </div>
            )}
          </motion.div>
        ))}

        {/* Empty state */}
        {filteredRooms.length === 0 && (
          <div className="col-span-full py-32 flex flex-col items-center text-on-surface-variant/30">
            <Filter className="w-12 h-12 mb-4 opacity-20" />
            <p className="font-display italic text-2xl mb-4">{t('rooms.noRoomsFound')}</p>
            <button
              onClick={() => { setStatusTab('all'); setRoomTypeFilter('ALL'); setSearch(''); }}
              className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline"
            >
              {t('reservations.clearAllFilters')}
            </button>
          </div>
        )}

        {/* Add card */}
        {can('rooms.create') && (
          <motion.div
            whileHover={{ scale: 0.98 }}
            onClick={() => setIsAddModalOpen(true)}
            className="bg-stone-50 rounded-3xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center p-12 group cursor-pointer hover:border-primary/40 transition-all opacity-60 hover:opacity-100"
          >
            <div className="w-16 h-16 rounded-full bg-white border border-stone-200 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
              <Plus className="w-8 h-8" />
            </div>
            <p className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase">{t('rooms.addRoom')}</p>
          </motion.div>
        )}
      </div>

      {/* ── Modal conflits maintenance ── */}
      <AnimatePresence>
        {conflictsInfo && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setConflictsInfo(null)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-100 p-8 space-y-5"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-display italic text-xl text-on-surface">
                    {t('rooms.maintenanceConflicts', { count: conflictsInfo.list.length })}
                  </h3>
                  <p className="text-xs text-on-surface-variant/60 mt-1">{t('rooms.maintenanceConflictsNote')}</p>
                </div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {conflictsInfo.list.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { navigate(`/reservations/${c.id}`); setConflictsInfo(null); }}
                    className="w-full flex items-center justify-between px-4 py-3 bg-stone-50 border border-stone-100 rounded-xl hover:border-amber-200 transition-colors group"
                  >
                    <div className="text-left">
                      <p className="text-xs font-semibold text-on-surface">{c.guest.name}</p>
                      <p className="text-[10px] font-mono text-on-surface-variant/50">{c.arrival} → {c.departure}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-amber-500 transition-colors" />
                  </button>
                ))}
              </div>

              <button
                onClick={() => setConflictsInfo(null)}
                className="w-full py-3 bg-stone-100 text-on-surface-variant rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-stone-200 transition-all"
              >
                {t('common.close')}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!maintenanceTarget}
        onClose={() => setMaintenanceTarget(null)}
        onConfirm={() => {
          if (maintenanceTarget) handleMaintenanceToggle(maintenanceTarget);
          setMaintenanceTarget(null);
        }}
        title={t('rooms.confirmMaintenanceTitle')}
        message={t('rooms.confirmMaintenanceMessage')}
        variant="warning"
        isPending={updateStatus.isPending}
      />
      <AddRoomModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onRoomAdded={() => setIsAddModalOpen(false)}
      />
      <FeatureManagerModal isOpen={isFeatureModalOpen} onClose={() => setIsFeatureModalOpen(false)} />
      <ExtraManagerModal isOpen={isExtraModalOpen} onClose={() => setIsExtraModalOpen(false)} />
    </div>
  );
};
