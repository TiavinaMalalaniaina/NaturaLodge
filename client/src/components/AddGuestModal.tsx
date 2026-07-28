import React, { useState, useEffect } from 'react';
import { X, User, MapPin, Phone, Mail, Shield, Star, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useCreateGuest, useUpdateGuest } from '../hooks/useGuests';
import { useNotifications } from '../context/NotificationContext';
import { useTranslation } from 'react-i18next';
import { getApiErrorMessage } from '../lib/apiError';
import { Guest } from '../types';
import { Modal } from './Modal';

interface AddGuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  guest?: Guest;
  onCreated?: (guest: { id: string; name: string; city: string; status: string }) => void;
  onUpdated?: (guest: Guest) => void;
}

const STATUSES = [
  { labelKey: 'Standard',      value: 'STANDARD'      },
  { labelKey: 'VIP Member',    value: 'VIP_MEMBER'     },
  { labelKey: 'VIP Elite',     value: 'VIP_ELITE'      },
  { labelKey: 'Platinum Tier', value: 'PLATINUM_TIER'  },
] as const;

const STATUS_TO_API: Record<Guest['status'], typeof STATUSES[number]['value']> = {
  Standard: 'STANDARD', 'VIP Member': 'VIP_MEMBER',
  'VIP Elite': 'VIP_ELITE', 'Platinum Tier': 'PLATINUM_TIER',
};

export const AddGuestModal: React.FC<AddGuestModalProps> = ({ isOpen, onClose, guest, onCreated, onUpdated }) => {
  const { t } = useTranslation();
  const createGuest = useCreateGuest();
  const updateGuest  = useUpdateGuest();
  const { addNotification } = useNotifications();
  const isEditMode = !!guest;

  const [name,        setName]        = useState('');
  const [email,       setEmail]       = useState('');
  const [phone,       setPhone]       = useState('');
  const [city,        setCity]        = useState('');
  const [country,     setCountry]     = useState('');
  const [status,      setStatus]      = useState<typeof STATUSES[number]['value']>('STANDARD');
  const [preferences, setPreferences] = useState('');
  const [apiError,    setApiError]    = useState('');

  const reset = () => {
    if (guest) {
      setName(guest.name); setEmail(guest.email); setPhone(guest.phone);
      setCity(guest.city); setCountry(guest.country); setStatus(STATUS_TO_API[guest.status]);
      setPreferences(guest.preferences.join(', '));
    } else {
      setName(''); setEmail(''); setPhone('');
      setCity(''); setCountry(''); setStatus('STANDARD');
      setPreferences('');
    }
    setApiError('');
  };

  useEffect(() => { if (isOpen) reset(); }, [isOpen, guest]);

  const handleClose = () => { reset(); onClose(); };

  const isPending = createGuest.isPending || updateGuest.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');
    const payload = {
      name, email,
      phone:       phone || undefined,
      city:        city || undefined,
      country:     country || undefined,
      status,
      preferences: preferences ? preferences.split(',').map(p => p.trim()).filter(Boolean) : [],
    };
    try {
      if (isEditMode && guest) {
        const updated = await updateGuest.mutateAsync({ id: guest.id, ...payload });
        onUpdated?.(updated);
      } else {
        const newGuest = await createGuest.mutateAsync(payload);
        addNotification({
          source:   'direct',
          title:    'Guest Profile Created',
          subtitle: `${name} — ${STATUSES.find(s => s.value === status)?.labelKey}`,
          amount:   '--',
        });
        onCreated?.({ id: newGuest.id, name: newGuest.name, city: newGuest.city, status: newGuest.status });
      }
      handleClose();
    } catch (err) {
      setApiError(getApiErrorMessage(err, t('common.error')));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('guests.curatedProfile')}
      className="max-w-3xl bg-stone-50 rounded-[2.5rem] shadow-2xl border border-white overflow-hidden flex flex-col md:flex-row">
            {/* Sidebar */}
            <div className="w-full md:w-72 bg-zinc-900 p-8 text-white flex flex-col shrink-0">
              <div className="mb-10">
                <h3 className="font-display italic text-3xl mb-2">{t('guests.curatedProfile')}</h3>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">{t('guests.guestRegistry')}</p>
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
              <div className="flex justify-between items-center mb-8">
                <h4 className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase">{t('guests.identityDetails')}</h4>
                <button onClick={handleClose} className="p-2 hover:bg-stone-50 rounded-full transition-colors">
                  <X className="w-5 h-5 text-on-surface-variant" />
                </button>
              </div>

              {apiError && (
                <div className="flex items-center gap-3 p-3 mb-6 bg-red-50 border border-red-100 rounded-xl text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p className="text-xs font-medium">{apiError}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">{t('guests.fullName')}</label>
                  <div className="relative">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
                    <input type="text" placeholder="e.g. Leonardo Hamilton" value={name}
                      onChange={e => setName(e.target.value)} required
                      className="w-full h-14 pl-12 pr-5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all"
                    />
                  </div>
                </div>

                {/* Email + Phone */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">{t('guests.email')}</label>
                    <div className="relative">
                      <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
                      <input type="email" placeholder="guest@example.com" value={email}
                        onChange={e => setEmail(e.target.value)} required
                        className="w-full h-14 pl-12 pr-5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">{t('guests.phone')}</label>
                    <div className="relative">
                      <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
                      <input type="tel" placeholder="+44 ..." value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="w-full h-14 pl-12 pr-5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* City + Country */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">{t('guests.city')}</label>
                    <div className="relative">
                      <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
                      <input type="text" placeholder="London" value={city}
                        onChange={e => setCity(e.target.value)}
                        className="w-full h-14 pl-12 pr-5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">{t('guests.country')}</label>
                    <input type="text" placeholder="France" value={country}
                      onChange={e => setCountry(e.target.value)}
                      className="w-full h-14 px-5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all"
                    />
                  </div>
                </div>

                {/* Classification */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">{t('guests.classification')}</label>
                  <div className="flex gap-2">
                    {STATUSES.map(s => (
                      <button key={s.value} type="button" onClick={() => setStatus(s.value)}
                        className={cn(
                          'flex-1 py-3.5 rounded-xl border font-bold text-[9px] tracking-widest uppercase transition-all',
                          status === s.value
                            ? 'bg-zinc-900 text-white border-zinc-900'
                            : 'bg-white text-on-surface-variant border-stone-200 hover:border-stone-400',
                        )}>
                        {s.labelKey}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preferences */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 block mb-3">
                    {t('guests.preferences')} <span className="opacity-40 normal-case font-normal tracking-normal">{t('guests.preferencesSeparated')}</span>
                  </label>
                  <input type="text" placeholder="High floors, Feather-free pillows, Organic Spa"
                    value={preferences} onChange={e => setPreferences(e.target.value)}
                    className="w-full h-14 px-5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-sans text-sm transition-all"
                  />
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <button type="button" onClick={handleClose}
                    className="px-10 py-4 bg-stone-100 text-on-surface-variant rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-stone-200 transition-all">
                    {t('common.cancel')}
                  </button>
                  <button type="submit" disabled={isPending}
                    className="flex-1 py-4 bg-zinc-900 text-white rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-black transition-all shadow-xl shadow-black/20 disabled:opacity-50">
                    {isPending ? (isEditMode ? t('common.saving') : t('common.creating')) : (isEditMode ? t('common.save') : t('guests.createProfile'))}
                  </button>
                </div>
              </form>
            </div>
    </Modal>
  );
};
