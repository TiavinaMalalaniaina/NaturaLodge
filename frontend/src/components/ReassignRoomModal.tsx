import React, { useState } from 'react';
import { X, ArrowRight, Bed, Star, Info, AlertTriangle, Check, Search, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { MOCK_ROOMS } from '../mockData';

interface ReassignRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  currentRoomNumber: string;
}

export const ReassignRoomModal: React.FC<ReassignRoomModalProps> = ({ isOpen, onClose, bookingId, currentRoomNumber }) => {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter available rooms for reassignment
  const availableRooms = MOCK_ROOMS.filter(r => r.status === 'available' && r.number !== currentRoomNumber);

  const handleReassign = () => {
    if (!selectedRoomId) return;
    
    setIsProcessing(true);
    // Simulate API call
    setTimeout(() => {
      console.log(`Booking ${bookingId} reassigned from ${currentRoomNumber} to ${selectedRoomId}`);
      setIsProcessing(false);
      onClose();
    }, 1200);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl border border-stone-200 overflow-hidden"
          >
            <div className="p-8 border-b border-stone-100 bg-stone-50/50">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-display italic text-3xl text-on-surface">Unit Reassignment</h3>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mt-1">Live Inventory Swap Protocol</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors border border-stone-200">
                  <X className="w-5 h-5 text-on-surface-variant" />
                </button>
              </div>

              <div className="flex items-center gap-6 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                 <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1">Current</span>
                    <div className="px-4 py-2 bg-white rounded-xl border border-amber-200 font-display italic text-xl text-amber-900">{currentRoomNumber}</div>
                 </div>
                 <ArrowRight className="w-6 h-6 text-amber-300" />
                 <div className="flex flex-col items-center flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1">Target Unit</span>
                    <div className={cn(
                      "w-full px-4 py-2 rounded-xl border font-display italic text-xl transition-all h-[44px] flex items-center justify-center",
                      selectedRoomId ? "bg-teal-600 border-teal-700 text-white shadow-lg shadow-teal-600/20" : "bg-stone-100 border-stone-200 text-stone-300 border-dashed"
                    )}>
                      {selectedRoomId ? MOCK_ROOMS.find(r => r.id === selectedRoomId)?.number : 'Select a Unit'}
                    </div>
                 </div>
              </div>
            </div>

            <div className="p-8 space-y-6 max-h-[50vh] overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between mb-4">
                 <h4 className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant/60 uppercase">Available Compatible Units</h4>
                 <div className="flex items-center gap-2">
                    <button className="flex items-center gap-2 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                      <Filter className="w-3 h-3" /> Same Category
                    </button>
                 </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {availableRooms.map((room) => (
                  <button
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-2xl border transition-all group",
                      selectedRoomId === room.id 
                        ? "bg-teal-50 border-teal-600 ring-2 ring-teal-100" 
                        : "bg-white border-stone-200 hover:border-stone-400"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-xl border flex items-center justify-center transition-all",
                        selectedRoomId === room.id ? "bg-teal-600 text-white" : "bg-stone-50 text-stone-400 group-hover:bg-stone-100"
                      )}>
                        <Bed className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-on-surface">{room.type} {room.number}</p>
                        <p className="text-[10px] font-light text-on-surface-variant/60">{room.category} • {room.view}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                       <div className="text-right">
                          <p className="text-xs font-bold text-primary">{room.rate.toLocaleString()} Ar</p>
                          <p className="text-[9px] font-medium text-on-surface-variant/40">per night</p>
                       </div>
                       {selectedRoomId === room.id && (
                         <div className="w-6 h-6 bg-teal-600 rounded-full flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                         </div>
                       )}
                    </div>
                  </button>
                ))}
                {availableRooms.length === 0 && (
                  <div className="py-12 flex flex-col items-center justify-center text-on-surface-variant/40 bg-stone-50 rounded-[2rem] border border-dashed border-stone-200">
                    <AlertTriangle className="w-8 h-8 mb-4 opacity-20" />
                    <p className="font-display italic text-lg">No comparable units available</p>
                    <p className="text-[10px] uppercase font-bold tracking-widest mt-1 opacity-60 text-center max-w-xs">Upgrade guest or manually override maintenance locks.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-8 bg-stone-50 border-t border-stone-100 flex items-center gap-4">
              <button 
                onClick={onClose}
                className="px-8 py-4 bg-white text-on-surface-variant border border-stone-200 rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-stone-50 transition-all"
              >
                Cancel
              </button>
              <button 
                disabled={!selectedRoomId || isProcessing}
                onClick={handleReassign}
                className={cn(
                  "flex-1 py-4 text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-3",
                  selectedRoomId && !isProcessing ? "bg-zinc-900 hover:bg-black shadow-xl shadow-black/20" : "bg-stone-300 cursor-not-allowed"
                )}
              >
                {isProcessing ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                    <Info className="w-4 h-4" />
                  </motion.div>
                ) : <Check className="w-4 h-4" />}
                {isProcessing ? 'Updating Ledger...' : 'Confirm Reassignment'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
