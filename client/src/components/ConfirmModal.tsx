import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning';
  isPending?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen, onClose, onConfirm,
  title, message,
  confirmLabel,
  variant = 'danger',
  isPending = false,
}) => {
  const { t } = useTranslation();
  const resolvedConfirmLabel = confirmLabel ?? t('common.confirm');

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-stone-900/50 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-stone-100 p-8"
          >
            <button onClick={onClose}
              className="absolute top-5 right-5 p-1.5 rounded-full text-on-surface-variant/40 hover:bg-stone-100 transition-colors">
              <X className="w-4 h-4" />
            </button>

            <div className={cn(
              'w-12 h-12 rounded-2xl flex items-center justify-center mb-6',
              variant === 'danger'  ? 'bg-red-50'    : 'bg-amber-50',
            )}>
              <AlertTriangle className={cn(
                'w-6 h-6',
                variant === 'danger' ? 'text-red-500' : 'text-amber-500',
              )} />
            </div>

            <h3 className="font-display italic text-2xl text-on-surface mb-2">{title}</h3>
            <p className="text-sm text-on-surface-variant/70 leading-relaxed mb-8">{message}</p>

            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 py-3 bg-stone-100 text-on-surface-variant rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-stone-200 transition-all">
                {t('common.keepIt')}
              </button>
              <button onClick={onConfirm} disabled={isPending}
                className={cn(
                  'flex-1 py-3 rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase transition-all disabled:opacity-50',
                  variant === 'danger'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-amber-500 text-white hover:bg-amber-600',
                )}>
                {isPending ? '...' : resolvedConfirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
