import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { PaymentMethod, PaymentSheet, PaymentSheetView, savePaymentSheet } from '../api/websiteRequests';
import { buildInstructions, InstructionsLang } from '../lib/paymentInstructions';
import { formatDateTime } from '../lib/format';
import { getApiErrorMessage } from '../lib/apiError';
import { cn } from '../lib/utils';

const input = 'block w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 read-only:bg-stone-50';
const small = 'text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50';
const SAMPLE = { depositAmount: 280000, reference: 'NL-6835A26E-304E-4D1B-8AF5-B487E9D0AAEB' };
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const toSheet = (view: PaymentSheetView): PaymentSheet => ({ methods: view.methods, whatsapp: view.whatsapp, noteFr: view.noteFr, noteEn: view.noteEn });

export const PaymentSheetEditor: React.FC<{ sheet: PaymentSheetView; canEdit: boolean; onClose: () => void }> = ({ sheet, canEdit, onClose }) => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<PaymentSheet>(() => toSheet(sheet));
  const [preview, setPreview] = useState<InstructionsLang>('fr');
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  useEffect(() => { setDraft(toSheet(sheet)); }, [sheet]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(toSheet(sheet));
  const save = useMutation({
    mutationFn: savePaymentSheet,
    onSuccess: data => { qc.setQueryData(['website-requests', 'payment-sheet'], data); setFeedback({ text: t('websiteRequests.sheetSaved'), error: false }); },
    onError: err => setFeedback({ text: getApiErrorMessage(err, t('websiteRequests.error')), error: true }),
  });
  const edit = (patch: Partial<PaymentSheet>) => { setDraft(d => ({ ...d, ...patch })); setFeedback(null); };
  const editMethod = (id: string, patch: Partial<PaymentMethod>) => edit({ methods: draft.methods.map(m => (m.id === id ? { ...m, ...patch } : m)) });
  const complete = draft.methods.every(m => m.label.trim() && m.account.trim());

  return <section className="space-y-5 rounded-2xl border border-stone-200 bg-white p-5">
    <div>
      <h3 className="text-lg font-semibold">{t('websiteRequests.sheetTitle')}</h3>
      <p className="mt-1 text-sm text-on-surface-variant">{t('websiteRequests.sheetHelp')}</p>
      {sheet.updatedAt && <p className="mt-1 text-xs text-on-surface-variant/60">{t('websiteRequests.sheetUpdated', { date: formatDateTime(sheet.updatedAt), name: sheet.updatedBy ?? '—' })}</p>}
    </div>

    <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
      <div className="space-y-4">
        <div className="space-y-3">
          <p className={small}>{t('websiteRequests.sheetMethods')}</p>
          {!draft.methods.length && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t('websiteRequests.sheetEmpty')}</p>}
          {draft.methods.map(method => <div key={method.id} className="grid gap-2 rounded-xl border border-stone-200 p-3 sm:grid-cols-[1fr_1.4fr_1.4fr_auto]">
            <label className="text-xs text-on-surface-variant">{t('websiteRequests.sheetLabel')}<input className={input} value={method.label} readOnly={!canEdit} maxLength={40} placeholder="MVola" onChange={e => editMethod(method.id, { label: e.target.value })} /></label>
            <label className="text-xs text-on-surface-variant">{t('websiteRequests.sheetAccount')}<input className={input} value={method.account} readOnly={!canEdit} maxLength={120} placeholder="034 12 345 67" onChange={e => editMethod(method.id, { account: e.target.value })} /></label>
            <label className="text-xs text-on-surface-variant">{t('websiteRequests.sheetHolder')}<input className={input} value={method.holder} readOnly={!canEdit} maxLength={80} placeholder="Natura Lodge" onChange={e => editMethod(method.id, { holder: e.target.value })} /></label>
            {canEdit && <button type="button" onClick={() => edit({ methods: draft.methods.filter(m => m.id !== method.id) })} aria-label={t('websiteRequests.sheetRemove')} title={t('websiteRequests.sheetRemove')}
              className="self-end rounded-xl border border-stone-200 p-2 text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>}
            <label className="flex items-center gap-2 text-xs text-on-surface-variant sm:col-span-4">
              <input type="checkbox" checked={method.defaultSelected} disabled={!canEdit} onChange={e => editMethod(method.id, { defaultSelected: e.target.checked })} />{t('websiteRequests.sheetDefault')}
            </label>
          </div>)}
          {canEdit && draft.methods.length < 8 && <button type="button" onClick={() => edit({ methods: [...draft.methods, { id: newId(), label: '', account: '', holder: '', defaultSelected: true }] })}
            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-stone-300 px-4 py-2 text-sm text-on-surface-variant hover:border-primary/40 hover:text-primary"><Plus className="h-4 w-4" />{t('websiteRequests.sheetAdd')}</button>}
        </div>
        <label className="block max-w-xs text-xs text-on-surface-variant">{t('websiteRequests.sheetWhatsapp')}<input className={input} value={draft.whatsapp} readOnly={!canEdit} maxLength={30} placeholder="+261 32 37 634 99" onChange={e => edit({ whatsapp: e.target.value })} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-on-surface-variant">{t('websiteRequests.sheetNoteFr')}<textarea className={input} rows={3} value={draft.noteFr} readOnly={!canEdit} maxLength={500} onChange={e => edit({ noteFr: e.target.value })} /></label>
          <label className="block text-xs text-on-surface-variant">{t('websiteRequests.sheetNoteEn')}<textarea className={input} rows={3} value={draft.noteEn} readOnly={!canEdit} maxLength={500} onChange={e => edit({ noteEn: e.target.value })} /></label>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className={small}>{t('websiteRequests.sheetPreview')}</p>
          <div className="flex gap-1 rounded-lg border border-stone-200 p-0.5">
            {(['fr', 'en'] as InstructionsLang[]).map(lang => <button key={lang} type="button" onClick={() => setPreview(lang)}
              className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold uppercase', preview === lang ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-stone-100')}>{lang}</button>)}
          </div>
        </div>
        <p className="whitespace-pre-wrap rounded-xl bg-stone-50 p-3 text-sm">{buildInstructions(draft, draft.methods.filter(m => m.defaultSelected).map(m => m.id), '', SAMPLE, preview)}</p>
      </div>
    </div>

    {feedback && <p role="status" className={cn('rounded-xl p-3 text-sm', feedback.error ? 'bg-red-50 text-red-900' : 'bg-emerald-50 text-emerald-900')}>{feedback.text}</p>}
    <div className="flex flex-wrap gap-2">
      {canEdit && <button type="button" disabled={!dirty || !complete || save.isPending} onClick={() => save.mutate(draft)}
        className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-40">{t('websiteRequests.sheetSave')}</button>}
      {canEdit && dirty && <button type="button" onClick={() => { setDraft(toSheet(sheet)); setFeedback(null); }} className="rounded-xl border border-stone-200 px-4 py-2 text-sm hover:bg-stone-50">{t('websiteRequests.sheetReset')}</button>}
      <button type="button" onClick={onClose} className="rounded-xl border border-stone-200 px-4 py-2 text-sm hover:bg-stone-50">{t('websiteRequests.sheetClose')}</button>
      {canEdit && !complete && <p className="self-center text-xs text-amber-800">{t('websiteRequests.sheetIncomplete')}</p>}
    </div>
  </section>;
};
