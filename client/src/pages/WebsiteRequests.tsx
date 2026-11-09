import React, { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertTriangle, BedDouble, CalendarDays, Clock, ExternalLink, FileText, Globe, Mail, MessageSquare, Paperclip, PenLine, Phone, RefreshCw, Search, X } from 'lucide-react';
import { fetchPaymentSheet, fetchPendingWebsiteRequests, fetchProof, fetchRoomOptions, ProofMeta, fetchWebsiteRequests, processWebsiteRequest, RequestStatus, RoomChoiceLine, WebsiteRequest } from '../api/websiteRequests';
import { useAuth } from '../context/AuthContext';
import { PageLoader, PageError } from '../components/QueryLoader';
import { formatCurrency, formatDate, formatDateTime, nightsBetween } from '../lib/format';
import { getApiErrorMessage } from '../lib/apiError';
import { useNow } from '../hooks/useNow';
import { useDebounce } from '../hooks/useDebounce';
import { PaymentSheetEditor } from '../components/PaymentSheetEditor';
import { buildInstructions, requestLang } from '../lib/paymentInstructions';
import { cn } from '../lib/utils';

type Action = 'approve' | 'reject' | 'confirm';
const statuses: RequestStatus[] = ['PENDING', 'AWAITING_PAYMENT', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'CANCELLED'];
const statusTone: Record<RequestStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-800 border-amber-200', AWAITING_PAYMENT: 'bg-sky-50 text-sky-800 border-sky-200',
  CONFIRMED: 'bg-emerald-50 text-emerald-800 border-emerald-200', REJECTED: 'bg-stone-100 text-stone-600 border-stone-200',
  EXPIRED: 'bg-stone-100 text-stone-600 border-stone-200', CANCELLED: 'bg-red-50 text-red-800 border-red-200',
};
// Left accent: requests that need staff action stand out while scrolling.
const accent: Record<RequestStatus, string> = {
  PENDING: 'border-l-amber-400', AWAITING_PAYMENT: 'border-l-sky-400', CONFIRMED: 'border-l-emerald-400',
  REJECTED: 'border-l-stone-300', EXPIRED: 'border-l-stone-300', CANCELLED: 'border-l-red-300',
};
const secondary = 'inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm text-on-surface-variant hover:border-primary/30 hover:text-primary transition-colors disabled:opacity-40';
const primary = 'inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-40';
const danger = 'inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors disabled:opacity-40';
const field = 'block w-full rounded-xl border border-stone-200 bg-white p-3 mt-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none';
const label = 'text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50';

const Section: React.FC<{ icon: React.ElementType; title: string; children: React.ReactNode }> = ({ icon: Icon, title, children }) => (
  <div className="min-w-0">
    <p className={cn(label, 'mb-2 flex items-center gap-1.5')}><Icon className="h-3.5 w-3.5" />{title}</p>
    <div className="space-y-1 text-sm text-on-surface">{children}</div>
  </div>
);

const picked = (line: RoomChoiceLine, selected: string[]) => line.rooms.filter(room => selected.includes(room.id)).length;

const RoomPicker: React.FC<{ lines: RoomChoiceLine[]; selected: string[]; onToggle: (id: string) => void; disabled: boolean }> = ({ lines, selected, onToggle, disabled }) => {
  const { t } = useTranslation();
  return <div className="space-y-4">
    {lines.map(line => {
      const count = picked(line, selected);
      const free = line.rooms.filter(room => room.state === 'free').length;
      return <fieldset key={line.roomTypeId} className="space-y-2">
        <legend className="flex w-full flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-semibold">{t('websiteRequests.chooseRooms', { name: line.name, count: line.quantity })}</span>
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', count === line.quantity ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-on-surface-variant')}>{t('websiteRequests.picked', { picked: count, count: line.quantity })}</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {line.rooms.map(room => {
            const isSelected = selected.includes(room.id);
            const unavailable = room.state !== 'free';
            const full = !isSelected && count >= line.quantity;
            return <button key={room.id} type="button" aria-pressed={isSelected} disabled={disabled || unavailable || full} onClick={() => onToggle(room.id)}
              title={room.state === 'booked' ? t('websiteRequests.roomBookedBy', { name: room.bookedBy ?? '—' }) : room.state === 'maintenance' ? t('websiteRequests.roomMaintenance') : undefined}
              className={cn('min-w-20 rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                isSelected ? 'border-primary bg-primary text-white' :
                unavailable ? 'cursor-not-allowed border-stone-200 bg-stone-100 text-on-surface-variant/40 line-through' :
                full ? 'cursor-not-allowed border-stone-200 bg-white text-on-surface-variant/40' :
                'border-stone-200 bg-white hover:border-primary/40 hover:bg-teal-50')}>
              <span className="block font-semibold">{room.number}</span>
              <span className={cn('block text-[10px] uppercase tracking-widest', isSelected ? 'text-white/80' : 'text-on-surface-variant/60')}>
                {room.state === 'booked' ? t('websiteRequests.roomBooked') : room.state === 'maintenance' ? t('websiteRequests.roomMaintenance') : isSelected ? t('websiteRequests.roomSelected') : t('websiteRequests.roomFree')}
              </span>
            </button>;
          })}
        </div>
        {free < line.quantity && <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{t('websiteRequests.notEnoughRooms', { name: line.name, free, count: line.quantity })}</p>}
      </fieldset>;
    })}
  </div>;
};

export const WebsiteRequests: React.FC = () => {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const now = useNow(30_000);
  const [status, setStatus] = useState<RequestStatus | ''>('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim());
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<{ id: string; action: Action } | null>(null);
  const [text, setText] = useState('');
  const [hours, setHours] = useState(24);
  const [roomIds, setRoomIds] = useState<string[]>([]);
  const [showSheet, setShowSheet] = useState(false);
  const [methodIds, setMethodIds] = useState<string[]>([]);
  const [approveNote, setApproveNote] = useState('');
  const sheetQuery = useQuery({ queryKey: ['website-requests', 'payment-sheet'], queryFn: fetchPaymentSheet, staleTime: 60000 });
  const canEditSheet = can('bookings.create') && can('bookings.update_status');
  // Instructions are generated from the hotel's payment sheet, in the guest's language.
  const instructionsFor = (row: WebsiteRequest) => (sheetQuery.data ? buildInstructions(sheetQuery.data, methodIds, approveNote, row, requestLang(row)) : '');
  // At least one payment method, or a note telling the guest how to pay.
  const instructionsValid = (row: WebsiteRequest) => (methodIds.length > 0 || approveNote.trim().length > 0) && instructionsFor(row).length >= 10;
  const [message, setMessage] = useState<{ id: string; text: string; error: boolean } | null>(null);
  // keepPreviousData: a new search must not swap the page (and the focused search field) for the loader.
  const query = useQuery({ queryKey: ['website-requests', status, page, debouncedSearch], queryFn: () => fetchWebsiteRequests(status, page, debouncedSearch), refetchInterval: 30000, placeholderData: keepPreviousData });
  const pending = useQuery({ queryKey: ['website-requests', 'pending-count'], queryFn: fetchPendingWebsiteRequests, refetchInterval: 60000 });
  const approving = editing?.action === 'approve' ? editing.id : null;
  const roomQuery = useQuery({ queryKey: ['website-requests', 'rooms', approving], queryFn: () => fetchRoomOptions(approving!), enabled: !!approving, refetchInterval: 30000 });
  const roomsValid = !!roomQuery.data?.length && roomQuery.data.every(line => picked(line, roomIds) === line.quantity);
  const mutation = useMutation({
    mutationFn: processWebsiteRequest,
    onSuccess: async (_data, input) => {
      setEditing(null); setMessage({ id: input.id, text: t('websiteRequests.success'), error: false });
      await Promise.all(['website-requests', 'bookings', 'rooms', 'invoices'].map(key => qc.invalidateQueries({ queryKey: [key] })));
    },
    onError: async (err, input) => {
      setMessage({ id: input.id, text: getApiErrorMessage(err, t('websiteRequests.error')), error: true });
      // A room may have been taken meanwhile: show the fresh state and drop rooms no longer free.
      if (input.action === 'approve') {
        const lines = await qc.fetchQuery({ queryKey: ['website-requests', 'rooms', input.id], queryFn: () => fetchRoomOptions(input.id) });
        const free = new Set(lines.flatMap(line => line.rooms.filter(room => room.state === 'free').map(room => room.id)));
        setRoomIds(ids => ids.filter(id => free.has(id)));
      }
    },
  });
  const open = (row: WebsiteRequest, action: Action) => {
    setEditing({ id: row.id, action }); setText(''); setHours(24); setRoomIds([]); setMessage(null); setApproveNote('');
    setMethodIds(sheetQuery.data?.methods.filter(m => m.defaultSelected).map(m => m.id) ?? []);
  };
  const toggleMethod = (id: string) => setMethodIds(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]));
  const openProof = async (requestId: string, proof: ProofMeta) => {
    // Open the tab synchronously (popup blockers), then point it at the downloaded file.
    const tab = window.open('', '_blank');
    try {
      const url = URL.createObjectURL(await fetchProof(requestId, proof.id));
      if (tab) tab.location.href = url; else window.location.assign(url);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      tab?.close();
      setMessage({ id: requestId, text: getApiErrorMessage(err, t('websiteRequests.proofError')), error: true });
    }
  };
  const toggleRoom = (id: string) => setRoomIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  const filter = (value: RequestStatus | '') => { setStatus(value); setPage(1); setEditing(null); setMessage(null); };

  const remaining = (iso: string) => {
    const minutes = Math.floor((new Date(iso).getTime() - now.getTime()) / 60000);
    if (minutes <= 0) return null;
    const h = Math.floor(minutes / 60);
    return h >= 24 ? t('websiteRequests.leftDays', { days: Math.floor(h / 24), hours: h % 24 }) : h ? t('websiteRequests.leftHours', { hours: h, minutes: minutes % 60 }) : t('websiteRequests.leftMinutes', { minutes });
  };

  if (query.isLoading) return <PageLoader />;
  if (query.isError) return <PageError />;
  const total = query.data?.total ?? 0;
  const pendingCount = pending.data?.pending ?? 0;
  const proofCount = pending.data?.proofs ?? 0;

  const card = (row: WebsiteRequest) => {
    const nights = nightsBetween(row.arrival, row.departure);
    const left = row.expiresAt ? remaining(row.expiresAt) : null;
    const urgent = row.status === 'AWAITING_PAYMENT' && row.expiresAt && new Date(row.expiresAt).getTime() - now.getTime() < 3 * 3600000;
    const canDecide = row.status === 'PENDING' && can('bookings.update_status');
    const canConfirm = row.status === 'AWAITING_PAYMENT' && can('bookings.update_status') && can('invoices.record_payment');
    const feedback = message?.id === row.id ? message : null;
    return <article key={row.id} className={cn('rounded-2xl border border-stone-200 border-l-4 bg-white', accent[row.status])}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-on-surface">{row.name}</h3>
            <span className={cn('rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest', statusTone[row.status])}>{t(`websiteRequests.${row.status}`)}</span>
          </div>
          <p className="mt-1 text-xs text-on-surface-variant/60">
            {t('websiteRequests.receivedAt', { date: formatDateTime(row.createdAt) })} · <span className="font-mono font-semibold text-on-surface" title={row.reference}>{row.reference.length > 12 ? row.reference.slice(0, 11) : row.reference}</span>
          </p>
        </div>
        <p className="text-sm text-on-surface-variant"><span className="font-semibold text-on-surface">{t(row.status === 'AWAITING_PAYMENT' && row.proofs.length ? 'websiteRequests.next_PROOF' : `websiteRequests.next_${row.status}`)}</span></p>
      </header>

      <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Section icon={CalendarDays} title={t('websiteRequests.stay')}>
          <p className="font-semibold">{formatDate(row.arrival)} → {formatDate(row.departure)}</p>
          <p className="text-on-surface-variant">{t('websiteRequests.nights', { count: nights })} · {t('websiteRequests.guests', { count: row.guests })}</p>
        </Section>
        <Section icon={BedDouble} title={t('websiteRequests.rooms')}>
          {row.lines.map(line => {
            const availability = row.availability?.find(a => a.roomTypeId === line.roomTypeId);
            return <div key={line.roomTypeId}>
              <p><span className="font-semibold">{line.quantity} ×</span> {line.name} <span className="text-on-surface-variant">· {t('websiteRequests.perNight', { price: formatCurrency(line.unitPrice) })}</span></p>
              {availability && <p className={cn('text-xs font-semibold', availability.free >= availability.requested ? 'text-emerald-700' : 'text-red-700')}>
                {availability.free >= availability.requested ? t('websiteRequests.freeRooms', { count: availability.free }) : t('websiteRequests.notEnoughFree', { count: availability.free })}
              </p>}
            </div>;
          })}
        </Section>
        <Section icon={FileText} title={t('websiteRequests.amounts')}>
          <p className="flex justify-between gap-3"><span className="text-on-surface-variant">{t('websiteRequests.total')}</span><span className="font-semibold">{formatCurrency(row.totalAmount)}</span></p>
          <p className="flex justify-between gap-3"><span className="text-on-surface-variant">{t('websiteRequests.deposit')}</span><span className="font-semibold">{formatCurrency(row.depositAmount)}</span></p>
        </Section>
        <Section icon={Mail} title={t('websiteRequests.contact')}>
          <a className="flex items-center gap-1.5 break-all hover:text-primary" href={`mailto:${row.email}`}><Mail className="h-3.5 w-3.5 shrink-0 text-on-surface-variant/50" />{row.email}</a>
          <a className="flex items-center gap-1.5 hover:text-primary" href={`tel:${row.phone}`}><Phone className="h-3.5 w-3.5 shrink-0 text-on-surface-variant/50" />{row.phone}</a>
        </Section>
      </div>

      <div className="space-y-3 px-5 pb-5 empty:hidden">
        {row.emails.length > 0 && <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{t('websiteRequests.emailUndelivered', { status: t(`websiteRequests.${row.emails[0].status}`), attempts: row.emails[0].attempts })}</p>}
        {row.notes && <div className="rounded-xl bg-stone-50 p-3">
          <p className={cn(label, 'mb-1 flex items-center gap-1.5')}><MessageSquare className="h-3.5 w-3.5" />{t('websiteRequests.clientMessage')}</p>
          <p className="whitespace-pre-wrap text-sm">{row.notes}</p>
        </div>}
        {row.status === 'AWAITING_PAYMENT' && <div className={cn('rounded-xl border p-3', urgent ? 'border-amber-300 bg-amber-50' : 'border-sky-200 bg-sky-50/60')}>
          {row.expiresAt && <p className="flex items-center gap-2 text-sm font-semibold"><Clock className="h-4 w-4" />{t('websiteRequests.payBefore', { date: formatDateTime(row.expiresAt) })}{left && <span className={cn('font-normal', urgent ? 'text-amber-800' : 'text-on-surface-variant')}>· {left}</span>}</p>}
          <p className="mt-2 text-sm text-on-surface-variant">{t('websiteRequests.paymentHelp')}</p>
          <details className="mt-2 text-sm"><summary className="cursor-pointer text-on-surface-variant hover:text-primary">{t('websiteRequests.instructionsSent')}</summary><p className="mt-2 whitespace-pre-wrap">{row.paymentInstructions}</p></details>
        </div>}
        {row.proofs.length > 0 && <div className={cn('rounded-xl border p-3', row.status === 'AWAITING_PAYMENT' ? 'border-emerald-200 bg-emerald-50/60' : 'border-stone-200 bg-stone-50')}>
          <p className={cn(label, 'mb-2 flex items-center gap-1.5')}><Paperclip className="h-3.5 w-3.5" />{t('websiteRequests.proofsTitle', { count: row.proofs.length })}</p>
          <ul className="space-y-2">{row.proofs.map(proof => <li key={proof.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="min-w-0"><span className="break-all font-semibold">{proof.fileName}</span> <span className="text-xs text-on-surface-variant">{t('websiteRequests.proofMeta', { size: Math.max(1, Math.round(proof.size / 1024)), date: formatDateTime(proof.createdAt) })}</span>{proof.note && <span className="block text-xs text-on-surface-variant">« {proof.note} »</span>}</span>
            <button type="button" className={secondary} onClick={() => { void openProof(row.id, proof); }}><ExternalLink className="h-4 w-4" />{t('websiteRequests.proofOpen')}</button>
          </li>)}</ul>
          {row.status === 'AWAITING_PAYMENT' && <p className="mt-2 text-xs text-on-surface-variant">{t('websiteRequests.proofHelp')}</p>}
        </div>}
        {row.decisionNote && <div className="rounded-xl bg-stone-50 p-3">
          <p className={cn(label, 'mb-1')}>{t(row.status === 'REJECTED' ? 'websiteRequests.rejectReason' : 'websiteRequests.note')}</p>
          <p className="whitespace-pre-wrap text-sm">{row.decisionNote}</p>
        </div>}
        {feedback && <p role="status" className={cn('rounded-xl p-3 text-sm', feedback.error ? 'bg-red-50 text-red-900' : 'bg-emerald-50 text-emerald-900')}>{feedback.text}</p>}
      </div>

      {(canDecide || canConfirm || row.booking) && <footer className="flex flex-wrap items-center gap-2 border-t border-stone-100 bg-stone-50/50 px-5 py-3">
        {canDecide && can('bookings.create') && <button className={primary} disabled={mutation.isPending} onClick={() => open(row, 'approve')}>{t('websiteRequests.approve')}</button>}
        {canDecide && <button className={danger} disabled={mutation.isPending} onClick={() => open(row, 'reject')}>{t('websiteRequests.reject')}</button>}
        {canConfirm && <button className={secondary} disabled={mutation.isPending} onClick={() => open(row, 'confirm')}>{t('websiteRequests.confirm')}</button>}
        {row.booking && <div className="ml-auto flex flex-wrap gap-2">
          {can('invoices.view') && <Link className={row.status === 'AWAITING_PAYMENT' ? primary : secondary} to={`/invoices/${row.booking.id}`}><FileText className="h-4 w-4" />{t('websiteRequests.invoice')}</Link>}
          <Link className={secondary} to={`/reservations/${row.booking.id}`}><ExternalLink className="h-4 w-4" />{t('websiteRequests.booking')}</Link>
        </div>}
      </footer>}

      {editing?.id === row.id && <form className="space-y-4 border-t border-stone-200 p-5" onSubmit={e => { e.preventDefault(); if (editing.action === 'approve' && !(roomsValid && instructionsValid(row))) return; mutation.mutate({ ...editing, ...(editing.action === 'approve' ? { paymentInstructions: instructionsFor(row), hours, roomIds } : editing.action === 'reject' ? { reason: text } : {}) }); }}>
        <p className="font-semibold">{t(`websiteRequests.${editing.action}`)}</p>
        {editing.action === 'approve' && <div className="space-y-3">
          <p className="text-sm text-on-surface-variant">{t('websiteRequests.approveHelp')}</p>
          {roomQuery.isLoading ? <p className="text-sm text-on-surface-variant">{t('websiteRequests.loadingRooms')}</p>
            : roomQuery.isError ? <p className="text-sm text-red-700">{t('websiteRequests.roomsError')}</p>
            : roomQuery.data && <RoomPicker lines={roomQuery.data} selected={roomIds} onToggle={toggleRoom} disabled={mutation.isPending} />}
        </div>}
        {editing.action === 'confirm' && <p className="text-sm text-on-surface-variant">{t('websiteRequests.confirmHelp')}</p>}
        {editing.action === 'reject' && <label className="block text-sm">{t('websiteRequests.reason')}<textarea className={field} rows={4} required minLength={3} maxLength={1000} value={text} onChange={e => setText(e.target.value)} disabled={mutation.isPending} /></label>}
        {editing.action === 'approve' && <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{t('websiteRequests.instructions')} <span className="ml-1 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{t(`websiteRequests.lang_${requestLang(row)}`)}</span></p>
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => setShowSheet(true)}>{t('websiteRequests.sheetOpen')}</button>
          </div>
          {!sheetQuery.data?.methods.length && <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{t('websiteRequests.sheetMissing')}</p>}
          {!!sheetQuery.data?.methods.length && <div className="flex flex-wrap gap-2">{sheetQuery.data.methods.map(m => <label key={m.id} className={cn('inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm', methodIds.includes(m.id) ? 'border-primary bg-teal-50' : 'border-stone-200 bg-white')}>
            <input type="checkbox" checked={methodIds.includes(m.id)} onChange={() => toggleMethod(m.id)} disabled={mutation.isPending} /><span><span className="font-semibold">{m.label}</span> <span className="text-on-surface-variant">{m.account}</span></span>
          </label>)}</div>}
          <label className="block text-sm">{t('websiteRequests.approveNote')} <span className="text-on-surface-variant">{t('websiteRequests.optional')}</span><textarea className={field} rows={2} maxLength={500} value={approveNote} onChange={e => setApproveNote(e.target.value)} disabled={mutation.isPending} /></label>
          <div><p className={cn(label, 'mb-1')}>{t('websiteRequests.instructionsPreview')}</p><p className="whitespace-pre-wrap rounded-xl bg-stone-50 p-3 text-sm">{instructionsFor(row)}</p></div>
          {!instructionsValid(row) && <p className="text-xs text-amber-800">{t('websiteRequests.instructionsNeedMethod')}</p>}
        </div>}
        {editing.action === 'approve' && <label className="block max-w-xs text-sm">{t('websiteRequests.hours')}<input className={field} type="number" min={1} max={72} required value={hours} onChange={e => setHours(Number(e.target.value))} disabled={mutation.isPending} /></label>}
        <div className="flex flex-wrap gap-2">
          <button className={editing.action === 'reject' ? danger : primary} disabled={mutation.isPending || (editing.action === 'approve' && !(roomsValid && instructionsValid(row)))}>{t('websiteRequests.save')}</button>
          <button type="button" className={secondary} disabled={mutation.isPending} onClick={() => setEditing(null)}>{t('websiteRequests.cancel')}</button>
        </div>
      </form>}
    </article>;
  };

  return <div className="space-y-8">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h2 className="font-display text-3xl italic leading-none text-primary md:text-4xl">{t('websiteRequests.title')}</h2>
        <p className="mt-2 text-sm text-on-surface-variant/60">{t('websiteRequests.subtitle')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
      <button className={secondary} aria-expanded={showSheet} onClick={() => setShowSheet(v => !v)}><PenLine className="h-4 w-4" />{t('websiteRequests.sheetTitle')}</button>
      <button className={secondary} disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw className={cn('h-4 w-4', query.isFetching && 'animate-spin')} />{t('websiteRequests.refresh')}</button>
      </div>
    </div>

    {showSheet && sheetQuery.data && <PaymentSheetEditor sheet={sheetQuery.data} canEdit={canEditSheet} onClose={() => setShowSheet(false)} />}

    <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('websiteRequests.all')}>
      {(['', ...statuses] as (RequestStatus | '')[]).map(value => (
        <button key={value || 'all'} role="tab" aria-selected={status === value} onClick={() => filter(value)}
          className={cn('inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all',
            status === value ? 'border-primary bg-primary text-white shadow-sm' : 'border-stone-200 bg-white text-on-surface-variant hover:border-primary/30')}>
          {value ? t(`websiteRequests.${value}`) : t('websiteRequests.all')}
          {value === 'AWAITING_PAYMENT' && proofCount > 0 && <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', status === value ? 'bg-white/20' : 'bg-emerald-100 text-emerald-900')} title={t('websiteRequests.proofsToCheck', { count: proofCount })}>{proofCount}</span>}
          {value === 'PENDING' && pendingCount > 0 && <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', status === value ? 'bg-white/20' : 'bg-amber-100 text-amber-900')}>{pendingCount}</span>}
        </button>
      ))}
    </div>

    <div className="relative max-w-sm">
      <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
      <input type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(1); setEditing(null); }} placeholder={t('websiteRequests.searchName')} aria-label={t('websiteRequests.searchName')} maxLength={80}
        className="w-full rounded-2xl border border-stone-200 bg-white py-3 pl-11 pr-10 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 [&::-webkit-search-cancel-button]:hidden" />
      {search && <button type="button" onClick={() => { setSearch(''); setPage(1); }} aria-label={t('websiteRequests.clearSearch')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-stone-100"><X className="h-3.5 w-3.5 text-on-surface-variant/50" /></button>}
    </div>

    {!query.data?.data.length
      ? <div className="rounded-3xl border border-stone-200 bg-white p-16 text-center">
          <Globe className="mx-auto mb-4 h-10 w-10 stroke-1 text-on-surface-variant/20" />
          <p className="text-sm font-medium text-on-surface-variant/50">{debouncedSearch ? t('websiteRequests.noMatch', { search: debouncedSearch }) : t('websiteRequests.empty')}</p>
        </div>
      : <div className={cn('space-y-4 transition-opacity', query.isPlaceholderData && 'opacity-60')}>{query.data.data.map(card)}</div>}

    {total > 20 && <div className="flex items-center justify-center gap-3">
      <button className={secondary} disabled={page === 1} onClick={() => { setPage(page - 1); setEditing(null); }}>{t('websiteRequests.previous')}</button>
      <span className="text-xs font-bold text-on-surface-variant/50">{t('websiteRequests.page', { page, total })}</span>
      <button className={secondary} disabled={page * 20 >= total} onClick={() => { setPage(page + 1); setEditing(null); }}>{t('websiteRequests.next')}</button>
    </div>}
  </div>;
};
