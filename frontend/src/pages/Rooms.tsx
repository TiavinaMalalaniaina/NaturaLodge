import React, { useState } from 'react';
import { Plus, Filter, Layers, MoreVertical, Users, Maximize, Building2, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useRooms } from '../hooks/useRooms';
import { AddRoomModal } from '../components/AddRoomModal';
import { FeatureManagerModal } from '../components/FeatureManagerModal';
import { AddReservationModal } from '../components/AddReservationModal';
import { PageLoader, PageError } from '../components/QueryLoader';
import { Room } from '../types';

export const Rooms: React.FC = () => {
  const navigate = useNavigate();
  const { data: apiRooms, isLoading, isError } = useRooms();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState(false);
  const [selectedRoomForBooking, setSelectedRoomForBooking] = useState<string | null>(null);

  if (isLoading) return <PageLoader />;
  if (isError) return <PageError />;

  const roomsList: Room[] = apiRooms ?? [];

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 sm:gap-0">
        <div>
          <h2 className="font-display italic text-3xl md:text-4xl text-on-surface mb-1 leading-none">Room Management</h2>
          <p className="text-[10px] font-sans font-bold uppercase tracking-[0.3em] text-on-surface-variant/40">Oversee {roomsList.length} units live</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button 
            onClick={() => setIsFeatureModalOpen(true)}
            className="w-full sm:w-auto bg-stone-100 text-on-surface-variant px-6 py-3 rounded-xl font-sans text-xs font-bold tracking-[0.2em] uppercase hover:bg-stone-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Layers className="w-4 h-4" /> Attributes
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="w-full sm:w-auto bg-primary text-white px-6 py-3 rounded-xl font-sans text-xs font-bold tracking-[0.2em] uppercase hover:bg-primary-container transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/10 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New Unit
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-stone-200 pb-1">
        <div className="flex gap-6 md:gap-8 overflow-x-auto no-scrollbar pb-2 lg:pb-0 font-sans">
          {['All Rooms', 'Available', 'Occupied', 'Maintenance'].map((tab, i) => (
            <button 
              key={tab}
              className={cn(
                "pb-4 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] transition-all relative px-1 whitespace-nowrap cursor-pointer",
                i === 0 ? "text-primary" : "text-on-surface-variant/40 hover:text-on-surface-variant"
              )}
            >
              {tab}
              {i === 0 && <motion.div layoutId="room-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 mb-2 overflow-x-auto no-scrollbar pb-2 lg:pb-0">
          <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-4 py-2 cursor-pointer hover:bg-stone-50 transition-colors shrink-0">
            <Filter className="w-3.5 h-3.5 text-on-surface-variant" />
            <span className="text-[9px] font-bold tracking-[0.2em] text-on-surface-variant uppercase">Filters</span>
          </div>
          <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-4 py-2 cursor-pointer hover:bg-stone-50 transition-colors shrink-0">
            <Layers className="w-3.5 h-3.5 text-on-surface-variant" />
            <span className="text-[9px] font-bold tracking-[0.2em] text-on-surface-variant uppercase">Floor</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
        {roomsList.map((room, i) => (
          <motion.div
            key={room.id}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => navigate(`/rooms/${room.id}`)}
            className={cn(
              "bg-white rounded-3xl border border-stone-200/60 p-6 organic-shadow group cursor-pointer hover:border-primary/20 transition-all flex flex-col relative overflow-hidden border-l-[6px]",
              room.status === 'available' ? "border-l-status-available" : 
              room.status === 'occupied' ? "border-l-status-occupied" : 
              room.status === 'maintenance' ? "border-l-status-maintenance" : "border-l-status-reserved"
            )}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className={cn(
                  "px-2.5 py-1 rounded-lg text-[8px] font-bold uppercase tracking-widest shadow-sm border font-sans",
                  room.status === 'available' ? "bg-teal-50 text-status-available border-teal-200" :
                  room.status === 'occupied' ? "bg-orange-50 text-status-occupied border-orange-200" : "bg-stone-50 text-status-maintenance border-stone-200"
                )}>
                  {room.status}
                </span>
                <h3 className="font-display italic text-3xl text-primary mt-4 leading-none">Suite {room.number}</h3>
                <p className="font-mono text-[9px] text-on-surface-variant/60 uppercase tracking-widest mt-2 truncate max-w-[210px]">{room.type}</p>
              </div>
              <button className="text-on-surface-variant/40 hover:text-primary transition-colors cursor-pointer">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-6 py-6 border-y border-stone-50 mb-6 font-sans">
               <div className="flex items-center gap-2 text-on-surface-variant/60">
                 <Users className="w-4 h-4" />
                 <span className="text-[10px] font-bold tracking-widest uppercase">{room.capacity || "2 Pers"}</span>
               </div>
               <div className="flex items-center gap-2 text-on-surface-variant/60">
                 <Maximize className="w-4 h-4" />
                 <span className="text-[10px] font-bold tracking-widest uppercase">{room.area}m²</span>
               </div>
            </div>

            <div className="flex justify-between items-center mt-auto font-sans">
              <div className="flex items-center gap-3">
                <p className="font-display text-2xl text-gold-500">{room.rate.toLocaleString()} Ar</p>
                {room.status === 'available' && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRoomForBooking(room.id);
                    }}
                    className="p-2 bg-teal-50 text-status-available rounded-lg hover:bg-teal-600 hover:text-white transition-all border border-teal-100 cursor-pointer"
                    title="Instant Book"
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                  </button>
                )}
              </div>
              <button className="text-[9px] font-bold text-primary tracking-[0.2em] uppercase hover:underline underline-offset-4 cursor-pointer">View Details</button>
            </div>
            
            {/* Background art when no image */}
            {(!room.images || !room.images[0]) && (
              <div className="absolute -bottom-6 -right-6 w-24 h-24 text-primary/5 pointer-events-none transition-transform group-hover:-rotate-6">
                <Building2 className="w-full h-full" />
              </div>
            )}
          </motion.div>
        ))}
        
        <motion.div
          whileHover={{ scale: 0.98 }}
          onClick={() => setIsAddModalOpen(true)}
          className="bg-stone-50 rounded-3xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center p-12 group cursor-pointer hover:border-primary/40 transition-all opacity-60 hover:opacity-100"
        >
          <div className="w-16 h-16 rounded-full bg-white border border-stone-200 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
            <Plus className="w-8 h-8" />
          </div>
          <p className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase">Register Unit</p>
        </motion.div>
      </div>
      <AddRoomModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onRoomAdded={() => setIsAddModalOpen(false)}
      />
      <FeatureManagerModal isOpen={isFeatureModalOpen} onClose={() => setIsFeatureModalOpen(false)} />
      <AddReservationModal 
        isOpen={!!selectedRoomForBooking} 
        onClose={() => setSelectedRoomForBooking(null)} 
        initialRoomId={selectedRoomForBooking}
      />
    </div>
  );
};
