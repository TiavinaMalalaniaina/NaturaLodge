import React, { useState } from 'react';
import { ArrowLeft, Edit, Wifi, Coffee, Wind, Tv, ShieldCheck, Star, Bed, Users, Maximize, Map, Calendar, ArrowRight, Zap } from 'lucide-react';
import { Room } from '../types';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { useNavigate, useParams } from 'react-router-dom';
import { MOCK_FEATURES } from '../mockData';
import { useRoom } from '../hooks/useRooms';
import { PageLoader, PageError } from '../components/QueryLoader';
import { EditRoomModal } from '../components/EditRoomModal';
import { AddReservationModal } from '../components/AddReservationModal';

const ICON_MAP: Record<string, any> = {
  Wifi,
  Coffee,
  Wind,
  Tv,
  ShieldCheck,
  Map,
};

export const RoomDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: roomData, isLoading, isError } = useRoom(id!);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [roomState, setRoomState] = useState<Room | undefined>(undefined);

  const room = roomState ?? roomData;

  if (isLoading) return <PageLoader />;
  if (isError || !room) return <PageError message="Chambre introuvable." />;

  const onBack = () => navigate(-1);

  const roomFeatures = MOCK_FEATURES.filter(f => room.features?.includes(f.id));

  return (
    <motion.div 
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="space-y-10 pb-20"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full border border-stone-200 bg-white hover:bg-stone-50 transition-colors cursor-pointer">
            <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
          </button>
          <div>
            <h2 className="font-display text-2xl md:text-3xl text-primary leading-none">Unit Configuration</h2>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-[10px] md:text-xs text-on-surface-variant font-light">Status: <span className={cn(
                "uppercase font-bold tracking-tighter",
                room.status === 'maintenance' ? "text-status-maintenance" : "text-status-available"
              )}>{room.status}</span></p>
              <div className="h-3 w-[1px] bg-stone-200" />
              <button 
                onClick={() => {
                  const updated = { ...room, status: room.status === 'maintenance' ? 'available' : 'maintenance' as any };
                  setRoomState(updated);
                }}
                className={cn(
                  "flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest transition-all cursor-pointer",
                  room.status === 'maintenance' ? "text-teal-600" : "text-status-maintenance hover:underline"
                )}
              >
                {room.status === 'maintenance' ? (
                  <>Ready for Service</>
                ) : (
                  <>Flag for Maintenance</>
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          {room.status === 'available' && (
            <button 
              onClick={() => setIsBookingModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-teal-600 text-white font-bold text-[9px] md:text-[10px] tracking-widest uppercase hover:bg-teal-700 shadow-lg shadow-teal-500/10 transition-all cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-current" /> Instant Book
            </button>
          )}
          <button 
            onClick={() => setIsEditModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white font-bold text-[9px] md:text-[10px] tracking-widest uppercase hover:bg-primary-container shadow-lg shadow-primary/10 transition-all cursor-pointer"
          >
            <Edit className="w-3.5 h-3.5" /> Modify Inventory
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Left Col: Imagery */}
        <section className="space-y-6">
          <div className="aspect-[16/10] bg-stone-100 rounded-3xl overflow-hidden border border-stone-200 shadow-inner group relative">
            {room.images[0] ? (
              <img src={room.images[0]} alt={room.number} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-on-surface-variant/20">
                <Bed className="w-20 h-20 mb-4" />
                <p className="font-display italic text-2xl">No Image Available</p>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent flex items-bottom p-8">
              <div className="mt-auto">
                <span className="text-[10px] font-bold text-white uppercase tracking-[0.3em] opacity-80">Category: {room.category}</span>
                <h3 className="font-display italic text-5xl text-white mt-2">Suite {room.number}</h3>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-3xl border border-stone-200/60 p-8 organic-shadow">
            <h4 className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase mb-8">Technical Specifications</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { icon: Bed, label: 'Beds', value: room.bedType },
                { icon: Users, label: 'Capacity', value: room.capacity },
                { icon: Maximize, label: 'Surface', value: `${room.area}m²` },
                { icon: Star, label: 'View', value: room.view },
              ].map((item, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center text-primary border border-stone-100">
                    <item.icon className="w-5 h-5 animate-pulse" />
                  </div>
                  <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest">{item.label}</p>
                  <p className="text-sm font-medium text-on-surface">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right Col: Details & Schedule */}
        <section className="space-y-8">
          <div className="bg-white rounded-3xl border border-stone-200/60 p-8 organic-shadow">
            <h4 className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase mb-6">About this unit</h4>
            <p className="text-on-surface-variant leading-relaxed font-light mb-8">
              {room.description || "No description provided."} The space is designed with locally sourced oak, tactile linens, and organic textures to create a seamless extension of the Natura valley environment.
            </p>
            
            <div className="flex flex-wrap gap-4">
              {roomFeatures.map((f, i) => {
                const Icon = ICON_MAP[f.iconName] || Wifi;
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-2 border border-stone-100 rounded-full bg-stone-50/50">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">{f.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-primary/5 p-8 rounded-3xl border border-primary/10">
            <h4 className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase mb-6 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 animate-bounce" /> Upcoming Availability
            </h4>
            <div className="space-y-4 font-sans">
              {[
                { date: 'Oct 28 - Oct 30', guest: 'Available', type: 'Instant Book' },
                { date: 'Oct 31 - Nov 04', guest: 'Thorne Party', type: 'Reservation #924' },
                { date: 'Nov 05 - Nov 12', guest: 'S. Kovich', type: 'Direct VIP' },
              ].map((res, i) => (
                <div key={i} className={cn(
                  "p-4 rounded-xl flex items-center justify-between border transition-all",
                  res.guest === 'Available' ? "bg-white border-primary/20 shadow-sm" : "bg-stone-50/50 border-stone-100 opacity-60"
                )}>
                  <div>
                    <p className="font-mono text-[10px] font-bold text-on-surface/60">{res.date}</p>
                    <p className={cn(
                      "font-display italic text-xl",
                      res.guest === 'Available' ? "text-primary" : "text-on-surface-variant"
                    )}>{res.guest}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1">{res.type}</p>
                    {res.guest === 'Available' && (
                      <button className="text-primary hover:text-primary-container cursor-pointer">
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <button className="w-full py-4 mt-6 bg-white border border-primary/20 rounded-xl font-bold text-xs tracking-widest uppercase text-primary hover:bg-teal-50 transition-all cursor-pointer">
              Consult Full Log
            </button>
          </div>
        </section>
      </div>
      
      <EditRoomModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        room={room}
        onUpdate={(updated) => setRoomState(updated)}
      />
      <AddReservationModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        initialRoomId={room.id}
      />
    </motion.div>
  );
};
