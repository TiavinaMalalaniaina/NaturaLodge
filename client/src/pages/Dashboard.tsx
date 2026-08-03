import React, { useState } from 'react';
import { TrendingUp, Users, LogIn, Construction, Plus, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { NewBookingsFeed } from '../components/NewBookingsFeed';
import { useNotifications } from '../context/NotificationContext';
import { useRooms } from '../hooks/useRooms';
import { useBookings, useUpdateBookingStatus } from '../hooks/useBookings';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { PAYMENT_STATUS_CLASS } from '../lib/statusColors';
import { formatCurrency } from '../lib/format';
import { getApiErrorMessage } from '../lib/apiError';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const [isAlertDispatched, setIsAlertDispatched] = useState(false);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const { user } = useAuth();
  const { t } = useTranslation();

  const { data: rooms = [] } = useRooms();
  const { data: bookingsPage } = useBookings({ limit: 100 });
  const bookings = bookingsPage?.data ?? [];
  const updateStatus = useUpdateBookingStatus();

  const { data: checkedOutPage } = useBookings({ status: 'CHECKED_OUT', limit: 50, sort: 'departure', order: 'desc' });
  const pendingPayments = (checkedOutPage?.data ?? []).filter(b => b.paymentStatus !== 'paid').slice(0, 5);

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const occupied = rooms.filter(r => r.status === 'occupied').length;
  const occupancyRate = rooms.length > 0 ? Math.round((occupied / rooms.length) * 100) : 0;
  const issues = rooms.filter(r => r.status === 'maintenance').length;
  const todayArrivals = bookings.filter(b => b.arrival === today && (b.status === 'confirmed' || b.status === 'awaiting'));
  const todayRevenue = bookings
    .filter(b => b.arrival === today && b.status !== 'cancelled')
    .reduce((sum, b) => sum + b.totalAmount, 0);

  const handleNotifyTeam = () => {
    setIsAlertDispatched(true);
    addNotification({
      source: 'system',
      title: 'Operational Dispatch',
      subtitle: 'Housekeeping alert dispatched. VIP arrival imminent.',
      amount: '--'
    });
  };

  const handleQuickCheckin = (id: string) => {
    setCheckingInId(id);
    updateStatus.mutate({ id, status: 'CHECKED_IN' }, {
      onError: (err) => addNotification({
        source: 'system', title: 'Action failed',
        subtitle: getApiErrorMessage(err), amount: '--',
      }),
      onSettled: () => setCheckingInId(null),
    });
  };

  const metrics = [
    { label: t('dashboard.occupancy'),    value: `${occupancyRate}%`,                            trend: `${occupied}/${rooms.length}`,          icon: Users,         color: 'text-teal-500' },
    { label: t('dashboard.revenueToday'), value: `${(todayRevenue / 1_000_000).toFixed(1)}M Ar`, trend: `${todayArrivals.length} ${t('dashboard.arrivals')}`, icon: TrendingUp, color: 'text-gold-500' },
    { label: t('dashboard.arrivals'),     value: String(todayArrivals.length).padStart(2, '0'),   trend: 'Today',                                icon: LogIn,         color: 'text-status-reserved' },
    { label: t('dashboard.issues'),       value: String(issues).padStart(2, '0'),                 trend: 'Pending',                              icon: Construction,  color: 'text-red-500' },
  ];

  const arrivals = todayArrivals.slice(0, 5).map(b => ({
    id: b.id,
    name: b.guestName,
    room: b.rooms[0]?.room.number ?? '—',
    type: b.rooms[0]?.room.type   ?? '—',
    eta: '—',
    status:
      b.guest.status === 'VIP_ELITE' || b.guest.status === 'VIP_MEMBER' ? 'VIP' :
      b.guest.status === 'PLATINUM_TIER' ? 'PREMIUM' : 'Standard',
  }));

  return (
    <div className="space-y-10">
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <p className="text-[10px] font-sans font-bold uppercase tracking-[0.3em] text-on-surface-variant/60 mb-2">
            {t('dashboard.goodMorning')}, {user?.name?.split(' ')[0] ?? 'Marie'}
          </p>
          <h2 className="font-display italic text-5xl text-primary leading-none">{t('dashboard.title')}</h2>
        </div>
        <button
          onClick={() => navigate('/reservations/new')}
          className="bg-primary text-white px-8 py-3.5 rounded-2xl font-sans text-xs font-bold tracking-[0.2em] uppercase hover:bg-primary-container transition-all flex items-center gap-3 shadow-xl shadow-primary/20"
        >
          <Plus className="w-5 h-5" /> {t('dashboard.newBooking')}
        </button>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-2xl border border-stone-200/60 organic-shadow group hover:border-primary/20 transition-all cursor-default"
          >
            <div className="flex justify-between items-start mb-6">
              <div className={cn("p-2 rounded-lg bg-stone-50 group-hover:bg-teal-50 transition-colors", m.color)}>
                <m.icon className="w-5 h-5" />
              </div>
              <span className={cn("text-[10px] font-bold uppercase tracking-widest",
                m.trend.startsWith('+') ? "text-status-available" : "text-on-surface-variant/40"
              )}>
                {m.trend}
              </span>
            </div>
            <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1">{m.label}</p>
            <p className="font-mono text-3xl font-bold text-on-surface">{m.value}</p>
          </motion.div>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <section className="lg:col-span-2 space-y-10">
          <div className="space-y-6">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-xs font-sans font-bold tracking-[0.2em] text-on-surface-variant uppercase">{t('dashboard.arrivalLogistics')}</h3>
              <button onClick={() => navigate('/reservations')}
                className="text-[10px] font-bold text-primary hover:underline transition-all tracking-widest uppercase">{t('dashboard.fullSchedule')}</button>
            </div>
            <div className="bg-white rounded-3xl border border-stone-200/60 overflow-hidden overflow-x-auto organic-shadow">
              <table className="w-full text-left min-w-[600px]">
                <thead>
                  <tr className="bg-stone-50/50 border-b border-stone-100">
                    <th className="px-6 py-4 text-[10px] font-bold tracking-widest uppercase text-on-surface-variant/60">{t('guests.title')}</th>
                    <th className="px-6 py-4 text-[10px] font-bold tracking-widest uppercase text-on-surface-variant/60">{t('dashboard.room')}</th>
                    <th className="px-6 py-4 text-[10px] font-bold tracking-widest uppercase text-on-surface-variant/60 text-right">{t('dashboard.action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {arrivals.map((arrival) => (
                    <tr key={arrival.id} onClick={() => navigate(`/reservations/${arrival.id}`)}
                      className="hover:bg-teal-50 transition-colors cursor-pointer group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center border border-stone-200 overflow-hidden">
                            <span className="text-[10px] font-bold text-primary">{arrival.name.split(' ').map(n=>n[0]).join('')}</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-on-surface leading-tight">{arrival.name}</p>
                            <span className={cn(
                              "text-[8px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wider border inline-block mt-1",
                              arrival.status === 'VIP' ? "bg-gold-50 text-gold-500 border-gold-400" :
                              arrival.status === 'PREMIUM' ? "bg-teal-50 text-primary border-primary" : "bg-stone-50 text-outline border-stone-200"
                            )}>
                              {arrival.status}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <p className="font-display italic text-lg text-on-surface leading-tight">{arrival.type}</p>
                        <p className="text-[10px] font-mono text-outline uppercase">{t('dashboard.room')} {arrival.room}</p>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] font-bold tracking-[0.1em] text-on-surface-variant/40 uppercase mb-1">ETA {arrival.eta}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleQuickCheckin(arrival.id); }}
                            disabled={checkingInId === arrival.id}
                            className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all text-[9px] font-bold uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed">
                            {checkingInId === arrival.id ? t('common.saving') : t('dashboard.quickCheckin')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-stone-900 text-on-primary-container p-10 rounded-[2.5rem] relative overflow-hidden organic-shadow">
            <div className="relative z-10">
              <h3 className="text-[10px] tracking-[0.4em] font-bold text-primary-fixed uppercase opacity-60 mb-2">{t('dashboard.livePerformance')}</h3>
              <p className="font-display italic text-4xl mb-6 leading-none text-white">{(todayRevenue / 1_000_000).toFixed(2)}M Ar</p>
              <div className="flex items-center gap-3">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-status-available">
                  <TrendingUp className="h-3 w-3 text-white" />
                </div>
                <p className="text-xs font-sans font-light text-white/80">
                  15% higher than last Thursday
                </p>
              </div>
            </div>
            <motion.div
              animate={{ scale: [1, 1.05, 1], rotate: [-1, 1, -1] }}
              transition={{ duration: 10, repeat: Infinity }}
              className="absolute right-0 bottom-0 top-0 w-1/2 opacity-10 pointer-events-none"
            >
              <Users className="w-full h-full text-white -rotate-12 translate-x-12 translate-y-12" />
            </motion.div>
          </div>
        </section>

        <aside className="space-y-10">
          <NewBookingsFeed />

          <div className="bg-white p-6 rounded-3xl border border-stone-200/60 organic-shadow">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[10px] font-bold text-on-surface uppercase tracking-widest">{t('dashboard.pendingPayments')}</h4>
              {pendingPayments.length > 0 && (
                <span className="text-[9px] font-bold text-red-500">{pendingPayments.length}</span>
              )}
            </div>
            {pendingPayments.length === 0 ? (
              <p className="text-xs text-on-surface-variant/40 font-light">{t('dashboard.noPendingPayments')}</p>
            ) : (
              <div className="space-y-2">
                {pendingPayments.map(b => (
                  <button key={b.id} onClick={() => navigate(`/invoices/${b.id}`)}
                    className="w-full flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-stone-50 transition-colors text-left">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-on-surface truncate">{b.guestName}</p>
                      <p className="text-[10px] text-on-surface-variant/40 font-mono">{b.departure}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs font-bold text-on-surface">{formatCurrency(b.totalAmount)}</span>
                      <span className={cn('px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border', PAYMENT_STATUS_CLASS[b.paymentStatus])}>
                        {t(`invoice.status_${b.paymentStatus}`)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-3xl border border-stone-200/60 organic-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse font-bold"></div>
              <h4 className="text-[10px] font-bold text-on-surface uppercase tracking-widest">{t('dashboard.operationalAlert')}</h4>
            </div>
            <p className="text-xs text-on-surface-variant font-light leading-relaxed mb-4">
              Housekeeping requires priority for Suite 402. VIP arrival at 15:10.
            </p>
            <button
              onClick={handleNotifyTeam}
              disabled={isAlertDispatched}
              className={cn(
                "w-full py-2.5 border rounded-xl text-[9px] font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2",
                isAlertDispatched
                  ? "border-emerald-100 bg-emerald-50 text-emerald-600 cursor-default"
                  : "border-stone-100 text-primary hover:bg-stone-50"
              )}
            >
              {isAlertDispatched ? (
                <>
                  <Check className="w-3.5 h-3.5" /> {t('dashboard.teamNotified')}
                </>
              ) : (
                t('dashboard.notifyTeam')
              )}
            </button>
          </div>
        </aside>
      </div>

    </div>
  );
};
