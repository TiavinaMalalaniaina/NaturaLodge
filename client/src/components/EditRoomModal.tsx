import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Info } from 'lucide-react';
import { Room } from '../types';
import { useUpdateRoom } from '../hooks/useRooms';
import { useTranslation } from 'react-i18next';
import { getApiErrorMessage } from '../lib/apiError';
import { formatCurrency } from '../lib/format';
import { RoomImagePicker } from './RoomImagePicker';
import { Modal } from './Modal';

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
  const [apiError,     setApiError]     = useState('');

  useEffect(() => {
    if (isOpen) {
      setNumber(room.number);
      setRateOverride(room.rateOverride?.toString() ?? '');
      setImages(room.images ?? []);
      setApiError('');
    }
  }, [isOpen, room]);

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
    } catch (err) {
      setApiError(getApiErrorMessage(err, t('common.error')));
    }
  };

  const field = 'w-full h-12 px-4 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('rooms.modifyUnit')}
      className="max-w-2xl bg-white rounded-[2.5rem] shadow-2xl border border-stone-100 overflow-hidden">

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
                    <span className="font-bold text-primary">{formatCurrency(room.rate)}/n (base)</span>
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
                        → {formatCurrency(Number(rateOverride))}/n sur cette chambre uniquement
                      </p>
                    )}
                  </div>
                </div>

                {/* Image */}
                <RoomImagePicker images={images} onChange={setImages} previewAlt={number} />

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
    </Modal>
  );
};
