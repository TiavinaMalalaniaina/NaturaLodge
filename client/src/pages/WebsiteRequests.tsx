import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { fetchWebsiteRequests, processWebsiteRequest, RequestStatus } from '../api/websiteRequests';
import { useAuth } from '../context/AuthContext';
import { PageLoader, PageError } from '../components/QueryLoader';
import { formatCurrency, formatDate, formatDateTime } from '../lib/format';
import { getApiErrorMessage } from '../lib/apiError';

const statuses: RequestStatus[] = ['PENDING', 'AWAITING_PAYMENT', 'CONFIRMED', 'REJECTED', 'EXPIRED'];
const button = 'rounded-xl border border-stone-200 px-4 py-2 text-sm hover:bg-stone-100 disabled:opacity-40';
const field = 'block w-full rounded-xl border border-stone-200 bg-white p-3 mt-2';

export const WebsiteRequests: React.FC = () => {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState<RequestStatus | ''>('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<{ id: string; action: 'approve' | 'reject' | 'confirm' } | null>(null);
  const [text, setText] = useState('');
  const [hours, setHours] = useState(24);
  const [message, setMessage] = useState('');
  const query = useQuery({ queryKey: ['website-requests', status, page], queryFn: () => fetchWebsiteRequests(status, page), refetchInterval: 30000 });
  const mutation = useMutation({
    mutationFn: processWebsiteRequest,
    onSuccess: async () => {
      setEditing(null); setMessage(t('websiteRequests.success'));
      await Promise.all(['website-requests', 'bookings', 'rooms', 'invoices'].map(key => qc.invalidateQueries({ queryKey: [key] })));
    },
    onError: err => setMessage(getApiErrorMessage(err, t('websiteRequests.error'))),
  });
  const open = (id: string, action: 'approve' | 'reject' | 'confirm') => { setEditing({ id, action }); setText(''); setHours(24); setMessage(''); };
  if (query.isLoading) return <PageLoader />;
  if (query.isError) return <PageError />;
  return <div className="space-y-6">
    <div><h2 className="font-display italic text-3xl">{t('websiteRequests.title')}</h2><p className="mt-2 text-sm text-stone-500">{t('websiteRequests.subtitle')}</p></div>
    <div className="flex flex-wrap gap-3">
      <select aria-label={t('websiteRequests.all')} className={button} value={status} onChange={e => { setStatus(e.target.value as RequestStatus | ''); setPage(1); setEditing(null); }}>
        <option value="">{t('websiteRequests.all')}</option>{statuses.map(s => <option key={s} value={s}>{t(`websiteRequests.${s}`)}</option>)}
      </select>
      <button className={button} disabled={query.isFetching} onClick={() => query.refetch()}>{t('websiteRequests.refresh')}</button>
    </div>
    {message && <p role="status" className="rounded-xl bg-stone-100 p-4 text-sm">{message}</p>}
    {!query.data?.data.length && <p className="py-12 text-stone-500">{t('websiteRequests.empty')}</p>}
    {query.data?.data.map(row => <article key={row.id} className="space-y-4 rounded-3xl border border-stone-200 bg-white p-5 md:p-7">
      <div className="flex flex-wrap justify-between gap-3"><div><h3 className="text-xl font-semibold">{row.name}</h3><p className="break-all text-xs text-stone-500">{row.reference}</p><p className="text-xs text-stone-500">{formatDateTime(row.createdAt)}</p></div><span className="h-fit rounded-full bg-stone-100 px-3 py-1 text-sm">{t(`websiteRequests.${row.status}`)}</span></div>
      <p className="text-sm"><a href={`mailto:${row.email}`}>{row.email}</a> · <a href={`tel:${row.phone}`}>{row.phone}</a></p>
      <p>{formatDate(row.arrival)} → {formatDate(row.departure)} · {t('websiteRequests.guests', { count: row.guests })}</p>
      <ul className="text-sm space-y-1">{row.lines.map(line => <li key={line.roomTypeId}>{line.quantity} × {line.name} · {formatCurrency(line.unitPrice)}</li>)}</ul>
      <p>{t('websiteRequests.total')}: {formatCurrency(row.totalAmount)} · {t('websiteRequests.deposit')}: {formatCurrency(row.depositAmount)}</p>
      {row.notes && <p className="whitespace-pre-wrap text-sm">{row.notes}</p>}
      {row.paymentInstructions && <p className="whitespace-pre-wrap text-sm">{row.paymentInstructions}</p>}
      {row.expiresAt && <p className="text-sm">{t('websiteRequests.deadline')}: {formatDateTime(row.expiresAt)}</p>}
      {row.decisionNote && <p className="whitespace-pre-wrap text-sm">{row.decisionNote}</p>}
      <div className="flex flex-wrap gap-3">
        {row.booking && <><Link className={button} to={`/reservations/${row.booking.id}`}>{t('websiteRequests.booking')}</Link>{can('invoices.view') && <Link className={button} to={`/invoices/${row.booking.id}`}>{t('websiteRequests.invoice')}</Link>}</>}
        {row.status === 'PENDING' && can('bookings.update_status') && <>
          {can('bookings.create') && <button className={button} disabled={mutation.isPending} onClick={() => open(row.id, 'approve')}>{t('websiteRequests.approve')}</button>}
          <button className={button} disabled={mutation.isPending} onClick={() => open(row.id, 'reject')}>{t('websiteRequests.reject')}</button>
        </>}
        {row.status === 'AWAITING_PAYMENT' && can('bookings.update_status') && can('invoices.record_payment') && <button className={button} disabled={mutation.isPending} onClick={() => open(row.id, 'confirm')}>{t('websiteRequests.confirm')}</button>}
      </div>
      {row.status === 'AWAITING_PAYMENT' && <p className="text-sm text-stone-500">{t('websiteRequests.paymentHelp')}</p>}
      {editing?.id === row.id && <form className="space-y-4 border-t pt-4" onSubmit={e => { e.preventDefault(); mutation.mutate({ ...editing, ...(editing.action === 'approve' ? { paymentInstructions: text, hours } : editing.action === 'reject' ? { reason: text } : {}) }); }}>
        {editing.action === 'confirm' ? <p>{t('websiteRequests.confirmHelp')}</p> : <label className="block text-sm">{t(`websiteRequests.${editing.action === 'approve' ? 'instructions' : 'reason'}`)}<textarea className={field} required minLength={editing.action === 'approve' ? 10 : 3} maxLength={editing.action === 'approve' ? 2000 : 1000} value={text} onChange={e => setText(e.target.value)} disabled={mutation.isPending} /></label>}
        {editing.action === 'approve' && <label className="block text-sm">{t('websiteRequests.hours')}<input className={field} type="number" min={1} max={72} required value={hours} onChange={e => setHours(Number(e.target.value))} disabled={mutation.isPending} /></label>}
        <button className={button} disabled={mutation.isPending}>{t('websiteRequests.save')}</button> <button type="button" className={button} disabled={mutation.isPending} onClick={() => setEditing(null)}>{t('websiteRequests.cancel')}</button>
      </form>}
    </article>)}
    <div className="flex flex-wrap items-center gap-3"><button className={button} disabled={page === 1} onClick={() => { setPage(page - 1); setEditing(null); }}>{t('websiteRequests.previous')}</button><span className="text-sm">{t('websiteRequests.page', { page, total: query.data?.total ?? 0 })}</span><button className={button} disabled={page * 20 >= (query.data?.total ?? 0)} onClick={() => { setPage(page + 1); setEditing(null); }}>{t('websiteRequests.next')}</button></div>
  </div>;
};
