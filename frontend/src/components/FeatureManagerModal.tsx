import React, { useState } from 'react';
import { X, Plus, Trash2, Wifi, Coffee, Wind, Tv, ShieldCheck, Map, Edit2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useRoomFeatures, useCreateRoomFeature, useDeleteRoomFeature } from '../hooks/useRooms';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Wifi, Coffee, Wind, Tv, ShieldCheck, Map,
};

interface FeatureManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeatureManagerModal: React.FC<FeatureManagerModalProps> = ({ isOpen, onClose }) => {
  const { data: features = [], isLoading } = useRoomFeatures();
  const createFeature = useCreateRoomFeature();
  const deleteFeature = useDeleteRoomFeature();

  const [isAdding, setIsAdding]     = useState(false);
  const [newLabel, setNewLabel]     = useState('');
  const [newIcon, setNewIcon]       = useState('Wifi');
  const [apiError, setApiError]     = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const resetAdd = () => { setIsAdding(false); setNewLabel(''); setNewIcon('Wifi'); setApiError(''); };

  const handleAdd = async () => {
    if (!newLabel.trim()) return;
    setApiError('');
    try {
      await createFeature.mutateAsync({ label: newLabel.trim(), iconName: newIcon });
      resetAdd();
    } catch (err: any) {
      setApiError(err?.response?.data?.error ?? 'Erreur lors de la création.');
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteFeature.mutateAsync(id);
    } catch {
      // feature may be in use; silently ignore
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="absolute inset-0 bg-stone-900/60 backdrop-blur-md" />

          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl border border-stone-200 overflow-hidden">

            <div className="p-8 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
              <div>
                <h3 className="font-display italic text-2xl text-on-surface">Room Features</h3>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40">Global Attributes Catalog</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-stone-200">
                <X className="w-5 h-5 text-on-surface-variant" />
              </button>
            </div>

            <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto no-scrollbar">
              {/* Feature list */}
              <div className="space-y-3">
                {isLoading ? (
                  <p className="text-xs text-on-surface-variant/40 text-center py-8">Chargement...</p>
                ) : features.map(feature => {
                  const Icon = ICON_MAP[feature.iconName] ?? Wifi;
                  const isDeleting = deletingId === feature.id;
                  return (
                    <div key={feature.id}
                      className={cn('flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-100 group hover:border-primary/20 transition-all',
                        isDeleting && 'opacity-50')}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white border border-stone-200 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-on-surface">{feature.label}</p>
                          <p className="text-[10px] font-mono text-on-surface-variant/40 uppercase tracking-tighter">ID: {feature.id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-2 text-on-surface-variant/40 hover:text-primary transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(feature.id)} disabled={isDeleting}
                          className="p-2 text-on-surface-variant/40 hover:text-red-500 transition-colors disabled:cursor-not-allowed">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add form */}
              {isAdding ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 p-6 bg-teal-50/50 rounded-2xl border border-primary/10">
                  {apiError && (
                    <div className="flex items-center gap-2 text-red-500 text-xs">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />{apiError}
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2 block">Feature Label</label>
                    <input autoFocus type="text" placeholder="e.g. Mini Bar" value={newLabel}
                      onChange={e => setNewLabel(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAdd()}
                      className="w-full h-12 px-4 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2 block">Icon</label>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(ICON_MAP).map(([name, Icon]) => (
                        <button key={name} type="button" onClick={() => setNewIcon(name)}
                          className={cn('w-10 h-10 rounded-lg border flex items-center justify-center transition-all',
                            newIcon === name ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant border-stone-200 hover:border-stone-300')}>
                          <Icon className="w-4 h-4" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={resetAdd}
                      className="flex-1 py-3 bg-white text-on-surface-variant rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-stone-100 transition-all">
                      Cancel
                    </button>
                    <button onClick={handleAdd} disabled={!newLabel.trim() || createFeature.isPending}
                      className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-primary-container disabled:opacity-40 transition-all">
                      {createFeature.isPending ? 'Saving...' : 'Save Feature'}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <button onClick={() => setIsAdding(true)}
                  className="w-full py-4 border-2 border-dashed border-stone-200 rounded-2xl flex items-center justify-center gap-3 text-on-surface-variant/60 hover:border-primary/40 hover:text-primary transition-all group">
                  <Plus className="w-4 h-4 group-hover:scale-125 transition-transform" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">New Attribute Definition</span>
                </button>
              )}
            </div>

            <div className="p-8 bg-stone-50 border-t border-stone-100">
              <p className="text-[10px] text-on-surface-variant/40 leading-relaxed text-center">
                Modifying features here updates all available options in inventory management.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
