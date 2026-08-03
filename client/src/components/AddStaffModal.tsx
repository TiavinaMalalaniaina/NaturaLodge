import React from 'react';
import { X, Shield, Mail, User, Lock, AlertCircle, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { StaffRole } from '../types';
import { useCreateStaff } from '../hooks/useStaff';
import { getApiErrorMessage } from '../lib/apiError';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { staffFormSchema, StaffFormValues } from '../lib/schemas/staff.schema';
import { Modal } from './Modal';

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROLES: { value: StaffRole; label: string; desc: string }[] = [
  { value: 'admin', label: 'Administrator', desc: 'Full system access & financial controls' },
  { value: 'manager', label: 'Operations Manager', desc: 'Manage inventory, guests & staff' },
  { value: 'receptionist', label: 'Front Desk', desc: 'Check-ins, bookings & guest services' },
  { value: 'housekeeping', label: 'Housekeeping', desc: 'Unit status & maintenance tasks' },
];

const DEFAULT_VALUES: StaffFormValues = { name: '', email: '', password: '', confirmPassword: '', role: 'receptionist' };

export const AddStaffModal: React.FC<AddStaffModalProps> = ({ isOpen, onClose }) => {
  const createStaff = useCreateStaff();
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<StaffFormValues>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const role = watch('role');

  const handleClose = () => {
    if (createStaff.isPending) return;
    reset(DEFAULT_VALUES);
    createStaff.reset();
    onClose();
  };

  const onSubmit = (data: StaffFormValues) => {
    createStaff.mutate(
      { name: data.name, email: data.email, password: data.password, role: data.role },
      { onSuccess: handleClose },
    );
  };

  const apiError = createStaff.isError
    ? getApiErrorMessage(createStaff.error, 'Something went wrong. Please try again.')
    : '';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Onboard Talent"
      className="max-w-4xl bg-stone-50 rounded-[2.5rem] shadow-2xl border border-white overflow-hidden flex flex-col md:flex-row">
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
                <button onClick={handleClose} className="p-2 hover:bg-stone-50 rounded-full transition-colors">
                  <X className="w-5 h-5 text-on-surface-variant" />
                </button>
              </div>

              {apiError && (
                <div className="flex items-center gap-3 p-4 mb-6 bg-red-50 border border-red-100 rounded-xl text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p className="text-xs font-medium">{apiError}</p>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">Full Legal Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/30" />
                      <input
                        type="text"
                        placeholder="Johnathan Doe"
                        {...register('name')}
                        className="w-full h-14 pl-12 pr-5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none font-sans text-sm transition-all"
                      />
                    </div>
                    {errors.name && <p className="text-[10px] text-red-500 mt-1.5 font-medium">{errors.name.message}</p>}
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">Work Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/30" />
                      <input
                        type="email"
                        placeholder="j.doe@verdana-retreat.com"
                        {...register('email')}
                        className="w-full h-14 pl-12 pr-5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none font-sans text-sm transition-all"
                      />
                    </div>
                    {errors.email && <p className="text-[10px] text-red-500 mt-1.5 font-medium">{errors.email.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">Temporary Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/30" />
                      <input
                        type="password"
                        placeholder="Min. 8 characters"
                        {...register('password')}
                        className="w-full h-14 pl-12 pr-5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none font-sans text-sm transition-all"
                      />
                    </div>
                    {errors.password && <p className="text-[10px] text-red-500 mt-1.5 font-medium">{errors.password.message}</p>}
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/30" />
                      <input
                        type="password"
                        placeholder="Re-enter password"
                        {...register('confirmPassword')}
                        className="w-full h-14 pl-12 pr-5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none font-sans text-sm transition-all"
                      />
                    </div>
                    {errors.confirmPassword && <p className="text-[10px] text-red-500 mt-1.5 font-medium">{errors.confirmPassword.message}</p>}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-5 text-center">Assign Organizational Role</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {ROLES.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setValue('role', r.value, { shouldValidate: true })}
                        className={cn(
                          "p-5 text-left border rounded-2xl transition-all relative group",
                          role === r.value
                            ? "bg-teal-50/50 border-teal-600 ring-4 ring-teal-50"
                            : "bg-white border-stone-200 hover:border-stone-400"
                        )}
                      >
                        <div className="flex justify-between items-start mb-2">
                           <p className={cn(
                             "text-[10px] font-bold uppercase tracking-widest",
                             role === r.value ? "text-teal-600" : "text-on-surface-variant"
                           )}>
                             {r.label}
                           </p>
                           {role === r.value && <div className="w-5 h-5 bg-teal-600 rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
                        </div>
                        <p className="text-[11px] text-on-surface-variant/60 font-light leading-snug">{r.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-6">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={createStaff.isPending}
                    className="px-10 py-4 bg-stone-100 text-on-surface-variant rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-stone-200 transition-all disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createStaff.isPending}
                    className="flex-1 py-4 bg-zinc-900 text-white rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-black transition-all shadow-xl shadow-black/20 disabled:opacity-50"
                  >
                    {createStaff.isPending ? 'Authorizing…' : 'Authorize New Member'}
                  </button>
                </div>
              </form>
            </div>
    </Modal>
  );
};
