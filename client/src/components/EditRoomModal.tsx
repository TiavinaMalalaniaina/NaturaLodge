import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Link, Trash2, AlertCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Room } from '../types';
import { cn } from '../lib/utils';
import { useUpdateRoom } from '../hooks/useRooms';
import { useTranslation } from 'react-i18next';

const PRESET_PHOTOS = [
  { url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80', label: 'Suite Classic' },
  { url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=600&q=80', label: 'Earthy Luxury' },
  { url: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80', label: 'Tropical Vista' },
  { url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=600&q=80', label: 'Cozy Organic' },
];

interface EditRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  onUpdate?: (updated: Room) => void;
}

export const EditRoomModal: React.FC<EditRoomModalProps> = ({ isOpen, onClose, room, onUpdate }) => {
  const { t }      = useTranslation();
  const updateRoom = useUpdateRoom();

  const [number,       setNumber]       = useState(room.number);
  const [rateOverride, setRateOverride] = useState(room.rateOverride?.toString() ?? '');
  const [images,       setImages]       = useState<string[]>(room.images ?? []);
  const [imageUrl,     setImageUrl]     = useState('');
  const [isDragging,   setIsDragging]   = useState(false);
  const [apiError,     setApiError]     = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setNumber(room.number);
      setRateOverride(room.rateOverride?.toString() ?? '');
      setImages(room.images ?? []);
      setImageUrl(''); setApiError('');
    }
  }, [isOpen, room]);

  const handleFile = (file: File) => {
    if (file.type.startsWith('image/')) setImages([URL.createObjectURL(file)]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');
    try {
      const updated = await updateRoom.mutateAsync({
        id:           room.id,
        number,
        images,
        rateOverride: rateOverride ? Number(rateOverride) : null,
      });
      onUpdate?.(updated);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error;
      setApiError(typeof msg === 'string' ? msg : t('common.error'));
    }
  };

  const field = 'w-full h-12 px-4 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" />

          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl border border-stone-100 overflow-hidden">

            <div className="flex items-center justify-between px-10 pt-8 pb-6 border-b border-stone-100">
              <div>
                <h3 className="font-display italic text-2xl text-on-surface">{t('rooms.modifyUnit')}</h3>
                <p className="text-[10px] text-on-surface-variant/50 mt-1 uppercase tracking-widest">
                  {room.type}
                </p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-stone-50 rounded-full transition-colors">
                <X className="w-5 h-5 text-on-surface-variant" />
              </button>
            </div>

            <div className="px-10 py-8 overflow-y-auto max-h-[70vh]">
              {apiError && (
                <div className="flex items-center gap-3 p-3 mb-6 bg-red-50 border border-red-100 rounded-xl text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p className="text-xs font-medium">{apiError}</p>
                </div>
              )}

              {/* Info sur le type */}
              <div className="flex items-start gap-3 p-4 bg-stone-50 border border-stone-100 rounded-2xl mb-6">
                <Info className="w-4 h-4 text-on-surface-variant/40 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest mb-1">
                    Type partagé — {room.type}
                  </p>
                  <p className="text-[10px] text-on-surface-variant/40 leading-relaxed">
                    Les propriétés du type (tarif de base, surface, literie…) s'appliquent à toutes les chambres du même type.
                    Pour les modifier, utilisez le gestionnaire de types.
                  </p>
                  <div className="flex flex-wrap gap-3 mt-2 text-[10px] font-mono text-on-surface-variant/50">
                    <span>{room.area}m²</span>
                    <span>{room.bedType}</span>
                    <span>{room.capacity} pers.</span>
                    <span>{room.view}</span>
                    <span className="font-bold text-primary">{room.rate.toLocaleString()} Ar/n (base)</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-2">{t('rooms.roomNumber')}</label>
                    <input type="text" required value={number}
                      onChange={e => setNumber(e.target.value)} className={field} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-2">
                      Tarif spécifique (MGA)
                      <span className="normal-case font-normal opacity-40 ml-1">optionnel</span>
                    </label>
                    <input type="number" min={1}
                      placeholder={`Base : ${room.rate.toLocaleString()}`}
                      value={rateOverride}
                      onChange={e => setRateOverride(e.target.value)}
                      className={field} />
                    {rateOverride && Number(rateOverride) !== room.rate && (
                      <p className="text-[9px] text-primary mt-1 font-mono">
                        → {Number(rateOverride).toLocaleString()} Ar/n sur cette chambre uniquement
                      </p>
                    )}
                  </div>
                </div>

                {/* Image */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-3">{t('rooms.uploadImage')}</label>
                  <div
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={e => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
                    onClick={() => fileRef.current?.click()}
                    className={cn('aspect-video bg-stone-100 rounded-2xl overflow-hidden border border-dashed border-stone-300 hover:border-primary/40 cursor-pointer flex items-center justify-center relative group',
                      isDragging && 'border-primary bg-teal-50', images[0] && 'border-solid border-stone-200')}
                  >
                    <input type="file" ref={fileRef} accept="image/*" className="hidden"
                      onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                    {images[0] ? (
                      <>
                        <img src={images[0]} alt={number} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                          <Upload className="w-5 h-5 text-white" />
                        </div>
                        <button type="button" onClick={e => { e.stopPropagation(); setImages([]); }}
                          className="absolute top-3 right-3 bg-black/60 p-1.5 rounded-lg text-red-400 z-10">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <div className="text-center">
                        <Upload className="w-7 h-7 opacity-20 mx-auto mb-2" />
                        <p className="text-[10px] text-on-surface-variant/30 uppercase tracking-widest font-bold">{t('rooms.dragDropImage')}</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {PRESET_PHOTOS.map((p, i) => (
                      <button key={i} type="button" onClick={() => setImages([p.url])}
                        className={cn('h-12 rounded-xl overflow-hidden relative border',
                          images[0] === p.url ? 'border-primary ring-1 ring-primary' : 'border-stone-200 hover:border-stone-400')}>
                        <img src={p.url} alt={p.label} className="w-full h-full object-cover opacity-70" />
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2 mt-3">
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-on-surface-variant/40 uppercase shrink-0">
                      <Link className="w-3 h-3" /> URL
                    </div>
                    <input type="text" placeholder="https://..." value={imageUrl}
                      onChange={e => setImageUrl(e.target.value)}
                      className="flex-1 h-8 px-3 bg-stone-50 border border-stone-200 rounded-lg text-xs outline-none focus:border-primary transition-all" />
                    <button type="button"
                      onClick={() => { if (imageUrl.startsWith('http')) { setImages([imageUrl]); setImageUrl(''); } }}
                      className="px-3 h-8 bg-stone-100 text-on-surface-variant rounded-lg text-[9px] font-bold uppercase hover:bg-stone-200">
                      {t('common.apply')}
                    </button>
                  </div>
                </div>

                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={onClose}
                    className="px-8 py-4 bg-stone-100 text-on-surface-variant rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-stone-200 transition-all">
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
