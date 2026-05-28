import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, ExternalLink, Check, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useNotifications } from '../context/NotificationContext';

export const NewBookingsFeed: React.FC = () => {
  const { notifications, markAsRead, clearNotification } = useNotifications();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-1">
        <h4 className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-gold-500 fill-gold-500" /> Recent Activity
        </h4>
        <span className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest leading-none">Live Sync</span>
      </div>

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {notifications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6 text-center border border-dashed border-stone-200 rounded-2xl bg-white/50"
            >
              <p className="text-xs text-on-surface-variant/50">No recent activities available.</p>
            </motion.div>
          ) : (
            notifications.slice(0, 5).map((notif, i) => (
              <motion.div
                key={notif.id}
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 10, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "group relative bg-white p-4 rounded-2xl border transition-all cursor-pointer overflow-hidden",
                  notif.read ? "border-stone-200/50 opacity-70" : "border-teal-100 ring-1 ring-primary/5 bg-gradient-to-tr from-white to-teal-50/10 shadow-sm"
                )}
                onClick={() => markAsRead(notif.id)}
              >
                {/* Floating Clear Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearNotification(notif.id);
                  }}
                  className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 p-1 hover:bg-stone-100 rounded text-stone-400 hover:text-red-500 transition-all"
                  title="Clear alert"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      notif.source === 'direct' ? "bg-primary" : 
                      notif.source === 'ota' ? "bg-amber-500" : 
                      notif.source === 'system' ? "bg-red-400" : "bg-teal-500"
                    )} />
                    <span className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest leading-none">{notif.title}</span>
                    {!notif.read && (
                      <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary uppercase text-[7px] font-bold tracking-wider leading-none">New</span>
                    )}
                  </div>
                  <span className="text-[9px] font-mono text-on-surface-variant/30 group-hover:opacity-0 transition-opacity whitespace-nowrap">{notif.time}</span>
                </div>
                
                <div className="flex justify-between items-end">
                  <div className="pr-4">
                    <p className="text-xs font-semibold text-on-surface leading-snug">{notif.subtitle}</p>
                  </div>
                  <div className="text-right flex items-center gap-2 self-end select-none">
                    {notif.amount && notif.amount !== '--' && (
                      <p className="text-xs font-mono font-bold text-primary">{notif.amount}</p>
                    )}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-primary">
                       <Check className="w-3 h-3 text-stone-400" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
