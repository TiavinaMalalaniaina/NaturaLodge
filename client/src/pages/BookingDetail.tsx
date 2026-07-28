import React, { useState } from 'react';
import {
  ArrowLeft, Calendar, Users, CreditCard, FileText,
  LogIn, LogOut, AlertTriangle, Bed, Hash, Clock,
  ChevronRight, ExternalLink, RefreshCw, RotateCcw,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useBooking, useUpdateBookingStatus } from '../hooks/useBookings';
import { PageLoader, PageError } from '../components/QueryLoader';
import { ReassignRoomModal } from '../components/ReassignRoomModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { EFFECTIVE_STATUS_CLASS, EFFECTIVE_STATUS_I18N_KEY } from '../lib/bookingStatus';
import { useTranslation } from 'react-i18next';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtAmount(n: number) {
  return n.toLocaleString('fr-MG') + ' Ar';
}

export const BookingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: booking, isLoading, isError } = useBooking(id!);
  const updateStatus = useUpdateBookingStatus();

  const [reassignOpen, setReassignOpen] = useState(false);
  const [cancelOpen,   setCancelOpen]   = useState(false);

  if (isLoading) return <PageLoader />;
  if (isError || !booking) return <PageError />;

  const es = booking.effectiveStatus;
  const canCheckIn  = es === 'due_checkin';
  const canCheckOut = es === 'in_progress' || es === 'overdue';
  const canRevert   = es === 'in_progress';
  const canCancel   = es === 'upcoming' || es === 'due_checkin';

  const handleStatus = (status: string) => {
    updateStatus.mutate({ id: booking.id, status }, {
      onSuccess: () => navigate(-1),
    });
  };

  return (
    <motion.div
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="space-y-8 pb-20"
    >
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)}
            className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full border border-stone-200 bg-white hover:bg-stone-50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="font-display text-2xl md:text-3xl text-primary leading-none">{t('reservations.bookingDetails')}</h2>
              <span className={cn('px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border', EFFECTIVE_STATUS_CLASS[es])}>
                {t(EFFECTIVE_STATUS_I18N_KEY[es])}
              </span>
            </div>
            <p className="text-[10px] text-on-surface-variant/50 font-mono tracking-widest">#{booking.id.slice(-12).toUpperCase()}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {canCheckIn && (
            <button onClick={() => handleStatus('CHECKED_IN')} disabled={updateStatus.isPending}
              className="flex items-center gap-2 px-4 py-2.5 bg-teal-800 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-teal-900 transition-colors shadow-lg shadow-teal-800/10 disabled:opacity-50">
              <LogIn className="w-3.5 h-3.5" /> {t('reservations.checkin')}
            </button>
          )}
          {canCheckOut && (
            <button onClick={() => handleStatus('CHECKED_OUT')} disabled={updateStatus.isPending}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors shadow-lg disabled:opacity-50',
                es === 'overdue'
                  ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-600/10'
                  : 'bg-zinc-800 text-white hover:bg-black shadow-zinc-800/10',
              )}>
              {es === 'overdue' ? <AlertTriangle className="w-3.5 h-3.5" /> : <LogOut className="w-3.5 h-3.5" />}
              {es === 'overdue' ? t('bookingDetail.forceOut') : t('reservations.checkout')}
            </button>
          )}
          {canRevert && (
            <button onClick={() => handleStatus('CONFIRMED')} disabled={updateStatus.isPending}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-amber-100 transition-colors disabled:opacity-50">
              <RotateCcw className="w-3.5 h-3.5" /> {t('bookingDetail.revertCheckIn')}
            </button>
          )}
          <button onClick={() => setReassignOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-stone-100 text-on-surface-variant rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-stone-200 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> {t('bookingDetail.reassign')}
          </button>
          <button onClick={() => navigate(`/invoices/${booking.id}`)}
            className="flex items-center gap-2 px-4 py-2.5 bg-stone-100 text-on-surface-variant rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-stone-200 transition-colors">
            <FileText className="w-3.5 h-3.5" /> {t('invoice.title')}
          </button>
          {canCancel && (
            <button onClick={() => setCancelOpen(true)} disabled={updateStatus.isPending}
              className="flex items-center gap-2 px-4 py-2.5 border border-red-200 text-red-500 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-50 transition-colors disabled:opacity-50">
              {t('common.cancel')}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left col (2/3) ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Stay summary */}
          <div className="bg-white rounded-3xl border border-stone-200/60 p-8 organic-shadow">
            <h4 className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant/50 uppercase mb-6">{t('bookingDetail.staySummary')}</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {[
                { icon: Calendar,   label: t('reservations.arrivalDate'),   value: fmtDate(booking.arrival) },
                { icon: Calendar,   label: t('reservations.departureDate'), value: fmtDate(booking.departure) },
                { icon: Clock,      label: t('reservations.nights'),        value: `${booking.nights} ${booking.nights > 1 ? t('common.nights') : t('common.night')}` },
                { icon: CreditCard, label: t('common.total'),               value: fmtAmount(booking.totalAmount) },
              ].map((item, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="w-9 h-9 rounded-xl bg-stone-50 flex items-center justify-center text-primary border border-stone-100">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest">{item.label}</p>
                  <p className="text-sm font-semibold text-on-surface">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Rooms booked */}
          <div className="bg-white rounded-3xl border border-stone-200/60 p-8 organic-shadow">
            <h4 className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant/50 uppercase mb-6 flex items-center gap-2">
              <Bed className="w-3.5 h-3.5" /> {t('reservations.roomsBooked')}
              <span className="ml-1 text-primary">({booking.rooms.length})</span>
            </h4>
            <div className="space-y-3">
              {booking.rooms.map((br) => {
                const nights = Math.max(1, Math.round(
                  (new Date(br.departure).getTime() - new Date(br.arrival).getTime()) / 86_400_000
                ));
                return (
                  <div key={br.id} className="flex items-center justify-between p-4 rounded-2xl border border-stone-100 bg-stone-50/50 hover:border-stone-200 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white border border-stone-200 flex items-center justify-center font-display italic text-2xl text-primary">
                        {br.room.number}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-on-surface">{br.room.type}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] font-mono text-on-surface-variant/40">{fmtDate(br.arrival)} → {fmtDate(br.departure)}</span>
                          <span className="text-stone-200">·</span>
                          <span className="text-[9px] font-bold text-on-surface-variant/40">{nights}n</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-display italic text-on-surface">{fmtAmount(br.roomRate * nights)}</p>
                      <p className="text-[9px] text-on-surface-variant/40 font-mono mt-0.5">{fmtAmount(br.roomRate)} {t('bookingDetail.perNight')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Right col (1/3) ── */}
        <div className="space-y-6">

          {/* Guest card */}
          <div className="bg-white rounded-3xl border border-stone-200/60 p-6 organic-shadow">
            <h4 className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant/50 uppercase mb-5 flex items-center gap-2">
              <Users className="w-3.5 h-3.5" /> {t('bookingDetail.guest')}
            </h4>
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center font-display italic text-2xl text-primary shrink-0">
                {booking.guest.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-on-surface truncate">{booking.guest.name}</p>
                <p className="text-[10px] text-on-surface-variant/50 truncate mt-0.5">{booking.guest.email}</p>
              </div>
            </div>
            <Link to={`/guests/${booking.guestId}`}
              className="flex items-center justify-between w-full px-4 py-2.5 bg-stone-50 border border-stone-100 rounded-xl text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:bg-stone-100 hover:text-primary transition-colors group">
              {t('bookingDetail.viewGuestProfile')}
              <ExternalLink className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
            </Link>
          </div>

          {/* Booking metadata */}
          <div className="bg-white rounded-3xl border border-stone-200/60 p-6 organic-shadow">
            <h4 className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant/50 uppercase mb-5 flex items-center gap-2">
              <Hash className="w-3.5 h-3.5" /> {t('bookingDetail.metadata')}
            </h4>
            <div className="space-y-3">
              {[
                { label: t('bookingDetail.bookingId'), value: booking.id.slice(-12).toUpperCase() },
                { label: t('bookingDetail.status'),    value: t(EFFECTIVE_STATUS_I18N_KEY[es]) },
                { label: t('bookingDetail.rooms'),     value: booking.rooms.map(br => `#${br.room.number}`).join(', ') },
                { label: t('common.total'),            value: fmtAmount(booking.totalAmount) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-stone-50 last:border-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">{label}</span>
                  <span className="text-xs font-semibold text-on-surface text-right max-w-[60%] truncate">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick nav to reservations */}
          <button onClick={() => navigate('/reservations')}
            className="w-full flex items-center justify-between px-5 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:bg-stone-100 transition-colors group">
            {t('bookingDetail.backToReservations')}
            <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>
      </div>

      {/* ── Modals ── */}
      <ConfirmModal
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => { handleStatus('CANCELLED'); setCancelOpen(false); }}
        title={t('reservations.cancelTitle')}
        message={t('reservations.cancelMessage')}
        confirmLabel={t('reservations.confirmCancel')}
        isPending={updateStatus.isPending}
      />
      <ReassignRoomModal
        isOpen={reassignOpen}
        onClose={() => setReassignOpen(false)}
        bookingId={booking.id}
        currentRoomId={booking.rooms[0]?.roomId ?? ''}
        currentRoomNumber={booking.rooms[0]?.room.number ?? ''}
        arrival={booking.arrival}
        departure={booking.departure}
      />
    </motion.div>
  );
};
