import React, { useState } from 'react';
import { ArrowLeft, Plus, Pencil, Trash2, AlertCircle, Home } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { RoomType } from '../types';
import { useRoomTypes, useCreateRoomType, useUpdateRoomType, useDeleteRoomType } from '../hooks/useRoomTypes';
import { useRoomFeatures } from '../hooks/useRooms';
import { PageLoader, PageError } from '../components/QueryLoader';
import { ConfirmModal } from '../components/ConfirmModal';
import { getApiErrorMessage } from '../lib/apiError';
import { formatCurrency } from '../lib/format';

const BED_TYPES = ['King Size', 'Super King', 'Twin Signature', 'Double'];
const VIEWS     = ['Garden View', 'Ocean View', 'Valley View', 'Pool View', 'Mountain View', 'Courtyard'];

interface FormState {
  name: string; rate: string; description: string; area: string;
  bedType: string; capacity: string; view: string; selectedFeatures: string[];
}

const DEFAULT_FORM: FormState = {
  name: '', rate: '', description: '', area: '', bedType: 'King Size', capacity: '2', view: 'Garden View', selectedFeatures: [],
};

export const RoomTypes: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: roomTypes = [], isLoading, isError } = useRoomTypes();
  const { data: features  = [] } = useRoomFeatures();
  const createRoomType = useCreateRoomType();
  const updateRoomType = useUpdateRoomType();
  const deleteRoomType = useDeleteRoomType();

  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [form,          setForm]          = useState<FormState>(DEFAULT_FORM);
  const [apiError,      setApiError]      = useState('');
  const [deleteTarget,  setDeleteTarget]  = useState<RoomType | null>(null);
  const [deleteError,   setDeleteError]   = useState('');

  const isFormOpen = isCreatingNew || !!editingId;

  const openCreate = () => { setEditingId(null); setIsCreatingNew(true); setForm(DEFAULT_FORM); setApiError(''); };

  const openEdit = (rt: RoomType) => {
    setIsCreatingNew(false);
    setEditingId(rt.id);
    setApiError('');
    setForm({
      name: rt.name, rate: String(rt.rate), description: rt.description,
      area: String(rt.area), bedType: rt.bedType, capacity: String(rt.capacity),
      view: rt.view, selectedFeatures: rt.features.map(f => f.id),
    });
  };

  const closeForm = () => { setIsCreatingNew(false); setEditingId(null); setForm(DEFAULT_FORM); setApiError(''); };

  const toggleFeature = (id: string) =>
    setForm(p => ({
      ...p,
      selectedFeatures: p.selectedFeatures.includes(id)
        ? p.selectedFeatures.filter(f => f !== id)
        : [...p.selectedFeatures, id],
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');
    const payload = {
      name:        form.name,
      rate:        Number(form.rate),
      description: form.description,
      area:        Number(form.area) || 30,
      bedType:     form.bedType,
      capacity:    Number(form.capacity) || 2,
      view:        form.view,
      featureIds:  form.selectedFeatures,
    };
    try {
      if (editingId) {
        await updateRoomType.mutateAsync({ id: editingId, ...payload });
      } else {
        await createRoomType.mutateAsync(payload);
      }
      closeForm();
    } catch (err) {
      setApiError(getApiErrorMessage(err, editingId ? t('roomTypes.updateError') : t('roomTypes.createError')));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError('');
    try {
      await deleteRoomType.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(getApiErrorMessage(err, t('roomTypes.deleteError')));
    }
  };

  const isSaving = createRoomType.isPending || updateRoomType.isPending;

  const field    = 'w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all';
  const labelCls = 'text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5';

  if (isLoading) return <PageLoader />;
  if (isError)   return <PageError />;

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/rooms')}
          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full border border-stone-200 bg-white hover:bg-stone-50 transition-colors">
          <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
        </button>
        <div>
          <h2 className="font-display italic text-2xl md:text-3xl text-on-surface leading-none">{t('roomTypes.title')}</h2>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mt-2">
            {t('roomTypes.subtitle', { count: roomTypes.length })}
          </p>
        </div>
      </div>

      {apiError && !isFormOpen && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="text-xs font-medium">{apiError}</p>
        </div>
      )}
      {deleteError && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="text-xs font-medium">{deleteError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ── List ── */}
        <div className="lg:col-span-2 space-y-4">
          {roomTypes.length === 0 ? (
            <div className="py-24 flex flex-col items-center text-on-surface-variant/30">
              <Home className="w-10 h-10 mb-3 opacity-30" />
              <p className="font-display italic text-xl">{t('roomTypes.empty')}</p>
            </div>
          ) : roomTypes.map(rt => (
            <div key={rt.id}
              className={cn('bg-white rounded-3xl border p-6 organic-shadow transition-all',
                editingId === rt.id ? 'border-primary/40' : 'border-stone-200/60')}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-display italic text-xl text-on-surface">{rt.name}</h3>
                  <p className="text-[10px] font-mono text-on-surface-variant/40 uppercase tracking-widest mt-1">
                    {rt.capacity} {t('common.guests_count')} · {rt.area}m² · {rt.bedType} · {rt.view}
                  </p>
                  <p className="text-[10px] text-on-surface-variant/40 mt-1">
                    {t('roomTypes.roomsCount', { count: rt.rooms.length })}
                  </p>
                  {rt.description && (
                    <p className="text-xs text-on-surface-variant/60 mt-2 leading-relaxed max-w-md">{rt.description}</p>
                  )}
                  {rt.features.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {rt.features.map(f => (
                        <span key={f.id}
                          className="px-2 py-0.5 rounded-full bg-stone-100 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                          {f.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-3">
                  <p className="text-lg font-display italic text-primary">
                    {formatCurrency(rt.rate)}<span className="text-[10px] text-on-surface-variant/40 font-sans">{t('bookingDetail.perNight')}</span>
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(rt)}
                      className="p-2 text-on-surface-variant/40 hover:text-primary transition-colors" title={t('common.edit')}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setDeleteTarget(rt); setDeleteError(''); }}
                      className="p-2 text-on-surface-variant/40 hover:text-red-500 transition-colors" title={t('common.delete')}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Add / edit panel ── */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-6">
            {isFormOpen ? (
              <motion.form onSubmit={handleSubmit} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl border border-primary/10 organic-shadow p-6 space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                  {editingId ? t('roomTypes.editType') : t('roomTypes.newType')}
                </p>

                {apiError && (
                  <div className="flex items-center gap-2 text-red-500 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />{apiError}
                  </div>
                )}

                <div>
                  <label className={labelCls}>{t('rooms.typeName')}</label>
                  <input type="text" required autoFocus value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={field} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>{t('rooms.nightlyRate')}</label>
                    <input type="number" min={1} required value={form.rate}
                      onChange={e => setForm(p => ({ ...p, rate: e.target.value }))} className={field} />
                  </div>
                  <div>
                    <label className={labelCls}>{t('rooms.capacity')}</label>
                    <input type="number" min={1} max={20} value={form.capacity}
                      onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))} className={field} />
                  </div>
                  <div>
                    <label className={labelCls}>{t('rooms.surface')} (m²)</label>
                    <input type="number" min={1} value={form.area}
                      onChange={e => setForm(p => ({ ...p, area: e.target.value }))} className={field} />
                  </div>
                  <div>
                    <label className={labelCls}>{t('rooms.bedding')}</label>
                    <select value={form.bedType} onChange={e => setForm(p => ({ ...p, bedType: e.target.value }))}
                      className={field + ' appearance-none'}>
                      {BED_TYPES.map(b => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>{t('rooms.view')}</label>
                    <select value={form.view} onChange={e => setForm(p => ({ ...p, view: e.target.value }))}
                      className={field + ' appearance-none'}>
                      {VIEWS.map(v => <option key={v}>{v}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>{t('rooms.features')}</label>
                  <div className="flex flex-wrap gap-2">
                    {features.map(f => (
                      <button key={f.id} type="button" onClick={() => toggleFeature(f.id)}
                        className={cn('px-3 py-1.5 rounded-full border text-[9px] font-bold uppercase tracking-widest transition-all',
                          form.selectedFeatures.includes(f.id) ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant/60 border-stone-200 hover:border-stone-400')}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>{t('rooms.description')}</label>
                  <textarea rows={3} value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none focus:border-primary transition-all resize-none" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={closeForm}
                    className="flex-1 py-3 bg-stone-100 text-on-surface-variant rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-stone-200 transition-all">
                    {t('common.cancel')}
                  </button>
                  <button type="submit" disabled={isSaving}
                    className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-primary-container disabled:opacity-40 transition-all">
                    {isSaving ? t('common.saving') : t('common.save')}
                  </button>
                </div>
              </motion.form>
            ) : (
              <button onClick={openCreate}
                className="w-full min-h-[200px] py-4 border-2 border-dashed border-stone-200 rounded-3xl flex flex-col items-center justify-center gap-3 text-on-surface-variant/60 hover:border-primary/40 hover:text-primary transition-all group">
                <Plus className="w-6 h-6 group-hover:scale-125 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-widest">{t('roomTypes.newType')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('roomTypes.deleteConfirmTitle')}
        message={t('roomTypes.deleteConfirmMessage')}
        isPending={deleteRoomType.isPending}
      />
    </div>
  );
};
