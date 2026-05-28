import React, { useState } from 'react';
import { X, Waves, Trees, Dumbbell, Coffee, Clock, ShieldCheck, Check, ChevronDown, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface AddAmenityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = ['Leisure', 'Wellness', 'Dining', 'Services', 'Sport'];
const ICONS = [
  { icon: Waves, label: 'Pool/Water' },
  { icon: Trees, label: 'Nature/Garden' },
  { icon: Dumbbell, label: 'Fitness' },
  { icon: Coffee, label: 'Dining' },
  { icon: ShieldCheck, label: 'Security' },
  { icon: Activity, label: 'Health' },
];

const COLORS = [
  { value: 'bg-blue-500', label: 'Azure' },
  { value: 'bg-primary', label: 'Natura Teal' },
  { value: 'bg-teal-600', label: 'Forest' },
  { value: 'bg-gold-600', label: 'Gold' },
  { value: 'bg-zinc-800', label: 'Zinc' },
];

export const AddAmenityModal: React.FC<AddAmenityModalProps> = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    category: 'Leisure',
    capacity: '',
    hours: '',
    iconIndex: 0,
    color: 'bg-blue-500',
    description: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('New Amenity Proposed:', formData);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-4xl bg-stone-50 rounded-[2.5rem] shadow-2xl border border-white overflow-hidden flex flex-col md:flex-row"
          >
            {/* Left: Branding/Preview */}
            <div className="w-full md:w-80 bg-zinc-900 p-8 text-white flex flex-col">
              <div className="mb-10">
                <h3 className="font-display italic text-3xl mb-2">Facility Registration</h3>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Asset Management</p>
              </div>

              <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 space-y-8">
                 <div className="flex flex-col items-center">
                    <div className={cn(
                      "w-20 h-20 rounded-3xl flex items-center justify-center text-white shadow-2xl mb-4 transition-all duration-500",
                      formData.color
                    )}>
                      {React.createElement(ICONS[formData.iconIndex].icon, { className: "w-10 h-10" })}
                    </div>
                    <h4 className="font-display italic text-2xl text-center leading-tight">{formData.name || 'Untitled Amenity'}</h4>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-2">{formData.category}</p>
                 </div>

                 <div className="space-y-4 pt-6 border-t border-white/10">
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest opacity-40">
                       <span>Hours</span>
                       <span className="text-white opacity-100">{formData.hours || '--:--'}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest opacity-40">
                       <span>Occupancy</span>
                       <span className="text-white opacity-100">{formData.capacity || '0'} guests</span>
                    </div>
                 </div>
              </div>

              <div className="mt-auto pt-10">
                 <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                    <p className="text-[9px] font-light italic opacity-60 leading-relaxed text-center">
                      "Excellence is not an act, but a habit. Our facilities define the signature Natura Lodge experience."
                    </p>
                 </div>
              </div>
            </div>

            {/* Right: Form */}
            <div className="flex-1 p-8 md:p-12 bg-white overflow-y-auto max-h-[85vh]">
              <div className="flex justify-between items-center mb-10">
                <h4 className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase">Infrastructure configuration</h4>
                <button onClick={onClose} className="p-2 hover:bg-stone-50 rounded-full transition-colors">
                  <X className="w-5 h-5 text-on-surface-variant" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">Facility Name</label>
                    <input 
                      type="text"
                      placeholder="e.g. Royal Library"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full h-14 px-5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">Category Classification</label>
                    <div className="relative">
                      <select 
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full h-14 pl-5 pr-10 bg-stone-50 border border-stone-200 rounded-xl appearance-none focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all"
                      >
                        {CATEGORIES.map(cat => <option key={cat}>{cat}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">Operational Hours</label>
                    <input 
                      type="text"
                      placeholder="e.g. 09:00 - 18:00"
                      value={formData.hours}
                      onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                      className="w-full h-14 px-5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">Max Instant Capacity</label>
                    <input 
                      type="number"
                      placeholder="Max guests"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                      className="w-full h-14 px-5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all"
                    />
                  </div>
                </div>

                <div>
                   <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-4">Visual Identity (Icon & Color)</label>
                   <div className="flex flex-wrap gap-4 mb-4">
                      {ICONS.map((item, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setFormData({ ...formData, iconIndex: i })}
                          className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center border transition-all",
                            formData.iconIndex === i ? "bg-primary text-white border-primary" : "bg-white text-on-surface-variant border-stone-200 hover:border-stone-400"
                          )}
                        >
                          <item.icon className="w-5 h-5" />
                        </button>
                      ))}
                   </div>
                   <div className="flex flex-wrap gap-3">
                      {COLORS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, color: c.value })}
                          className={cn(
                            "w-10 h-10 rounded-full border-4 transition-all relative overflow-hidden",
                            formData.color === c.value ? "border-stone-900 scale-110" : "border-stone-100 hover:border-stone-200"
                          )}
                        >
                          <div className={cn("absolute inset-0", c.value)} />
                          {formData.color === c.value && <Check className="absolute inset-0 m-auto w-5 h-5 text-white" />}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="flex items-center gap-4 pt-6">
                  <button 
                    type="button"
                    onClick={onClose}
                    className="px-10 py-4 bg-stone-100 text-on-surface-variant rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-stone-200 transition-all"
                  >
                    Discard
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-stone-900 text-white rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-black transition-all shadow-xl shadow-black/20"
                  >
                    Initialize Amenity Unit
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
