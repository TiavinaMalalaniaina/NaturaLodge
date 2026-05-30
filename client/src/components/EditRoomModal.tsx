import React, { useState, useRef, useEffect } from 'react';
import { X, Star, ChevronDown, Check, Upload, Link, Trash2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Room } from '../types';
import { cn } from '../lib/utils';
import { useRoomFeatures, useUpdateRoom } from '../hooks/useRooms';
import { useTranslation } from 'react-i18next';

const PRESET_PHOTOS = [
  { url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80', label: 'Suite Classic' },
  { url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=600&q=80', label: 'Earthy Luxury' },
  { url: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80', label: 'Tropical Vista' },
  { url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=600&q=80', label: 'Cozy Organic' },
];

const CATEGORIES: Room['category'][] = ['Superior', 'Deluxe', 'Suite', 'Penthouse', 'Villa', 'Luxury'];
const BED_TYPES   = ['King Size', 'Super King', 'Twin Signature', 'Double'];
const VIEWS       = ['Garden View', 'Ocean View', 'Valley View', 'Pool View', 'Mountain View', 'Courtyard'];

interface EditRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  onUpdate?: (updated: Room) => void;
}

export const EditRoomModal: React.FC<EditRoomModalProps> = ({ isOpen, onClose, room, onUpdate }) => {
  const { t } = useTranslation();
  const { data: features = [] } = useRoomFeatures();
  const updateRoom = useUpdateRoom();

  const [form, setForm] = useState({
    number:           room.number,
    type:             room.type,
    category:         room.category,
    bedType:          room.bedType,
    capacity:         room.capacity.toString(),
    area:             room.area.toString(),
    view:             room.view,
    rate:             room.rate.toString(),
    description:      room.description,
    selectedFeatures: room.features ?? [],
  });
  const [images, setImages]         = useState<string[]>(room.images ?? []);
  const [imageUrl, setImageUrl]     = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [apiError, setApiError]     = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setForm({
        number: room.number, type: room.type, category: room.category,
        bedType: room.bedType, capacity: room.capacity.toString(),
        area: room.area.toString(), view: room.view, rate: room.rate.toString(),
        description: room.description, selectedFeatures: room.features ?? [],
      });
      setImages(room.images ?? []);
      setImageUrl(''); setApiError('');
    }
  }, [isOpen, room]);

  const toggleFeature = (id: string) =>
    setForm(p => ({ ...p, selectedFeatures: p.selectedFeatures.includes(id) ? p.selectedFeatures.filter(f => f !== id) : [...p.selectedFeatures, id] }));

  const handleFile = (file: File) => {
    if (file.type.startsWith('image/')) setImages([URL.createObjectURL(file)]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');
    try {
      const updated = await updateRoom.mutateAsync({
        id:          room.id,
        number:      form.number,
        type:        form.type,
        category:    form.category,
        area:        Number(form.area) || room.area,
        bedType:     form.bedType,
        capacity:    Number(form.capacity) || room.capacity,
        rate:        Number(form.rate) || room.rate,
        view:        form.view,
        images,
        description: form.description,
        featureIds:  form.selectedFeatures,
      });
      onUpdate?.(updated);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error;
      setApiError(typeof msg === 'string' ? msg : t('common.error'));
    }
  };

  const field = 'w-full h-14 px-5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" />

          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-5xl bg-stone-50 rounded-[2.5rem] shadow-2xl border border-white overflow-hidden flex flex-col md:flex-row">

            {/* ── Sidebar ── */}
            <div className="w-full md:w-80 bg-zinc-900 p-8 text-white flex flex-col overflow-y-auto max-h-[85vh] no-scrollbar">
              <div className="mb-6">
                <h3 className="font-display italic text-3xl mb-1">{t('rooms.modifyUnit')}</h3>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">{t('rooms.inventoryUpdate')}</p>
              </div>

              {/* Image upload */}
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
                onClick={() => fileRef.current?.click()}
                className={cn('aspect-video bg-white/5 rounded-2xl overflow-hidden border border-dashed border-white/20 hover:border-white/45 cursor-pointer transition-all flex flex-col items-center justify-center relative group p-2',
                  isDragging && 'border-teal-400', images[0] && 'border-solid border-white/10')}
              >
                <input type="file" ref={fileRef} accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                {images[0] ? (
                  <>
                    <img src={images[0]} alt={form.number} className="w-full h-full object-cover rounded-xl" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all rounded-xl">
                      <Upload className="w-6 h-6 text-white" />
                    </div>
                    <button type="button" onClick={e => { e.stopPropagation(); setImages([]); }}
                      className="absolute top-3 right-3 bg-black/70 p-1.5 rounded-lg text-red-400 z-10">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <div className="text-center p-4">
                    <Upload className="w-8 h-8 opacity-40 mx-auto mb-2 group-hover:scale-110 transition-transform text-teal-400" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-teal-300">{t('rooms.uploadImage')}</p>
                  </div>
                )}
              </div>

              {/* Presets */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                {PRESET_PHOTOS.map((p, i) => (
                  <button key={i} type="button" onClick={() => setImages([p.url])}
                    className={cn('h-12 rounded-xl overflow-hidden relative border transition-all flex items-end p-2',
                      images[0] === p.url ? 'border-teal-400 ring-1 ring-teal-400' : 'border-white/10 hover:border-white/30')}>
                    <img src={p.url} alt={p.label} className="absolute inset-0 w-full h-full object-cover opacity-40" />
                    <span className="relative z-10 text-[8px] font-bold text-white bg-black/40 px-1.5 py-0.5 rounded truncate">{p.label}</span>
                  </button>
                ))}
              </div>

              {/* URL input */}
              <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1.5">
                  <Link className="w-3 h-3" /> {t('rooms.externalUrl')}
                </p>
                <div className="flex gap-2">
                  <input type="text" placeholder="https://..." value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    className="flex-1 h-9 px-3 bg-white/5 border border-white/10 rounded-lg text-[10px] outline-none focus:border-white/35 font-sans text-white placeholder-white/20" />
                  <button type="button"
                    onClick={() => { if (imageUrl.startsWith('http')) { setImages([imageUrl]); setImageUrl(''); } }}
                    className="px-3 bg-white text-zinc-900 rounded-lg font-bold text-[9px] uppercase">{t('common.apply')}</button>
                </div>
              </div>

              {/* Live summary */}
              <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
                <div className="flex justify-between">
                  <div>
                    <p className="text-[8px] opacity-40 font-bold uppercase tracking-widest mb-1">{t('reservations.unit')}</p>
                    <p className="font-display italic text-2xl">{form.number}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] opacity-40 font-bold uppercase tracking-widest mb-1">{t('rooms.rate')}</p>
                    <p className="font-mono text-xs font-bold text-gold-400">{Number(form.rate).toLocaleString()} Ar</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-[10px] font-bold uppercase">
                  <div><p className="opacity-40 text-[8px]">{t('bookingDetail.status')}</p><span className="text-teal-400">{t(`status.${room.status}`, room.status)}</span></div>
                  <div><p className="opacity-40 text-[8px]">{t('rooms.surface')}</p>{form.area}m²</div>
                </div>
              </div>

              <div className="mt-auto pt-6 flex items-center gap-2 opacity-50 animate-pulse">
                <Star className="w-3.5 h-3.5 text-gold-400 fill-gold-400" />
                <p className="text-[9px] font-bold uppercase tracking-[0.2em]">Eco-Certified Design</p>
              </div>
            </div>

            {/* ── Form ── */}
            <div className="flex-1 p-8 md:p-12 bg-white overflow-y-auto max-h-[85vh]">
              <div className="flex justify-between items-center mb-10">
                <h4 className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase">{t('rooms.updateConfigs')}</h4>
                <button onClick={onClose} className="p-2 hover:bg-stone-50 rounded-full transition-colors">
                  <X className="w-5 h-5 text-on-surface-variant" />
                </button>
              </div>

              {apiError && (
                <div className="flex items-center gap-3 p-3 mb-6 bg-red-50 border border-red-100 rounded-xl text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p className="text-xs font-medium">{apiError}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">{t('rooms.roomNumber')}</label>
                    <input type="text" required value={form.number}
                      onChange={e => setForm(p => ({ ...p, number: e.target.value }))} className={field} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">{t('rooms.nightlyRate')}</label>
                    <input type="number" required min={1} value={form.rate}
                      onChange={e => setForm(p => ({ ...p, rate: e.target.value }))} className={field} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">{t('rooms.typeName')}</label>
                    <input type="text" value={form.type}
                      onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className={field} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">{t('rooms.category')}</label>
                    <div className="relative">
                      <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as Room['category'] }))}
                        className={field + ' appearance-none pr-10'}>
                        {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">{t('rooms.bedding')}</label>
                    <div className="relative">
                      <select value={form.bedType} onChange={e => setForm(p => ({ ...p, bedType: e.target.value }))}
                        className={field + ' appearance-none pr-10'}>
                        {BED_TYPES.map(b => <option key={b}>{b}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">{t('rooms.surface')} (m²)</label>
                    <input type="number" min={1} value={form.area}
                      onChange={e => setForm(p => ({ ...p, area: e.target.value }))} className={field} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">{t('rooms.capacity')}</label>
                    <input type="number" min={1} max={20} value={form.capacity}
                      onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))} className={field} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">{t('rooms.view')}</label>
                    <div className="relative">
                      <select value={form.view} onChange={e => setForm(p => ({ ...p, view: e.target.value }))}
                        className={field + ' appearance-none pr-10'}>
                        {VIEWS.map(v => <option key={v}>{v}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">{t('rooms.features')}</label>
                  <div className="flex flex-wrap gap-2">
                    {features.map(f => (
                      <button key={f.id} type="button" onClick={() => toggleFeature(f.id)}
                        className={cn('px-4 py-2 rounded-full border text-[10px] font-bold uppercase tracking-widest transition-all',
                          form.selectedFeatures.includes(f.id)
                            ? 'bg-zinc-900 text-white border-zinc-900 shadow-md shadow-black/20'
                            : 'bg-white text-on-surface-variant/60 border-stone-200 hover:border-stone-400')}>
                        {f.label}
                        {form.selectedFeatures.includes(f.id) && <Check className="w-3 h-3 inline-block ml-2" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">{t('rooms.description')}</label>
                  <textarea rows={3} value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    className="w-full p-5 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all resize-none" />
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <button type="button" onClick={onClose}
                    className="px-10 py-4 bg-stone-100 text-on-surface-variant rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-stone-200 transition-all">
                    {t('common.cancel')}
                  </button>
                  <button type="submit" disabled={updateRoom.isPending}
                    className="flex-1 py-4 bg-zinc-900 text-white rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-black disabled:opacity-40 transition-all shadow-xl shadow-black/20">
                    {updateRoom.isPending ? t('rooms.saving') : t('rooms.saveModifications')}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
