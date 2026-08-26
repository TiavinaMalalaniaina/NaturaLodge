import React, { useState } from 'react';
import {
  Search, Plus, Download, Mail, Phone,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useGuests } from '../hooks/useGuests';
import { AddGuestModal } from '../components/AddGuestModal';
import { PageLoader, PageError } from '../components/QueryLoader';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../context/AuthContext';

const LIMIT = 20;

function GuestAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <div className={cn(
      'rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center font-display italic text-primary select-none',
      className,
    )}>
      {name.charAt(0)}
    </div>
  );
}

export const Guests: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { can } = useAuth();
  const [search, setSearch]           = useState('');
  const [page, setPage]               = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const debouncedSearch = useDebounce(search);

  const { data, isLoading, isError } = useGuests(
    debouncedSearch ? { search: debouncedSearch, page, limit: LIMIT } : { page, limit: LIMIT }
  );

  const guests = data?.data ?? [];
  const meta   = data?.meta;

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };

  if (isLoading && !data) return <PageLoader />;
  if (isError)            return <PageError />;

  return (
    <div className="space-y-10">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 sm:gap-0">
        <div>
          <h2 className="font-display italic text-3xl md:text-4xl text-on-surface mb-1 leading-none">{t('guests.title')}</h2>
          <p className="text-[10px] font-sans font-bold uppercase tracking-[0.3em] text-on-surface-variant/40">
            {meta ? t('guests.profiles', { count: meta.total.toLocaleString() }) : t('common.loading')}
          </p>
        </div>
        {can('guests.create') && (
          <button onClick={() => setIsAddModalOpen(true)}
            className="w-full sm:w-auto bg-primary text-white px-6 py-3 rounded-xl font-sans text-xs font-bold tracking-[0.2em] uppercase hover:bg-primary-container transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/10">
            <Plus className="w-4 h-4" /> {t('guests.newProfile')}
          </button>
        )}
      </div>

      {/* ── Search bar ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-3 relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-outline-variant" />
          <input type="text" value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder={t('guests.searchByNameEmail')}
            className="w-full pl-14 pr-6 h-14 md:h-16 bg-white border border-stone-200 rounded-2xl organic-shadow focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all font-sans text-sm"
          />
        </div>
        <button className="h-14 md:h-16 flex items-center justify-center border border-stone-200 bg-white rounded-2xl hover:bg-stone-50 transition-colors text-on-surface-variant">
          <Download className="w-4 h-4" />
        </button>
      </div>

      {/* ── Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {guests.map((guest, i) => (
          <motion.div key={guest.id}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: Math.min(i * 0.04, 0.4) }}
            onClick={() => navigate(`/guests/${guest.id}`)}
            className="bg-white rounded-3xl border border-stone-200/60 p-8 organic-shadow group cursor-pointer hover:border-primary/20 transition-all flex flex-col"
          >
            <div className="flex justify-between items-start mb-6">
              <GuestAvatar name={guest.name} className="w-16 h-16 text-3xl group-hover:scale-105 transition-transform" />
            </div>

            <div className="mb-6 flex-1">
              <h3 className="font-display italic text-2xl text-primary leading-tight group-hover:underline underline-offset-4 decoration-primary/20">
                {guest.name}
              </h3>
              <p className="font-mono text-[10px] text-on-surface-variant/50 uppercase mt-1 tracking-widest">
                {[guest.city, guest.country].filter(Boolean).join(' · ')} · {t('guests.since')} {guest.memberSince}
              </p>
            </div>

            <div className="flex gap-2 mt-auto">
              <button onClick={e => e.stopPropagation()}
                className="flex-1 py-2.5 bg-stone-50 text-primary border border-primary/10 rounded-xl font-sans text-[10px] flex items-center justify-center gap-1.5 hover:bg-teal-50 transition-all font-bold tracking-widest uppercase">
                <Mail className="w-3 h-3" /> {t('guests.email')}
              </button>
              <button onClick={e => e.stopPropagation()}
                className="flex-1 py-2.5 bg-stone-50 text-primary border border-primary/10 rounded-xl font-sans text-[10px] flex items-center justify-center gap-1.5 hover:bg-teal-50 transition-all font-bold tracking-widest uppercase">
                <Phone className="w-3 h-3" /> {t('guests.phone')}
              </button>
            </div>
          </motion.div>
        ))}

        {guests.length === 0 && (
          <div className="col-span-3 py-32 text-center text-on-surface-variant/30">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-display italic text-2xl">{t('guests.noGuests')}</p>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
            {t('common.page')} {meta.page} {t('common.of')} {meta.totalPages} · {t('guests.profiles', { count: meta.total })}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => p - 1)} disabled={!meta.hasPrevPage}
              className="p-2 border border-stone-200 rounded-lg text-on-surface-variant/40 disabled:opacity-30 hover:bg-stone-50 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: meta.totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === meta.totalPages || Math.abs(p - meta.page) <= 1)
              .reduce<(number | '…')[]>((acc, p, i, arr) => {
                if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('…');
                acc.push(p); return acc;
              }, [])
              .map((p, i) => p === '…'
                ? <span key={`e${i}`} className="px-1 text-on-surface-variant/30 text-xs">…</span>
                : <button key={p} onClick={() => setPage(p as number)}
                    className={cn('w-8 h-8 rounded-lg text-[10px] font-bold border transition-colors',
                      meta.page === p ? 'bg-primary text-white border-primary' : 'border-stone-200 text-on-surface-variant/60 hover:bg-stone-50')}>
                    {p}
                  </button>
              )}
            <button onClick={() => setPage(p => p + 1)} disabled={!meta.hasNextPage}
              className="p-2 border border-stone-200 rounded-lg text-on-surface-variant/40 disabled:opacity-30 hover:bg-stone-50 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <AddGuestModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
    </div>
  );
};
