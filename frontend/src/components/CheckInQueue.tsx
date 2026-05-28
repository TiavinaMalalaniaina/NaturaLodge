import React from 'react';
import { motion } from 'motion/react';
import { User, Clock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface QueueItem {
  id: string;
  guestName: string;
  roomNumber: string;
  time: string;
  status: 'pending' | 'checking-in' | 'completed';
}

const MOCK_QUEUE: QueueItem[] = [
  { id: '1', guestName: 'S. Alistair', roomNumber: '204', time: '14:20', status: 'pending' },
  { id: '2', guestName: 'Maria Garcia', roomNumber: '105', time: '14:35', status: 'checking-in' },
  { id: '3', guestName: 'K. Thompson', roomNumber: '402', time: '15:10', status: 'pending' },
];

export const CheckInQueue: React.FC = () => {
  return (
    <div className="bg-white rounded-3xl border border-stone-200/60 organic-shadow overflow-hidden">
      <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50/30">
        <h4 className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-primary" /> Check-in Queue
        </h4>
        <span className="text-[10px] font-bold text-primary px-2 py-0.5 bg-teal-50 rounded-full">3 Active</span>
      </div>
      
      <div className="divide-y divide-stone-100">
        {MOCK_QUEUE.map((item, i) => (
          <motion.div 
            key={item.id}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className={cn(
              "p-5 flex items-center justify-between group cursor-pointer transition-colors",
              item.status === 'checking-in' ? "bg-teal-50/50" : "hover:bg-stone-50"
            )}
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center border transition-all",
                item.status === 'checking-in' 
                  ? "bg-primary text-white border-primary animate-pulse" 
                  : "bg-white text-on-surface-variant border-stone-200"
              )}>
                <User className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-on-surface leading-tight">{item.guestName}</p>
                <p className="text-[10px] font-mono text-on-surface-variant/60 uppercase mt-0.5">Suite {item.roomNumber} • ETA {item.time}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {item.status === 'checking-in' ? (
                <div className="flex items-center gap-2 px-3 py-1 bg-white border border-primary/20 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                  <span className="text-[9px] font-bold text-primary uppercase tracking-widest">In Process</span>
                </div>
              ) : (
                <button className="p-2 rounded-lg text-on-surface-variant/40 hover:text-primary hover:bg-white transition-all opacity-0 group-hover:opacity-100">
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
      
      <button className="w-full py-4 bg-stone-50 text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-[0.3em] hover:text-primary transition-colors">
        View Full Schedule
      </button>
    </div>
  );
};
