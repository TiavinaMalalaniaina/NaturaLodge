import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Settings2, Waves, Trees, Dumbbell, Coffee, Clock, ShieldCheck, ChevronRight, Activity, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { AddAmenityModal } from '../components/AddAmenityModal';

interface Amenity {
  id: string;
  name: string;
  category: string;
  status: 'active' | 'maintenance' | 'closed';
  capacity: string;
  hours: string;
  icon: string; // Icon component name
  color: string;
  nextService: string;
  usage: number; // percentage
}

const MOCK_AMENITIES: Amenity[] = [
  {
    id: '1',
    name: 'Azure Infinity Pool',
    category: 'Leisure',
    status: 'active',
    capacity: '40 guests',
    hours: '07:00 - 21:00',
    icon: Waves,
    color: 'bg-blue-500',
    nextService: 'May 24, 2026',
    usage: 65,
  },
  {
    id: '2',
    name: 'Zenith Fitness Club',
    category: 'Wellness',
    status: 'active',
    capacity: '25 guests',
    hours: '24/7 Access',
    icon: Dumbbell,
    color: 'bg-primary',
    nextService: 'Jun 02, 2026',
    usage: 32,
  },
  {
    id: '3',
    name: 'Natura Spa & Sauna',
    category: 'Wellness',
    status: 'maintenance',
    capacity: '12 guests',
    hours: '09:00 - 20:00',
    icon: Trees,
    color: 'bg-teal-600',
    nextService: 'In Progress',
    usage: 0,
  },
  {
    id: '4',
    name: 'The Terrace Bistro',
    category: 'Dining',
    status: 'active',
    capacity: '120 guests',
    hours: '11:00 - 23:00',
    icon: Coffee,
    color: 'bg-gold-600',
    nextService: 'May 20, 2026',
    usage: 88,
  },
];

export const Amenities: React.FC = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <h2 className="font-display italic text-3xl md:text-4xl text-on-surface mb-1 leading-none">Amenity Operations</h2>
          <p className="text-[10px] font-sans font-bold uppercase tracking-[0.3em] text-on-surface-variant/40">Manage facilities & live utilization</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button className="flex-1 sm:flex-none bg-stone-100 text-on-surface-variant px-6 py-3 rounded-xl font-sans text-xs font-bold tracking-[0.2em] uppercase hover:bg-stone-200 transition-all flex items-center justify-center gap-2">
            <Settings2 className="w-4 h-4" /> Global Config
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex-1 sm:flex-none bg-primary text-white px-6 py-3 rounded-xl font-sans text-xs font-bold tracking-[0.2em] uppercase hover:bg-primary-container transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/10"
          >
            <Plus className="w-4 h-4" /> Add Facility
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {MOCK_AMENITIES.map((amenity, i) => (
          <motion.div
            key={amenity.id}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className="group bg-white rounded-3xl border border-stone-200/60 overflow-hidden organic-shadow flex flex-col"
          >
            <div className="p-6 pb-4">
              <div className="flex justify-between items-start mb-6">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg", amenity.color)}>
                  <amenity.icon className="w-6 h-6" />
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border",
                  amenity.status === 'active' ? "bg-teal-50 text-primary border-primary/20" :
                  amenity.status === 'maintenance' ? "bg-amber-50 text-amber-600 border-amber-200" :
                  "bg-stone-50 text-stone-400 border-stone-200"
                )}>
                  {amenity.status}
                </div>
              </div>

              <h3 className="font-display italic text-xl text-on-surface mb-1 group-hover:text-primary transition-colors">{amenity.name}</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-4">{amenity.category}</p>

              <div className="space-y-3 pt-4 border-t border-stone-100">
                <div className="flex items-center gap-3">
                  <Clock className="w-3.5 h-3.5 text-on-surface-variant/40" />
                  <span className="text-xs text-on-surface-variant font-light">{amenity.hours}</span>
                </div>
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-3.5 h-3.5 text-on-surface-variant/40" />
                  <span className="text-xs text-on-surface-variant font-light">Next Service: <span className="font-bold">{amenity.nextService}</span></span>
                </div>
              </div>
            </div>

            <div className="mt-auto p-6 pt-2">
              <div className="flex justify-between items-end mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Live Utilization</p>
                <p className="text-sm font-mono font-bold text-primary">{amenity.usage}%</p>
              </div>
              <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${amenity.usage}%` }}
                  className={cn(
                    "h-full rounded-full transition-all duration-1000",
                    amenity.usage > 80 ? "bg-red-400" : "bg-primary"
                  )}
                />
              </div>
              <p className="text-[9px] text-on-surface-variant/40 mt-2 font-medium">Capacity: {amenity.capacity}</p>
            </div>
          </motion.div>
        ))}

        <motion.div
           whileHover={{ scale: 0.98 }}
           onClick={() => setIsAddModalOpen(true)}
           className="bg-stone-50 rounded-3xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center p-8 opacity-60 hover:opacity-100 transition-all cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-full bg-white border border-stone-100 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-all">
             <Plus className="w-5 h-5" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Add New Amenity</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-sans font-bold tracking-[0.2em] text-on-surface-variant uppercase flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Maintenance Tickets
            </h3>
            <button className="text-[10px] font-bold text-primary hover:underline transition-all tracking-widest uppercase">Manage All</button>
          </div>
          
          <div className="bg-white rounded-[2rem] border border-stone-200/60 overflow-hidden organic-shadow">
             <div className="divide-y divide-stone-100">
               {[
                 { id: 'T-102', facility: 'Natura Spa', issue: 'Sauna thermostat calibration required', priority: 'medium', status: 'In Progress' },
                 { id: 'T-105', facility: 'Azure Pool', issue: 'pH sensor technical alert', priority: 'high', status: 'Pending' },
                 { id: 'T-108', facility: 'Fitness Club', issue: 'Treadmill #4 software update', priority: 'low', status: 'Scheduled' },
               ].map((ticket) => (
                 <div key={ticket.id} className="p-6 flex items-center justify-between hover:bg-stone-50/50 transition-colors cursor-pointer group">
                   <div className="flex items-center gap-5">
                      <div className="w-10 h-10 rounded-xl bg-stone-100 flex flex-col items-center justify-center border border-stone-200">
                        <span className="text-[8px] font-bold text-stone-400">ID</span>
                        <span className="text-[10px] font-mono font-bold leading-none">{ticket.id.split('-')[1]}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-on-surface">{ticket.facility}</p>
                        <p className="text-xs text-on-surface-variant font-light">{ticket.issue}</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border",
                          ticket.priority === 'high' ? "bg-red-50 text-red-500 border-red-200" :
                          ticket.priority === 'medium' ? "bg-amber-50 text-amber-600 border-amber-200" :
                          "bg-stone-50 text-stone-400 border-stone-200"
                        )}>
                          {ticket.priority} Priority
                        </span>
                        <p className="text-[10px] font-medium text-on-surface-variant/40 mt-1 uppercase tracking-tighter">{ticket.status}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-primary transition-colors" />
                   </div>
                 </div>
               ))}
             </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-sans font-bold tracking-[0.2em] text-on-surface-variant uppercase">Operational Pulse</h3>
          </div>
          
          <div className="bg-stone-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden organic-shadow h-full flex flex-col justify-between min-h-[300px]">
            <div className="relative z-10">
               <div className="flex items-center gap-3 mb-8">
                 <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                 <span className="text-[10px] font-bold uppercase tracking-[0.2rem] opacity-60">Revenue Performance</span>
               </div>
               <div className="space-y-6">
                 <div>
                  <p className="text-3xl font-display italic leading-none mb-1">21,690,000 Ar</p>
                   <p className="text-[10px] font-bold uppercase tracking-widest text-teal-400">Ancillary Sales Today</p>
                 </div>
                 <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                       <p className="text-[8px] font-bold uppercase tracking-widest opacity-40 mb-1">Spa Booking</p>
                       <p className="text-sm font-semibold">12 Resolved</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                       <p className="text-[8px] font-bold uppercase tracking-widest opacity-40 mb-1">F&B Upsell</p>
                       <p className="text-sm font-semibold">+24% Peak</p>
                    </div>
                 </div>
               </div>
            </div>
            
            <div className="mt-12 p-5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
               <div className="flex items-center gap-2 mb-2">
                 <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                 <span className="text-[10px] font-bold uppercase tracking-widest">Health & Safety</span>
               </div>
               <p className="text-[11px] font-light leading-relaxed opacity-70">
                 Azure pool chemical balance check mandatory in 45 minutes.
               </p>
            </div>
          </div>
        </section>
      </div>
      <AddAmenityModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
    </div>
  );
};
