import React, { useState } from 'react';
import {
  ArrowLeft, Edit, FileText, Printer, MapPin, Phone, Mail,
  Home, Heart, Bed, Clock, Send, Calendar, ChevronRight,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useGuest, useAddGuestNote } from '../hooks/useGuests';
import { PageLoader, PageError } from '../components/QueryLoader';
import { InvoiceModal } from '../components/InvoiceModal';
import { GuestBooking } from '../api/guests';
import { useTranslation } from 'react-i18next';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function bookingNights(b: GuestBooking) {
  return Math.max(1, Math.round(
    (new Date(b.departure).getTime() - new Date(b.arrival).getTime()) / 86_400_000,
  ));
}

const STATUS_CLASS: Record<string, string> = {
  CONFIRMED:   'text-teal-600',
  CHECKED_IN:  'text-zinc-900',
  CHECKED_OUT: 'text-stone-400',
  CANCELLED:   'text-red-400',
  AWAITING:    'text-amber-600',
};

export const GuestProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: guest, isLoading, isError } = useGuest(id!);
  const addNote = useAddGuestNote();

  const [noteInput,       setNoteInput]      = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  if (isLoading) return <PageLoader />;
  if (isError || !guest) return <PageError />;

  const bookings = (guest as any).bookings as GuestBooking[] | undefined ?? [];

  const handleSendNote = () => {
    if (!noteInput.trim()) return;
    addNote.mutate({ guestId: id!, content: noteInput.trim() }, {
      onSuccess: () => setNoteInput(''),
    });
  };

  return (
    <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-8 pb-12">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)}
            className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full border border-stone-200 bg-white hover:bg-stone-50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
          </button>
          <div>
            <h2 className="font-display text-2xl md:text-3xl text-primary leading-none">{t('guests.guestProfile')}</h2>
            <p className="text-[10px] md:text-xs text-on-surface-variant font-light mt-1">{t('guests.managePref')}</p>
          </div>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 md:px-5 py-2.5 rounded-xl border border-primary/30 text-primary font-bold text-[9px] md:text-[10px] tracking-widest uppercase hover:bg-teal-50 transition-colors">
            <Printer className="w-3.5 h-3.5" /> Summary
          </button>
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 rounded-xl bg-primary text-white font-bold text-[9px] md:text-[10px] tracking-widest uppercase hover:bg-primary-container shadow-lg shadow-primary/10 transition-all">
            <Edit className="w-3.5 h-3.5" /> {t('common.edit')}
          </button>
        </div>
      </div>

      {/* ── Hero card ── */}
      <section className="bg-white rounded-3xl border border-stone-200/60 p-6 md:p-8 organic-shadow overflow-hidden relative">
        <div className="flex flex-col lg:flex-row gap-10 items-center">
          <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-center lg:border-r border-stone-100 lg:pr-12 w-full lg:w-auto">
            <div className="w-28 h-28 md:w-36 md:h-36 rounded-full bg-teal-50 border border-teal-100 shadow-xl flex items-center justify-center font-display italic text-5xl md:text-6xl text-primary select-none">
              {guest.name.charAt(0)}
            </div>
            <div className="text-center md:text-left flex-1">
              <h3 className="font-display italic text-4xl md:text-5xl lg:text-6xl text-primary leading-none mb-4">{guest.name}</h3>
              <div className="flex items-center justify-center md:justify-start gap-2 text-on-surface-variant/60 font-sans tracking-wide text-xs md:text-base">
                <MapPin className="w-4 h-4 shrink-0" />
                {[guest.city, guest.country].filter(Boolean).join(', ') || '—'}
              </div>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-6 w-full">
            {[
              { label: t('guests.totalStays'),    value: guest.totalStays,                             type: 'display' },
              { label: t('guests.lifetimeValue'), value: `${guest.lifetimeValue.toLocaleString()} Ar`, type: 'mono' },
              { label: t('guests.lastStay'),      value: guest.lastStay,                              type: 'mono' },
              { label: t('guests.memberSince'),   value: guest.memberSince,                           type: 'mono' },
            ].map(stat => (
              <div key={stat.label} className="p-5 rounded-2xl bg-stone-50 border border-stone-100">
                <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest mb-2">{stat.label}</p>
                <p className={cn(
                  'leading-none',
                  stat.type === 'display' ? 'font-display italic text-4xl text-primary' : 'font-mono text-xl font-bold text-on-surface',
                )}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ── Left col ── */}
        <div className="space-y-8">
          {/* Contact */}
          <div className="bg-white rounded-2xl border border-stone-200/60 p-6 organic-shadow">
            <h4 className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase mb-6 flex items-center gap-2">
              <Phone className="w-3 h-3 text-primary" /> {t('guests.contactInfo')}
            </h4>
            <div className="space-y-5">
              {[
                { icon: Phone, label: t('guests.phone'),   value: guest.phone   || '—' },
                { icon: Mail,  label: t('guests.email'),   value: guest.email },
                { icon: Home,  label: t('guests.address'), value: guest.address || '—' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-stone-50 flex items-center justify-center text-outline-variant shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">{label}</p>
                    <p className="text-sm truncate">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-white rounded-2xl border border-stone-200/60 p-6 organic-shadow">
            <h4 className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase mb-6 flex items-center gap-2">
              <Heart className="w-3 h-3 text-primary" /> {t('guests.preferences')}
            </h4>
            {guest.preferences.length === 0 ? (
              <p className="text-sm text-on-surface-variant/40 italic">{t('guests.noPreferences')}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {guest.preferences.map(p => (
                  <span key={p} className="px-3 py-1.5 bg-stone-50 border border-stone-100 rounded-lg text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right col ── */}
        <div className="lg:col-span-2 space-y-8">

          {/* Stay history */}
          <div className="bg-primary/5 p-8 rounded-3xl border border-primary/10">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase flex items-center gap-2">
                <Clock className="w-3 h-3" /> {t('guests.stayHistory')}
              </h4>
              <span className="text-[9px] font-bold text-primary/50 uppercase tracking-widest">
                {t('guests.bookingsCount', { count: bookings.length })}
              </span>
            </div>

            {bookings.length === 0 ? (
              <div className="text-center py-12 text-on-surface-variant/40">
                <Bed className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="font-display italic text-xl">{t('guests.noStays')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map(b => {
                  const nights    = bookingNights(b);
                  const firstRoom = b.rooms[0]?.room;
                  const moreRooms = b.rooms.length - 1;
                  return (
                    <div key={b.id} className="bg-white rounded-2xl p-5 flex items-center justify-between organic-shadow border border-stone-100 group hover:border-primary/20 transition-all">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 bg-stone-50 rounded-xl flex items-center justify-center text-primary group-hover:bg-teal-50 transition-colors shrink-0">
                          <Bed className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-display italic text-xl text-primary truncate">
                            {firstRoom ? `Suite ${firstRoom.number}` : '—'}
                            {moreRooms > 0 && <span className="text-sm opacity-50 ml-1">+{moreRooms}</span>}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Calendar className="w-3 h-3 text-on-surface-variant/30" />
                            <p className="text-[10px] font-mono text-on-surface-variant/60">
                              {fmtDate(b.arrival)} → {fmtDate(b.departure)} · {nights}n
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <p className="font-mono text-sm font-bold text-on-surface">{b.totalAmount.toLocaleString()} Ar</p>
                          <span className={cn('text-[8px] font-bold uppercase tracking-widest', STATUS_CLASS[b.status] ?? 'text-stone-400')}>
                            {b.status.replace('_', ' ')}
                          </span>
                        </div>
                        <Link to={`/reservations/${b.id}`}
                          className="p-2 border border-stone-100 rounded-xl hover:bg-stone-50 hover:border-stone-200 text-stone-400 hover:text-primary transition-all">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                        <button onClick={() => setSelectedInvoice(b)}
                          className="p-2 border border-stone-100 rounded-xl hover:bg-stone-50 hover:border-stone-200 text-stone-400 hover:text-primary transition-all">
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Staff notes */}
          <div className="bg-white rounded-3xl border border-stone-200/60 organic-shadow overflow-hidden flex flex-col" style={{ height: 400 }}>
            <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50/50 shrink-0">
              <h4 className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase flex items-center gap-2">
                <FileText className="w-3 h-4" /> {t('guests.staffNotes')}
              </h4>
              <span className="text-[8px] font-bold text-on-surface-variant/40 uppercase tracking-widest">{t('guests.privateToTeam')}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
              {guest.notes.length === 0 && (
                <p className="text-center text-sm text-on-surface-variant/30 italic pt-4">{t('guests.noNotes')}</p>
              )}
              {guest.notes.map(note => (
                <div key={note.id} className="bg-stone-50 p-5 rounded-2xl border border-stone-100 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{note.author.name}</p>
                      <p className="text-[8px] text-on-surface-variant/60 uppercase">{note.author.role}</p>
                    </div>
                    <span className="font-mono text-[9px] text-on-surface-variant/40">
                      {new Date(note.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-sm text-on-surface-variant leading-relaxed font-light">{note.content}</p>
                </div>
              ))}
            </div>

            <div className="p-4 bg-stone-50 border-t border-stone-100 shrink-0">
              <div className="relative">
                <input type="text"
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendNote()}
                  placeholder={t('guests.addNote')}
                  className="w-full h-12 pl-5 pr-14 bg-white border border-stone-200 rounded-xl text-sm outline-none focus:border-primary transition-all"
                />
                <button
                  onClick={handleSendNote}
                  disabled={!noteInput.trim() || addNote.isPending}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-primary rounded-lg text-white flex items-center justify-center hover:bg-primary-container transition-all disabled:opacity-40">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <InvoiceModal
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        booking={selectedInvoice}
      />
    </motion.div>
  );
};
