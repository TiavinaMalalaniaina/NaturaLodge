import React, { useState } from 'react';
import { X, Shield, Mail, User, Briefcase, Calendar, Check, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { StaffRole } from '../types';

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROLES = [
  { value: 'admin', label: 'Administrator', desc: 'Full system access & financial controls' },
  { value: 'manager', label: 'Operations Manager', desc: 'Manage inventory, guests & staff' },
  { value: 'receptionist', label: 'Front Desk', desc: 'Check-ins, bookings & guest services' },
  { value: 'housekeeping', label: 'Housekeeping', desc: 'Unit status & maintenance tasks' },
];

export const AddStaffModal: React.FC<AddStaffModalProps> = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'receptionist',
    department: 'Front Office',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('New Staff Onboarded:', formData);
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
            {/* Left Decor */}
            <div className="w-full md:w-80 bg-zinc-900 p-10 text-white flex flex-col">
              <div className="mb-12">
                <Shield className="w-10 h-10 text-teal-400 mb-6" />
                <h3 className="font-display italic text-3xl mb-2">Onboard Talent</h3>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">Personnel Access Control</p>
              </div>

              <div className="space-y-8">
                 <div className="p-5 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-md">
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-teal-400 mb-3">Security Protocol</p>
                    <p className="text-[11px] font-light leading-relaxed opacity-60">
                      Assign roles carefully. Permissions are strictly enforced based on hierarchical department structures to ensure data integrity.
                    </p>
                 </div>
              </div>

              <div className="mt-auto opacity-20">
                 <p className="font-display italic text-5xl">Cabinet</p>
              </div>
            </div>

            {/* Right Form */}
            <div className="flex-1 p-8 md:p-12 bg-white overflow-y-auto max-h-[85vh]">
              <div className="flex justify-between items-center mb-10">
                <h4 className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase">Member Identification</h4>
                <button onClick={onClose} className="p-2 hover:bg-stone-50 rounded-full transition-colors">
                  <X className="w-5 h-5 text-on-surface-variant" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">Full Legal Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/30" />
                      <input 
                        type="text"
                        placeholder="Johnathan Doe"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full h-14 pl-12 pr-5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none font-sans text-sm transition-all"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">Work Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/30" />
                      <input 
                        type="email"
                        placeholder="j.doe@verdana-retreat.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full h-14 pl-12 pr-5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none font-sans text-sm transition-all"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-5 text-center">Assign Organizational Role</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {ROLES.map((role) => (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, role: role.value })}
                        className={cn(
                          "p-5 text-left border rounded-2xl transition-all relative group",
                          formData.role === role.value 
                            ? "bg-teal-50/50 border-teal-600 ring-4 ring-teal-50" 
                            : "bg-white border-stone-200 hover:border-stone-400"
                        )}
                      >
                        <div className="flex justify-between items-start mb-2">
                           <p className={cn(
                             "text-[10px] font-bold uppercase tracking-widest",
                             formData.role === role.value ? "text-teal-600" : "text-on-surface-variant"
                           )}>
                             {role.label}
                           </p>
                           {formData.role === role.value && <div className="w-5 h-5 bg-teal-600 rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
                        </div>
                        <p className="text-[11px] text-on-surface-variant/60 font-light leading-snug">{role.desc}</p>
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
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-zinc-900 text-white rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-black transition-all shadow-xl shadow-black/20"
                  >
                    Authorize New Member
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
