import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useRoomFeatures, useCreateRoom } from '../hooks/useRooms';
import { useRoomTypes, useCreateRoomType } from '../hooks/useRoomTypes';
import { RoomType } from '../types';
import { useTranslation } from 'react-i18next';
import { getApiErrorMessage } from '../lib/apiError';
import { formatCurrency } from '../lib/format';
import { RoomImagePicker, PRESET_PHOTOS } from './RoomImagePicker';
import { Modal } from './Modal';

const BED_TYPES  = ['King Size', 'Super King', 'Twin Signature', 'Double'];
const VIEWS      = ['Garden View', 'Ocean View', 'Valley View', 'Pool View', 'Mountain View', 'Courtyard'];

interface AddRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomAdded?: () => void;
}

export const AddRoomModal: React.FC<AddRoomModalProps> = ({ isOpen, onClose, onRoomAdded }) => {
  const { t } = useTranslation();
  const { data: roomTypes = [] } = useRoomTypes();
  const { data: features  = [] } = useRoomFeatures();
  const createRoom     = useCreateRoom();
  const createRoomType = useCreateRoomType();

  // Step 1: type selection
  const [step,           setStep]           = useState<'type' | 'room'>('type');
  const [selectedType,   setSelectedType]   = useState<RoomType | null>(null);
  const [creatingNew,    setCreatingNew]     = useState(false);

  // New type form
  const [newType, setNewType] = useState({
    name: '',
    rate: '', description: '', area: '', bedType: 'King Size',
    capacity: '2', view: 'Garden View',
    selectedFeatures: [] as string[],
  });

  // Step 2: room form
  const [number,       setNumber]       = useState('');
  const [rateOverride, setRateOverride] = useState('');
  const [images,       setImages]       = useState<string[]>([]);
  const [apiError,     setApiError]     = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep('type'); setSelectedType(null); setCreatingNew(false);
      setNewType({ name: '', rate: '', description: '', area: '', bedType: 'King Size', capacity: '2', view: 'Garden View', selectedFeatures: [] });
      setNumber(''); setRateOverride(''); setImages([]); setApiError('');
    }
  }, [isOpen]);

  const toggleFeature = (id: string) =>
    setNewType(p => ({ ...p, selectedFeatures: p.selectedFeatures.includes(id) ? p.selectedFeatures.filter(f => f !== id) : [...p.selectedFeatures, id] }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');
    try {
      let typeId = selectedType?.id ?? '';

      if (creatingNew) {
        const rt = await createRoomType.mutateAsync({
          name:        newType.name,
          rate:        Number(newType.rate),
          description: newType.description,
          area:        Number(newType.area) || 30,
          bedType:     newType.bedType,
          capacity:    Number(newType.capacity) || 2,
          view:        newType.view,
          featureIds:  newType.selectedFeatures,
        });
        typeId = rt.id;
      }

      await createRoom.mutateAsync({
        number,
        roomTypeId:   typeId,
        images:       images.length ? images : PRESET_PHOTOS[0].url ? [PRESET_PHOTOS[0].url] : [],
        rateOverride: rateOverride ? Number(rateOverride) : null,
      });

      onRoomAdded?.();
      onClose();
    } catch (err) {
      setApiError(getApiErrorMessage(err, t('common.error')));
    }
  };

  const field = 'w-full h-12 px-4 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all';
  const isPending = createRoom.isPending || createRoomType.isPending;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('rooms.unitRegistration')}
      className="max-w-3xl bg-stone-50 rounded-[2.5rem] shadow-2xl border border-white overflow-hidden flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-10 pt-8 pb-6 border-b border-stone-100">
              <div>
                <h3 className="font-display italic text-2xl text-on-surface">
                  {step === 'type' ? t('rooms.unitRegistration') : `${t('rooms.roomNumber')} — ${selectedType?.name ?? ''}`}
                </h3>
                <div className="flex gap-2 mt-2">
                  {(['type', 'room'] as const).map((s, i) => (
                    <div key={s} className={cn('h-1 w-16 rounded-full transition-all', step === s || (s === 'type' && step === 'room') ? 'bg-primary' : 'bg-stone-200')} />
                  ))}
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-on-surface-variant" />
              </button>
            </div>

            {apiError && (
              <div className="mx-10 mt-4 flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p className="text-xs font-medium">{apiError}</p>
              </div>
            )}

            <div className="flex-1 overflow-y-auto no-scrollbar px-10 py-6 max-h-[70vh]">

              {/* ── Step 1 : sélection du type ── */}
              {step === 'type' && (
                <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">

                  {/* Types existants */}
                  {!creatingNew && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">
                        {t('rooms.typeName')} existants ({roomTypes.length})
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {roomTypes.map(rt => (
                          <button key={rt.id} type="button"
                            onClick={() => setSelectedType(rt)}
                            className={cn(
                              'p-4 rounded-2xl border text-left transition-all',
                              selectedType?.id === rt.id
                                ? 'bg-teal-50 border-primary shadow-sm'
                                : 'bg-white border-stone-200 hover:border-stone-300',
                            )}>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-bold text-on-surface">{rt.name}</p>
                              {selectedType?.id === rt.id && <Check className="w-4 h-4 text-primary" />}
                            </div>
                            <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest">
                              {rt.capacity} pers. · {formatCurrency(rt.rate)}/n
                            </p>
                            <p className="text-[10px] text-on-surface-variant/40 mt-1">
                              {rt.rooms.length} chambre{rt.rooms.length !== 1 ? 's' : ''}
                            </p>
                          </button>
                        ))}
                        {/* Créer un nouveau type */}
                        <button type="button"
                          onClick={() => { setCreatingNew(true); setSelectedType(null); }}
                          className="p-4 rounded-2xl border-2 border-dashed border-stone-200 flex items-center gap-3 hover:border-primary/40 transition-all text-on-surface-variant/50 hover:text-primary">
                          <Plus className="w-5 h-5" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Nouveau type</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Formulaire nouveau type */}
                  {creatingNew && (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">Nouveau type de chambre</p>
                        <button type="button" onClick={() => setCreatingNew(false)}
                          className="text-[10px] font-bold text-on-surface-variant/40 hover:text-on-surface uppercase tracking-widest">
                          ← Choisir existant
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-2">{t('rooms.typeName')}</label>
                          <input type="text" placeholder="ex. Natura Suite" value={newType.name}
                            onChange={e => setNewType(p => ({ ...p, name: e.target.value }))} required={creatingNew} className={field} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-2">{t('rooms.nightlyRate')}</label>
                          <input type="number" placeholder="1 500 000" min={1} required={creatingNew} value={newType.rate}
                            onChange={e => setNewType(p => ({ ...p, rate: e.target.value }))} className={field} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-2">{t('rooms.capacity')}</label>
                          <input type="number" placeholder="2" min={1} max={20} value={newType.capacity}
                            onChange={e => setNewType(p => ({ ...p, capacity: e.target.value }))} className={field} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-2">{t('rooms.surface')} (m²)</label>
                          <input type="number" placeholder="45" min={1} value={newType.area}
                            onChange={e => setNewType(p => ({ ...p, area: e.target.value }))} className={field} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-2">{t('rooms.bedding')}</label>
                          <select value={newType.bedType} onChange={e => setNewType(p => ({ ...p, bedType: e.target.value }))}
                            className={field + ' appearance-none'}>
                            {BED_TYPES.map(b => <option key={b}>{b}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-2">{t('rooms.view')}</label>
                          <select value={newType.view} onChange={e => setNewType(p => ({ ...p, view: e.target.value }))}
                            className={field + ' appearance-none'}>
                            {VIEWS.map(v => <option key={v}>{v}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-2">{t('rooms.features')}</label>
                        <div className="flex flex-wrap gap-2">
                          {features.map(f => (
                            <button key={f.id} type="button" onClick={() => toggleFeature(f.id)}
                              className={cn('px-3 py-1.5 rounded-full border text-[9px] font-bold uppercase tracking-widest transition-all',
                                newType.selectedFeatures.includes(f.id) ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant/60 border-stone-200 hover:border-stone-400')}>
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-2">{t('rooms.description')}</label>
                        <textarea rows={2} value={newType.description}
                          onChange={e => setNewType(p => ({ ...p, description: e.target.value }))}
                          className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none focus:border-primary transition-all resize-none" />
                      </div>
                    </div>
                  )}

                  <button type="button"
                    disabled={!selectedType && !creatingNew}
                    onClick={() => setStep('room')}
                    className="w-full py-4 bg-primary text-white rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-primary-container disabled:opacity-40 transition-all shadow-lg shadow-primary/10">
                    Suivant — Numéro de chambre
                  </button>
                </motion.div>
              )}

              {/* ── Step 2 : numéro + photos ── */}
              {step === 'room' && (
                <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
                  <form onSubmit={handleSubmit} className="space-y-6">

                    {/* Type summary */}
                    {(selectedType || creatingNew) && (
                      <div className="flex items-center gap-3 p-4 bg-teal-50 border border-teal-100 rounded-2xl">
                        <div className="flex-1">
                          <p className="text-xs font-bold text-primary">{creatingNew ? newType.name : selectedType?.name}</p>
                          <p className="text-[10px] text-on-surface-variant/50 mt-0.5">
                            {formatCurrency(creatingNew ? Number(newType.rate) : selectedType?.rate ?? 0)}/n
                          </p>
                        </div>
                        <button type="button" onClick={() => setStep('type')}
                          className="text-[9px] font-bold text-primary/60 hover:text-primary uppercase tracking-widest">
                          Modifier
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-2">{t('rooms.roomNumber')} *</label>
                        <input type="text" placeholder="ex. 402" required value={number}
                          onChange={e => setNumber(e.target.value)}
                          className={field} />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-2">
                          Tarif spécifique (MGA) <span className="normal-case font-normal opacity-40">optionnel</span>
                        </label>
                        <input type="number" min={1}
                          placeholder={`Défaut : ${(creatingNew ? Number(newType.rate) : selectedType?.rate ?? 0).toLocaleString()}`}
                          value={rateOverride}
                          onChange={e => setRateOverride(e.target.value)}
                          className={field} />
                      </div>
                    </div>

                    {/* Image upload */}
                    <RoomImagePicker images={images} onChange={setImages} previewAlt={number} />

                    <div className="flex gap-4 pt-2">
                      <button type="button" onClick={() => { setStep('type'); setApiError(''); }}
                        className="px-8 py-4 bg-stone-100 text-on-surface-variant rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-stone-200 transition-all">
                        {t('common.back')}
                      </button>
                      <button type="submit" disabled={!number.trim() || isPending}
                        className="flex-1 py-4 bg-primary text-white rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-primary-container disabled:opacity-40 transition-all shadow-xl shadow-primary/20">
                        {isPending ? t('rooms.saving') : t('rooms.confirmUnitReg')}
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </div>
    </Modal>
  );
};
