import React, { useState } from 'react';
import { ArrowLeft, Edit, FileText, Printer, MapPin, Phone, Mail, Home, Heart, Bed, Clock, Send, Star } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGuest } from '../hooks/useGuests';
import { PageLoader, PageError } from '../components/QueryLoader';
import { InvoiceModal } from '../components/InvoiceModal';

export const GuestProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: guest, isLoading, isError } = useGuest(id!);
  const onBack = () => navigate(-1);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  if (isLoading) return <PageLoader />;
  if (isError || !guest) return <PageError message="Client introuvable." />;

  return (
    <motion.div
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="space-y-8 pb-12"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full border border-stone-200 bg-white hover:bg-stone-50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
          </button>
          <div>
            <h2 className="font-display text-2xl md:text-3xl text-primary leading-none">Guest Profile</h2>
            <p className="text-[10px] md:text-xs text-on-surface-variant font-light mt-1">Manage history and personalized preferences</p>
          </div>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 md:px-5 py-2.5 rounded-xl border border-primary/30 text-primary font-bold text-[9px] md:text-[10px] tracking-widest uppercase hover:bg-teal-50 transition-colors">
            <Printer className="w-3.5 h-3.5" /> Summary
          </button>
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 rounded-xl bg-primary text-white font-bold text-[9px] md:text-[10px] tracking-widest uppercase hover:bg-primary-container shadow-lg shadow-primary/10 transition-all">
            <Edit className="w-3.5 h-3.5" /> Edit
          </button>
        </div>
      </div>

      <section className="bg-white rounded-3xl border border-stone-200/60 p-6 md:p-8 organic-shadow overflow-hidden relative">
        <div className="flex flex-col lg:flex-row gap-10 items-center">
          <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-center lg:border-r border-stone-100 lg:pr-12 w-full lg:w-auto">
            <div className="relative">
              <div className="w-28 h-28 md:w-36 md:h-36 rounded-full p-1.5 bg-white shadow-xl border border-stone-100">
                <img src={guest.avatar} alt={guest.name} className="w-full h-full rounded-full object-cover" />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-gradient-to-br from-gold-400 to-gold-500 text-white px-3 md:px-4 py-1 md:py-1.5 rounded-full shadow-lg flex items-center gap-1 md:gap-1.5 border-4 border-white">
                <Star className="w-2.5 md:w-3 h-2.5 md:h-3 fill-white" />
                <span className="text-[8px] md:text-[10px] font-bold tracking-widest uppercase">{guest.status}</span>
              </div>
            </div>
            <div className="text-center md:text-left flex-1">
              <h3 className="font-display italic text-4xl md:text-5xl lg:text-6xl text-primary leading-none mb-4">{guest.name}</h3>
              <div className="flex items-center justify-center md:justify-start gap-2 text-on-surface-variant/60 font-sans tracking-wide text-xs md:text-base">
                <MapPin className="w-4 h-4" />
                {guest.city}, {guest.country}
              </div>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-6 w-full">
            {[
              { label: 'Total Stays', value: guest.totalStays, type: 'display' },
              { label: 'Lifetime Value', value: `${guest.lifetimeValue.toLocaleString()} Ar`, type: 'mono' },
              { label: 'Last Stay', value: guest.lastStay, type: 'mono' },
              { label: 'Member Since', value: guest.memberSince, type: 'mono' },
            ].map(stat => (
              <div key={stat.label} className="p-5 rounded-2xl bg-stone-50 border border-stone-100">
                <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest mb-2">{stat.label}</p>
                <p className={cn(
                  stat.type === 'display' ? "font-display italic text-4xl text-primary" : "font-mono text-xl font-bold text-on-surface",
                  "leading-none"
                )}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-8">
          <div className="bg-white rounded-2xl border border-stone-200/60 p-6 organic-shadow">
            <h4 className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase mb-6 flex items-center gap-2">
              <Phone className="w-3 h-3 text-primary" /> Contact Information
            </h4>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-stone-50 flex items-center justify-center text-outline-variant">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">Phone</p>
                  <p className="font-mono text-sm">{guest.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-stone-50 flex items-center justify-center text-outline-variant">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">Email</p>
                  <p className="text-sm">{guest.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-stone-50 flex items-center justify-center text-outline-variant">
                  <Home className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">Address</p>
                  <p className="text-sm">{guest.address}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200/60 p-6 organic-shadow">
            <h4 className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase mb-6 flex items-center gap-2">
              <Heart className="w-3 h-3 text-primary" /> Personal Preferences
            </h4>
            <div className="space-y-4">
              <div className="p-4 bg-teal-50 border border-primary/10 rounded-xl">
                <p className="text-sm text-primary italic leading-relaxed font-light">"Feather-free pillows due to minor allergies."</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {guest.preferences.map(p => (
                  <span key={p} className="px-3 py-1.5 bg-stone-50 border border-stone-100 rounded-lg text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div className="bg-primary/5 p-8 rounded-3xl border border-primary/10">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase flex items-center gap-2">
                <Clock className="w-3 h-3" /> Stay History
              </h4>
              <button className="text-[9px] font-bold text-primary underline underline-offset-4 tracking-widest uppercase">View full archive</button>
            </div>
            <div className="space-y-4">
               {[
                { id: 'h1', guestName: guest.name, room: 'Suite 101', number: '101', type: 'Highland Suite', date: 'Aug 12, 2023', arrival: '2023-08-12', departure: '2023-08-16', status: 'Completed', amountValue: 6200000, amount: '6,200,000 Ar' },
                { id: 'h2', guestName: guest.name, room: 'Room 402', number: '402', type: 'Deluxe Room', date: 'May 20, 2023', arrival: '2023-05-20', departure: '2023-05-24', status: 'Completed', amountValue: 4450000, amount: '4,450,000 Ar' },
               ].map((stay, i) => (
                <div key={i} className="bg-white rounded-2xl p-5 flex items-center justify-between organic-shadow border border-stone-100 group hover:border-primary/20 transition-all">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-stone-50 rounded-xl flex items-center justify-center text-primary group-hover:bg-teal-50 transition-colors">
                      <Bed className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-display italic text-xl text-primary">{stay.room}</p>
                      <p className="text-[10px] font-mono text-on-surface-variant/60">{stay.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-mono text-sm font-bold text-on-surface">{stay.amount}</p>
                      <span className="text-[8px] font-bold text-status-available uppercase tracking-widest">{stay.status}</span>
                    </div>
                    <button 
                      onClick={() => setSelectedInvoice({
                        id: stay.id,
                        guestName: stay.guestName,
                        roomNumber: stay.number,
                        roomType: stay.type,
                        arrival: stay.arrival,
                        departure: stay.departure,
                        totalAmount: stay.amountValue
                      })}
                      className="p-2 border border-stone-100 rounded-xl hover:bg-stone-50 hover:border-stone-200 text-stone-400 hover:text-primary transition-all group/btn"
                    >
                      <FileText className="w-5 h-5 transition-transform group-hover/btn:scale-110" />
                    </button>
                  </div>
                </div>
               ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-stone-200/60 organic-shadow overflow-hidden flex flex-col h-[400px]">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
              <h4 className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase flex items-center gap-2">
                <FileText className="w-3 h-4" /> Internal Staff Notes
              </h4>
              <span className="text-[8px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Private to team</span>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
              {guest.notes.map(note => (
                <div key={note.id} className="bg-stone-50 p-5 rounded-2xl border border-stone-100 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{note.author}</p>
                      <p className="text-[8px] text-on-surface-variant/60 uppercase">{note.role}</p>
                    </div>
                    <span className="font-mono text-[9px] text-on-surface-variant/40">{note.date}</span>
                  </div>
                  <p className="text-sm text-on-surface-variant leading-relaxed font-light">{note.content}</p>
                </div>
              ))}
            </div>
            <div className="p-4 bg-stone-50 border-t border-stone-100">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Add a new note for the team..."
                  className="w-full h-12 pl-5 pr-14 bg-white border border-stone-200 rounded-xl text-sm outline-none focus:border-primary transition-all"
                />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-primary rounded-lg text-white flex items-center justify-center hover:bg-primary-container transition-all">
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
