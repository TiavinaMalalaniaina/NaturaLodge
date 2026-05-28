import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Printer, Share2, Building2, User, Calendar, CreditCard, ChevronDown, Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: {
    id: string;
    guestName: string;
    roomNumber: string;
    roomType: string;
    arrival: string;
    departure: string;
    totalAmount: number;
  } | null;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ isOpen, onClose, booking }) => {
  const invoiceRef = useRef<HTMLDivElement>(null);

  if (!booking) return null;

  // Mock calculation breakdown
  const nights = 4;
  const nightlyRate = Math.floor(booking.totalAmount / nights);
  const tax = Math.floor(booking.totalAmount * 0.2);
  const totalWithTax = booking.totalAmount + tax;

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-4xl max-h-[90vh] bg-stone-50 rounded-[2.5rem] shadow-2xl border border-stone-200 overflow-hidden flex flex-col"
          >
            {/* Header / Actions */}
            <div className="p-6 md:p-8 border-b border-stone-200 bg-white flex justify-between items-center">
              <div>
                <h3 className="font-display italic text-2xl text-on-surface">Invoice Registry</h3>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40">Reference: INV-{booking.id.toUpperCase()}</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handlePrint}
                  className="p-3 border border-stone-200 rounded-xl hover:bg-stone-50 text-on-surface-variant transition-all flex items-center gap-2 group"
                >
                  <Printer className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:block">Print Document</span>
                </button>
                <button className="p-3 border border-stone-200 rounded-xl hover:bg-stone-50 text-on-surface-variant transition-all flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:block">Export PDF</span>
                </button>
                <div className="w-[1px] h-10 bg-stone-200 mx-2" />
                <button onClick={onClose} className="p-3 bg-white border border-stone-200 rounded-full hover:bg-stone-50 transition-colors">
                  <X className="w-5 h-5 text-on-surface-variant/60" />
                </button>
              </div>
            </div>

            {/* Document Content */}
            <div className="flex-1 overflow-y-auto p-8 md:p-12 no-scrollbar">
              <div 
                ref={invoiceRef}
                className="bg-white p-12 md:p-16 rounded-3xl shadow-sm border border-stone-200 mx-auto max-w-3xl min-h-[1000px] flex flex-col"
              >
                {/* Branding */}
                <div className="flex justify-between items-start mb-20">
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center">
                      <Building2 className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h4 className="font-display italic text-3xl leading-none">Natura Lodge</h4>
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-40 mt-1">Lodge & Retreat</p>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-xs font-bold uppercase tracking-widest">Natura Lodge AG</p>
                    <p className="text-[10px] text-on-surface-variant/60 leading-relaxed">
                      Via Alpina 42<br />
                      7500 Saint-Moritz<br />
                      Switzerland
                    </p>
                    <p className="text-[10px] font-mono text-on-surface-variant/40 pt-2">VAT NO: CHE-123.456.789</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-20 mb-20">
                  <div>
                    <h5 className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-4 pb-2 border-b border-stone-100">Bill To</h5>
                    <div className="space-y-1">
                       <p className="text-lg font-bold text-on-surface">{booking.guestName}</p>
                       <p className="text-[10px] text-on-surface-variant/60 leading-relaxed">
                         Registered Guest • Member since 2021<br />
                         ID: {'guestId' in booking ? (booking as any).guestId : 'G-88219'}
                       </p>
                    </div>
                  </div>
                  <div>
                    <h5 className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-4 pb-2 border-b border-stone-100">Document Detail</h5>
                    <div className="grid grid-cols-2 gap-y-4 text-[10px]">
                       <div>
                         <p className="font-bold opacity-40 uppercase tracking-widest">Issue Date</p>
                         <p className="font-mono mt-1">May 15, 2026</p>
                       </div>
                       <div>
                         <p className="font-bold opacity-40 uppercase tracking-widest">Due Date</p>
                         <p className="font-mono mt-1">On Arrival</p>
                       </div>
                       <div>
                         <p className="font-bold opacity-40 uppercase tracking-widest">Reservation</p>
                         <p className="font-mono mt-1">#{booking.id.toUpperCase()}</p>
                       </div>
                       <div>
                         <p className="font-bold opacity-40 uppercase tracking-widest">Status</p>
                         <div className="flex items-center gap-1.5 mt-1 text-teal-600 font-bold uppercase">
                            <Check className="w-3 h-3" /> Paid
                         </div>
                       </div>
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className="flex-1">
                   <table className="w-full text-left">
                     <thead>
                       <tr className="border-b border-stone-200">
                         <th className="py-4 text-[10px] font-bold uppercase tracking-widest opacity-40">Description</th>
                         <th className="py-4 text-[10px] font-bold uppercase tracking-widest opacity-40 text-center">Nights</th>
                         <th className="py-4 text-[10px] font-bold uppercase tracking-widest opacity-40 text-right">Price</th>
                         <th className="py-4 text-[10px] font-bold uppercase tracking-widest opacity-40 text-right">Amount</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-stone-100">
                       <tr>
                         <td className="py-6">
                           <p className="text-sm font-semibold text-on-surface">{booking.roomType}</p>
                           <p className="text-[10px] text-on-surface-variant/60 mt-0.5">Unit {booking.roomNumber} • {booking.arrival} to {booking.departure}</p>
                         </td>
                         <td className="py-6 text-center text-xs font-mono">{nights}</td>
                         <td className="py-6 text-right text-xs font-mono">{nightlyRate.toLocaleString()} Ar</td>
                         <td className="py-6 text-right text-sm font-bold">{booking.totalAmount.toLocaleString()} Ar</td>
                       </tr>
                       <tr>
                         <td className="py-6">
                           <p className="text-sm font-semibold text-on-surface">Luxury Concierge Fee</p>
                           <p className="text-[10px] text-on-surface-variant/60 mt-0.5">Valet, dedicated butler & wellness access</p>
                         </td>
                         <td className="py-6 text-center text-xs font-mono">1</td>
                         <td className="py-6 text-right text-xs font-mono">Included</td>
                         <td className="py-6 text-right text-sm font-bold">0 Ar</td>
                       </tr>
                     </tbody>
                   </table>
                </div>

                {/* Totals */}
                <div className="mt-20 pt-10 border-t-2 border-stone-900 flex flex-col items-end space-y-4">
                   <div className="flex gap-20 text-[10px] font-bold uppercase tracking-widest opacity-40">
                      <span>Subtotal</span>
                      <span className="font-mono text-on-surface">{booking.totalAmount.toLocaleString()} Ar</span>
                   </div>
                   <div className="flex gap-20 text-[10px] font-bold uppercase tracking-widest opacity-40">
                      <span>VAT (20%)</span>
                      <span className="font-mono text-on-surface">{tax.toLocaleString()} Ar</span>
                   </div>
                   <div className="flex gap-20 pt-4 border-t border-stone-100">
                      <span className="text-xs font-bold uppercase tracking-[0.3em] text-on-surface-variant">Grand Total</span>
                      <span className="text-3xl font-display italic text-primary leading-none">{totalWithTax.toLocaleString()} Ar</span>
                   </div>
                </div>

                {/* Footer */}
                <div className="mt-auto pt-20 flex justify-between items-end border-t border-stone-100">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-widest opacity-40">
                      <CreditCard className="w-4 h-4 text-primary" />
                      Paid via Amex Platinum • **** 8821
                    </div>
                    <p className="text-[9px] font-medium text-on-surface-variant/40 leading-relaxed max-w-xs">
                      Thank you for choosing Natura Lodge. We hope your stay at our retreat is exceptional.
                    </p>
                  </div>
                  <div className="text-right">
                      <p className="font-display italic text-xl opacity-20">Natura Lodge</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Note */}
            <div className="bg-white p-6 md:px-12 border-t border-stone-200 flex items-center gap-4">
               <div className="w-8 h-8 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center">
                  <Share2 className="w-4 h-4 text-teal-600" />
               </div>
               <p className="text-[10px] font-medium text-on-surface-variant/60 leading-relaxed">
                 A digital copy of this invoice has been encrypted and synchronized to the guest's mobile application.
               </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
