import React, { useState } from 'react';
import { Search, Plus, Filter, Download, MoreVertical, Mail, Phone } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useGuests } from '../hooks/useGuests';
import { AddGuestModal } from '../components/AddGuestModal';
import { PageLoader, PageError } from '../components/QueryLoader';

export const Guests: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data: guests = [], isLoading, isError } = useGuests(search || undefined);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  if (isLoading) return <PageLoader />;
  if (isError) return <PageError />;

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 sm:gap-0">
        <div>
          <h2 className="font-display italic text-3xl md:text-4xl text-on-surface mb-1 leading-none">Guest Relations</h2>
          <p className="text-[10px] font-sans font-bold uppercase tracking-[0.3em] text-on-surface-variant/40">Managing 1,420 profile database</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="w-full sm:w-auto bg-primary text-white px-6 py-3 rounded-xl font-sans text-xs font-bold tracking-[0.2em] uppercase hover:bg-primary-container transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/10"
        >
          <Plus className="w-4 h-4" /> New Profile
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
        <div className="md:col-span-3">
          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-outline-variant" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email or booking ID..."
              className="w-full pl-14 pr-6 h-14 md:h-16 bg-white border border-stone-200 rounded-2xl organic-shadow focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all font-sans text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button className="flex-1 h-14 md:h-16 flex items-center justify-center gap-2 border border-stone-200 bg-white rounded-2xl hover:bg-stone-50 transition-colors uppercase text-[10px] font-bold tracking-widest text-on-surface-variant">
            <Filter className="w-4 h-4" /> Filter
          </button>
          <button className="w-14 md:w-16 h-14 md:h-16 flex items-center justify-center border border-stone-200 bg-white rounded-2xl hover:bg-stone-50 transition-colors">
            <Download className="w-4 h-4 text-on-surface-variant" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {guests.map((guest, i) => (
          <motion.div
            key={guest.id}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => navigate(`/guests/${guest.id}`)}
            className="bg-white rounded-3xl border border-stone-200/60 p-8 organic-shadow group cursor-pointer hover:border-primary/20 transition-all flex flex-col relative overflow-hidden"
          >
            <div className="flex justify-between items-start mb-8 relative z-10">
              <div className="relative">
                <img src={guest.avatar} alt={guest.name} className="w-20 h-20 rounded-2xl object-cover shadow-lg group-hover:scale-105 transition-transform" />
                <span className={cn(
                  "absolute -bottom-2 -right-2 px-3 py-1 rounded-full text-[8px] font-bold text-white shadow-md border-2 border-white uppercase tracking-widest",
                  guest.status === 'VIP Elite' ? "bg-gradient-to-br from-gold-400 to-gold-500" : "bg-primary"
                )}>
                  {guest.status}
                </span>
              </div>
              <button className="text-on-surface-variant/40 hover:text-primary transition-colors">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-8 relative z-10">
              <h3 className="font-display italic text-3xl text-primary leading-tight group-hover:underline underline-offset-4 decoration-primary/20">{guest.name}</h3>
              <p className="font-mono text-[10px] text-on-surface-variant/60 uppercase mt-1 tracking-widest">
                Member Since {guest.memberSince} • {guest.country}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-100 group-hover:bg-teal-50/50 transition-colors">
                <p className="text-[8px] font-bold text-on-surface-variant/40 uppercase tracking-widest mb-1">Total Stays</p>
                <p className="font-display italic text-2xl text-primary">{guest.totalStays}</p>
              </div>
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-100 group-hover:bg-teal-50/50 transition-colors">
                <p className="text-[8px] font-bold text-on-surface-variant/40 uppercase tracking-widest mb-1">LTV</p>
                <p className="font-mono text-lg font-bold text-on-surface">{guest.lifetimeValue.toLocaleString()} Ar</p>
              </div>
            </div>
            <div className="flex gap-2 mt-auto relative z-10">
              <button className="flex-1 py-3 bg-stone-50 text-primary border border-primary/10 rounded-xl font-sans text-[10px] items-center justify-center gap-2 hover:bg-teal-50 transition-all flex font-bold tracking-widest uppercase">
                <Mail className="w-3 h-3" /> Email
              </button>
              <button className="flex-1 py-3 bg-stone-50 text-primary border border-primary/10 rounded-xl font-sans text-[10px] items-center justify-center gap-2 hover:bg-teal-50 transition-all flex font-bold tracking-widest uppercase">
                <Phone className="w-3 h-3" /> Call
              </button>
            </div>
          </motion.div>
        ))}
      </div>
      <AddGuestModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
    </div>
  );
};
