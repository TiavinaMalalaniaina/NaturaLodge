import React, { useState } from 'react';
import {
  ArrowLeft, Calendar, Users, CreditCard, FileText,
  LogIn, LogOut, AlertTriangle, Bed, Hash, Clock, Check,
  ChevronRight, ExternalLink, RefreshCw, RotateCcw, Plus, X, Sparkles,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import {
  useBooking, useUpdateBookingStatus,
  useAddBookingRoomExtra, useUpdateBookingRoomExtra, useRemoveBookingRoomExtra,
} from '../hooks/useBookings';
import { useExtras } from '../hooks/useExtras';
import { useInvoiceByBooking } from '../hooks/useInvoices';
import { PageLoader, PageError } from '../components/QueryLoader';
import { ReassignRoomModal } from '../components/ReassignRoomModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { EFFECTIVE_STATUS_CLASS, EFFECTIVE_STATUS_I18N_KEY } from '../lib/bookingStatus';
import { PAYMENT_STATUS_CLASS } from '../lib/statusColors';
import { useTranslation } from 'react-i18next';
import { formatDate as fmtDate, formatCurrency as fmtAmount } from '../lib/format';
import { getApiErrorMessage } from '../lib/apiError';
import { useNotifications } from '../context/NotificationContext';

export const BookingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { addNotification } = useNotifications();

  const { data: booking, isLoading, isError } = useBooking(id!);
  const { data: invoice } = useInvoiceByBooking(id ?? null);
  const updateStatus = useUpdateBookingStatus();
  const { data: extrasCatalog = [] } = useExtras();
  const addExtra    = useAddBookingRoomExtra();
  const updateExtra = useUpdateBookingRoomExtra();
  const removeExtra = useRemoveBookingRoomExtra();

  const [reassignOpen, setReassignOpen] = useState(false);
  const [cancelOpen,   setCancelOpen]   = useState(false);
  const [confirmOpen,  setConfirmOpen]  = useState(false);
  const [addingExtraRoomId, setAddingExtraRoomId] = useState<string | null>(null);
  const [newExtraId,        setNewExtraId]        = useState('');
  const [newExtraQty,       setNewExtraQty]       = useState(1);

  const activeExtrasCatalog = extrasCatalog.filter(ex => ex.isActive);
  const paymentHistory = invoice?.payments ?? [];
  const totalPaid = invoice
    ? invoice.payments.filter(p => p.status === 'completed').reduce((sum, payment) => sum + payment.amount, 0)
    : 0;
  const remainingAmount = invoice ? Math.max(0, invoice.totalAmount - totalPaid) : 0;

  const notifyError = (err: unknown) => addNotification({
    source: 'system', title: 'Action failed', subtitle: getApiErrorMessage(err), amount: '--',
  });

  if (isLoading) return <PageLoader />;
  if (isError || !booking) return <PageError />;

  const es = booking.effectiveStatus;
  const canCheckIn  = es === 'due_checkin';
  const canCheckOut = es === 'in_progress' || es === 'overdue';
  const canRevert   = es === 'in_progress';
  const canCancel   = es === 'upcoming' || es === 'due_checkin' || es === 'awaiting';
  const canRevertCancel = es === 'cancelled';

  const handleStatus = (status: string) => {
    updateStatus.mutate({ id: booking.id, status }, {
      onSuccess: () => console.log(`Status changed to ${status}`),
      onError: (err) => addNotification({
        source: 'system', title: 'Action failed',
        subtitle: getApiErrorMessage(err), amount: '--',
      }),
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
              <span className={cn('px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border', PAYMENT_STATUS_CLASS[booking.paymentStatus])}>
                {t(`invoice.status_${booking.paymentStatus}`)}
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
          {booking.status === 'awaiting' && (
            <button onClick={() => setConfirmOpen(true)} disabled={updateStatus.isPending}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-amber-600 transition-colors">
              <Check className="w-3.5 h-3.5" /> {t('common.confirm')}
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
          {canRevertCancel && (
            <button onClick={() => handleStatus('AWAITING')} disabled={updateStatus.isPending}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-amber-100 transition-colors disabled:opacity-50">
              <RotateCcw className="w-3.5 h-3.5" /> {t('bookingDetail.revertCancelling')}
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
                const extrasTotal = br.extras.reduce((s, e) => s + e.unitPrice * e.quantity * (e.pricing === 'per_night' ? nights : 1), 0);
                const isAdding = addingExtraRoomId === br.roomId;

                return (
                  <div key={br.id} className="p-4 rounded-2xl border border-stone-100 bg-stone-50/50 hover:border-stone-200 transition-colors">
                    <div className="flex items-center justify-between">
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
                        <p className="text-sm font-display italic text-on-surface">{fmtAmount(br.roomRate * nights + extrasTotal)}</p>
                        <p className="text-[9px] text-on-surface-variant/40 font-mono mt-0.5">{fmtAmount(br.roomRate)} {t('bookingDetail.perNight')}</p>
                      </div>
                    </div>

                    {/* Suppléments */}
                    <div className="mt-3 pt-3 border-t border-stone-100 space-y-2">
                      {br.extras.map(extra => (
                        <div key={extra.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <Sparkles className="w-3 h-3 text-primary/60 shrink-0" />
                            <span className="text-on-surface-variant truncate">{extra.name}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-lg px-1.5 py-0.5">
                              <button
                                onClick={() => extra.quantity > 1
                                  ? updateExtra.mutate({ bookingId: booking.id, roomId: br.roomId, extraId: extra.extraId, quantity: extra.quantity - 1 }, { onError: notifyError })
                                  : removeExtra.mutate({ bookingId: booking.id, roomId: br.roomId, extraId: extra.extraId }, { onError: notifyError })}
                                className="text-on-surface-variant/50 hover:text-primary transition-colors px-0.5">−</button>
                              <span className="font-mono w-4 text-center">{extra.quantity}</span>
                              <button
                                onClick={() => updateExtra.mutate({ bookingId: booking.id, roomId: br.roomId, extraId: extra.extraId, quantity: extra.quantity + 1 }, { onError: notifyError })}
                                className="text-on-surface-variant/50 hover:text-primary transition-colors px-0.5">+</button>
                            </div>
                            <span className="font-mono text-on-surface-variant/60">
                              {fmtAmount(extra.unitPrice * extra.quantity * (extra.pricing === 'per_night' ? nights : 1))}
                            </span>
                            <button
                              onClick={() => removeExtra.mutate({ bookingId: booking.id, roomId: br.roomId, extraId: extra.extraId }, { onError: notifyError })}
                              className="p-1 text-on-surface-variant/30 hover:text-red-500 transition-colors">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {isAdding ? (
                        <div className="flex items-center gap-2 pt-1">
                          <select value={newExtraId} onChange={e => setNewExtraId(e.target.value)}
                            className="flex-1 h-8 px-2 bg-white border border-stone-200 rounded-lg text-[11px] outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                            <option value="">{t('bookingDetail.chooseExtra')}</option>
                            {activeExtrasCatalog.map(ex => (
                              <option key={ex.id} value={ex.id}>{ex.name} ({fmtAmount(ex.price)})</option>
                            ))}
                          </select>
                          <input type="number" min={1} value={newExtraQty}
                            onChange={e => setNewExtraQty(Math.max(1, Number(e.target.value) || 1))}
                            title={t('bookingDetail.extraQuantity')}
                            className="w-14 h-8 px-2 bg-white border border-stone-200 rounded-lg text-[11px] text-center outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                          <button disabled={!newExtraId || addExtra.isPending}
                            onClick={() => addExtra.mutate({ bookingId: booking.id, roomId: br.roomId, extraId: newExtraId, quantity: newExtraQty }, {
                              onSuccess: () => { setAddingExtraRoomId(null); setNewExtraId(''); setNewExtraQty(1); },
                              onError: notifyError,
                            })}
                            className="px-3 h-8 bg-primary text-white rounded-lg text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 transition-all">
                            {t('common.add')}
                          </button>
                          <button onClick={() => { setAddingExtraRoomId(null); setNewExtraId(''); setNewExtraQty(1); }}
                            className="p-1.5 text-on-surface-variant/40 hover:text-on-surface transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setAddingExtraRoomId(br.roomId)}
                          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary hover:underline">
                          <Plus className="w-3 h-3" /> {t('bookingDetail.addExtra')}
                        </button>
                      )}
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

          {/* Invoice summary */}
          <div className="bg-white rounded-3xl border border-stone-200/60 p-6 organic-shadow">
            <div className="flex items-center justify-between gap-3 mb-5">
              <h4 className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant/50 uppercase flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> {t('invoice.title')}
              </h4>
              {invoice && (
                <span className={cn(
                  'px-2.5 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest border',
                  invoice.status === 'paid' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                  invoice.status === 'partially_paid' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  invoice.status === 'refunded' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                  'bg-amber-50 text-amber-700 border-amber-200',
                )}>
                  {t(`invoice.status_${invoice.status}`)}
                </span>
              )}
            </div>

            {!invoice ? (
              <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/70 p-6 text-center text-sm text-on-surface-variant/50">
                {t('invoice.noInvoice')}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-stone-100 bg-stone-50/70 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">{t('invoice.number')}</span>
                    <span className="text-sm font-semibold text-on-surface">{invoice.number}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">{t('invoice.total')}</span>
                    <span className="text-sm font-semibold text-on-surface">{fmtAmount(invoice.totalAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">{t('invoice.status_paid')}</span>
                    <span className="text-sm font-semibold text-teal-700">{fmtAmount(totalPaid)}</span>
                  </div>
                  {remainingAmount > 0 && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">{t('invoice.remaining')}</span>
                      <span className="text-sm font-semibold text-red-600">{fmtAmount(remainingAmount)}</span>
                    </div>
                  )}
                </div>

                <button onClick={() => navigate(`/invoices/${booking.id}`)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-stone-50 border border-stone-100 rounded-xl text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:bg-stone-100 transition-colors group">
                  {t('invoice.title')}
                  <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            )}
          </div>

          {/* Payment history */}
          <div className="bg-white rounded-3xl border border-stone-200/60 p-6 organic-shadow">
            <h4 className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant/50 uppercase mb-5 flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5" /> {t('invoice.paymentHistory')}
            </h4>

            {paymentHistory.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/70 p-6 text-center text-sm text-on-surface-variant/50">
                {t('invoice.noPayments')}
              </div>
            ) : (
              <div className="space-y-3">
                {paymentHistory.map(payment => (
                  <div key={payment.id} className="rounded-2xl border border-stone-100 bg-stone-50/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-on-surface">{fmtAmount(payment.amount)}</p>
                        <p className="text-[10px] text-on-surface-variant/50 mt-1 truncate">
                          {t(`invoice.method_${payment.method}`)} · {fmtDate(payment.paidAt)}
                        </p>
                        {payment.reference && (
                          <p className="text-[10px] font-mono text-on-surface-variant/40 mt-1 truncate">#{payment.reference}</p>
                        )}
                      </div>
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border',
                        payment.status === 'completed' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                        payment.status === 'refunded' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                        'bg-stone-100 text-stone-500 border-stone-200',
                      )}>
                        {t(`payments.status_${payment.status}`)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => { handleStatus('CONFIRMED'); setConfirmOpen(false); }}
        title={t('reservations.confirmBooking')}
        message={t('reservations.confirmBookingMessage')}
        confirmLabel={t('common.confirm')}
        variant="warning"
        isPending={updateStatus.isPending}
      />
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
        rooms={booking.rooms.map(br => ({ roomId: br.roomId, roomNumber: br.room.number, arrival: br.arrival, departure: br.departure }))}
      />
    </motion.div>
  );
};
