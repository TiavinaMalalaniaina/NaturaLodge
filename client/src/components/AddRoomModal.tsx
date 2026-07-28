import React, { useState, useRef, useEffect } from 'react';
import { X, Star, ChevronDown, Check, Upload, Link, Trash2, AlertCircle, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useRoomFeatures, useCreateRoom } from '../hooks/useRooms';
import { useRoomTypes, useCreateRoomType } from '../hooks/useRoomTypes';
import { RoomType } from '../types';
import { useTranslation } from 'react-i18next';

const BED_TYPES  = ['King Size', 'Super King', 'Twin Signature', 'Double'];
const VIEWS      = ['Garden View', 'Ocean View', 'Valley View', 'Pool View', 'Mountain View', 'Courtyard'];

const PRESET_PHOTOS = [
  { url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80', label: 'Suite Classic' },
  { url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=600&q=80', label: 'Earthy Luxury' },
  { url: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80', label: 'Tropical Vista' },
  { url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=600&q=80', label: 'Cozy Organic' },
];

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
  const [imageUrl,     setImageUrl]     = useState('');
  const [isDragging,   setIsDragging]   = useState(false);
  const [apiError,     setApiError]     = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStep('type'); setSelectedType(null); setCreatingNew(false);
      setNewType({ name: '', rate: '', description: '', area: '', bedType: 'King Size', capacity: '2', view: 'Garden View', selectedFeatures: [] });
      setNumber(''); setRateOverride(''); setImages([]); setImageUrl(''); setApiError('');
    }
  }, [isOpen]);

  const toggleFeature = (id: string) =>
    setNewType(p => ({ ...p, selectedFeatures: p.selectedFeatures.includes(id) ? p.selectedFeatures.filter(f => f !== id) : [...p.selectedFeatures, id] }));

  const handleFile = (file: File) => {
    if (file.type.startsWith('image/')) setImages([URL.createObjectURL(file)]);
  };

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
    } catch (err: any) {
      const msg = err?.response?.data?.error;
      setApiError(typeof msg === 'string' ? msg : t('common.error'));
    }
  };

  const field = 'w-full h-12 px-4 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all';
  const isPending = createRoom.isPending || createRoomType.isPending;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" />

          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-3xl bg-stone-50 rounded-[2.5rem] shadow-2xl border border-white overflow-hidden flex flex-col">

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
                              {rt.capacity} pers. · {rt.rate.toLocaleString()} Ar/n
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
                            {(creatingNew ? Number(newType.rate) : selectedType?.rate ?? 0).toLocaleString()} Ar/n
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
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-3">{t('rooms.uploadImage')}</label>
                      <div
                        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={e => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
                        onClick={() => fileRef.current?.click()}
                        className={cn('aspect-video bg-stone-100 rounded-2xl overflow-hidden border border-dashed border-stone-300 hover:border-primary/40 cursor-pointer transition-all flex flex-col items-center justify-center relative group',
                          isDragging && 'border-primary bg-teal-50', images[0] && 'border-solid border-stone-200')}
                      >
                        <input type="file" ref={fileRef} accept="image/*" className="hidden"
                          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                        {images[0] ? (
                          <>
                            <img src={images[0]} alt="preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all gap-2">
                              <Upload className="w-5 h-5 text-white" />
                              <span className="text-[10px] font-bold text-white uppercase tracking-widest">{t('rooms.uploadImage')}</span>
                            </div>
                            <button type="button" onClick={e => { e.stopPropagation(); setImages([]); }}
                              className="absolute top-3 right-3 bg-black/60 p-1.5 rounded-lg text-red-400">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <div className="text-center p-4">
                            <Upload className="w-8 h-8 opacity-30 mx-auto mb-2" />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">{t('rooms.dragDropImage')}</p>
                          </div>
                        )}
                      </div>

                      {/* Presets */}
                      <div className="grid grid-cols-4 gap-2 mt-3">
                        {PRESET_PHOTOS.map((p, i) => (
                          <button key={i} type="button" onClick={() => setImages([p.url])}
                            className={cn('h-14 rounded-xl overflow-hidden relative border transition-all',
                              images[0] === p.url ? 'border-primary ring-1 ring-primary' : 'border-stone-200 hover:border-stone-400')}>
                            <img src={p.url} alt={p.label} className="w-full h-full object-cover opacity-70" />
                          </button>
                        ))}
                      </div>

                      {/* URL */}
                      <div className="flex gap-2 mt-3">
                        <div className="flex items-center gap-2 text-[9px] font-bold text-on-surface-variant/40 uppercase shrink-0">
                          <Link className="w-3 h-3" /> URL
                        </div>
                        <input type="text" placeholder="https://..." value={imageUrl}
                          onChange={e => setImageUrl(e.target.value)}
                          className="flex-1 h-9 px-3 bg-stone-50 border border-stone-200 rounded-lg text-xs outline-none focus:border-primary transition-all" />
                        <button type="button"
                          onClick={() => { if (imageUrl.startsWith('http')) { setImages([imageUrl]); setImageUrl(''); } }}
                          className="px-3 h-9 bg-stone-100 text-on-surface-variant rounded-lg text-[9px] font-bold uppercase hover:bg-stone-200 transition-all">
                          {t('common.apply')}
                        </button>
                      </div>
                    </div>

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
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
