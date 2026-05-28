import React, { useState } from 'react';
import { X, User, MapPin, Phone, Mail, Languages, Shield, Check, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface AddGuestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddGuestModal: React.FC<AddGuestModalProps> = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    country: '',
    status: 'REGULAR' as const,
    preferences: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('New Guest Profile Created:', formData);
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
            className="relative w-full max-w-3xl bg-stone-50 rounded-[2.5rem] shadow-2xl border border-white overflow-hidden flex flex-col md:flex-row"
          >
            {/* Legend / Branding */}
            <div className="w-full md:w-72 bg-zinc-900 p-8 text-white flex flex-col">
              <div className="mb-10">
                <h3 className="font-display italic text-3xl mb-2 text-white">Curated Profile</h3>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Guest Registry</p>
              </div>

              <div className="space-y-6 flex-1">
                <div className="p-6 bg-white/10 rounded-2xl border border-white/10">
                   <Star className="w-6 h-6 text-white mb-4" />
                   <p className="text-xs font-light leading-relaxed">
                     Profiles at Natura Lodge are more than data; they are records of preference and comfort. 
                     Precision ensures we anticipate needs before they are voiced.
                   </p>
                </div>
              </div>

              <div className="mt-auto pt-10 flex items-center gap-2 opacity-50">
                <Shield className="w-3.5 h-3.5" />
                <span className="text-[8px] font-bold uppercase tracking-widest">Encrypted & Private</span>
              </div>
            </div>

            {/* Form */}
            <div className="flex-1 p-8 md:p-12 bg-white overflow-y-auto max-h-[85vh]">
              <div className="flex justify-between items-center mb-10">
                <h4 className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase">Identity details</h4>
                <button onClick={onClose} className="p-2 hover:bg-stone-50 rounded-full transition-colors">
                  <X className="w-5 h-5 text-on-surface-variant" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">Full Legal Name</label>
                  <div className="relative">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
                    <input 
                      type="text"
                      placeholder="e.g. Leonardo Hamilton"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full h-14 pl-12 pr-5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">Primary Email</label>
                    <div className="relative">
                      <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
                      <input 
                        type="email"
                        placeholder="leonardo@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full h-14 pl-12 pr-5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">Phone Line</label>
                    <div className="relative">
                      <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
                      <input 
                        type="tel"
                        placeholder="+44 ..."
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full h-14 pl-12 pr-5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">City / Residence</label>
                    <div className="relative">
                      <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
                      <input 
                        type="text"
                        placeholder="London"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full h-14 pl-12 pr-5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">Classification</label>
                    <div className="flex gap-2">
                       {['REGULAR', 'PREMIUM', 'VIP'].map((s) => (
                         <button
                           key={s}
                           type="button"
                           onClick={() => setFormData({ ...formData, status: s as any })}
                           className={cn(
                             "flex-1 py-3.5 rounded-xl border font-bold text-[9px] tracking-widest uppercase transition-all",
                             formData.status === s 
                               ? "bg-stone-900 text-white border-stone-900" 
                               : "bg-white text-on-surface-variant border-stone-200 hover:border-stone-400"
                           )}
                         >
                           {s}
                         </button>
                       ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-8">
                  <button 
                    type="button"
                    onClick={onClose}
                    className="px-10 py-4 bg-stone-100 text-on-surface-variant rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-stone-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-zinc-900 text-white rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-black transition-all shadow-xl shadow-black/20"
                  >
                    Create Guest Profile
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
